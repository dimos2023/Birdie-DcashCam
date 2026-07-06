export type DomPortalCounts = {
    all: number | null;
    online: number | null;
    offline: number | null;
};
export type DomExtractedCounts = {
    all: number;
    online: number;
    offline: number;
};
export type DomStatusReconciliation = {
    allIds: string[];
    onlineIds: string[];
    offlineIds: string[];
    duplicateIds: string[];
    onlineOfflineIntersection: string[];
    unionCount: number;
    inventoryOverlapCount: number;
    inventoryOverlapPercentage: number;
    missingInventoryIds: string[];
    extraIds: string[];
    extractedCounts: DomExtractedCounts;
    validated: boolean;
    validationReasons: string[];
};
export type DomValidationOptions = {
    maxTabDelta?: number;
    minInventoryOverlapPercent?: number;
};
export type TabPortalSnapshot = {
    tab: "all" | "online" | "offline";
    portalCountBefore: number | null;
    portalCountAfter: number | null;
    extractedCount: number;
    tabSelected?: boolean;
    tabSelectionEvidenceSelected?: boolean;
};
export declare function reconcileDomStatusSets(input: {
    inventoryIds: Set<string>;
    allIds: string[];
    onlineIds: string[];
    offlineIds: string[];
    portalCounts: DomPortalCounts;
    tabSnapshots?: TabPortalSnapshot[];
    options?: DomValidationOptions;
}): DomStatusReconciliation;
