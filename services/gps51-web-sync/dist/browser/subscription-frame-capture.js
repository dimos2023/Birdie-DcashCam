import { redactSecrets } from "./redaction.js";
import { isGps51LiveWebSocketUrl } from "./live-websocket-listener.js";
import { tryParseJsonPayload } from "../gps51/live-state-analyzer.js";
import { parseWebsocketMessage } from "../gps51/position-last-parser.js";
export class SubscriptionFrameCapture {
    sockets = new Set();
    outgoing = [];
    incoming = [];
    positionLastCount = 0;
    attach(page) {
        const onWebSocket = (ws) => {
            if (!isGps51LiveWebSocketUrl(ws.url()))
                return;
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
    beginAction() {
        this.outgoing = [];
        this.incoming = [];
        this.positionLastCount = 0;
    }
    snapshotAction(action, selectedDeviceCountHint) {
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
    getOpenSocketCount() {
        return this.sockets.size;
    }
    pushFrame(direction, payload) {
        const parsed = tryParseJsonPayload(typeof payload === "string" ? payload : payload.toString("utf8"));
        if (parsed == null) {
            const frame = {
                direction,
                capturedAt: new Date().toISOString(),
                payload: "[non-json]",
                kind: "non-json",
            };
            if (direction === "outgoing")
                this.outgoing.push(frame);
            else
                this.incoming.push(frame);
            return;
        }
        const sanitized = redactSecrets(parsed);
        const message = parseWebsocketMessage(sanitized);
        const kind = message.kind === "positionLast"
            ? "positionLast"
            : message.kind === "remindMsg"
                ? "remindMsg"
                : "other";
        if (kind === "positionLast" && direction === "incoming") {
            this.positionLastCount += 1;
        }
        const frame = {
            direction,
            capturedAt: new Date().toISOString(),
            payload: sanitized,
            kind,
        };
        if (direction === "outgoing")
            this.outgoing.push(frame);
        else
            this.incoming.push(frame);
    }
}
