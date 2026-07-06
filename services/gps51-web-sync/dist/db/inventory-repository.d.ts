import type { SupabaseClient } from "@supabase/supabase-js";
import type { InventoryDeviceRecord, InventoryReconciliation } from "../gps51/inventory-types.js";
import type { WebAccount } from "./repositories.js";
export type ExistingInventoryDevice = {
    id: string;
    source_device_id: string;
    device_name: string | null;
    sim_no: string | null;
    group_path: string | null;
    birdie_device_id: string | null;
    vehicle_id: string | null;
    customer_id: string | null;
    online_status: string;
    source_updated_at: string | null;
    media_channels: unknown;
    metadata: unknown;
    raw_snapshot: unknown;
};
export type UpsertOutcome = "inserted" | "updated" | "unchanged";
export type InventoryUpsertResult = {
    inserted: number;
    updated: number;
    unchanged: number;
    errors: string[];
};
export declare function inventoryRowChanged(existing: ExistingInventoryDevice, incoming: InventoryDeviceRecord): boolean;
export declare function classifyUpsertOutcome(existing: ExistingInventoryDevice | undefined, incoming: InventoryDeviceRecord): UpsertOutcome;
export declare function buildInventoryUpsertPayload(organizationId: string, accountId: string, device: InventoryDeviceRecord, scrapedAt: string): Record<string, unknown>;
export declare function ensureInventoryAccount(sb: SupabaseClient, organizationId: string, username: string, portalUrl: string, monitorUrl: string): Promise<WebAccount>;
export declare function fetchAccountInventoryDevices(sb: SupabaseClient, accountId: string): Promise<ExistingInventoryDevice[]>;
export declare function upsertInventoryDevices(sb: SupabaseClient, organizationId: string, accountId: string, devices: InventoryDeviceRecord[], existingRows: ExistingInventoryDevice[]): Promise<InventoryUpsertResult>;
export declare function buildInventoryReconciliation(summary: {
    detectedDeviceCount: number;
    uniqueDeviceCount: number;
}, devices: InventoryDeviceRecord[], upsertResult: InventoryUpsertResult | null, databaseCount: number, startedAt: string, finishedAt: string, extraErrors?: string[]): InventoryReconciliation;
export declare function reconcileWithoutSync(summary: {
    detectedDeviceCount: number;
    uniqueDeviceCount: number;
}, devices: InventoryDeviceRecord[], existingRows: ExistingInventoryDevice[], startedAt: string, finishedAt: string): InventoryReconciliation;
export declare function preservedLinksIntact(before: ExistingInventoryDevice[], after: ExistingInventoryDevice[]): boolean;
