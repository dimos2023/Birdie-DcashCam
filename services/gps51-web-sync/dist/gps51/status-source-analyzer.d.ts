import type { RawLiveCapture } from "./live-state-analyzer.js";
export type StatusSourceCandidate = {
    endpointKey: string;
    action: string | null;
    url: string;
    transportType: string;
    recordCount: number;
    uniqueDeviceIds: number;
    recordsWithOnlineStatus: number;
    rootKeys: string[];
    overlapCount: number;
    overlapPercentage: number;
    rankingScore: number;
};
export type StatusSourceValidation = {
    validated: boolean;
    recommendedSource: string | null;
    recommendedRule: string | null;
    reasons: string[];
};
export declare function analyzeStatusSourceCandidates(captures: RawLiveCapture[], inventoryIds: Set<string>): StatusSourceCandidate[];
export declare function extractOnlineOfflineIdsFromPayload(payload: unknown): {
    online: string[];
    offline: string[];
    all: string[];
};
export declare function validateStatusSourceDiscovery(input: {
    portalCounts: {
        all: number | null;
        online: number | null;
        offline: number | null;
    };
    inventoryCount: number;
    onlineIds: string[];
    offlineIds: string[];
    allIds: string[];
    inventoryOverlapPercent: number;
    maxPortalDelta?: number;
}): StatusSourceValidation;
export declare function sanitizeStatusCandidatePayload(payload: unknown): unknown;
export declare function summarizeAnalyzedRecords(payload: unknown): {
    recordCount: number;
    withOnlineStatus: number;
};
