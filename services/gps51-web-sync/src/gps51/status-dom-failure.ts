import type { TabSelectionEvidence } from "../browser/status-dom-tabs.js";
import type { TabExtractionResult } from "../browser/status-dom-extractor.js";
import type { DomStatusReconciliation } from "./status-dom-reconciliation.js";

export type DomExtractionFailureCategory =
  | "tab_target_not_selected"
  | "no_device_container"
  | "device_names_not_resolved"
  | "virtual_scroll_incomplete"
  | "duplicate_device_names"
  | "dataset_count_mismatch"
  | "unknown";

export function categorizeDomExtractionFailure(input: {
  tabResults: TabExtractionResult[];
  reconciliation: DomStatusReconciliation;
  containerReason: string | null;
  selectedContainer: string | null;
}): DomExtractionFailureCategory {
  const tabsMissingSelection = input.tabResults.filter(
    (tab) => tab.tabClicked && !tab.tabSelected && !tab.tabSelectionEvidence?.selected,
  );
  if (tabsMissingSelection.length > 0) return "tab_target_not_selected";

  if (!input.selectedContainer || input.containerReason === "no_device_container") {
    return "no_device_container";
  }

  const duplicateRows = input.tabResults.reduce((sum, tab) => sum + tab.duplicateNameRows, 0);
  if (duplicateRows > 0 && input.reconciliation.extractedCounts.all === 0) {
    return "duplicate_device_names";
  }

  const unresolved = input.tabResults.reduce((sum, tab) => sum + tab.unresolvedRows, 0);
  const resolved = input.tabResults.reduce((sum, tab) => sum + tab.deviceIds.length, 0);
  if (unresolved > resolved && resolved === 0) return "device_names_not_resolved";

  const scrollIncomplete = input.tabResults.some(
    (tab) =>
      tab.portalCountAfter != null &&
      tab.deviceIds.length > 0 &&
      Math.abs(tab.deviceIds.length - tab.portalCountAfter) > 2 &&
      tab.scrollPasses > 0,
  );
  if (scrollIncomplete) return "virtual_scroll_incomplete";

  if (
    input.reconciliation.validationReasons.some(
      (reason) =>
        reason.includes("count_delta") ||
        reason.includes("portal_snapshot_delta") ||
        reason === "identical_datasets_across_tabs",
    )
  ) {
    return "dataset_count_mismatch";
  }

  return "unknown";
}

export function hasTabSelectionEvidenceForAllTabs(
  tabResults: TabExtractionResult[],
): boolean {
  return tabResults.every(
    (tab) =>
      tab.tabSelectionEvidence != null &&
      tab.tabSelectionEvidence.selected &&
      tab.tabSelectionEvidence.reasons.length > 0,
  );
}
