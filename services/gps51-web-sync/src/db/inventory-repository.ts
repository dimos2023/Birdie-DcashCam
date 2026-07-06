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

export function inventoryRowChanged(
  existing: ExistingInventoryDevice,
  incoming: InventoryDeviceRecord,
): boolean {
  const existingComparable = {
    device_name: existing.device_name,
    sim_no: existing.sim_no,
    group_path: existing.group_path,
    online_status: existing.online_status,
    source_updated_at: existing.source_updated_at,
    media_channels: existing.media_channels,
    metadata: existing.metadata,
  };
  const incomingComparable = {
    device_name: incoming.deviceName,
    sim_no: incoming.simNo,
    group_path: incoming.groupPath,
    online_status: incoming.onlineStatus,
    source_updated_at: incoming.sourceUpdatedAt,
    media_channels: incoming.mediaChannels,
    metadata: incoming.metadata,
  };
  return JSON.stringify(existingComparable) !== JSON.stringify(incomingComparable);
}

export function classifyUpsertOutcome(
  existing: ExistingInventoryDevice | undefined,
  incoming: InventoryDeviceRecord,
): UpsertOutcome {
  if (!existing) return "inserted";
  return inventoryRowChanged(existing, incoming) ? "updated" : "unchanged";
}

export function buildInventoryUpsertPayload(
  organizationId: string,
  accountId: string,
  device: InventoryDeviceRecord,
  scrapedAt: string,
): Record<string, unknown> {
  return {
    organization_id: organizationId,
    account_id: accountId,
    source_device_id: device.sourceDeviceId,
    device_name: device.deviceName,
    imei: null,
    sim_no: device.simNo,
    group_path: device.groupPath,
    online_status: device.onlineStatus,
    source_updated_at: device.sourceUpdatedAt,
    source_located_at: null,
    latitude: null,
    longitude: null,
    speed_kmh: null,
    acc_on: null,
    status_text: null,
    address: null,
    satellite_count: null,
    cellular_signal_percent: null,
    mileage_km: null,
    media_channels: device.mediaChannels,
    metadata: device.metadata,
    raw_snapshot: device.rawSnapshot,
    last_scraped_at: scrapedAt,
  };
}

export async function ensureInventoryAccount(
  sb: SupabaseClient,
  organizationId: string,
  username: string,
  portalUrl: string,
  monitorUrl: string,
): Promise<WebAccount> {
  const { data, error } = await sb
    .from("gps51_web_accounts")
    .upsert(
      {
        organization_id: organizationId,
        username,
        portal_url: portalUrl,
        monitor_url: monitorUrl,
        status: "active",
        last_auth_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,username,portal_url" },
    )
    .select("id, organization_id, username, status")
    .single();

  if (error) throw new Error(error.message);
  return data as WebAccount;
}

export async function fetchAccountInventoryDevices(
  sb: SupabaseClient,
  accountId: string,
): Promise<ExistingInventoryDevice[]> {
  const { data, error } = await sb
    .from("gps51_web_devices")
    .select(
      "id, source_device_id, device_name, sim_no, group_path, birdie_device_id, vehicle_id, customer_id, online_status, source_updated_at, media_channels, metadata, raw_snapshot",
    )
    .eq("account_id", accountId);

  if (error) throw new Error(error.message);
  return (data ?? []) as ExistingInventoryDevice[];
}

export async function upsertInventoryDevices(
  sb: SupabaseClient,
  organizationId: string,
  accountId: string,
  devices: InventoryDeviceRecord[],
  existingRows: ExistingInventoryDevice[],
): Promise<InventoryUpsertResult> {
  const existingBySourceId = new Map(existingRows.map((row) => [row.source_device_id, row]));
  const scrapedAt = new Date().toISOString();
  const result: InventoryUpsertResult = { inserted: 0, updated: 0, unchanged: 0, errors: [] };

  for (const device of devices) {
    const existing = existingBySourceId.get(device.sourceDeviceId);
    const outcome = classifyUpsertOutcome(existing, device);

    if (outcome === "unchanged") {
      await sb
        .from("gps51_web_devices")
        .update({ last_scraped_at: scrapedAt })
        .eq("id", existing!.id);
      result.unchanged += 1;
      continue;
    }

    const payload = buildInventoryUpsertPayload(organizationId, accountId, device, scrapedAt);
    const { error } = await sb
      .from("gps51_web_devices")
      .upsert(payload, { onConflict: "account_id,source_device_id" });

    if (error) {
      result.errors.push(`${device.sourceDeviceId}: ${error.message}`);
      continue;
    }

    if (outcome === "inserted") result.inserted += 1;
    else result.updated += 1;
  }

  return result;
}

export function buildInventoryReconciliation(
  summary: { detectedDeviceCount: number; uniqueDeviceCount: number },
  devices: InventoryDeviceRecord[],
  upsertResult: InventoryUpsertResult | null,
  databaseCount: number,
  startedAt: string,
  finishedAt: string,
  extraErrors: string[] = [],
): InventoryReconciliation {
  const devicesWithSimNo = devices.filter((d) => Boolean(d.simNo)).length;
  const devicesWithVideo = devices.filter((d) => d.mediaChannels.length > 0).length;

  return {
    gps51VisibleDevices: summary.detectedDeviceCount,
    parsedUniqueDevices: summary.uniqueDeviceCount,
    insertedDevices: upsertResult?.inserted ?? 0,
    updatedDevices: upsertResult?.updated ?? 0,
    unchangedDevices: upsertResult?.unchanged ?? 0,
    databaseDevicesAfterSync: databaseCount,
    devicesWithSimNo,
    devicesWithVideo,
    errors: [...extraErrors, ...(upsertResult?.errors ?? [])],
    startedAt,
    finishedAt,
  };
}

export function reconcileWithoutSync(
  summary: { detectedDeviceCount: number; uniqueDeviceCount: number },
  devices: InventoryDeviceRecord[],
  existingRows: ExistingInventoryDevice[],
  startedAt: string,
  finishedAt: string,
): InventoryReconciliation {
  const existingBySourceId = new Map(existingRows.map((row) => [row.source_device_id, row]));
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;

  for (const device of devices) {
    const existing = existingBySourceId.get(device.sourceDeviceId);
    const outcome = classifyUpsertOutcome(existing, device);
    if (outcome === "inserted") inserted += 1;
    else if (outcome === "updated") updated += 1;
    else unchanged += 1;
  }

  return buildInventoryReconciliation(
    summary,
    devices,
    { inserted, updated, unchanged, errors: [] },
    existingRows.length,
    startedAt,
    finishedAt,
  );
}

export function preservedLinksIntact(
  before: ExistingInventoryDevice[],
  after: ExistingInventoryDevice[],
): boolean {
  const beforeMap = new Map(before.map((row) => [row.source_device_id, row]));
  for (const row of after) {
    const prev = beforeMap.get(row.source_device_id);
    if (!prev) continue;
    if (prev.birdie_device_id && !row.birdie_device_id) return false;
    if (prev.vehicle_id && !row.vehicle_id) return false;
    if (prev.customer_id && !row.customer_id) return false;
  }
  return true;
}
