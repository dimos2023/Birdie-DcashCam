import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppConfig } from "../config.js";
import type { ParsedLocation } from "../jt808/types.js";
import type { Jt808Frame } from "../jt808/types.js";
import { normalizeTerminalNo } from "../jt808/bcd.js";

export interface TerminalRow {
  id: string;
  organization_id: string;
  device_id: string | null;
  vehicle_id: string | null;
  terminal_no: string;
  media_sim_no: string | null;
  imei: string | null;
  terminal_id_code: string | null;
  auth_code_hash: string | null;
  allow_auto_registration: boolean;
  is_enabled: boolean;
  timezone_offset_minutes: number;
}

export async function upsertGatewayHeartbeat(sb: SupabaseClient, config: AppConfig) {
  await sb.from("jt_gateway_instances").upsert({
    id: config.GATEWAY_INSTANCE_ID,
    status: "online",
    started_at: new Date().toISOString(),
    last_heartbeat_at: new Date().toISOString(),
    signaling_tcp_port: config.JT808_TCP_PORT,
    media_tcp_port: config.JT1078_TCP_PORT,
    media_udp_port: config.JT1078_UDP_PORT,
  });
}

export async function findTerminal(
  sb: SupabaseClient,
  terminalNo: string,
  imei?: string | null,
  terminalIdCode?: string | null,
): Promise<TerminalRow | null> {
  const normalized = normalizeTerminalNo(terminalNo);
  const { data: byNo } = await sb
    .from("jt_terminals")
    .select("*")
    .eq("terminal_no", normalized)
    .maybeSingle();
  if (byNo) return byNo as TerminalRow;

  if (imei) {
    const { data } = await sb.from("jt_terminals").select("*").eq("imei", imei).maybeSingle();
    if (data) return data as TerminalRow;
  }
  if (terminalIdCode) {
    const { data } = await sb
      .from("jt_terminals")
      .select("*")
      .eq("terminal_id_code", terminalIdCode)
      .maybeSingle();
    if (data) return data as TerminalRow;
  }
  return null;
}

export async function createSession(
  sb: SupabaseClient,
  params: {
    organizationId: string;
    terminalId: string;
    gatewayInstanceId: string;
    connectionKey: string;
    remoteIp: string;
    remotePort: number;
    protocolVersion: string;
  },
) {
  const { data, error } = await sb
    .from("jt_terminal_sessions")
    .insert({
      organization_id: params.organizationId,
      terminal_id: params.terminalId,
      gateway_instance_id: params.gatewayInstanceId,
      connection_key: params.connectionKey,
      transport: "tcp",
      protocol_version: params.protocolVersion,
      remote_ip: params.remoteIp,
      remote_port: params.remotePort,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function closeSession(sb: SupabaseClient, sessionId: string, reason: string) {
  await sb
    .from("jt_terminal_sessions")
    .update({ disconnected_at: new Date().toISOString(), disconnect_reason: reason })
    .eq("id", sessionId)
    .is("disconnected_at", null);
}

export async function markTerminalOfflineIfNoSession(sb: SupabaseClient, terminalId: string) {
  const { data: active } = await sb
    .from("jt_terminal_sessions")
    .select("id")
    .eq("terminal_id", terminalId)
    .is("disconnected_at", null)
    .limit(1);
  if (!active?.length) {
    await sb
      .from("jt_terminals")
      .update({
        is_online: false,
        last_disconnected_at: new Date().toISOString(),
      })
      .eq("id", terminalId);
  }
}

export async function logMessage(
  sb: SupabaseClient,
  params: {
    organizationId: string;
    terminalId: string | null;
    sessionId: string | null;
    direction: "terminal_to_platform" | "platform_to_terminal";
    messageId: number;
    messageSerial: number | null;
    protocolVersion: string | null;
    bodyLength: number;
    checksumValid: boolean | null;
    rawHex: string;
    parsedPayload?: Record<string, unknown>;
    parseError?: string | null;
  },
) {
  await sb.from("jt_message_logs").insert({
    organization_id: params.organizationId,
    terminal_id: params.terminalId,
    session_id: params.sessionId,
    direction: params.direction,
    message_id: params.messageId,
    message_serial: params.messageSerial,
    protocol_version: params.protocolVersion,
    body_length: params.bodyLength,
    checksum_valid: params.checksumValid,
    raw_hex: params.rawHex,
    parsed_payload: params.parsedPayload ?? {},
    parse_error: params.parseError ?? null,
  });
}

export async function savePosition(
  sb: SupabaseClient,
  terminal: TerminalRow,
  frame: Jt808Frame,
  location: ParsedLocation,
) {
  const mileage = location.additionalInfo.mileage_km as number | undefined;
  const fuel = location.additionalInfo.fuel_l as number | undefined;
  const signal = location.additionalInfo.signal_strength as number | undefined;
  const sats = location.additionalInfo.satellite_count as number | undefined;

  await sb.from("jt_positions").insert({
    organization_id: terminal.organization_id,
    terminal_id: terminal.id,
    vehicle_id: terminal.vehicle_id,
    source_message_id: frame.header.messageId,
    message_serial: frame.header.messageSerial,
    device_time_text: location.deviceTimeText,
    latitude: location.latitude,
    longitude: location.longitude,
    altitude_m: location.altitudeM,
    speed_kmh: location.speedKmh,
    direction_deg: location.directionDeg,
    alarm_bits: location.alarmBits,
    status_bits: location.statusBits,
    acc_on: location.accOn,
    positioned: location.positioned,
    north_latitude: location.northLatitude,
    east_longitude: location.eastLongitude,
    moving: location.speedKmh > 0,
    mileage_km: mileage ?? null,
    fuel_l: fuel ?? null,
    signal_strength: signal ?? null,
    satellite_count: sats ?? null,
    additional_info: location.additionalInfo,
  });
}

export async function updateTerminalAuth(
  sb: SupabaseClient,
  terminalId: string,
  authHash: string,
  registrationState: string,
) {
  await sb
    .from("jt_terminals")
    .update({
      auth_code_hash: authHash,
      auth_code_issued_at: new Date().toISOString(),
      registration_state: registrationState,
    })
    .eq("id", terminalId);
}

export async function markTerminalAuthenticated(sb: SupabaseClient, terminalId: string) {
  await sb
    .from("jt_terminals")
    .update({
      registration_state: "authenticated",
      is_online: true,
      last_connected_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    })
    .eq("id", terminalId);
}
