import { validateStatusModelDiscovery, type ModelPortalCounts } from "./status-model-reconciliation.js";
export type FilteredCollectionCandidate = {
    dataPath: string;
    tab: "all" | "online" | "offline";
    matchedInventoryCount: number;
    collectionLength: number;
    uniqueMatchedIds: string[];
    datasetSignature: string;
    rejected: boolean;
    rejectionReason: string | null;
};
export type StatusFilterValidation = ReturnType<typeof validateStatusModelDiscovery> & {
    sourceChangesBetweenTabs: boolean;
};
export type StatusFilterRecommendation = {
    source: "querydevicestree_field" | "cache_mgr_last_positions" | "device_list_tree_nodes" | "vue_filter_function" | "vue_filtered_collection" | "bundle_predicate" | null;
    component: string | null;
    functionName: string | null;
    fieldPath: string | null;
    mapping: string | null;
    bundleMatch: string | null;
};
export declare function buildFilteredCollectionCandidate(input: {
    dataPath: string;
    tab: "all" | "online" | "offline";
    matchedIds: string[];
    collectionLength: number;
    portalCount: number | null;
    previousSignatures: string[];
    isFrameworkPath: boolean;
}): FilteredCollectionCandidate;
export declare function collectionsChangeBetweenTabs(collections: FilteredCollectionCandidate[]): boolean;
export declare function validateStatusFilterDiscovery(input: {
    inventoryIds: Set<string>;
    allDeviceIds: string[];
    onlineDeviceIds: string[];
    offlineDeviceIds: string[];
    portalCounts: ModelPortalCounts;
    collections: FilteredCollectionCandidate[];
    requireSourceChange?: boolean;
}): StatusFilterValidation;
export declare function recommendStatusFilterSource(input: {
    fieldCandidate: {
        validated: boolean;
        fieldPath: string;
        mapping: {
            label: string;
        };
    } | null;
    extraction?: {
        source: "cache_mgr_last_positions" | "device_list_tree_nodes" | null;
        componentPath: string | null;
        mapping: string | null;
        predicateFunction: string | null;
    } | null;
    functionCandidate: {
        componentName: string;
        functionName: string;
    } | null;
    collectionCandidates: FilteredCollectionCandidate[];
    bundleMatch: {
        probablePredicate: string;
        bundleUrl: string;
        snippet?: string;
    } | null;
}): StatusFilterRecommendation;
export declare function categorizeStatusFilterFailure(input: {
    relevantComponentCount: number;
    changedStatePaths: number;
    fieldCandidateCount: number;
    validatedField: boolean;
    functionCandidateCount: number;
    collectionCandidateCount: number;
    bundleMatchCount: number;
    validation: StatusFilterValidation;
}): string[];
