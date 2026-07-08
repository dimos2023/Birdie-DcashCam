import { isReauthRequired } from "../auth/session.js";
import { getOrCreateDedicatedStatusPage } from "./status-dom-sync.js";
import { runPositionCacheSync } from "./position-cache-sync.js";
import { incrementPositionCacheErrors, setPositionCacheCurrentDeviceId, setPositionCacheRefreshMetrics, setPositionCacheRefreshSuccess, } from "./live-sync-metrics.js";
export async function refreshPositionsFromDedicatedPage(context, sb, config, log, positionPageRef, inventoryIds) {
    if (!config.GPS51_POSITION_CACHE_ENABLED) {
        return {
            refreshed: false,
            validPositions: 0,
            devicesAttempted: 0,
            cacheHits: 0,
            reason: "disabled",
        };
    }
    try {
        if (!positionPageRef.page || positionPageRef.page.isClosed()) {
            positionPageRef.page = await getOrCreateDedicatedStatusPage(context, config);
        }
        const positionPage = positionPageRef.page;
        if (await isReauthRequired(positionPage)) {
            incrementPositionCacheErrors();
            setPositionCacheRefreshSuccess(false);
            return {
                refreshed: false,
                validPositions: 0,
                devicesAttempted: 0,
                cacheHits: 0,
                reason: "reauth_required",
            };
        }
        const stats = await runPositionCacheSync(sb, config, log, "sync", positionPage, inventoryIds, {
            context,
            onCurrentDevice: (deviceId) => setPositionCacheCurrentDeviceId(deviceId),
        });
        setPositionCacheRefreshMetrics({
            devicesAttempted: stats.devicesAttempted,
            validPositions: stats.validPositions,
            missingPositions: stats.missingPositions,
            cacheHits: stats.cacheHitsBeforeSelection,
        });
        setPositionCacheRefreshSuccess(stats.validated);
        log.info({
            valid: stats.validPositions,
            attempted: stats.devicesAttempted,
            cacheHits: stats.cacheHitsBeforeSelection,
            writes: stats.databaseWrites,
        }, "Periodic GPS51 map cache position refresh");
        return {
            refreshed: stats.validated,
            validPositions: stats.validPositions,
            devicesAttempted: stats.devicesAttempted,
            cacheHits: stats.cacheHitsBeforeSelection,
            reason: stats.validated ? undefined : stats.validationReasons.join(","),
        };
    }
    catch (err) {
        incrementPositionCacheErrors();
        setPositionCacheRefreshSuccess(false);
        setPositionCacheCurrentDeviceId(null);
        log.warn({ err: err instanceof Error ? err.message : String(err) }, "Map cache position refresh failed");
        return {
            refreshed: false,
            validPositions: 0,
            devicesAttempted: 0,
            cacheHits: 0,
            reason: "refresh_error",
        };
    }
    finally {
        setPositionCacheCurrentDeviceId(null);
    }
}
