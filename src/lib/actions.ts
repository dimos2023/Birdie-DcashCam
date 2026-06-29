"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/auth/audit";
import { requireRole } from "@/lib/auth/profile";
import { getWhatsAppConfig } from "@/lib/env";
import type { Json } from "@/lib/types";
import {
  customerSchema,
  deviceSchema,
  vehicleSchema,
  parseFormData,
  emptyToNull,
  dateOrNull,
} from "@/lib/validations/crud";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}

export async function createCustomer(formData: FormData) {
  const profile = await requireRole("operator");
  const parsed = parseFormData(customerSchema, formData);
  if (!parsed.success) {
    redirect(`/customers/new?error=${encodeURIComponent(parsed.error)}`);
  }
  const data = parsed.data;
  const supabase = await createClient();

  const { data: row, error } = await supabase
    .from("customers")
    .insert({
      organization_id: profile.organization_id,
      name: data.full_name,
      phone: emptyToNull(data.phone),
      whatsapp_number: emptyToNull(data.whatsapp_number),
      email: emptyToNull(data.email),
      city: emptyToNull(data.city),
      consent_status: data.consent_status,
      notes: emptyToNull(data.notes),
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await logAuditEvent({
    organizationId: profile.organization_id,
    userId: profile.id,
    action: "create",
    entityType: "customer",
    entityId: row.id,
  });

  redirect(`/customers/${row.id}`);
}

export async function updateCustomer(id: string, formData: FormData) {
  const profile = await requireRole("operator");
  const parsed = parseFormData(customerSchema, formData);
  if (!parsed.success) {
    redirect(`/customers/${id}?error=${encodeURIComponent(parsed.error)}`);
  }
  const data = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("customers")
    .update({
      name: data.full_name,
      phone: emptyToNull(data.phone),
      whatsapp_number: emptyToNull(data.whatsapp_number),
      email: emptyToNull(data.email),
      city: emptyToNull(data.city),
      consent_status: data.consent_status,
      notes: emptyToNull(data.notes),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  await logAuditEvent({
    organizationId: profile.organization_id,
    userId: profile.id,
    action: "update",
    entityType: "customer",
    entityId: id,
  });

  redirect(`/customers/${id}`);
}

export async function createVehicle(formData: FormData) {
  const profile = await requireRole("operator");
  const parsed = parseFormData(vehicleSchema, formData);
  if (!parsed.success) {
    redirect(`/vehicles/new?error=${encodeURIComponent(parsed.error)}`);
  }
  const data = parsed.data;
  const supabase = await createClient();

  const { data: row, error } = await supabase
    .from("vehicles")
    .insert({
      organization_id: profile.organization_id,
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

  if (error) throw new Error(error.message);

  await logAuditEvent({
    organizationId: profile.organization_id,
    userId: profile.id,
    action: "create",
    entityType: "vehicle",
    entityId: row.id,
  });

  redirect(`/vehicles/${row.id}`);
}

export async function updateVehicle(id: string, formData: FormData) {
  const profile = await requireRole("operator");
  const parsed = parseFormData(vehicleSchema, formData);
  if (!parsed.success) {
    redirect(`/vehicles/${id}?error=${encodeURIComponent(parsed.error)}`);
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

  if (error) throw new Error(error.message);

  await logAuditEvent({
    organizationId: profile.organization_id,
    userId: profile.id,
    action: "update",
    entityType: "vehicle",
    entityId: id,
  });

  redirect(`/vehicles/${id}`);
}

export async function createDevice(formData: FormData) {
  const profile = await requireRole("operator");
  const parsed = parseFormData(deviceSchema, formData);
  if (!parsed.success) {
    redirect(`/devices/new?error=${encodeURIComponent(parsed.error)}`);
  }
  const data = parsed.data;
  const supabase = await createClient();

  const { data: row, error } = await supabase
    .from("devices")
    .insert({
      organization_id: profile.organization_id,
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

  if (error) throw new Error(error.message);

  await logAuditEvent({
    organizationId: profile.organization_id,
    userId: profile.id,
    action: "create",
    entityType: "device",
    entityId: row.id,
  });

  redirect(`/devices/${row.id}`);
}

export async function updateDevice(id: string, formData: FormData) {
  const profile = await requireRole("operator");
  const parsed = parseFormData(deviceSchema, formData);
  if (!parsed.success) {
    redirect(`/devices/${id}?error=${encodeURIComponent(parsed.error)}`);
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

  if (error) throw new Error(error.message);

  await logAuditEvent({
    organizationId: profile.organization_id,
    userId: profile.id,
    action: "update",
    entityType: "device",
    entityId: id,
  });

  redirect(`/devices/${id}`);
}

export async function assignDeviceToVehicle(deviceId: string, vehicleId: string) {
  const profile = await requireRole("operator");
  const supabase = await createClient();

  const { error } = await supabase.from("vehicle_devices").insert({
    organization_id: profile.organization_id,
    vehicle_id: vehicleId,
    device_id: deviceId,
    is_primary: false,
  });

  if (error) throw new Error(error.message);

  await supabase.from("devices").update({ status: "active" }).eq("id", deviceId);

  await logAuditEvent({
    organizationId: profile.organization_id,
    userId: profile.id,
    action: "assign",
    entityType: "vehicle_device",
    entityId: deviceId,
    metadata: { vehicle_id: vehicleId } as Json,
  });

  return { success: true };
}

export async function sendWhatsappMessage(conversationId: string, body: string) {
  const profile = await requireRole("operator");
  const supabase = await createClient();

  const { data: conversation } = await supabase
    .from("whatsapp_conversations")
    .select("*")
    .eq("id", conversationId)
    .single();

  if (!conversation) throw new Error("Conversation not found");

  const { phoneNumberId, accessToken } = getWhatsAppConfig();

  if (phoneNumberId && accessToken) {
    try {
      await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: conversation.wa_phone_number.replace(/\D/g, ""),
          type: "text",
          text: { body },
        }),
      });
    } catch {
      // Continue to persist message locally
    }
  }

  const { error } = await supabase.from("whatsapp_messages").insert({
    organization_id: profile.organization_id,
    conversation_id: conversationId,
    direction: "outbound",
    body,
    status: "sent",
  });

  if (error) throw new Error(error.message);

  await supabase
    .from("whatsapp_conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId);

  return { success: true };
}
