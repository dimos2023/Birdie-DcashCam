import { createHash } from "node:crypto";
import { extractUrlAction } from "./action-url.js";
import { redactSecrets, sanitizeUrl } from "./redaction.js";
import { summarizeWebsocketSubscription, tryParseJsonPayload, } from "../gps51/live-state-analyzer.js";
const STATIC_ASSET_PATTERN = /\.(png|jpg|jpeg|gif|webp|svg|woff2?|css|ico|map)(\?|$)/i;
function inferTransportType(request) {
    const resourceType = request.resourceType();
    const url = request.url().toLowerCase();
    if (url.includes("graphql"))
        return "graphql";
    if (resourceType === "fetch")
        return "fetch";
    return "xhr";
}
function shouldSkipUrl(url) {
    if (STATIC_ASSET_PATTERN.test(url))
        return true;
    if (/\.(js)(\?|$)/i.test(url) && !url.includes("webapi"))
        return true;
    return false;
}
function endpointKey(transportType, url, action) {
    const sanitized = sanitizeUrl(url);
    return `${transportType}:${action ?? sanitized.split("?")[0]}`;
}
export class LiveNetworkCapture {
    captures = new Map();
    wsOutgoingMeta = new Map();
    attach(page) {
        page.on("response", (response) => {
            void this.handleResponse(response);
        });
        page.on("websocket", (ws) => {
            this.attachWebSocket(ws);
        });
    }
    getCaptures() {
        return [...this.captures.values()];
    }
    getWebSocketOutgoingMetadata() {
        return [...this.wsOutgoingMeta.entries()].map(([url, subscriptions]) => ({
            url: sanitizeUrl(url),
            subscriptions,
        }));
    }
    attachWebSocket(ws) {
        const url = sanitizeUrl(ws.url());
        ws.on("framereceived", (event) => {
            this.handleWebSocketFrame(url, event.payload, "incoming");
        });
        ws.on("framesent", (event) => {
            this.handleWebSocketFrame(url, event.payload, "outgoing");
        });
    }
    handleWebSocketFrame(url, payload, direction) {
        const parsed = tryParseJsonPayload(payload);
        if (!parsed)
            return;
        const sanitized = redactSecrets(parsed);
        if (direction === "outgoing") {
            const meta = summarizeWebsocketSubscription(sanitized);
            if (meta) {
                const existing = this.wsOutgoingMeta.get(url) ?? [];
                existing.push(meta);
                this.wsOutgoingMeta.set(url, existing.slice(-20));
            }
            return;
        }
        this.addPayload("websocket", url, extractUrlAction(url), sanitized);
    }
    addPayload(transportType, url, action, sanitizedBody) {
        const key = endpointKey(transportType, url, action);
        const existing = this.captures.get(key);
        if (existing) {
            existing.payloads.push(sanitizedBody);
            existing.frameCount += 1;
            return;
        }
        this.captures.set(key, {
            endpointKey: key,
            transportType,
            url: sanitizeUrl(url),
            action,
            payloads: [sanitizedBody],
            frameCount: 1,
        });
    }
    async handleResponse(response) {
        const request = response.request();
        const resourceType = request.resourceType();
        if (!["fetch", "xhr"].includes(resourceType))
            return;
        const url = sanitizeUrl(response.url());
        if (shouldSkipUrl(url))
            return;
        const contentType = response.headers()["content-type"] ?? "";
        if (contentType.includes("image") || contentType.includes("octet-stream"))
            return;
        let body;
        try {
            if (contentType.includes("json") || url.includes("webapi") || url.includes("graphql")) {
                body = await response.json();
            }
            else {
                const text = await response.text();
                body = tryParseJsonPayload(text);
                if (body == null)
                    return;
            }
        }
        catch {
            return;
        }
        const transportType = inferTransportType(request);
        const action = extractUrlAction(url);
        this.addPayload(transportType, url, action, redactSecrets(body));
    }
}
export function hashPayload(payload) {
    return createHash("sha256").update(JSON.stringify(payload).slice(0, 4000)).digest("hex");
}
export async function observeLiveNetwork(page, durationMs) {
    const started = Date.now();
    while (Date.now() - started < durationMs) {
        await page.waitForTimeout(1000);
    }
}
