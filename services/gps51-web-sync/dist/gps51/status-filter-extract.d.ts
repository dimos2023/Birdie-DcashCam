export type StatusFilterExtractionResult = {
    source: "cache_mgr_last_positions" | "device_list_tree_nodes" | null;
    componentPath: string | null;
    mapping: string | null;
    predicateFunction: string | null;
    allDeviceIds: string[];
    onlineDeviceIds: string[];
    offlineDeviceIds: string[];
    counts: {
        all: number;
        online: number;
        offline: number;
    };
    error: string | null;
};
export declare function isExcludedStatusFilterFunction(name: string): boolean;
export declare function isConnectivityBundleSnippet(snippet: string): boolean;
export declare function classifyOnlineFromLastPosition(lastPosition: {
    online?: unknown;
} | null | undefined): "online" | "offline";
export declare function extractIdsFromCacheMgr(deviceInfos: Record<string, unknown>, lastPositions: Record<string, {
    online?: unknown;
}>): Pick<StatusFilterExtractionResult, "allDeviceIds" | "onlineDeviceIds" | "offlineDeviceIds">;
export declare function normalizeStatusFilterExtraction(raw: unknown): StatusFilterExtractionResult;
export declare function buildStatusFilterExtractScript(): string;
