import type { Page, WebSocket } from "playwright";
import { redactSecrets } from "./redaction.js";
import { tryParseJsonPayload } from "../gps51/live-state-analyzer.js";
import {
  extractRemindMsgLogFields,
  parsePositionLast,
  parseWebsocketMessage,
} from "../gps51/position-last-parser.js";
import type { ParsedPositionLast } from "../gps51/position-last-parser.js";
import {
  incrementLiveFramesReceived,
  incrementLiveParseErrors,
  incrementLiveRemindMsgCount,
  setLiveWebsocketConnected,
} from "../worker/live-sync-metrics.js";
import type { Logger } from "../logger.js";

export const GPS51_LIVE_WEBSOCKET_PATH = "/wss/wss";

export type LiveFrameHandler = {
  onPositionLast: (position: ParsedPositionLast) => void | Promise<void>;
  onRemindMsg: (info: { deviceId: string | null; alarmCode: string | null }) => void;
  onParseError: (reason: string) => void;
  onWebSocketConnect?: () => void | Promise<void>;
};

export function isGps51LiveWebSocketUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith("gps51.com") && parsed.pathname.includes(GPS51_LIVE_WEBSOCKET_PATH);
  } catch {
    return url.includes("gps51.com") && url.includes(GPS51_LIVE_WEBSOCKET_PATH);
  }
}

export function attachLiveWebSocketListeners(
  page: Page,
  log: Logger,
  handler: LiveFrameHandler,
): () => void {
  const sockets = new Set<WebSocket>();

  const onWebSocket = (ws: WebSocket) => {
    if (!isGps51LiveWebSocketUrl(ws.url())) return;

    sockets.add(ws);
    setLiveWebsocketConnected(true);
    log.info({ url: ws.url().split("?")[0] }, "GPS51 live WebSocket connected");
    void handler.onWebSocketConnect?.();

    ws.on("framereceived", (event) => {
      void processFrame(event.payload, handler, log);
    });

    ws.on("close", () => {
      sockets.delete(ws);
      if (sockets.size === 0) setLiveWebsocketConnected(false);
      log.warn("GPS51 live WebSocket closed");
    });

    ws.on("socketerror", () => {
      log.warn("GPS51 live WebSocket error");
    });
  };

  page.on("websocket", onWebSocket);

  return () => {
    page.off("websocket", onWebSocket);
    setLiveWebsocketConnected(false);
  };
}

function processFrame(payload: string | Buffer, handler: LiveFrameHandler, log: Logger): void {
  void processFrameAsync(payload, handler, log);
}

async function processFrameAsync(
  payload: string | Buffer,
  handler: LiveFrameHandler,
  log: Logger,
): Promise<void> {
  incrementLiveFramesReceived();

  const parsed = tryParseJsonPayload(typeof payload === "string" ? payload : payload.toString("utf8"));
  if (parsed == null) {
    incrementLiveParseErrors();
    handler.onParseError("non-json frame");
    return;
  }

  const sanitized = redactSecrets(parsed);
  const message = parseWebsocketMessage(sanitized);

  if (message.kind === "remindMsg") {
    incrementLiveRemindMsgCount();
    const info = extractRemindMsgLogFields(message.data);
    log.info(
      { device_id: info.deviceId, alarm_code: info.alarmCode },
      "GPS51 remindMsg received (not persisted)",
    );
    handler.onRemindMsg(info);
    return;
  }

  if (message.kind !== "positionLast") return;

  const result = parsePositionLast(message.data);
  if (!result.ok) {
    incrementLiveParseErrors();
    handler.onParseError(result.reason);
    return;
  }

  await handler.onPositionLast(result.position);
}

export function parseLiveWebSocketFrameForTest(payload: unknown): {
  kind: "positionLast" | "remindMsg" | "ignored";
  position?: ParsedPositionLast;
  remind?: { deviceId: string | null; alarmCode: string | null };
  error?: string;
} {
  const sanitized = redactSecrets(payload);
  const message = parseWebsocketMessage(sanitized);

  if (message.kind === "remindMsg") {
    return { kind: "remindMsg", remind: extractRemindMsgLogFields(message.data) };
  }
  if (message.kind !== "positionLast") return { kind: "ignored" };

  const result = parsePositionLast(message.data);
  if (!result.ok) return { kind: "positionLast", error: result.reason };
  return { kind: "positionLast", position: result.position };
}
