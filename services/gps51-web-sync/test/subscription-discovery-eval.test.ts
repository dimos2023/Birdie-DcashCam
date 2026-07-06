import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  assertBrowserScriptSafe,
  buildWebSocketSendScript,
  parsePortalStatusCountsFromText,
} from "../src/browser/browser-page-scripts.js";

const serviceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const EVAL_CALLBACK_PATTERN =
  /page\.evaluate\s*\(\s*(\(|async\s*\(|function\s)/;

function readServiceSource(relativePath: string): string {
  return readFileSync(path.join(serviceRoot, relativePath), "utf8");
}

describe("subscription discovery browser scripts", () => {
  it("does not inject __name into websocket send script", () => {
    const script = buildWebSocketSendScript(
      JSON.stringify({ action: "subscribe", deviceids: ["860000000000001"] }),
    );
    expect(script).not.toContain("__name");
    assertBrowserScriptSafe(script);
  });

  it("parses portal status counts from body text in Node", () => {
    const counts = parsePortalStatusCountsFromText(
      "All devices (605)\nOnline (42)\nOffline (563)",
    );
    expect(counts.all).toBe(605);
    expect(counts.online).toBe(42);
    expect(counts.offline).toBe(563);
  });

  it("subscription-discovery.ts does not pass function callbacks to page.evaluate", () => {
    const src = readServiceSource("src/browser/subscription-discovery.ts");
    expect(src).not.toMatch(EVAL_CALLBACK_PATTERN);
    expect(src).not.toMatch(/evaluateHandle|waitForFunction|addInitScript|evaluateAll/);
  });

  it("monitor-subscription.ts does not pass function callbacks to page.evaluate", () => {
    const src = readServiceSource("src/browser/monitor-subscription.ts");
    expect(src).not.toMatch(EVAL_CALLBACK_PATTERN);
    expect(src).not.toMatch(/evaluateHandle|waitForFunction|addInitScript|evaluateAll/);
  });

  it("browser-page-scripts.ts string literals do not reference __name", () => {
    const src = readServiceSource("src/browser/browser-page-scripts.ts");
    const scriptLiterals = src.match(/`[^`]*`/g) ?? [];
    expect(scriptLiterals.length).toBeGreaterThan(0);
    for (const literal of scriptLiterals) {
      expect(literal).not.toContain("__name");
    }
  });
});
