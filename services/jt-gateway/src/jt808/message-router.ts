import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppConfig } from "../config.js";
import type { Logger } from "../logger.js";
import { MSG } from "../jt808/constants.js";
import { encodeFrame } from "../jt808/encoder.js";
import type { Jt808Frame } from "../jt808/types.js";
import { buildPlatformCommonResponse } from "../jt808/messages/common-response.js";
import {
  buildRegistrationResponseBody,
  generateAuthCode,
  hashAuthCode,
  parseRegistrationBody,
} from "../jt808/messages/registration.js";
import {
  parseAuthenticationBody,
  verifyAuthCode,
} from "../jt808/messages/authentication.js";
import { parseLocationBody } from "../jt808/messages/location.js";
import type { LiveSession } from "../jt808/session-registry.js";
import { registerSession } from "../jt808/session-registry.js";
import {
  createSession,
  findTerminal,
  logMessage,
  markTerminalAuthenticated,
  savePosition,
  updateTerminalAuth,
} from "./repositories.js";
import { getPublicMediaHost } from "../config.js";

export async function handleInboundFrame(
  session: LiveSession,
  frame: Jt808Frame,
  sb: SupabaseClient,
  config: AppConfig,
  log: Logger,
) {
  const orgId = session.organizationId ?? "00000000-0000-0000-0000-000000000000";
  await logMessage(sb, {
    organizationId: orgId,
    terminalId: session.terminalId,
    sessionId: session.sessionId,
    direction: "terminal_to_platform",
    messageId: frame.header.messageId,
    messageSerial: frame.header.messageSerial,
    protocolVersion: frame.header.protocolVersion,
    bodyLength: frame.body.length,
    checksumValid: true,
    rawHex: frame.rawUnescaped.toString("hex"),
  });

  switch (frame.header.messageId) {
    case MSG.TERMINAL_REGISTRATION:
      await handleRegistration(session, frame, sb, config, log);
      break;
    case MSG.TERMINAL_AUTHENTICATION:
      await handleAuthentication(session, frame, sb, config, log);
      break;
    case MSG.TERMINAL_HEARTBEAT:
      await handleHeartbeat(session, frame, sb);
      break;
    case MSG.LOCATION_REPORT:
    case MSG.LOCATION_QUERY_RESPONSE:
      await handleLocation(session, frame, sb);
      break;
    case MSG.TERMINAL_COMMON_RESPONSE:
      await handleTerminalCommonResponse(session, frame, sb);
      break;
    default:
      log.debug(
        { message_id: frame.header.messageId, terminal_no: frame.header.terminalNo },
        "Unhandled JT808 message",
      );
  }
}

async function handleRegistration(
  session: LiveSession,
  frame: Jt808Frame,
  sb: SupabaseClient,
  config: AppConfig,
  log: Logger,
) {
  const parsed = parseRegistrationBody(frame.body, frame.header.protocolVersion === "2019");
  const terminal = await findTerminal(sb, frame.header.terminalNo, null, parsed.terminalIdCode);

  const outboundSerial = session.serial.next();
  if (!terminal) {
    if (!config.JT808_ALLOW_AUTO_REGISTRATION) {
      const body = buildRegistrationResponseBody(frame.header.messageSerial, 4);
      session.socket.write(
        encodeFrame(
          MSG.REGISTRATION_RESPONSE,
          frame.header.terminalNo,
          outboundSerial,
          body,
          frame.header.protocolVersion,
        ),
      );
      return;
    }
    log.warn({ terminal_no: frame.header.terminalNo }, "Auto-registration not fully implemented");
    return;
  }

  if (!terminal.is_enabled) {
    const body = buildRegistrationResponseBody(frame.header.messageSerial, 4);
    session.socket.write(
      encodeFrame(
        MSG.REGISTRATION_RESPONSE,
        frame.header.terminalNo,
        outboundSerial,
        body,
        frame.header.protocolVersion,
      ),
    );
    return;
  }

  const authCode = generateAuthCode();
  const authHash = hashAuthCode(authCode);
  await updateTerminalAuth(sb, terminal.id, authHash, "registered");

  session.terminalId = terminal.id;
  session.organizationId = terminal.organization_id;
  session.protocolVersion = frame.header.protocolVersion;
  session.terminalNo = frame.header.terminalNo;
  if (!session.sessionId) {
    session.sessionId = await createSession(sb, {
      organizationId: terminal.organization_id,
      terminalId: terminal.id,
      gatewayInstanceId: config.GATEWAY_INSTANCE_ID,
      connectionKey: session.connectionKey,
      remoteIp: session.remoteIp,
      remotePort: session.remotePort,
      protocolVersion: frame.header.protocolVersion,
    });
  }
  registerSession(session);

  const body = buildRegistrationResponseBody(frame.header.messageSerial, 0, authCode);
  session.socket.write(
    encodeFrame(
      MSG.REGISTRATION_RESPONSE,
      frame.header.terminalNo,
      outboundSerial,
      body,
      frame.header.protocolVersion,
    ),
  );
}

async function handleAuthentication(
  session: LiveSession,
  frame: Jt808Frame,
  sb: SupabaseClient,
  config: AppConfig,
  log: Logger,
) {
  const parsed = parseAuthenticationBody(frame.body, frame.header.protocolVersion === "2019");
  const full = await findTerminal(sb, frame.header.terminalNo, parsed.imei);

  const outboundSerial = session.serial.next();
  const ok =
    !!full &&
    verifyAuthCode(parsed.authCode, full.auth_code_hash) &&
    (!full.imei || !parsed.imei || full.imei === parsed.imei);

  session.socket.write(
    buildPlatformCommonResponse(
      frame.header.terminalNo,
      frame.header.messageSerial,
      MSG.TERMINAL_AUTHENTICATION,
      ok ? 0 : 1,
      outboundSerial,
      frame.header.protocolVersion,
    ),
  );

  if (ok && full) {
    session.authenticated = true;
    session.terminalId = full.id;
    session.organizationId = full.organization_id;
    session.terminalNo = frame.header.terminalNo;
    session.protocolVersion = frame.header.protocolVersion;
    if (!session.sessionId) {
      session.sessionId = await createSession(sb, {
        organizationId: full.organization_id,
        terminalId: full.id,
        gatewayInstanceId: config.GATEWAY_INSTANCE_ID,
        connectionKey: session.connectionKey,
        remoteIp: session.remoteIp,
        remotePort: session.remotePort,
        protocolVersion: frame.header.protocolVersion,
      });
    }
    await markTerminalAuthenticated(sb, full.id);
    registerSession(session);
    log.info({ terminal_id: full.id, terminal_no: frame.header.terminalNo }, "Terminal authenticated");
  }
}

async function handleHeartbeat(session: LiveSession, frame: Jt808Frame, sb: SupabaseClient) {
  const outboundSerial = session.serial.next();
  session.socket.write(
    buildPlatformCommonResponse(
      frame.header.terminalNo,
      frame.header.messageSerial,
      MSG.TERMINAL_HEARTBEAT,
      0,
      outboundSerial,
      frame.header.protocolVersion,
    ),
  );
  if (session.terminalId) {
    await sb
      .from("jt_terminals")
      .update({ last_seen_at: new Date().toISOString(), is_online: true })
      .eq("id", session.terminalId);
  }
}

async function handleLocation(session: LiveSession, frame: Jt808Frame, sb: SupabaseClient) {
  if (!session.terminalId || !session.organizationId) return;
  const terminal = await findTerminal(sb, frame.header.terminalNo);
  if (!terminal) return;
  const location = parseLocationBody(frame.body);
  await savePosition(sb, terminal, frame, location);
}

async function handleTerminalCommonResponse(
  session: LiveSession,
  frame: Jt808Frame,
  sb: SupabaseClient,
) {
  if (frame.body.length < 5) return;
  const replySerial = frame.body.readUInt16BE(0);
  const replyMessageId = frame.body.readUInt16BE(2);
  const result = frame.body.readUInt8(4);

  const pending = session.pendingAcks.get(replySerial);
  if (pending?.commandId) {
    await sb.rpc("jt_mark_command_result", {
      p_command_id: pending.commandId,
      p_status: result === 0 ? "acknowledged" : "failed",
      p_message_serial: replySerial,
      p_ack_result: result,
      p_error_message: result === 0 ? null : `Terminal ack result ${result}`,
    });
    session.pendingAcks.delete(replySerial);
  }

  if (replyMessageId === MSG.START_REALTIME_AV && result === 0) {
    await sb
      .from("jt_stream_sessions")
      .update({ status: "connecting" })
      .eq("terminal_id", session.terminalId)
      .eq("status", "command_sent");
  }
}

export function buildCommandFrame(
  session: LiveSession,
  messageId: number,
  body: Buffer,
): { frame: Buffer; serial: number } {
  const serial = session.serial.next();
  const frame = encodeFrame(messageId, session.terminalNo, serial, body, session.protocolVersion);
  return { frame, serial };
}

export function buildStartLiveBody(
  config: AppConfig,
  logicalChannel: number,
  streamType: "main" | "sub" = "sub",
): Buffer {
  const host = getPublicMediaHost(config);
  const hostBuf = Buffer.from(host, "ascii");
  const parts: Buffer[] = [];
  parts.push(Buffer.from([hostBuf.length]));
  parts.push(hostBuf);
  parts.push(Buffer.from([(config.JT1078_TCP_PORT >> 8) & 0xff, config.JT1078_TCP_PORT & 0xff]));
  parts.push(Buffer.from([(config.JT1078_UDP_PORT >> 8) & 0xff, config.JT1078_UDP_PORT & 0xff]));
  parts.push(Buffer.from([logicalChannel & 0xff]));
  parts.push(Buffer.from([1])); // data type video
  parts.push(Buffer.from([streamType === "main" ? 0 : 1]));
  return Buffer.concat(parts);
}

export function buildStopLiveBody(logicalChannel: number, streamType: "main" | "sub" = "sub"): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeUInt8(logicalChannel, 0);
  buf.writeUInt8(0, 1); // control: close
  buf.writeUInt8(0, 2); // close av
  buf.writeUInt8(streamType === "main" ? 0 : 1, 3);
  return buf;
}
