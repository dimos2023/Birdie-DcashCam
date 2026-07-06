import type { Page } from "playwright";
import { STATUS_TAB_FALLBACKS } from "./monitor-dom-safety.js";
import { type InventoryIdentityIndex } from "../gps51/status-dom-identity.js";
import { inferStatusIconMappings } from "../gps51/status-dom-icons.js";
import { type DomPortalCounts, type DomStatusReconciliation } from "../gps51/status-dom-reconciliation.js";
import { type ScrollContainerCandidate } from "./status-dom-tree.js";
import { type TabClickDiagnostics, type TabSelectionEvidence } from "./status-dom-tabs.js";
import { type ContainerCandidateDebug, type SanitizedRowSample } from "./status-dom-rows.js";
import type { VxeExtractionMethod } from "../gps51/status-dom-vxe-core.js";
export declare const STATUS_DOM_SUMMARY_FILE = "status-dom-summary.json";
export declare const STATUS_UI_DEBUG_FILE = "status-ui-debug.json";
export type TabExtractionResult = {
    tab: keyof typeof STATUS_TAB_FALLBACKS;
    portalCount: number | null;
    portalCountBefore: number | null;
    portalCountAfter: number | null;
    deviceIds: string[];
    tabClicked: boolean;
    tabSelected: boolean;
    tabSelectionEvidence: TabSelectionEvidence;
    tabClickDiagnostics: TabClickDiagnostics;
    matchedLabel: string | null;
    clickStrategy: string | null;
    extractionMethod: VxeExtractionMethod | "dom_row_scroll";
    selectedDataPath: string | null;
    selectedContainer: string | null;
    idMatches: number;
    uniqueNameMatches: number;
    groupNameMatches: number;
    unresolvedRows: number;
    duplicateNameRows: number;
    candidateDatasetCounts: Array<{
        path: string;
        count: number;
    }>;
    datasetSignature: string;
    staleDatasetRejected: boolean;
    expansionPasses: number;
    expandClicks: number;
    scrollPasses: number;
    textsCollected: number;
    rowSamples: SanitizedRowSample[];
};
export type StatusUiDebug = {
    tabClickDiagnostics: Array<TabClickDiagnostics & {
        tab: string;
    }>;
    tabSelectionEvidence: Array<TabSelectionEvidence & {
        tab: string;
    }>;
    containerCandidates: ContainerCandidateDebug[];
    selectedContainerSelector: string | null;
    duplicateNameCount: number;
    datasetSignatures: Record<string, string>;
    rejectionReasons: string[];
    rowSamplesByTab: Record<string, SanitizedRowSample[]>;
    statusIconInference?: ReturnType<typeof inferStatusIconMappings>;
};
export type DomStatusExtractionResult = {
    portalCounts: DomPortalCounts;
    inventoryIds: string[];
    identityIndex: InventoryIdentityIndex;
    tabResults: TabExtractionResult[];
    selectedTreeContainer: ScrollContainerCandidate | null;
    containerDiscoveryReason: string | null;
    selectedContainerRejectedReason: string | null;
    reconciliation: DomStatusReconciliation;
    validationReasons: string[];
    failureCategory: string | null;
    appStateFallback: {
        used: boolean;
        source: string | null;
        reason: string | null;
        debug: Record<string, unknown>;
        diagnostics: Record<string, unknown>;
    };
    uiDebug: StatusUiDebug;
    debug: Record<string, unknown>;
    generatedAt: string;
};
export type DomExtractionOptions = {
    maxTabDelta?: number;
    minInventoryOverlapPercent?: number;
    tabSettleMs?: number;
    useAppStateFallback?: boolean;
};
export declare function extractDomStatusSets(page: Page, inventoryIdsInput: Set<string>, options?: DomExtractionOptions, identityIndexInput?: InventoryIdentityIndex): Promise<DomStatusExtractionResult>;
export declare function loadInventoryFromMonitorPage(page: Page): Promise<{
    inventoryIds: Set<string>;
    identityIndex: InventoryIdentityIndex;
}>;
export declare function loadInventoryIdsFromMonitorPage(page: Page): Promise<Set<string>>;
export declare function buildDomFailureSummary(input: {
    startedAt: string;
    error: unknown;
    failureCategory?: string | null;
}): Record<string, unknown>;
export declare function buildDomStatusSummary(extraction: DomStatusExtractionResult): Record<string, unknown>;
