import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParsedPositionLast } from "../gps51/position-last-parser.js";
export type KnownDevice = {
    id: string;
    source_device_id: string;
    birdie_device_id: string | null;
    vehicle_id: string | null;
    customer_id: string | null;
    metadata: Record<string, unknown> | null;
    latest_source_updated_at: string | null;
};
export declare function fetchAccountByUsername(sb: SupabaseClient, organizationId: string, username: string, portalUrl: string): Promise<{
    id: string;
} | null>;
export declare function fetchKnownDevices(sb: SupabaseClient, accountId: string): Promise<KnownDevice[]>;
export declare function buildLatestUpdateMap(devices: KnownDevice[]): Map<string, number>;
export declare function buildDeviceLookup(devices: KnownDevice[]): Map<string, KnownDevice>;
export declare function insertLivePosition(sb: SupabaseClient, organizationId: string, accountId: string, syncRunId: string | null, device: KnownDevice, position: ParsedPositionLast): Promise<"inserted" | "duplicate" | "error">;
export declare function markDevicesOffline(sb: SupabaseClient, accountId: string, sourceDeviceIds: string[]): Promise<void>;
export declare function preservedLinksIntact(before: KnownDevice, after: KnownDevice): boolean;
export declare function buildTreePositionMetadata(existing: Record<string, unknown> | null, fieldPath: string): Record<string, unknown>;
export declare function insertTreePosition(sb: SupabaseClient, organizationId: string, accountId: string, syncRunId: string | null, device: KnownDevice, position: ParsedPositionLast, fieldPath: string): Promise<"inserted" | "duplicate" | "error">;
export declare function insertCachePosition(sb: SupabaseClient, organizationId: string, accountId: string, syncRunId: string | null, device: KnownDevice, position: ParsedPositionLast): Promise<"inserted" | "duplicate" | "error">;
