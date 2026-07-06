import type { NormalizedGps51Device, ParseSource } from "./types.js";
export declare function normalizeDeviceRecord(record: Record<string, unknown>, source: ParseSource): NormalizedGps51Device;
export declare function dedupeDevices(devices: NormalizedGps51Device[]): NormalizedGps51Device[];
export declare function collectRecordArrays(payload: unknown): Record<string, unknown>[];
