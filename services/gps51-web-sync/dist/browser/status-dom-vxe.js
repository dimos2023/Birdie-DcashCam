import { buildDatasetSignature, } from "../gps51/status-dom-vxe-core.js";
import { normalizeRecordArray } from "./status-dom-normalize.js";
export function buildVxeExtractionScript(inventoryIds, tabName, portalCount = null) {
    const serializedInventory = JSON.stringify([...inventoryIds]);
    const serializedTab = JSON.stringify(tabName);
    const serializedPortal = portalCount == null ? "null" : String(Math.trunc(portalCount));
    return `(() => {
    const inventoryList = ${serializedInventory};
    const tabName = ${serializedTab};
    const portalHint = ${serializedPortal};
    const inventorySet = new Set(inventoryList);
    const childKeys = ["children","childs","childNodes","records","rows","data","list","deviceList"];
    const publicMethods = ["getTableData","getData","getFullData","getRecordset"];
    const resultKeys = ["fullData","visibleData","tableData","afterFullData","sourceData","footerData"];
    const internalPaths = ["reactData","internalData","tableFullData","afterFullData","tableData","fullData","visibleData","sourceData","tableSourceData","tableSynchData"];
    const maxDepth = 8;
    const maxObjects = 20000;
    const seen = new WeakSet();
    let inspectedObjects = 0;

    function normalizeToken(value) {
      if (typeof value === "number" && Number.isFinite(value)) {
        const normalized = String(Math.trunc(value));
        return normalized.length >= 8 ? normalized : null;
      }
      if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed.length >= 8 ? trimmed : null;
      }
      return null;
    }

    function shouldSkip(value) {
      if (value == null) return true;
      if (typeof value === "function") return true;
      if (typeof value === "symbol") return true;
      if (typeof Node !== "undefined" && value instanceof Node) return true;
      if (typeof Window !== "undefined" && value === window) return true;
      if (typeof Document !== "undefined" && value instanceof Document) return true;
      return false;
    }

    function traverse(value, depth) {
      if (depth > maxDepth || inspectedObjects >= maxObjects || shouldSkip(value)) return [];
      const found = new Set();
      const token = normalizeToken(value);
      if (token && inventorySet.has(token)) found.add(token);

      if (Array.isArray(value)) {
        inspectedObjects += 1;
        for (let i = 0; i < value.length; i++) {
          const ids = traverse(value[i], depth + 1);
          for (let j = 0; j < ids.length; j++) found.add(ids[j]);
        }
        return Array.from(found);
      }

      if (typeof value === "object") {
        if (seen.has(value)) return Array.from(found);
        seen.add(value);
        inspectedObjects += 1;
        const keys = Object.keys(value);
        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];
          if (key.indexOf("_") === 0 || key.indexOf("$") === 0) continue;
          const ids = traverse(value[key], depth + 1);
          for (let j = 0; j < ids.length; j++) found.add(ids[j]);
        }
        for (let i = 0; i < childKeys.length; i++) {
          const nested = value[childKeys[i]];
          if (nested == null) continue;
          const ids = traverse(nested, depth + 1);
          for (let j = 0; j < ids.length; j++) found.add(ids[j]);
        }
      }

      return Array.from(found);
    }

    function flattenPayload(payload) {
      if (payload == null) return [];
      if (Array.isArray(payload)) return payload;
      if (typeof payload !== "object") return [];
      const rows = [];
      for (let i = 0; i < resultKeys.length; i++) {
        const value = payload[resultKeys[i]];
        if (Array.isArray(value)) rows.push.apply(rows, value);
      }
      if (rows.length > 0) return rows;
      for (let i = 0; i < childKeys.length; i++) {
        const nested = payload[childKeys[i]];
        if (Array.isArray(nested)) rows.push.apply(rows, nested);
      }
      return rows;
    }

    function scoreDataset(ids, portalHint) {
      if (!ids || ids.length === 0) return 0;
      let score = ids.length;
      if (portalHint != null) {
        const delta = Math.abs(ids.length - portalHint);
        score += delta <= 2 ? 500 : -delta * 10;
      }
      return score;
    }

    function componentRoots(el) {
      const roots = [];
      if (el.__vue__) roots.push(el.__vue__);
      if (el.__vueParentComponent) {
        if (el.__vueParentComponent.proxy) roots.push(el.__vueParentComponent.proxy);
        if (el.__vueParentComponent.exposed) roots.push(el.__vueParentComponent.exposed);
        roots.push(el.__vueParentComponent);
      }
      return roots;
    }

  try {
    const selectors = [".vxe-table", ".vxe-table--render-wrapper", ".vxe-table--body-wrapper", ".ztree-wrapper"];
    const elements = [];
    const elementSeen = new Set();
    for (let s = 0; s < selectors.length; s++) {
      const nodes = document.querySelectorAll(selectors[s]);
      for (let i = 0; i < nodes.length; i++) {
        if (!elementSeen.has(nodes[i])) {
          elementSeen.add(nodes[i]);
          elements.push(nodes[i]);
        }
      }
    }

    const candidates = [];
    for (let e = 0; e < elements.length; e++) {
      const el = elements[e];
      const roots = componentRoots(el);
      for (let r = 0; r < roots.length; r++) {
        const root = roots[r];
        if (!root || typeof root !== "object") continue;

        for (let m = 0; m < publicMethods.length; m++) {
          const methodName = publicMethods[m];
          const method = root[methodName];
          if (typeof method !== "function") continue;
          try {
            const payload = method.call(root);
            const ids = traverse(payload, 0);
            const flat = flattenPayload(payload);
            candidates.push({
              ids: ids,
              path: selectors[s] + ":" + methodName + "()",
              method: "vxe_public_api",
              arrayLength: Array.isArray(flat) ? flat.length : ids.length,
              objectKeys: resultKeys.slice()
            });
          } catch (err) {}
        }

        for (let p = 0; p < internalPaths.length; p++) {
          const path = internalPaths[p];
          const payload = root[path];
          const ids = traverse(payload, 0);
          if (ids.length > 0) {
            candidates.push({
              ids: ids,
              path: selectors[s] + ":" + path,
              method: "vxe_internal_state",
              arrayLength: Array.isArray(payload) ? payload.length : 0,
              objectKeys: [path]
            });
          }
        }

        const vueIds = traverse(root, 0);
        if (vueIds.length > 0) {
          candidates.push({
            ids: vueIds,
            path: selectors[s] + ":vue_component_state",
            method: "vue_component_state",
            arrayLength: vueIds.length,
            objectKeys: ["__vue__","proxy","exposed"]
          });
        }
      }
    }

    let best = null;
    let bestScore = -1;
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      const score = scoreDataset(candidate.ids, portalHint);
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }

    const deviceIds = best && Array.isArray(best.ids) ? best.ids.slice().sort() : [];
    const signatureCount = deviceIds.length;
    const signatureHead = deviceIds.slice(0, 5).join(",");
    return {
      deviceIds: deviceIds,
      extractionMethod: best ? best.method : "none",
      selectedDataPath: best ? best.path : null,
      candidateDatasetCounts: candidates.map(function(candidate) {
        return {
          path: candidate.path,
          arrayLength: candidate.arrayLength || 0,
          matchedInventoryCount: Array.isArray(candidate.ids) ? candidate.ids.length : 0,
          objectKeys: Array.isArray(candidate.objectKeys) ? candidate.objectKeys : []
        };
      }),
      datasetSignature: tabName + ":" + signatureCount + ":" + signatureHead
    };
  } catch (e) {
    return {
      deviceIds: [],
      extractionMethod: "none",
      selectedDataPath: null,
      candidateDatasetCounts: [],
      datasetSignature: tabName + ":0:"
    };
  }
  })()`;
}
export function buildVxeVirtualScrollScript(inventoryIds) {
    const serializedInventory = JSON.stringify([...inventoryIds]);
    return `(() => {
    const inventorySet = new Set(${serializedInventory});
    try {
      const wrapper = document.querySelector(".vxe-table--body-wrapper.body--wrapper") ||
        document.querySelector(".vxe-table--body-wrapper");
      if (!wrapper) return [];

      const collected = new Set();
      const maxSteps = 120;
      wrapper.scrollTop = 0;
      wrapper.dispatchEvent(new Event("scroll", { bubbles: true }));

      function collectRows() {
        const rows = wrapper.querySelectorAll(".vxe-body--row, .vxe-table--body tr, [rowid]");
        for (let i = 0; i < rows.length; i++) {
          const text = rows[i].innerText || rows[i].textContent || "";
          const matches = text.match(/\\d{8,17}/g) || [];
          for (let j = 0; j < matches.length; j++) {
            if (inventorySet.has(matches[j])) collected.add(matches[j]);
          }
          const attrs = rows[i].attributes;
          for (let a = 0; a < attrs.length; a++) {
            const val = attrs[a].value || "";
            const attrMatches = val.match(/\\d{8,17}/g) || [];
            for (let k = 0; k < attrMatches.length; k++) {
              if (inventorySet.has(attrMatches[k])) collected.add(attrMatches[k]);
            }
          }
        }
      }

      let lastScrollTop = -1;
      for (let step = 0; step < maxSteps; step++) {
        collectRows();
        const clientHeight = wrapper.clientHeight || 0;
        const stepSize = Math.max(50, Math.floor(clientHeight * 0.7));
        if (wrapper.scrollTop + clientHeight >= wrapper.scrollHeight - 2) break;
        if (wrapper.scrollTop === lastScrollTop) break;
        lastScrollTop = wrapper.scrollTop;
        wrapper.scrollTop = Math.min(wrapper.scrollTop + stepSize, wrapper.scrollHeight);
        wrapper.dispatchEvent(new Event("scroll", { bubbles: true }));
      }

      wrapper.scrollTop = 0;
      return Array.from(collected).sort();
    } catch (e) {
      return [];
    }
  })()`;
}
function normalizeVxeTabResult(raw, tabName) {
    const record = normalizeRecordArray([raw])[0] ?? {};
    const deviceIds = Array.isArray(record.deviceIds)
        ? record.deviceIds.filter((id) => typeof id === "string")
        : [];
    const extractionMethod = record.extractionMethod === "vxe_public_api" ||
        record.extractionMethod === "vxe_internal_state" ||
        record.extractionMethod === "vue_component_state" ||
        record.extractionMethod === "virtual_dom_scroll"
        ? record.extractionMethod
        : "none";
    const candidateDatasetCounts = normalizeRecordArray(record.candidateDatasetCounts).map((entry) => ({
        path: typeof entry.path === "string" ? entry.path : "",
        arrayLength: typeof entry.arrayLength === "number" ? entry.arrayLength : 0,
        matchedInventoryCount: typeof entry.matchedInventoryCount === "number" ? entry.matchedInventoryCount : 0,
        objectKeys: Array.isArray(entry.objectKeys)
            ? entry.objectKeys.filter((key) => typeof key === "string")
            : [],
    }));
    const sortedIds = [...new Set(deviceIds)].sort();
    return {
        deviceIds: sortedIds,
        extractionMethod,
        selectedDataPath: typeof record.selectedDataPath === "string" ? record.selectedDataPath : null,
        candidateDatasetCounts,
        datasetSignature: typeof record.datasetSignature === "string"
            ? record.datasetSignature
            : buildDatasetSignature(tabName, sortedIds),
    };
}
export async function extractVxeDeviceIdsForCurrentTab(page, inventoryIds, tabName, portalCount) {
    const script = buildVxeExtractionScript([...inventoryIds], tabName, portalCount);
    const raw = await page.evaluate(script).catch(() => null);
    const result = normalizeVxeTabResult(raw, tabName);
    const withinTolerance = portalCount == null || Math.abs(result.deviceIds.length - portalCount) <= 2;
    if (result.deviceIds.length > 0 && withinTolerance) {
        return result;
    }
    const scrollScript = buildVxeVirtualScrollScript([...inventoryIds]);
    const scrollIds = await page.evaluate(scrollScript).catch(() => []);
    const normalizedScrollIds = Array.isArray(scrollIds)
        ? scrollIds.filter((id) => typeof id === "string")
        : [];
    if (normalizedScrollIds.length > result.deviceIds.length) {
        const sorted = [...new Set(normalizedScrollIds)].sort();
        return {
            deviceIds: sorted,
            extractionMethod: "virtual_dom_scroll",
            selectedDataPath: ".vxe-table--body-wrapper",
            candidateDatasetCounts: result.candidateDatasetCounts,
            datasetSignature: buildDatasetSignature(tabName, sorted),
        };
    }
    return result;
}
