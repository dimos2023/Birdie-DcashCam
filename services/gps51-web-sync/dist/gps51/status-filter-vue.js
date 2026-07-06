export function compareStateSnapshots(before, after) {
    const beforeMap = new Map(before.map((entry) => [entry.path, entry]));
    const changed = [];
    for (const entry of after) {
        const prev = beforeMap.get(entry.path);
        if (!prev) {
            changed.push({ path: entry.path, before: null, after: entry, changeKind: inferChangeKind(entry) });
            continue;
        }
        if (entry.type === "primitive" && prev.value !== entry.value) {
            changed.push({ path: entry.path, before: prev, after: entry, changeKind: "primitive" });
            continue;
        }
        if (entry.type === "array" && prev.length !== entry.length) {
            changed.push({ path: entry.path, before: prev, after: entry, changeKind: "array_length" });
            continue;
        }
        if (entry.type === "object" && prev.keyCount !== entry.keyCount) {
            changed.push({ path: entry.path, before: prev, after: entry, changeKind: "object_keys" });
        }
    }
    return changed;
}
function inferChangeKind(entry) {
    if (entry.type === "array")
        return "array_length";
    if (entry.type === "object")
        return "object_keys";
    return "primitive";
}
export function isFrameworkStatePath(path) {
    const segments = path.split(".");
    return segments.some((segment) => segment.startsWith("_") || segment.startsWith("$"));
}
export function buildStatusFilterProbeScript(inventorySample, tabLabels) {
    const serializedInventory = JSON.stringify(inventorySample);
    const serializedLabels = JSON.stringify(tabLabels);
    const searchTerms = JSON.stringify([
        "deviceid",
        "filter(",
        "online",
        "offline",
        "status",
        "lastactivetime",
        "offlinedelay",
        "active",
        "login",
        "connection",
        "tree",
        "monitor",
    ]);
    return `(() => {
    try {
      const inventorySample = ${serializedInventory};
      const tabLabels = ${serializedLabels};
      const searchTerms = ${searchTerms};
      const inventorySet = {};
      for (var i = 0; i < inventorySample.length; i++) inventorySet[inventorySample[i]] = true;

      function isInternalKey(key) {
        if (!key) return true;
        if (key.indexOf("_") === 0 || key.indexOf("$") === 0) return true;
        return ["__ob__","_directInactive","_inactive","_isBeingDestroyed","_isDestroyed","_watchers","_events"].indexOf(key) >= 0;
      }

      function snippetFromSource(source) {
        if (!source || typeof source !== "string") return "";
        var normalized = source.replace(/\\s+/g, " ");
        var lower = normalized.toLowerCase();
        var best = -1;
        for (var t = 0; t < searchTerms.length; t++) {
          var idx = lower.indexOf(searchTerms[t].toLowerCase());
          if (idx >= 0 && (best < 0 || idx < best)) best = idx;
        }
        if (best < 0) return normalized.slice(0, 500);
        return normalized.slice(Math.max(0, best - 120), Math.max(0, best - 120) + 500);
      }

      function matchedTerms(source) {
        var out = [];
        if (!source) return out;
        var lower = String(source).toLowerCase();
        for (var t = 0; t < searchTerms.length; t++) {
          if (lower.indexOf(searchTerms[t].toLowerCase()) >= 0) out.push(searchTerms[t]);
        }
        return out;
      }

      function collectIds(value, depth) {
        if (depth > 8 || value == null) return [];
        var found = [];
        var seen = {};
        function add(id) { if (id && inventorySet[id] && !seen[id]) { seen[id] = true; found.push(id); } }
        function token(v) {
          if (typeof v === "number" && isFinite(v)) { var s = String(Math.trunc(v)); return s.length >= 8 ? s : null; }
          if (typeof v === "string") { var t = v.trim(); return t.length >= 8 ? t : null; }
          return null;
        }
        var direct = token(value);
        if (direct) add(direct);
        if (Array.isArray(value)) {
          for (var i = 0; i < value.length; i++) {
            var child = collectIds(value[i], depth + 1);
            for (var j = 0; j < child.length; j++) add(child[j]);
          }
          return found;
        }
        if (value && typeof value === "object") {
          var keys = Object.keys(value).slice(0, 120);
          for (var k = 0; k < keys.length; k++) {
            var key = keys[k];
            if (isInternalKey(key)) continue;
            if (/deviceid|device_id|deviceId/i.test(key)) add(token(value[key]));
            var nested = collectIds(value[key], depth + 1);
            for (var n = 0; n < nested.length; n++) add(nested[n]);
          }
        }
        return found;
      }

      function sanitizeState(path, value, depth) {
        if (depth > 6 || value == null) return null;
        if (typeof value === "function") return null;
        if (typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
          return { path: path, type: "primitive", value: value };
        }
        if (Array.isArray(value)) {
          return { path: path, type: "array", length: value.length };
        }
        if (typeof value === "object") {
          var keys = Object.keys(value).filter(function(k) { return !isInternalKey(k); });
          return { path: path, type: "object", keyCount: keys.length };
        }
        return null;
      }

      function walkState(basePath, value, out, depth) {
        if (depth > 5 || value == null || typeof value !== "object") return;
        if (Array.isArray(value)) {
          var arrEntry = sanitizeState(basePath, value, depth);
          if (arrEntry) out.push(arrEntry);
          var ids = collectIds(value, 0);
          if (ids.length > 0) {
            hits.push({ dataPath: basePath, matchedInventoryIds: ids, collectionLength: value.length });
          }
          return;
        }
        var keys = Object.keys(value).slice(0, 80);
        for (var i = 0; i < keys.length; i++) {
          var key = keys[i];
          if (isInternalKey(key)) continue;
          var childPath = basePath ? basePath + "." + key : key;
          var child = value[key];
          var entry = sanitizeState(childPath, child, depth + 1);
          if (entry) out.push(entry);
          if (child && typeof child === "object") walkState(childPath, child, out, depth + 1);
        }
      }

      function componentName(vm) {
        if (!vm) return null;
        if (vm.$options && vm.$options.name) return vm.$options.name;
        if (vm.type && vm.type.name) return vm.type.name;
        var vueComponentNameKey = "__" + "name";
        if (vm.type && vm.type[vueComponentNameKey]) return vm.type[vueComponentNameKey];
        return null;
      }

      function fileHint(vm) {
        if (!vm) return null;
        if (vm.$options && vm.$options.__file) return vm.$options.__file;
        if (vm.type && vm.type.__file) return vm.type.__file;
        return null;
      }

      function recordFunctions(componentPath, vm, out) {
        if (!vm) return;
        var name = componentName(vm);
        function inspectMap(map, kind) {
          if (!map || typeof map !== "object") return;
          var keys = Object.keys(map).slice(0, 40);
          for (var i = 0; i < keys.length; i++) {
            var fnName = keys[i];
            if (isInternalKey(fnName)) continue;
            var fn = map[fnName];
            var source = "";
            try { source = Function.prototype.toString.call(fn); } catch (e) { source = ""; }
            var terms = matchedTerms(source);
            if (terms.length === 0) continue;
            out.push({
              componentPath: componentPath,
              componentName: name,
              kind: kind,
              name: fnName,
              snippet: snippetFromSource(source),
              matchedTerms: terms
            });
          }
        }
        if (vm.$options) {
          inspectMap(vm.$options.computed, "computed");
          inspectMap(vm.$options.methods, "method");
          inspectMap(vm.$options.watch, "watch");
          inspectMap(vm.$options.filters, "filter");
        }
        if (vm.type) {
          inspectMap(vm.type.computed, "computed");
          inspectMap(vm.type.methods, "method");
        }
        if (vm.setupState && typeof vm.setupState === "object") {
          var setupKeys = Object.keys(vm.setupState).slice(0, 40);
          for (var s = 0; s < setupKeys.length; s++) {
            var sk = setupKeys[s];
            if (isInternalKey(sk)) continue;
            var sv = vm.setupState[sk];
            if (typeof sv !== "function") continue;
            var setupSource = "";
            try { setupSource = Function.prototype.toString.call(sv); } catch (e2) { setupSource = ""; }
            var setupTerms = matchedTerms(setupSource);
            if (setupTerms.length === 0) continue;
            out.push({
              componentPath: componentPath + ".setupState",
              componentName: name,
              kind: "computed",
              name: sk,
              snippet: snippetFromSource(setupSource),
              matchedTerms: setupTerms
            });
          }
        }
      }

      function summarizeComponent(componentPath, vm) {
        var dataKeys = [];
        var propKeys = [];
        var computedKeys = [];
        var methodKeys = [];
        var watcherKeys = [];
        var arrayStateLengths = {};
        var objectStateKeyCounts = {};

        if (vm.$data && typeof vm.$data === "object") {
          dataKeys = Object.keys(vm.$data).filter(function(k) { return !isInternalKey(k); });
          for (var i = 0; i < dataKeys.length; i++) {
            var dk = dataKeys[i];
            var dv = vm.$data[dk];
            if (Array.isArray(dv)) arrayStateLengths[dk] = dv.length;
            else if (dv && typeof dv === "object") objectStateKeyCounts[dk] = Object.keys(dv).length;
          }
        }
        if (vm.$props && typeof vm.$props === "object") {
          propKeys = Object.keys(vm.$props).filter(function(k) { return !isInternalKey(k); });
        }
        if (vm.$options && vm.$options.computed) computedKeys = Object.keys(vm.$options.computed).filter(function(k) { return !isInternalKey(k); });
        if (vm.$options && vm.$options.methods) methodKeys = Object.keys(vm.$options.methods).filter(function(k) { return !isInternalKey(k); });
        if (vm.$options && vm.$options.watch) watcherKeys = Object.keys(vm.$options.watch).filter(function(k) { return !isInternalKey(k); });
        if (vm.setupState && typeof vm.setupState === "object") {
          var setupKeys = Object.keys(vm.setupState).filter(function(k) { return !isInternalKey(k); });
          dataKeys = dataKeys.concat(setupKeys);
          for (var s = 0; s < setupKeys.length; s++) {
            var sk = setupKeys[s];
            var sv = vm.setupState[sk];
            if (Array.isArray(sv)) arrayStateLengths[sk] = sv.length;
            else if (sv && typeof sv === "object") objectStateKeyCounts[sk] = Object.keys(sv).length;
          }
        }

        return {
          componentPath: componentPath,
          componentName: componentName(vm),
          fileHint: fileHint(vm),
          dataKeys: dataKeys.slice(0, 60),
          propKeys: propKeys.slice(0, 60),
          computedKeys: computedKeys.slice(0, 60),
          methodKeys: methodKeys.slice(0, 60),
          watcherKeys: watcherKeys.slice(0, 60),
          arrayStateLengths: arrayStateLengths,
          objectStateKeyCounts: objectStateKeyCounts
        };
      }

      var components = [];
      var stateSnapshot = [];
      var functionSources = [];
      var hits = [];
      var seenPaths = {};

      function walkComponentTree(vm, basePath, depth) {
        if (!vm || depth > 20 || seenPaths[basePath]) return;
        seenPaths[basePath] = true;
        components.push(summarizeComponent(basePath, vm));
        recordFunctions(basePath, vm, functionSources);
        walkState(basePath, vm.$data || vm.setupState || vm.proxy || vm, stateSnapshot, 0);

        var children = vm.$children || [];
        for (var i = 0; i < children.length; i++) {
          walkComponentTree(children[i], basePath + ".$children[" + i + "]", depth + 1);
        }
        if (vm.$refs && typeof vm.$refs === "object") {
          var refKeys = Object.keys(vm.$refs).slice(0, 30);
          for (var r = 0; r < refKeys.length; r++) {
            var ref = vm.$refs[refKeys[r]];
            if (!ref) continue;
            if (Array.isArray(ref)) {
              for (var a = 0; a < ref.length; a++) {
                if (ref[a] && ref[a].$options) {
                  walkComponentTree(ref[a], basePath + ".$refs." + refKeys[r] + "[" + a + "]", depth + 1);
                }
              }
            } else if (ref.$options) {
              walkComponentTree(ref, basePath + ".$refs." + refKeys[r], depth + 1);
            }
          }
        }
      }

      function elementHasTabLabels(el) {
        var text = (el.textContent || "").replace(/\\s+/g, " ").toLowerCase();
        var matched = 0;
        for (var i = 0; i < tabLabels.length; i++) {
          if (text.indexOf(String(tabLabels[i]).toLowerCase()) >= 0) matched += 1;
        }
        return matched >= 2;
      }

      function resolveVm(el) {
        if (!el) return [];
        var out = [];
        if (el.__vue__) out.push({ path: "element.__vue__", vm: el.__vue__ });
        if (el.__vueParentComponent) out.push({ path: "element.__vueParentComponent", vm: el.__vueParentComponent });
        return out;
      }

      var candidates = document.querySelectorAll("[class*='tab'], .ivu-tabs, .vxe-table, .ivu-tree, .el-tree, #app *");
      for (var c = 0; c < candidates.length && components.length < 30; c++) {
        var el = candidates[c];
        if (!elementHasTabLabels(el) && !el.matches(".vxe-table, .ivu-tree, .el-tree")) continue;
        var vms = resolveVm(el);
        if (el.matches("#app")) {
          var app = el;
          if (app.__vue__) vms.push({ path: "#app.__vue__", vm: app.__vue__ });
          if (app.__vue_app__ && app.__vue_app__._instance) vms.push({ path: "#app.__vue_app__._instance", vm: app.__vue_app__._instance });
        }
        for (var v = 0; v < vms.length; v++) {
          var item = vms[v];
          if (!item.vm) continue;
          walkComponentTree(item.vm, item.path, 0);
        }
      }

      var app = document.querySelector("#app");
      if (app && app.__vue_app__ && app.__vue_app__._instance) {
        var root = app.__vue_app__._instance;
        var rootPath = "#app.__vue_app__._instance";
        if (!seenPaths[rootPath]) walkComponentTree(root, rootPath, 0);
      }
      if (app && app.__vue__ && !seenPaths["#app.__vue__"]) {
        walkComponentTree(app.__vue__, "#app.__vue__", 0);
      }

      var rowNodes = document.querySelectorAll(".vxe-body--row, .ivu-tree-title, .el-tree-node__content");
      var rowSignature = "";
      for (var r = 0; r < rowNodes.length && r < 20; r++) {
        rowSignature += (rowNodes[r].textContent || "").trim().slice(0, 40) + "|";
      }

      return {
        components: components,
        stateSnapshot: stateSnapshot,
        functionSources: functionSources,
        collectionHits: hits,
        rowSignature: rowSignature
      };
    } catch (e) {
      return { components: [], stateSnapshot: [], functionSources: [], collectionHits: [], rowSignature: "" };
    }
  })()`;
}
export function normalizeBrowserFilterProbe(raw) {
    const record = raw && typeof raw === "object" ? raw : {};
    const components = Array.isArray(record.components)
        ? record.components.filter((item) => item != null && typeof item === "object")
        : [];
    const stateSnapshot = Array.isArray(record.stateSnapshot)
        ? record.stateSnapshot.filter((item) => item != null && typeof item === "object")
        : [];
    const functionSources = Array.isArray(record.functionSources)
        ? record.functionSources.filter((item) => item != null && typeof item === "object")
        : [];
    const collectionHits = Array.isArray(record.collectionHits)
        ? record.collectionHits
            .filter((item) => item != null && typeof item === "object")
            .map((item) => ({
            dataPath: typeof item.dataPath === "string" ? item.dataPath : "",
            matchedInventoryIds: Array.isArray(item.matchedInventoryIds)
                ? item.matchedInventoryIds.filter((id) => typeof id === "string")
                : [],
            collectionLength: typeof item.collectionLength === "number" ? item.collectionLength : 0,
        }))
        : [];
    return {
        components,
        stateSnapshot,
        functionSources,
        collectionHits,
        rowSignature: typeof record.rowSignature === "string" ? record.rowSignature : "",
    };
}
