import type { Page } from "playwright";
import { assertBrowserScriptSafe } from "../browser/browser-page-scripts.js";
import {
  normalizePositionInventoryExtraction,
  parsedPositionFromCandidate,
  candidateFromRecord,
} from "./position-source-extract.js";
import { buildPositionExtractAllScript } from "./position-source-extract.js";
import { parsePositionLast, type ParsedPositionLast } from "./position-last-parser.js";

export type CacheComponentDiscovery = {
  deviceListPath: string | null;
  mapComponentPaths: string[];
  cacheMgrFound: boolean;
  error: string | null;
};

export type CachePositionRecord = {
  deviceId: string;
  fieldPath: string;
  record: Record<string, unknown>;
};

export type CacheSelectionResult = {
  selectedDeviceId: string;
  found: boolean;
  fieldPath: string | null;
  record: Record<string, unknown> | null;
  componentPath: string | null;
  error: string | null;
};

export function buildDiscoverCacheComponentsScript(): string {
  return `(async () => {
    try {
      function componentName(vm) {
        if (!vm) return null;
        if (vm.$options && vm.$options.name) return vm.$options.name;
        if (vm.type && vm.type.name) return vm.type.name;
        return null;
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
      function hasConnectivityMethods(vm) {
        if (!vm || !vm.$options || !vm.$options.methods) return false;
        var methods = vm.$options.methods;
        return typeof methods.setCurrentZtree === "function" &&
          typeof methods.tablesClickRowDevice === "function";
      }
      function isMapComponent(name, vm) {
        if (!name) name = "";
        if (name.toLowerCase().indexOf("map") >= 0) return true;
        if (vm && (vm.mapIconMarkers || vm.markers || vm.mapIns)) return true;
        return false;
      }
      function resolveCacheMgr(app) {
        if (typeof window !== "undefined" && window.cacheMgr &&
            window.cacheMgr.deviceInfos && window.cacheMgr.lastPositions) {
          return window.cacheMgr;
        }
        return null;
      }
      var app = document.querySelector("#app");
      if (!app) return { deviceListPath: null, mapComponentPaths: [], cacheMgrFound: false, error: "no_app_element" };
      var components = [];
      if (app.__vue__) {
        app.__vue__.__discoveryPath = "#app.__vue__";
        walkVue(app.__vue__, 0, components);
      }
      var deviceListPath = null;
      var mapPaths = [];
      for (var i = 0; i < components.length; i++) {
        var item = components[i];
        if (hasConnectivityMethods(item.vm)) {
          if (!deviceListPath || item.name === "DeviceList") deviceListPath = item.path;
        }
        if (isMapComponent(item.name, item.vm)) mapPaths.push(item.path);
      }
      return {
        deviceListPath: deviceListPath,
        mapComponentPaths: mapPaths,
        cacheMgrFound: !!resolveCacheMgr(app),
        error: null
      };
    } catch (e) {
      return { deviceListPath: null, mapComponentPaths: [], cacheMgrFound: false, error: String(e && e.message ? e.message : e) };
    }
  })()`;
}

export function buildSelectDeviceAndWaitForCacheScript(
  deviceId: string,
  timeoutMs: number,
): string {
  const serializedDeviceId = JSON.stringify(deviceId);
  const serializedTimeout = JSON.stringify(timeoutMs);
  return `(async () => {
    try {
      var deviceId = ${serializedDeviceId};
      var timeoutMs = ${serializedTimeout};

      function componentName(vm) {
        if (!vm) return null;
        if (vm.$options && vm.$options.name) return vm.$options.name;
        return null;
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
      function hasConnectivityMethods(vm) {
        if (!vm || !vm.$options || !vm.$options.methods) return false;
        var methods = vm.$options.methods;
        return typeof methods.setCurrentZtree === "function" &&
          typeof methods.tablesClickRowDevice === "function";
      }
      function resolveCacheMgr() {
        if (typeof window !== "undefined" && window.cacheMgr &&
            window.cacheMgr.lastPositions) {
          return window.cacheMgr;
        }
        return null;
      }
      function pickNumber(record, keys) {
        for (var i = 0; i < keys.length; i++) {
          var candidate = record[keys[i]];
          if (candidate == null || candidate === "") continue;
          var n = typeof candidate === "number" ? candidate : Number(candidate);
          if (isFinite(n)) return n;
        }
        return null;
      }
      function hasValidCoords(record) {
        if (!record) return false;
        var lat = pickNumber(record, ["callat", "calLat", "lat", "latitude", "maplat", "mapLat"]);
        var lng = pickNumber(record, ["callon", "calLon", "lng", "lon", "longitude", "maplon", "mapLon"]);
        if (lat == null || lng == null) return false;
        if (Math.abs(lat) > 90) lat = lat / 1000000;
        if (Math.abs(lng) > 180) lng = lng / 1000000;
        if (lat === 0 && lng === 0) return false;
        return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
      }
      function wait(ms) { return new Promise(function(resolve) { setTimeout(resolve, ms); }); }

      var app = document.querySelector("#app");
      if (!app || !app.__vue__) {
        return { selectedDeviceId: deviceId, found: false, fieldPath: null, record: null, componentPath: null, error: "no_app_vue_root" };
      }
      app.__vue__.__discoveryPath = "#app.__vue__";
      var components = [];
      walkVue(app.__vue__, 0, components);
      var deviceList = null;
      for (var c = 0; c < components.length; c++) {
        if (hasConnectivityMethods(components[c].vm)) {
          if (!deviceList || components[c].name === "DeviceList") deviceList = components[c];
        }
      }
      if (!deviceList) {
        return { selectedDeviceId: deviceId, found: false, fieldPath: null, record: null, componentPath: null, error: "device_list_not_found" };
      }

      var cacheMgr = resolveCacheMgr();
      var before = cacheMgr && cacheMgr.lastPositions ? cacheMgr.lastPositions[deviceId] : null;
      var beforeKey = before ? JSON.stringify(before) : null;

      deviceList.vm.tablesClickRowDevice(deviceId);

      var deadline = Date.now() + timeoutMs;
      var foundRecord = null;
      while (Date.now() < deadline) {
        await wait(200);
        cacheMgr = resolveCacheMgr();
        if (!cacheMgr || !cacheMgr.lastPositions) continue;
        var current = cacheMgr.lastPositions[deviceId];
        if (!current || !hasValidCoords(current)) continue;
        var currentKey = JSON.stringify(current);
        if (!beforeKey || currentKey !== beforeKey || hasValidCoords(current)) {
          foundRecord = current;
          break;
        }
      }

      if (!foundRecord) {
        return { selectedDeviceId: deviceId, found: false, fieldPath: "cacheMgr.lastPositions[" + deviceId + "]", record: null, componentPath: deviceList.path, error: "cache_timeout" };
      }

      return {
        selectedDeviceId: deviceId,
        found: true,
        fieldPath: "cacheMgr.lastPositions[" + deviceId + "]",
        record: foundRecord,
        componentPath: deviceList.path,
        error: null
      };
    } catch (e) {
      return { selectedDeviceId: ${serializedDeviceId}, found: false, fieldPath: null, record: null, componentPath: null, error: String(e && e.message ? e.message : e) };
    }
  })()`;
}

export function buildExtractOnlineDeviceIdsScript(): string {
  return `(async () => {
    try {
      function componentName(vm) {
        if (!vm) return null;
        if (vm.$options && vm.$options.name) return vm.$options.name;
        return null;
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
      function hasConnectivityMethods(vm) {
        if (!vm || !vm.$options || !vm.$options.methods) return false;
        var methods = vm.$options.methods;
        return typeof methods.setCurrentZtree === "function" &&
          typeof methods.tablesClickRowDevice === "function";
      }
      function nodeDeviceId(node) {
        if (!node) return null;
        if (node.deviceid != null) return String(node.deviceid);
        if (node.info && node.info.deviceid != null) return String(node.info.deviceid);
        return null;
      }
      function nodeIsOnline(node) {
        if (!node) return false;
        if (node.isOnline) return true;
        if (node.online === 1 || node.online === true) return true;
        if (node.info && node.info.online) return true;
        return false;
      }
      function wait(ms) { return new Promise(function(resolve) { setTimeout(resolve, ms); }); }
      function collectOnlineIds(nodes, out) {
        if (!Array.isArray(nodes)) return;
        for (var i = 0; i < nodes.length; i++) {
          var node = nodes[i];
          if (!node) continue;
          var id = nodeDeviceId(node);
          if (id && nodeIsOnline(node)) out.push(id);
          if (node.children) collectOnlineIds(node.children, out);
        }
      }

      var app = document.querySelector("#app");
      if (!app || !app.__vue__) return { onlineDeviceIds: [], componentPath: null, error: "no_app_vue_root" };
      app.__vue__.__discoveryPath = "#app.__vue__";
      var components = [];
      walkVue(app.__vue__, 0, components);
      var deviceList = null;
      for (var c = 0; c < components.length; c++) {
        if (hasConnectivityMethods(components[c].vm)) {
          if (!deviceList || components[c].name === "DeviceList") deviceList = components[c];
        }
      }
      if (!deviceList) return { onlineDeviceIds: [], componentPath: null, error: "device_list_not_found" };

      try {
        deviceList.vm.setCurrentZtree("online");
        await wait(800);
      } catch (e1) {}

      var nodes = deviceList.vm.currentStateTreeNodes || deviceList.vm.treeData || [];
      var onlineIds = [];
      collectOnlineIds(nodes, onlineIds);
      try { deviceList.vm.setCurrentZtree("all"); } catch (e2) {}

      return { onlineDeviceIds: onlineIds, componentPath: deviceList.path, error: null };
    } catch (e) {
      return { onlineDeviceIds: [], componentPath: null, error: String(e && e.message ? e.message : e) };
    }
  })()`;
}

export async function readCachePositionsOnPage(
  page: Page,
  inventoryIds: Set<string>,
): Promise<Map<string, Record<string, unknown>>> {
  const script = buildPositionExtractAllScript([...inventoryIds]);
  assertBrowserScriptSafe(script);
  const raw = await page.evaluate(script).catch(() => null);
  const extraction = normalizePositionInventoryExtraction(raw, inventoryIds);
  const map = new Map<string, Record<string, unknown>>();
  for (const position of extraction.positions) {
    map.set(position.sourceDeviceId, position.rawPayload);
  }
  for (const item of Array.isArray((raw as Record<string, unknown> | null)?.records)
    ? ((raw as Record<string, unknown>).records as unknown[])
    : []) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const deviceId = typeof record.deviceId === "string" ? record.deviceId : null;
    const payload = record.record;
    if (deviceId && payload && typeof payload === "object") {
      map.set(deviceId, payload as Record<string, unknown>);
    }
  }
  return map;
}

export async function discoverCacheComponentsOnPage(page: Page): Promise<CacheComponentDiscovery> {
  const script = buildDiscoverCacheComponentsScript();
  assertBrowserScriptSafe(script);
  const raw = await page.evaluate(script).catch(() => null);
  const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    deviceListPath: typeof record.deviceListPath === "string" ? record.deviceListPath : null,
    mapComponentPaths: Array.isArray(record.mapComponentPaths)
      ? record.mapComponentPaths.filter((item): item is string => typeof item === "string")
      : [],
    cacheMgrFound: record.cacheMgrFound === true,
    error: typeof record.error === "string" ? record.error : null,
  };
}

export async function extractOnlineDeviceIdsOnPage(page: Page): Promise<Set<string>> {
  const script = buildExtractOnlineDeviceIdsScript();
  assertBrowserScriptSafe(script);
  const raw = await page.evaluate(script).catch(() => null);
  const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const ids = Array.isArray(record.onlineDeviceIds)
    ? record.onlineDeviceIds.filter((item): item is string => typeof item === "string")
    : [];
  return new Set(ids);
}

export async function selectDeviceAndWaitForCacheOnPage(
  page: Page,
  deviceId: string,
  timeoutMs: number,
): Promise<CacheSelectionResult> {
  const script = buildSelectDeviceAndWaitForCacheScript(deviceId, timeoutMs);
  assertBrowserScriptSafe(script);
  const raw = await page.evaluate(script).catch(() => null);
  const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    selectedDeviceId: typeof record.selectedDeviceId === "string" ? record.selectedDeviceId : deviceId,
    found: record.found === true,
    fieldPath: typeof record.fieldPath === "string" ? record.fieldPath : null,
    record: record.record && typeof record.record === "object" ? (record.record as Record<string, unknown>) : null,
    componentPath: typeof record.componentPath === "string" ? record.componentPath : null,
    error: typeof record.error === "string" ? record.error : null,
  };
}

export function parseCacheRecord(
  deviceId: string,
  record: Record<string, unknown>,
): ParsedPositionLast | null {
  const candidate = candidateFromRecord(
    "map_component_state",
    `cacheMgr.lastPositions[${deviceId}]`,
    { ...record, deviceid: deviceId },
  );
  if (candidate) {
    return parsedPositionFromCandidate(candidate);
  }
  const parsed = parsePositionLast({ ...record, deviceid: deviceId });
  return parsed.ok ? parsed.position : null;
}
