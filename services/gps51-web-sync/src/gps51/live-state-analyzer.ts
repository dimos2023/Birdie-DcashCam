import {
  ALARM_URL_HINTS,
  LIVE_ACC_KEYS,
  LIVE_ONLINE_KEYS,
  LIVE_SPEED_KEYS,
  LIVE_TIMESTAMP_KEYS,
  extractLiveDeviceId,
  incrementFieldFrequency,
  parseLiveTimestamp,
  recordHasCoordinates,
  recordHasFieldGroup,
} from "./live-field-aliases.js";

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

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function looksLikeLiveRecord(record: Record<string, unknown>): boolean {
  if (extractLiveDeviceId(record)) return true;
  if (recordHasCoordinates(record)) return true;
  if (recordHasFieldGroup(record, "online")) return true;
  if (recordHasFieldGroup(record, "speed")) return true;
  if (recordHasFieldGroup(record, "acc")) return true;
  if (recordHasFieldGroup(record, "timestamp")) return true;
  return false;
}

export function extractRootKeys(payload: unknown): string[] {
  if (Array.isArray(payload)) return ["[]"];
  if (!isRecord(payload)) return [];
  return Object.keys(payload).slice(0, 30);
}

export function collectLiveRecords(payload: unknown, depth = 0): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  const seenObjects = new Set<unknown>();
  const seenRecords = new Set<Record<string, unknown>>();

  function addRecord(record: Record<string, unknown>): void {
    if (seenRecords.has(record)) return;
    seenRecords.add(record);
    results.push(record);
  }

  function walk(value: unknown, currentDepth: number): void {
    if (currentDepth > 12 || value == null) return;
    if (typeof value !== "object") return;
    if (seenObjects.has(value)) return;
    seenObjects.add(value);

    if (Array.isArray(value)) {
      for (const item of value) {
        if (isRecord(item) && looksLikeLiveRecord(item)) {
          addRecord(item);
        }
        walk(item, currentDepth + 1);
      }
      return;
    }

    if (isRecord(value)) {
      if (looksLikeLiveRecord(value)) {
        addRecord(value);
      }
      for (const nested of Object.values(value)) {
        walk(nested, currentDepth + 1);
      }
    }
  }

  walk(payload, depth);
  return results;
}

export function analyzeLiveRecord(
  record: Record<string, unknown>,
  sanitized: Record<string, unknown>,
): AnalyzedRecord {
  const parsed = parseLiveTimestamp(record);
  return {
    deviceId: extractLiveDeviceId(record),
    hasCoordinates: recordHasCoordinates(record),
    hasSpeed: recordHasFieldGroup(record, "speed"),
    hasOnlineStatus: recordHasFieldGroup(record, "online"),
    hasAcc: recordHasFieldGroup(record, "acc"),
    hasTimestamp: recordHasFieldGroup(record, "timestamp"),
    parsedTimestamp: parsed?.toISOString() ?? null,
    sanitized,
  };
}

export function computeOverlap(
  deviceIds: Iterable<string | null>,
  inventoryIds: Set<string>,
): { overlapCount: number; uniqueDeviceIdCount: number; overlapPercentage: number } {
  const unique = new Set<string>();
  for (const id of deviceIds) {
    if (id) unique.add(id);
  }

  let overlapCount = 0;
  for (const id of unique) {
    if (inventoryIds.has(id)) overlapCount += 1;
  }

  const overlapPercentage =
    inventoryIds.size > 0 ? Math.round((overlapCount / inventoryIds.size) * 10000) / 100 : 0;

  return { overlapCount, uniqueDeviceIdCount: unique.size, overlapPercentage };
}

function isAlarmOnlyCandidate(
  action: string | null,
  url: string,
  records: AnalyzedRecord[],
): boolean {
  if (action === "queryalarm") return true;
  const lower = url.toLowerCase();
  if (ALARM_URL_HINTS.some((hint) => lower.includes(hint))) return true;
  const alarmLike = records.filter((r) => "alarmtype" in r.sanitized || "alarmType" in r.sanitized);
  return records.length > 0 && alarmLike.length / records.length > 0.8;
}

function isPlaybackCandidate(action: string | null, url: string): boolean {
  const lower = `${action ?? ""} ${url}`.toLowerCase();
  return ["playback", "track", "history", "replay", "recordfile"].some((hint) => lower.includes(hint));
}

export function computeRankingScore(
  metrics: Omit<LiveCandidateMetrics, "rankingScore" | "rankingBreakdown">,
): { rankingScore: number; rankingBreakdown: Record<string, number> } {
  const breakdown: Record<string, number> = {};
  let rankingScore = 0;

  if (metrics.overlapPercentage > 90) {
    breakdown.overlapAbove90Percent = 20;
    rankingScore += 20;
  }

  if (metrics.recordsWithCoordinates > 0 && !metrics.allRecordsOlderThan24h) {
    breakdown.containsLatitudeLongitude = 15;
    rankingScore += 15;
  }

  if (metrics.recordsWithOnlineStatus > 0) {
    breakdown.containsOnlineOfflineStatus = 10;
    rankingScore += 10;
  }

  if (metrics.recordsWithTimestamp > 0) {
    breakdown.containsSourceTimestamps = 8;
    rankingScore += 8;
  }

  if (metrics.recordsWithSpeed > 0 || metrics.recordsWithAcc > 0) {
    breakdown.containsSpeedOrAcc = 5;
    rankingScore += 5;
  }

  if (metrics.isAlarmCandidate) {
    breakdown.alarmOnlyRecords = -20;
    rankingScore -= 20;
  }

  if (metrics.isPlaybackCandidate) {
    breakdown.historicalPlaybackRecords = -20;
    rankingScore -= 20;
  }

  if (metrics.allRecordsOlderThan24h && metrics.recordsWithTimestamp > 0) {
    breakdown.recordsOlderThan24Hours = -20;
    rankingScore -= 20;
  }

  if (metrics.overlapCount === 0) {
    breakdown.noInventoryOverlap = -30;
    rankingScore -= 30;
  }

  return { rankingScore, rankingBreakdown: breakdown };
}

export function analyzeLiveCandidate(
  capture: RawLiveCapture,
  inventoryIds: Set<string>,
  sanitizeRecord: (record: Record<string, unknown>) => Record<string, unknown>,
): LiveCandidateMetrics {
  const fieldNameFrequency: Record<string, number> = {};
  const analyzedRecords: AnalyzedRecord[] = [];
  const rootKeysSet = new Set<string>();

  for (const payload of capture.payloads) {
    for (const key of extractRootKeys(payload)) rootKeysSet.add(key);
    for (const record of collectLiveRecords(payload)) {
      incrementFieldFrequency(fieldNameFrequency, record);
      analyzedRecords.push(analyzeLiveRecord(record, sanitizeRecord(record)));
    }
  }

  const timestamps = analyzedRecords
    .map((r) => (r.parsedTimestamp ? new Date(r.parsedTimestamp) : null))
    .filter((d): d is Date => d != null);

  const now = Date.now();
  const newest = timestamps.length
    ? new Date(Math.max(...timestamps.map((d) => d.getTime())))
    : null;
  const oldest = timestamps.length
    ? new Date(Math.min(...timestamps.map((d) => d.getTime())))
    : null;
  const allRecordsOlderThan24h =
    timestamps.length > 0 && timestamps.every((d) => now - d.getTime() > TWENTY_FOUR_HOURS_MS);

  const overlap = computeOverlap(
    analyzedRecords.map((r) => r.deviceId),
    inventoryIds,
  );

  const base: Omit<LiveCandidateMetrics, "rankingScore" | "rankingBreakdown"> = {
    endpointKey: capture.endpointKey,
    action: capture.action,
    url: capture.url,
    transportType: capture.transportType,
    responseOrFrameCount: capture.frameCount,
    recordCount: analyzedRecords.length,
    uniqueDeviceIdCount: overlap.uniqueDeviceIdCount,
    overlapCount: overlap.overlapCount,
    overlapPercentage: overlap.overlapPercentage,
    recordsWithCoordinates: analyzedRecords.filter((r) => r.hasCoordinates).length,
    recordsWithSpeed: analyzedRecords.filter((r) => r.hasSpeed).length,
    recordsWithOnlineStatus: analyzedRecords.filter((r) => r.hasOnlineStatus).length,
    recordsWithAcc: analyzedRecords.filter((r) => r.hasAcc).length,
    recordsWithTimestamp: analyzedRecords.filter((r) => r.hasTimestamp).length,
    newestRecordTimestamp: newest?.toISOString() ?? null,
    oldestRecordTimestamp: oldest?.toISOString() ?? null,
    allRecordsOlderThan24h,
    fieldNameFrequency,
    rootKeys: [...rootKeysSet],
    sampleRecords: analyzedRecords.slice(0, 5).map((r) => r.sanitized),
    isAlarmCandidate: isAlarmOnlyCandidate(capture.action, capture.url, analyzedRecords),
    isPlaybackCandidate: isPlaybackCandidate(capture.action, capture.url),
  };

  const { rankingScore, rankingBreakdown } = computeRankingScore(base);
  return { ...base, rankingScore, rankingBreakdown };
}

export function analyzeQueryAlarmLiveState(
  payloads: unknown[],
  inventoryIds: Set<string>,
  sanitizeRecord: (record: Record<string, unknown>) => Record<string, unknown>,
): QueryAlarmLiveAnalysis {
  const analyzed: AnalyzedRecord[] = [];
  for (const payload of payloads) {
    for (const record of collectLiveRecords(payload)) {
      analyzed.push(analyzeLiveRecord(record, sanitizeRecord(record)));
    }
  }

  const overlap = computeOverlap(
    analyzed.map((r) => r.deviceId),
    inventoryIds,
  );

  const timestamps = analyzed
    .map((r) => (r.parsedTimestamp ? new Date(r.parsedTimestamp) : null))
    .filter((d): d is Date => d != null);

  const earliest = timestamps.length
    ? new Date(Math.min(...timestamps.map((d) => d.getTime()))).toISOString()
    : null;
  const latest = timestamps.length
    ? new Date(Math.max(...timestamps.map((d) => d.getTime()))).toISOString()
    : null;

  const recordsWithAlarmType = analyzed.filter(
    (r) => "alarmtype" in r.sanitized || "alarmType" in r.sanitized || "type" in r.sanitized,
  ).length;
  const recordsWithCoordinates = analyzed.filter((r) => r.hasCoordinates).length;

  const now = Date.now();
  const allOlderThan24h =
    timestamps.length > 0 && timestamps.every((d) => now - d.getTime() > TWENTY_FOUR_HOURS_MS);

  let assessment: QueryAlarmLiveAnalysis["assessment"] = "unknown";
  if (recordsWithAlarmType > 0 && recordsWithAlarmType >= analyzed.length * 0.5) {
    assessment = allOlderThan24h ? "historical_alarms" : "mixed";
  } else if (recordsWithCoordinates > 0 && !allOlderThan24h) {
    assessment = "current_positions";
  } else if (recordsWithAlarmType > 0 && recordsWithCoordinates > 0) {
    assessment = "mixed";
  }

  const safeForLiveStatus =
    assessment === "current_positions" &&
    overlap.overlapPercentage > 50 &&
    !allOlderThan24h &&
    recordsWithCoordinates > 0;

  let reason = "queryalarm appears to contain alarm/event records, not a canonical live-position feed.";
  if (assessment === "historical_alarms") {
    reason = "Records are predominantly alarms with timestamps older than 24 hours.";
  } else if (assessment === "mixed") {
    reason = "Mixed alarm and location fields; treat as auxiliary signal only.";
  } else if (safeForLiveStatus) {
    reason = "Unexpected: queryalarm shows recent coordinates — verify manually before using.";
  }

  return {
    recordCount: analyzed.length,
    overlapCount: overlap.overlapCount,
    overlapPercentage: overlap.overlapPercentage,
    timestampRange: { earliest, latest },
    recordsWithCoordinates,
    recordsWithAlarmType,
    assessment,
    safeForLiveStatus,
    reason,
  };
}

export function rankLiveCandidates(candidates: LiveCandidateMetrics[]): LiveCandidateMetrics[] {
  return [...candidates].sort((a, b) => {
    if (b.rankingScore !== a.rankingScore) return b.rankingScore - a.rankingScore;
    return b.overlapPercentage - a.overlapPercentage;
  });
}

export function buildLiveStateSummary(
  inventoryDeviceCount: number,
  startedAt: string,
  finishedAt: string,
  observationDurationMs: number,
  networkCandidates: LiveCandidateMetrics[],
  websocketCandidates: LiveCandidateMetrics[],
  queryAlarmAnalysis: QueryAlarmLiveAnalysis | null,
): LiveStateSummary {
  const rankedCandidates = rankLiveCandidates([...networkCandidates, ...websocketCandidates]);
  const top = rankedCandidates[0] ?? null;

  const validated =
    top != null &&
    top.rankingScore >= 30 &&
    top.overlapPercentage > 90 &&
    top.recordsWithCoordinates > 0 &&
    !top.isAlarmCandidate &&
    !top.allRecordsOlderThan24h;

  return {
    startedAt,
    finishedAt,
    inventoryDeviceCount,
    observationDurationMs,
    networkCandidateCount: networkCandidates.length,
    websocketCandidateCount: websocketCandidates.length,
    rankedCandidates,
    queryAlarmAnalysis,
    topRecommendation: top
      ? {
          endpointKey: top.endpointKey,
          action: top.action,
          transportType: top.transportType,
          rankingScore: top.rankingScore,
          overlapPercentage: top.overlapPercentage,
          validated,
          note: validated
            ? "Candidate meets overlap and freshness thresholds — verify manually before permanent sync."
            : "No validated live-state candidate yet — review ranked list and re-run discovery if needed.",
        }
      : null,
  };
}

export function tryParseJsonPayload(payload: string | Buffer): unknown | null {
  const text = typeof payload === "string" ? payload : payload.toString("utf8").trim();
  if (!text) return null;
  if (!(text.startsWith("{") || text.startsWith("[") || text.startsWith('"'))) return null;
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === "string") {
      try {
        return JSON.parse(parsed);
      } catch {
        return null;
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

export function summarizeWebsocketSubscription(payload: unknown): Record<string, unknown> | null {
  if (payload == null || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const meta: Record<string, unknown> = {};
  for (const key of ["type", "action", "cmd", "method", "event", "subscribe", "channel", "topic"]) {
    if (record[key] != null) meta[key] = record[key];
  }
  return Object.keys(meta).length > 0 ? meta : { frameType: "binary_or_unknown" };
}
