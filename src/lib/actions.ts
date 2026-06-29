"use server";

import { createClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/auth/audit";
import { getActionContext } from "@/lib/actions/context";
import { getWhatsAppConfig } from "@/lib/env";
import type { Json } from "@/lib/types";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}

export async function assignDeviceToVehicle(deviceId: string, vehicleId: string) {
  const ctx = await getActionContext();
  const supabase = await createClient();

  const { error } = await supabase.from("vehicle_devices").insert({
    organization_id: ctx.organizationId,
    vehicle_id: vehicleId,
    device_id: deviceId,
    is_primary: false,
  });

  if (error) throw new Error(error.message);

  await supabase.from("devices").update({ status: "active" }).eq("id", deviceId);

  await logAuditEvent({
    organizationId: ctx.organizationId,
    userId: ctx.userId ?? undefined,
    action: "assign",
    entityType: "vehicle_device",
    entityId: deviceId,
    metadata: { vehicle_id: vehicleId } as Json,
  });

  return { success: true };
}

export async function sendWhatsappMessage(conversationId: string, body: string) {
  const ctx = await getActionContext();
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
    organization_id: ctx.organizationId,
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
