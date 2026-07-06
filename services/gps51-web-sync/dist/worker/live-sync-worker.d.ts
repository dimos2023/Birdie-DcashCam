import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppConfig } from "../config.js";
import type { Logger } from "../logger.js";
export type LiveSyncMode = "dry" | "once" | "continuous";
export declare class LiveReauthRequiredError extends Error {
    constructor();
}
export type LiveDryRunStats = {
    deviceCount: number;
    validPositions: number;
    duplicates: number;
    parsingErrors: number;
    rejected: number;
    remindMsgCount: number;
    uniqueDevicesSeen: number;
};
export declare function runLiveSyncWorker(sb: SupabaseClient | null, config: AppConfig, log: Logger, mode: LiveSyncMode): Promise<LiveDryRunStats | void>;
