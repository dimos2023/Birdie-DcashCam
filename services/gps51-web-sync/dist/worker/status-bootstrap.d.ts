import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppConfig } from "../config.js";
import type { Logger } from "../logger.js";
import { compareBootstrapToPortal } from "../db/status-repository.js";
import { calibrateStatusRule, formatSelectedRule } from "../gps51/status-bootstrap-parser.js";
export type StatusBootstrapMode = "dry" | "sync";
export declare class StatusBootstrapError extends Error {
    constructor(message: string);
}
export type StatusBootstrapSummary = {
    portalCounts: {
        all: number | null;
        online: number | null;
        offline: number | null;
    };
    calculatedCounts: {
        total: number;
        online: number;
        offline: number;
        unknown: number;
    };
    selectedRule: ReturnType<typeof formatSelectedRule> | null;
    rule: ReturnType<typeof calibrateStatusRule>["selectedRule"];
    lastActiveTimeUnit: string | null;
    offlineDelayUnit: string | null;
    mismatchCount: number;
    onlineDelta: number;
    offlineDelta: number;
    devicesWithInvalidLastActiveTime: number;
    devicesWithInvalidOfflineDelay: number;
    duplicateDeviceIds: string[];
    generatedAt: string;
    deviceCount: number;
    validated: boolean;
    recommendedSource: string | null;
    timestampRuleRejected: boolean;
    note: string;
};
export declare function loadStatusSourceValidation(captureDir: string): {
    validated: boolean;
    recommendedSource: string | null;
    recommendedRule: string | null;
};
export declare function runStatusBootstrap(sb: SupabaseClient | null, config: AppConfig, log: Logger, mode: StatusBootstrapMode): Promise<StatusBootstrapSummary>;
export { compareBootstrapToPortal };
