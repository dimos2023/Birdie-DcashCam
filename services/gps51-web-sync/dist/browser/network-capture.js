import { createHash } from "node:crypto";
import { extractUrlAction, isTrackedAction, isAlarmOrAuxiliaryAction, isDeviceTreeAction } from "./action-url.js";
import { redactSecrets, sanitizeRequestPayload, sanitizeUrl } from "./redaction.js";
import { scoreJsonPayload } from "../gps51/device-response-parser.js";
export class NetworkCapture {
    responses = [];
    byAction = new Map();
    pendingRequests = new Map();
    attach(page) {
        page.on("request", (request) => {
            void this.handleRequest(request);
        });
        page.on("response", (response) => {
            void this.handleResponse(response);
        });
    }
    hasAction(action) {
        return this.byAction.has(action.toLowerCase());
    }
    getActionCapture(action) {
        return this.byAction.get(action.toLowerCase());
    }
    getAllActionCaptures() {
        return [...this.byAction.values()];
    }
    getCandidates(minScore = 3) {
        return [...this.responses]
            .filter((r) => r.score >= minScore && !isAlarmOrAuxiliaryAction(r.action))
            .sort((a, b) => b.score - a.score);
    }
    getAll() {
        return [...this.responses];
    }
    requestKey(url, method) {
        return `${method}:${url}`;
    }
    async handleRequest(request) {
        const resourceType = request.resourceType();
        if (!["fetch", "xhr"].includes(resourceType))
            return;
        const url = sanitizeUrl(request.url());
        if (!url.includes("webapi"))
            return;
        const action = extractUrlAction(url);
        if (!isTrackedAction(action) && !url.includes("webapi"))
            return;
        const sanitized = sanitizeRequestPayload(request.postData());
        if (sanitized != null) {
            this.pendingRequests.set(this.requestKey(url, request.method()), sanitized);
            if (isTrackedAction(action)) {
                const existing = this.byAction.get(action);
                this.byAction.set(action, {
                    action,
                    url,
                    method: request.method(),
                    sanitizedResponse: existing?.sanitizedResponse ?? null,
                    sanitizedRequest: sanitized,
                    capturedAt: existing?.capturedAt ?? new Date().toISOString(),
                });
            }
        }
    }
    async handleResponse(response) {
        const request = response.request();
        const resourceType = request.resourceType();
        if (!["fetch", "xhr", "websocket"].includes(resourceType))
            return;
        const contentType = response.headers()["content-type"] ?? null;
        if (contentType?.includes("image") || contentType?.includes("octet-stream"))
            return;
        const url = sanitizeUrl(response.url());
        if (/\.(png|jpg|jpeg|gif|webp|svg|woff|css)(\?|$)/i.test(url))
            return;
        if (!url.includes("webapi"))
            return;
        const action = extractUrlAction(url);
        let body;
        try {
            if (contentType?.includes("json") || url.includes("webapi")) {
                body = await response.json();
            }
            else {
                const text = await response.text();
                if (text.startsWith("{") || text.startsWith("[")) {
                    body = JSON.parse(text);
                }
                else {
                    return;
                }
            }
        }
        catch {
            return;
        }
        const sanitizedBody = redactSecrets(body);
        const sanitizedRequest = this.pendingRequests.get(this.requestKey(url, request.method())) ?? null;
        if (isTrackedAction(action)) {
            this.byAction.set(action, {
                action,
                url,
                method: request.method(),
                sanitizedResponse: sanitizedBody,
                sanitizedRequest: sanitizedRequest,
                capturedAt: new Date().toISOString(),
            });
        }
        let score = scoreJsonPayload(sanitizedBody, url, action);
        if (isAlarmOrAuxiliaryAction(action))
            score = Math.min(score, -20);
        if (isDeviceTreeAction(action))
            score += 15;
        if (score <= -5 && !isTrackedAction(action))
            return;
        const payloadHash = createHash("sha256")
            .update(`${url}:${JSON.stringify(sanitizedBody).slice(0, 4000)}`)
            .digest("hex");
        this.responses.push({
            url,
            action,
            method: request.method(),
            contentType,
            score,
            sanitizedBody,
            sanitizedRequest: sanitizedRequest,
            capturedAt: new Date().toISOString(),
            payloadHash,
        });
    }
}
export async function waitForNetworkSettle(page, timeoutMs) {
    await page.waitForLoadState("networkidle", { timeout: timeoutMs }).catch(() => undefined);
}
export async function waitForDiscoverySignals(page, capture, minObserveMs, idleTimeoutMs) {
    const started = Date.now();
    while (Date.now() - started < idleTimeoutMs) {
        if (capture.hasAction("querydevicestree"))
            break;
        await page.waitForLoadState("networkidle", { timeout: 2000 }).catch(() => undefined);
        if (capture.hasAction("querydevicestree"))
            break;
        await page.waitForTimeout(500);
    }
    const elapsed = Date.now() - started;
    if (elapsed < minObserveMs) {
        await page.waitForTimeout(minObserveMs - elapsed);
    }
}
