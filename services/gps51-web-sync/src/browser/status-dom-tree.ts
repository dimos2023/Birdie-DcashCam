import type { Locator, Page } from "playwright";
import {
  DEVICE_TREE_CONTAINER_SELECTORS,
  normalizeScrollMetrics,
} from "./monitor-dom-safety.js";
import { extractInventoryMatchesFromTexts } from "../gps51/status-dom-matcher.js";
import {
  describeEvaluateResultType,
  normalizeRecordArray,
  normalizeStringArray,
} from "./status-dom-normalize.js";

export {
  describeEvaluateResultType,
  normalizeRecordArray as normalizeEvaluateObjectRecords,
  normalizeStringArray as normalizeEvaluateStringArray,
} from "./status-dom-normalize.js";

export const TREE_EXPAND_SELECTORS = [
  "[aria-expanded='false']",
  ".ivu-tree-arrow",
  ".el-tree-node__expand-icon",
  ".tree-switcher",
  "[class*='expand-icon']",
];

export const TREE_ROW_SELECTORS = [
  ".ivu-tree-title",
  ".el-tree-node__content",
  ".tree-node-content",
  "[class*='tree-node']",
  "[class*='device-row']",
  "label",
  "[title]",
  "[data-deviceid]",
  "[data-device-id]",
  "[data-id]",
];

export type TreeExpansionResult = {
  expansionPasses: number;
  expandClicks: number;
};

export type ScrollContainerCandidate = {
  selector: string;
  domPath: string;
  score: number;
  scrollHeight: number;
  clientHeight: number;
  inventoryIdHits: number;
  inventoryNameHits?: number;
  visibleRowCount?: number;
  checkboxCount: number;
};

export type ScrollCollectionResult = {
  deviceIds: string[];
  scrollPasses: number;
  textsCollected: number;
};

export type ContainerDiscoveryDiagnostics = {
  rawCandidateType: string;
  candidateCount: number;
  validCandidateCount: number;
  selectedContainerFound: boolean;
};

export type DiscoverTreeScrollContainerResult = {
  selectedContainer: ScrollContainerCandidate | null;
  candidates: ScrollContainerCandidate[];
  reason: string | null;
  selectedContainerRejectedReason: string | null;
  diagnostics: ContainerDiscoveryDiagnostics;
};

export function buildScrollContainerDiscoveryScript(
  inventorySample: string[],
  treeSelectors: string[],
): string {
  const serializedInventorySample = JSON.stringify(inventorySample);
  const serializedSelectors = JSON.stringify(treeSelectors);

  return `(() => {
    const inventorySample = ${serializedInventorySample};
    const selectors = ${serializedSelectors};
    try {
      const out = [];
      const seen = new Set();
      const nodes = Array.prototype.slice.call(document.querySelectorAll("*"));

      function cssPath(el) {
        if (!el || !el.tagName) return "";
        const parts = [];
        let current = el;
        while (current && current.nodeType === 1 && parts.length < 6) {
          let part = current.tagName.toLowerCase();
          if (current.id) {
            parts.unshift("#" + current.id);
            break;
          }
          if (current.className && typeof current.className === "string") {
            const cls = current.className.trim().split(/\\s+/).slice(0, 2).join(".");
            if (cls) part += "." + cls;
          }
          parts.unshift(part);
          current = current.parentElement;
        }
        return parts.join(" > ");
      }

      function countInventoryHits(text) {
        let hits = 0;
        for (let i = 0; i < inventorySample.length; i++) {
          if (text.indexOf(inventorySample[i]) >= 0) hits += 1;
        }
        return hits;
      }

      for (let i = 0; i < nodes.length; i++) {
        const el = nodes[i];
        if (!el || seen.has(el)) continue;
        if (el.scrollHeight <= el.clientHeight + 1) continue;
        if (el.clientHeight < 80) continue;

        const rect = el.getBoundingClientRect();
        if (!rect || rect.height <= 0) continue;

        const text = el.innerText || "";
        const checkboxCount = el.querySelectorAll("input[type='checkbox']").length;
        const inventoryIdHits = countInventoryHits(text);
        const rowHits = countInventoryHits(
          Array.prototype.map.call(
            el.querySelectorAll(".vxe-body--row, .vxe-table--body tr, .ivu-tree-title, .el-tree-node__content"),
            function(row) { return row.innerText || ""; }
          ).join("\\n")
        );
        const effectiveInventoryHits = Math.max(inventoryIdHits, rowHits);
        const hasVxeWrapper = !!(
          el.matches(".vxe-table, .vxe-table--body-wrapper, .vxe-table--render-wrapper") ||
          el.querySelector(".vxe-table, .vxe-table--body-wrapper, .vxe-table--render-wrapper")
        );
        let matchesTreeSelector = false;
        for (let s = 0; s < selectors.length; s++) {
          try {
            if (el.matches(selectors[s]) || el.querySelector(selectors[s])) {
              matchesTreeSelector = true;
              break;
            }
          } catch (e) {}
        }

        const selector = cssPath(el);
        if (!selector || seen.has(selector)) continue;
        seen.add(selector);
        seen.add(el);

        out.push({
          selector: selector,
          domPath: selector,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
          left: Number.isFinite(rect.left) ? rect.left : null,
          width: Number.isFinite(rect.width) ? rect.width : null,
          checkboxCount: checkboxCount,
          inventoryIdHits: effectiveInventoryHits,
          matchesTreeSelector: matchesTreeSelector,
          hasVxeWrapper: hasVxeWrapper,
        });
      }

      return Array.isArray(out) ? out : [];
    } catch (e) {
      return [];
    }
  })()`;
}

export function scoreScrollContainerCandidates(
  candidates: Record<string, unknown>[],
): ScrollContainerCandidate[] {
  const scored = candidates
    .map((candidate) => {
      const score = scoreScrollContainer({
        scrollHeight: Number(candidate.scrollHeight ?? 0),
        clientHeight: Number(candidate.clientHeight ?? 0),
        left: typeof candidate.left === "number" ? candidate.left : null,
        width: typeof candidate.width === "number" ? candidate.width : null,
        checkboxCount: Number(candidate.checkboxCount ?? 0),
        inventoryIdHits: Number(candidate.inventoryIdHits ?? 0),
        matchesTreeSelector: Boolean(candidate.matchesTreeSelector),
        hasVxeWrapper: Boolean(candidate.hasVxeWrapper),
      });
      return {
        selector: String(candidate.selector ?? ""),
        domPath: String(candidate.domPath ?? candidate.selector ?? ""),
        score,
        scrollHeight: Number(candidate.scrollHeight ?? 0),
        clientHeight: Number(candidate.clientHeight ?? 0),
        inventoryIdHits: Number(candidate.inventoryIdHits ?? 0),
        checkboxCount: Number(candidate.checkboxCount ?? 0),
      } satisfies ScrollContainerCandidate;
    })
    .filter((candidate) => candidate.score > 0 && isAuthoritativeScrollContainer(candidate))
    .sort((a, b) => b.score - a.score);

  return scored;
}

export function buildScrollContainerDiscoveryResult(
  rawCandidates: unknown,
): DiscoverTreeScrollContainerResult {
  const rawCandidateType = describeEvaluateResultType(rawCandidates);
  const candidateCount = Array.isArray(rawCandidates) ? rawCandidates.length : 0;
  const candidates = normalizeRecordArray(rawCandidates);
  const validCandidateCount = candidates.length;
  const allScored = scoreScrollContainerCandidates(candidates);
  const scored = allScored.filter((candidate) => isAuthoritativeScrollContainer(candidate));
  const rejectedTop = allScored[0] ?? null;
  const selectedContainer = scored[0] ?? null;

  return {
    selectedContainer,
    candidates: scored,
    reason: selectedContainer ? null : "no_scroll_container_candidates",
    selectedContainerRejectedReason: selectedContainer
      ? null
      : getContainerRejectionReason(rejectedTop),
    diagnostics: {
      rawCandidateType,
      candidateCount,
      validCandidateCount,
      selectedContainerFound: selectedContainer != null,
    },
  };
}

export function logContainerDiscoveryDiagnostics(diagnostics: ContainerDiscoveryDiagnostics): void {
  console.info(
    JSON.stringify({
      msg: "GPS51 scroll container discovery",
      evaluateResultType: diagnostics.rawCandidateType,
      normalizedCandidateCount: diagnostics.validCandidateCount,
      selectedContainerFound: diagnostics.selectedContainerFound,
      candidateCount: diagnostics.candidateCount,
    }),
  );
}

export function scoreScrollContainer(input: {
  scrollHeight: number;
  clientHeight: number;
  left: number | null;
  width: number | null;
  checkboxCount: number;
  inventoryIdHits: number;
  inventoryNameHits?: number;
  matchesTreeSelector: boolean;
  hasVxeWrapper?: boolean;
}): number {
  const nameHits = input.inventoryNameHits ?? 0;
  const totalHits = input.inventoryIdHits + nameHits;
  if (input.clientHeight <= 0 && !input.hasVxeWrapper) return 0;
  if (totalHits <= 0) return 0;

  let score = 10;
  if (input.matchesTreeSelector) score += 15;
  if (input.hasVxeWrapper) score += 20;
  score += Math.min(input.inventoryIdHits * 10, 200);
  score += Math.min(nameHits * 8, 160);
  score += Math.min(input.checkboxCount, 5);
  if (input.scrollHeight > input.clientHeight) {
    score += Math.min(Math.floor((input.scrollHeight - input.clientHeight) / 100), 20);
  }

  if (input.left != null && input.left < 500) score += 10;
  if (input.width != null && input.width < 600) score += 5;

  return score;
}

export function isAuthoritativeScrollContainer(candidate: ScrollContainerCandidate): boolean {
  const nameHits = candidate.inventoryNameHits ?? 0;
  return candidate.inventoryIdHits > 0 || nameHits > 0;
}

export function getContainerRejectionReason(candidate: ScrollContainerCandidate | null): string | null {
  if (!candidate) return null;
  const nameHits = candidate.inventoryNameHits ?? 0;
  if (candidate.inventoryIdHits > 0 || nameHits > 0) return null;
  return "inventory_id_hits_zero";
}

export function shouldStopTreeExpansion(stalePasses: number, maxStalePasses = 3): boolean {
  return stalePasses >= maxStalePasses;
}

export async function expandTreeNodesRecursively(page: Page): Promise<TreeExpansionResult> {
  let expansionPasses = 0;
  let expandClicks = 0;
  let stalePasses = 0;

  while (!shouldStopTreeExpansion(stalePasses)) {
    expansionPasses += 1;
    let clickedThisPass = 0;

    for (const selector of TREE_EXPAND_SELECTORS) {
      const nodes = page.locator(selector);
      const count = Math.min(await nodes.count().catch(() => 0), 250);
      for (let i = 0; i < count; i++) {
        const node = nodes.nth(i);
        if (!(await node.isVisible().catch(() => false))) continue;
        await node.click({ timeout: 1500 }).catch(() => undefined);
        clickedThisPass += 1;
        expandClicks += 1;
        await page.waitForTimeout(80);
      }
    }

    if (clickedThisPass === 0) stalePasses += 1;
    else stalePasses = 0;

    await page.waitForTimeout(250);
  }

  return { expansionPasses, expandClicks };
}

export async function discoverTreeScrollContainer(
  page: Page,
  inventoryIds: Set<string>,
): Promise<DiscoverTreeScrollContainerResult> {
  const inventorySample = [...inventoryIds].slice(0, 40);
  const script = buildScrollContainerDiscoveryScript(inventorySample, [
    ...DEVICE_TREE_CONTAINER_SELECTORS,
  ]);
  const rawCandidates = await page.evaluate(script).catch(() => []);

  const result = buildScrollContainerDiscoveryResult(rawCandidates);
  logContainerDiscoveryDiagnostics(result.diagnostics);
  return result;
}

async function collectVisibleTreeTexts(page: Page, container: Locator): Promise<string[]> {
  const texts: string[] = [];

  const bodySnippet = await page.locator("body").innerText().catch(() => "");
  if (bodySnippet) texts.push(bodySnippet.slice(0, 50_000));

  for (const selector of TREE_ROW_SELECTORS) {
    const rows = container.locator(selector);
    const count = Math.min(await rows.count().catch(() => 0), 400);
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      if (!(await row.isVisible().catch(() => false))) continue;
      const inner = (await row.innerText().catch(() => "")).trim();
      if (inner) texts.push(inner);
      const title = await row.getAttribute("title").catch(() => null);
      if (title) texts.push(title);
    }
  }

  const attributeTexts = normalizeStringArray(
    await container
      .evaluate(
        `(root) => {
        try {
        var out = [];
        if (!root) return out;
        var nodes = root.querySelectorAll("[title], [data-deviceid], [data-device-id], [data-id], label");
        for (var i = 0; i < nodes.length && i < 500; i++) {
          var node = nodes[i];
          var title = node.getAttribute("title");
          if (title) out.push(title);
          var attrs = node.attributes;
          for (var j = 0; j < attrs.length; j++) {
            var name = attrs[j].name;
            if (name.indexOf("data-") === 0) out.push(attrs[j].value || "");
          }
          var labelText = node.textContent || "";
          if (labelText) out.push(labelText);
        }
        return Array.isArray(out) ? out : [];
        } catch (e) {
          return [];
        }
      }`,
      )
      .catch(() => []),
  );

  if (attributeTexts.length > 0) {
    texts.push(...attributeTexts);
  }
  return texts;
}

export async function scrollContainerAndCollectIds(
  page: Page,
  containerSelector: string,
  inventoryIds: Set<string>,
  expectedCount: number | null,
): Promise<ScrollCollectionResult> {
  const collected = new Set<string>();
  let textsCollected = 0;
  let scrollPasses = 0;

  const runPass = async (): Promise<number> => {
    const container = page.locator(containerSelector).first();
    const hasContainer = (await container.count().catch(() => 0)) > 0;
    const target = hasContainer ? container : page.locator("body");

    await target
      .evaluate("el => { if (el && el.scrollTop != null) el.scrollTop = 0; }")
      .catch(() => undefined);
    await page.waitForTimeout(200);

    let passes = 0;
    for (let step = 0; step < 250; step++) {
      const metrics = normalizeScrollMetrics(
        await target
          .evaluate("el => ({ top: el.scrollTop, height: el.scrollHeight, client: el.clientHeight })")
          .catch(() => null),
      );

      const texts = await collectVisibleTreeTexts(page, target);
      textsCollected += texts.length;
      for (const id of extractInventoryMatchesFromTexts(texts, inventoryIds)) {
        collected.add(id);
      }

      passes += 1;
      if (metrics.top == null || metrics.height == null) break;

      const clientHeightRaw = await target
        .evaluate("el => (el && typeof el.clientHeight === 'number') ? el.clientHeight : 0")
        .catch(() => 0);
      const clientHeight =
        typeof clientHeightRaw === "number" && Number.isFinite(clientHeightRaw) ? clientHeightRaw : 0;
      if (clientHeight <= 0) break;

      const scrollTop = metrics.top;
      const scrollHeight = metrics.height;
      if (scrollTop + clientHeight >= scrollHeight - 2) break;

      await target
        .evaluate(
          "el => { var step = Math.max(50, Math.floor((el.clientHeight || 0) * 0.7)); el.scrollTop = Math.min(el.scrollTop + step, el.scrollHeight); }",
        )
        .catch(() => undefined);
      await page.waitForTimeout(150);
    }

    return passes;
  };

  scrollPasses += await runPass();
  if (expectedCount != null && collected.size < expectedCount) {
    scrollPasses += await runPass();
  }

  return {
    deviceIds: [...collected].sort(),
    scrollPasses,
    textsCollected,
  };
}

export function resolveContainerLocator(page: Page, candidate: ScrollContainerCandidate | null): Locator {
  if (candidate?.selector) {
    return page.locator(candidate.selector).first();
  }
  return page.locator(DEVICE_TREE_CONTAINER_SELECTORS.join(", ")).first();
}
