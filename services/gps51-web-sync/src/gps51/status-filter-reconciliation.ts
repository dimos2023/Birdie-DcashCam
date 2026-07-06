import { buildDatasetSignature } from "./status-dom-vxe-core.js";
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
  source:
    | "querydevicestree_field"
    | "cache_mgr_last_positions"
    | "device_list_tree_nodes"
    | "vue_filter_function"
    | "vue_filtered_collection"
    | "bundle_predicate"
    | null;
  component: string | null;
  functionName: string | null;
  fieldPath: string | null;
  mapping: string | null;
  bundleMatch: string | null;
};

export function buildFilteredCollectionCandidate(input: {
  dataPath: string;
  tab: "all" | "online" | "offline";
  matchedIds: string[];
  collectionLength: number;
  portalCount: number | null;
  previousSignatures: string[];
  isFrameworkPath: boolean;
}): FilteredCollectionCandidate {
  const uniqueMatchedIds = [...new Set(input.matchedIds)].sort();
  const datasetSignature = buildDatasetSignature(input.tab, uniqueMatchedIds);
  let rejectionReason: string | null = null;

  if (input.isFrameworkPath) rejectionReason = "framework_internal_path";
  else if (input.previousSignatures.includes(datasetSignature)) {
    rejectionReason = "identical_dataset_across_tabs";
  } else if (
    input.portalCount != null &&
    uniqueMatchedIds.length < input.portalCount * 0.9
  ) {
    rejectionReason = "below_90_percent_expected_count";
  } else if (uniqueMatchedIds.length === 0) {
    rejectionReason = "no_inventory_ids";
  }

  return {
    dataPath: input.dataPath,
    tab: input.tab,
    matchedInventoryCount: uniqueMatchedIds.length,
    collectionLength: input.collectionLength,
    uniqueMatchedIds,
    datasetSignature,
    rejected: rejectionReason != null,
    rejectionReason,
  };
}

export function collectionsChangeBetweenTabs(
  collections: FilteredCollectionCandidate[],
): boolean {
  const byTab = new Map<string, string>();
  for (const candidate of collections) {
    if (candidate.rejected) continue;
    const existing = byTab.get(candidate.tab);
    if (!existing || candidate.matchedInventoryCount > Number(existing.split(":")[1])) {
      byTab.set(candidate.tab, candidate.datasetSignature);
    }
  }
  const signatures = [...byTab.values()];
  if (signatures.length < 2) return false;
  return new Set(signatures).size > 1;
}

export function validateStatusFilterDiscovery(input: {
  inventoryIds: Set<string>;
  allDeviceIds: string[];
  onlineDeviceIds: string[];
  offlineDeviceIds: string[];
  portalCounts: ModelPortalCounts;
  collections: FilteredCollectionCandidate[];
  requireSourceChange?: boolean;
}): StatusFilterValidation {
  const base = validateStatusModelDiscovery({
    inventoryIds: input.inventoryIds,
    allDeviceIds: input.allDeviceIds,
    onlineDeviceIds: input.onlineDeviceIds,
    offlineDeviceIds: input.offlineDeviceIds,
    portalCounts: input.portalCounts,
    tolerance: 2,
    minOverlapPercent: 99,
  });

  const sourceChangesBetweenTabs = collectionsChangeBetweenTabs(input.collections);
  const validationReasons = [...base.validationReasons];
  if (input.requireSourceChange && !sourceChangesBetweenTabs && base.validated) {
    validationReasons.push("source_unchanged_between_tabs");
  }

  return {
    ...base,
    validated: validationReasons.length === 0,
    validationReasons,
    sourceChangesBetweenTabs,
  };
}

export function recommendStatusFilterSource(input: {
  fieldCandidate: { validated: boolean; fieldPath: string; mapping: { label: string } } | null;
  extraction?: {
    source: "cache_mgr_last_positions" | "device_list_tree_nodes" | null;
    componentPath: string | null;
    mapping: string | null;
    predicateFunction: string | null;
  } | null;
  functionCandidate: { componentName: string; functionName: string } | null;
  collectionCandidates: FilteredCollectionCandidate[];
  bundleMatch: { probablePredicate: string; bundleUrl: string; snippet?: string } | null;
}): StatusFilterRecommendation {
  if (input.fieldCandidate?.validated) {
    return {
      source: "querydevicestree_field",
      component: null,
      functionName: null,
      fieldPath: input.fieldCandidate.fieldPath,
      mapping: input.fieldCandidate.mapping.label,
      bundleMatch: null,
    };
  }

  if (input.extraction?.source === "cache_mgr_last_positions") {
    return {
      source: "cache_mgr_last_positions",
      component: input.extraction.componentPath,
      functionName: input.extraction.predicateFunction,
      fieldPath: "lastPositions[deviceId].online",
      mapping: input.extraction.mapping,
      bundleMatch: null,
    };
  }

  if (input.extraction?.source === "device_list_tree_nodes") {
    return {
      source: "device_list_tree_nodes",
      component: input.extraction.componentPath,
      functionName: input.extraction.predicateFunction,
      fieldPath: "treeNode.isOnline",
      mapping: input.extraction.mapping,
      bundleMatch: null,
    };
  }

  if (input.functionCandidate) {
    return {
      source: "vue_filter_function",
      component: input.functionCandidate.componentName,
      functionName: input.functionCandidate.functionName,
      fieldPath: null,
      mapping: null,
      bundleMatch: null,
    };
  }

  const online = input.collectionCandidates.find((c) => c.tab === "online" && !c.rejected);
  const offline = input.collectionCandidates.find((c) => c.tab === "offline" && !c.rejected);
  if (online && offline) {
    return {
      source: "vue_filtered_collection",
      component: online.dataPath.split(".")[0] ?? null,
      functionName: null,
      fieldPath: null,
      mapping: null,
      bundleMatch: null,
    };
  }

  if (input.bundleMatch) {
    return {
      source: "bundle_predicate",
      component: null,
      functionName: null,
      fieldPath: null,
      mapping: null,
      bundleMatch: input.bundleMatch.probablePredicate,
    };
  }

  return {
    source: null,
    component: null,
    functionName: null,
    fieldPath: null,
    mapping: null,
    bundleMatch: null,
  };
}

export function categorizeStatusFilterFailure(input: {
  relevantComponentCount: number;
  changedStatePaths: number;
  fieldCandidateCount: number;
  validatedField: boolean;
  functionCandidateCount: number;
  collectionCandidateCount: number;
  bundleMatchCount: number;
  validation: StatusFilterValidation;
}): string[] {
  const failures: string[] = [];
  if (input.validation.validated) return failures;
  if (input.relevantComponentCount === 0) failures.push("no_relevant_vue_component");
  if (input.changedStatePaths === 0) failures.push("no_changed_device_collection");
  if (input.functionCandidateCount === 0 && input.bundleMatchCount === 0) {
    failures.push("no_status_predicate_found");
  }
  if (!input.validatedField && input.fieldCandidateCount === 0) {
    failures.push("no_low_cardinality_status_field");
  }
  if (input.bundleMatchCount > 0 && !input.validation.validated) {
    failures.push("bundle_predicate_not_resolved");
  }
  if (input.validation.validationReasons.some((reason) => reason.includes("count_delta"))) {
    failures.push("status_count_mismatch");
  }
  if (input.collectionCandidateCount === 0) failures.push("no_changed_device_collection");
  return [...new Set(failures)];
}
