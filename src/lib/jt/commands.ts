import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/types";
import { randomBytes } from "node:crypto";

type Supabase = SupabaseClient<Database>;

export async function enqueueCommand(
  supabase: Supabase,
  params: {
    organizationId: string;
    terminalId: string;
    commandName: string;
    messageId: number;
    payload?: Record<string, unknown>;
    streamSessionId?: string | null;
    createdBy?: string | null;
    expiresInSeconds?: number;
  },
) {
  const expiresAt = new Date(
    Date.now() + (params.expiresInSeconds ?? 120) * 1000,
  ).toISOString();

  const { data, error } = await supabase
    .from("jt_commands")
    .insert({
      organization_id: params.organizationId,
      terminal_id: params.terminalId,
      command_name: params.commandName,
      message_id: params.messageId,
      payload: (params.payload ?? {}) as Json,
      stream_session_id: params.streamSessionId ?? null,
      created_by: params.createdBy ?? null,
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

export async function createLiveStreamSession(
  supabase: Supabase,
  params: {
    organizationId: string;
    terminalId: string;
    vehicleId?: string | null;
    logicalChannel: number;
    streamType: "main" | "sub";
    dataType?: string;
  },
) {
  const sessionKey = `live-${params.terminalId.slice(0, 8)}-${params.logicalChannel}-${randomBytes(6).toString("hex")}`;

  const { data, error } = await supabase
    .from("jt_stream_sessions")
    .insert({
      organization_id: params.organizationId,
      terminal_id: params.terminalId,
      vehicle_id: params.vehicleId ?? null,
      session_key: sessionKey,
      mode: "live",
      logical_channel: params.logicalChannel,
      data_type: params.dataType ?? "video",
      stream_type: params.streamType,
      status: "requested",
    })
    .select("id, session_key")
    .single();

  if (error) throw error;
  return data;
}
