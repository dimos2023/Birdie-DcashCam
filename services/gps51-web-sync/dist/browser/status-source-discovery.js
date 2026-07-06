import { writeFileSync } from "node:fs";
import path from "node:path";
import { loadConfig, validateWorkerConfig, ensureCaptureDir } from "../config.js";
import { createLogger } from "../logger.js";
import { ensureAuthenticatedPage } from "../auth/session.js";
import { LiveNetworkCapture } from "../browser/live-network-capture.js";
import { readPortalStatusCounts } from "../browser/monitor-subscription.js";
import { collectVisibleDeviceIds, reconcileDeviceSets } from "../browser/status-dom-collector.js";
import { collectBootstrapDeviceRecords } from "../gps51/status-bootstrap-parser.js";
import { analyzeStatusSourceCandidates, sanitizeStatusCandidatePayload, validateStatusSourceDiscovery, } from "../gps51/status-source-analyzer.js";
import { NetworkCapture, waitForDiscoverySignals } from "./network-capture.js";
import { safeScrollDeviceTree } from "./dom-fallback.js";
import { buildFailureSummary, clickStatusTab, } from "./monitor-dom-safety.js";
const OBSERVE_MS = 8_000;
const SUMMARY_FILE = "status-source-summary.json";
const isMain = process.argv[1]?.includes("status-source-discovery");
function writeSummaryFile(captureDir, summary) {
    writeFileSync(path.join(captureDir, SUMMARY_FILE), JSON.stringify(summary, null, 2));
}
function logDiscoveryError(log, err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    log.error({ err: message, stack }, "Status source discovery failed");
    if (stack) {
        console.error(stack);
    }
}
async function captureTab(page, tabKey, observeMs) {
    const clickResult = await clickStatusTab(page, tabKey);
    if (clickResult.clicked) {
        await page.waitForTimeout(observeMs);
    }
    const portalCounts = await readPortalStatusCounts(page).catch(() => ({
        all: null,
        online: null,
        offline: null,
    }));
    const dom = await collectVisibleDeviceIds(page).catch(() => ({
        deviceIds: [],
        scrollPasses: 0,
    }));
    const portalCount = tabKey === "online"
        ? portalCounts.online
        : tabKey === "offline"
            ? portalCounts.offline
            : portalCounts.all;
    return {
        tab: tabKey,
        portalCount,
        domDeviceIds: dom.deviceIds,
        scrollPasses: dom.scrollPasses,
        tabClicked: clickResult.clicked,
        matchedLabel: clickResult.matchedLabel,
        clickStrategy: clickResult.strategy,
    };
}
export async function runStatusSourceDiscovery() {
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
        const liveCapture = new LiveNetworkCapture();
        const treeCapture = new NetworkCapture();
        liveCapture.attach(page);
        treeCapture.attach(page);
        await waitForDiscoverySignals(page, treeCapture, 10_000, 20_000);
        await safeScrollDeviceTree(page).catch(() => undefined);
        await page.waitForTimeout(2000);
        const treePayload = treeCapture.getActionCapture("querydevicestree")?.sanitizedResponse;
        const inventoryRecords = treePayload ? collectBootstrapDeviceRecords(treePayload) : [];
        const inventoryIds = new Set(inventoryRecords.map((r) => r.sourceDeviceId));
        const tabCaptures = [];
        const tabSequence = [
            "all",
            "online",
            "offline",
            "all_return",
        ];
        for (const tabKey of tabSequence) {
            const resolvedKey = tabKey === "all_return" ? "all" : tabKey;
            try {
                const capture = await captureTab(page, resolvedKey, OBSERVE_MS);
                tabCaptures.push({
                    ...capture,
                    tab: tabKey,
                });
            }
            catch (err) {
                log.warn({ tab: tabKey, err: err instanceof Error ? err.message : String(err) }, "Tab capture failed — continuing");
                tabCaptures.push({
                    tab: tabKey,
                    portalCount: null,
                    domDeviceIds: [],
                    scrollPasses: 0,
                    tabClicked: false,
                    matchedLabel: null,
                    clickStrategy: null,
                });
            }
        }
        const portalCounts = await readPortalStatusCounts(page).catch(() => ({
            all: null,
            online: null,
            offline: null,
        }));
        const allCapture = tabCaptures.find((t) => t.tab === "all");
        const onlineCapture = tabCaptures.find((t) => t.tab === "online");
        const offlineCapture = tabCaptures.find((t) => t.tab === "offline");
        const allIds = allCapture?.domDeviceIds ?? [];
        const onlineIds = onlineCapture?.domDeviceIds ?? [];
        const offlineIds = offlineCapture?.domDeviceIds ?? [];
        const reconciliation = reconcileDeviceSets({
            inventoryIds,
            onlineIds,
            offlineIds,
            allIds,
        });
        const networkCandidates = analyzeStatusSourceCandidates(liveCapture.getCaptures(), inventoryIds);
        const validation = validateStatusSourceDiscovery({
            portalCounts,
            inventoryCount: inventoryIds.size,
            onlineIds,
            offlineIds,
            allIds,
            inventoryOverlapPercent: reconciliation.overlapInventoryPercent,
            maxPortalDelta: config.GPS51_STATUS_BOOTSTRAP_MAX_PORTAL_DELTA,
        });
        const topCandidate = networkCandidates.length > 0 ? networkCandidates[0] : null;
        const summary = {
            status: "success",
            startedAt,
            finishedAt: new Date().toISOString(),
            generatedAt: new Date().toISOString(),
            portalCounts,
            inventoryDeviceCount: inventoryIds.size,
            tabCaptures: tabCaptures.map((capture) => ({
                tab: capture.tab,
                portalCount: capture.portalCount,
                domDeviceIdCount: capture.domDeviceIds.length,
                scrollPasses: capture.scrollPasses,
                tabClicked: capture.tabClicked,
                matchedLabel: capture.matchedLabel,
                clickStrategy: capture.clickStrategy,
            })),
            domReconciliation: reconciliation,
            candidateEndpoints: networkCandidates.map((c) => c.endpointKey),
            candidateRootKeys: networkCandidates.flatMap((c) => c.rootKeys).slice(0, 50),
            candidateRecordCounts: networkCandidates.map((c) => ({
                endpointKey: c.endpointKey,
                recordCount: c.recordCount,
                uniqueDeviceIds: c.uniqueDeviceIds,
                recordsWithOnlineStatus: c.recordsWithOnlineStatus,
                overlapPercentage: c.overlapPercentage,
                rankingScore: c.rankingScore,
            })),
            onlineIdsCount: reconciliation.onlineCount,
            offlineIdsCount: reconciliation.offlineCount,
            duplicateIds: [...reconciliation.duplicateOnline, ...reconciliation.duplicateOffline],
            missingInventoryIds: reconciliation.missingInventory.slice(0, 100),
            recommendedSource: validation.validated
                ? validation.recommendedSource
                : topCandidate?.endpointKey ?? null,
            recommendedRule: validation.recommendedRule,
            validated: validation.validated,
            validationReasons: validation.reasons,
            errorMessage: null,
            errorStack: null,
            note: "Timestamp-only lastactivetime/offlinedelay calibration is not authoritative and must not be used for production writes.",
        };
        writeSummaryFile(config.captureDir, summary);
        writeFileSync(path.join(config.captureDir, "status-source-candidates.json"), JSON.stringify(networkCandidates.map((candidate) => ({
            ...candidate,
            samplePayload: treePayload ? sanitizeStatusCandidatePayload(treePayload) : null,
        })), null, 2));
        writeFileSync(path.join(config.captureDir, "status-online-device-ids.json"), JSON.stringify({ count: onlineIds.length, deviceIds: onlineIds }, null, 2));
        writeFileSync(path.join(config.captureDir, "status-offline-device-ids.json"), JSON.stringify({ count: offlineIds.length, deviceIds: offlineIds }, null, 2));
        log.info({
            validated: validation.validated,
            online: reconciliation.onlineCount,
            offline: reconciliation.offlineCount,
            inventory: inventoryIds.size,
        }, "Status source discovery complete");
        console.log("\n--- GPS51 Status Source Discovery ---");
        console.log(JSON.stringify(summary, null, 2));
        console.log("Files written to data/captures/");
        console.log("-------------------------------------\n");
    }
    catch (err) {
        logDiscoveryError(log, err);
        writeSummaryFile(config.captureDir, buildFailureSummary({ startedAt, error: err }));
        throw err;
    }
    finally {
        if (cleanup) {
            await cleanup().catch(() => undefined);
        }
    }
}
if (isMain) {
    runStatusSourceDiscovery()
        .then(() => process.exit(0))
        .catch((err) => {
        console.error(err instanceof Error ? err.message : err);
        if (err instanceof Error && err.stack) {
            console.error(err.stack);
        }
        process.exit(1);
    });
}
