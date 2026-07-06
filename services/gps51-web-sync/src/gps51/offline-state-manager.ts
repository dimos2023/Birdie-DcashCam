export type DeviceOnlineState = "online" | "offline" | "unknown";

export type OfflineStateConfig = {
  offlineAfterSeconds: number;
  warmupSeconds: number;
};

export class OfflineStateManager {
  private readonly workerStartedAtMs: number;
  private readonly offlineAfterMs: number;
  private readonly warmupMs: number;
  private readonly lastSeenAtMs = new Map<string, number>();
  private readonly everSeen = new Set<string>();

  constructor(config: OfflineStateConfig, startedAtMs = Date.now()) {
    this.workerStartedAtMs = startedAtMs;
    this.offlineAfterMs = config.offlineAfterSeconds * 1000;
    this.warmupMs = config.warmupSeconds * 1000;
  }

  markPosition(sourceDeviceId: string, sourceUpdatedAtMs: number): void {
    this.everSeen.add(sourceDeviceId);
    const prev = this.lastSeenAtMs.get(sourceDeviceId) ?? 0;
    if (sourceUpdatedAtMs >= prev) {
      this.lastSeenAtMs.set(sourceDeviceId, sourceUpdatedAtMs);
    }
  }

  getOnlineState(sourceDeviceId: string, nowMs = Date.now()): DeviceOnlineState {
    if (!this.everSeen.has(sourceDeviceId)) return "unknown";

    const lastSeen = this.lastSeenAtMs.get(sourceDeviceId);
    if (lastSeen == null) return "unknown";

    if (nowMs - lastSeen <= this.offlineAfterMs) return "online";

    if (nowMs - this.workerStartedAtMs < this.warmupMs) return "online";

    return "offline";
  }

  isWarmupActive(nowMs = Date.now()): boolean {
    return nowMs - this.workerStartedAtMs < this.warmupMs;
  }

  getUniqueDevicesSeen(): number {
    return this.everSeen.size;
  }

  getStaleDeviceIds(nowMs = Date.now()): string[] {
    if (this.isWarmupActive(nowMs)) return [];

    const stale: string[] = [];
    for (const deviceId of this.everSeen) {
      if (this.getOnlineState(deviceId, nowMs) === "offline") {
        stale.push(deviceId);
      }
    }
    return stale;
  }
}

export function buildWebsocketPositionMetadata(
  existing: Record<string, unknown> | null,
): Record<string, unknown> {
  return {
    ...(existing ?? {}),
    online_status_source: "websocket_positionlast",
    last_websocket_position_at: new Date().toISOString(),
  };
}
