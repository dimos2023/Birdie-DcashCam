import type { Locator, Page } from "playwright";
export { describeEvaluateResultType, normalizeRecordArray as normalizeEvaluateObjectRecords, normalizeStringArray as normalizeEvaluateStringArray, } from "./status-dom-normalize.js";
export declare const TREE_EXPAND_SELECTORS: string[];
export declare const TREE_ROW_SELECTORS: string[];
export type TreeExpansionResult = {
    expansionPasses: number;
    expandClicks: number;
};
export type ScrollContainerCandidate = {
    selector: string;
    domPath: string;
    score: number;
    scrollHeight: number;
    clientHeight: number;
    inventoryIdHits: number;
    inventoryNameHits?: number;
    visibleRowCount?: number;
    checkboxCount: number;
};
export type ScrollCollectionResult = {
    deviceIds: string[];
    scrollPasses: number;
    textsCollected: number;
};
export type ContainerDiscoveryDiagnostics = {
    rawCandidateType: string;
    candidateCount: number;
    validCandidateCount: number;
    selectedContainerFound: boolean;
};
export type DiscoverTreeScrollContainerResult = {
    selectedContainer: ScrollContainerCandidate | null;
    candidates: ScrollContainerCandidate[];
    reason: string | null;
    selectedContainerRejectedReason: string | null;
    diagnostics: ContainerDiscoveryDiagnostics;
};
export declare function buildScrollContainerDiscoveryScript(inventorySample: string[], treeSelectors: string[]): string;
export declare function scoreScrollContainerCandidates(candidates: Record<string, unknown>[]): ScrollContainerCandidate[];
export declare function buildScrollContainerDiscoveryResult(rawCandidates: unknown): DiscoverTreeScrollContainerResult;
export declare function logContainerDiscoveryDiagnostics(diagnostics: ContainerDiscoveryDiagnostics): void;
export declare function scoreScrollContainer(input: {
    scrollHeight: number;
    clientHeight: number;
    left: number | null;
    width: number | null;
    checkboxCount: number;
    inventoryIdHits: number;
    inventoryNameHits?: number;
    matchesTreeSelector: boolean;
    hasVxeWrapper?: boolean;
}): number;
export declare function isAuthoritativeScrollContainer(candidate: ScrollContainerCandidate): boolean;
export declare function getContainerRejectionReason(candidate: ScrollContainerCandidate | null): string | null;
export declare function shouldStopTreeExpansion(stalePasses: number, maxStalePasses?: number): boolean;
export declare function expandTreeNodesRecursively(page: Page): Promise<TreeExpansionResult>;
export declare function discoverTreeScrollContainer(page: Page, inventoryIds: Set<string>): Promise<DiscoverTreeScrollContainerResult>;
export declare function scrollContainerAndCollectIds(page: Page, containerSelector: string, inventoryIds: Set<string>, expectedCount: number | null): Promise<ScrollCollectionResult>;
export declare function resolveContainerLocator(page: Page, candidate: ScrollContainerCandidate | null): Locator;
