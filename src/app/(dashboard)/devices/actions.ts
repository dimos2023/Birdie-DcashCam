"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActionContext } from "@/lib/actions/context";
import { logAuditEvent } from "@/lib/auth/audit";
import {
  deviceSchema,
  parseFormData,
  emptyToNull,
  dateOrNull,
} from "@/lib/validations/crud";
import type { DeleteResult } from "@/lib/actions/types";

export async function createDevice(formData: FormData) {
  const ctx = await getActionContext();
  const parsed = parseFormData(deviceSchema, formData);

  if (!parsed.success) {
    redirect(`/devices/new?error=${encodeURIComponent(parsed.error)}`);
  }

  const data = parsed.data;
  const supabase = await createClient();

  const { data: row, error } = await supabase
    .from("devices")
    .insert({
      organization_id: ctx.organizationId,
      device_model_id: emptyToNull(data.device_model_id),
      serial_number: data.serial_number,
      imei: emptyToNull(data.imei),
      sim_number: emptyToNull(data.sim_number),
      status: data.status,
      activation_date: dateOrNull(data.activation_date),
      warranty_start: dateOrNull(data.warranty_start),
      warranty_end: dateOrNull(data.warranty_end),
    })
    .select("id")
    .single();

  if (error) {
    redirect(`/devices/new?error=${encodeURIComponent(error.message)}`);
  }

  await logAuditEvent({
    organizationId: ctx.organizationId,
    userId: ctx.userId ?? undefined,
    action: "create",
    entityType: "device",
    entityId: row.id,
  });

  revalidatePath("/devices");
  redirect(`/devices/${row.id}`);
}

export async function updateDevice(id: string, formData: FormData) {
  const ctx = await getActionContext();
  const parsed = parseFormData(deviceSchema, formData);

  if (!parsed.success) {
    redirect(`/devices/${id}/edit?error=${encodeURIComponent(parsed.error)}`);
  }

  const data = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("devices")
    .update({
      device_model_id: emptyToNull(data.device_model_id),
      serial_number: data.serial_number,
      imei: emptyToNull(data.imei),
      sim_number: emptyToNull(data.sim_number),
      status: data.status,
      activation_date: dateOrNull(data.activation_date),
      warranty_start: dateOrNull(data.warranty_start),
      warranty_end: dateOrNull(data.warranty_end),
    })
    .eq("id", id);

  if (error) {
    redirect(`/devices/${id}/edit?error=${encodeURIComponent(error.message)}`);
  }

  await logAuditEvent({
    organizationId: ctx.organizationId,
    userId: ctx.userId ?? undefined,
    action: "update",
    entityType: "device",
    entityId: id,
  });

  revalidatePath("/devices");
  revalidatePath(`/devices/${id}`);
  redirect(`/devices/${id}`);
}

export async function deleteDevice(id: string): Promise<DeleteResult> {
  const ctx = await getActionContext();
  const supabase = await createClient();

  const { error: unlinkError } = await supabase
    .from("vehicle_devices")
    .delete()
    .eq("device_id", id);

  if (unlinkError) {
    return {
      success: false,
      error: `Could not remove vehicle assignments: ${unlinkError.message}`,
    };
  }

  const { error } = await supabase.from("devices").delete().eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  await logAuditEvent({
    organizationId: ctx.organizationId,
    userId: ctx.userId ?? undefined,
    action: "delete",
    entityType: "device",
    entityId: id,
  });

  revalidatePath("/devices");
  return { success: true };
}
