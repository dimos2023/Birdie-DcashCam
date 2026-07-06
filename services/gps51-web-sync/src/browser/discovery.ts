import { writeFileSync } from "node:fs";
import path from "node:path";
import { loadConfig, validateWorkerConfig, ensureCaptureDir } from "../config.js";
import { createLogger } from "../logger.js";
import { launchBrowser } from "./create-browser.js";
import { NetworkCapture, waitForDiscoverySignals } from "./network-capture.js";
import { createAuthenticatedContext, isReauthRequired } from "../auth/session.js";
import { safeScrollDeviceTree, scrapeDevicesFromDom } from "./dom-fallback.js";
import { trackedActions } from "./action-url.js";
import { parseDeviceTree } from "../gps51/device-tree-parser.js";
import { summarizeAlarmPayload } from "../gps51/alarm-response-parser.js";

const MIN_OBSERVE_MS = 30_000;
const IDLE_WAIT_MS = 30_000;

const isMain = process.argv[1]?.includes("discovery");

function writeJson(outDir: string, filename: string, data: unknown): void {
  writeFileSync(path.join(outDir, filename), JSON.stringify(data, null, 2));
}

function saveActionCaptures(outDir: string, capture: NetworkCapture): void {
  for (const action of trackedActions()) {
    const entry = capture.getActionCapture(action);
    if (!entry) continue;

    if (entry.sanitizedResponse != null) {
      writeJson(outDir, `${action}-response.json`, entry.sanitizedResponse);
    }
    if (entry.sanitizedRequest != null) {
      writeJson(outDir, `${action}-request.json`, entry.sanitizedRequest);
    }
  }
}

export async function runDiscovery(): Promise<void> {
  const config = loadConfig(process.env);
  validateWorkerConfig(config);
  ensureCaptureDir(config);
  const log = createLogger(config);

  const browser = await launchBrowser(config, { forceHeadless: true });
  const context = await createAuthenticatedContext(config, browser);
  const page = await context.newPage();
  const capture = new NetworkCapture();
  capture.attach(page);

  try {
    log.info({ monitor_url: config.monitorUrl }, "Opening GPS51 monitor for discovery");
    await page.goto(config.monitorUrl, {
      waitUntil: "domcontentloaded",
      timeout: config.SYNC_REQUEST_TIMEOUT_MS,
    });

    if (await isReauthRequired(page)) {
      throw new Error("Session expired — run npm run auth again");
    }

    await waitForDiscoverySignals(page, capture, MIN_OBSERVE_MS, IDLE_WAIT_MS);
    await safeScrollDeviceTree(page);
    await page.waitForTimeout(2000);

    const outDir = config.captureDir;
    saveActionCaptures(outDir, capture);

    const treeCapture = capture.getActionCapture("querydevicestree");
    const treeResult = treeCapture?.sanitizedResponse
      ? parseDeviceTree(treeCapture.sanitizedResponse)
      : null;

    const alarmCapture = capture.getActionCapture("queryalarm");
    const alarmSummary = alarmCapture?.sanitizedResponse
      ? { kind: "alarm/location" as const, ...summarizeAlarmPayload(alarmCapture.sanitizedResponse) }
      : null;

    const treeDevices = treeResult?.devices ?? [];
    const domDevices = await scrapeDevicesFromDom(page, config.SYNC_MAX_DEVICES);

    if (treeResult) {
      writeJson(outDir, "device-tree-parsed.json", {
        root: treeResult.root,
        devices: treeDevices,
      });
      writeJson(outDir, "device-tree-summary.json", treeResult.summary);
    }

    if (alarmSummary) {
      writeJson(outDir, "queryalarm-summary.json", alarmSummary);
    }

    const candidates = capture.getCandidates(3);
    writeJson(
      outDir,
      "network-candidates.json",
      candidates.map((c) => ({
        url: c.url,
        action: c.action,
        method: c.method,
        score: c.score,
        contentType: c.contentType,
        capturedAt: c.capturedAt,
        sampleKeys:
          c.sanitizedBody && typeof c.sanitizedBody === "object"
            ? Object.keys(c.sanitizedBody as object).slice(0, 20)
            : [],
      })),
    );

    writeJson(outDir, "device-list-sample.json", {
      source: treeDevices.length ? "querydevicestree" : domDevices.length ? "dom" : "none",
      treeDeviceCount: treeDevices.length,
      domDeviceCount: domDevices.length,
      alarmRecordCount: alarmSummary?.recordCount ?? 0,
      querydevicestreeCaptured: Boolean(treeCapture?.sanitizedResponse),
      sampleDevices: (treeDevices.length ? treeDevices : domDevices).slice(0, 5).map((d) => ({
        sourceDeviceId: d.sourceDeviceId,
        deviceName: d.deviceName,
        groupPath: d.groupPath,
        latitude: d.latitude,
        longitude: d.longitude,
        onlineStatus: d.onlineStatus,
      })),
    });

    writeFileSync(path.join(outDir, "dom-snapshot.html"), await page.content());
    await page.screenshot({ path: path.join(outDir, "monitor.png"), fullPage: false });

    log.info(
      {
        candidates: candidates.length,
        tree_devices: treeDevices.length,
        dom_devices: domDevices.length,
        alarm_records: alarmSummary?.recordCount ?? 0,
        querydevicestree: Boolean(treeCapture?.sanitizedResponse),
      },
      "Discovery capture complete",
    );

    printSchemaSummary(treeResult, domDevices, alarmSummary, capture);
  } finally {
    await context.close();
    await browser.close();
  }
}

function printSchemaSummary(
  treeResult: ReturnType<typeof parseDeviceTree> | null,
  domDevices: Awaited<ReturnType<typeof scrapeDevicesFromDom>>,
  alarmSummary: { kind: "alarm/location"; recordCount: number } | null,
  capture: NetworkCapture,
): void {
  console.log("\n--- GPS51 Discovery Summary ---");
  console.log(`querydevicestree captured: ${capture.hasAction("querydevicestree")}`);
  if (treeResult) {
    console.log(`Device tree nodes visited: ${treeResult.summary.totalObjectsVisited}`);
    console.log(`Parsed tree devices: ${treeResult.summary.detectedDeviceCount}`);
    console.log(`Unique tree devices: ${treeResult.summary.uniqueDeviceCount}`);
    console.log(`Duplicate tree devices: ${treeResult.summary.duplicateDeviceCount}`);
  } else {
    console.log("Device tree: not captured — check session or wait time");
  }
  if (alarmSummary) {
    console.log(`Alarm/location records (queryalarm): ${alarmSummary.recordCount} (not device inventory)`);
  }
  console.log(`Parsed DOM devices: ${domDevices.length}`);
  console.log("Sanitized files written to data/captures/");
  console.log("-------------------------------\n");
}

if (isMain) {
  runDiscovery()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
