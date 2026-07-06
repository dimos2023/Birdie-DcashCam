import type { Locator, Page } from "playwright";

export type SafeDomRect = {
  top: number | null;
  left: number | null;
  width: number | null;
  height: number | null;
};

export type SafeScrollMetrics = {
  top: number | null;
  height: number | null;
};

export type ClickTabResult = {
  clicked: boolean;
  matchedLabel: string | null;
  strategy: string | null;
};

export const STATUS_TAB_FALLBACKS = {
  all: ["All devices", "All Devices", "All", "全部设备", "全部"],
  online: ["Online", "Online devices", "On line", "在线", "在线设备"],
  offline: ["Offline", "Offline devices", "离线", "离线设备"],
} as const;

export const DEVICE_TREE_CONTAINER_SELECTORS = [
  ".device-tree",
  ".tree",
  "[class*='device-list']",
  "[class*='sidebar']",
  ".ivu-tree",
  ".el-tree",
  "[class*='monitor-tree']",
  "[class*='deviceTree']",
];

export const COUNT_BADGE_SELECTORS = [
  "[class*='badge']",
  "[class*='count']",
  ".ivu-badge-count",
  ".el-badge__content",
  "[class*='tab-count']",
];

export const MASTER_DEVICE_TREE_SELECTORS = [
  "input[type='checkbox'][class*='check-all']",
  ".ivu-tree .ivu-checkbox-wrapper:first-child input",
  "thead input[type='checkbox']",
  "[class*='select-all'] input[type='checkbox']",
  ".ivu-tree-title input[type='checkbox']",
  ".el-tree-node__content input[type='checkbox']",
];

export function normalizeDomRect(rect: {
  top?: number | null;
  left?: number | null;
  width?: number | null;
  height?: number | null;
} | null | undefined): SafeDomRect {
  const finite = (value: number | null | undefined): number | null =>
    typeof value === "number" && Number.isFinite(value) ? value : null;

  return {
    top: rect == null ? null : finite(rect.top),
    left: rect == null ? null : finite(rect.left),
    width: rect == null ? null : finite(rect.width),
    height: rect == null ? null : finite(rect.height),
  };
}

export function normalizeScrollMetrics(value: unknown): SafeScrollMetrics {
  if (value == null || typeof value !== "object") {
    return { top: null, height: null };
  }
  const record = value as Record<string, unknown>;
  return {
    top: typeof record.top === "number" && Number.isFinite(record.top) ? record.top : null,
    height:
      typeof record.height === "number" && Number.isFinite(record.height)
        ? record.height
        : null,
  };
}

export async function getSafeBoundingBox(locator: Locator): Promise<SafeDomRect | null> {
  try {
    if (!(await locator.isVisible().catch(() => false))) return null;
    const box = await locator.boundingBox();
    if (!box) return null;
    return normalizeDomRect(box);
  } catch {
    return null;
  }
}

export function pickTopmostRect(rects: Array<SafeDomRect | null | undefined>): SafeDomRect | null {
  const valid = rects.filter(
    (rect): rect is SafeDomRect => rect != null && rect.top != null,
  );
  if (valid.length === 0) return null;
  const sorted = [...valid].sort((a, b) => (a.top ?? 0) - (b.top ?? 0));
  return sorted[0] ?? null;
}

export async function readSafeDomRectFromLocator(locator: Locator): Promise<SafeDomRect | null> {
  const box = await getSafeBoundingBox(locator);
  if (box) return box;

  try {
    const evaluated = await locator.evaluate(`
      (function(el) {
        if (!el || typeof el.getBoundingClientRect !== "function") return null;
        var rect = el.getBoundingClientRect();
        return {
          top: Number.isFinite(rect.top) ? rect.top : null,
          left: Number.isFinite(rect.left) ? rect.left : null,
          width: Number.isFinite(rect.width) ? rect.width : null,
          height: Number.isFinite(rect.height) ? rect.height : null
        };
      })
    `);
    if (evaluated == null) return null;
    return normalizeDomRect(evaluated as SafeDomRect);
  } catch {
    return null;
  }
}

export async function scrollDeviceTreeSafely(page: Page): Promise<boolean> {
  const scrollers = page.locator(DEVICE_TREE_CONTAINER_SELECTORS.join(", "));
  const count = await scrollers.count();
  if (count === 0) return false;

  let moved = false;
  for (let i = 0; i < count; i++) {
    const scroller = scrollers.nth(i);
    const before = normalizeScrollMetrics(
      await scroller
        .evaluate("el => ({ top: el.scrollTop, height: el.scrollHeight })")
        .catch(() => null),
    );

    await scroller
      .evaluate("el => { el.scrollTop = Math.min(el.scrollTop + 500, el.scrollHeight); }")
      .catch(() => undefined);

    const after = normalizeScrollMetrics(
      await scroller
        .evaluate("el => ({ top: el.scrollTop, height: el.scrollHeight })")
        .catch(() => null),
    );

    if (
      before.top != null &&
      after.top != null &&
      after.top > before.top
    ) {
      moved = true;
    }
  }

  return moved;
}

export async function clickStatusTab(
  page: Page,
  tab: keyof typeof STATUS_TAB_FALLBACKS,
): Promise<ClickTabResult> {
  const labels = STATUS_TAB_FALLBACKS[tab];

  for (const label of labels) {
    const strategies: Array<{ name: string; locator: Locator }> = [
      { name: "role-tab", locator: page.getByRole("tab", { name: new RegExp(label, "i") }).first() },
      { name: "text", locator: page.locator(`text=${label}`).first() },
      { name: "button", locator: page.getByRole("button", { name: new RegExp(label, "i") }).first() },
      {
        name: "class-tab",
        locator: page.locator("[class*='tab'], .ivu-tabs-tab, .el-tabs__item").filter({ hasText: label }).first(),
      },
    ];

    for (const strategy of strategies) {
      if (!(await strategy.locator.isVisible().catch(() => false))) continue;
      await strategy.locator.click({ timeout: 3000 }).catch(() => undefined);
      await page.waitForTimeout(800);
      return { clicked: true, matchedLabel: label, strategy: strategy.name };
    }
  }

  return { clicked: false, matchedLabel: null, strategy: null };
}

export function buildFailureSummary(input: {
  startedAt: string;
  error: unknown;
}): Record<string, unknown> {
  const err = input.error;
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack ?? null : null;

  return {
    status: "failed",
    startedAt: input.startedAt,
    finishedAt: new Date().toISOString(),
    portalCounts: null,
    recommendedSource: null,
    validated: false,
    errorMessage: message,
    errorStack: stack,
  };
}
