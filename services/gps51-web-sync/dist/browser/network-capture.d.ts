import type { Page } from "playwright";
export type CapturedResponse = {
    url: string;
    action: string | null;
    method: string;
    contentType: string | null;
    score: number;
    sanitizedBody: unknown;
    sanitizedRequest: unknown | null;
    capturedAt: string;
    payloadHash: string;
};
export type ActionCapture = {
    action: string;
    url: string;
    method: string;
    sanitizedResponse: unknown;
    sanitizedRequest: unknown | null;
    capturedAt: string;
};
export declare class NetworkCapture {
    private responses;
    private byAction;
    private pendingRequests;
    attach(page: Page): void;
    hasAction(action: string): boolean;
    getActionCapture(action: string): ActionCapture | undefined;
    getAllActionCaptures(): ActionCapture[];
    getCandidates(minScore?: number): CapturedResponse[];
    getAll(): CapturedResponse[];
    private requestKey;
    private handleRequest;
    private handleResponse;
}
export declare function waitForNetworkSettle(page: Page, timeoutMs: number): Promise<void>;
export declare function waitForDiscoverySignals(page: Page, capture: NetworkCapture, minObserveMs: number, idleTimeoutMs: number): Promise<void>;
