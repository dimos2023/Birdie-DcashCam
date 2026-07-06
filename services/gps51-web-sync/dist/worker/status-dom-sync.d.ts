import type { SupabaseClient } from "@supabase/supabase-js";
import type { BrowserContext, Page } from "playwright";
import type { AppConfig } from "../config.js";
import type { Logger } from "../logger.js";
import { extractDomStatusSets } from "../browser/status-dom-extractor.js";
export type StatusDomSyncMode = "dry" | "sync";
export declare class StatusDomSyncError extends Error {
    constructor(message: string);
}
export declare function printDomSyncReport(extraction: Awaited<ReturnType<typeof extractDomStatusSets>>, databaseWrites: number): void;
export declare function runDomStatusExtractionOnPage(page: Page, inventoryIds: Set<string>, config: AppConfig): Promise<Awaited<ReturnType<typeof extractDomStatusSets>>>;
export declare function runStatusDomSync(sb: SupabaseClient | null, config: AppConfig, log: Logger, mode: StatusDomSyncMode, page?: Page, inventoryIds?: Set<string>): Promise<{
    validated: boolean;
    databaseWrites: number;
}>;
export declare function getOrCreateDedicatedStatusPage(context: BrowserContext, config: AppConfig): Promise<Page>;
