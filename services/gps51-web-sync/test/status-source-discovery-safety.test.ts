import { describe, expect, it } from "vitest";
import {
  buildFailureSummary,
  clickStatusTab,
  getSafeBoundingBox,
  normalizeDomRect,
  normalizeScrollMetrics,
  pickTopmostRect,
  STATUS_TAB_FALLBACKS,
} from "../src/browser/monitor-dom-safety.js";

function mockPage(locators: Record<string, { visible?: boolean; click?: () => Promise<void> }>) {
  return {
    getByRole: () => ({
      first: () => makeLocator("role"),
    }),
    locator: (selector: string) => ({
      first: () => makeLocator(selector),
      filter: () => ({
        first: () => makeLocator("filter"),
      }),
    }),
    waitForTimeout: async () => undefined,
  };

  function makeLocator(key: string) {
    const config = locators[key] ?? { visible: false };
    return {
      isVisible: async () => config.visible ?? false,
      click: config.click ?? (async () => undefined),
      boundingBox: async () => null,
    };
  }
}

describe("monitor DOM safety", () => {
  it("normalizes null bounding boxes safely", () => {
    expect(normalizeDomRect(null)).toEqual({
      top: null,
      left: null,
      width: null,
      height: null,
    });
  });

  it("normalizes scroll metrics when evaluate returns undefined", () => {
    expect(normalizeScrollMetrics(undefined)).toEqual({ top: null, height: null });
    expect(normalizeScrollMetrics({ top: 10, height: 500 })).toEqual({
      top: 10,
      height: 500,
    });
  });

  it("does not read top from empty positioned-elements array", () => {
    expect(pickTopmostRect([])).toBeNull();
    expect(pickTopmostRect([null, undefined, { top: null, left: null, width: null, height: null }])).toBeNull();
  });

  it("picks the topmost valid rect after filtering nulls", () => {
    const top = pickTopmostRect([
      null,
      { top: 120, left: 0, width: 10, height: 10 },
      { top: 40, left: 0, width: 10, height: 10 },
    ]);
    expect(top?.top).toBe(40);
  });

  it("handles missing locator boundingBox as null", async () => {
    const locator = {
      isVisible: async () => false,
      boundingBox: async () => null,
    };
    const box = await getSafeBoundingBox(locator as never);
    expect(box).toBeNull();
  });

  it("handles null boundingBox from visible locator", async () => {
    const locator = {
      isVisible: async () => true,
      boundingBox: async () => null,
    };
    const box = await getSafeBoundingBox(locator as never);
    expect(box).toBeNull();
  });

  it("builds failure summary with stack trace", () => {
    const err = new Error("missing Online tab");
    const summary = buildFailureSummary({
      startedAt: "2026-06-29T10:00:00.000Z",
      error: err,
    });
    expect(summary.status).toBe("failed");
    expect(summary.portalCounts).toBeNull();
    expect(summary.recommendedSource).toBeNull();
    expect(summary.validated).toBe(false);
    expect(summary.errorMessage).toBe("missing Online tab");
    expect(typeof summary.errorStack).toBe("string");
    expect(String(summary.errorStack)).toContain("missing Online tab");
  });

  it("returns safe result when Online tab is missing", async () => {
    const page = mockPage({});
    const result = await clickStatusTab(page as never, "online");
    expect(result.clicked).toBe(false);
    expect(result.matchedLabel).toBeNull();
    expect(result.strategy).toBeNull();
  });

  it("returns safe result when Offline tab is missing", async () => {
    const page = mockPage({});
    const result = await clickStatusTab(page as never, "offline");
    expect(result.clicked).toBe(false);
    expect(result.matchedLabel).toBeNull();
  });

  it("exposes fallback label arrays for all status tabs", () => {
    expect(STATUS_TAB_FALLBACKS.all.length).toBeGreaterThan(0);
    expect(STATUS_TAB_FALLBACKS.online.length).toBeGreaterThan(0);
    expect(STATUS_TAB_FALLBACKS.offline.length).toBeGreaterThan(0);
  });
});
