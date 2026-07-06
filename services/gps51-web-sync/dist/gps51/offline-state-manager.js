export class OfflineStateManager {
    workerStartedAtMs;
    offlineAfterMs;
    warmupMs;
    lastSeenAtMs = new Map();
    everSeen = new Set();
    constructor(config, startedAtMs = Date.now()) {
        this.workerStartedAtMs = startedAtMs;
        this.offlineAfterMs = config.offlineAfterSeconds * 1000;
        this.warmupMs = config.warmupSeconds * 1000;
    }
    markPosition(sourceDeviceId, sourceUpdatedAtMs) {
        this.everSeen.add(sourceDeviceId);
        const prev = this.lastSeenAtMs.get(sourceDeviceId) ?? 0;
        if (sourceUpdatedAtMs >= prev) {
            this.lastSeenAtMs.set(sourceDeviceId, sourceUpdatedAtMs);
        }
    }
    getOnlineState(sourceDeviceId, nowMs = Date.now()) {
        if (!this.everSeen.has(sourceDeviceId))
            return "unknown";
        const lastSeen = this.lastSeenAtMs.get(sourceDeviceId);
        if (lastSeen == null)
            return "unknown";
        if (nowMs - lastSeen <= this.offlineAfterMs)
            return "online";
        if (nowMs - this.workerStartedAtMs < this.warmupMs)
            return "online";
        return "offline";
    }
    isWarmupActive(nowMs = Date.now()) {
        return nowMs - this.workerStartedAtMs < this.warmupMs;
    }
    getUniqueDevicesSeen() {
        return this.everSeen.size;
    }
    getStaleDeviceIds(nowMs = Date.now()) {
        if (this.isWarmupActive(nowMs))
            return [];
        const stale = [];
        for (const deviceId of this.everSeen) {
            if (this.getOnlineState(deviceId, nowMs) === "offline") {
                stale.push(deviceId);
            }
        }
        return stale;
    }
}
export function buildWebsocketPositionMetadata(existing) {
    return {
        ...(existing ?? {}),
        online_status_source: "websocket_positionlast",
        last_websocket_position_at: new Date().toISOString(),
    };
}
