import type { Page } from "playwright";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppConfig } from "../config.js";
import type { Logger } from "../logger.js";
import { normalizeTreeStatusExtraction, type TreeStatusReconciliation } from "../gps51/status-tree-extract.js";
import type { ModelPortalCounts } from "../gps51/status-model-reconciliation.js";
export declare const STATUS_TREE_SYNC_SUMMARY_FILE = "status-tree-sync-summary.json";
export type StatusTreeSyncMode = "dry" | "sync";
export declare class StatusTreeSyncError extends Error {
    constructor(message: string);
}
export type TreeStatusExtractionResult = {
    extraction: ReturnType<typeof normalizeTreeStatusExtraction>;
    reconciliation: TreeStatusReconciliation;
    portalCounts: ModelPortalCounts;
    inventoryCount: number;
};
export type InventorySource = {
    deviceIds: string[];
    source: "querydevicestree" | "database";
    duplicateIds: string[];
};
export declare function extractTreeStatusOnPage(page: Page, inventoryIds: Set<string>, config: AppConfig): Promise<TreeStatusExtractionResult>;
export declare function buildTreeSyncSummary(input: {
    status: "success" | "failed";
    mode: StatusTreeSyncMode;
    portalCounts: ModelPortalCounts | null;
    reconciliation: TreeStatusReconciliation | null;
    inventoryCount: number;
    inventorySource: InventorySource["source"] | null;
    databaseWrites: number;
    componentPath: string | null;
    extractionError: string | null;
    malformedNodeCount: number;
    errorMessage?: string | null;
}): Record<string, unknown>;
export declare function collectInventorySourceFromPayload(payload: unknown): InventorySource;
export declare function printTreeSyncReport(summary: Record<string, unknown>): void;
export declare function loadInventoryIdsFromDatabase(sb: SupabaseClient, accountId: string): Promise<Set<string>>;
export declare function loadInventorySourceFromQueryDeviceTree(page: Page, config: AppConfig): Promise<InventorySource>;
export declare function writeValidatedTreeStatus(sb: SupabaseClient, config: AppConfig, log: Logger, inventory: InventorySource, result: TreeStatusExtractionResult): Promise<{
    databaseWrites: number;
    changedDeviceCount: number;
}>;
export declare function runStatusTreeSync(sb: SupabaseClient | null, config: AppConfig, log: Logger, mode: StatusTreeSyncMode, page?: Page, inventoryIds?: Set<string>): Promise<{
    validated: boolean;
    databaseWrites: number;
    changedDeviceCount: number;
}>;
