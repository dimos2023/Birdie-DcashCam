import { writeFileSync } from "node:fs";
import path from "node:path";
import { ensureAuthenticatedPage } from "../auth/session.js";
import { applyDomStatusUpdates, buildDomStatusPatches, fetchStatusDeviceRows, } from "../db/status-repository.js";
import { ensureInventoryAccount } from "../db/inventory-repository.js";
import { buildDomStatusSummary, extractDomStatusSets, loadInventoryIdsFromMonitorPage, STATUS_DOM_SUMMARY_FILE, STATUS_UI_DEBUG_FILE, } from "../browser/status-dom-extractor.js";
import { redactSecrets } from "../browser/redaction.js";
import { finishSyncRun, markAccountSynced, startSyncRun, } from "../db/repositories.js";
export class StatusDomSyncError extends Error {
    constructor(message) {
        super(message);
        this.name = "StatusDomSyncError";
    }
}
function writeCaptureFiles(captureDir, extraction) {
    const summary = buildDomStatusSummary(extraction);
    writeFileSync(path.join(captureDir, STATUS_DOM_SUMMARY_FILE), JSON.stringify(summary, null, 2));
    writeFileSync(path.join(captureDir, "status-all-device-ids.json"), JSON.stringify({ count: extraction.reconciliation.allIds.length, deviceIds: extraction.reconciliation.allIds }, null, 2));
    writeFileSync(path.join(captureDir, "status-online-device-ids.json"), JSON.stringify({
        count: extraction.reconciliation.onlineIds.length,
        deviceIds: extraction.reconciliation.onlineIds,
    }, null, 2));
    writeFileSync(path.join(captureDir, "status-offline-device-ids.json"), JSON.stringify({
        count: extraction.reconciliation.offlineIds.length,
        deviceIds: extraction.reconciliation.offlineIds,
    }, null, 2));
    writeFileSync(path.join(captureDir, "status-dom-debug.json"), JSON.stringify(redactSecrets(extraction.debug), null, 2));
    writeFileSync(path.join(captureDir, STATUS_UI_DEBUG_FILE), JSON.stringify(extraction.uiDebug, null, 2));
}
export function printDomSyncReport(extraction, databaseWrites) {
    const { portalCounts, reconciliation } = extraction;
    console.log("\n--- GPS51 DOM Status Sync ---");
    console.log(`Portal All: ${portalCounts.all ?? "—"}`);
    console.log(`Extracted All: ${reconciliation.extractedCounts.all}`);
    console.log(`Portal Online: ${portalCounts.online ?? "—"}`);
    console.log(`Extracted Online: ${reconciliation.extractedCounts.online}`);
    console.log(`Portal Offline: ${portalCounts.offline ?? "—"}`);
    console.log(`Extracted Offline: ${reconciliation.extractedCounts.offline}`);
    console.log(`Intersection: ${reconciliation.onlineOfflineIntersection.length}`);
    console.log(`Inventory overlap: ${reconciliation.inventoryOverlapPercentage}%`);
    console.log(`Validated: ${reconciliation.validated}`);
    console.log(`Database writes: ${databaseWrites}`);
    if (!reconciliation.validated) {
        console.log(`Validation reasons: ${reconciliation.validationReasons.join(", ")}`);
    }
    console.log("-----------------------------\n");
}
export async function runDomStatusExtractionOnPage(page, inventoryIds, config) {
    return extractDomStatusSets(page, inventoryIds, {
        maxTabDelta: config.GPS51_STATUS_DOM_MAX_DELTA,
        minInventoryOverlapPercent: config.GPS51_STATUS_DOM_MIN_OVERLAP_PERCENT,
    });
}
export async function runStatusDomSync(sb, config, log, mode, page, inventoryIds) {
    let ownsSession = false;
    let cleanup = null;
    let activePage = page ?? null;
    let inventory = inventoryIds ?? new Set();
    try {
        if (!activePage) {
            const session = await ensureAuthenticatedPage(config, log, { forceHeadless: mode === "sync" });
            cleanup = session.cleanup;
            activePage = session.page;
            ownsSession = true;
        }
        if (inventory.size === 0) {
            inventory = await loadInventoryIdsFromMonitorPage(activePage);
        }
        if (inventory.size < config.GPS51_STATUS_MIN_DEVICES) {
            throw new StatusDomSyncError(`Inventory device count ${inventory.size} is below minimum ${config.GPS51_STATUS_MIN_DEVICES}`);
        }
        const extraction = await runDomStatusExtractionOnPage(activePage, inventory, config);
        writeCaptureFiles(config.captureDir, extraction);
        if (!extraction.reconciliation.validated) {
            printDomSyncReport(extraction, 0);
            if (mode === "sync") {
                throw new StatusDomSyncError(`DOM status extraction failed validation: ${extraction.reconciliation.validationReasons.join(", ")}`);
            }
            return { validated: false, databaseWrites: 0 };
        }
        if (mode === "dry" || !sb) {
            printDomSyncReport(extraction, 0);
            return { validated: true, databaseWrites: 0 };
        }
        const account = await ensureInventoryAccount(sb, config.ORGANIZATION_ID, config.GPS51_USERNAME, config.GPS51_BASE_URL, config.monitorUrl);
        const syncRunId = await startSyncRun(sb, config.ORGANIZATION_ID, account.id, "live");
        const calculatedAt = new Date().toISOString();
        const existingRows = await fetchStatusDeviceRows(sb, account.id);
        const onlineIds = new Set(extraction.reconciliation.onlineIds);
        const offlineIds = new Set(extraction.reconciliation.offlineIds);
        const patches = buildDomStatusPatches(existingRows, onlineIds, offlineIds, calculatedAt);
        const { updated } = await applyDomStatusUpdates(sb, config.ORGANIZATION_ID, account.id, patches);
        await finishSyncRun(sb, syncRunId, {
            status: "success",
            devices_visible: inventory.size,
            positions_inserted: 0,
            parse_failures: 0,
            summary: {
                validated: true,
                updated,
                online: extraction.reconciliation.extractedCounts.online,
                offline: extraction.reconciliation.extractedCounts.offline,
            },
        });
        await markAccountSynced(sb, account.id, "success");
        printDomSyncReport(extraction, updated);
        log.info({ updated, online: onlineIds.size, offline: offlineIds.size }, "DOM status sync complete");
        return { validated: true, databaseWrites: updated };
    }
    finally {
        if (ownsSession && cleanup) {
            await cleanup().catch(() => undefined);
        }
    }
}
export async function getOrCreateDedicatedStatusPage(context, config) {
    const page = await context.newPage();
    await page.goto(config.monitorUrl, {
        waitUntil: "domcontentloaded",
        timeout: config.SYNC_REQUEST_TIMEOUT_MS,
    });
    return page;
}
