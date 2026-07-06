import type { AppConfig } from "../config.js";
import type { Logger } from "../logger.js";
import type { SyncCycleResult } from "./sync-cycle.js";
export declare function getSchedulerState(): {
    lastSyncAt: string | null;
    lastSyncStatus: string | null;
    lastError: string | null;
    backoffMs: number;
    running: boolean;
};
export declare function startScheduler(config: AppConfig, log: Logger, runCycle: () => Promise<SyncCycleResult>): () => void;
