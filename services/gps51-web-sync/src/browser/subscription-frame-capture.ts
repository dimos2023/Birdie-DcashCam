import type { Page, WebSocket } from "playwright";
import { redactSecrets } from "./redaction.js";
import { isGps51LiveWebSocketUrl } from "./live-websocket-listener.js";
import { tryParseJsonPayload } from "../gps51/live-state-analyzer.js";
import { parseWebsocketMessage } from "../gps51/position-last-parser.js";

export type CapturedWsFrame = {
  direction: "incoming" | "outgoing";
  capturedAt: string;
  payload: unknown;
  kind: "positionLast" | "remindMsg" | "other" | "non-json";
};

export type SubscriptionActionCapture = {
  action: string;
  startedAt: string;
  finishedAt: string;
  outgoingFrames: CapturedWsFrame[];
  incomingFrames: CapturedWsFrame[];
  positionLastCount: number;
  selectedDeviceCountHint: number | null;
};

export class SubscriptionFrameCapture {
  private sockets = new Set<WebSocket>();
  private outgoing: CapturedWsFrame[] = [];
  private incoming: CapturedWsFrame[] = [];
  private positionLastCount = 0;

  attach(page: Page): () => void {
    const onWebSocket = (ws: WebSocket) => {
      if (!isGps51LiveWebSocketUrl(ws.url())) return;
      this.sockets.add(ws);

      ws.on("framesent", (event) => {
        this.pushFrame("outgoing", event.payload);
      });
      ws.on("framereceived", (event) => {
        this.pushFrame("incoming", event.payload);
      });
      ws.on("close", () => this.sockets.delete(ws));
    };

    page.on("websocket", onWebSocket);
    return () => page.off("websocket", onWebSocket);
  }

  beginAction(): void {
    this.outgoing = [];
    this.incoming = [];
    this.positionLastCount = 0;
  }

  snapshotAction(action: string, selectedDeviceCountHint: number | null): SubscriptionActionCapture {
    return {
      action,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      outgoingFrames: [...this.outgoing],
      incomingFrames: [...this.incoming],
      positionLastCount: this.positionLastCount,
      selectedDeviceCountHint,
    };
  }

  getOpenSocketCount(): number {
    return this.sockets.size;
  }

  private pushFrame(direction: "incoming" | "outgoing", payload: string | Buffer): void {
    const parsed = tryParseJsonPayload(typeof payload === "string" ? payload : payload.toString("utf8"));
    if (parsed == null) {
      const frame: CapturedWsFrame = {
        direction,
        capturedAt: new Date().toISOString(),
        payload: "[non-json]",
        kind: "non-json",
      };
      if (direction === "outgoing") this.outgoing.push(frame);
      else this.incoming.push(frame);
      return;
    }

    const sanitized = redactSecrets(parsed);
    const message = parseWebsocketMessage(sanitized);
    const kind =
      message.kind === "positionLast"
        ? "positionLast"
        : message.kind === "remindMsg"
          ? "remindMsg"
          : "other";

    if (kind === "positionLast" && direction === "incoming") {
      this.positionLastCount += 1;
    }

    const frame: CapturedWsFrame = {
      direction,
      capturedAt: new Date().toISOString(),
      payload: sanitized,
      kind,
    };

    if (direction === "outgoing") this.outgoing.push(frame);
    else this.incoming.push(frame);
  }
}
