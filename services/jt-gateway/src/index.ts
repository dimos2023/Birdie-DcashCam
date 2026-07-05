import net, { type Socket } from "node:net";
import { loadConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { createHealthServer, type HealthState } from "./health.js";
import { getSupabaseAdmin, pingSupabase } from "./db/supabase-admin.js";
import { upsertGatewayHeartbeat } from "./db/repositories.js";
import { startCommandWorker } from "./db/command-worker.js";
import { FrameBuffer } from "./jt808/frame-buffer.js";
import { handleInboundFrame } from "./jt808/message-router.js";
import {
  createConnectionKey,
  getSessionByConnection,
  removeSession,
  type LiveSession,
} from "./jt808/session-registry.js";
import { SerialCounter } from "./jt808/serial-counter.js";
import { closeSession, markTerminalOfflineIfNoSession } from "./db/repositories.js";
import { decodeJt1078Packet } from "./jt1078/packet-decoder.js";
import { FrameAssembler } from "./jt1078/frame-assembler.js";
import { writeFrame, startH264Pipeline, stopPipeline, stopAllPipelines } from "./media/ffmpeg-manager.js";
import { buildPlaybackUrl, buildRtspPublishUrl } from "./media/mediamtx-client.js";
import { generateStreamToken, hashStreamToken } from "./media/stream-token.js";
import { isJt1078Packet } from "./jt1078/types.js";

const config = loadConfig(process.env);
const log = createLogger(config);
const sb = getSupabaseAdmin(config);
const healthState: HealthState = { signalingBound: false, mediaBound: false };

const mediaAssemblers = new Map<string, FrameAssembler>();
const streamKeyByMedia = new Map<string, string>();

function createLiveSession(socket: Socket): LiveSession {
  const remoteIp = socket.remoteAddress ?? "0.0.0.0";
  const remotePort = socket.remotePort ?? 0;
  return {
    socket,
    sessionId: "",
    terminalId: null,
    organizationId: null,
    connectionKey: createConnectionKey(remoteIp, remotePort),
    protocolVersion: "2019",
    terminalNo: "",
    authenticated: false,
    messageSerial: 0,
    remoteIp,
    remotePort,
    lastRxAt: Date.now(),
    serial: new SerialCounter(),
    pendingAcks: new Map(),
  };
}

function startJt808Server() {
  const server = net.createServer((socket) => {
    const session = createLiveSession(socket);
    const buffer = new FrameBuffer(config.JT808_MAX_FRAME_BYTES);
    log.info({ remote_ip: session.remoteIp, remote_port: session.remotePort }, "JT808 connection");

    socket.on("data", (chunk) => {
      session.lastRxAt = Date.now();
      const frames = buffer.push(chunk);
      for (const frame of frames) {
        void handleInboundFrame(session, frame, sb, config, log).catch((err) => {
          log.error({ err, message_id: frame.header.messageId }, "handleInboundFrame failed");
        });
      }
    });

    socket.on("close", () => {
      void (async () => {
        if (session.sessionId) {
          await closeSession(sb, session.sessionId, "socket_closed");
        }
        if (session.terminalId) {
          await markTerminalOfflineIfNoSession(sb, session.terminalId);
        }
        removeSession(session.connectionKey);
        log.info({ terminal_id: session.terminalId }, "JT808 disconnected");
      })();
    });

    socket.on("error", (err) => {
      log.warn({ err, connection_key: session.connectionKey }, "JT808 socket error");
    });
  });

  server.listen(config.JT808_TCP_PORT, config.JT808_BIND_HOST, () => {
    healthState.signalingBound = true;
    log.info({ port: config.JT808_TCP_PORT }, "JT808 TCP listening");
  });

  return server;
}

function startJt1078Server() {
  const server = net.createServer((socket) => {
    const remoteKey = `${socket.remoteAddress}:${socket.remotePort}`;
    let carry = Buffer.alloc(0);
    log.info({ remote: remoteKey }, "JT1078 media connection");

    socket.on("data", async (chunk) => {
      carry = Buffer.concat([carry, chunk]);
      while (carry.length >= 16) {
        if (!isJt1078Packet(carry)) {
          carry = carry.subarray(1);
          continue;
        }
        const packet = decodeJt1078Packet(carry, config.JT1078_MAX_PACKET_BYTES);
        if (!packet) break;
        carry = carry.subarray(packet.headerLength);

        const mediaKey = `${packet.simNo}:${packet.logicalChannel}`;
        let sessionKey = streamKeyByMedia.get(mediaKey);
        if (!sessionKey) {
          const { data: stream } = await sb
            .from("jt_stream_sessions")
            .select("id, session_key, organization_id, terminal_id, codec")
            .or(`media_sim_no.eq.${packet.simNo},terminal_id.not.is.null`)
            .in("status", ["command_sent", "connecting", "active"])
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!stream) continue;
          sessionKey = stream.session_key as string;
          streamKeyByMedia.set(mediaKey, sessionKey);

          const token = generateStreamToken();
          const playbackUrl = buildPlaybackUrl(config, sessionKey);
          const rtspUrl = buildRtspPublishUrl(config, sessionKey);
          startH264Pipeline(config, log, sessionKey, rtspUrl, stream.codec === "h265");
          await sb
            .from("jt_stream_sessions")
            .update({
              status: "active",
              playback_url: playbackUrl,
              access_token_hash: hashStreamToken(token),
              started_at: new Date().toISOString(),
              media_sim_no: packet.simNo,
              last_packet_at: new Date().toISOString(),
            })
            .eq("id", stream.id);
        }

        let assembler = mediaAssemblers.get(mediaKey);
        if (!assembler) {
          assembler = new FrameAssembler(2_000_000, 5000);
          mediaAssemblers.set(mediaKey, assembler);
        }
        const assembled = assembler.push(packet);
        if (assembled && sessionKey && (assembled.dataType === 0 || assembled.dataType === 1)) {
          writeFrame(sessionKey, assembled.data);
          await sb
            .from("jt_stream_sessions")
            .update({ last_packet_at: new Date().toISOString(), packets_received: packet.serial })
            .eq("session_key", sessionKey);
        }
      }
    });

    socket.on("close", () => {
      for (const [key, sk] of streamKeyByMedia.entries()) {
        if (key.startsWith(socket.remoteAddress ?? "")) {
          stopPipeline(sk);
          streamKeyByMedia.delete(key);
        }
      }
    });
  });

  server.listen(config.JT1078_TCP_PORT, config.JT1078_BIND_HOST, () => {
    healthState.mediaBound = true;
    log.info({ port: config.JT1078_TCP_PORT }, "JT1078 TCP listening");
  });

  return server;
}

async function main() {
  await upsertGatewayHeartbeat(sb, config);
  setInterval(() => void upsertGatewayHeartbeat(sb, config), 30_000);

  const stopWorker = startCommandWorker(sb, config, log);
  const jt808 = startJt808Server();
  const jt1078 = startJt1078Server();
  createHealthServer(config, log, healthState);

  const shutdown = () => {
    log.info("Shutting down");
    stopWorker();
    stopAllPipelines();
    jt808.close();
    jt1078.close();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  log.fatal({ err }, "Gateway failed to start");
  process.exit(1);
});
