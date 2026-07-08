import { writeFileSync } from "node:fs";
import path from "node:path";
import {
  ensureCaptureDir,
  loadConfig,
  resetConfigCache,
  validateBrowserWorkerConfig,
} from "../config.js";
import { createLogger } from "../logger.js";
import { ensureAuthenticatedPage } from "../auth/session.js";
import { loadInventorySourceFromQueryDeviceTree } from "../worker/status-tree-sync.js";
import { attachLiveWebSocketListeners } from "./live-websocket-listener.js";
import { inspectDeviceTelemetryOnPage, TELEMETRY_FIELDS_FILE, TELEMETRY_SAMPLE_FILE, TELEMETRY_SUMMARY_FILE } from "./device-list-discovery.js";
import { redactSecrets } from "./redaction.js";

const isMain = process.argv[1]?.includes("device-telemetry-discovery");

function writeJson(captureDir: string, file: string, value: unknown): void {
  writeFileSync(path.join(captureDir, file), JSON.stringify(value, null, 2));
}

export async function runDeviceTelemetryDiscovery(): Promise<void> {
  resetConfigCache();
  const config = loadConfig(process.env);
  validateBrowserWorkerConfig(config);
  ensureCaptureDir(config);
  const log = createLogger(config);

  const failureSummary = {
    status: "failed",
    portalCounts: null,
    inventoryCount: 0,
    inventorySource: null,
    componentPath: null,
    telemetryNodeCount: 0,
    positionLastObserved: false,
    errorMessage: null as string | null,
    generatedAt: new Date().toISOString(),
  };

  let cleanup: (() => Promise<void>) | null = null;
  try {
    const session = await ensureAuthenticatedPage(config, log, { forceHeadless: true });
    cleanup = session.cleanup;
    const { page } = session;

    let latestPosition: Record<string, unknown> | null = null;
    const detachWs = attachLiveWebSocketListeners(page, log, {
      onPositionLast: async (position) => {
        latestPosition = redactSecrets(position) as Record<string, unknown>;
      },
      onRemindMsg: () => undefined,
      onParseError: () => undefined,
    });

    const inventory = await loadInventorySourceFromQueryDeviceTree(page, config);
    const telemetry = await inspectDeviceTelemetryOnPage(page, new Set(inventory.deviceIds));
    await page.waitForTimeout(4000);
    detachWs();

    const summary = {
      status: "success",
      portalCounts: null,
      inventoryCount: inventory.deviceIds.length,
      inventorySource: inventory.source,
      componentPath: typeof telemetry.componentPath === "string" ? telemetry.componentPath : null,
      telemetryNodeCount: typeof telemetry.nodeCount === "number" ? telemetry.nodeCount : 0,
      positionLastObserved: latestPosition != null,
      generatedAt: new Date().toISOString(),
    };

    writeJson(config.captureDir, TELEMETRY_FIELDS_FILE, {
      componentPath: telemetry.componentPath ?? null,
      componentName: telemetry.componentName ?? null,
      semanticFields: telemetry.semanticFields ?? {},
      fieldCounts: telemetry.fieldCounts ?? {},
      inventoryCount: inventory.deviceIds.length,
    });
    writeJson(config.captureDir, TELEMETRY_SAMPLE_FILE, {
      treeNodeSamples: telemetry.samples ?? [],
      positionLastSample: latestPosition,
    });
    writeJson(config.captureDir, TELEMETRY_SUMMARY_FILE, summary);

    console.log("\n--- GPS51 Device Telemetry Discovery ---");
    console.log(JSON.stringify(summary, null, 2));
    console.log("Files written to data/captures/");
    console.log("----------------------------------------\n");
  } catch (error) {
    const summary = {
      ...failureSummary,
      errorMessage: error instanceof Error ? error.message : String(error),
      generatedAt: new Date().toISOString(),
    };
    writeJson(config.captureDir, TELEMETRY_FIELDS_FILE, {});
    writeJson(config.captureDir, TELEMETRY_SAMPLE_FILE, {});
    writeJson(config.captureDir, TELEMETRY_SUMMARY_FILE, summary);
    throw error;
  } finally {
    if (cleanup) await cleanup().catch(() => undefined);
  }
}

if (isMain) {
  runDeviceTelemetryDiscovery()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    });
}
