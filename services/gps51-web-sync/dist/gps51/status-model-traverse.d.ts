export type TraversalLimits = {
    maxDepth: number;
    maxObjects: number;
};
export type TraversalState = {
    seen: WeakSet<object>;
    inspectedObjects: number;
};
export type TraversedModelHit = {
    dataPath: string;
    source: "vue_state" | "pinia_store" | "vuex_store" | "app_state_collection";
    matchedInventoryIds: string[];
    collectionLength: number;
    statusFields: string[];
    hasPerDeviceStatus: boolean;
};
export declare function createTraversalState(): TraversalState;
export declare function shouldSkipTraversalKey(key: string): boolean;
export declare function isSkippableTraversalValue(value: unknown): boolean;
export declare function detectModelSourceFromPath(path: string): TraversedModelHit["source"];
export declare function extractInventoryIdsFromValue(value: unknown, inventorySet: Set<string>, limits?: TraversalLimits, state?: TraversalState, depth?: number): string[];
export declare function findStatusFieldsOnRecord(record: Record<string, unknown>): string[];
export declare function collectDeviceRecordsFromValue(value: unknown, depth?: number): Record<string, unknown>[];
export declare function probeValueForModelHit(path: string, value: unknown, inventorySet: Set<string>): TraversedModelHit | null;
export declare function normalizeBrowserProbeHits(raw: unknown, inventorySet: Set<string>): TraversedModelHit[];
export declare function buildVueAppProbeScript(inventorySample: string[]): string;
