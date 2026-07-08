import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedGps51Device } from "../gps51/types.js";
export type WebAccount = {
    id: string;
    organization_id: string;
    username: string;
    status: string;
};
export declare function ensureAccount(sb: SupabaseClient, organizationId: string, username: string, portalUrl: string, monitorUrl: string): Promise<WebAccount>;
export declare function markAccountReauth(sb: SupabaseClient, accountId: string, message: string): Promise<void>;
export declare function markAccountSynced(sb: SupabaseClient, accountId: string, status: string, error?: string | null): Promise<void>;
export declare function startSyncRun(sb: SupabaseClient, organizationId: string, accountId: string, mode?: "sync" | "discover" | "one_shot" | "live" | "status_bootstrap" | "status_tree" | "positions_tree" | "position_cache"): Promise<string>;
export declare function finishSyncRun(sb: SupabaseClient, runId: string, patch: {
    status: string;
    devices_visible?: number;
    devices_upserted?: number;
    positions_inserted?: number;
    parse_failures?: number;
    duration_ms?: number;
    error_message?: string | null;
    summary?: Record<string, unknown>;
}): Promise<void>;
export declare function upsertDevice(sb: SupabaseClient, organizationId: string, accountId: string, device: NormalizedGps51Device): Promise<string>;
export declare function insertPositionIfNew(sb: SupabaseClient, organizationId: string, accountId: string, gps51DeviceId: string, syncRunId: string, device: NormalizedGps51Device): Promise<boolean>;
export declare function saveRawPayload(sb: SupabaseClient, organizationId: string, accountId: string, syncRunId: string, payloadHash: string, sanitizedPayload: unknown, sourceUrl: string, payloadKind: string): Promise<void>;
