import { readFileSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ensureAuthenticatedPage } from "../auth/session.js";
import { NetworkCapture, waitForDiscoverySignals } from "../browser/network-capture.js";
import { safeScrollDeviceTree } from "../browser/dom-fallback.js";
import { readPortalStatusCounts } from "../browser/monitor-subscription.js";
import { applyTreeStatusUpdates, buildTreeStatusUpdates, compareBootstrapToPortal, fetchStatusDeviceRows, } from "../db/status-repository.js";
import { STATUS_BOOTSTRAP_SUMMARY_FILE, calibrateStatusRule, collectBootstrapDeviceRecords, countInvalidLastActiveTime, countInvalidOfflineDelay, evaluateAllDeviceStatuses, findDuplicateDeviceIds, formatSelectedRule, } from "../gps51/status-bootstrap-parser.js";
import { ensureInventoryAccount } from "../db/inventory-repository.js";
import { finishSyncRun, markAccountSynced, startSyncRun, } from "../db/repositories.js";
const MIN_OBSERVE_MS = 30_000;
const IDLE_WAIT_MS = 30_000;
const STATUS_SOURCE_SUMMARY_FILE = "status-source-summary.json";
export class StatusBootstrapError extends Error {
    constructor(message) {
        super(message);
        this.name = "StatusBootstrapError";
    }
}
export function loadStatusSourceValidation(captureDir) {
    const filePath = path.join(captureDir, STATUS_SOURCE_SUMMARY_FILE);
    if (!existsSync(filePath)) {
        return { validated: false, recommendedSource: null, recommendedRule: null };
    }
    try {
        const summary = JSON.parse(readFileSync(filePath, "utf8"));
        return {
            validated: summary.validated === true,
            recommendedSource: typeof summary.recommendedSource === "string" ? summary.recommendedSource : null,
            recommendedRule: typeof summary.recommendedRule === "string" ? summary.recommendedRule : null,
        };
    }
    catch {
        return { validated: false, recommendedSource: null, recommendedRule: null };
    }
}
async function captureDeviceTreePayload(config, log, mode) {
    const session = await ensureAuthenticatedPage(config, log, {
        forceHeadless: mode !== "dry",
    });
    const { page, cleanup } = session;
    const networkCapture = new NetworkCapture();
    networkCapture.attach(page);
    log.info("Capturing querydevicestree from authenticated GPS51 monitor");
    await waitForDiscoverySignals(page, networkCapture, MIN_OBSERVE_MS, IDLE_WAIT_MS);
    await safeScrollDeviceTree(page);
    await page.waitForTimeout(2000);
    const treeCapture = networkCapture.getActionCapture("querydevicestree");
    if (!treeCapture?.sanitizedResponse) {
        await cleanup();
        throw new StatusBootstrapError("querydevicestree response was not captured");
    }
    return { payload: treeCapture.sanitizedResponse, page, cleanup };
}
function buildSummaryFile(records, portalCounts, calibration, duplicateDeviceIds, sourceValidation) {
    const rule = calibration.selectedRule;
    const timestampRuleRejected = !rule;
    return {
        portalCounts,
        calculatedCounts: calibration.calculatedCounts,
        selectedRule: rule ? formatSelectedRule(rule) : null,
        rule,
        lastActiveTimeUnit: rule?.ruleType === "lastactivetime_threshold"
            ? (rule.lastActiveTimeUnit ?? "milliseconds")
            : null,
        offlineDelayUnit: rule?.ruleType === "lastactivetime_threshold"
            ? (rule.offlineDelayUnit ?? "seconds")
            : null,
        mismatchCount: calibration.mismatchCount,
        onlineDelta: calibration.onlineDelta,
        offlineDelta: calibration.offlineDelta,
        devicesWithInvalidLastActiveTime: rule
            ? countInvalidLastActiveTime(records, rule)
            : records.length,
        devicesWithInvalidOfflineDelay: rule ? countInvalidOfflineDelay(records, rule) : 0,
        duplicateDeviceIds,
        generatedAt: new Date().toISOString(),
        deviceCount: records.length,
        validated: sourceValidation.validated,
        recommendedSource: sourceValidation.recommendedSource,
        timestampRuleRejected,
        note: timestampRuleRejected
            ? "lastactivetime/offlinedelay calibration failed — run npm run discover:status-source before production writes."
            : "Timestamp rule matched portal counts but still requires discover:status-source validation.",
    };
}
function writeBootstrapArtifacts(config, summary, records, evaluations) {
    writeFileSync(path.join(config.captureDir, STATUS_BOOTSTRAP_SUMMARY_FILE), JSON.stringify(summary, null, 2));
    writeFileSync(path.join(config.captureDir, "status-bootstrap-devices-sample.json"), JSON.stringify(records.slice(0, 20).map((record) => ({
        sourceDeviceId: record.sourceDeviceId,
        deviceName: record.deviceName,
        lastActiveTimeRaw: record.lastActiveTimeRaw,
        offlineDelayRaw: record.offlineDelayRaw,
        status: evaluations.get(record.sourceDeviceId)?.status ?? "unknown",
    })), null, 2));
}
function assertProductionGuards(records, duplicateDeviceIds, calibration, sourceValidation, config) {
    if (records.length < config.GPS51_STATUS_MIN_DEVICES) {
        throw new StatusBootstrapError(`Refusing production write: only ${records.length} devices parsed (minimum ${config.GPS51_STATUS_MIN_DEVICES})`);
    }
    if (duplicateDeviceIds.length > 0) {
        throw new StatusBootstrapError(`Refusing production write: duplicate device IDs found (${duplicateDeviceIds.length})`);
    }
    if (!calibration.selectedRule) {
        throw new StatusBootstrapError("Refusing production write: timestamp calibration selectedRule is null — run npm run discover:status-source");
    }
    if (!sourceValidation.validated) {
        throw new StatusBootstrapError("Refusing production write: status source discovery is not validated — run npm run discover:status-source");
    }
    if (calibration.mismatchCount > config.GPS51_STATUS_BOOTSTRAP_MAX_PORTAL_DELTA) {
        throw new StatusBootstrapError(`Refusing production write: portal mismatch ${calibration.mismatchCount} exceeds max ${config.GPS51_STATUS_BOOTSTRAP_MAX_PORTAL_DELTA}`);
    }
}
export async function runStatusBootstrap(sb, config, log, mode) {
    const sourceValidation = loadStatusSourceValidation(config.captureDir);
    const { payload, page, cleanup } = await captureDeviceTreePayload(config, log, mode);
    try {
        const records = collectBootstrapDeviceRecords(payload);
        const duplicateDeviceIds = findDuplicateDeviceIds(payload);
        const portalCounts = await readPortalStatusCounts(page);
        const calibration = calibrateStatusRule(records, { online: portalCounts.online, offline: portalCounts.offline }, config.GPS51_OFFLINE_AFTER_SECONDS, config.GPS51_STATUS_BOOTSTRAP_MAX_PORTAL_DELTA);
        const rule = calibration.selectedRule;
        const evaluations = rule ? evaluateAllDeviceStatuses(records, rule) : new Map();
        const summary = buildSummaryFile(records, portalCounts, calibration, duplicateDeviceIds, sourceValidation);
        writeBootstrapArtifacts(config, summary, records, evaluations);
        printBootstrapComparison(summary);
        if (mode === "dry") {
            if (!rule || !sourceValidation.validated) {
                log.warn({
                    mismatchCount: calibration.mismatchCount,
                    validated: sourceValidation.validated,
                }, "Status bootstrap incomplete — timestamp rule and/or status-source discovery validation missing");
            }
            log.info("Dry run complete — zero database writes");
            return summary;
        }
        assertProductionGuards(records, duplicateDeviceIds, calibration, sourceValidation, config);
        if (!sb)
            throw new StatusBootstrapError("Supabase client required for production bootstrap");
        const account = await ensureInventoryAccount(sb, config.ORGANIZATION_ID, config.GPS51_USERNAME, config.GPS51_BASE_URL, config.monitorUrl);
        const syncRunId = await startSyncRun(sb, config.ORGANIZATION_ID, account.id, "status_bootstrap");
        const calculatedAt = new Date().toISOString();
        const existingRows = await fetchStatusDeviceRows(sb, account.id);
        const updates = buildTreeStatusUpdates(evaluations, calculatedAt);
        try {
            const { updated, counts } = await applyTreeStatusUpdates(sb, account.id, updates, existingRows, calculatedAt);
            await finishSyncRun(sb, syncRunId, {
                status: "success",
                devices_visible: records.length,
                positions_inserted: 0,
                parse_failures: 0,
                summary: { updated, counts, mismatchCount: summary.mismatchCount },
            });
            await markAccountSynced(sb, account.id, "success");
            log.info({ updated, counts, mismatchCount: summary.mismatchCount }, "Status bootstrap applied");
        }
        catch (err) {
            await finishSyncRun(sb, syncRunId, {
                status: "error",
                devices_visible: records.length,
                positions_inserted: 0,
                parse_failures: 1,
                summary: { error: err instanceof Error ? err.message : String(err) },
            });
            throw err;
        }
        return summary;
    }
    finally {
        await cleanup();
    }
}
function printBootstrapComparison(summary) {
    console.log("\n--- GPS51 Status Bootstrap ---");
    console.log(`Devices parsed: ${summary.deviceCount}`);
    console.log(`Selected rule: ${summary.selectedRule ?? "none"}`);
    console.log(`Status source validated: ${summary.validated ? "yes" : "no"}`);
    console.log(`Calculated: total=${summary.calculatedCounts.total}, online=${summary.calculatedCounts.online}, offline=${summary.calculatedCounts.offline}, unknown=${summary.calculatedCounts.unknown}`);
    console.log(`Portal:     online=${summary.portalCounts.online ?? "?"}, offline=${summary.portalCounts.offline ?? "?"}, all=${summary.portalCounts.all ?? "?"}`);
    console.log(`Mismatch: ${summary.mismatchCount} (online Δ${summary.onlineDelta}, offline Δ${summary.offlineDelta})`);
    console.log(`Invalid lastactivetime: ${summary.devicesWithInvalidLastActiveTime}`);
    console.log(`Invalid offlinedelay: ${summary.devicesWithInvalidOfflineDelay}`);
    console.log(`Duplicate IDs: ${summary.duplicateDeviceIds.length}`);
    console.log(`Note: ${summary.note}`);
    console.log("------------------------------\n");
}
export { compareBootstrapToPortal };
