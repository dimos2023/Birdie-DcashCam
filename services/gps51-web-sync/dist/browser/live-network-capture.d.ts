import type { Page } from "playwright";
import type { RawLiveCapture } from "../gps51/live-state-analyzer.js";
export declare class LiveNetworkCapture {
    private captures;
    private wsOutgoingMeta;
    attach(page: Page): void;
    getCaptures(): RawLiveCapture[];
    getWebSocketOutgoingMetadata(): Array<{
        url: string;
        subscriptions: Record<string, unknown>[];
    }>;
    private attachWebSocket;
    private handleWebSocketFrame;
    private addPayload;
    private handleResponse;
}
export declare function hashPayload(payload: unknown): string;
export declare function observeLiveNetwork(page: Page, durationMs: number): Promise<void>;
