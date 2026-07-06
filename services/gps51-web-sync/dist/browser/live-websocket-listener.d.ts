import type { Page } from "playwright";
import type { ParsedPositionLast } from "../gps51/position-last-parser.js";
import type { Logger } from "../logger.js";
export declare const GPS51_LIVE_WEBSOCKET_PATH = "/wss/wss";
export type LiveFrameHandler = {
    onPositionLast: (position: ParsedPositionLast) => void | Promise<void>;
    onRemindMsg: (info: {
        deviceId: string | null;
        alarmCode: string | null;
    }) => void;
    onParseError: (reason: string) => void;
    onWebSocketConnect?: () => void | Promise<void>;
};
export declare function isGps51LiveWebSocketUrl(url: string): boolean;
export declare function attachLiveWebSocketListeners(page: Page, log: Logger, handler: LiveFrameHandler): () => void;
export declare function parseLiveWebSocketFrameForTest(payload: unknown): {
    kind: "positionLast" | "remindMsg" | "ignored";
    position?: ParsedPositionLast;
    remind?: {
        deviceId: string | null;
        alarmCode: string | null;
    };
    error?: string;
};
