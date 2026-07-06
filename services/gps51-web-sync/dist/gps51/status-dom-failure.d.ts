import type { TabExtractionResult } from "../browser/status-dom-extractor.js";
import type { DomStatusReconciliation } from "./status-dom-reconciliation.js";
export type DomExtractionFailureCategory = "tab_target_not_selected" | "no_device_container" | "device_names_not_resolved" | "virtual_scroll_incomplete" | "duplicate_device_names" | "dataset_count_mismatch" | "unknown";
export declare function categorizeDomExtractionFailure(input: {
    tabResults: TabExtractionResult[];
    reconciliation: DomStatusReconciliation;
    containerReason: string | null;
    selectedContainer: string | null;
}): DomExtractionFailureCategory;
export declare function hasTabSelectionEvidenceForAllTabs(tabResults: TabExtractionResult[]): boolean;
