import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppConfig } from "../config.js";
import type { Logger } from "../logger.js";
export type SyncCycleResult = {
    runId: string;
    status: string;
    devicesVisible: number;
    devicesUpserted: number;
    positionsInserted: number;
    parseFailures: number;
    reauthRequired: boolean;
    errorMessage: string | null;
};
export declare function runSyncCycle(sb: SupabaseClient, config: AppConfig, log: Logger): Promise<SyncCycleResult>;
