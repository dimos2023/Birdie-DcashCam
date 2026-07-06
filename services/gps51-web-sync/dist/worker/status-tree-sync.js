import { writeFileSync } from "node:fs";
import path from "node:path";
import { ensureAuthenticatedPage } from "../auth/session.js";
import { readPortalStatusCounts } from "../browser/monitor-subscription.js";
import { assertBrowserScriptSafe } from "../browser/browser-page-scripts.js";
import { NetworkCapture, waitForDiscoverySignals } from "../browser/network-capture.js";
import { applyTreeStatusBulkUpdates, buildTreeStatusPatches, fetchStatusDeviceRows, } from "../db/status-repository.js";
import { ensureInventoryAccount } from "../db/inventory-repository.js";
import { fetchKnownDevices } from "../db/live-position-repository.js";
import { buildStatusTreeExtractScript, normalizeTreeStatusExtraction, reconcileTreeStatusExtraction, } from "../gps51/status-tree-extract.js";
import { buildStatusFilterExtractScript, normalizeStatusFilterExtraction, } from "../gps51/status-filter-extract.js";
import { collectBootstrapDeviceRecords, findDuplicateDeviceIds, } from "../gps51/status-bootstrap-parser.js";
import { finishSyncRun, markAccountSynced, startSyncRun, } from "../db/repositories.js";
export const STATUS_TREE_SYNC_SUMMARY_FILE = "status-tree-sync-summary.json";
export class StatusTreeSyncError extends Error {
    constructor(message) {
        super(message);
        this.name = "StatusTreeSyncError";
    }
}
async function readPortalSnapshot(page) {
    const before = await readPortalStatusCounts(page).catch(() => ({
        all: null,
        online: null,
        offline: null,
    }));
    await page.waitForTimeout(600);
    const after = await readPortalStatusCounts(page).catch(() => before);
    return {
        all: after.all ?? before.all,
        online: after.online ?? before.online,
        offline: after.offline ?? before.offline,
        allBefore: before.all,
        allAfter: after.all,
        onlineBefore: before.online,
        onlineAfter: after.online,
        offlineBefore: before.offline,
        offlineAfter: after.offline,
    };
}
export async function extractTreeStatusOnPage(page, inventoryIds, config) {
    const primaryScript = buildStatusTreeExtractScript([...inventoryIds]);
    assertBrowserScriptSafe(primaryScript);
    const primaryRaw = await page.evaluate(primaryScript).catch(() => null);
    const primaryExtraction = normalizeTreeStatusExtraction(primaryRaw);
    const fallbackScript = buildStatusFilterExtractScript();
    assertBrowserScriptSafe(fallbackScript);
    const fallbackRaw = await page.evaluate(fallbackScript).catch(() => null);
    const fallbackNormalized = normalizeStatusFilterExtraction(fallbackRaw);
    const portalCounts = await readPortalSnapshot(page);
    const primaryReconciliation = reconcileTreeStatusExtraction({
        extraction: primaryExtraction,
        inventoryIds,
        portalCounts,
        tolerance: config.GPS51_STATUS_DOM_MAX_DELTA,
        minOverlapPercent: config.GPS51_STATUS_DOM_MIN_OVERLAP_PERCENT,
    });
    let extraction = primaryExtraction;
    let reconciliation = primaryReconciliation;
    if (fallbackNormalized.source === "device_list_tree_nodes") {
        const fallbackExtraction = normalizeTreeStatusExtraction({
            source: "device_list_tree_nodes",
            componentPath: fallbackNormalized.componentPath,
            mapping: fallbackNormalized.mapping,
            predicateFunction: fallbackNormalized.predicateFunction,
            allDeviceIds: fallbackNormalized.allDeviceIds,
            onlineDeviceIds: fallbackNormalized.onlineDeviceIds,
            offlineDeviceIds: fallbackNormalized.offlineDeviceIds,
            malformedNodeCount: 0,
            skippedNodeCount: 0,
            error: fallbackNormalized.error,
        });
        const fallbackReconciliation = reconcileTreeStatusExtraction({
            extraction: fallbackExtraction,
            inventoryIds,
            portalCounts,
            tolerance: config.GPS51_STATUS_DOM_MAX_DELTA,
            minOverlapPercent: config.GPS51_STATUS_DOM_MIN_OVERLAP_PERCENT,
        });
        const primaryDelta = primaryReconciliation.validationReasons.filter((reason) => reason.includes("count_delta")).length;
        const fallbackDelta = fallbackReconciliation.validationReasons.filter((reason) => reason.includes("count_delta")).length;
        if (fallbackReconciliation.validated ||
            (!primaryReconciliation.validated && fallbackDelta < primaryDelta)) {
            extraction = fallbackExtraction;
            reconciliation = fallbackReconciliation;
        }
    }
    return {
        extraction,
        reconciliation,
        portalCounts,
        inventoryCount: inventoryIds.size,
    };
}
export function buildTreeSyncSummary(input) {
    const reconciliation = input.reconciliation;
    return {
        status: input.status,
        mode: input.mode,
        portalCounts: input.portalCounts,
        extractedCounts: reconciliation?.extractedCounts ?? null,
        inventoryCount: input.inventoryCount,
        inventorySource: input.inventorySource,
        intersectionCount: reconciliation?.onlineOfflineIntersection.length ?? 0,
        unionCount: reconciliation?.unionCount ?? 0,
        inventoryOverlapPercentage: reconciliation?.inventoryOverlapPercentage ?? 0,
        validated: reconciliation?.validated ?? false,
        validationReasons: reconciliation?.validationReasons ?? [],
        databaseWrites: input.databaseWrites,
        componentPath: input.componentPath,
        extractionError: input.extractionError,
        malformedNodeCount: input.malformedNodeCount,
        errorMessage: input.errorMessage ?? null,
        generatedAt: new Date().toISOString(),
    };
}
export function collectInventorySourceFromPayload(payload) {
    return {
        deviceIds: collectBootstrapDeviceRecords(payload).map((record) => record.sourceDeviceId),
        source: "querydevicestree",
        duplicateIds: findDuplicateDeviceIds(payload),
    };
}
function writeTreeSyncArtifacts(captureDir, summary) {
    writeFileSync(path.join(captureDir, STATUS_TREE_SYNC_SUMMARY_FILE), JSON.stringify(summary, null, 2));
}
export function printTreeSyncReport(summary) {
    const portalCounts = summary.portalCounts ?? {
        all: null,
        online: null,
        offline: null,
    };
    const extractedCounts = summary.extractedCounts ?? {
        all: 0,
        online: 0,
        offline: 0,
    };
    console.log("\n--- GPS51 Tree Status Sync ---");
    console.log(`Portal All: ${portalCounts.all ?? "—"}`);
    console.log(`Extracted All: ${extractedCounts.all}`);
    console.log(`Portal Online: ${portalCounts.online ?? "—"}`);
    console.log(`Extracted Online: ${extractedCounts.online}`);
    console.log(`Portal Offline: ${portalCounts.offline ?? "—"}`);
    console.log(`Extracted Offline: ${extractedCounts.offline}`);
    console.log(`Intersection: ${summary.intersectionCount}`);
    console.log(`Inventory overlap: ${summary.inventoryOverlapPercentage}%`);
    console.log(`Validated: ${summary.validated}`);
    console.log(`Database writes: ${summary.databaseWrites}`);
    if (!summary.validated) {
        console.log(`Validation reasons: ${summary.validationReasons.join(", ")}`);
    }
    console.log("------------------------------\n");
}
export async function loadInventoryIdsFromDatabase(sb, accountId) {
    const devices = await fetchKnownDevices(sb, accountId);
    return new Set(devices.map((device) => device.source_device_id));
}
export async function loadInventorySourceFromQueryDeviceTree(page, config) {
    const capture = new NetworkCapture();
    capture.attach(page);
    await page.goto(config.monitorUrl, {
        waitUntil: "domcontentloaded",
        timeout: config.SYNC_REQUEST_TIMEOUT_MS,
    });
    await waitForDiscoverySignals(page, capture, 10_000, 25_000);
    const treePayload = capture.getActionCapture("querydevicestree")?.sanitizedResponse;
    if (!treePayload) {
        throw new StatusTreeSyncError("Could not capture querydevicestree inventory");
    }
    return collectInventorySourceFromPayload(treePayload);
}
export async function writeValidatedTreeStatus(sb, config, log, inventory, result) {
    const account = await ensureInventoryAccount(sb, config.ORGANIZATION_ID, config.GPS51_USERNAME, config.GPS51_BASE_URL, config.monitorUrl);
    const syncRunId = await startSyncRun(sb, config.ORGANIZATION_ID, account.id, "status_tree");
    const calculatedAt = new Date().toISOString();
    const existingRows = await fetchStatusDeviceRows(sb, account.id);
    const onlineIds = new Set(result.reconciliation.onlineDeviceIds);
    const offlineIds = new Set(result.reconciliation.offlineDeviceIds);
    const patches = buildTreeStatusPatches(existingRows, onlineIds, offlineIds, calculatedAt);
    const { updated } = await applyTreeStatusBulkUpdates(sb, config.ORGANIZATION_ID, account.id, patches);
    const summary = buildTreeSyncSummary({
        status: "success",
        mode: "sync",
        portalCounts: result.portalCounts,
        reconciliation: result.reconciliation,
        inventoryCount: inventory.deviceIds.length,
        inventorySource: inventory.source,
        databaseWrites: updated,
        componentPath: result.extraction.componentPath,
        extractionError: result.extraction.error,
        malformedNodeCount: result.extraction.malformedNodeCount,
    });
    writeTreeSyncArtifacts(config.captureDir, summary);
    await finishSyncRun(sb, syncRunId, {
        status: "success",
        devices_visible: inventory.deviceIds.length,
        positions_inserted: 0,
        parse_failures: 0,
        summary: {
            validated: true,
            updated,
            changed: patches.length,
            online: result.reconciliation.extractedCounts.online,
            offline: result.reconciliation.extractedCounts.offline,
            componentPath: result.extraction.componentPath,
        },
    });
    await markAccountSynced(sb, account.id, "success");
    log.info({
        updated,
        changed: patches.length,
        online: onlineIds.size,
        offline: offlineIds.size,
        componentPath: result.extraction.componentPath,
    }, "Tree status sync complete");
    return { databaseWrites: updated, changedDeviceCount: patches.length };
}
export async function runStatusTreeSync(sb, config, log, mode, page, inventoryIds) {
    let ownsSession = false;
    let cleanup = null;
    let activePage = page ?? null;
    let inventory = inventoryIds ? [...inventoryIds] : [];
    let inventorySource = inventoryIds ? "database" : null;
    let lastSummary = buildTreeSyncSummary({
        status: "failed",
        mode,
        portalCounts: null,
        reconciliation: null,
        inventoryCount: inventory.length,
        inventorySource,
        databaseWrites: 0,
        componentPath: null,
        extractionError: null,
        malformedNodeCount: 0,
        errorMessage: null,
    });
    try {
        if (!activePage) {
            const session = await ensureAuthenticatedPage(config, log, { forceHeadless: mode === "sync" });
            cleanup = session.cleanup;
            activePage = session.page;
            ownsSession = true;
        }
        if (inventory.length === 0) {
            const source = await loadInventorySourceFromQueryDeviceTree(activePage, config);
            inventory = source.deviceIds;
            inventorySource = source.source;
            if (source.duplicateIds.length > 0) {
                throw new StatusTreeSyncError(`Duplicate inventory device IDs found in querydevicestree: ${source.duplicateIds.length}`);
            }
        }
        const inventorySet = new Set(inventory);
        if (inventorySet.size !== inventory.length) {
            throw new StatusTreeSyncError(`Duplicate inventory device IDs found after normalization: ${inventory.length - inventorySet.size}`);
        }
        if (inventorySet.size < config.GPS51_STATUS_MIN_DEVICES) {
            throw new StatusTreeSyncError(`Inventory device count ${inventorySet.size} is below minimum ${config.GPS51_STATUS_MIN_DEVICES}`);
        }
        const result = await extractTreeStatusOnPage(activePage, inventorySet, config);
        lastSummary = buildTreeSyncSummary({
            status: "success",
            mode,
            portalCounts: result.portalCounts,
            reconciliation: result.reconciliation,
            inventoryCount: result.inventoryCount,
            inventorySource,
            databaseWrites: 0,
            componentPath: result.extraction.componentPath,
            extractionError: result.extraction.error,
            malformedNodeCount: result.extraction.malformedNodeCount,
        });
        writeTreeSyncArtifacts(config.captureDir, lastSummary);
        if (!result.reconciliation.validated) {
            printTreeSyncReport(lastSummary);
            if (mode === "sync") {
                throw new StatusTreeSyncError(`Tree status extraction failed validation: ${result.reconciliation.validationReasons.join(", ")}`);
            }
            return { validated: false, databaseWrites: 0, changedDeviceCount: 0 };
        }
        if (mode === "dry" || !sb) {
            printTreeSyncReport(lastSummary);
            return { validated: true, databaseWrites: 0, changedDeviceCount: 0 };
        }
        if (!sb) {
            throw new StatusTreeSyncError("Database client is required for production status writes");
        }
        const writeResult = await writeValidatedTreeStatus(sb, config, log, {
            deviceIds: inventory,
            source: inventorySource ?? "querydevicestree",
            duplicateIds: [],
        }, result);
        lastSummary = buildTreeSyncSummary({
            status: "success",
            mode,
            portalCounts: result.portalCounts,
            reconciliation: result.reconciliation,
            inventoryCount: result.inventoryCount,
            inventorySource,
            databaseWrites: writeResult.databaseWrites,
            componentPath: result.extraction.componentPath,
            extractionError: result.extraction.error,
            malformedNodeCount: result.extraction.malformedNodeCount,
        });
        writeTreeSyncArtifacts(config.captureDir, lastSummary);
        printTreeSyncReport(lastSummary);
        return {
            validated: true,
            databaseWrites: writeResult.databaseWrites,
            changedDeviceCount: writeResult.changedDeviceCount,
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const previousPortalCounts = lastSummary["portalCounts"] && typeof lastSummary["portalCounts"] === "object"
            ? lastSummary["portalCounts"]
            : null;
        const previousComponentPath = typeof lastSummary["componentPath"] === "string" ? lastSummary["componentPath"] : null;
        const previousExtractionError = typeof lastSummary["extractionError"] === "string"
            ? lastSummary["extractionError"]
            : null;
        lastSummary = buildTreeSyncSummary({
            status: "failed",
            mode,
            portalCounts: previousPortalCounts,
            reconciliation: null,
            inventoryCount: inventory.length,
            inventorySource,
            databaseWrites: 0,
            componentPath: previousComponentPath,
            extractionError: previousExtractionError,
            malformedNodeCount: typeof lastSummary["malformedNodeCount"] === "number"
                ? lastSummary["malformedNodeCount"]
                : 0,
            errorMessage: message,
        });
        writeTreeSyncArtifacts(config.captureDir, lastSummary);
        if (error instanceof StatusTreeSyncError)
            throw error;
        throw new StatusTreeSyncError(message);
    }
    finally {
        if (ownsSession && cleanup) {
            await cleanup().catch(() => undefined);
        }
    }
}
