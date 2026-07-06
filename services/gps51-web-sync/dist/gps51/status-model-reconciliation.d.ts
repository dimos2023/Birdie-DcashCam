export type ModelPortalCounts = {
    all: number | null;
    online: number | null;
    offline: number | null;
    allBefore?: number | null;
    allAfter?: number | null;
    onlineBefore?: number | null;
    onlineAfter?: number | null;
    offlineBefore?: number | null;
    offlineAfter?: number | null;
};
export type ModelCandidate = {
    source: "querydevicestree_field" | "vue_state" | "pinia_store" | "vuex_store" | "app_state_collection";
    dataPath: string;
    tab: "all" | "online" | "offline";
    matchedInventoryCount: number;
    collectionLength: number;
    uniqueMatchedIds: string[];
    statusFields: string[];
    datasetSignature: string;
    hasPerDeviceStatus: boolean;
    rejected: boolean;
    rejectionReason: string | null;
    score: number;
};
export type ModelRecommendation = {
    source: ModelCandidate["source"] | null;
    dataPath: string | null;
    fieldPath: string | null;
    mapping: string | null;
    priority: number;
};
export type ModelValidationResult = {
    allDeviceIds: string[];
    onlineDeviceIds: string[];
    offlineDeviceIds: string[];
    extractedCounts: {
        all: number;
        online: number;
        offline: number;
    };
    onlineOfflineIntersection: string[];
    unionCount: number;
    inventoryOverlapCount: number;
    inventoryOverlapPercentage: number;
    extraIds: string[];
    validated: boolean;
    validationReasons: string[];
    failureCategory: string | null;
};
export declare function isForbiddenDeviceSource(path: string): boolean;
export declare function rejectStaleModelCandidate(input: {
    tab: "all" | "online" | "offline";
    matchedInventoryCount: number;
    portalCount: number | null;
    datasetSignature: string;
    previousSignatures: string[];
    dataPath: string;
}): string | null;
export declare function scoreModelCandidate(input: {
    matchedInventoryCount: number;
    portalCount: number | null;
    hasPerDeviceStatus: boolean;
    source: ModelCandidate["source"];
    rejected: boolean;
}): number;
export declare function buildModelCandidate(input: {
    source: ModelCandidate["source"];
    dataPath: string;
    tab: "all" | "online" | "offline";
    matchedIds: string[];
    collectionLength: number;
    statusFields: string[];
    hasPerDeviceStatus: boolean;
    portalCount: number | null;
    previousSignatures: string[];
}): ModelCandidate;
export declare function recommendModelSource(input: {
    fieldCandidates: Array<{
        validated: boolean;
        fieldPath: string;
        mapping: {
            label: string;
        };
    }>;
    modelCandidates: ModelCandidate[];
}): ModelRecommendation;
export declare function validateStatusModelDiscovery(input: {
    inventoryIds: Set<string>;
    allDeviceIds: string[];
    onlineDeviceIds: string[];
    offlineDeviceIds: string[];
    portalCounts: ModelPortalCounts;
    tolerance?: number;
    minOverlapPercent?: number;
}): ModelValidationResult;
export declare function portalCountMatchesTab(tab: "all" | "online" | "offline", count: number, portalCounts: ModelPortalCounts, tolerance?: number): boolean;
export declare function categorizeModelDiscoveryFailure(input: {
    fieldCandidateCount: number;
    validatedFieldCandidate: boolean;
    modelCandidateCount: number;
    vueCandidates: number;
    validation: ModelValidationResult;
}): string;
