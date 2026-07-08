import { parseCoordinatePair, parseEpochMilliseconds, parsePositionLast, } from "./position-last-parser.js";
export const POSITION_SOURCE_PRIORITY = [
    "device_list_tree_nodes",
    "map_component_state",
    "xhr_fetch",
    "websocket_positionLast",
];
const POSITION_FIELD_PATTERNS = [
    "callat",
    "callon",
    "latitude",
    "longitude",
    "lat",
    "lng",
    "lon",
    "maplat",
    "maplon",
    "positionLast",
    "positionlastid",
    "speed",
    "course",
    "direction",
    "altitude",
    "updatetime",
    "validpoistiontime",
    "arrivedtime",
    "acc",
    "moving",
    "positioned",
    "rxlevel",
    "gpsvalidnum",
];
const EXCLUDED_NETWORK_ACTIONS = new Set(["reportmileagedetail", "poibatch"]);
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function pickString(record, keys) {
    for (const key of keys) {
        for (const candidate of [record[key], record[key.toLowerCase()]]) {
            if (candidate != null && typeof candidate !== "object") {
                const s = String(candidate).trim();
                if (s)
                    return s;
            }
        }
    }
    return null;
}
function pickNumber(record, keys) {
    for (const key of keys) {
        for (const candidate of [record[key], record[key.toLowerCase()]]) {
            if (candidate == null || candidate === "")
                continue;
            const n = typeof candidate === "number" ? candidate : Number(candidate);
            if (Number.isFinite(n))
                return n;
        }
    }
    return null;
}
export function resolveCoordinatesFromRecord(record) {
    const lat = pickNumber(record, ["callat", "calLat", "lat", "latitude", "maplat", "mapLat"]) ?? null;
    const lng = pickNumber(record, ["callon", "calLon", "lng", "lon", "longitude", "maplon", "mapLon"]) ??
        null;
    return parseCoordinatePair(lat, lng);
}
export function resolveTimestampsFromRecord(record) {
    const updatedMs = parseEpochMilliseconds(record.updatetime ?? record.updateTime) ??
        parseEpochMilliseconds(record.arrivedtime ?? record.arrivedTime);
    const locatedMs = parseEpochMilliseconds(record.validpoistiontime ?? record.validPoistionTime) ?? updatedMs;
    return {
        gpsTimestamp: locatedMs != null ? new Date(locatedMs).toISOString() : null,
        updateTimestamp: updatedMs != null ? new Date(updatedMs).toISOString() : null,
    };
}
export function validatePositionCandidate(candidate, selectedDeviceId) {
    const reasons = [];
    if (candidate.deviceId !== selectedDeviceId) {
        reasons.push("device_id_mismatch");
    }
    if (candidate.latitude < -90 || candidate.latitude > 90) {
        reasons.push("latitude_out_of_range");
    }
    if (candidate.longitude < -180 || candidate.longitude > 180) {
        reasons.push("longitude_out_of_range");
    }
    if (candidate.latitude === 0 && candidate.longitude === 0) {
        reasons.push("zero_coordinates");
    }
    if (candidate.updateTimestamp != null && !Number.isFinite(Date.parse(candidate.updateTimestamp))) {
        reasons.push("invalid_update_timestamp");
    }
    if (candidate.gpsTimestamp != null && !Number.isFinite(Date.parse(candidate.gpsTimestamp))) {
        reasons.push("invalid_gps_timestamp");
    }
    return reasons.length === 0 ? { ok: true } : { ok: false, reasons };
}
export function candidateFromRecord(source, fieldPath, record, componentPath = null) {
    const deviceId = pickString(record, ["deviceid", "deviceId", "device_id"]);
    if (!deviceId)
        return null;
    const coords = resolveCoordinatesFromRecord(record);
    if (!coords)
        return null;
    const timestamps = resolveTimestampsFromRecord(record);
    return {
        source,
        fieldPath,
        deviceId,
        latitude: coords.latitude,
        longitude: coords.longitude,
        speed: pickNumber(record, ["speed", "speed_kmh"]),
        gpsTimestamp: timestamps.gpsTimestamp,
        updateTimestamp: timestamps.updateTimestamp,
        sourcePositionId: pickNumber(record, ["positionlastid", "positionLastId"]),
        componentPath,
        raw: record,
    };
}
export function recommendPositionSource(candidates, selectedDeviceId) {
    const validationReasons = [];
    for (const source of POSITION_SOURCE_PRIORITY) {
        const matches = candidates.filter((candidate) => candidate.source === source);
        if (matches.length === 0)
            continue;
        const ranked = [...matches].sort((a, b) => scorePositionCandidate(b) - scorePositionCandidate(a));
        for (const match of ranked) {
            const validation = validatePositionCandidate(match, selectedDeviceId);
            if (validation.ok) {
                return {
                    positionSource: source,
                    positionFieldPath: match.fieldPath,
                    candidate: match,
                    validated: true,
                    validationReasons: [],
                };
            }
            validationReasons.push(`${source}:${validation.reasons.join(",")}`);
        }
    }
    return {
        positionSource: null,
        positionFieldPath: null,
        candidate: null,
        validated: false,
        validationReasons: validationReasons.length > 0 ? validationReasons : ["no_valid_position_candidate"],
    };
}
function scorePositionCandidate(candidate) {
    let score = 0;
    if (candidate.fieldPath.includes("cacheMgr.lastPositions"))
        score += 100;
    if (candidate.updateTimestamp)
        score += 20;
    if (candidate.gpsTimestamp)
        score += 10;
    if (candidate.speed != null)
        score += 5;
    if (candidate.sourcePositionId != null)
        score += 5;
    if (candidate.fieldPath.includes("mapIconMarkers"))
        score -= 30;
    return score;
}
export function parsedPositionFromCandidate(candidate) {
    const parsed = parsePositionLast({
        ...candidate.raw,
        deviceid: candidate.deviceId,
        callat: candidate.latitude,
        callon: candidate.longitude,
        updatetime: candidate.updateTimestamp ?? candidate.gpsTimestamp ?? Date.now(),
        validpoistiontime: candidate.gpsTimestamp ?? candidate.updateTimestamp,
        positionlastid: candidate.sourcePositionId,
        speed: candidate.speed,
    });
    return parsed.ok ? parsed.position : null;
}
export function collectPositionFieldMatches(fieldCounts) {
    const out = {};
    for (const field of POSITION_FIELD_PATTERNS) {
        const matches = [];
        const pattern = new RegExp(`(^|\\.)${field}$`, "i");
        for (const [path, count] of Object.entries(fieldCounts)) {
            if (pattern.test(path))
                matches.push({ path, count });
        }
        out[field] = matches.sort((a, b) => b.count - a.count);
    }
    return out;
}
function walkJsonForDevicePosition(value, selectedDeviceId, path, out, depth = 0) {
    if (depth > 8 || value == null)
        return;
    if (Array.isArray(value)) {
        for (let i = 0; i < Math.min(value.length, 200); i++) {
            walkJsonForDevicePosition(value[i], selectedDeviceId, `${path}[${i}]`, out, depth + 1);
        }
        return;
    }
    if (!isRecord(value))
        return;
    const deviceId = pickString(value, ["deviceid", "deviceId", "device_id"]);
    if (deviceId === selectedDeviceId) {
        const candidate = candidateFromRecord("xhr_fetch", path, value);
        if (candidate)
            out.push(candidate);
    }
    for (const [key, child] of Object.entries(value).slice(0, 80)) {
        if (key.startsWith("_") || key.startsWith("$"))
            continue;
        walkJsonForDevicePosition(child, selectedDeviceId, path ? `${path}.${key}` : key, out, depth + 1);
    }
}
export function extractNetworkPositionCandidates(payloads, selectedDeviceId) {
    const candidates = [];
    for (const payload of payloads) {
        const action = payload.action?.toLowerCase() ?? "";
        if (EXCLUDED_NETWORK_ACTIONS.has(action))
            continue;
        walkJsonForDevicePosition(payload.body, selectedDeviceId, action || "response", candidates);
    }
    return candidates;
}
export function normalizePositionSourceInspection(raw) {
    const record = isRecord(raw) ? raw : {};
    const candidatesRaw = Array.isArray(record.candidates) ? record.candidates : [];
    const candidates = [];
    for (const item of candidatesRaw) {
        if (!isRecord(item))
            continue;
        const source = item.source;
        if (source !== "device_list_tree_nodes" &&
            source !== "map_component_state" &&
            source !== "xhr_fetch" &&
            source !== "websocket_positionLast") {
            continue;
        }
        const latitude = typeof item.latitude === "number" ? item.latitude : Number(item.latitude);
        const longitude = typeof item.longitude === "number" ? item.longitude : Number(item.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude))
            continue;
        const deviceId = typeof item.deviceId === "string" ? item.deviceId : null;
        const fieldPath = typeof item.fieldPath === "string" ? item.fieldPath : null;
        if (!deviceId || !fieldPath)
            continue;
        candidates.push({
            source,
            fieldPath,
            deviceId,
            latitude,
            longitude,
            speed: typeof item.speed === "number" ? item.speed : null,
            gpsTimestamp: typeof item.gpsTimestamp === "string" ? item.gpsTimestamp : null,
            updateTimestamp: typeof item.updateTimestamp === "string" ? item.updateTimestamp : null,
            sourcePositionId: typeof item.sourcePositionId === "number" ? item.sourcePositionId : null,
            componentPath: typeof item.componentPath === "string" ? item.componentPath : null,
            raw: isRecord(item.raw) ? item.raw : {},
        });
    }
    return {
        selectedDeviceId: typeof record.selectedDeviceId === "string" ? record.selectedDeviceId : null,
        treeNodeBefore: isRecord(record.treeNodeBefore) ? record.treeNodeBefore : null,
        treeNodeAfter: isRecord(record.treeNodeAfter) ? record.treeNodeAfter : null,
        candidates,
        mapComponentPaths: Array.isArray(record.mapComponentPaths)
            ? record.mapComponentPaths.filter((item) => typeof item === "string")
            : [],
        cacheMgrFound: record.cacheMgrFound === true,
        error: typeof record.error === "string" ? record.error : null,
    };
}
export function buildPositionSourceInspectScript(selectedDeviceId) {
    const serializedDeviceId = JSON.stringify(selectedDeviceId);
    return `(async () => {
    try {
      var selectedDeviceId = ${serializedDeviceId};
      var POSITION_KEYS = ${JSON.stringify([...POSITION_FIELD_PATTERNS])};

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

      function pickNumber(record, keys) {
        for (var i = 0; i < keys.length; i++) {
          var key = keys[i];
          var candidate = record[key];
          if (candidate == null || candidate === "") continue;
          var n = typeof candidate === "number" ? candidate : Number(candidate);
          if (isFinite(n)) return n;
        }
        return null;
      }

      function parseCoords(record) {
        var lat = pickNumber(record, ["callat", "calLat", "lat", "latitude", "maplat", "mapLat"]);
        var lng = pickNumber(record, ["callon", "calLon", "lng", "lon", "longitude", "maplon", "mapLon"]);
        if (lat == null || lng == null) return null;
        if (Math.abs(lat) > 90) lat = lat / 1000000;
        if (Math.abs(lng) > 180) lng = lng / 1000000;
        if (lat === 0 && lng === 0) return null;
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
        return { latitude: lat, longitude: lng };
      }

      function parseTimestamp(value) {
        if (value == null || value === "") return null;
        if (typeof value === "string" && /[-T:]/.test(value)) {
          var parsed = Date.parse(value);
          return isFinite(parsed) ? new Date(parsed).toISOString() : null;
        }
        var n = typeof value === "number" ? value : Number(value);
        if (!isFinite(n) || n <= 0) return null;
        var ms = n > 1000000000000 ? n : n * 1000;
        return new Date(ms).toISOString();
      }

      function buildCandidate(source, fieldPath, record, componentPath) {
        var deviceId = record.deviceid != null ? String(record.deviceid) :
          (record.deviceId != null ? String(record.deviceId) : null);
        if (!deviceId) return null;
        var coords = parseCoords(record);
        if (!coords) return null;
        return {
          source: source,
          fieldPath: fieldPath,
          deviceId: deviceId,
          latitude: coords.latitude,
          longitude: coords.longitude,
          speed: pickNumber(record, ["speed", "speed_kmh"]),
          gpsTimestamp: parseTimestamp(record.validpoistiontime || record.validPoistionTime || record.arrivedtime || record.arrivedTime),
          updateTimestamp: parseTimestamp(record.updatetime || record.updateTime),
          sourcePositionId: pickNumber(record, ["positionlastid", "positionLastId"]),
          componentPath: componentPath || null,
          raw: record
        };
      }

      function findTreeNode(nodes, deviceId) {
        if (!Array.isArray(nodes)) return null;
        for (var i = 0; i < nodes.length; i++) {
          var node = nodes[i];
          if (!node) continue;
          if (nodeDeviceId(node) === deviceId) return node;
          var child = findTreeNode(node.children, deviceId);
          if (child) return child;
        }
        return null;
      }

      function collectLeaves(value, prefix, out, depth) {
        if (depth > 4 || value == null) return;
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
          out[prefix] = value;
          return;
        }
        if (Array.isArray(value)) return;
        if (typeof value !== "object") return;
        var keys = Object.keys(value).slice(0, 60);
        for (var i = 0; i < keys.length; i++) {
          var key = keys[i];
          if (isInternalKey(key) || key === "children") continue;
          collectLeaves(value[key], prefix ? prefix + "." + key : key, out, depth + 1);
        }
      }

      function resolveCacheMgr(app) {
        if (typeof window !== "undefined" && window.cacheMgr &&
            window.cacheMgr.deviceInfos && window.cacheMgr.lastPositions) {
          return window.cacheMgr;
        }
        var roots = [];
        if (app && app.__vue__) roots.push(app.__vue__);
        if (app && app.__vue_app__) roots.push(app.__vue_app__);
        if (app && app.__vue__ && app.__vue__.$store) roots.push(app.__vue__.$store);
        for (var r = 0; r < roots.length; r++) {
          var found = findCacheMgr(roots[r]);
          if (found) return found;
        }
        return null;
      }

      function findCacheMgr(root) {
        var seen = new WeakSet();
        function search(obj, depth) {
          if (!obj || typeof obj !== "object" || depth > 10) return null;
          if (seen.has(obj)) return null;
          seen.add(obj);
          if (obj.deviceInfos && obj.lastPositions &&
              typeof obj.deviceInfos === "object" &&
              typeof obj.lastPositions === "object") {
            return obj;
          }
          var keys = Object.keys(obj).slice(0, 80);
          for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            if (isInternalKey(key)) continue;
            var child = obj[key];
            if (!child || typeof child !== "object") continue;
            var found = search(child, depth + 1);
            if (found) return found;
          }
          return null;
        }
        return search(root, 0);
      }

      function hasConnectivityMethods(vm) {
        if (!vm || !vm.$options || !vm.$options.methods) return false;
        var methods = vm.$options.methods;
        return typeof methods.setCurrentZtree === "function" &&
          typeof methods.tablesClickRowDevice === "function";
      }

      function isMapComponent(name, vm) {
        if (!name) name = "";
        var lower = name.toLowerCase();
        if (lower.indexOf("map") >= 0) return true;
        if (vm && (vm.mapIconMarkers || vm.markers || vm.mapPoint || vm.currentPosition)) return true;
        return false;
      }

      function wait(ms) { return new Promise(function(resolve) { setTimeout(resolve, ms); }); }

      var app = document.querySelector("#app");
      if (!app) {
        return { selectedDeviceId: selectedDeviceId, treeNodeBefore: null, treeNodeAfter: null,
          candidates: [], mapComponentPaths: [], cacheMgrFound: false, error: "no_app_element" };
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

      var deviceList = null;
      for (var c = 0; c < components.length; c++) {
        if (hasConnectivityMethods(components[c].vm)) {
          if (!deviceList || components[c].name === "DeviceList") deviceList = components[c];
        }
      }

      var treeNodeBefore = null;
      if (deviceList && deviceList.vm) {
        var treeNodes = deviceList.vm.cacheAllTreeNodes || deviceList.vm.currentStateTreeNodes || deviceList.vm.treeData;
        treeNodeBefore = findTreeNode(treeNodes, selectedDeviceId);
      }

      var cacheMgr = resolveCacheMgr(app);

      var candidates = [];
      var mapComponentPaths = [];

      if (treeNodeBefore) {
        var treeCandidate = buildCandidate("device_list_tree_nodes", "treeNode", treeNodeBefore, deviceList ? deviceList.path : null);
        if (treeCandidate && treeCandidate.deviceId === selectedDeviceId) candidates.push(treeCandidate);
      }

      if (cacheMgr && cacheMgr.lastPositions && cacheMgr.lastPositions[selectedDeviceId]) {
        var posRecord = cacheMgr.lastPositions[selectedDeviceId];
        var cacheCandidate = buildCandidate(
          "map_component_state",
          "cacheMgr.lastPositions[" + selectedDeviceId + "]",
          posRecord,
          deviceList ? deviceList.path : "cacheMgr"
        );
        if (cacheCandidate) candidates.push(cacheCandidate);
      }

      for (var m = 0; m < components.length; m++) {
        var comp = components[m];
        if (!isMapComponent(comp.name, comp.vm)) continue;
        mapComponentPaths.push(comp.path);
        var vm = comp.vm;
        if (!vm) continue;

        if (vm.mapIconMarkers && vm.mapIconMarkers[selectedDeviceId]) {
          var marker = vm.mapIconMarkers[selectedDeviceId];
          var coords = null;
          if (marker && typeof marker.getCoordinates === "function") {
            var point = marker.getCoordinates();
            if (point && point.x != null && point.y != null) {
              coords = { latitude: point.y, longitude: point.x };
            }
          }
          if (coords) {
            candidates.push({
              source: "map_component_state",
              fieldPath: "mapIconMarkers[" + selectedDeviceId + "].coordinates",
              deviceId: selectedDeviceId,
              latitude: coords.latitude,
              longitude: coords.longitude,
              speed: null,
              gpsTimestamp: null,
              updateTimestamp: null,
              sourcePositionId: null,
              componentPath: comp.path,
              raw: { x: coords.longitude, y: coords.latitude }
            });
          }
        }

        var stateKeys = ["marker", "markers", "mapPoint", "position", "currentPosition", "selectedDevice", "devicePosition"];
        for (var sk = 0; sk < stateKeys.length; sk++) {
          var stateKey = stateKeys[sk];
          var stateValue = vm[stateKey];
          if (!stateValue) continue;
          if (Array.isArray(stateValue)) {
            for (var si = 0; si < stateValue.length; si++) {
              var item = stateValue[si];
              if (!item || typeof item !== "object") continue;
              var itemId = item.deviceid != null ? String(item.deviceid) : (item.deviceId != null ? String(item.deviceId) : null);
              if (itemId !== selectedDeviceId) continue;
              var itemCandidate = buildCandidate("map_component_state", stateKey + "[" + si + "]", item, comp.path);
              if (itemCandidate) candidates.push(itemCandidate);
            }
          } else if (typeof stateValue === "object") {
            var objectId = stateValue.deviceid != null ? String(stateValue.deviceid) :
              (stateValue.deviceId != null ? String(stateValue.deviceId) : null);
            if (objectId === selectedDeviceId) {
              var objectCandidate = buildCandidate("map_component_state", stateKey, stateValue, comp.path);
              if (objectCandidate) candidates.push(objectCandidate);
            }
          }
        }
      }

      var treeNodeAfter = treeNodeBefore;
      if (deviceList && deviceList.vm) {
        var afterNodes = deviceList.vm.cacheAllTreeNodes || deviceList.vm.currentStateTreeNodes || deviceList.vm.treeData;
        treeNodeAfter = findTreeNode(afterNodes, selectedDeviceId);
        if (treeNodeAfter && !treeNodeBefore) {
          var afterCandidate = buildCandidate("device_list_tree_nodes", "treeNode.after", treeNodeAfter, deviceList.path);
          if (afterCandidate) candidates.push(afterCandidate);
        }
      }

      return {
        selectedDeviceId: selectedDeviceId,
        treeNodeBefore: treeNodeBefore,
        treeNodeAfter: treeNodeAfter,
        candidates: candidates,
        mapComponentPaths: mapComponentPaths,
        cacheMgrFound: !!cacheMgr,
        error: null
      };
    } catch (e) {
      return {
        selectedDeviceId: ${serializedDeviceId},
        treeNodeBefore: null,
        treeNodeAfter: null,
        candidates: [],
        mapComponentPaths: [],
        cacheMgrFound: false,
        error: String(e && e.message ? e.message : e)
      };
    }
  })()`;
}
export function buildPositionExtractAllScript(inventorySample) {
    const serializedInventory = JSON.stringify(inventorySample);
    return `(async () => {
    try {
      var inventorySample = ${serializedInventory};
      var inventorySet = {};
      for (var i = 0; i < inventorySample.length; i++) inventorySet[inventorySample[i]] = true;

      function resolveCacheMgr(app) {
        if (typeof window !== "undefined" && window.cacheMgr &&
            window.cacheMgr.deviceInfos && window.cacheMgr.lastPositions) {
          return window.cacheMgr;
        }
        var roots = [];
        if (app && app.__vue__) roots.push(app.__vue__);
        if (app && app.__vue_app__) roots.push(app.__vue_app__);
        if (app && app.__vue__ && app.__vue__.$store) roots.push(app.__vue__.$store);
        for (var r = 0; r < roots.length; r++) {
          var found = findCacheMgr(roots[r]);
          if (found) return found;
        }
        return null;
      }

      function findCacheMgr(root) {
        var seen = new WeakSet();
        function search(obj, depth) {
          if (!obj || typeof obj !== "object" || depth > 10) return null;
          if (seen.has(obj)) return null;
          seen.add(obj);
          if (obj.deviceInfos && obj.lastPositions &&
              typeof obj.deviceInfos === "object" &&
              typeof obj.lastPositions === "object") {
            return obj;
          }
          var keys = Object.keys(obj).slice(0, 80);
          for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            if (!key || key.indexOf("_") === 0 || key.indexOf("$") === 0) continue;
            var child = obj[key];
            if (!child || typeof child !== "object") continue;
            var found = search(child, depth + 1);
            if (found) return found;
          }
          return null;
        }
        return search(root, 0);
      }

      function pickNumber(record, keys) {
        for (var i = 0; i < keys.length; i++) {
          var key = keys[i];
          var candidate = record[key];
          if (candidate == null || candidate === "") continue;
          var n = typeof candidate === "number" ? candidate : Number(candidate);
          if (isFinite(n)) return n;
        }
        return null;
      }

      function parseCoords(record) {
        var lat = pickNumber(record, ["callat", "calLat", "lat", "latitude", "maplat", "mapLat"]);
        var lng = pickNumber(record, ["callon", "calLon", "lng", "lon", "longitude", "maplon", "mapLon"]);
        if (lat == null || lng == null) return null;
        if (Math.abs(lat) > 90) lat = lat / 1000000;
        if (Math.abs(lng) > 180) lng = lng / 1000000;
        if (lat === 0 && lng === 0) return null;
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
        return { latitude: lat, longitude: lng };
      }

      var app = document.querySelector("#app");
      if (!app) {
        return { source: null, fieldPath: null, componentPath: null, records: [], error: "no_app_element" };
      }

      var cacheMgr = resolveCacheMgr(app);
      if (!cacheMgr || !cacheMgr.lastPositions) {
        return { source: null, fieldPath: null, componentPath: "cacheMgr", records: [], error: "cache_mgr_not_found" };
      }

      var records = [];
      var lastPositions = cacheMgr.lastPositions;
      for (var deviceId in lastPositions) {
        if (!Object.prototype.hasOwnProperty.call(lastPositions, deviceId)) continue;
        if (!inventorySet[deviceId]) continue;
        var record = lastPositions[deviceId];
        if (!record || typeof record !== "object") continue;
        var coords = parseCoords(record);
        if (!coords) continue;
        records.push({
          deviceId: deviceId,
          fieldPath: "cacheMgr.lastPositions[" + deviceId + "]",
          record: record,
          latitude: coords.latitude,
          longitude: coords.longitude
        });
      }

      return {
        source: records.length > 0 ? "map_component_state" : null,
        fieldPath: "cacheMgr.lastPositions[deviceId]",
        componentPath: "cacheMgr",
        records: records,
        error: records.length > 0 ? null : "no_valid_positions_in_cache_mgr"
      };
    } catch (e) {
      return { source: null, fieldPath: null, componentPath: null, records: [], error: String(e && e.message ? e.message : e) };
    }
  })()`;
}
export function normalizePositionInventoryExtraction(raw, inventoryIds) {
    const record = isRecord(raw) ? raw : {};
    const sourceRaw = record.source;
    const source = sourceRaw === "device_list_tree_nodes" ||
        sourceRaw === "map_component_state" ||
        sourceRaw === "xhr_fetch" ||
        sourceRaw === "websocket_positionLast"
        ? sourceRaw
        : null;
    const records = Array.isArray(record.records) ? record.records : [];
    const positions = [];
    const validDeviceIds = [];
    const invalidDeviceIds = [];
    for (const item of records) {
        if (!isRecord(item))
            continue;
        const deviceId = typeof item.deviceId === "string" ? item.deviceId : null;
        const itemRecord = isRecord(item.record) ? item.record : item;
        if (!deviceId || !inventoryIds.has(deviceId))
            continue;
        const candidate = candidateFromRecord(source ?? "map_component_state", typeof item.fieldPath === "string" ? item.fieldPath : `cacheMgr.lastPositions[${deviceId}]`, { ...itemRecord, deviceid: deviceId }, typeof record.componentPath === "string" ? record.componentPath : null);
        if (!candidate) {
            invalidDeviceIds.push(deviceId);
            continue;
        }
        const validation = validatePositionCandidate(candidate, deviceId);
        if (!validation.ok) {
            invalidDeviceIds.push(deviceId);
            continue;
        }
        const parsed = parsedPositionFromCandidate(candidate);
        if (!parsed) {
            invalidDeviceIds.push(deviceId);
            continue;
        }
        positions.push(parsed);
        validDeviceIds.push(deviceId);
    }
    const missingDeviceIds = [...inventoryIds].filter((id) => !validDeviceIds.includes(id) && !invalidDeviceIds.includes(id));
    return {
        source,
        fieldPath: typeof record.fieldPath === "string" ? record.fieldPath : null,
        componentPath: typeof record.componentPath === "string" ? record.componentPath : null,
        positions,
        validDeviceIds,
        invalidDeviceIds,
        missingDeviceIds,
        error: typeof record.error === "string" ? record.error : null,
    };
}
