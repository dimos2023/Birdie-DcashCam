export type DeviceOnlineState = "online" | "offline" | "unknown";
export type OfflineStateConfig = {
    offlineAfterSeconds: number;
    warmupSeconds: number;
};
export declare class OfflineStateManager {
    private readonly workerStartedAtMs;
    private readonly offlineAfterMs;
    private readonly warmupMs;
    private readonly lastSeenAtMs;
    private readonly everSeen;
    constructor(config: OfflineStateConfig, startedAtMs?: number);
    markPosition(sourceDeviceId: string, sourceUpdatedAtMs: number): void;
    getOnlineState(sourceDeviceId: string, nowMs?: number): DeviceOnlineState;
    isWarmupActive(nowMs?: number): boolean;
    getUniqueDevicesSeen(): number;
    getStaleDeviceIds(nowMs?: number): string[];
}
export declare function buildWebsocketPositionMetadata(existing: Record<string, unknown> | null): Record<string, unknown>;
