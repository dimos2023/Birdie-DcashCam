export const VXE_CHILD_PROPERTY_NAMES = [
    "children",
    "childs",
    "childNodes",
    "records",
    "rows",
    "data",
    "list",
    "deviceList",
];
export const VXE_PUBLIC_METHODS = [
    "getTableData",
    "getData",
    "getFullData",
    "getRecordset",
];
export const VXE_RESULT_DATA_KEYS = [
    "fullData",
    "visibleData",
    "tableData",
    "afterFullData",
    "sourceData",
    "footerData",
];
export const VXE_INTERNAL_STATE_PATHS = [
    "reactData",
    "internalData",
    "tableFullData",
    "afterFullData",
    "tableData",
    "fullData",
    "visibleData",
    "sourceData",
    "tableSourceData",
    "tableSynchData",
];
const DEFAULT_LIMITS = {
    maxDepth: 8,
    maxObjects: 20_000,
};
export function createVxeTraversalState() {
    return { seen: new WeakSet(), inspectedObjects: 0 };
}
export function isSkippableTraverseValue(value) {
    if (value == null)
        return true;
    if (typeof value === "function")
        return true;
    if (typeof value === "symbol")
        return true;
    if (typeof Node !== "undefined" && value instanceof Node)
        return true;
    if (typeof Window !== "undefined" && value === Window)
        return true;
    if (typeof Document !== "undefined" && value instanceof Document)
        return true;
    return false;
}
export function normalizeInventoryToken(value) {
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
export function matchInventoryToken(token, inventorySet) {
    if (!token || !inventorySet.has(token))
        return null;
    return token;
}
export function traverseForInventoryIds(value, inventorySet, limits = DEFAULT_LIMITS, state = createVxeTraversalState(), depth = 0) {
    if (depth > limits.maxDepth || state.inspectedObjects >= limits.maxObjects)
        return [];
    if (isSkippableTraverseValue(value))
        return [];
    const found = new Set();
    const token = matchInventoryToken(normalizeInventoryToken(value), inventorySet);
    if (token)
        found.add(token);
    if (Array.isArray(value)) {
        state.inspectedObjects += 1;
        for (const item of value) {
            for (const id of traverseForInventoryIds(item, inventorySet, limits, state, depth + 1)) {
                found.add(id);
            }
        }
        return [...found];
    }
    if (typeof value === "object") {
        const objectValue = value;
        if (state.seen.has(objectValue))
            return [...found];
        state.seen.add(objectValue);
        state.inspectedObjects += 1;
        for (const [key, child] of Object.entries(objectValue)) {
            if (key.startsWith("_") || key.startsWith("$"))
                continue;
            for (const id of traverseForInventoryIds(child, inventorySet, limits, state, depth + 1)) {
                found.add(id);
            }
        }
        for (const childKey of VXE_CHILD_PROPERTY_NAMES) {
            const nested = objectValue[childKey];
            if (nested == null)
                continue;
            for (const id of traverseForInventoryIds(nested, inventorySet, limits, state, depth + 1)) {
                found.add(id);
            }
        }
    }
    return [...found];
}
export function extractIdsFromVxePayload(payload, inventorySet, limits) {
    return [...new Set(traverseForInventoryIds(payload, inventorySet, limits))].sort();
}
export function flattenVxeTableData(payload) {
    if (payload == null)
        return [];
    if (Array.isArray(payload))
        return payload;
    if (typeof payload === "object") {
        const record = payload;
        const rows = [];
        for (const key of VXE_RESULT_DATA_KEYS) {
            const value = record[key];
            if (Array.isArray(value))
                rows.push(...value);
        }
        if (rows.length > 0)
            return rows;
        for (const childKey of VXE_CHILD_PROPERTY_NAMES) {
            const nested = record[childKey];
            if (Array.isArray(nested))
                rows.push(...nested);
        }
        return rows;
    }
    return [];
}
export function scoreVxeDataset(ids, portalCount, inventorySet, maxTabDelta = 2) {
    if (ids.length === 0)
        return 0;
    const unique = new Set(ids);
    let score = unique.size;
    const extras = [...unique].filter((id) => !inventorySet.has(id));
    if (extras.length > 0)
        score -= extras.length * 100;
    if (portalCount != null) {
        const delta = Math.abs(unique.size - portalCount);
        if (delta <= maxTabDelta)
            score += 500;
        else
            score -= delta * 10;
    }
    return score;
}
export function buildDatasetSignature(tab, ids) {
    const sorted = [...new Set(ids)].sort();
    const head = sorted.slice(0, 5).join(",");
    return `${tab}:${sorted.length}:${head}`;
}
export function portalCountWithinTolerance(extractedCount, portalBefore, portalAfter, tolerance = 2) {
    const targets = [portalBefore, portalAfter].filter((value) => value != null);
    if (targets.length === 0)
        return false;
    return targets.some((target) => Math.abs(extractedCount - target) <= tolerance);
}
export function isStaleTabDataset(input) {
    if (!input.previousSignature)
        return false;
    if (input.currentSignature !== input.previousSignature)
        return false;
    if (input.currentPortalCount == null || input.previousPortalCount == null)
        return true;
    return input.currentPortalCount !== input.previousPortalCount;
}
export function rejectIdenticalDatasetsAcrossTabs(input) {
    const signature = (ids) => [...new Set(ids)].sort().join(",");
    const allSig = signature(input.allIds);
    const onlineSig = signature(input.onlineIds);
    const offlineSig = signature(input.offlineIds);
    const portalDistinct = input.portalCounts.all != null &&
        input.portalCounts.online != null &&
        input.portalCounts.offline != null &&
        !(input.portalCounts.all === input.portalCounts.online &&
            input.portalCounts.all === input.portalCounts.offline);
    if (portalDistinct && allSig === onlineSig && onlineSig === offlineSig && allSig.length > 0) {
        return "identical_datasets_across_tabs";
    }
    return null;
}
export function resolveVueComponentRoots(element) {
    const roots = [];
    if (element.__vue__)
        roots.push(element.__vue__);
    const parent = element.__vueParentComponent;
    if (parent?.proxy)
        roots.push(parent.proxy);
    if (parent?.exposed)
        roots.push(parent.exposed);
    if (parent)
        roots.push(parent);
    return roots;
}
export function extractFromVue2Instance(instance, inventorySet) {
    for (const methodName of VXE_PUBLIC_METHODS) {
        const method = instance[methodName];
        if (typeof method !== "function")
            continue;
        try {
            const result = method.call(instance);
            const ids = extractIdsFromVxePayload(result, inventorySet);
            if (ids.length > 0) {
                return { ids, path: `${methodName}()`, method: "vxe_public_api" };
            }
        }
        catch {
            continue;
        }
    }
    for (const statePath of VXE_INTERNAL_STATE_PATHS) {
        const stateValue = instance[statePath];
        const ids = extractIdsFromVxePayload(stateValue, inventorySet);
        if (ids.length > 0) {
            return { ids, path: statePath, method: "vxe_internal_state" };
        }
    }
    const ids = extractIdsFromVxePayload(instance, inventorySet);
    if (ids.length > 0) {
        return { ids, path: "__vue__", method: "vue_component_state" };
    }
    return { ids: [], path: null, method: "none" };
}
export function pickBestVxeCandidate(candidates, portalCount, inventorySet) {
    const diagnostics = candidates.map((candidate) => ({
        path: candidate.path,
        arrayLength: candidate.arrayLength,
        matchedInventoryCount: candidate.ids.length,
        objectKeys: candidate.path.split("."),
    }));
    let best = candidates[0] ?? null;
    let bestScore = -1;
    for (const candidate of candidates) {
        const score = scoreVxeDataset(candidate.ids, portalCount, inventorySet);
        if (score > bestScore) {
            best = candidate;
            bestScore = score;
        }
    }
    return {
        ids: best?.ids ?? [],
        path: best?.path ?? null,
        method: best?.method ?? "none",
        diagnostics,
    };
}
