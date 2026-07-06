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
export declare function parseAlarmPayload(payload: unknown): ParsedAlarmRecord[];
export declare function summarizeAlarmPayload(payload: unknown): {
    recordCount: number;
    sample: ParsedAlarmRecord[];
};
export declare function parseMediaPayload(payload: unknown): NormalizedGps51Device[];
