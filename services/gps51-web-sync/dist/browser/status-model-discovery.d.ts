import { type DeviceFieldProfile, type FieldStatusCandidate } from "../gps51/status-model-field-profiler.js";
import { recommendModelSource, validateStatusModelDiscovery, type ModelCandidate, type ModelPortalCounts } from "../gps51/status-model-reconciliation.js";
export declare const STATUS_MODEL_SUMMARY_FILE = "status-model-summary.json";
export declare const STATUS_FIELD_PROFILES_FILE = "status-field-profiles.json";
export declare const STATUS_MODEL_CANDIDATES_FILE = "status-model-candidates.json";
export declare const STATUS_MODEL_ONLINE_IDS_FILE = "status-model-online-ids.json";
export declare const STATUS_MODEL_OFFLINE_IDS_FILE = "status-model-offline-ids.json";
export declare function buildStatusModelFailureSummary(input: {
    startedAt: string;
    error: unknown;
    portalCounts?: ModelPortalCounts | null;
    inventoryDeviceCount?: number;
}): Record<string, unknown>;
export declare function buildStatusModelSummary(input: {
    portalCounts: ModelPortalCounts;
    inventoryDeviceCount: number;
    fieldProfiles: DeviceFieldProfile[];
    fieldCandidates: FieldStatusCandidate[];
    modelCandidates: ModelCandidate[];
    recommendation: ReturnType<typeof recommendModelSource>;
    validation: ReturnType<typeof validateStatusModelDiscovery>;
    failureCategory: string;
    generatedAt: string;
}): Record<string, unknown>;
export declare function runStatusModelDiscovery(): Promise<{
    validated: boolean;
    summary: Record<string, unknown>;
}>;
