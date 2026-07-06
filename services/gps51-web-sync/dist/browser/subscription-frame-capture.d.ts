import type { Page } from "playwright";
export type CapturedWsFrame = {
    direction: "incoming" | "outgoing";
    capturedAt: string;
    payload: unknown;
    kind: "positionLast" | "remindMsg" | "other" | "non-json";
};
export type SubscriptionActionCapture = {
    action: string;
    startedAt: string;
    finishedAt: string;
    outgoingFrames: CapturedWsFrame[];
    incomingFrames: CapturedWsFrame[];
    positionLastCount: number;
    selectedDeviceCountHint: number | null;
};
export declare class SubscriptionFrameCapture {
    private sockets;
    private outgoing;
    private incoming;
    private positionLastCount;
    attach(page: Page): () => void;
    beginAction(): void;
    snapshotAction(action: string, selectedDeviceCountHint: number | null): SubscriptionActionCapture;
    getOpenSocketCount(): number;
    private pushFrame;
}
