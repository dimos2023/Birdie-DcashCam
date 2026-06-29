"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/auth/audit";
import { requireRole } from "@/lib/auth/profile";
import { getWhatsAppConfig } from "@/lib/env";
import type { Json } from "@/lib/types";

export async function signIn(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createCustomer(formData: FormData) {
  const profile = await requireRole("operator");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("customers")
    .insert({
      organization_id: profile.organization_id,
      name: formData.get("name") as string,
      contact_name: (formData.get("contact_name") as string) || null,
      email: (formData.get("email") as string) || null,
      phone: (formData.get("phone") as string) || null,
      address: (formData.get("address") as string) || null,
      city: (formData.get("city") as string) || null,
      country: (formData.get("country") as string) || "Saudi Arabia",
      notes: (formData.get("notes") as string) || null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await logAuditEvent({
    organizationId: profile.organization_id,
    userId: profile.id,
    action: "create",
    entityType: "customer",
    entityId: data.id,
  });

  redirect(`/customers/${data.id}`);
}

export async function updateCustomer(id: string, formData: FormData) {
  const profile = await requireRole("operator");
  const supabase = await createClient();

  const { error } = await supabase
    .from("customers")
    .update({
      name: formData.get("name") as string,
      contact_name: (formData.get("contact_name") as string) || null,
      email: (formData.get("email") as string) || null,
      phone: (formData.get("phone") as string) || null,
      address: (formData.get("address") as string) || null,
      city: (formData.get("city") as string) || null,
      country: (formData.get("country") as string) || "Saudi Arabia",
      notes: (formData.get("notes") as string) || null,
      is_active: formData.get("is_active") === "true",
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
  const supabase = await createClient();

  const customerId = formData.get("customer_id") as string;
  const yearStr = formData.get("year") as string;

  const { data, error } = await supabase
    .from("vehicles")
    .insert({
      organization_id: profile.organization_id,
      customer_id: customerId || null,
      plate_number: formData.get("plate_number") as string,
      make: (formData.get("make") as string) || null,
      model: (formData.get("model") as string) || null,
      year: yearStr ? parseInt(yearStr, 10) : null,
      color: (formData.get("color") as string) || null,
      vin: (formData.get("vin") as string) || null,
      status: (formData.get("status") as "active" | "inactive" | "maintenance") || "active",
      notes: (formData.get("notes") as string) || null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await logAuditEvent({
    organizationId: profile.organization_id,
    userId: profile.id,
    action: "create",
    entityType: "vehicle",
    entityId: data.id,
  });

  redirect(`/vehicles/${data.id}`);
}

export async function updateVehicle(id: string, formData: FormData) {
  const profile = await requireRole("operator");
  const supabase = await createClient();

  const customerId = formData.get("customer_id") as string;
  const yearStr = formData.get("year") as string;

  const { error } = await supabase
    .from("vehicles")
    .update({
      customer_id: customerId || null,
      plate_number: formData.get("plate_number") as string,
      make: (formData.get("make") as string) || null,
      model: (formData.get("model") as string) || null,
      year: yearStr ? parseInt(yearStr, 10) : null,
      color: (formData.get("color") as string) || null,
      vin: (formData.get("vin") as string) || null,
      status: formData.get("status") as "active" | "inactive" | "maintenance",
      notes: (formData.get("notes") as string) || null,
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
  const supabase = await createClient();

  const modelId = formData.get("device_model_id") as string;

  const { data, error } = await supabase
    .from("devices")
    .insert({
      organization_id: profile.organization_id,
      device_model_id: modelId || null,
      serial_number: formData.get("serial_number") as string,
      imei: (formData.get("imei") as string) || null,
      sim_number: (formData.get("sim_number") as string) || null,
      firmware_version: (formData.get("firmware_version") as string) || null,
      status:
        (formData.get("status") as
          | "active"
          | "inactive"
          | "maintenance"
          | "decommissioned") || "inactive",
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  const vehicleId = formData.get("vehicle_id") as string;
  if (vehicleId) {
    await supabase.from("vehicle_devices").insert({
      organization_id: profile.organization_id,
      vehicle_id: vehicleId,
      device_id: data.id,
      is_primary: true,
    });
  }

  await logAuditEvent({
    organizationId: profile.organization_id,
    userId: profile.id,
    action: "create",
    entityType: "device",
    entityId: data.id,
  });

  redirect(`/devices`);
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
