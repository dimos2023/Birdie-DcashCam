export type TransportType = "fetch" | "xhr" | "graphql" | "websocket";
export type RawLiveCapture = {
    endpointKey: string;
    transportType: TransportType;
    url: string;
    action: string | null;
    payloads: unknown[];
    frameCount: number;
};
export type AnalyzedRecord = {
    deviceId: string | null;
    hasCoordinates: boolean;
    hasSpeed: boolean;
    hasOnlineStatus: boolean;
    hasAcc: boolean;
    hasTimestamp: boolean;
    parsedTimestamp: string | null;
    sanitized: Record<string, unknown>;
};
export type LiveCandidateMetrics = {
    endpointKey: string;
    action: string | null;
    url: string;
    transportType: TransportType;
    responseOrFrameCount: number;
    recordCount: number;
    uniqueDeviceIdCount: number;
    overlapCount: number;
    overlapPercentage: number;
    recordsWithCoordinates: number;
    recordsWithSpeed: number;
    recordsWithOnlineStatus: number;
    recordsWithAcc: number;
    recordsWithTimestamp: number;
    newestRecordTimestamp: string | null;
    oldestRecordTimestamp: string | null;
    allRecordsOlderThan24h: boolean;
    fieldNameFrequency: Record<string, number>;
    rootKeys: string[];
    sampleRecords: Record<string, unknown>[];
    rankingScore: number;
    rankingBreakdown: Record<string, number>;
    isAlarmCandidate: boolean;
    isPlaybackCandidate: boolean;
};
export type QueryAlarmLiveAnalysis = {
    recordCount: number;
    overlapCount: number;
    overlapPercentage: number;
    timestampRange: {
        earliest: string | null;
        latest: string | null;
    };
    recordsWithCoordinates: number;
    recordsWithAlarmType: number;
    assessment: "historical_alarms" | "current_positions" | "mixed" | "unknown";
    safeForLiveStatus: boolean;
    reason: string;
};
export type LiveStateSummary = {
    startedAt: string;
    finishedAt: string;
    inventoryDeviceCount: number;
    observationDurationMs: number;
    networkCandidateCount: number;
    websocketCandidateCount: number;
    rankedCandidates: LiveCandidateMetrics[];
    queryAlarmAnalysis: QueryAlarmLiveAnalysis | null;
    topRecommendation: {
        endpointKey: string;
        action: string | null;
        transportType: TransportType;
        rankingScore: number;
        overlapPercentage: number;
        validated: boolean;
        note: string;
    } | null;
};
export declare function extractRootKeys(payload: unknown): string[];
export declare function collectLiveRecords(payload: unknown, depth?: number): Record<string, unknown>[];
export declare function analyzeLiveRecord(record: Record<string, unknown>, sanitized: Record<string, unknown>): AnalyzedRecord;
export declare function computeOverlap(deviceIds: Iterable<string | null>, inventoryIds: Set<string>): {
    overlapCount: number;
    uniqueDeviceIdCount: number;
    overlapPercentage: number;
};
export declare function computeRankingScore(metrics: Omit<LiveCandidateMetrics, "rankingScore" | "rankingBreakdown">): {
    rankingScore: number;
    rankingBreakdown: Record<string, number>;
};
export declare function analyzeLiveCandidate(capture: RawLiveCapture, inventoryIds: Set<string>, sanitizeRecord: (record: Record<string, unknown>) => Record<string, unknown>): LiveCandidateMetrics;
export declare function analyzeQueryAlarmLiveState(payloads: unknown[], inventoryIds: Set<string>, sanitizeRecord: (record: Record<string, unknown>) => Record<string, unknown>): QueryAlarmLiveAnalysis;
export declare function rankLiveCandidates(candidates: LiveCandidateMetrics[]): LiveCandidateMetrics[];
export declare function buildLiveStateSummary(inventoryDeviceCount: number, startedAt: string, finishedAt: string, observationDurationMs: number, networkCandidates: LiveCandidateMetrics[], websocketCandidates: LiveCandidateMetrics[], queryAlarmAnalysis: QueryAlarmLiveAnalysis | null): LiveStateSummary;
export declare function tryParseJsonPayload(payload: string | Buffer): unknown | null;
export declare function summarizeWebsocketSubscription(payload: unknown): Record<string, unknown> | null;
