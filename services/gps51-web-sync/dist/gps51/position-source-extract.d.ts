import { type ParsedPositionLast } from "./position-last-parser.js";
export declare const POSITION_SOURCE_PRIORITY: readonly ["device_list_tree_nodes", "map_component_state", "xhr_fetch", "websocket_positionLast"];
export type PositionSourceKind = (typeof POSITION_SOURCE_PRIORITY)[number];
export type PositionFieldMatch = {
    path: string;
    count: number;
};
export type PositionCandidate = {
    source: PositionSourceKind;
    fieldPath: string;
    deviceId: string;
    latitude: number;
    longitude: number;
    speed: number | null;
    gpsTimestamp: string | null;
    updateTimestamp: string | null;
    sourcePositionId: number | null;
    componentPath: string | null;
    raw: Record<string, unknown>;
};
export type PositionSourceInspection = {
    selectedDeviceId: string | null;
    treeNodeBefore: Record<string, unknown> | null;
    treeNodeAfter: Record<string, unknown> | null;
    candidates: PositionCandidate[];
    mapComponentPaths: string[];
    cacheMgrFound: boolean;
    error: string | null;
};
export type PositionSourceRecommendation = {
    positionSource: PositionSourceKind | null;
    positionFieldPath: string | null;
    candidate: PositionCandidate | null;
    validated: boolean;
    validationReasons: string[];
};
export type PositionInventoryExtraction = {
    source: PositionSourceKind | null;
    fieldPath: string | null;
    componentPath: string | null;
    positions: ParsedPositionLast[];
    validDeviceIds: string[];
    invalidDeviceIds: string[];
    missingDeviceIds: string[];
    error: string | null;
};
export declare function resolveCoordinatesFromRecord(record: Record<string, unknown>): {
    latitude: number;
    longitude: number;
} | null;
export declare function resolveTimestampsFromRecord(record: Record<string, unknown>): {
    gpsTimestamp: string | null;
    updateTimestamp: string | null;
};
export declare function validatePositionCandidate(candidate: PositionCandidate, selectedDeviceId: string): {
    ok: true;
} | {
    ok: false;
    reasons: string[];
};
export declare function candidateFromRecord(source: PositionSourceKind, fieldPath: string, record: Record<string, unknown>, componentPath?: string | null): PositionCandidate | null;
export declare function recommendPositionSource(candidates: PositionCandidate[], selectedDeviceId: string): PositionSourceRecommendation;
export declare function parsedPositionFromCandidate(candidate: PositionCandidate): ParsedPositionLast | null;
export declare function collectPositionFieldMatches(fieldCounts: Record<string, number>): Record<string, PositionFieldMatch[]>;
export declare function extractNetworkPositionCandidates(payloads: Array<{
    action: string | null;
    body: unknown;
}>, selectedDeviceId: string): PositionCandidate[];
export declare function normalizePositionSourceInspection(raw: unknown): PositionSourceInspection;
export declare function buildPositionSourceInspectScript(selectedDeviceId: string): string;
export declare function buildPositionExtractAllScript(inventorySample: string[]): string;
export declare function normalizePositionInventoryExtraction(raw: unknown, inventoryIds: Set<string>): PositionInventoryExtraction;
