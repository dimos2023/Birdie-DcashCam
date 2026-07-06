import type { NormalizedGps51Device } from "./types.js";
export declare function parsePositionsFromPayloads(payloads: unknown[]): NormalizedGps51Device[];
export declare function hasPositionData(device: NormalizedGps51Device): boolean;
