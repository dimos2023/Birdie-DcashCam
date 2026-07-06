import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParsedPositionLast } from "../gps51/position-last-parser.js";
import { buildWebsocketPositionMetadata } from "../gps51/offline-state-manager.js";

export type KnownDevice = {
  id: string;
  source_device_id: string;
  birdie_device_id: string | null;
  vehicle_id: string | null;
  customer_id: string | null;
  metadata: Record<string, unknown> | null;
  latest_source_updated_at: string | null;
};

export async function fetchAccountByUsername(
  sb: SupabaseClient,
  organizationId: string,
  username: string,
  portalUrl: string,
): Promise<{ id: string } | null> {
  const { data } = await sb
    .from("gps51_web_accounts")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("username", username)
    .eq("portal_url", portalUrl)
    .maybeSingle();
  return data ? { id: data.id as string } : null;
}

export async function fetchKnownDevices(
  sb: SupabaseClient,
  accountId: string,
): Promise<KnownDevice[]> {
  const { data, error } = await sb
    .from("gps51_web_devices")
    .select(
      "id, source_device_id, birdie_device_id, vehicle_id, customer_id, metadata, source_updated_at",
    )
    .eq("account_id", accountId);

  if (error) throw new Error(error.message);

  const devices = (data ?? []) as Array<{
    id: string;
    source_device_id: string;
    birdie_device_id: string | null;
    vehicle_id: string | null;
    customer_id: string | null;
    metadata: Record<string, unknown> | null;
    source_updated_at: string | null;
  }>;

  const latestMap = new Map<string, string | null>();
  const { data: latestRows } = await sb
    .from("gps51_web_latest_positions")
    .select("gps51_device_id, source_updated_at")
    .eq("account_id", accountId);

  for (const row of latestRows ?? []) {
    latestMap.set(row.gps51_device_id as string, row.source_updated_at as string | null);
  }

  return devices.map((device) => ({
    id: device.id,
    source_device_id: device.source_device_id,
    birdie_device_id: device.birdie_device_id,
    vehicle_id: device.vehicle_id,
    customer_id: device.customer_id,
    metadata: device.metadata,
    latest_source_updated_at:
      latestMap.get(device.id) ?? device.source_updated_at ?? null,
  }));
}

export function buildLatestUpdateMap(devices: KnownDevice[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const device of devices) {
    if (!device.latest_source_updated_at) continue;
    const ms = Date.parse(device.latest_source_updated_at);
    if (Number.isFinite(ms)) map.set(device.source_device_id, ms);
  }
  return map;
}

export function buildDeviceLookup(devices: KnownDevice[]): Map<string, KnownDevice> {
  return new Map(devices.map((d) => [d.source_device_id, d]));
}

export async function insertLivePosition(
  sb: SupabaseClient,
  organizationId: string,
  accountId: string,
  syncRunId: string | null,
  device: KnownDevice,
  position: ParsedPositionLast,
): Promise<"inserted" | "duplicate" | "error"> {
  const { error } = await sb.from("gps51_web_positions").insert({
    organization_id: organizationId,
    account_id: accountId,
    gps51_device_id: device.id,
    sync_run_id: syncRunId,
    source_position_id: position.sourcePositionId,
    source_updated_at: position.sourceUpdatedAt,
    source_located_at: position.sourceLocatedAt,
    latitude: position.latitude,
    longitude: position.longitude,
    speed_kmh: position.speedKmh,
    acc_on: position.accOn,
    online_status: "online",
    status_text: position.statusText,
    satellite_count: position.satelliteCount,
    cellular_signal_percent: position.signalStrength,
    altitude_m: position.altitudeM,
    direction_deg: position.directionDeg,
    status_bits: position.statusBits,
    alarm_bits: position.alarmBits,
    positioned: position.positioned,
    moving: position.moving,
    raw_payload: position.rawPayload,
  });

  if (error) {
    if (error.code === "23505") return "duplicate";
    throw new Error(error.message);
  }

  const mergedMetadata = buildWebsocketPositionMetadata(device.metadata);

  const { error: deviceError } = await sb
    .from("gps51_web_devices")
    .update({
      online_status: "online",
      last_seen_at: position.sourceUpdatedAt,
      last_scraped_at: new Date().toISOString(),
      latitude: position.latitude,
      longitude: position.longitude,
      speed_kmh: position.speedKmh,
      acc_on: position.accOn,
      status_text: position.statusText,
      satellite_count: position.satelliteCount,
      cellular_signal_percent: position.signalStrength,
      source_updated_at: position.sourceUpdatedAt,
      source_located_at: position.sourceLocatedAt,
      metadata: mergedMetadata,
    })
    .eq("id", device.id);

  if (deviceError) throw new Error(deviceError.message);
  return "inserted";
}

export async function markDevicesOffline(
  sb: SupabaseClient,
  accountId: string,
  sourceDeviceIds: string[],
): Promise<void> {
  if (sourceDeviceIds.length === 0) return;

  const { error } = await sb
    .from("gps51_web_devices")
    .update({
      online_status: "offline",
      last_scraped_at: new Date().toISOString(),
    })
    .eq("account_id", accountId)
    .in("source_device_id", sourceDeviceIds)
    .eq("online_status", "online");

  if (error) throw new Error(error.message);
}

export function preservedLinksIntact(before: KnownDevice, after: KnownDevice): boolean {
  if (before.birdie_device_id && !after.birdie_device_id) return false;
  if (before.vehicle_id && !after.vehicle_id) return false;
  if (before.customer_id && !after.customer_id) return false;
  return true;
}
