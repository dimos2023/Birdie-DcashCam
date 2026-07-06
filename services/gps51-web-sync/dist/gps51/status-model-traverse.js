import { matchInventoryToken, normalizeInventoryToken, } from "./status-dom-vxe-core.js";
const DEFAULT_LIMITS = { maxDepth: 10, maxObjects: 50_000 };
const SECRET_KEY_PATTERN = /token|password|secret|authorization|cookie|session|credential|apikey|api_key|bearer|auth/i;
const STATUS_FIELD_PATTERN = /online|offline|status|active|login|connect|state|heart|net|run/i;
const DEVICE_ID_KEY_PATTERN = /^deviceid$|^device_id$|^deviceId$/i;
export function createTraversalState() {
    return { seen: new WeakSet(), inspectedObjects: 0 };
}
export function shouldSkipTraversalKey(key) {
    if (!key)
        return true;
    if (SECRET_KEY_PATTERN.test(key))
        return true;
    if (key === "window" || key === "document" || key === "location" || key === "navigator")
        return true;
    return false;
}
export function isSkippableTraversalValue(value) {
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
export function detectModelSourceFromPath(path) {
    if (/pinia|\$pinia|_s\b|provides/i.test(path))
        return "pinia_store";
    if (/\$store|vuex|getters|modules/i.test(path))
        return "vuex_store";
    if (/__vue__|setupState|__vue_app__|component|proxy|exposed/i.test(path))
        return "vue_state";
    return "app_state_collection";
}
export function extractInventoryIdsFromValue(value, inventorySet, limits = DEFAULT_LIMITS, state = createTraversalState(), depth = 0) {
    if (depth > limits.maxDepth || state.inspectedObjects >= limits.maxObjects)
        return [];
    if (isSkippableTraversalValue(value))
        return [];
    const found = new Set();
    const token = matchInventoryToken(normalizeInventoryToken(value), inventorySet);
    if (token)
        found.add(token);
    if (value instanceof Map) {
        state.inspectedObjects += 1;
        for (const [key, child] of value.entries()) {
            const keyToken = matchInventoryToken(normalizeInventoryToken(key), inventorySet);
            if (keyToken)
                found.add(keyToken);
            for (const id of extractInventoryIdsFromValue(child, inventorySet, limits, state, depth + 1)) {
                found.add(id);
            }
        }
        return [...found];
    }
    if (value instanceof Set) {
        state.inspectedObjects += 1;
        for (const child of value) {
            for (const id of extractInventoryIdsFromValue(child, inventorySet, limits, state, depth + 1)) {
                found.add(id);
            }
        }
        return [...found];
    }
    if (Array.isArray(value)) {
        state.inspectedObjects += 1;
        for (const item of value) {
            for (const id of extractInventoryIdsFromValue(item, inventorySet, limits, state, depth + 1)) {
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
            if (shouldSkipTraversalKey(key))
                continue;
            if (DEVICE_ID_KEY_PATTERN.test(key)) {
                const id = matchInventoryToken(normalizeInventoryToken(child), inventorySet);
                if (id)
                    found.add(id);
            }
            for (const id of extractInventoryIdsFromValue(child, inventorySet, limits, state, depth + 1)) {
                found.add(id);
            }
        }
    }
    return [...found];
}
export function findStatusFieldsOnRecord(record) {
    const fields = [];
    for (const [key, value] of Object.entries(record)) {
        if (SECRET_KEY_PATTERN.test(key))
            continue;
        if (!STATUS_FIELD_PATTERN.test(key))
            continue;
        if (typeof value === "boolean" ||
            typeof value === "number" ||
            typeof value === "string") {
            fields.push(key);
        }
    }
    return fields;
}
export function collectDeviceRecordsFromValue(value, depth = 0) {
    if (depth > 8 || value == null)
        return [];
    const records = [];
    if (Array.isArray(value)) {
        for (const item of value)
            records.push(...collectDeviceRecordsFromValue(item, depth + 1));
        return records;
    }
    if (typeof value === "object") {
        const objectValue = value;
        for (const key of ["deviceId", "device_id", "deviceid"]) {
            if (objectValue[key] != null) {
                records.push(objectValue);
                break;
            }
        }
        for (const child of Object.values(objectValue)) {
            records.push(...collectDeviceRecordsFromValue(child, depth + 1));
        }
    }
    return records;
}
export function probeValueForModelHit(path, value, inventorySet) {
    const matchedInventoryIds = [
        ...new Set(extractInventoryIdsFromValue(value, inventorySet)),
    ].sort();
    if (matchedInventoryIds.length === 0)
        return null;
    const deviceRecords = collectDeviceRecordsFromValue(value);
    const statusFields = new Set();
    let hasPerDeviceStatus = false;
    for (const record of deviceRecords.slice(0, 200)) {
        const fields = findStatusFieldsOnRecord(record);
        if (fields.length > 0)
            hasPerDeviceStatus = true;
        for (const field of fields)
            statusFields.add(field);
    }
    const collectionLength = Array.isArray(value)
        ? value.length
        : value instanceof Map
            ? value.size
            : deviceRecords.length > 0
                ? deviceRecords.length
                : matchedInventoryIds.length;
    return {
        dataPath: path,
        source: detectModelSourceFromPath(path),
        matchedInventoryIds,
        collectionLength,
        statusFields: [...statusFields],
        hasPerDeviceStatus,
    };
}
export function normalizeBrowserProbeHits(raw, inventorySet) {
    if (!Array.isArray(raw))
        return [];
    const hits = [];
    for (const entry of raw) {
        if (!entry || typeof entry !== "object")
            continue;
        const record = entry;
        const dataPath = typeof record.dataPath === "string" ? record.dataPath : "";
        if (!dataPath)
            continue;
        const matchedInventoryIds = Array.isArray(record.matchedInventoryIds)
            ? record.matchedInventoryIds.filter((id) => typeof id === "string")
            : [];
        const inventoryFiltered = matchedInventoryIds.filter((id) => inventorySet.has(id));
        if (inventoryFiltered.length === 0)
            continue;
        hits.push({
            dataPath,
            source: record.source === "pinia_store" ||
                record.source === "vuex_store" ||
                record.source === "vue_state"
                ? record.source
                : detectModelSourceFromPath(dataPath),
            matchedInventoryIds: [...new Set(inventoryFiltered)].sort(),
            collectionLength: typeof record.collectionLength === "number" ? record.collectionLength : inventoryFiltered.length,
            statusFields: Array.isArray(record.statusFields)
                ? record.statusFields.filter((field) => typeof field === "string")
                : [],
            hasPerDeviceStatus: Boolean(record.hasPerDeviceStatus),
        });
    }
    return hits;
}
export function buildVueAppProbeScript(inventorySample) {
    const serializedInventory = JSON.stringify(inventorySample);
    return `(() => {
    try {
      const inventorySample = ${serializedInventory};
      const inventorySet = {};
      for (let i = 0; i < inventorySample.length; i++) {
        inventorySet[inventorySample[i]] = true;
      }
      const SECRET = /token|password|secret|authorization|cookie|session|credential|apikey|api_key|bearer|auth/i;
      const STATUS = /online|offline|status|active|login|connect|state|heart|net|run/i;
      const DEVICE_ID = /^deviceid$|^device_id$|^deviceId$/i;
      const hits = [];
      const seen = new WeakSet();
      let inspected = 0;
      const MAX_DEPTH = 10;
      const MAX_OBJECTS = 50000;

      function normalizeToken(value) {
        if (typeof value === "number" && isFinite(value)) {
          var s = String(Math.trunc(value));
          return s.length >= 8 ? s : null;
        }
        if (typeof value === "string") {
          var t = value.trim();
          return t.length >= 8 ? t : null;
        }
        return null;
      }

      function matchInventory(value) {
        var token = normalizeToken(value);
        return token && inventorySet[token] ? token : null;
      }

      function collectIds(value, depth) {
        if (depth > MAX_DEPTH || inspected >= MAX_OBJECTS || value == null) return [];
        if (typeof value === "function" || typeof value === "symbol") return [];
        if (typeof Node !== "undefined" && value instanceof Node) return [];
        if (typeof Window !== "undefined" && value === window) return [];
        if (typeof Document !== "undefined" && value instanceof Document) return [];

        var found = [];
        var seenLocal = {};
        function add(id) { if (id && !seenLocal[id]) { seenLocal[id] = true; found.push(id); } }

        var direct = matchInventory(value);
        if (direct) add(direct);

        if (Array.isArray(value)) {
          inspected += 1;
          for (var i = 0; i < value.length; i++) {
            var childIds = collectIds(value[i], depth + 1);
            for (var j = 0; j < childIds.length; j++) add(childIds[j]);
          }
          return found;
        }

        if (value && typeof value === "object") {
          if (seen.has(value)) return found;
          seen.add(value);
          inspected += 1;

          if (typeof value.forEach === "function" && typeof value.size === "number") {
            try {
              value.forEach(function(child, key) {
                add(matchInventory(key));
                var childIds = collectIds(child, depth + 1);
                for (var j = 0; j < childIds.length; j++) add(childIds[j]);
              });
            } catch (e) {}
          }

          var keys = Object.keys(value).slice(0, 120);
          for (var k = 0; k < keys.length; k++) {
            var key = keys[k];
            if (SECRET.test(key)) continue;
            if (DEVICE_ID.test(key)) add(matchInventory(value[key]));
            var childIds = collectIds(value[key], depth + 1);
            for (var j = 0; j < childIds.length; j++) add(childIds[j]);
          }
        }
        return found;
      }

      function detectSource(path) {
        if (/pinia|\\$pinia|_s\\b|provides/i.test(path)) return "pinia_store";
        if (/\\$store|vuex|getters|modules/i.test(path)) return "vuex_store";
        if (/__vue__|setupState|__vue_app__|component|proxy|exposed/i.test(path)) return "vue_state";
        return "app_state_collection";
      }

      function statusFieldsFromValue(value) {
        var fields = [];
        if (!value) return fields;
        var rows = [];
        if (Array.isArray(value)) rows = value.slice(0, 200);
        else if (value && typeof value === "object") rows = [value];
        for (var i = 0; i < rows.length; i++) {
          var row = rows[i];
          if (!row || typeof row !== "object") continue;
          var rowKeys = Object.keys(row);
          for (var j = 0; j < rowKeys.length; j++) {
            var rk = rowKeys[j];
            if (SECRET.test(rk)) continue;
            if (!STATUS.test(rk)) continue;
            var rv = row[rk];
            if (typeof rv === "boolean" || typeof rv === "number" || typeof rv === "string") fields.push(rk);
          }
        }
        var unique = {};
        var out = [];
        for (var f = 0; f < fields.length; f++) {
          if (!unique[fields[f]]) { unique[fields[f]] = true; out.push(fields[f]); }
        }
        return out;
      }

      function pushHit(path, value) {
        if (!path || path === "html" || path === "body" || path === "#app") return;
        var ids = collectIds(value, 0);
        if (!ids.length) return;
        var statusFields = statusFieldsFromValue(value);
        hits.push({
          dataPath: path,
          source: detectSource(path),
          matchedInventoryIds: ids.slice(0, 5000),
          collectionLength: Array.isArray(value) ? value.length : ids.length,
          statusFields: statusFields,
          hasPerDeviceStatus: statusFields.length > 0
        });
      }

      var app = document.querySelector("#app");
      if (!app) return [];

      var roots = [];
      if (app.__vue__) roots.push({ path: "#app.__vue__", value: app.__vue__ });
      if (app.__vue_app__) roots.push({ path: "#app.__vue_app__", value: app.__vue_app__ });
      if (app.__vueParentComponent) roots.push({ path: "#app.__vueParentComponent", value: app.__vueParentComponent });
      if (app.__vnode) roots.push({ path: "#app.__vnode", value: app.__vnode });

      var vueApp = app.__vue_app__;
      if (vueApp && vueApp._instance) {
        roots.push({ path: "#app.__vue_app__._instance", value: vueApp._instance });
        if (vueApp._instance.setupState) roots.push({ path: "#app.__vue_app__._instance.setupState", value: vueApp._instance.setupState });
        if (vueApp._instance.data) roots.push({ path: "#app.__vue_app__._instance.data", value: vueApp._instance.data });
        if (vueApp._instance.props) roots.push({ path: "#app.__vue_app__._instance.props", value: vueApp._instance.props });
        if (vueApp._instance.ctx) roots.push({ path: "#app.__vue_app__._instance.ctx", value: vueApp._instance.ctx });
        if (vueApp._instance.proxy) roots.push({ path: "#app.__vue_app__._instance.proxy", value: vueApp._instance.proxy });
        if (vueApp._instance.exposed) roots.push({ path: "#app.__vue_app__._instance.exposed", value: vueApp._instance.exposed });
        if (vueApp._instance.subTree) roots.push({ path: "#app.__vue_app__._instance.subTree", value: vueApp._instance.subTree });
      }

      var vue2 = app.__vue__;
      if (vue2) {
        if (vue2.$data) roots.push({ path: "#app.__vue__.$data", value: vue2.$data });
        if (vue2.$props) roots.push({ path: "#app.__vue__.$props", value: vue2.$props });
        if (vue2.$store) roots.push({ path: "#app.__vue__.$store", value: vue2.$store });
        if (vue2.$root) roots.push({ path: "#app.__vue__.$root", value: vue2.$root });
        if (vue2._data) roots.push({ path: "#app.__vue__._data", value: vue2._data });
        if (vue2._props) roots.push({ path: "#app.__vue__._props", value: vue2._props });
      }

      if (vueApp && vueApp._context && vueApp._context.provides) {
        roots.push({ path: "#app.__vue_app__._context.provides", value: vueApp._context.provides });
      }

      var queue = roots.slice();
      var visited = new Set();
      while (queue.length > 0 && hits.length < 80 && inspected < MAX_OBJECTS) {
        var item = queue.shift();
        if (!item || visited.has(item.path)) continue;
        visited.add(item.path);
        pushHit(item.path, item.value);

        var value = item.value;
        if (!value || typeof value !== "object") continue;
        var keys = Object.keys(value).slice(0, 80);
        for (var i = 0; i < keys.length; i++) {
          var key = keys[i];
          if (SECRET.test(key)) continue;
          var child = value[key];
          if (!child || typeof child !== "object") continue;
          var childPath = item.path + "." + key;
          if (/state|store|pinia|device|tree|table|monitor|list|records|data/i.test(key)) {
            queue.push({ path: childPath, value: child });
          }
        }
      }

      return Array.isArray(hits) ? hits : [];
    } catch (e) {
      return [];
    }
  })()`;
}
