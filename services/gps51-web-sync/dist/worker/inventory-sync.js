import { writeFileSync } from "node:fs";
import path from "node:path";
import { createLogger } from "../logger.js";
import { launchBrowser } from "../browser/create-browser.js";
import { NetworkCapture, waitForDiscoverySignals } from "../browser/network-capture.js";
import { createAuthenticatedContext, isReauthRequired } from "../auth/session.js";
import { safeScrollDeviceTree } from "../browser/dom-fallback.js";
import { parseInventoryDeviceTree } from "../gps51/device-tree-parser.js";
import { countInventoryStats } from "../gps51/inventory-normalizer.js";
import { assertOrganizationId, validateInventoryDevices, InventoryValidationError, } from "../gps51/inventory-validation.js";
import { MIN_INVENTORY_DEVICE_COUNT } from "../gps51/inventory-types.js";
import { getDbClient, pingSupabase } from "../db/client.js";
import { buildInventoryReconciliation, ensureInventoryAccount, fetchAccountInventoryDevices, reconcileWithoutSync, upsertInventoryDevices, } from "../db/inventory-repository.js";
import { finishSyncRun, markAccountSynced, startSyncRun, } from "../db/repositories.js";
const MIN_OBSERVE_MS = 30_000;
const IDLE_WAIT_MS = 30_000;
export class ReauthRequiredError extends Error {
    constructor() {
        super("GPS51 session expired — run npm run auth again");
        this.name = "ReauthRequiredError";
    }
}
async function captureInventoryFromBrowser(config, log) {
    const browser = await launchBrowser(config, { forceHeadless: true });
    const context = await createAuthenticatedContext(config, browser);
    const page = await context.newPage();
    const networkCapture = new NetworkCapture();
    networkCapture.attach(page);
    const cleanup = async () => {
        await context.close();
        await browser.close();
    };
    log.info({ monitor_url: config.monitorUrl }, "Opening GPS51 monitor for inventory sync");
    await page.goto(config.monitorUrl, {
        waitUntil: "domcontentloaded",
        timeout: config.SYNC_REQUEST_TIMEOUT_MS,
    });
    if (await isReauthRequired(page)) {
        await cleanup();
        throw new ReauthRequiredError();
    }
    await waitForDiscoverySignals(page, networkCapture, MIN_OBSERVE_MS, IDLE_WAIT_MS);
    await safeScrollDeviceTree(page);
    await page.waitForTimeout(2000);
    const treeCapture = networkCapture.getActionCapture("querydevicestree");
    if (!treeCapture?.sanitizedResponse) {
        await cleanup();
        throw new InventoryValidationError("querydevicestree response was not captured");
    }
    const parsed = parseInventoryDeviceTree(treeCapture.sanitizedResponse);
    return {
        capture: {
            devices: parsed.devices,
            summary: parsed.summary,
            payload: treeCapture.sanitizedResponse,
        },
        page,
        cleanup,
    };
}
async function verifyGps51Session(page) {
    if (await isReauthRequired(page)) {
        throw new ReauthRequiredError();
    }
}
async function verifySupabase(config) {
    assertOrganizationId(config.ORGANIZATION_ID);
    const ok = await pingSupabase(config);
    if (!ok) {
        throw new InventoryValidationError("Supabase connection verification failed");
    }
}
function writeReconciliation(config, reconciliation) {
    writeFileSync(path.join(config.captureDir, "inventory-reconciliation.json"), JSON.stringify(reconciliation, null, 2));
}
function printDryRunStats(stats) {
    console.log("\n--- GPS51 Inventory Dry Run ---");
    console.log(`Total devices parsed: ${stats.totalDevicesParsed}`);
    console.log(`Unique devices: ${stats.uniqueDevices}`);
    console.log(`Duplicates: ${stats.duplicates}`);
    console.log(`Accounts: ${stats.accounts}`);
    console.log(`Groups: ${stats.groups}`);
    console.log(`Devices with SIM number: ${stats.devicesWithSimNo}`);
    console.log(`Devices with video channels: ${stats.devicesWithVideo}`);
    console.log(`Devices with missing identifier: ${stats.devicesWithMissingIdentifier}`);
    console.log("-------------------------------\n");
}
export async function runInventorySync(mode, config) {
    const log = createLogger(config);
    const startedAt = new Date().toISOString();
    const { capture, page, cleanup } = await captureInventoryFromBrowser(config, log);
    try {
        const { devices, summary } = capture;
        const counts = countInventoryStats(devices);
        if (mode === "dry") {
            printDryRunStats({
                totalDevicesParsed: summary.detectedDeviceCount,
                uniqueDevices: summary.uniqueDeviceCount,
                duplicates: summary.duplicateDeviceCount,
                accounts: summary.accountNodeCount,
                groups: summary.groupNodeCount,
                devicesWithSimNo: counts.devicesWithSimNo,
                devicesWithVideo: counts.devicesWithVideo,
                devicesWithMissingIdentifier: counts.devicesWithMissingIdentifier,
            });
            validateInventoryDevices(devices, MIN_INVENTORY_DEVICE_COUNT);
            return;
        }
        await verifyGps51Session(page);
        await verifySupabase(config);
        validateInventoryDevices(devices, MIN_INVENTORY_DEVICE_COUNT);
        const sb = getDbClient(config);
        const account = await ensureInventoryAccount(sb, config.ORGANIZATION_ID, config.GPS51_USERNAME, config.GPS51_BASE_URL, config.monitorUrl);
        const runId = await startSyncRun(sb, config.ORGANIZATION_ID, account.id, "one_shot");
        const existingRows = await fetchAccountInventoryDevices(sb, account.id);
        const finishedCaptureAt = new Date().toISOString();
        if (mode === "reconcile") {
            const reconciliation = reconcileWithoutSync(summary, devices, existingRows, startedAt, finishedCaptureAt);
            writeReconciliation(config, reconciliation);
            await finishSyncRun(sb, runId, {
                status: "success",
                devices_visible: summary.uniqueDeviceCount,
                devices_upserted: 0,
                duration_ms: Date.parse(finishedCaptureAt) - Date.parse(startedAt),
                summary: reconciliation,
            });
            await markAccountSynced(sb, account.id, "success");
            log.info(reconciliation, "Inventory reconciliation complete");
            return;
        }
        const upsertResult = await upsertInventoryDevices(sb, config.ORGANIZATION_ID, account.id, devices, existingRows);
        const afterRows = await fetchAccountInventoryDevices(sb, account.id);
        const finishedAt = new Date().toISOString();
        const reconciliation = buildInventoryReconciliation(summary, devices, upsertResult, afterRows.length, startedAt, finishedAt);
        writeReconciliation(config, reconciliation);
        const status = upsertResult.errors.length > 0
            ? upsertResult.inserted + upsertResult.updated > 0
                ? "partial"
                : "failed"
            : "success";
        await finishSyncRun(sb, runId, {
            status,
            devices_visible: summary.uniqueDeviceCount,
            devices_upserted: upsertResult.inserted + upsertResult.updated,
            parse_failures: upsertResult.errors.length,
            duration_ms: Date.parse(finishedAt) - Date.parse(startedAt),
            error_message: upsertResult.errors.length ? upsertResult.errors.slice(0, 5).join("; ") : null,
            summary: reconciliation,
        });
        await markAccountSynced(sb, account.id, status, upsertResult.errors[0] ?? null);
        log.info({
            inserted: upsertResult.inserted,
            updated: upsertResult.updated,
            unchanged: upsertResult.unchanged,
            database_total: afterRows.length,
        }, "Inventory sync complete");
    }
    finally {
        await cleanup();
    }
}
