import type { Page } from "playwright";
import { assertBrowserScriptSafe } from "./browser-page-scripts.js";

export const TELEMETRY_SUMMARY_FILE = "device-telemetry-summary.json";
export const TELEMETRY_FIELDS_FILE = "device-telemetry-fields.json";
export const TELEMETRY_SAMPLE_FILE = "device-telemetry-sample.json";
export const POSITION_REFRESH_SUMMARY_FILE = "position-refresh-summary.json";

export type PositionRefreshSelection = {
  selectedDeviceId: string | null;
  componentPath: string | null;
  onlineCount: number;
  selectionMethod: string | null;
  error: string | null;
};

export function buildDeviceTelemetryInspectScript(inventorySample: string[]): string {
  const serializedInventory = JSON.stringify(inventorySample);
  return `(async () => {
    try {
      var inventorySample = ${serializedInventory};
      var inventorySet = {};
      for (var i = 0; i < inventorySample.length; i++) inventorySet[inventorySample[i]] = true;

      function isInternalKey(key) {
        return !key || key.indexOf("_") === 0 || key.indexOf("$") === 0;
      }

      function componentName(vm) {
        if (!vm) return null;
        if (vm.$options && vm.$options.name) return vm.$options.name;
        if (vm.type && vm.type.name) return vm.type.name;
        var vueComponentNameKey = "__" + "name";
        if (vm.type && vm.type[vueComponentNameKey]) return vm.type[vueComponentNameKey];
        return null;
      }

      function hasConnectivityMethods(vm) {
        if (!vm || !vm.$options || !vm.$options.methods) return false;
        var methods = vm.$options.methods;
        return typeof methods.setCurrentZtree === "function" &&
          typeof methods.tablesClickRowDevice === "function";
      }

      function walkVue(vm, depth, out) {
        if (!vm || depth > 25) return;
        out.push({ vm: vm, name: componentName(vm), path: vm.__discoveryPath || "vm" });
        var children = vm.$children || [];
        for (var i = 0; i < children.length; i++) {
          children[i].__discoveryPath = (vm.__discoveryPath || "vm") + ".$children[" + i + "]";
          walkVue(children[i], depth + 1, out);
        }
        if (vm.$refs && typeof vm.$refs === "object") {
          var refKeys = Object.keys(vm.$refs).slice(0, 40);
          for (var r = 0; r < refKeys.length; r++) {
            var ref = vm.$refs[refKeys[r]];
            if (!ref) continue;
            if (Array.isArray(ref)) {
              for (var a = 0; a < ref.length; a++) {
                if (ref[a] && ref[a].$options) {
                  ref[a].__discoveryPath = (vm.__discoveryPath || "vm") + ".$refs." + refKeys[r] + "[" + a + "]";
                  walkVue(ref[a], depth + 1, out);
                }
              }
            } else if (ref.$options) {
              ref.__discoveryPath = (vm.__discoveryPath || "vm") + ".$refs." + refKeys[r];
              walkVue(ref, depth + 1, out);
            }
          }
        }
      }

      function nodeDeviceId(node) {
        if (!node) return null;
        if (node.deviceid != null) return String(node.deviceid);
        if (node.info && node.info.deviceid != null) return String(node.info.deviceid);
        return null;
      }

      function wait(ms) {
        return new Promise(function(resolve) { setTimeout(resolve, ms); });
      }

      function collectLeaves(value, prefix, out, depth) {
        if (depth > 3 || value == null) return;
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
          out[prefix] = value;
          return;
        }
        if (Array.isArray(value)) return;
        if (typeof value !== "object") return;
        var keys = Object.keys(value).slice(0, 40);
        for (var i = 0; i < keys.length; i++) {
          var key = keys[i];
          if (isInternalKey(key) || key === "children") continue;
          collectLeaves(value[key], prefix ? prefix + "." + key : key, out, depth + 1);
        }
      }

      function extractFromTreeNodes(nodes) {
        if (!Array.isArray(nodes)) return { deviceNodes: [], samples: [], fieldCounts: {} };
        var deviceNodes = [];
        var fieldCounts = {};
        var samples = [];
        var seen = {};

        function walk(list) {
          if (!Array.isArray(list)) return;
          for (var i = 0; i < list.length; i++) {
            var node = list[i];
            if (!node) continue;
            var id = nodeDeviceId(node);
            if (id && inventorySet[id] && !seen[id]) {
              seen[id] = true;
              deviceNodes.push(node);
              var flattened = {};
              collectLeaves(node, "", flattened, 0);
              var keys = Object.keys(flattened);
              for (var k = 0; k < keys.length; k++) {
                fieldCounts[keys[k]] = (fieldCounts[keys[k]] || 0) + 1;
              }
              if (samples.length < 5) {
                samples.push({
                  deviceId: id,
                  fields: flattened
                });
              }
            }
            if (node.children) walk(node.children);
          }
        }

        walk(nodes);
        return { deviceNodes: deviceNodes, samples: samples, fieldCounts: fieldCounts };
      }

      function semanticMatches(fieldCounts) {
        var semantics = {
          deviceid: [/deviceid$/i],
          devicename: [/devicename$/i, /(^|\\.)name$/i],
          latitude: [/callat$/i, /(^|\\.)lat$/i, /latitude$/i],
          longitude: [/callon$/i, /(^|\\.)lng$/i, /(^|\\.)lon$/i, /longitude$/i],
          speed: [/(^|\\.)speed$/i],
          direction: [/(^|\\.)course$/i, /direction/i],
          altitude: [/altitude/i],
          acc: [/(^|\\.)acc$/i, /accon/i],
          moving: [/(^|\\.)moving$/i],
          positioned: [/positioned/i],
          signal: [/rxlevel/i, /signal/i],
          satellites: [/gpsvalidnum/i, /satellite/i],
          gpsTime: [/validpoistiontime/i, /arrivedtime/i, /located/i],
          updateTime: [/updatetime/i, /updateTime/i],
          sim: [/(^|\\.)sim$/i, /simno/i],
          model: [/model/i, /devicetype/i, /firmware/i]
        };
        var out = {};
        var keys = Object.keys(fieldCounts);
        for (var semantic in semantics) {
          var matched = [];
          for (var i = 0; i < keys.length; i++) {
            for (var p = 0; p < semantics[semantic].length; p++) {
              if (semantics[semantic][p].test(keys[i])) {
                matched.push({ path: keys[i], count: fieldCounts[keys[i]] });
                break;
              }
            }
          }
          out[semantic] = matched.sort(function(a, b) { return b.count - a.count; });
        }
        return out;
      }

      var app = document.querySelector("#app");
      if (!app) {
        return { componentPath: null, componentName: null, nodeCount: 0, fieldCounts: {}, semanticFields: {}, samples: [], error: "no_app_element" };
      }

      var components = [];
      if (app.__vue__) {
        app.__vue__.__discoveryPath = "#app.__vue__";
        walkVue(app.__vue__, 0, components);
      }
      if (app.__vue_app__ && app.__vue_app__._instance) {
        var inst = app.__vue_app__._instance;
        inst.__discoveryPath = "#app.__vue_app__._instance";
        walkVue(inst, 0, components);
      }

      var best = null;
      var bestVm = null;
      var bestScore = -1;
      for (var c = 0; c < components.length; c++) {
        var item = components[c];
        if (!hasConnectivityMethods(item.vm)) continue;
        var treeNodes = item.vm.cacheAllTreeNodes || item.vm.currentStateTreeNodes || item.vm.treeData;
        var extracted = extractFromTreeNodes(treeNodes);
        var overlap = extracted.deviceNodes.length;
        var score = overlap * 1000;
        if (item.name === "DeviceList") score += 500;
        if (score > bestScore) {
          bestScore = score;
          best = { path: item.path, name: item.name, extracted: extracted };
          bestVm = item.vm;
        }
      }

      if (!best || !bestVm) {
        return { componentPath: null, componentName: null, nodeCount: 0, fieldCounts: {}, semanticFields: {}, samples: [], error: "device_list_component_not_found" };
      }

      try {
        bestVm.setCurrentZtree("all");
        await wait(300);
      } catch (e1) {}

      var allTreeNodes = bestVm.cacheAllTreeNodes || bestVm.currentStateTreeNodes || bestVm.treeData;
      var extracted = extractFromTreeNodes(allTreeNodes);
      return {
        componentPath: best.path,
        componentName: best.name,
        nodeCount: extracted.deviceNodes.length,
        fieldCounts: extracted.fieldCounts,
        semanticFields: semanticMatches(extracted.fieldCounts),
        samples: extracted.samples,
        error: null
      };
    } catch (e) {
      return { componentPath: null, componentName: null, nodeCount: 0, fieldCounts: {}, semanticFields: {}, samples: [], error: String(e && e.message ? e.message : e) };
    }
  })()`;
}

export function buildSafeSelectOnlineDeviceScript(targetDeviceId?: string | null): string {
  const serializedTarget = JSON.stringify(targetDeviceId ?? null);
  return `(async () => {
    try {
      var targetDeviceId = ${serializedTarget};
      function componentName(vm) {
        if (!vm) return null;
        if (vm.$options && vm.$options.name) return vm.$options.name;
        if (vm.type && vm.type.name) return vm.type.name;
        var vueComponentNameKey = "__" + "name";
        if (vm.type && vm.type[vueComponentNameKey]) return vm.type[vueComponentNameKey];
        return null;
      }
      function hasConnectivityMethods(vm) {
        if (!vm || !vm.$options || !vm.$options.methods) return false;
        var methods = vm.$options.methods;
        return typeof methods.setCurrentZtree === "function" &&
          typeof methods.tablesClickRowDevice === "function";
      }
      function walkVue(vm, depth, out) {
        if (!vm || depth > 25) return;
        out.push({ vm: vm, name: componentName(vm), path: vm.__discoveryPath || "vm" });
        var children = vm.$children || [];
        for (var i = 0; i < children.length; i++) {
          children[i].__discoveryPath = (vm.__discoveryPath || "vm") + ".$children[" + i + "]";
          walkVue(children[i], depth + 1, out);
        }
      }
      function wait(ms) { return new Promise(function(resolve) { setTimeout(resolve, ms); }); }
      function nodeDeviceId(node) {
        if (!node) return null;
        if (node.deviceid != null) return String(node.deviceid);
        if (node.info && node.info.deviceid != null) return String(node.info.deviceid);
        return null;
      }
      function flattenDeviceIds(nodes, out) {
        if (!Array.isArray(nodes)) return;
        for (var i = 0; i < nodes.length; i++) {
          var node = nodes[i];
          if (!node) continue;
          var id = nodeDeviceId(node);
          if (id) out.push(id);
          if (node.children) flattenDeviceIds(node.children, out);
        }
      }
      var app = document.querySelector("#app");
      if (!app || !app.__vue__) {
        return { selectedDeviceId: null, componentPath: null, onlineCount: 0, selectionMethod: null, error: "no_app_vue_root" };
      }
      app.__vue__.__discoveryPath = "#app.__vue__";
      var components = [];
      walkVue(app.__vue__, 0, components);
      var best = null;
      for (var c = 0; c < components.length; c++) {
        if (hasConnectivityMethods(components[c].vm)) {
          if (!best || components[c].name === "DeviceList") best = components[c];
        }
      }
      if (!best) {
        return { selectedDeviceId: null, componentPath: null, onlineCount: 0, selectionMethod: null, error: "device_list_component_not_found" };
      }
      try {
        best.vm.setCurrentZtree("online");
        await wait(1200);
      } catch (e1) {}
      var currentNodes = best.vm.currentStateTreeNodes || best.vm.treeData || [];
      var ids = [];
      flattenDeviceIds(currentNodes, ids);
      var selected = targetDeviceId && ids.indexOf(targetDeviceId) >= 0 ? targetDeviceId : (ids[0] || null);
      if (!selected) {
        return { selectedDeviceId: null, componentPath: best.path, onlineCount: ids.length, selectionMethod: "setCurrentZtree", error: "no_online_device_found" };
      }
      best.vm.tablesClickRowDevice(selected);
      return { selectedDeviceId: selected, componentPath: best.path, onlineCount: ids.length, selectionMethod: "tablesClickRowDevice", error: null };
    } catch (e) {
      return { selectedDeviceId: null, componentPath: null, onlineCount: 0, selectionMethod: null, error: String(e && e.message ? e.message : e) };
    }
  })()`;
}

export async function inspectDeviceTelemetryOnPage(
  page: Page,
  inventoryIds: Set<string>,
): Promise<Record<string, unknown>> {
  const script = buildDeviceTelemetryInspectScript([...inventoryIds]);
  assertBrowserScriptSafe(script);
  const result = await page.evaluate(script).catch(() => null);
  return result && typeof result === "object" ? (result as Record<string, unknown>) : {};
}

export async function safelySelectOnlineDeviceOnPage(
  page: Page,
  targetDeviceId?: string | null,
): Promise<PositionRefreshSelection> {
  const script = buildSafeSelectOnlineDeviceScript(targetDeviceId);
  assertBrowserScriptSafe(script);
  const raw = await page.evaluate(script).catch(() => null);
  const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    selectedDeviceId: typeof record.selectedDeviceId === "string" ? record.selectedDeviceId : null,
    componentPath: typeof record.componentPath === "string" ? record.componentPath : null,
    onlineCount: typeof record.onlineCount === "number" ? record.onlineCount : 0,
    selectionMethod: typeof record.selectionMethod === "string" ? record.selectionMethod : null,
    error: typeof record.error === "string" ? record.error : null,
  };
}
