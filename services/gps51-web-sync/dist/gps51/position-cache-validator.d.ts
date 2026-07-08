import type { ParsedPositionLast } from "./position-last-parser.js";
export type CachePositionValidationResult = {
    ok: true;
    position: ParsedPositionLast;
} | {
    ok: false;
    reason: string;
};
export declare function validateCachePositionCoordinates(position: ParsedPositionLast, inventoryIds: Set<string>): CachePositionValidationResult;
