import { writeFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "playwright";
import {
  ensureCaptureDir,
  loadConfig,
  resetConfigCache,
  validateBrowserWorkerConfig,
} from "../config.js";
import { createLogger } from "../logger.js";
import { ensureAuthenticatedPage } from "../auth/session.js";
import { assertBrowserScriptSafe } from "./browser-page-scripts.js";
import { attachLiveWebSocketListeners } from "./live-websocket-listener.js";
import { NetworkCapture } from "./network-capture.js";
import { redactSecrets } from "./redaction.js";
import { extractTreeStatusOnPage, loadInventorySourceFromQueryDeviceTree } from "../worker/status-tree-sync.js";
import { safelySelectOnlineDeviceOnPage } from "./device-list-discovery.js";
import {
  buildPositionSourceInspectScript,
  candidateFromRecord,
  collectPositionFieldMatches,
  extractNetworkPositionCandidates,
  normalizePositionSourceInspection,
  recommendPositionSource,
  type PositionCandidate,
} from "../gps51/position-source-extract.js";

export const POSITION_SOURCE_SUMMARY_FILE = "position-source-summary.json";
export const POSITION_SOURCE_FIELDS_FILE = "position-source-fields.json";
export const POSITION_SOURCE_NETWORK_FILE = "position-source-network.json";

const isMain = process.argv[1]?.includes("position-source-discovery");

function writeJson(captureDir: string, file: string, value: unknown): void {
  writeFileSync(path.join(captureDir, file), JSON.stringify(value, null, 2));
}

function flattenTreeNodeFields(node: Record<string, unknown> | null): Record<string, number> {
  if (!node) return {};
  const out: Record<string, number> = {};
  function walk(value: unknown, prefix: string, depth: number): void {
    if (depth > 4 || value == null) return;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      out[prefix] = 1;
      return;
    }
    if (Array.isArray(value) || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value as Record<string, unknown>).slice(0, 60)) {
      if (key.startsWith("_") || key.startsWith("$") || key === "children") continue;
      walk(child, prefix ? `${prefix}.${key}` : key, depth + 1);
    }
  }
  walk(node, "", 0);
  return out;
}

export async function inspectPositionSourceOnPage(
  page: Page,
  selectedDeviceId: string,
): Promise<ReturnType<typeof normalizePositionSourceInspection>> {
  const script = buildPositionSourceInspectScript(selectedDeviceId);
  assertBrowserScriptSafe(script);
  const raw = await page.evaluate(script).catch(() => null);
  return normalizePositionSourceInspection(raw);
}

export async function runPositionSourceDiscovery(): Promise<void> {
  resetConfigCache();
  const config = loadConfig(process.env);
  validateBrowserWorkerConfig(config);
  ensureCaptureDir(config);
  const log = createLogger(config);

  const failureSummary = {
    selectedDeviceId: null as string | null,
    positionSource: null as string | null,
    positionFieldPath: null as string | null,
    latitude: null as number | null,
    longitude: null as number | null,
    speed: null as number | null,
    gpsTimestamp: null as string | null,
    updateTimestamp: null as string | null,
    sourcePositionId: null as number | null,
    validated: false,
    validationReasons: [] as string[],
    errorMessage: null as string | null,
    generatedAt: new Date().toISOString(),
  };

  let cleanup: (() => Promise<void>) | null = null;
  try {
    const session = await ensureAuthenticatedPage(config, log, { forceHeadless: true });
    cleanup = session.cleanup;
    const { page } = session;

    const inventory = await loadInventorySourceFromQueryDeviceTree(page, config);
    const treeStatus = await extractTreeStatusOnPage(page, new Set(inventory.deviceIds), config);
    if (!treeStatus.reconciliation.validated) {
      throw new Error(
        `Validated online device list unavailable: ${treeStatus.reconciliation.validationReasons.join(", ")}`,
      );
    }

    const candidateDeviceId = treeStatus.reconciliation.onlineDeviceIds[0] ?? null;
    if (!candidateDeviceId) {
      throw new Error("No online device available for position source discovery");
    }

    const capture = new NetworkCapture();
    capture.attach(page);
    const selectionStartMs = Date.now();

    const inspectionBefore = await inspectPositionSourceOnPage(page, candidateDeviceId);

    let websocketCandidate: PositionCandidate | null = null;
    const waitForPosition = new Promise<void>((resolve) => {
      const detach = attachLiveWebSocketListeners(page, log, {
        onPositionLast: async (position) => {
          if (position.sourceDeviceId !== candidateDeviceId || websocketCandidate) return;
          websocketCandidate = candidateFromRecord(
            "websocket_positionLast",
            "positionLast",
            {
              ...position.rawPayload,
              deviceid: position.sourceDeviceId,
              callat: position.latitude,
              callon: position.longitude,
              updatetime: position.sourceUpdatedAt,
              validpoistiontime: position.sourceLocatedAt,
              positionlastid: position.sourcePositionId,
              speed: position.speedKmh,
            },
            null,
          );
          detach();
          resolve();
        },
        onRemindMsg: () => undefined,
        onParseError: () => undefined,
      });
      setTimeout(() => {
        detach();
        resolve();
      }, 10_000);
    });

    const selection = await safelySelectOnlineDeviceOnPage(page, candidateDeviceId);
    await waitForPosition;
    await page.waitForTimeout(1500);

    const inspectionAfter = await inspectPositionSourceOnPage(page, candidateDeviceId);
    const selectedDeviceId = selection.selectedDeviceId ?? candidateDeviceId;

    const networkEntries = capture
      .getAll()
      .filter((entry) => Date.parse(entry.capturedAt) >= selectionStartMs - 1000)
      .map((entry) => ({
        action: entry.action,
        body: entry.sanitizedBody,
        url: entry.url,
        capturedAt: entry.capturedAt,
      }));

    const networkCandidates = extractNetworkPositionCandidates(
      networkEntries.map((entry) => ({ action: entry.action, body: entry.body })),
      selectedDeviceId,
    );

    const candidates: PositionCandidate[] = [
      ...inspectionBefore.candidates,
      ...inspectionAfter.candidates,
      ...networkCandidates,
    ];
    if (websocketCandidate) {
      candidates.push(websocketCandidate);
    }

    const recommendation = recommendPositionSource(candidates, selectedDeviceId);
    const candidate = recommendation.candidate;

    const beforeFields = flattenTreeNodeFields(inspectionBefore.treeNodeBefore);
    const afterFields = flattenTreeNodeFields(inspectionAfter.treeNodeAfter);
    const mergedFieldCounts: Record<string, number> = { ...beforeFields };
    for (const [key, count] of Object.entries(afterFields)) {
      mergedFieldCounts[key] = (mergedFieldCounts[key] ?? 0) + count;
    }

    const summary = {
      status: recommendation.validated ? "success" : "failed",
      selectedDeviceId,
      positionSource: recommendation.positionSource,
      positionFieldPath: recommendation.positionFieldPath,
      latitude: candidate?.latitude ?? null,
      longitude: candidate?.longitude ?? null,
      speed: candidate?.speed ?? null,
      gpsTimestamp: candidate?.gpsTimestamp ?? null,
      updateTimestamp: candidate?.updateTimestamp ?? null,
      sourcePositionId: candidate?.sourcePositionId ?? null,
      validated: recommendation.validated,
      validationReasons: recommendation.validationReasons,
      componentPath: candidate?.componentPath ?? selection.componentPath,
      mapComponentPaths: inspectionAfter.mapComponentPaths,
      cacheMgrFound: inspectionAfter.cacheMgrFound,
      networkActionCount: networkEntries.length,
      candidateCount: candidates.length,
      selectionMethod: selection.selectionMethod,
      errorMessage: selection.error,
      generatedAt: new Date().toISOString(),
    };

    writeJson(config.captureDir, POSITION_SOURCE_FIELDS_FILE, {
      selectedDeviceId,
      inventoryCount: inventory.deviceIds.length,
      treeNodeBeforeFields: beforeFields,
      treeNodeAfterFields: afterFields,
      semanticFields: collectPositionFieldMatches(mergedFieldCounts),
      mapComponentPaths: inspectionAfter.mapComponentPaths,
      cacheMgrFound: inspectionAfter.cacheMgrFound,
      candidates: candidates.map((item) => ({
        source: item.source,
        fieldPath: item.fieldPath,
        deviceId: item.deviceId,
        latitude: item.latitude,
        longitude: item.longitude,
        componentPath: item.componentPath,
      })),
    });

    writeJson(
      config.captureDir,
      POSITION_SOURCE_NETWORK_FILE,
      redactSecrets({
        selectedDeviceId,
        excludedActions: ["reportmileagedetail", "poibatch"],
        entries: networkEntries,
        websocketPositionLast: websocketCandidate
          ? {
              latitude: (websocketCandidate as PositionCandidate).latitude,
              longitude: (websocketCandidate as PositionCandidate).longitude,
            }
          : null,
      }),
    );

    writeJson(config.captureDir, POSITION_SOURCE_SUMMARY_FILE, summary);

    console.log("\n--- GPS51 Position Source Discovery ---");
    console.log(JSON.stringify(summary, null, 2));
    console.log("Files written to data/captures/");
    console.log("---------------------------------------\n");

    if (!recommendation.validated) {
      process.exitCode = 2;
    }
  } catch (error) {
    const summary = {
      ...failureSummary,
      errorMessage: error instanceof Error ? error.message : String(error),
      generatedAt: new Date().toISOString(),
    };
    writeJson(config.captureDir, POSITION_SOURCE_FIELDS_FILE, {});
    writeJson(config.captureDir, POSITION_SOURCE_NETWORK_FILE, {});
    writeJson(config.captureDir, POSITION_SOURCE_SUMMARY_FILE, summary);
    throw error;
  } finally {
    if (cleanup) await cleanup().catch(() => undefined);
  }
}

if (isMain) {
  runPositionSourceDiscovery()
    .then(() => process.exit(process.exitCode ?? 0))
    .catch((err) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    });
}
