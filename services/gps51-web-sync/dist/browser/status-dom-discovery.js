import { loadConfig, validateWorkerConfig, ensureCaptureDir, resetConfigCache } from "../config.js";
import { createLogger } from "../logger.js";
import { ensureAuthenticatedPage } from "../auth/session.js";
import { buildDomStatusSummary, extractDomStatusSets, loadInventoryFromMonitorPage, STATUS_DOM_SUMMARY_FILE, STATUS_UI_DEBUG_FILE, } from "./status-dom-extractor.js";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { buildDomFailureSummary } from "./status-dom-extractor.js";
const isMain = process.argv[1]?.includes("status-dom-discovery");
function logDiscoveryError(err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error(message);
    if (stack)
        console.error(stack);
}
export async function runStatusDomDiscovery() {
    const config = loadConfig(process.env);
    validateWorkerConfig(config);
    ensureCaptureDir(config);
    const log = createLogger(config);
    const startedAt = new Date().toISOString();
    let cleanup = null;
    try {
        const session = await ensureAuthenticatedPage(config, log, { forceHeadless: false });
        cleanup = session.cleanup;
        const { page } = session;
        const { inventoryIds, identityIndex } = await loadInventoryFromMonitorPage(page);
        if (inventoryIds.size === 0) {
            throw new Error("Could not load inventory IDs from querydevicestree");
        }
        const extraction = await extractDomStatusSets(page, inventoryIds, {
            maxTabDelta: config.GPS51_STATUS_DOM_MAX_DELTA,
            minInventoryOverlapPercent: config.GPS51_STATUS_DOM_MIN_OVERLAP_PERCENT,
        }, identityIndex);
        const summary = buildDomStatusSummary(extraction);
        writeFileSync(path.join(config.captureDir, STATUS_DOM_SUMMARY_FILE), JSON.stringify(summary, null, 2));
        writeFileSync(path.join(config.captureDir, "status-all-device-ids.json"), JSON.stringify({ count: extraction.reconciliation.allIds.length, deviceIds: extraction.reconciliation.allIds }, null, 2));
        writeFileSync(path.join(config.captureDir, "status-online-device-ids.json"), JSON.stringify({ count: extraction.reconciliation.onlineIds.length, deviceIds: extraction.reconciliation.onlineIds }, null, 2));
        writeFileSync(path.join(config.captureDir, "status-offline-device-ids.json"), JSON.stringify({
            count: extraction.reconciliation.offlineIds.length,
            deviceIds: extraction.reconciliation.offlineIds,
        }, null, 2));
        writeFileSync(path.join(config.captureDir, "status-dom-debug.json"), JSON.stringify(extraction.debug, null, 2));
        writeFileSync(path.join(config.captureDir, STATUS_UI_DEBUG_FILE), JSON.stringify(extraction.uiDebug, null, 2));
        log.info({
            validated: extraction.reconciliation.validated,
            online: extraction.reconciliation.extractedCounts.online,
            offline: extraction.reconciliation.extractedCounts.offline,
            validationReasons: extraction.validationReasons,
            failureCategory: extraction.failureCategory,
        }, "Status DOM discovery complete");
        console.log("\n--- GPS51 Status DOM Discovery ---");
        console.log(JSON.stringify(summary, null, 2));
        console.log("Files written to data/captures/");
        console.log("----------------------------------\n");
        if (!extraction.reconciliation.validated) {
            process.exitCode = 2;
        }
    }
    catch (err) {
        logDiscoveryError(err);
        writeFileSync(path.join(config.captureDir, STATUS_DOM_SUMMARY_FILE), JSON.stringify(buildDomFailureSummary({ startedAt, error: err }), null, 2));
        throw err;
    }
    finally {
        if (cleanup)
            await cleanup().catch(() => undefined);
    }
}
if (isMain) {
    resetConfigCache();
    runStatusDomDiscovery()
        .then(() => {
        if (process.exitCode == null)
            process.exit(0);
        process.exit(process.exitCode);
    })
        .catch(() => process.exit(1));
}
