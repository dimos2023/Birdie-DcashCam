import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppConfig } from "../config.js";
import type { Logger } from "../logger.js";
import { MSG } from "../jt808/constants.js";
import {
  buildCommandFrame,
  buildStartLiveBody,
  buildStopLiveBody,
} from "../jt808/message-router.js";
import { getSessionByTerminalId } from "../jt808/session-registry.js";
import { getPublicMediaHost } from "../config.js";

interface ClaimedCommand {
  id: string;
  terminal_id: string;
  message_id: number;
  command_name: string;
  payload: Record<string, unknown>;
  body_hex: string | null;
  stream_session_id: string | null;
}

export function startCommandWorker(
  sb: SupabaseClient,
  config: AppConfig,
  log: Logger,
): () => void {
  let stopped = false;

  const tick = async () => {
    if (stopped) return;
    try {
      const { data, error } = await sb.rpc("jt_claim_commands", {
        p_gateway_instance: config.GATEWAY_INSTANCE_ID,
        p_limit: 25,
      });
      if (error) {
        log.error({ err: error }, "jt_claim_commands failed");
        return;
      }
      const commands = (data ?? []) as ClaimedCommand[];
      for (const cmd of commands) {
        await processCommand(sb, config, log, cmd);
      }
    } catch (err) {
      log.error({ err }, "command worker tick failed");
    }
  };

  const timer = setInterval(tick, config.COMMAND_POLL_INTERVAL_MS);
  void tick();

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

async function processCommand(
  sb: SupabaseClient,
  config: AppConfig,
  log: Logger,
  cmd: ClaimedCommand,
) {
  const session = getSessionByTerminalId(cmd.terminal_id);
  if (!session?.authenticated) {
    await sb.rpc("jt_mark_command_result", {
      p_command_id: cmd.id,
      p_status: "failed",
      p_message_serial: null,
      p_ack_result: null,
      p_error_message: "Terminal offline or not authenticated",
    });
    return;
  }

  let body: Buffer;
  if (cmd.body_hex) {
    body = Buffer.from(cmd.body_hex.replace(/\s/g, ""), "hex");
  } else {
    body = buildSemanticBody(config, sb, cmd, log);
  }

  const { frame, serial } = buildCommandFrame(session, cmd.message_id, body);

  session.pendingAcks.set(serial, {
    commandId: cmd.id,
    responseMessageId: cmd.message_id,
  });

  try {
    session.socket.write(frame);
    await sb.rpc("jt_mark_command_result", {
      p_command_id: cmd.id,
      p_status: "sent",
      p_message_serial: serial,
      p_ack_result: null,
      p_error_message: null,
    });

    if (cmd.message_id === MSG.START_REALTIME_AV && cmd.stream_session_id) {
      const host = getPublicMediaHost(config);
      await sb
        .from("jt_stream_sessions")
        .update({
          status: "command_sent",
          server_ip: host,
          tcp_port: config.JT1078_TCP_PORT,
          udp_port: config.JT1078_UDP_PORT,
        })
        .eq("id", cmd.stream_session_id);
    }
  } catch (err) {
    await sb.rpc("jt_mark_command_result", {
      p_command_id: cmd.id,
      p_status: "failed",
      p_message_serial: serial,
      p_ack_result: null,
      p_error_message: err instanceof Error ? err.message : "send failed",
    });
    log.error({ err, command_id: cmd.id }, "Failed to send command");
  }
}

function buildSemanticBody(
  config: AppConfig,
  _sb: SupabaseClient,
  cmd: ClaimedCommand,
  log: Logger,
): Buffer {
  const p = cmd.payload ?? {};
  switch (cmd.message_id) {
    case MSG.QUERY_AV_ATTRIBUTES:
      return Buffer.alloc(0);
    case MSG.QUERY_LOCATION:
      return Buffer.alloc(0);
    case MSG.START_REALTIME_AV: {
      const channel = Number(p.logical_channel ?? 1);
      const streamType = (p.stream_type as "main" | "sub") ?? "sub";
      return buildStartLiveBody(config, channel, streamType);
    }
    case MSG.CONTROL_REALTIME_AV: {
      const channel = Number(p.logical_channel ?? 1);
      const streamType = (p.stream_type as "main" | "sub") ?? "sub";
      const control = String(p.control ?? "stop");
      if (control === "stop") return buildStopLiveBody(channel, streamType);
      const buf = Buffer.alloc(4);
      buf.writeUInt8(channel, 0);
      buf.writeUInt8(control === "pause" ? 1 : control === "resume" ? 2 : 3, 1);
      buf.writeUInt8(0, 2);
      buf.writeUInt8(streamType === "main" ? 0 : 1, 3);
      return buf;
    }
    case MSG.QUERY_RECORDING_RESOURCES: {
      const channel = Number(p.logical_channel ?? 1);
      const buf = Buffer.alloc(22);
      buf.writeUInt8(channel, 0);
      // start/end BCD[6] placeholders — caller should supply body_hex for precise windows
      return buf;
    }
    default:
      log.warn({ message_id: cmd.message_id }, "Unknown command, sending empty body");
      return Buffer.alloc(0);
  }
}
