import type { RawLiveCapture } from "./live-state-analyzer.js";
import {
  analyzeLiveCandidate,
  analyzeLiveRecord,
  collectLiveRecords,
  rankLiveCandidates,
} from "./live-state-analyzer.js";
import { extractLiveDeviceId } from "./live-field-aliases.js";
import { redactSecrets } from "../browser/redaction.js";

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

export function analyzeStatusSourceCandidates(
  captures: RawLiveCapture[],
  inventoryIds: Set<string>,
): StatusSourceCandidate[] {
  const candidates = captures.map((capture) =>
    analyzeLiveCandidate(capture, inventoryIds, (record) => redactSecrets(record)),
  );
  return rankLiveCandidates(candidates).map((candidate) => ({
    endpointKey: candidate.endpointKey,
    action: candidate.action,
    url: candidate.url,
    transportType: candidate.transportType,
    recordCount: candidate.recordCount,
    uniqueDeviceIds: candidate.uniqueDeviceIdCount,
    recordsWithOnlineStatus: candidate.recordsWithOnlineStatus,
    rootKeys: candidate.rootKeys,
    overlapCount: candidate.overlapCount,
    overlapPercentage: candidate.overlapPercentage,
    rankingScore: candidate.rankingScore,
  }));
}

export function extractOnlineOfflineIdsFromPayload(
  payload: unknown,
): { online: string[]; offline: string[]; all: string[] } {
  const online: string[] = [];
  const offline: string[] = [];
  const all: string[] = [];

  for (const record of collectLiveRecords(payload)) {
    const deviceId = extractLiveDeviceId(record);
    if (!deviceId) continue;
    all.push(deviceId);
    const status = inferOnlineFromRecord(record);
    if (status === "online") online.push(deviceId);
    else if (status === "offline") offline.push(deviceId);
  }

  return {
    online: [...new Set(online)],
    offline: [...new Set(offline)],
    all: [...new Set(all)],
  };
}

function inferOnlineFromRecord(record: Record<string, unknown>): "online" | "offline" | "unknown" {
  for (const key of ["online", "isonline", "isOnline", "status", "devicestatus"]) {
    const val = record[key] ?? record[key.toLowerCase()];
    if (val === true || val === 1 || val === "1" || val === "online") return "online";
    if (val === false || val === 0 || val === "0" || val === "offline") return "offline";
  }
  return "unknown";
}

export function validateStatusSourceDiscovery(input: {
  portalCounts: { all: number | null; online: number | null; offline: number | null };
  inventoryCount: number;
  onlineIds: string[];
  offlineIds: string[];
  allIds: string[];
  inventoryOverlapPercent: number;
  maxPortalDelta?: number;
}): StatusSourceValidation {
  const maxDelta = input.maxPortalDelta ?? 5;
  const reasons: string[] = [];
  const onlineCount = new Set(input.onlineIds).size;
  const offlineCount = new Set(input.offlineIds).size;
  const allCount =
    input.allIds.length > 0
      ? new Set(input.allIds).size
      : onlineCount + offlineCount;

  if (input.portalCounts.all != null && Math.abs(allCount - input.portalCounts.all) > maxDelta) {
    reasons.push(`all_count_delta_${Math.abs(allCount - input.portalCounts.all)}`);
  }
  if (input.portalCounts.online != null && Math.abs(onlineCount - input.portalCounts.online) > maxDelta) {
    reasons.push(`online_count_delta_${Math.abs(onlineCount - input.portalCounts.online)}`);
  }
  if (input.portalCounts.offline != null && Math.abs(offlineCount - input.portalCounts.offline) > maxDelta) {
    reasons.push(`offline_count_delta_${Math.abs(offlineCount - input.portalCounts.offline)}`);
  }
  if (onlineCount + offlineCount > 0 && Math.abs(onlineCount + offlineCount - allCount) > maxDelta) {
    reasons.push("online_offline_sum_mismatch");
  }
  if (input.inventoryOverlapPercent < 90) {
    reasons.push(`inventory_overlap_${input.inventoryOverlapPercent}`);
  }

  const validated = reasons.length === 0;
  return {
    validated,
    recommendedSource: validated ? "dom_tab_device_sets" : null,
    recommendedRule: validated ? "portal_tab_membership" : null,
    reasons,
  };
}

export function sanitizeStatusCandidatePayload(payload: unknown): unknown {
  return redactSecrets(payload);
}

export function summarizeAnalyzedRecords(payload: unknown): {
  recordCount: number;
  withOnlineStatus: number;
} {
  let recordCount = 0;
  let withOnlineStatus = 0;
  for (const record of collectLiveRecords(payload)) {
    recordCount += 1;
    const analyzed = analyzeLiveRecord(record, redactSecrets(record));
    if (analyzed.hasOnlineStatus) withOnlineStatus += 1;
  }
  return { recordCount, withOnlineStatus };
}
