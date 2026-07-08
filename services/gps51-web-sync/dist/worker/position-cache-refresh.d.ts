import type { BrowserContext } from "playwright";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppConfig } from "../config.js";
import type { Logger } from "../logger.js";
export type PositionCacheRefreshResult = {
    refreshed: boolean;
    validPositions: number;
    devicesAttempted: number;
    cacheHits: number;
    reason?: string;
};
export declare function refreshPositionsFromDedicatedPage(context: BrowserContext, sb: SupabaseClient, config: AppConfig, log: Logger, positionPageRef: {
    page: import("playwright").Page | null;
}, inventoryIds: Set<string>): Promise<PositionCacheRefreshResult>;
