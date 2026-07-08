import { launchBrowser } from "../browser/create-browser.js";
import { createAuthenticatedContext, isReauthRequired } from "../auth/session.js";
import { performSafeLiveDiscoveryInteractions } from "../browser/safe-monitor-interactions.js";
import { attachLiveWebSocketListeners } from "../browser/live-websocket-listener.js";
import { NetworkCapture } from "../browser/network-capture.js";
import { parseEpochMilliseconds } from "../gps51/position-last-parser.js";
import { isDuplicatePositionId, validatePositionLast, } from "../gps51/position-last-validator.js";
import { OfflineStateManager } from "../gps51/offline-state-manager.js";
import { buildDeviceLookup, buildLatestUpdateMap, fetchAccountByUsername, fetchKnownDevices, insertLivePosition, } from "../db/live-position-repository.js";
import { ensureInventoryAccount } from "../db/inventory-repository.js";
import { finishSyncRun, markAccountReauth, markAccountSynced, startSyncRun, } from "../db/repositories.js";
import { refreshTreeStatusesFromDedicatedPage } from "./status-refresh.js";
import { refreshPositionsFromDedicatedPage } from "./position-cache-refresh.js";
import { incrementLivePositionsAccepted, incrementLivePositionsRejected, resetLiveSyncMetrics, setLiveAuthenticated, setLiveReauthRequired, setLiveUniqueDevicesSeen, incrementLiveReconnectCount, } from "./live-sync-metrics.js";
export class LiveReauthRequiredError extends Error {
    constructor() {
        super("GPS51 session expired — run npm run auth again");
        this.name = "LiveReauthRequiredError";
    }
}
const MAX_BACKOFF_MS = 5 * 60 * 1000;
export async function runLiveSyncWorker(sb, config, log, mode) {
    resetLiveSyncMetrics();
    if (mode === "continuous") {
        let backoffMs = 5_000;
        while (true) {
            try {
                await runLiveSession(sb, config, log, mode);
                backoffMs = 5_000;
            }
            catch (err) {
                if (err instanceof LiveReauthRequiredError) {
                    setLiveReauthRequired(true);
                    throw err;
                }
                incrementLiveReconnectCount();
                log.warn({ err: err instanceof Error ? err.message : String(err), backoffMs }, "Live session failed — reconnecting");
                await sleep(backoffMs);
                backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
            }
        }
    }
    return runLiveSession(sb, config, log, mode);
}
async function runLiveSession(sb, config, log, mode) {
    const durationMs = mode === "dry"
        ? config.GPS51_LIVE_DRY_DURATION_SECONDS * 1000
        : mode === "once"
            ? config.GPS51_LIVE_ONCE_DURATION_SECONDS * 1000
            : Number.MAX_SAFE_INTEGER;
    let accountId = null;
    let syncRunId = null;
    let knownDeviceIds = new Set();
    let deviceLookup = buildDeviceLookup([]);
    let latestUpdateMap = new Map();
    if (mode !== "dry" && sb) {
        const account = await ensureInventoryAccount(sb, config.ORGANIZATION_ID, config.GPS51_USERNAME, config.GPS51_BASE_URL, config.monitorUrl);
        accountId = account.id;
        syncRunId = await startSyncRun(sb, config.ORGANIZATION_ID, account.id, "live");
        const devices = await fetchKnownDevices(sb, account.id);
        knownDeviceIds = new Set(devices.map((d) => d.source_device_id));
        deviceLookup = buildDeviceLookup(devices);
        latestUpdateMap = buildLatestUpdateMap(devices);
        log.info({ known_devices: knownDeviceIds.size }, "Loaded inventory devices for live validation");
    }
    else if (mode === "dry" && sb) {
        const account = await fetchAccountByUsername(sb, config.ORGANIZATION_ID, config.GPS51_USERNAME, config.GPS51_BASE_URL);
        if (account) {
            const devices = await fetchKnownDevices(sb, account.id);
            knownDeviceIds = new Set(devices.map((d) => d.source_device_id));
            deviceLookup = buildDeviceLookup(devices);
            latestUpdateMap = buildLatestUpdateMap(devices);
        }
    }
    const offlineManager = new OfflineStateManager({
        offlineAfterSeconds: config.GPS51_OFFLINE_AFTER_SECONDS,
        warmupSeconds: config.GPS51_OFFLINE_WARMUP_SECONDS,
    });
    const stats = {
        deviceCount: knownDeviceIds.size,
        validPositions: 0,
        duplicates: 0,
        parsingErrors: 0,
        rejected: 0,
        remindMsgCount: 0,
        uniqueDevicesSeen: 0,
    };
    const seenPositionKeys = new Set();
    const seenDevices = new Set();
    let browser = null;
    let page = null;
    let context = null;
    let detachWs = null;
    let statusRefreshTimer = null;
    let positionCacheRefreshTimer = null;
    const networkCapture = new NetworkCapture();
    const statusPageRef = { page: null };
    const positionPageRef = { page: null };
    const refreshStatuses = async (reason) => {
        if (!context || !sb || !accountId)
            return;
        const result = await refreshTreeStatusesFromDedicatedPage(context, sb, accountId, config, log, statusPageRef, knownDeviceIds);
        if (result.refreshed) {
            log.info({ reason, ...result }, "Periodic GPS51 tree status refresh");
        }
    };
    const refreshPositionCache = async (reason) => {
        if (!context || !sb || !accountId || !config.GPS51_POSITION_CACHE_ENABLED)
            return;
        const result = await refreshPositionsFromDedicatedPage(context, sb, config, log, positionPageRef, knownDeviceIds);
        if (result.refreshed) {
            log.info({ reason, ...result }, "Periodic GPS51 map cache position refresh");
        }
    };
    try {
        browser = await launchBrowser(config, { forceHeadless: true });
        context = await createAuthenticatedContext(config, browser);
        page = await context.newPage();
        networkCapture.attach(page);
        detachWs = attachLiveWebSocketListeners(page, log, {
            onPositionLast: async (position) => {
                await handlePosition(position);
            },
            onRemindMsg: () => {
                stats.remindMsgCount += 1;
            },
            onParseError: () => {
                stats.parsingErrors += 1;
            },
        });
        await page.goto(config.monitorUrl, {
            waitUntil: "domcontentloaded",
            timeout: config.SYNC_REQUEST_TIMEOUT_MS,
        });
        if (await isReauthRequired(page)) {
            if (sb && accountId)
                await markAccountReauth(sb, accountId, "reauth_required during live sync");
            throw new LiveReauthRequiredError();
        }
        setLiveAuthenticated(true);
        await performSafeLiveDiscoveryInteractions(page);
        if (mode !== "dry" && sb && accountId) {
            await refreshStatuses("startup");
            statusRefreshTimer = setInterval(() => {
                void refreshStatuses("periodic");
            }, config.GPS51_STATUS_REFRESH_SECONDS * 1000);
            if (config.GPS51_POSITION_CACHE_ENABLED) {
                await refreshPositionCache("startup");
                positionCacheRefreshTimer = setInterval(() => {
                    void refreshPositionCache("periodic");
                }, config.GPS51_POSITION_CACHE_REFRESH_SECONDS * 1000);
            }
        }
        const started = Date.now();
        while (Date.now() - started < durationMs) {
            await sleep(Math.min(5_000, durationMs - (Date.now() - started)));
            if (mode === "continuous") {
                if (page.isClosed())
                    throw new Error("Monitor page closed");
                if (await isReauthRequired(page))
                    throw new LiveReauthRequiredError();
            }
        }
        stats.uniqueDevicesSeen = seenDevices.size;
        setLiveUniqueDevicesSeen(seenDevices.size);
        if (mode === "dry") {
            printDryStats(stats);
            return stats;
        }
        if (sb && syncRunId && accountId) {
            await finishSyncRun(sb, syncRunId, {
                status: "success",
                devices_visible: knownDeviceIds.size,
                positions_inserted: stats.validPositions,
                parse_failures: stats.parsingErrors + stats.rejected,
                summary: stats,
            });
            await markAccountSynced(sb, accountId, "success");
        }
    }
    finally {
        if (statusRefreshTimer)
            clearInterval(statusRefreshTimer);
        if (positionCacheRefreshTimer)
            clearInterval(positionCacheRefreshTimer);
        detachWs?.();
        if (statusPageRef.page)
            await statusPageRef.page.close().catch(() => undefined);
        if (positionPageRef.page)
            await positionPageRef.page.close().catch(() => undefined);
        if (page)
            await page.context().close().catch(() => undefined);
        if (browser)
            await browser.close().catch(() => undefined);
    }
    async function handlePosition(position) {
        if (isDuplicatePositionId(seenPositionKeys, position)) {
            stats.duplicates += 1;
            incrementLivePositionsRejected();
            return;
        }
        const validation = validatePositionLast(position, {
            knownDeviceIds,
            latestSourceUpdatedAtMs: latestUpdateMap,
            maxFutureMs: config.GPS51_LIVE_MAX_FUTURE_MS,
        });
        if (!validation.ok) {
            stats.rejected += 1;
            incrementLivePositionsRejected();
            return;
        }
        stats.validPositions += 1;
        seenDevices.add(position.sourceDeviceId);
        setLiveUniqueDevicesSeen(seenDevices.size);
        const updatedMs = parseEpochMilliseconds(position.sourceUpdatedAt) ?? Date.now();
        offlineManager.markPosition(position.sourceDeviceId, updatedMs);
        latestUpdateMap.set(position.sourceDeviceId, updatedMs);
        if (mode === "dry" || !sb || !accountId) {
            incrementLivePositionsAccepted();
            return;
        }
        const device = deviceLookup.get(position.sourceDeviceId);
        if (!device) {
            stats.rejected += 1;
            incrementLivePositionsRejected();
            return;
        }
        const outcome = await insertLivePosition(sb, config.ORGANIZATION_ID, accountId, syncRunId, device, position);
        if (outcome === "inserted") {
            incrementLivePositionsAccepted();
        }
        else if (outcome === "duplicate") {
            stats.duplicates += 1;
            incrementLivePositionsRejected();
        }
        else {
            stats.rejected += 1;
            incrementLivePositionsRejected();
        }
    }
}
function printDryStats(stats) {
    console.log("\n--- GPS51 Live WebSocket Dry Run ---");
    console.log(`Inventory devices: ${stats.deviceCount}`);
    console.log(`Valid positions parsed: ${stats.validPositions}`);
    console.log(`Duplicates rejected: ${stats.duplicates}`);
    console.log(`Validation rejected: ${stats.rejected}`);
    console.log(`Parsing errors: ${stats.parsingErrors}`);
    console.log(`remindMsg frames: ${stats.remindMsgCount}`);
    console.log(`Unique devices seen: ${stats.uniqueDevicesSeen}`);
    console.log("Zero Supabase writes performed.");
    console.log("------------------------------------\n");
}
function sleep(ms) {
    if (ms <= 0)
        return Promise.resolve();
    return new Promise((resolve) => setTimeout(resolve, ms));
}
