import { buildDatasetSignature, portalCountWithinTolerance, } from "../gps51/status-dom-vxe-core.js";
import { resolveRowToDeviceId, serializeIdentityIndexForBrowser, } from "../gps51/status-dom-identity.js";
import { DEVICE_TREE_CONTAINER_SELECTORS } from "./monitor-dom-safety.js";
import { normalizeRecordArray, normalizeStringArray } from "./status-dom-normalize.js";
export function buildIdentityAwareContainerScript(identityPayload, treeSelectors) {
    const serializedIdentity = JSON.stringify(identityPayload);
    const serializedSelectors = JSON.stringify(treeSelectors);
    return `(() => {
    const identity = ${serializedIdentity};
    const selectors = ${serializedSelectors};
    const deviceIds = identity.deviceIds || [];
    const uniqueNames = identity.uniqueNames || {};
    const uniqueNameValues = Object.keys(uniqueNames);
    const rejectPattern = /command|detail-panel|status-counter|selected-device|map-panel|toolbar/i;

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

    function normalize(text) {
      return (text || "").trim().replace(/\\s+/g, " ").toLowerCase();
    }

    function countIdHits(text) {
      let hits = 0;
      for (let i = 0; i < deviceIds.length; i++) {
        if (text.indexOf(deviceIds[i]) >= 0) hits += 1;
      }
      return hits;
    }

    function countNameHits(text) {
      const normalized = normalize(text);
      let hits = 0;
      for (let i = 0; i < uniqueNameValues.length; i++) {
        const name = uniqueNameValues[i];
        if (name && normalized.indexOf(name) >= 0) hits += 1;
      }
      return hits;
    }

    function countVisibleRows(el) {
      const rows = el.querySelectorAll(
        ".vxe-body--row, .vxe-table--body tr, .ivu-tree-title, .el-tree-node__content, .ztree li, [class*='tree-node'], [class*='device-row']"
      );
      let visible = 0;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rect = row.getBoundingClientRect();
        if (rect && rect.height > 0 && rect.width > 0) visible += 1;
      }
      return visible;
    }

    const out = [];
    const seen = new Set();
    const nodes = Array.prototype.slice.call(document.querySelectorAll("*"));

    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i];
      if (!el || seen.has(el)) continue;
      const cls = typeof el.className === "string" ? el.className : "";
      if (rejectPattern.test(cls)) continue;

      const scrollable = el.scrollHeight > el.clientHeight + 1;
      const hasTreeWrapper = !!(
        el.matches(".ztree-wrapper, .vxe-table, .vxe-table--body-wrapper, .ivu-tree, .el-tree") ||
        el.querySelector(".ztree-wrapper, .vxe-table, .vxe-table--body-wrapper, .ivu-tree, .el-tree")
      );
      if (!scrollable && !hasTreeWrapper) continue;
      if (el.clientHeight < 60 && !hasTreeWrapper) continue;

      const rect = el.getBoundingClientRect();
      if (!rect || rect.height <= 0) continue;

      const text = el.innerText || "";
      const rowText = Array.prototype.map.call(
        el.querySelectorAll(".vxe-body--row, .vxe-table--body tr, .ivu-tree-title, .el-tree-node__content, .ztree li"),
        function(row) { return row.innerText || ""; }
      ).join("\\n");

      const inventoryIdHits = Math.max(countIdHits(text), countIdHits(rowText));
      const inventoryNameHits = Math.max(countNameHits(text), countNameHits(rowText));
      if (inventoryIdHits <= 0 && inventoryNameHits <= 0) continue;

      let matchesTreeSelector = false;
      for (let s = 0; s < selectors.length; s++) {
        try {
          if (el.matches(selectors[s]) || el.querySelector(selectors[s])) {
            matchesTreeSelector = true;
            break;
          }
        } catch (e) {}
      }

      const checkboxCount = el.querySelectorAll("input[type='checkbox']").length;
      const visibleRowCount = countVisibleRows(el);
      const selector = cssPath(el);
      if (!selector || seen.has(selector)) continue;
      seen.add(selector);
      seen.add(el);

      let score = 10;
      if (matchesTreeSelector) score += 15;
      if (hasTreeWrapper) score += 20;
      score += Math.min(inventoryIdHits * 10, 200);
      score += Math.min(inventoryNameHits * 8, 160);
      score += Math.min(checkboxCount, 5);
      score += Math.min(visibleRowCount, 20);
      if (Number.isFinite(rect.left) && rect.left < 500) score += 10;

      out.push({
        selector: selector,
        domPath: selector,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        left: Number.isFinite(rect.left) ? rect.left : null,
        width: Number.isFinite(rect.width) ? rect.width : null,
        checkboxCount: checkboxCount,
        inventoryIdHits: inventoryIdHits,
        inventoryNameHits: inventoryNameHits,
        visibleRowCount: visibleRowCount,
        matchesTreeSelector: matchesTreeSelector,
        hasVxeWrapper: hasTreeWrapper,
        score: score,
      });
    }

    out.sort(function(a, b) { return b.score - a.score; });
    return Array.isArray(out) ? out : [];
  })()`;
}
export function scoreIdentityAwareContainers(candidates) {
    const scored = [];
    for (const candidate of candidates) {
        const inventoryIdHits = Number(candidate.inventoryIdHits ?? 0);
        const inventoryNameHits = Number(candidate.inventoryNameHits ?? 0);
        if (inventoryIdHits <= 0 && inventoryNameHits <= 0)
            continue;
        const score = Number(candidate.score ?? 0);
        if (score <= 0)
            continue;
        scored.push({
            selector: String(candidate.selector ?? ""),
            domPath: String(candidate.domPath ?? candidate.selector ?? ""),
            score,
            scrollHeight: Number(candidate.scrollHeight ?? 0),
            clientHeight: Number(candidate.clientHeight ?? 0),
            inventoryIdHits: inventoryIdHits + inventoryNameHits,
            inventoryNameHits,
            visibleRowCount: Number(candidate.visibleRowCount ?? 0),
            checkboxCount: Number(candidate.checkboxCount ?? 0),
        });
    }
    return scored.sort((a, b) => b.score - a.score);
}
export function buildRowExtractionScript(containerSelector, identityPayload, portalCount) {
    const serializedIdentity = JSON.stringify(identityPayload);
    const serializedSelector = JSON.stringify(containerSelector);
    const serializedPortalCount = JSON.stringify(portalCount);
    return `(() => {
    const identity = ${serializedIdentity};
    const containerSelector = ${serializedSelector};
    const portalCount = ${serializedPortalCount};
    const deviceIdSet = {};
    for (let i = 0; i < identity.deviceIds.length; i++) {
      deviceIdSet[identity.deviceIds[i]] = true;
    }
    const uniqueNames = identity.uniqueNames || {};
    const groupNames = identity.groupNames || {};
    const duplicateNames = {};
    for (let i = 0; i < (identity.duplicateNames || []).length; i++) {
      duplicateNames[identity.duplicateNames[i]] = true;
    }

    function normalize(text) {
      return (text || "").trim().replace(/\\s+/g, " ").toLowerCase();
    }

    function sanitizeRow(el) {
      const dataAttributes = {};
      if (el && el.attributes) {
        for (let i = 0; i < el.attributes.length; i++) {
          const attr = el.attributes[i];
          if (attr.name.indexOf("data-") === 0) dataAttributes[attr.name] = attr.value || "";
        }
      }
      const statusIcons = [];
      const icons = el.querySelectorAll("i, img, span[class*='status'], span[class*='icon']");
      for (let i = 0; i < icons.length && i < 6; i++) {
        const icon = icons[i];
        const cls = typeof icon.className === "string" ? icon.className : "";
        if (cls) statusIcons.push(cls);
      }
      let level = null;
      const levelAttr = el.getAttribute("data-level") || el.getAttribute("aria-level");
      if (levelAttr) level = parseInt(levelAttr, 10);
      let groupLabel = null;
      const parent = el.closest(".el-tree-node, .ivu-tree-children, li");
      if (parent && parent.parentElement) {
        const groupNode = parent.parentElement.querySelector(".el-tree-node__content, .ivu-tree-title");
        if (groupNode && groupNode !== el) groupLabel = (groupNode.textContent || "").trim();
      }
      return {
        text: (el.textContent || "").trim().slice(0, 300),
        title: el.getAttribute("title"),
        ariaLabel: el.getAttribute("aria-label"),
        dataAttributes: dataAttributes,
        groupLabel: groupLabel,
        level: Number.isFinite(level) ? level : null,
        statusIconClasses: statusIcons,
      };
    }

    function resolveRow(row) {
      const haystacks = [
        row.text,
        row.title || "",
        row.ariaLabel || "",
        row.groupLabel || "",
      ];
      for (const key in row.dataAttributes) {
        haystacks.push(row.dataAttributes[key]);
      }
      for (let h = 0; h < haystacks.length; h++) {
        const haystack = haystacks[h];
        for (let i = 0; i < identity.deviceIds.length; i++) {
          const id = identity.deviceIds[i];
          if (haystack.indexOf(id) >= 0) return { id: id, method: "id" };
        }
      }
      const normalizedName = normalize((row.text || "").split("\\n")[0]);
      if (!normalizedName) return { id: null, method: "unresolved" };
      if (duplicateNames[normalizedName]) {
        const groupKey = normalize(row.groupLabel || "") + "|" + normalizedName;
        if (groupNames[groupKey]) return { id: groupNames[groupKey], method: "group_name" };
        return { id: null, method: "duplicate_name" };
      }
      if (uniqueNames[normalizedName]) return { id: uniqueNames[normalizedName], method: "unique_name" };
      const groupKey = normalize(row.groupLabel || "") + "|" + normalizedName;
      if (groupNames[groupKey]) return { id: groupNames[groupKey], method: "group_name" };
      return { id: null, method: "unresolved" };
    }

    function rowSignature(rows) {
      return rows.slice(0, 20).map(function(r) { return r.text; }).join("|");
    }

    function collectRows(root) {
      const selectors = [
        ".vxe-body--row",
        ".vxe-table--body tr",
        ".ivu-tree-title",
        ".el-tree-node__content",
        ".ztree li a",
        "[class*='tree-node']",
        "[class*='device-row']",
      ];
      const seen = new Set();
      const rows = [];
      for (let s = 0; s < selectors.length; s++) {
        const nodes = root.querySelectorAll(selectors[s]);
        for (let i = 0; i < nodes.length; i++) {
          const el = nodes[i];
          if (seen.has(el)) continue;
          const rect = el.getBoundingClientRect();
          if (!rect || rect.height <= 0) continue;
          seen.add(el);
          rows.push(sanitizeRow(el));
        }
      }
      return rows;
    }

    const container = document.querySelector(containerSelector);
    if (!container) {
      return { rows: [], scrollPasses: 0, rowSignature: "" };
    }

    const resolved = {};
    const allRows = [];
    let scrollPasses = 0;
    container.scrollTop = 0;
    container.dispatchEvent(new Event("scroll", { bubbles: true }));

    function ingestPass() {
      const rows = collectRows(container);
      scrollPasses += 1;
      for (let i = 0; i < rows.length; i++) {
        allRows.push(rows[i]);
        const match = resolveRow(rows[i]);
        if (match.id) resolved[match.id] = match.method;
      }
      return rowSignature(rows);
    }

    let previousSig = ingestPass();
    const clientHeight = container.clientHeight || 0;
    const step = Math.max(50, Math.floor(clientHeight * 0.7));

    for (let pass = 0; pass < 250; pass++) {
      if (clientHeight <= 0) break;
      if (container.scrollTop + clientHeight >= container.scrollHeight - 2) break;
      container.scrollTop = Math.min(container.scrollTop + step, container.scrollHeight);
      container.dispatchEvent(new Event("scroll", { bubbles: true }));
      const sig = ingestPass();
      if (sig === previousSig && pass > 2) break;
      previousSig = sig;
    }

    if (portalCount != null && Object.keys(resolved).length < portalCount) {
      container.scrollTop = 0;
      ingestPass();
      for (let pass = 0; pass < 250; pass++) {
        if (clientHeight <= 0) break;
        if (container.scrollTop + clientHeight >= container.scrollHeight - 2) break;
        container.scrollTop = Math.min(container.scrollTop + step, container.scrollHeight);
        container.dispatchEvent(new Event("scroll", { bubbles: true }));
        ingestPass();
      }
    }

    return {
      rows: allRows.slice(0, 500),
      resolved: resolved,
      scrollPasses: scrollPasses,
      rowSignature: previousSig,
    };
  })()`;
}
export async function discoverIdentityAwareContainer(page, identityIndex) {
    const payload = serializeIdentityIndexForBrowser(identityIndex);
    const script = buildIdentityAwareContainerScript(payload, [...DEVICE_TREE_CONTAINER_SELECTORS]);
    const raw = await page.evaluate(script).catch(() => []);
    const candidates = normalizeRecordArray(raw);
    const scored = scoreIdentityAwareContainers(candidates);
    const debugCandidates = candidates.slice(0, 10).map((candidate) => ({
        selector: String(candidate.selector ?? ""),
        inventoryIdHits: Number(candidate.inventoryIdHits ?? 0),
        inventoryNameHits: Number(candidate.inventoryNameHits ?? 0),
        visibleRowCount: Number(candidate.visibleRowCount ?? 0),
        score: Number(candidate.score ?? 0),
        rejectionReason: Number(candidate.inventoryIdHits ?? 0) <= 0 &&
            Number(candidate.inventoryNameHits ?? 0) <= 0
            ? "no_inventory_hits"
            : null,
    }));
    const selected = scored[0] ?? null;
    return {
        selectedContainer: selected,
        candidates: debugCandidates,
        reason: selected ? null : "no_device_container",
    };
}
function buildStatsFromRows(rows, resolvedMap, identityIndex) {
    let idMatches = 0;
    let uniqueNameMatches = 0;
    let groupNameMatches = 0;
    let unresolvedRows = 0;
    let duplicateNameRows = 0;
    for (const row of rows) {
        const resolution = resolveRowToDeviceId(row, identityIndex);
        if (resolution.method === "id")
            idMatches += 1;
        else if (resolution.method === "unique_name")
            uniqueNameMatches += 1;
        else if (resolution.method === "group_name")
            groupNameMatches += 1;
        else if (resolution.method === "duplicate_name")
            duplicateNameRows += 1;
        else
            unresolvedRows += 1;
    }
    return {
        idMatches,
        uniqueNameMatches,
        groupNameMatches,
        unresolvedRows,
        duplicateNameRows,
        visibleRowCount: rows.length,
        resolvedRowCount: resolvedMap.size,
    };
}
export async function extractDeviceRowsFromContainer(page, containerSelector, identityIndex, portalCount, tab) {
    const payload = serializeIdentityIndexForBrowser(identityIndex);
    const script = buildRowExtractionScript(containerSelector, payload, portalCount);
    const raw = await page.evaluate(script).catch(() => null);
    const record = normalizeRecordArray([raw])[0] ?? {};
    const rawRows = normalizeRecordArray(record.rows);
    const rows = rawRows.map((row) => ({
        text: String(row.text ?? ""),
        title: typeof row.title === "string" ? row.title : null,
        ariaLabel: typeof row.ariaLabel === "string" ? row.ariaLabel : null,
        dataAttributes: row.dataAttributes && typeof row.dataAttributes === "object"
            ? row.dataAttributes
            : {},
        groupLabel: typeof row.groupLabel === "string" ? row.groupLabel : null,
        level: typeof row.level === "number" ? row.level : null,
        statusIconClasses: normalizeStringArray(row.statusIconClasses),
    }));
    const resolvedMap = new Map();
    const rowSamples = [];
    for (const row of rows) {
        const resolution = resolveRowToDeviceId(row, identityIndex);
        if (resolution.sourceDeviceId) {
            resolvedMap.set(resolution.sourceDeviceId, resolution.method);
        }
        if (rowSamples.length < 10) {
            rowSamples.push({
                text: row.text.slice(0, 120),
                title: row.title,
                resolvedDeviceId: resolution.sourceDeviceId,
                resolutionMethod: resolution.method,
                statusIconClasses: row.statusIconClasses,
            });
        }
    }
    const deviceIds = [...resolvedMap.keys()].sort();
    const stats = buildStatsFromRows(rows, resolvedMap, identityIndex);
    const scrollPasses = typeof record.scrollPasses === "number" ? record.scrollPasses : 0;
    let rejectionReason = null;
    if (deviceIds.length === 0 && rows.length > 0) {
        rejectionReason = stats.duplicateNameRows > stats.unresolvedRows ? "duplicate_device_names" : "device_names_not_resolved";
    }
    else if (portalCount != null &&
        !portalCountWithinTolerance(deviceIds.length, portalCount, portalCount, 2)) {
        rejectionReason = "dataset_count_mismatch";
    }
    return {
        deviceIds,
        extractionMethod: deviceIds.length > 0 ? "dom_row_scroll" : "none",
        selectedContainer: containerSelector,
        stats,
        rowSamples,
        datasetSignature: buildDatasetSignature(tab, deviceIds),
        scrollPasses,
        rejectionReason,
    };
}
export function mergeContainerDiscovery(legacy, identity) {
    if (identity.selectedContainer)
        return identity.selectedContainer;
    return legacy.selectedContainer;
}
