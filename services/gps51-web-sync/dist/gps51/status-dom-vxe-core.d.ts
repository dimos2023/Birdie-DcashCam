export declare const VXE_CHILD_PROPERTY_NAMES: readonly ["children", "childs", "childNodes", "records", "rows", "data", "list", "deviceList"];
export declare const VXE_PUBLIC_METHODS: readonly ["getTableData", "getData", "getFullData", "getRecordset"];
export declare const VXE_RESULT_DATA_KEYS: readonly ["fullData", "visibleData", "tableData", "afterFullData", "sourceData", "footerData"];
export declare const VXE_INTERNAL_STATE_PATHS: readonly ["reactData", "internalData", "tableFullData", "afterFullData", "tableData", "fullData", "visibleData", "sourceData", "tableSourceData", "tableSynchData"];
export type VxeExtractionMethod = "vxe_public_api" | "vxe_internal_state" | "vue_component_state" | "virtual_dom_scroll" | "none";
export type VxeTraversalLimits = {
    maxDepth: number;
    maxObjects: number;
};
export type VxeCandidateDiagnostic = {
    path: string;
    arrayLength: number;
    matchedInventoryCount: number;
    objectKeys: string[];
};
export type VxeTraversalState = {
    seen: WeakSet<object>;
    inspectedObjects: number;
};
export declare function createVxeTraversalState(): VxeTraversalState;
export declare function isSkippableTraverseValue(value: unknown): boolean;
export declare function normalizeInventoryToken(value: unknown): string | null;
export declare function matchInventoryToken(token: string | null, inventorySet: Set<string>): string | null;
export declare function traverseForInventoryIds(value: unknown, inventorySet: Set<string>, limits?: VxeTraversalLimits, state?: VxeTraversalState, depth?: number): string[];
export declare function extractIdsFromVxePayload(payload: unknown, inventorySet: Set<string>, limits?: VxeTraversalLimits): string[];
export declare function flattenVxeTableData(payload: unknown): unknown[];
export declare function scoreVxeDataset(ids: string[], portalCount: number | null, inventorySet: Set<string>, maxTabDelta?: number): number;
export declare function buildDatasetSignature(tab: string, ids: string[]): string;
export declare function portalCountWithinTolerance(extractedCount: number, portalBefore: number | null, portalAfter: number | null, tolerance?: number): boolean;
export declare function isStaleTabDataset(input: {
    currentTab: string;
    currentSignature: string;
    previousSignature: string | null;
    currentPortalCount: number | null;
    previousPortalCount: number | null;
}): boolean;
export declare function rejectIdenticalDatasetsAcrossTabs(input: {
    allIds: string[];
    onlineIds: string[];
    offlineIds: string[];
    portalCounts: {
        all: number | null;
        online: number | null;
        offline: number | null;
    };
}): string | null;
export declare function resolveVueComponentRoots(element: {
    __vue__?: unknown;
    __vueParentComponent?: {
        proxy?: unknown;
        exposed?: unknown;
    };
}): unknown[];
export declare function extractFromVue2Instance(instance: Record<string, unknown>, inventorySet: Set<string>): {
    ids: string[];
    path: string | null;
    method: VxeExtractionMethod;
};
export declare function pickBestVxeCandidate(candidates: Array<{
    ids: string[];
    path: string;
    method: VxeExtractionMethod;
    arrayLength: number;
}>, portalCount: number | null, inventorySet: Set<string>): {
    ids: string[];
    path: string | null;
    method: VxeExtractionMethod;
    diagnostics: VxeCandidateDiagnostic[];
};
