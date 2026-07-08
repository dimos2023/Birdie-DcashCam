import type { BrowserContext, Page } from "playwright";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppConfig } from "../config.js";
import type { Logger } from "../logger.js";
import { collectInventorySourceFromPayload } from "./status-tree-sync.js";
export declare const POSITION_CACHE_SYNC_SUMMARY_FILE = "position-cache-sync-summary.json";
export type PositionCacheSyncMode = "dry" | "sync";
export declare class PositionCacheSyncError extends Error {
    constructor(message: string);
}
export type PositionCacheSyncStats = {
    inventoryCount: number;
    devicesAttempted: number;
    cacheHitsBeforeSelection: number;
    positionsReceivedAfterSelection: number;
    validPositions: number;
    invalidPositions: number;
    missingPositions: number;
    duplicatePositions: number;
    onlineDevicesWithPosition: number;
    offlineDevicesWithPosition: number;
    databaseWrites: number;
    validated: boolean;
    validationReasons: string[];
};
export declare function buildPositionCacheSyncSummary(stats: PositionCacheSyncStats & {
    generatedAt?: string;
}): Record<string, unknown>;
export declare function printPositionCacheSyncReport(summary: Record<string, unknown>): void;
export declare function runPositionCacheSync(sb: SupabaseClient | null, config: AppConfig, log: Logger, mode: PositionCacheSyncMode, page?: Page, inventoryIds?: Set<string>, options?: {
    context?: BrowserContext;
    onCurrentDevice?: (deviceId: string | null) => void;
}): Promise<PositionCacheSyncStats>;
export { collectInventorySourceFromPayload };
