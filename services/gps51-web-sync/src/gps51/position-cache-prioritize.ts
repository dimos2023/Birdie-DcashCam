export type CacheSyncPriorityInput = {
  inventoryIds: string[];
  onlineIds: Set<string>;
  latestPositionMsByDevice: Map<string, number>;
  cacheHitIds: Set<string>;
  staleSeconds: number;
  maxDevices: number;
  nowMs?: number;
};

export function prioritizeCacheSyncDevices(input: CacheSyncPriorityInput): string[] {
  const nowMs = input.nowMs ?? Date.now();
  const staleMs = input.staleSeconds * 1000;
  const tier1: string[] = [];
  const tier2: string[] = [];
  const tier3: string[] = [];
  const tier4: string[] = [];

  for (const deviceId of input.inventoryIds) {
    const isOnline = input.onlineIds.has(deviceId);
    const latestMs = input.latestPositionMsByDevice.get(deviceId);
    const hasStoredPosition = latestMs != null && latestMs > 0;
    const isStale = hasStoredPosition && nowMs - latestMs > staleMs;
    const inCache = input.cacheHitIds.has(deviceId);

    if (isOnline && !hasStoredPosition) {
      tier1.push(deviceId);
    } else if (isOnline && isStale) {
      tier2.push(deviceId);
    } else if (!inCache) {
      tier3.push(deviceId);
    } else {
      tier4.push(deviceId);
    }
  }

  return [...tier1, ...tier2, ...tier3, ...tier4].slice(0, input.maxDevices);
}
