import type { ParsedPositionLast } from "./position-last-parser.js";
export declare const GPS51_MAP_CACHE_SOURCE = "GPS51 Web Map Cache";
export declare function buildCachePositionFingerprint(organizationId: string, gps51DeviceId: string, position: ParsedPositionLast): string;
export declare function buildCacheDedupeKey(organizationId: string, gps51DeviceId: string, position: ParsedPositionLast): string;
export declare function isDuplicateCachePosition(seenKeys: Set<string>, organizationId: string, gps51DeviceId: string, position: ParsedPositionLast): boolean;
export declare function positionTimestampMs(position: ParsedPositionLast): number;
export declare function isStaleCachePosition(position: ParsedPositionLast, storedLatestMs: number | null | undefined): boolean;
