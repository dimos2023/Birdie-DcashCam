import type { Page } from "playwright";
import { type AppStatePathEntry } from "./status-dom-normalize.js";
export type AppStateProbeDiagnostics = {
    evaluateResultType: string;
    normalizedCandidateCount: number;
    inspectedPropertyCount: number;
    matchedInventoryIdCount: number;
    fallbackUsed: boolean;
    fallbackSucceeded: boolean;
};
export type AppStateFallbackResult = {
    used: boolean;
    source: string | null;
    onlineIds: string[];
    offlineIds: string[];
    allIds: string[];
    candidates: AppStatePathEntry[];
    matchedDeviceIds: string[];
    inspectedPropertyCount: number;
    reason: string | null;
    debug: Record<string, unknown>;
    diagnostics: AppStateProbeDiagnostics;
};
export declare function redactAppStateValue(key: string, value: unknown): unknown;
export declare function findInventoryIdsInUnknownValue(value: unknown, inventoryIds: Set<string>, depth?: number): string[];
export declare function buildAppStateProbeResult(input: {
    rawPaths: unknown;
    pathMatches: Array<{
        path: string;
        type: string;
        length: number;
        ids: string[];
    }>;
}): AppStateFallbackResult;
export declare function logAppStateProbeDiagnostics(diagnostics: AppStateProbeDiagnostics): void;
export declare function readAppStateValueAtPath(page: Page, path: string): Promise<unknown>;
export declare function probeAppStateDeviceSets(page: Page, inventoryIds: Set<string>): Promise<AppStateFallbackResult>;
export declare function captureAppStateTabDiff(page: Page, inventoryIds: Set<string>, beforePath: string | null): Promise<{
    onlineIds: string[];
    offlineIds: string[];
}>;
export declare function mergeDomDiscoveryValidationReasons(input: {
    reconciliationReasons: string[];
    containerReason: string | null;
    appStateReason: string | null;
}): string[];
