export type SubscriptionDiscoverySummary = {
    status: "success" | "error";
    startedAt: string;
    finishedAt: string;
    selectedHint: number | null;
    outgoingFrameCount: number;
    incomingFrameCount: number;
    errorMessage: string | null;
    websocketSocketsSeen?: number;
    portalCounts?: {
        all: number | null;
        online: number | null;
        offline: number | null;
    };
    actions?: Array<{
        action: string;
        outgoingFrameCount: number;
        incomingFrameCount: number;
        positionLastCount: number;
        selectedDeviceCountHint: number | null;
        topOutgoingKinds: Record<string, number>;
    }>;
    recommendedAction?: string | null;
    recommendedFrame?: Record<string, unknown> | null;
    deviceIdField?: string;
    note?: string;
};
export declare function runSubscriptionDiscovery(): Promise<void>;
