import type { Page } from "playwright";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppConfig } from "../config.js";
import type { Logger } from "../logger.js";
import { type PositionInventoryExtraction } from "../gps51/position-source-extract.js";
import { type InventorySource } from "./status-tree-sync.js";
export declare const POSITIONS_TREE_SYNC_SUMMARY_FILE = "positions-tree-sync-summary.json";
export type PositionsTreeSyncMode = "dry" | "sync";
export declare class PositionsTreeSyncError extends Error {
    constructor(message: string);
}
export declare function extractPositionsOnPage(page: Page, inventoryIds: Set<string>): Promise<PositionInventoryExtraction>;
export declare function buildPositionsTreeSyncSummary(input: {
    status: "success" | "failed";
    mode: PositionsTreeSyncMode;
    inventoryCount: number;
    inventorySource: InventorySource["source"] | null;
    extraction: PositionInventoryExtraction | null;
    databaseWrites: number;
    duplicates: number;
    rejected: number;
    errorMessage?: string | null;
}): Record<string, unknown>;
export declare function printPositionsTreeSyncReport(summary: Record<string, unknown>): void;
export declare function writeValidatedTreePositions(sb: SupabaseClient, config: AppConfig, log: Logger, inventory: InventorySource, extraction: PositionInventoryExtraction): Promise<{
    databaseWrites: number;
    duplicates: number;
    rejected: number;
}>;
export declare function runPositionsTreeSync(sb: SupabaseClient | null, config: AppConfig, log: Logger, mode: PositionsTreeSyncMode, page?: Page, inventoryIds?: Set<string>): Promise<{
    validated: boolean;
    databaseWrites: number;
    validCoordinateCount: number;
}>;
