import type { Page } from "playwright";
import { serializeIdentityIndexForBrowser, type InventoryIdentityIndex } from "../gps51/status-dom-identity.js";
import { buildScrollContainerDiscoveryResult, type ScrollContainerCandidate } from "./status-dom-tree.js";
export type RowExtractionStats = {
    idMatches: number;
    uniqueNameMatches: number;
    groupNameMatches: number;
    unresolvedRows: number;
    duplicateNameRows: number;
    visibleRowCount: number;
    resolvedRowCount: number;
};
export type SanitizedRowSample = {
    text: string;
    title: string | null;
    resolvedDeviceId: string | null;
    resolutionMethod: string;
    statusIconClasses?: string[];
};
export type RowExtractionResult = {
    deviceIds: string[];
    extractionMethod: "dom_row_scroll" | "none";
    selectedContainer: string | null;
    stats: RowExtractionStats;
    rowSamples: SanitizedRowSample[];
    datasetSignature: string;
    scrollPasses: number;
    rejectionReason: string | null;
};
export type ContainerCandidateDebug = {
    selector: string;
    inventoryIdHits: number;
    inventoryNameHits: number;
    visibleRowCount: number;
    score: number;
    rejectionReason: string | null;
};
export declare function buildIdentityAwareContainerScript(identityPayload: ReturnType<typeof serializeIdentityIndexForBrowser>, treeSelectors: string[]): string;
export declare function scoreIdentityAwareContainers(candidates: Record<string, unknown>[]): ScrollContainerCandidate[];
export declare function buildRowExtractionScript(containerSelector: string, identityPayload: ReturnType<typeof serializeIdentityIndexForBrowser>, portalCount: number | null): string;
export declare function discoverIdentityAwareContainer(page: Page, identityIndex: InventoryIdentityIndex): Promise<{
    selectedContainer: ScrollContainerCandidate | null;
    candidates: ContainerCandidateDebug[];
    reason: string | null;
}>;
export declare function extractDeviceRowsFromContainer(page: Page, containerSelector: string, identityIndex: InventoryIdentityIndex, portalCount: number | null, tab: string): Promise<RowExtractionResult>;
export declare function mergeContainerDiscovery(legacy: ReturnType<typeof buildScrollContainerDiscoveryResult>, identity: Awaited<ReturnType<typeof discoverIdentityAwareContainer>>): ScrollContainerCandidate | null;
