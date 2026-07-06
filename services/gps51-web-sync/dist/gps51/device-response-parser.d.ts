import type { NormalizedGps51Device } from "./types.js";
export declare function scoreJsonPayload(body: unknown, url: string, action?: string | null): number;
/** Generic parser — excludes alarm/auxiliary actions. Prefer parseDeviceTree for inventory. */
export declare function parseDevicesFromPayload(payload: unknown, url?: string): NormalizedGps51Device[];
export declare function pickBestDeviceListPayload(candidates: Array<{
    score: number;
    sanitizedBody: unknown;
    action?: string | null;
}>): unknown;
