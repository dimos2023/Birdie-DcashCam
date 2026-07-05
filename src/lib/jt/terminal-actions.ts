"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActionContext } from "@/lib/actions/context";
import { z } from "zod";

const jtTerminalSchema = z.object({
  device_id: z.string().uuid(),
  terminal_no: z.string().regex(/^[0-9]{1,20}$/),
  media_sim_no: z.string().regex(/^[0-9]{1,12}$/).optional().or(z.literal("")),
  imei: z.string().optional().or(z.literal("")),
  terminal_id_code: z.string().optional().or(z.literal("")),
  manufacturer_id: z.string().optional().or(z.literal("")),
  protocol_version: z.enum(["auto", "2011", "2019"]).default("auto"),
  timezone_offset_minutes: z.coerce.number().int().min(-720).max(840).default(180),
  allow_auto_registration: z.coerce.boolean().default(false),
  is_enabled: z.coerce.boolean().default(true),
  expected_video_channels: z.coerce.number().int().min(0).max(64).optional(),
  vehicle_id: z.string().uuid().optional().or(z.literal("")),
  display_name: z.string().optional().or(z.literal("")),
});

export async function upsertJtTerminal(formData: FormData) {
  const ctx = await getActionContext();
  const supabase = await createClient();

  const raw = Object.fromEntries(formData.entries());
  const parsed = jtTerminalSchema.safeParse({
    ...raw,
    allow_auto_registration: raw.allow_auto_registration === "on" || raw.allow_auto_registration === "true",
    is_enabled: raw.is_enabled !== "off" && raw.is_enabled !== "false",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid JT terminal data" };
  }

  const data = parsed.data;

  const { data: device } = await supabase
    .from("devices")
    .select("id, customer_id, organization_id")
    .eq("id", data.device_id)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();

  if (!device) return { error: "Device not found" };

  const payload = {
    organization_id: ctx.organizationId,
    device_id: data.device_id,
    customer_id: device.customer_id,
    vehicle_id: data.vehicle_id || null,
    display_name: data.display_name || null,
    terminal_no: data.terminal_no,
    media_sim_no: data.media_sim_no || null,
    imei: data.imei || null,
    terminal_id_code: data.terminal_id_code || null,
    manufacturer_id: data.manufacturer_id || null,
    protocol_version: data.protocol_version,
    timezone_offset_minutes: data.timezone_offset_minutes,
    allow_auto_registration: data.allow_auto_registration,
    is_enabled: data.is_enabled,
    expected_video_channels: data.expected_video_channels ?? 3,
  };

  const { data: existing } = await supabase
    .from("jt_terminals")
    .select("id")
    .eq("device_id", data.device_id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("jt_terminals").update(payload).eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("jt_terminals").insert(payload);
    if (error) return { error: error.message };
  }

  revalidatePath(`/devices/${data.device_id}/edit`);
  revalidatePath("/live-monitoring");
  return { success: true };
}
