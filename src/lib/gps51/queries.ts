import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Gps51WebDeviceLive } from "@/lib/types";

export async function getGps51LiveDevices(
  organizationId: string
): Promise<{ devices: Gps51WebDeviceLive[]; error: string | null }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("gps51_web_device_live")
    .select("*")
    .eq("organization_id", organizationId)
    .order("device_name", { ascending: true, nullsFirst: false });

  if (error) {
    return { devices: [], error: error.message };
  }

  return { devices: (data ?? []) as Gps51WebDeviceLive[], error: null };
}
