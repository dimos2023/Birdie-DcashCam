import { writeFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "playwright";
import { loadConfig, validateWorkerConfig, ensureCaptureDir, resetConfigCache } from "../config.js";
import { createLogger } from "../logger.js";
import { ensureAuthenticatedPage } from "../auth/session.js";
import { NetworkCapture, waitForDiscoverySignals } from "./network-capture.js";
import { readPortalStatusCounts } from "./monitor-subscription.js";
import { collectBootstrapDeviceRecords } from "../gps51/status-bootstrap-parser.js";
import {
  discoverFieldCandidates,
  pickBestFieldCandidate,
  profileDeviceFields,
  type DeviceFieldProfile,
  type FieldStatusCandidate,
} from "../gps51/status-model-field-profiler.js";
import {
  buildModelCandidate,
  categorizeModelDiscoveryFailure,
  recommendModelSource,
  validateStatusModelDiscovery,
  type ModelCandidate,
  type ModelPortalCounts,
} from "../gps51/status-model-reconciliation.js";
import {
  buildVueAppProbeScript,
  normalizeBrowserProbeHits,
} from "../gps51/status-model-traverse.js";
import {
  clickStatusTabSafely,
  waitForLoadingToSettle,
  waitForStablePortalCount,
  inspectTabActiveState,
  buildTabSelectionEvidence,
} from "./status-dom-tabs.js";
import { assertBrowserScriptSafe } from "./browser-page-scripts.js";

export const STATUS_MODEL_SUMMARY_FILE = "status-model-summary.json";
export const STATUS_FIELD_PROFILES_FILE = "status-field-profiles.json";
export const STATUS_MODEL_CANDIDATES_FILE = "status-model-candidates.json";
export const STATUS_MODEL_ONLINE_IDS_FILE = "status-model-online-ids.json";
export const STATUS_MODEL_OFFLINE_IDS_FILE = "status-model-offline-ids.json";

const isMain = process.argv[1]?.includes("status-model-discovery");

type TabModelCapture = {
  tab: "all" | "online" | "offline";
  portalCountBefore: number | null;
  portalCountAfter: number | null;
  tabClicked: boolean;
  tabSelected: boolean;
  candidates: ModelCandidate[];
};

async function readPortalSnapshot(page: Page): Promise<ModelPortalCounts> {
  const counts = await readPortalStatusCounts(page).catch(() => ({
    all: null,
    online: null,
    offline: null,
  }));
  return { ...counts };
}

async function probeVueModelCandidates(
  page: Page,
  inventoryIds: Set<string>,
  tab: "all" | "online" | "offline",
  portalCount: number | null,
  previousSignatures: string[],
): Promise<ModelCandidate[]> {
  const inventorySample = [...inventoryIds].slice(0, 500);
  const script = buildVueAppProbeScript(inventorySample);
  assertBrowserScriptSafe(script);
  const raw = await page.evaluate(script).catch(() => []);
  const hits = normalizeBrowserProbeHits(raw, inventoryIds);

  return hits.map((hit) =>
    buildModelCandidate({
      source: hit.source,
      dataPath: hit.dataPath,
      tab,
      matchedIds: hit.matchedInventoryIds,
      collectionLength: hit.collectionLength,
      statusFields: hit.statusFields,
      hasPerDeviceStatus: hit.hasPerDeviceStatus,
      portalCount,
      previousSignatures,
    }),
  );
}

async function captureTabModelState(
  page: Page,
  tab: "all" | "online" | "offline",
  inventoryIds: Set<string>,
  previousSignatures: string[],
  skipClick = false,
): Promise<TabModelCapture> {
  let tabClicked = false;
  let tabSelected = false;

  if (!skipClick && tab !== "all") {
    const click = await clickStatusTabSafely(page, tab);
    tabClicked = click.clicked;
    await waitForLoadingToSettle(page);
    const active = await inspectTabActiveState(page, tab);
    const evidence = buildTabSelectionEvidence({
      clickDiagnostics: click,
      ariaSelected: active.ariaSelected,
      activeClass: active.activeClass,
      portalCountMatches: false,
      rowSignatureChanged: true,
      anotherTabLostActive: true,
    });
    tabSelected = evidence.selected;
  } else if (tab === "all") {
    tabSelected = true;
  }

  const portalSnapshot = await waitForStablePortalCount(page, tab, 1200);
  const portalCount = portalSnapshot.after ?? portalSnapshot.before;
  const candidates = await probeVueModelCandidates(
    page,
    inventoryIds,
    tab,
    portalCount,
    previousSignatures,
  );

  return {
    tab,
    portalCountBefore: portalSnapshot.before,
    portalCountAfter: portalSnapshot.after,
    tabClicked,
    tabSelected,
    candidates,
  };
}

export function buildStatusModelFailureSummary(input: {
  startedAt: string;
  error: unknown;
  portalCounts?: ModelPortalCounts | null;
  inventoryDeviceCount?: number;
}): Record<string, unknown> {
  const message = input.error instanceof Error ? input.error.message : String(input.error);
  return {
    status: "failed",
    startedAt: input.startedAt,
    finishedAt: new Date().toISOString(),
    portalCounts: input.portalCounts ?? null,
    inventoryDeviceCount: input.inventoryDeviceCount ?? 0,
    fieldCandidateCount: 0,
    modelCandidateCount: 0,
    recommendedSource: null,
    recommendedFieldPath: null,
    recommendedMapping: null,
    extractedCounts: null,
    onlineOfflineIntersection: [],
    unionCount: 0,
    inventoryOverlapPercentage: 0,
    validated: false,
    validationReasons: [message],
    failureCategory: "discovery_error",
    generatedAt: new Date().toISOString(),
    errorMessage: message,
  };
}

export function buildStatusModelSummary(input: {
  portalCounts: ModelPortalCounts;
  inventoryDeviceCount: number;
  fieldProfiles: DeviceFieldProfile[];
  fieldCandidates: FieldStatusCandidate[];
  modelCandidates: ModelCandidate[];
  recommendation: ReturnType<typeof recommendModelSource>;
  validation: ReturnType<typeof validateStatusModelDiscovery>;
  failureCategory: string;
  generatedAt: string;
}): Record<string, unknown> {
  return {
    status: "success",
    portalCounts: input.portalCounts,
    inventoryDeviceCount: input.inventoryDeviceCount,
    fieldCandidateCount: input.fieldCandidates.length,
    modelCandidateCount: input.modelCandidates.length,
    recommendedSource: input.recommendation.source,
    recommendedFieldPath: input.recommendation.fieldPath,
    recommendedMapping: input.recommendation.mapping,
    extractedCounts: input.validation.extractedCounts,
    onlineOfflineIntersection: input.validation.onlineOfflineIntersection,
    unionCount: input.validation.unionCount,
    inventoryOverlapPercentage: input.validation.inventoryOverlapPercentage,
    validated: input.validation.validated,
    validationReasons: input.validation.validationReasons,
    failureCategory: input.validation.validated ? null : input.failureCategory,
    generatedAt: input.generatedAt,
  };
}

export async function runStatusModelDiscovery(): Promise<{
  validated: boolean;
  summary: Record<string, unknown>;
}> {
  const config = loadConfig(process.env);
  validateWorkerConfig(config);
  ensureCaptureDir(config);
  const log = createLogger(config);
  const startedAt = new Date().toISOString();
  let cleanup: (() => Promise<void>) | null = null;

  try {
    const session = await ensureAuthenticatedPage(config, log, { forceHeadless: false });
    cleanup = session.cleanup;
    const { page } = session;

    const capture = new NetworkCapture();
    capture.attach(page);
    await waitForDiscoverySignals(page, capture, 10_000, 25_000);

    const portalBefore = await readPortalSnapshot(page);
    await page.waitForTimeout(800);
    const portalAfter = await readPortalSnapshot(page);
    const portalCounts: ModelPortalCounts = {
      all: portalAfter.all ?? portalBefore.all,
      online: portalAfter.online ?? portalBefore.online,
      offline: portalAfter.offline ?? portalBefore.offline,
      allBefore: portalBefore.all,
      allAfter: portalAfter.all,
      onlineBefore: portalBefore.online,
      onlineAfter: portalAfter.online,
      offlineBefore: portalBefore.offline,
      offlineAfter: portalAfter.offline,
    };

    const treePayload = capture.getActionCapture("querydevicestree")?.sanitizedResponse;
    const records = treePayload ? collectBootstrapDeviceRecords(treePayload) : [];
    const inventoryIds = new Set(records.map((record) => record.sourceDeviceId));

    if (inventoryIds.size === 0) {
      const summary = buildStatusModelFailureSummary({
        startedAt,
        error: new Error("Could not load inventory from querydevicestree"),
        portalCounts,
      });
      writeCaptureArtifacts(config.captureDir, summary, [], [], [], [], []);
      return { validated: false, summary };
    }

    const fieldProfiles = profileDeviceFields(records);
    const fieldCandidates = discoverFieldCandidates(records, portalCounts, 2);
    const bestFieldCandidate = pickBestFieldCandidate(fieldCandidates);

    const tabSequence: Array<{ tab: "all" | "online" | "offline"; skipClick?: boolean }> = [
      { tab: "all", skipClick: true },
      { tab: "online" },
      { tab: "offline" },
      { tab: "all" },
    ];

    const tabCaptures: TabModelCapture[] = [];
    const previousSignatures: string[] = [];
    const modelCandidates: ModelCandidate[] = [];

    for (const step of tabSequence) {
      const captureResult = await captureTabModelState(
        page,
        step.tab,
        inventoryIds,
        previousSignatures,
        step.skipClick,
      );
      tabCaptures.push(captureResult);
      for (const candidate of captureResult.candidates) {
        previousSignatures.push(candidate.datasetSignature);
        modelCandidates.push(candidate);
      }
    }

    let allDeviceIds: string[] = [];
    let onlineDeviceIds: string[] = [];
    let offlineDeviceIds: string[] = [];

    if (bestFieldCandidate?.validated) {
      allDeviceIds = [
        ...new Set([
          ...bestFieldCandidate.onlineDeviceIds,
          ...bestFieldCandidate.offlineDeviceIds,
        ]),
      ];
      onlineDeviceIds = bestFieldCandidate.onlineDeviceIds;
      offlineDeviceIds = bestFieldCandidate.offlineDeviceIds;
    } else {
      const onlineCandidate = modelCandidates
        .filter((candidate) => candidate.tab === "online" && !candidate.rejected)
        .sort((a, b) => b.score - a.score)[0];
      const offlineCandidate = modelCandidates
        .filter((candidate) => candidate.tab === "offline" && !candidate.rejected)
        .sort((a, b) => b.score - a.score)[0];
      const allCandidate = modelCandidates
        .filter((candidate) => candidate.tab === "all" && !candidate.rejected)
        .sort((a, b) => b.score - a.score)[0];

      onlineDeviceIds = onlineCandidate?.uniqueMatchedIds ?? [];
      offlineDeviceIds = offlineCandidate?.uniqueMatchedIds ?? [];
      allDeviceIds =
        allCandidate?.uniqueMatchedIds ??
        [...new Set([...onlineDeviceIds, ...offlineDeviceIds])];
    }

    const validation = validateStatusModelDiscovery({
      inventoryIds,
      allDeviceIds,
      onlineDeviceIds,
      offlineDeviceIds,
      portalCounts,
      tolerance: 2,
      minOverlapPercent: 99,
    });

    const recommendation = recommendModelSource({
      fieldCandidates,
      modelCandidates,
    });

    const failureCategory = categorizeModelDiscoveryFailure({
      fieldCandidateCount: fieldCandidates.length,
      validatedFieldCandidate: Boolean(bestFieldCandidate?.validated),
      modelCandidateCount: modelCandidates.length,
      vueCandidates: modelCandidates.filter(
        (candidate) =>
          candidate.source === "vue_state" ||
          candidate.source === "pinia_store" ||
          candidate.source === "vuex_store",
      ).length,
      validation,
    });

    const generatedAt = new Date().toISOString();
    const summary = buildStatusModelSummary({
      portalCounts,
      inventoryDeviceCount: inventoryIds.size,
      fieldProfiles,
      fieldCandidates,
      modelCandidates,
      recommendation,
      validation,
      failureCategory,
      generatedAt,
    });

    const sanitizedCandidates = modelCandidates.map((candidate) => ({
      source: candidate.source,
      dataPath: candidate.dataPath,
      tab: candidate.tab,
      matchedInventoryCount: candidate.matchedInventoryCount,
      collectionLength: candidate.collectionLength,
      statusFields: candidate.statusFields,
      datasetSignature: candidate.datasetSignature,
      hasPerDeviceStatus: candidate.hasPerDeviceStatus,
      rejected: candidate.rejected,
      rejectionReason: candidate.rejectionReason,
      score: candidate.score,
    }));

    const sanitizedFieldCandidates = fieldCandidates.slice(0, 100).map((candidate) => ({
      fieldPath: candidate.fieldPath,
      mapping: candidate.mapping.label,
      onlineCount: candidate.onlineCount,
      offlineCount: candidate.offlineCount,
      unknownCount: candidate.unknownCount,
      onlineDelta: candidate.onlineDelta,
      offlineDelta: candidate.offlineDelta,
      validated: candidate.validated,
      validationReasons: candidate.validationReasons,
    }));

    writeCaptureArtifacts(
      config.captureDir,
      summary,
      fieldProfiles,
      sanitizedFieldCandidates,
      sanitizedCandidates,
      validation.onlineDeviceIds,
      validation.offlineDeviceIds,
    );

    log.info(
      {
        validated: validation.validated,
        recommendedSource: recommendation.source,
        recommendedFieldPath: recommendation.fieldPath,
        failureCategory: validation.validated ? null : failureCategory,
      },
      "Status model discovery complete",
    );

    console.log("\n--- GPS51 Status Model Discovery ---");
    console.log(JSON.stringify(summary, null, 2));
    console.log("Files written to data/captures/");
    console.log("------------------------------------\n");

    return { validated: validation.validated, summary };
  } catch (err) {
    const summary = buildStatusModelFailureSummary({ startedAt, error: err });
    writeCaptureArtifacts(config.captureDir, summary, [], [], [], [], []);
    console.error(err instanceof Error ? err.message : String(err));
    return { validated: false, summary };
  } finally {
    if (cleanup) await cleanup().catch(() => undefined);
  }
}

function writeCaptureArtifacts(
  captureDir: string,
  summary: Record<string, unknown>,
  fieldProfiles: DeviceFieldProfile[],
  fieldCandidates: unknown[],
  modelCandidates: unknown[],
  onlineIds: string[],
  offlineIds: string[],
): void {
  writeFileSync(path.join(captureDir, STATUS_MODEL_SUMMARY_FILE), JSON.stringify(summary, null, 2));
  writeFileSync(path.join(captureDir, STATUS_FIELD_PROFILES_FILE), JSON.stringify(fieldProfiles, null, 2));
  writeFileSync(
    path.join(captureDir, STATUS_MODEL_CANDIDATES_FILE),
    JSON.stringify(modelCandidates, null, 2),
  );
  writeFileSync(
    path.join(captureDir, STATUS_MODEL_ONLINE_IDS_FILE),
    JSON.stringify({ count: onlineIds.length, deviceIds: onlineIds }, null, 2),
  );
  writeFileSync(
    path.join(captureDir, STATUS_MODEL_OFFLINE_IDS_FILE),
    JSON.stringify({ count: offlineIds.length, deviceIds: offlineIds }, null, 2),
  );
}

if (isMain) {
  resetConfigCache();
  runStatusModelDiscovery()
    .then((result) => {
      process.exitCode = result.validated ? 0 : 2;
      process.exit(process.exitCode);
    })
    .catch(() => process.exit(1));
}
