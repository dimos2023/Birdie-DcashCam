"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActionContext } from "@/lib/actions/context";
import { logAuditEvent } from "@/lib/auth/audit";
import {
  vehicleSchema,
  parseFormData,
  emptyToNull,
} from "@/lib/validations/crud";
import type { DeleteResult } from "@/lib/actions/types";

export async function createVehicle(formData: FormData) {
  const ctx = await getActionContext();
  const parsed = parseFormData(vehicleSchema, formData);

  if (!parsed.success) {
    redirect(`/vehicles/new?error=${encodeURIComponent(parsed.error)}`);
  }

  const data = parsed.data;
  const supabase = await createClient();

  const { data: row, error } = await supabase
    .from("vehicles")
    .insert({
      organization_id: ctx.organizationId,
      customer_id: emptyToNull(data.customer_id),
      plate_number: data.plate_number,
      make: emptyToNull(data.brand),
      model: emptyToNull(data.model),
      year: typeof data.year === "number" ? data.year : null,
      color: emptyToNull(data.color),
      status: data.status,
    })
    .select("id")
    .single();

  if (error) {
    redirect(`/vehicles/new?error=${encodeURIComponent(error.message)}`);
  }

  await logAuditEvent({
    organizationId: ctx.organizationId,
    userId: ctx.userId ?? undefined,
    action: "create",
    entityType: "vehicle",
    entityId: row.id,
  });

  revalidatePath("/vehicles");
  redirect(`/vehicles/${row.id}`);
}

export async function updateVehicle(id: string, formData: FormData) {
  const ctx = await getActionContext();
  const parsed = parseFormData(vehicleSchema, formData);

  if (!parsed.success) {
    redirect(`/vehicles/${id}/edit?error=${encodeURIComponent(parsed.error)}`);
  }

  const data = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("vehicles")
    .update({
      customer_id: emptyToNull(data.customer_id),
      plate_number: data.plate_number,
      make: emptyToNull(data.brand),
      model: emptyToNull(data.model),
      year: typeof data.year === "number" ? data.year : null,
      color: emptyToNull(data.color),
      status: data.status,
    })
    .eq("id", id);

  if (error) {
    redirect(`/vehicles/${id}/edit?error=${encodeURIComponent(error.message)}`);
  }

  await logAuditEvent({
    organizationId: ctx.organizationId,
    userId: ctx.userId ?? undefined,
    action: "update",
    entityType: "vehicle",
    entityId: id,
  });

  revalidatePath("/vehicles");
  revalidatePath(`/vehicles/${id}`);
  redirect(`/vehicles/${id}`);
}

export async function deleteVehicle(id: string): Promise<DeleteResult> {
  const ctx = await getActionContext();
  const supabase = await createClient();

  const { error: unlinkError } = await supabase
    .from("vehicle_devices")
    .delete()
    .eq("vehicle_id", id);

  if (unlinkError) {
    return {
      success: false,
      error: `Could not remove device assignments: ${unlinkError.message}`,
    };
  }

  const { error } = await supabase.from("vehicles").delete().eq("id", id);

  if (error) {
    const message = error.message.toLowerCase();
    if (
      message.includes("foreign key") ||
      message.includes("vehicle_locations") ||
      message.includes("camera_streams")
    ) {
      return {
        success: false,
        error:
          "This vehicle cannot be deleted because it has location history or camera streams. Remove related records first or contact an administrator.",
      };
    }
    return { success: false, error: error.message };
  }

  await logAuditEvent({
    organizationId: ctx.organizationId,
    userId: ctx.userId ?? undefined,
    action: "delete",
    entityType: "vehicle",
    entityId: id,
  });

  revalidatePath("/vehicles");
  return { success: true };
}
