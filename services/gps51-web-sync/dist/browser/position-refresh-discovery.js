import { writeFileSync } from "node:fs";
import path from "node:path";
import { ensureCaptureDir, loadConfig, resetConfigCache, validateBrowserWorkerConfig, } from "../config.js";
import { createLogger } from "../logger.js";
import { ensureAuthenticatedPage } from "../auth/session.js";
import { extractTreeStatusOnPage, loadInventorySourceFromQueryDeviceTree } from "../worker/status-tree-sync.js";
import { safelySelectOnlineDeviceOnPage, POSITION_REFRESH_SUMMARY_FILE } from "./device-list-discovery.js";
import { attachLiveWebSocketListeners } from "./live-websocket-listener.js";
import { NetworkCapture } from "./network-capture.js";
const isMain = process.argv[1]?.includes("position-refresh-discovery");
function writeJson(captureDir, file, value) {
    writeFileSync(path.join(captureDir, file), JSON.stringify(value, null, 2));
}
export async function runPositionRefreshDiscovery() {
    resetConfigCache();
    const config = loadConfig(process.env);
    validateBrowserWorkerConfig(config);
    ensureCaptureDir(config);
    const log = createLogger(config);
    const failureSummary = {
        status: "failed",
        selectedDeviceId: null,
        requestAction: null,
        requestActions: [],
        positionLastReceived: false,
        responseLatencyMs: null,
        latitude: null,
        longitude: null,
        gpsTimestamp: null,
        updateTimestamp: null,
        source: null,
        componentPath: null,
        errorMessage: null,
        generatedAt: new Date().toISOString(),
    };
    let cleanup = null;
    try {
        const session = await ensureAuthenticatedPage(config, log, { forceHeadless: true });
        cleanup = session.cleanup;
        const { page } = session;
        const inventory = await loadInventorySourceFromQueryDeviceTree(page, config);
        const treeStatus = await extractTreeStatusOnPage(page, new Set(inventory.deviceIds), config);
        if (!treeStatus.reconciliation.validated) {
            throw new Error(`Validated online device list unavailable: ${treeStatus.reconciliation.validationReasons.join(", ")}`);
        }
        const candidateDeviceId = treeStatus.reconciliation.onlineDeviceIds[0] ?? null;
        if (!candidateDeviceId) {
            throw new Error("No online device available for position refresh discovery");
        }
        const capture = new NetworkCapture();
        capture.attach(page);
        let matchedPosition = null;
        let matchedReceivedAt = null;
        const selectionStartMs = Date.now();
        const waitForPosition = new Promise((resolve) => {
            const detach = attachLiveWebSocketListeners(page, log, {
                onPositionLast: async (position) => {
                    if (position.sourceDeviceId !== candidateDeviceId || matchedPosition)
                        return;
                    matchedPosition = position;
                    matchedReceivedAt = Date.now();
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
        const recentActions = capture
            .getAll()
            .filter((entry) => Date.parse(entry.capturedAt) >= selectionStartMs - 1000)
            .map((entry) => entry.action)
            .filter((action) => typeof action === "string");
        const position = matchedPosition;
        const summary = {
            status: "success",
            selectedDeviceId: selection.selectedDeviceId,
            requestAction: recentActions[0] ?? null,
            requestActions: [...new Set(recentActions)],
            positionLastReceived: position != null,
            responseLatencyMs: matchedReceivedAt != null ? matchedReceivedAt - selectionStartMs : null,
            latitude: position ? position.latitude : null,
            longitude: position ? position.longitude : null,
            gpsTimestamp: position ? position.sourceLocatedAt : null,
            updateTimestamp: position ? position.sourceUpdatedAt : null,
            source: position ? "websocket_positionLast" : selection.selectionMethod,
            componentPath: selection.componentPath,
            errorMessage: selection.error,
            generatedAt: new Date().toISOString(),
        };
        writeJson(config.captureDir, POSITION_REFRESH_SUMMARY_FILE, summary);
        console.log("\n--- GPS51 Position Refresh Discovery ---");
        console.log(JSON.stringify(summary, null, 2));
        console.log("Files written to data/captures/");
        console.log("----------------------------------------\n");
    }
    catch (error) {
        const summary = {
            ...failureSummary,
            errorMessage: error instanceof Error ? error.message : String(error),
            generatedAt: new Date().toISOString(),
        };
        writeJson(config.captureDir, POSITION_REFRESH_SUMMARY_FILE, summary);
        throw error;
    }
    finally {
        if (cleanup)
            await cleanup().catch(() => undefined);
    }
}
if (isMain) {
    runPositionRefreshDiscovery()
        .then(() => process.exit(0))
        .catch((err) => {
        console.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
    });
}
