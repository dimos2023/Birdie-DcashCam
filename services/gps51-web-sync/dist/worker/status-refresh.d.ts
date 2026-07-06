import type { BrowserContext, Page } from "playwright";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppConfig } from "../config.js";
import type { Logger } from "../logger.js";
export type StatusRefreshResult = {
    refreshed: boolean;
    updated: number;
    changedDeviceCount: number;
    deviceCount: number;
    online: number;
    offline: number;
    unknown: number;
    reason?: string;
};
export declare function refreshTreeStatusesFromDedicatedPage(context: BrowserContext, sb: SupabaseClient, accountId: string, config: AppConfig, log: Logger, statusPageRef: {
    page: Page | null;
}, inventoryIds: Set<string>): Promise<StatusRefreshResult>;
export { loadInventoryIdsForRefresh } from "./status-refresh-inventory.js";
