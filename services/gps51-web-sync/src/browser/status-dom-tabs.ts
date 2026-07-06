import type { Page } from "playwright";
import { STATUS_TAB_FALLBACKS } from "./monitor-dom-safety.js";
import { readPortalStatusCounts } from "./monitor-subscription.js";
import { normalizeRecordArray } from "./status-dom-normalize.js";
import type { DomPortalCounts } from "../gps51/status-dom-reconciliation.js";

export type TabClickDiagnostics = {
  clicked: boolean;
  matchedLabel: string | null;
  matchedElementTag: string | null;
  matchedElementClasses: string | null;
  clickableAncestorTag: string | null;
  clickableAncestorClasses: string | null;
  textBeforeClick: string | null;
  textAfterClick: string | null;
  strategy: string | null;
};

export type TabSelectionEvidence = {
  ariaSelected: boolean;
  activeClass: boolean;
  classChangedAfterClick: boolean;
  portalCountMatches: boolean;
  rowSignatureChanged: boolean;
  anotherTabLostActive: boolean;
  selected: boolean;
  reasons: string[];
};

export function buildClickStatusTabScript(labels: string[]): string {
  const serializedLabels = JSON.stringify(labels);
  return `(() => {
    const labels = ${serializedLabels};
    const tabClassPattern = /tab|ivu-tabs|el-tabs|nav-item|menu-item/i;
    const activePattern = /active|selected|current|is-active|is-checked|ivu-tabs-tab-active/i;

    function normalize(text) {
      return (text || "").replace(/\\s+/g, " ").trim().toLowerCase();
    }

    function isClickable(el) {
      if (!el || el.nodeType !== 1) return false;
      const tag = el.tagName ? el.tagName.toLowerCase() : "";
      if (tag === "button" || tag === "a" || tag === "li") return true;
      const role = el.getAttribute("role");
      if (role === "tab" || role === "button") return true;
      const cls = el.className || "";
      if (typeof cls === "string" && tabClassPattern.test(cls)) return true;
      if (typeof el.onclick === "function") return true;
      return false;
    }

    function findTextElement(label) {
      const target = normalize(label);
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const text = normalize(node.textContent || "");
        if (!text) continue;
        if (text === target || text.indexOf(target) >= 0) {
          const parent = node.parentElement;
          if (parent) return parent;
        }
      }
      const candidates = document.querySelectorAll("[class*='tab'], .ivu-tabs-tab, .el-tabs__item, button, a, li");
      for (let i = 0; i < candidates.length; i++) {
        const el = candidates[i];
        const text = normalize(el.textContent || "");
        if (text === target || text.indexOf(target) >= 0) return el;
      }
      return null;
    }

    function findClickableAncestor(el) {
      let current = el;
      let depth = 0;
      while (current && depth < 8) {
        if (isClickable(current)) return current;
        current = current.parentElement;
        depth += 1;
      }
      return el;
    }

    for (let i = 0; i < labels.length; i++) {
      const label = labels[i];
      const matched = findTextElement(label);
      if (!matched) continue;
      const clickable = findClickableAncestor(matched);
      const textBefore = normalize(clickable.textContent || "");
      try {
        clickable.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        clickable.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
        clickable.click();
      } catch (e) {}
      const textAfter = normalize(clickable.textContent || "");
      return {
        clicked: true,
        matchedLabel: label,
        matchedElementTag: matched.tagName || null,
        matchedElementClasses: typeof matched.className === "string" ? matched.className : null,
        clickableAncestorTag: clickable.tagName || null,
        clickableAncestorClasses: typeof clickable.className === "string" ? clickable.className : null,
        textBeforeClick: textBefore,
        textAfterClick: textAfter,
        strategy: "clickable_ancestor",
        classChangedAfterClick: textBefore !== textAfter || activePattern.test(clickable.className || "")
      };
    }

    return {
      clicked: false,
      matchedLabel: null,
      matchedElementTag: null,
      matchedElementClasses: null,
      clickableAncestorTag: null,
      clickableAncestorClasses: null,
      textBeforeClick: null,
      textAfterClick: null,
      strategy: null,
      classChangedAfterClick: false
    };
  })()`;
}

export function normalizeTabClickDiagnostics(raw: unknown): TabClickDiagnostics {
  const record = normalizeRecordArray([raw])[0] ?? {};
  return {
    clicked: Boolean(record.clicked),
    matchedLabel: typeof record.matchedLabel === "string" ? record.matchedLabel : null,
    matchedElementTag: typeof record.matchedElementTag === "string" ? record.matchedElementTag : null,
    matchedElementClasses:
      typeof record.matchedElementClasses === "string" ? record.matchedElementClasses : null,
    clickableAncestorTag:
      typeof record.clickableAncestorTag === "string" ? record.clickableAncestorTag : null,
    clickableAncestorClasses:
      typeof record.clickableAncestorClasses === "string" ? record.clickableAncestorClasses : null,
    textBeforeClick: typeof record.textBeforeClick === "string" ? record.textBeforeClick : null,
    textAfterClick: typeof record.textAfterClick === "string" ? record.textAfterClick : null,
    strategy: typeof record.strategy === "string" ? record.strategy : null,
  };
}

export async function clickStatusTabSafely(
  page: Page,
  tab: keyof typeof STATUS_TAB_FALLBACKS,
): Promise<TabClickDiagnostics & { classChangedAfterClick: boolean }> {
  const labels = [...STATUS_TAB_FALLBACKS[tab]];
  const raw = await page.evaluate(buildClickStatusTabScript(labels)).catch(() => null);
  const record = normalizeRecordArray([raw])[0] ?? {};
  const diagnostics = normalizeTabClickDiagnostics(raw);
  return {
    ...diagnostics,
    classChangedAfterClick: Boolean(record.classChangedAfterClick),
  };
}

function resolveTabPortalCount(
  counts: DomPortalCounts,
  tab: keyof typeof STATUS_TAB_FALLBACKS,
): number | null {
  if (tab === "online") return counts.online;
  if (tab === "offline") return counts.offline;
  return counts.all;
}

export async function waitForStablePortalCount(
  page: Page,
  tab: keyof typeof STATUS_TAB_FALLBACKS,
  settleMs: number,
): Promise<{ before: number | null; after: number | null; counts: DomPortalCounts }> {
  await page.waitForTimeout(settleMs);
  const reads: DomPortalCounts[] = [];
  for (let i = 0; i < 4; i++) {
    reads.push(
      await readPortalStatusCounts(page).catch(() => ({
        all: null,
        online: null,
        offline: null,
      })),
    );
    await page.waitForTimeout(400);
  }

  const before = resolveTabPortalCount(reads[0] ?? { all: null, online: null, offline: null }, tab);
  let after = before;
  for (let i = 1; i < reads.length; i++) {
    const value = resolveTabPortalCount(reads[i]!, tab);
    if (value != null && value === after) {
      after = value;
      return { before, after, counts: reads[i]! };
    }
    if (value != null) after = value;
  }

  return { before, after, counts: reads[reads.length - 1] ?? { all: null, online: null, offline: null } };
}

export async function waitForLoadingToSettle(page: Page, timeoutMs = 8000): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const loading = await page
      .locator(
        ".ivu-spin, .el-loading-mask, [class*='loading'], [class*='spinner'], .vxe-loading",
      )
      .first()
      .isVisible()
      .catch(() => false);
    if (!loading) return true;
    await page.waitForTimeout(250);
  }
  return false;
}

export function buildTabSelectionEvidence(input: {
  clickDiagnostics: TabClickDiagnostics & { classChangedAfterClick?: boolean };
  ariaSelected: boolean;
  activeClass: boolean;
  portalCountMatches: boolean;
  rowSignatureChanged: boolean;
  anotherTabLostActive: boolean;
}): TabSelectionEvidence {
  const reasons: string[] = [];
  if (input.ariaSelected) reasons.push("aria_selected");
  if (input.activeClass) reasons.push("active_class");
  if (input.clickDiagnostics.classChangedAfterClick) reasons.push("class_changed_after_click");
  if (input.portalCountMatches) reasons.push("portal_count_matches");
  if (input.rowSignatureChanged) reasons.push("row_signature_changed");
  if (input.anotherTabLostActive) reasons.push("another_tab_lost_active");

  return {
    ariaSelected: input.ariaSelected,
    activeClass: input.activeClass,
    classChangedAfterClick: Boolean(input.clickDiagnostics.classChangedAfterClick),
    portalCountMatches: input.portalCountMatches,
    rowSignatureChanged: input.rowSignatureChanged,
    anotherTabLostActive: input.anotherTabLostActive,
    selected: reasons.length > 0,
    reasons,
  };
}

export function buildInspectTabActiveStateScript(labels: string[]): string {
  const serializedLabels = JSON.stringify(labels);
  return `(() => {
    const labels = ${serializedLabels};
    const activePattern = /active|selected|current|is-active|is-checked|ivu-tabs-tab-active/i;
    function normalize(text) {
      return (text || "").replace(/\\s+/g, " ").trim().toLowerCase();
    }
    const nodes = document.querySelectorAll("[class*='tab'], .ivu-tabs-tab, .el-tabs__item, [role='tab']");
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i];
      const text = normalize(el.textContent || "");
      for (let j = 0; j < labels.length; j++) {
        const label = normalize(labels[j]);
        if (!label || text.indexOf(label) < 0) continue;
        const ariaSelected = el.getAttribute("aria-selected") === "true";
        const activeClass = activePattern.test(el.className || "");
        if (ariaSelected || activeClass) {
          return { ariaSelected: ariaSelected, activeClass: activeClass };
        }
      }
    }
    return { ariaSelected: false, activeClass: false };
  })()`;
}

export async function inspectTabActiveState(
  page: Page,
  tab: keyof typeof STATUS_TAB_FALLBACKS,
): Promise<{ ariaSelected: boolean; activeClass: boolean }> {
  const labels = [...STATUS_TAB_FALLBACKS[tab]];
  const result = await page
    .evaluate(buildInspectTabActiveStateScript(labels))
    .catch(() => ({ ariaSelected: false, activeClass: false }));

  const record = normalizeRecordArray([result])[0] ?? {};
  return {
    ariaSelected: Boolean(record.ariaSelected),
    activeClass: Boolean(record.activeClass),
  };
}
