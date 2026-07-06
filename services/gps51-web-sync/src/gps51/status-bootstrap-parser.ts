import { STATUS_KEYS } from "./selectors.js";

export type BootstrapDeviceRecord = {
  sourceDeviceId: string;
  deviceName: string | null;
  lastActiveTimeRaw: unknown;
  offlineDelayRaw: unknown;
  raw: Record<string, unknown>;
};

export type StatusRuleType = "explicit_online_field" | "lastactivetime_threshold";

export type StatusCalibrationRule = {
  ruleType: StatusRuleType;
  lastActiveTimeUnit?: "milliseconds" | "seconds";
  offlineDelayUnit?: "seconds" | "minutes" | "milliseconds";
  thresholdSeconds?: number;
};

export type BootstrapStatusCounts = {
  total: number;
  online: number;
  offline: number;
  unknown: number;
};

export type DeviceStatusEvaluation = {
  sourceDeviceId: string;
  status: "online" | "offline" | "unknown";
  lastActiveMs: number | null;
  offlineDelaySeconds: number | null;
  lastActiveSourceValue: unknown;
  offlineDelaySourceValue: unknown;
};

export type CalibrationCandidate = {
  rule: StatusCalibrationRule;
  counts: BootstrapStatusCounts;
  mismatchCount: number;
  onlineDelta: number;
  offlineDelta: number;
};

export type BootstrapCalibrationResult = {
  selectedRule: StatusCalibrationRule | null;
  calculatedCounts: BootstrapStatusCounts;
  mismatchCount: number;
  onlineDelta: number;
  offlineDelta: number;
  candidatesWithinTolerance: number;
};

const DEVICE_ID_KEYS = ["deviceid", "deviceId", "device_id"];

const STATUS_BOOTSTRAP_SUMMARY_FILE = "status-bootstrap-summary.json";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickField(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    for (const candidate of [key, key.toLowerCase()]) {
      const val = record[candidate];
      if (val != null && val !== "") return val;
    }
  }
  return null;
}

function hasDeviceId(record: Record<string, unknown>): boolean {
  return pickField(record, DEVICE_ID_KEYS) != null;
}

function walkDeviceRecords(payload: unknown, visitor: (record: Record<string, unknown>) => void): void {
  function walk(value: unknown): void {
    if (!isRecord(value)) return;
    if (hasDeviceId(value)) visitor(value);
    for (const nested of Object.values(value)) {
      if (Array.isArray(nested)) nested.forEach(walk);
      else walk(nested);
    }
  }
  walk(payload);
}

export function parseExplicitOnlineStatus(
  record: Record<string, unknown>,
): "online" | "offline" | "unknown" {
  for (const key of STATUS_KEYS) {
    const val = record[key] ?? record[key.toLowerCase()];
    if (val === true || val === 1 || val === "1" || val === "online") return "online";
    if (val === false || val === 0 || val === "0" || val === "offline") return "offline";
  }
  return "unknown";
}

export function collectBootstrapDeviceRecords(payload: unknown): BootstrapDeviceRecord[] {
  const results: BootstrapDeviceRecord[] = [];
  const seen = new Set<string>();

  walkDeviceRecords(payload, (value) => {
    const sourceDeviceId = String(pickField(value, DEVICE_ID_KEYS));
    if (seen.has(sourceDeviceId)) return;
    seen.add(sourceDeviceId);
    results.push({
      sourceDeviceId,
      deviceName: pickField(value, ["devicename", "deviceName", "name"]) as string | null,
      lastActiveTimeRaw: pickField(value, ["lastactivetime", "lastActiveTime"]),
      offlineDelayRaw: pickField(value, ["offlinedelay", "offlineDelay", "offlinedelaytime"]),
      raw: value,
    });
  });

  return results;
}

export function findDuplicateDeviceIds(payload: unknown): string[] {
  const counts = new Map<string, number>();

  walkDeviceRecords(payload, (value) => {
    const sourceDeviceId = String(pickField(value, DEVICE_ID_KEYS));
    counts.set(sourceDeviceId, (counts.get(sourceDeviceId) ?? 0) + 1);
  });

  return [...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id);
}

export function parseLastActiveMs(raw: unknown, unit: "milliseconds" | "seconds"): number | null {
  if (raw == null || raw === "") return null;
  const numeric = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(numeric)) {
    const parsed = Date.parse(String(raw));
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (unit === "milliseconds") {
    return numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
  }
  return numeric > 1_000_000_000 ? numeric : numeric * 1000;
}

export function isValidLastActiveTime(raw: unknown, unit: "milliseconds" | "seconds"): boolean {
  return parseLastActiveMs(raw, unit) != null;
}

export function parseOfflineDelaySeconds(
  raw: unknown,
  unit: "seconds" | "minutes" | "milliseconds",
  fallbackSeconds: number,
): number {
  if (raw == null || raw === "") return fallbackSeconds;
  const numeric = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallbackSeconds;

  if (unit === "minutes") return numeric * 60;
  if (unit === "milliseconds") return Math.max(1, Math.round(numeric / 1000));
  if (numeric > 86_400) return Math.round(numeric / 1000);
  return numeric;
}

export function isValidOfflineDelay(raw: unknown): boolean {
  if (raw == null || raw === "") return false;
  const numeric = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(numeric) && numeric > 0;
}

export function evaluateDeviceStatus(
  record: BootstrapDeviceRecord,
  rule: StatusCalibrationRule,
  nowMs = Date.now(),
): DeviceStatusEvaluation {
  const base = {
    sourceDeviceId: record.sourceDeviceId,
    lastActiveSourceValue: record.lastActiveTimeRaw,
    offlineDelaySourceValue: record.offlineDelayRaw,
    lastActiveMs: null as number | null,
    offlineDelaySeconds: null as number | null,
  };

  if (rule.ruleType === "explicit_online_field") {
    const status = parseExplicitOnlineStatus(record.raw);
    return { ...base, status };
  }

  const lastActiveTimeUnit = rule.lastActiveTimeUnit ?? "milliseconds";
  const offlineDelayUnit = rule.offlineDelayUnit ?? "seconds";
  const thresholdSeconds = rule.thresholdSeconds ?? 600;

  const lastActiveMs = parseLastActiveMs(record.lastActiveTimeRaw, lastActiveTimeUnit);
  const offlineDelaySeconds = parseOfflineDelaySeconds(
    record.offlineDelayRaw,
    offlineDelayUnit,
    thresholdSeconds,
  );

  if (lastActiveMs == null) {
    return {
      ...base,
      status: "unknown",
      offlineDelaySeconds,
    };
  }

  const status =
    nowMs - lastActiveMs <= offlineDelaySeconds * 1000 ? "online" : "offline";

  return {
    ...base,
    status,
    lastActiveMs,
    offlineDelaySeconds,
  };
}

export function evaluateAllDeviceStatuses(
  records: BootstrapDeviceRecord[],
  rule: StatusCalibrationRule,
  nowMs = Date.now(),
): Map<string, DeviceStatusEvaluation> {
  const result = new Map<string, DeviceStatusEvaluation>();
  for (const record of records) {
    result.set(record.sourceDeviceId, evaluateDeviceStatus(record, rule, nowMs));
  }
  return result;
}

export function summarizeDeviceStatuses(
  evaluations: Map<string, DeviceStatusEvaluation>,
): BootstrapStatusCounts {
  let online = 0;
  let offline = 0;
  let unknown = 0;
  for (const evaluation of evaluations.values()) {
    if (evaluation.status === "online") online += 1;
    else if (evaluation.status === "offline") offline += 1;
    else unknown += 1;
  }
  return {
    total: evaluations.size,
    online,
    offline,
    unknown,
  };
}

export function scorePortalDelta(
  counts: BootstrapStatusCounts,
  portal: { online: number | null; offline: number | null },
): { mismatchCount: number; onlineDelta: number; offlineDelta: number } {
  const onlineDelta =
    portal.online != null ? Math.abs(counts.online - portal.online) : 0;
  const offlineDelta =
    portal.offline != null ? Math.abs(counts.offline - portal.offline) : 0;
  return {
    mismatchCount: onlineDelta + offlineDelta,
    onlineDelta,
    offlineDelta,
  };
}

export function buildCalibrationCandidates(
  records: BootstrapDeviceRecord[],
  portal: { online: number | null; offline: number | null },
  defaultThresholdSeconds: number,
  nowMs = Date.now(),
): CalibrationCandidate[] {
  const candidates: CalibrationCandidate[] = [];

  const explicitRule: StatusCalibrationRule = { ruleType: "explicit_online_field" };
  const explicitEvaluations = evaluateAllDeviceStatuses(records, explicitRule, nowMs);
  const explicitCounts = summarizeDeviceStatuses(explicitEvaluations);
  const explicitDelta = scorePortalDelta(explicitCounts, portal);
  candidates.push({
    rule: explicitRule,
    counts: explicitCounts,
    ...explicitDelta,
  });

  const lastActiveUnits: Array<"milliseconds" | "seconds"> = ["milliseconds", "seconds"];
  const offlineUnits: Array<"seconds" | "minutes" | "milliseconds"> = [
    "seconds",
    "minutes",
    "milliseconds",
  ];
  const thresholds = [defaultThresholdSeconds, 600, 1800, 3600];

  for (const lastActiveTimeUnit of lastActiveUnits) {
    for (const offlineDelayUnit of offlineUnits) {
      for (const thresholdSeconds of thresholds) {
        const rule: StatusCalibrationRule = {
          ruleType: "lastactivetime_threshold",
          lastActiveTimeUnit,
          offlineDelayUnit,
          thresholdSeconds,
        };
        const evaluations = evaluateAllDeviceStatuses(records, rule, nowMs);
        const counts = summarizeDeviceStatuses(evaluations);
        const delta = scorePortalDelta(counts, portal);
        candidates.push({ rule, counts, ...delta });
      }
    }
  }

  candidates.sort((a, b) => {
    if (a.mismatchCount !== b.mismatchCount) return a.mismatchCount - b.mismatchCount;
    if (a.counts.unknown !== b.counts.unknown) return a.counts.unknown - b.counts.unknown;
    return 0;
  });

  return candidates;
}

export function calibrateStatusRule(
  records: BootstrapDeviceRecord[],
  portal: { online: number | null; offline: number | null },
  defaultThresholdSeconds: number,
  maxMismatch = 5,
  nowMs = Date.now(),
): BootstrapCalibrationResult {
  const candidates = buildCalibrationCandidates(
    records,
    portal,
    defaultThresholdSeconds,
    nowMs,
  );

  const withinTolerance = candidates.filter((c) => c.mismatchCount <= maxMismatch);
  const selected = withinTolerance[0] ?? null;

  if (!selected) {
    const best = candidates[0];
    return {
      selectedRule: null,
      calculatedCounts: best?.counts ?? {
        total: records.length,
        online: 0,
        offline: 0,
        unknown: records.length,
      },
      mismatchCount: best?.mismatchCount ?? Number.MAX_SAFE_INTEGER,
      onlineDelta: best?.onlineDelta ?? Number.MAX_SAFE_INTEGER,
      offlineDelta: best?.offlineDelta ?? Number.MAX_SAFE_INTEGER,
      candidatesWithinTolerance: 0,
    };
  }

  return {
    selectedRule: selected.rule,
    calculatedCounts: selected.counts,
    mismatchCount: selected.mismatchCount,
    onlineDelta: selected.onlineDelta,
    offlineDelta: selected.offlineDelta,
    candidatesWithinTolerance: withinTolerance.length,
  };
}

export function countInvalidLastActiveTime(
  records: BootstrapDeviceRecord[],
  rule: StatusCalibrationRule,
): number {
  if (rule.ruleType === "explicit_online_field") return 0;
  const unit = rule.lastActiveTimeUnit ?? "milliseconds";
  return records.filter((r) => !isValidLastActiveTime(r.lastActiveTimeRaw, unit)).length;
}

export function countInvalidOfflineDelay(
  records: BootstrapDeviceRecord[],
  rule: StatusCalibrationRule,
): number {
  if (rule.ruleType === "explicit_online_field") return 0;
  return records.filter((r) => !isValidOfflineDelay(r.offlineDelayRaw)).length;
}

export function buildDeviceTreeStatusMetadata(
  evaluation: DeviceStatusEvaluation,
  calculatedAt: string,
): Record<string, unknown> {
  return {
    online_status_source: "gps51_querydevicestree",
    status_calculated_at: calculatedAt,
    offline_delay_seconds: evaluation.offlineDelaySeconds,
    last_active_source_value: evaluation.lastActiveSourceValue,
  };
}

export function formatSelectedRule(rule: StatusCalibrationRule): string {
  if (rule.ruleType === "explicit_online_field") return "explicit_online_field";
  return `lastactivetime_${rule.lastActiveTimeUnit ?? "milliseconds"}_offlinedelay_${rule.offlineDelayUnit ?? "seconds"}_threshold_${rule.thresholdSeconds ?? 600}`;
}

export function loadCalibratedRuleFromSummary(
  summary: Record<string, unknown>,
): StatusCalibrationRule | null {
  const selectedRule = summary.selectedRule;
  if (!selectedRule || typeof selectedRule !== "object") return null;
  const rule = selectedRule as Record<string, unknown>;
  if (rule.ruleType === "explicit_online_field") {
    return { ruleType: "explicit_online_field" };
  }
  if (rule.ruleType === "lastactivetime_threshold") {
    return {
      ruleType: "lastactivetime_threshold",
      lastActiveTimeUnit: rule.lastActiveTimeUnit as "milliseconds" | "seconds" | undefined,
      offlineDelayUnit: rule.offlineDelayUnit as "seconds" | "minutes" | "milliseconds" | undefined,
      thresholdSeconds: typeof rule.thresholdSeconds === "number" ? rule.thresholdSeconds : undefined,
    };
  }
  return null;
}

export { STATUS_BOOTSTRAP_SUMMARY_FILE };
