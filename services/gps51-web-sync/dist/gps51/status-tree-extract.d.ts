import { validateStatusModelDiscovery, type ModelPortalCounts } from "./status-model-reconciliation.js";
export type TreeNodeRecord = {
    deviceid?: unknown;
    isOnline?: unknown;
    online?: unknown;
    info?: {
        deviceid?: unknown;
        isOnline?: unknown;
        online?: unknown;
    };
    children?: TreeNodeRecord[];
};
export type TreeNodeConnectivity = "online" | "offline" | "malformed";
export type DeviceListCandidate = {
    componentPath: string;
    componentName: string | null;
    deviceIds: string[];
    inventoryOverlapCount: number;
    inventoryOverlapPercentage: number;
    hasSetCurrentZtree: boolean;
    hasTablesClickRowDevice: boolean;
};
export type TreeStatusExtraction = {
    source: "device_list_tree_nodes";
    componentPath: string | null;
    mapping: string;
    predicateFunction: string;
    allDeviceIds: string[];
    onlineDeviceIds: string[];
    offlineDeviceIds: string[];
    malformedNodeCount: number;
    skippedNodeCount: number;
    counts: {
        all: number;
        online: number;
        offline: number;
    };
    error: string | null;
};
export type TreeStatusReconciliation = ReturnType<typeof validateStatusModelDiscovery> & {
    portalCounts: ModelPortalCounts;
    componentPath: string | null;
    malformedNodeCount: number;
};
export declare function classifyTreeNodeConnectivity(node: TreeNodeRecord | null | undefined): TreeNodeConnectivity;
export declare function isTruthyOnline(value: unknown): boolean;
export declare function isFalsyOffline(value: unknown): boolean;
export declare function nodeDeviceId(node: TreeNodeRecord): string | null;
export declare function isDeviceTreeNode(node: TreeNodeRecord): boolean;
export declare function walkTreeNodes(nodes: TreeNodeRecord[] | null | undefined): Array<{
    deviceId: string;
    connectivity: TreeNodeConnectivity;
}>;
export declare function extractIdsFromTreeNodes(nodes: TreeNodeRecord[]): {
    allDeviceIds: string[];
    onlineDeviceIds: string[];
    offlineDeviceIds: string[];
    malformedNodeCount: number;
    skippedNodeCount: number;
};
export declare function scoreDeviceListCandidate(candidate: Omit<DeviceListCandidate, "inventoryOverlapCount" | "inventoryOverlapPercentage">, inventoryIds: Set<string>): DeviceListCandidate;
export declare function pickBestDeviceListCandidate(candidates: DeviceListCandidate[], minOverlapPercent?: number): DeviceListCandidate | null;
export declare function filterExtractionToInventory(extraction: Pick<TreeStatusExtraction, "allDeviceIds" | "onlineDeviceIds" | "offlineDeviceIds">, inventoryIds: Set<string>): Pick<TreeStatusExtraction, "allDeviceIds" | "onlineDeviceIds" | "offlineDeviceIds" | "counts">;
export declare function normalizeTreeStatusExtraction(raw: unknown): TreeStatusExtraction;
export declare function reconcileTreeStatusExtraction(input: {
    extraction: TreeStatusExtraction;
    inventoryIds: Set<string>;
    portalCounts: ModelPortalCounts;
    tolerance?: number;
    minOverlapPercent?: number;
}): TreeStatusReconciliation;
export declare function buildStatusTreeExtractScript(inventorySample: string[]): string;
