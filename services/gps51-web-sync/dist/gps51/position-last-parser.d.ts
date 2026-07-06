export type ParsedPositionLast = {
    sourceDeviceId: string;
    sourcePositionId: number | null;
    latitude: number;
    longitude: number;
    sourceUpdatedAt: string;
    sourceLocatedAt: string | null;
    speedKmh: number | null;
    directionDeg: number | null;
    altitudeM: number | null;
    statusBits: number | null;
    alarmBits: number | null;
    statusText: string | null;
    signalStrength: number | null;
    satelliteCount: number | null;
    moving: boolean;
    accOn: boolean | null;
    positioned: boolean;
    rawPayload: Record<string, unknown>;
    accTextMismatch: boolean;
};
export type PositionLastParseResult = {
    ok: true;
    position: ParsedPositionLast;
} | {
    ok: false;
    reason: string;
};
export declare function parseEpochMilliseconds(value: unknown): number | null;
export declare function parseCoordinatePair(latRaw: number | null, lngRaw: number | null): {
    latitude: number;
    longitude: number;
} | null;
export declare function deriveAccOn(statusBits: number | null, statusText: string | null): {
    accOn: boolean | null;
    accTextMismatch: boolean;
};
export declare function derivePositioned(statusBits: number | null, hasValidCoords: boolean): boolean;
export declare function parsePositionLast(value: unknown): PositionLastParseResult;
export declare function parseWebsocketMessage(payload: unknown): {
    kind: "positionLast" | "remindMsg" | "ignored";
    data: unknown;
};
export declare function extractRemindMsgLogFields(value: unknown): {
    deviceId: string | null;
    alarmCode: string | null;
};
