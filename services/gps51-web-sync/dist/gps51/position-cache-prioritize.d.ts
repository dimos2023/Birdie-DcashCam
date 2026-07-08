export type CacheSyncPriorityInput = {
    inventoryIds: string[];
    onlineIds: Set<string>;
    latestPositionMsByDevice: Map<string, number>;
    cacheHitIds: Set<string>;
    staleSeconds: number;
    maxDevices: number;
    nowMs?: number;
};
export declare function prioritizeCacheSyncDevices(input: CacheSyncPriorityInput): string[];
