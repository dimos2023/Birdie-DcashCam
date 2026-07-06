import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchKnownDevices } from "../db/live-position-repository.js";

export async function loadInventoryIdsForRefresh(
  sb: SupabaseClient,
  accountId: string,
): Promise<Set<string>> {
  const devices = await fetchKnownDevices(sb, accountId);
  return new Set(devices.map((device) => device.source_device_id));
}
