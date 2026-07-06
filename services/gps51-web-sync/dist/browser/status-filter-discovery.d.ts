import type { ModelPortalCounts } from "../gps51/status-model-reconciliation.js";
export declare const STATUS_FILTER_SUMMARY_FILE = "status-filter-summary.json";
export declare const STATUS_FILTER_COMPONENT_STATE_FILE = "status-filter-component-state.json";
export declare const STATUS_FILTER_FUNCTIONS_FILE = "status-filter-functions.json";
export declare const STATUS_FILTER_FIELD_CANDIDATES_FILE = "status-filter-field-candidates.json";
export declare const STATUS_FILTER_BUNDLE_MATCHES_FILE = "status-filter-bundle-matches.json";
export declare const STATUS_FILTER_ONLINE_IDS_FILE = "status-filter-online-ids.json";
export declare const STATUS_FILTER_OFFLINE_IDS_FILE = "status-filter-offline-ids.json";
export declare const STATUS_FILTER_BUNDLES_DIR = "status-filter-bundles";
export declare function buildStatusFilterFailureSummary(input: {
    startedAt: string;
    error?: unknown;
    portalCounts?: ModelPortalCounts | null;
}): Record<string, unknown>;
export declare function runStatusFilterDiscovery(): Promise<{
    validated: boolean;
    summary: Record<string, unknown>;
}>;
