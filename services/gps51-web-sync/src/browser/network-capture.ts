import { createHash } from "node:crypto";
import type { Page, Request, Response } from "playwright";
import { extractUrlAction, isTrackedAction, isAlarmOrAuxiliaryAction, isDeviceTreeAction } from "./action-url.js";
import { redactSecrets, sanitizeRequestPayload, sanitizeUrl } from "./redaction.js";
import { scoreJsonPayload } from "../gps51/device-response-parser.js";

export type CapturedResponse = {
  url: string;
  action: string | null;
  method: string;
  contentType: string | null;
  score: number;
  sanitizedBody: unknown;
  sanitizedRequest: unknown | null;
  capturedAt: string;
  payloadHash: string;
};

export type ActionCapture = {
  action: string;
  url: string;
  method: string;
  sanitizedResponse: unknown;
  sanitizedRequest: unknown | null;
  capturedAt: string;
};

export class NetworkCapture {
  private responses: CapturedResponse[] = [];
  private byAction = new Map<string, ActionCapture>();
  private pendingRequests = new Map<string, unknown>();

  attach(page: Page): void {
    page.on("request", (request) => {
      void this.handleRequest(request);
    });
    page.on("response", (response) => {
      void this.handleResponse(response);
    });
  }

  hasAction(action: string): boolean {
    return this.byAction.has(action.toLowerCase());
  }

  getActionCapture(action: string): ActionCapture | undefined {
    return this.byAction.get(action.toLowerCase());
  }

  getAllActionCaptures(): ActionCapture[] {
    return [...this.byAction.values()];
  }

  getCandidates(minScore = 3): CapturedResponse[] {
    return [...this.responses]
      .filter((r) => r.score >= minScore && !isAlarmOrAuxiliaryAction(r.action))
      .sort((a, b) => b.score - a.score);
  }

  getAll(): CapturedResponse[] {
    return [...this.responses];
  }

  private requestKey(url: string, method: string): string {
    return `${method}:${url}`;
  }

  private async handleRequest(request: Request): Promise<void> {
    const resourceType = request.resourceType();
    if (!["fetch", "xhr"].includes(resourceType)) return;

    const url = sanitizeUrl(request.url());
    if (!url.includes("webapi")) return;

    const action = extractUrlAction(url);
    if (!isTrackedAction(action) && !url.includes("webapi")) return;

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

  private async handleResponse(response: Response): Promise<void> {
    const request = response.request();
    const resourceType = request.resourceType();
    if (!["fetch", "xhr", "websocket"].includes(resourceType)) return;

    const contentType = response.headers()["content-type"] ?? null;
    if (contentType?.includes("image") || contentType?.includes("octet-stream")) return;

    const url = sanitizeUrl(response.url());
    if (/\.(png|jpg|jpeg|gif|webp|svg|woff|css)(\?|$)/i.test(url)) return;
    if (!url.includes("webapi")) return;

    const action = extractUrlAction(url);

    let body: unknown;
    try {
      if (contentType?.includes("json") || url.includes("webapi")) {
        body = await response.json();
      } else {
        const text = await response.text();
        if (text.startsWith("{") || text.startsWith("[")) {
          body = JSON.parse(text);
        } else {
          return;
        }
      }
    } catch {
      return;
    }

    const sanitizedBody = redactSecrets(body);
    const sanitizedRequest =
      this.pendingRequests.get(this.requestKey(url, request.method())) ?? null;

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
    if (isAlarmOrAuxiliaryAction(action)) score = Math.min(score, -20);
    if (isDeviceTreeAction(action)) score += 15;
    if (score <= -5 && !isTrackedAction(action)) return;

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

export async function waitForNetworkSettle(page: Page, timeoutMs: number): Promise<void> {
  await page.waitForLoadState("networkidle", { timeout: timeoutMs }).catch(() => undefined);
}

export async function waitForDiscoverySignals(
  page: Page,
  capture: NetworkCapture,
  minObserveMs: number,
  idleTimeoutMs: number,
): Promise<void> {
  const started = Date.now();

  while (Date.now() - started < idleTimeoutMs) {
    if (capture.hasAction("querydevicestree")) break;
    await page.waitForLoadState("networkidle", { timeout: 2000 }).catch(() => undefined);
    if (capture.hasAction("querydevicestree")) break;
    await page.waitForTimeout(500);
  }

  const elapsed = Date.now() - started;
  if (elapsed < minObserveMs) {
    await page.waitForTimeout(minObserveMs - elapsed);
  }
}
