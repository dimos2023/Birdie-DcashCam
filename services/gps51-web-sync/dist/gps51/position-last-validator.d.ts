import type { ParsedPositionLast } from "./position-last-parser.js";
export type PositionValidationContext = {
    knownDeviceIds: Set<string>;
    latestSourceUpdatedAtMs: Map<string, number>;
    nowMs?: number;
    maxFutureMs?: number;
};
export type PositionValidationResult = {
    ok: true;
    position: ParsedPositionLast;
} | {
    ok: false;
    reason: string;
};
export declare function validatePositionLast(position: ParsedPositionLast, ctx: PositionValidationContext): PositionValidationResult;
export declare function isDuplicatePositionId(seenKeys: Set<string>, position: ParsedPositionLast): boolean;
