import { collectRecordArrays, normalizeDeviceRecord } from "./normalizer.js";
import type { NormalizedGps51Device } from "./types.js";

/** Alarm/location records from queryalarm — not canonical device inventory. */
export type ParsedAlarmRecord = {
  kind: "alarm";
  sourceDeviceId: string | null;
  alarmType: string | null;
  latitude: number | null;
  longitude: number | null;
  speedKmh: number | null;
  recordedAt: string | null;
  address: string | null;
  raw: Record<string, unknown>;
};

export function parseAlarmPayload(payload: unknown): ParsedAlarmRecord[] {
  const records = collectRecordArrays(payload);
  return records.map((record) => {
    const normalized = normalizeDeviceRecord(record, "network");
    return {
      kind: "alarm" as const,
      sourceDeviceId: normalized.sourceDeviceId === "unknown" ? null : normalized.sourceDeviceId,
      alarmType:
        typeof record.alarmtype === "string"
          ? record.alarmtype
          : typeof record.alarmType === "string"
            ? record.alarmType
            : typeof record.type === "string"
              ? record.type
              : null,
      latitude: normalized.latitude,
      longitude: normalized.longitude,
      speedKmh: normalized.speedKmh,
      recordedAt: normalized.sourceUpdatedAt,
      address: normalized.address,
      raw: record,
    };
  });
}

export function summarizeAlarmPayload(payload: unknown): {
  recordCount: number;
  sample: ParsedAlarmRecord[];
} {
  const records = parseAlarmPayload(payload);
  return {
    recordCount: records.length,
    sample: records.slice(0, 5),
  };
}

export function parseMediaPayload(payload: unknown): NormalizedGps51Device[] {
  return collectRecordArrays(payload)
    .map((r) => normalizeDeviceRecord(r, "network"))
    .filter((d) => d.sourceDeviceId !== "unknown");
}
