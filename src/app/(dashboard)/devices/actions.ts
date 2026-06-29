"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActionContext } from "@/lib/actions/context";
import { syncDeviceVehicleAssignment } from "@/lib/actions/device-assignment";
import { logAuditEvent } from "@/lib/auth/audit";
import {
  deviceSchema,
  parseFormData,
  emptyToNull,
  dateOrNull,
} from "@/lib/validations/crud";
import type { DeleteResult } from "@/lib/actions/types";

async function validateVehicleForCustomer(
  supabase: Awaited<ReturnType<typeof createClient>>,
  vehicleId: string,
  customerId: string
): Promise<string | null> {
  const { data: vehicle, error } = await supabase
    .from("vehicles")
    .select("customer_id")
    .eq("id", vehicleId)
    .maybeSingle();

  if (error) {
    console.error("Validate vehicle for customer failed:", error);
    return error.message;
  }

  if (!vehicle) {
    return "Selected vehicle was not found";
  }

  if (vehicle.customer_id !== customerId) {
    return "Selected vehicle does not belong to the chosen customer";
  }

  return null;
}

export async function createDevice(formData: FormData) {
  const ctx = await getActionContext();
  const parsed = parseFormData(deviceSchema, formData);

  if (!parsed.success) {
    redirect(`/devices/new?error=${encodeURIComponent(parsed.error)}`);
  }

  const data = parsed.data;
  const vehicleId = emptyToNull(data.vehicle_id);
  const supabase = await createClient();

  if (vehicleId) {
    const vehicleError = await validateVehicleForCustomer(
      supabase,
      vehicleId,
      data.customer_id
    );
    if (vehicleError) {
      redirect(`/devices/new?error=${encodeURIComponent(vehicleError)}`);
    }
  }

  const payload = {
    organization_id: ctx.organizationId,
    customer_id: data.customer_id,
    device_model_id: emptyToNull(data.device_model_id),
    serial_number: data.serial_number,
    imei: emptyToNull(data.imei),
    sim_number: emptyToNull(data.sim_number),
    status: data.status,
    activation_date: dateOrNull(data.activation_date),
    warranty_start: dateOrNull(data.warranty_start),
    warranty_end: dateOrNull(data.warranty_end),
  };

  const { data: row, error } = await supabase
    .from("devices")
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error("Create device failed:", error);
    redirect(`/devices/new?error=${encodeURIComponent(error.message)}`);
  }

  if (!row?.id) {
    console.error("Create device failed: no row returned", row);
    redirect(
      `/devices/new?error=${encodeURIComponent("Device was not saved to database")}`
    );
  }

  if (vehicleId) {
    const assignmentResult = await syncDeviceVehicleAssignment(
      supabase,
      row.id,
      vehicleId,
      data.status
    );
    if (assignmentResult.error) {
      redirect(`/devices/new?error=${encodeURIComponent(assignmentResult.error)}`);
    }
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
  const vehicleId = emptyToNull(data.vehicle_id);
  const supabase = await createClient();

  if (vehicleId) {
    const vehicleError = await validateVehicleForCustomer(
      supabase,
      vehicleId,
      data.customer_id
    );
    if (vehicleError) {
      redirect(`/devices/${id}/edit?error=${encodeURIComponent(vehicleError)}`);
    }
  }

  const { error } = await supabase
    .from("devices")
    .update({
      customer_id: data.customer_id,
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
    console.error("Update device failed:", error);
    redirect(`/devices/${id}/edit?error=${encodeURIComponent(error.message)}`);
  }

  const assignmentResult = await syncDeviceVehicleAssignment(
    supabase,
    id,
    vehicleId,
    data.status
  );
  if (assignmentResult.error) {
    redirect(`/devices/${id}/edit?error=${encodeURIComponent(assignmentResult.error)}`);
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
    console.error("Delete device assignments failed:", unlinkError);
    return {
      success: false,
      error: `Could not remove vehicle assignments: ${unlinkError.message}`,
    };
  }

  const { error } = await supabase.from("devices").delete().eq("id", id);

  if (error) {
    console.error("Delete device failed:", error);
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
