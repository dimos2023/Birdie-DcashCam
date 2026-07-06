const EXCLUDED_FUNCTION_PATTERN = /alarm|urgent|message|media|permission|photograph|videolist|poi/i;
export function isExcludedStatusFilterFunction(name) {
    return EXCLUDED_FUNCTION_PATTERN.test(name);
}
export function isConnectivityBundleSnippet(snippet) {
    const lower = snippet.toLowerCase();
    if (isExcludedStatusFilterFunction(lower))
        return false;
    return ((lower.includes("selectdevicestatetype") || lower.includes("selecttype")) &&
        (lower.includes("isonline") || lower.includes("lastpositions") || lower.includes(".online")));
}
export function classifyOnlineFromLastPosition(lastPosition) {
    if (lastPosition && lastPosition.online)
        return "online";
    return "offline";
}
export function extractIdsFromCacheMgr(deviceInfos, lastPositions) {
    const allDeviceIds = [];
    const onlineDeviceIds = [];
    const offlineDeviceIds = [];
    for (const deviceId of Object.keys(deviceInfos)) {
        allDeviceIds.push(deviceId);
        if (classifyOnlineFromLastPosition(lastPositions[deviceId]) === "online") {
            onlineDeviceIds.push(deviceId);
        }
        else {
            offlineDeviceIds.push(deviceId);
        }
    }
    allDeviceIds.sort();
    onlineDeviceIds.sort();
    offlineDeviceIds.sort();
    return { allDeviceIds, onlineDeviceIds, offlineDeviceIds };
}
export function normalizeStatusFilterExtraction(raw) {
    const empty = {
        source: null,
        componentPath: null,
        mapping: null,
        predicateFunction: null,
        allDeviceIds: [],
        onlineDeviceIds: [],
        offlineDeviceIds: [],
        counts: { all: 0, online: 0, offline: 0 },
        error: "empty_probe_result",
    };
    if (!raw || typeof raw !== "object")
        return empty;
    const record = raw;
    const allDeviceIds = normalizeIdList(record.allDeviceIds);
    const onlineDeviceIds = normalizeIdList(record.onlineDeviceIds);
    const offlineDeviceIds = normalizeIdList(record.offlineDeviceIds);
    const source = record.source === "cache_mgr_last_positions" || record.source === "device_list_tree_nodes"
        ? record.source
        : null;
    return {
        source,
        componentPath: typeof record.componentPath === "string" ? record.componentPath : null,
        mapping: typeof record.mapping === "string" ? record.mapping : null,
        predicateFunction: typeof record.predicateFunction === "string" ? record.predicateFunction : null,
        allDeviceIds,
        onlineDeviceIds,
        offlineDeviceIds,
        counts: {
            all: allDeviceIds.length,
            online: onlineDeviceIds.length,
            offline: offlineDeviceIds.length,
        },
        error: typeof record.error === "string" ? record.error : null,
    };
}
function normalizeIdList(value) {
    if (!Array.isArray(value))
        return [];
    return [...new Set(value.filter((id) => typeof id === "string" && id.length > 0))].sort();
}
export function buildStatusFilterExtractScript() {
    return `(() => {
    try {
      function isInternalKey(key) {
        if (!key) return true;
        if (key.indexOf("_") === 0 || key.indexOf("$") === 0) return true;
        return false;
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
        var name = componentName(vm);
        var path = vm.__discoveryPath || "vm";
        out.push({ vm: vm, name: name, path: path });
        var children = vm.$children || [];
        for (var i = 0; i < children.length; i++) {
          children[i].__discoveryPath = path + ".$children[" + i + "]";
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
                  ref[a].__discoveryPath = path + ".$refs." + refKeys[r] + "[" + a + "]";
                  walkVue(ref[a], depth + 1, out);
                }
              }
            } else if (ref.$options) {
              ref.__discoveryPath = path + ".$refs." + refKeys[r];
              walkVue(ref, depth + 1, out);
            }
          }
        }
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

      function isDeviceNode(node) {
        if (!node || typeof node !== "object") return false;
        if (node.deviceid) return true;
        if (node.info && node.info.deviceid) return true;
        return false;
      }

      function nodeDeviceId(node) {
        if (!node) return null;
        if (node.deviceid) return String(node.deviceid);
        if (node.info && node.info.deviceid) return String(node.info.deviceid);
        return null;
      }

      function nodeIsOnline(node) {
        if (!node) return false;
        if (node.isOnline) return true;
        if (node.online) return true;
        if (node.info && node.info.online) return true;
        return false;
      }

      function extractFromCacheMgr(cacheMgr, componentPath) {
        var deviceInfos = cacheMgr.deviceInfos || {};
        var lastPositions = cacheMgr.lastPositions || {};
        var allIds = [];
        var onlineIds = [];
        var offlineIds = [];
        for (var deviceId in deviceInfos) {
          if (!Object.prototype.hasOwnProperty.call(deviceInfos, deviceId)) continue;
          allIds.push(String(deviceId));
          var pos = lastPositions[deviceId];
          if (pos && pos.online) onlineIds.push(String(deviceId));
          else offlineIds.push(String(deviceId));
        }
        allIds.sort();
        onlineIds.sort();
        offlineIds.sort();
        return {
          source: "cache_mgr_last_positions",
          componentPath: componentPath,
          mapping: "lastPositions[deviceId].online truthy => online; else offline",
          predicateFunction: "DeviceCountState.updateAllState",
          allDeviceIds: allIds,
          onlineDeviceIds: onlineIds,
          offlineDeviceIds: offlineIds,
          counts: { all: allIds.length, online: onlineIds.length, offline: offlineIds.length },
          error: allIds.length > 0 ? null : "cache_mgr_empty"
        };
      }

      function extractFromTreeNodes(nodes, componentPath) {
        if (!Array.isArray(nodes) || nodes.length === 0) return null;
        var allIds = [];
        var onlineIds = [];
        var offlineIds = [];
        var seen = {};
        function walk(list) {
          if (!Array.isArray(list)) return;
          for (var i = 0; i < list.length; i++) {
            var node = list[i];
            if (!node) continue;
            if (isDeviceNode(node)) {
              var id = nodeDeviceId(node);
              if (id && !seen[id]) {
                seen[id] = true;
                allIds.push(id);
                if (nodeIsOnline(node)) onlineIds.push(id);
                else offlineIds.push(id);
              }
            }
            if (node.children) walk(node.children);
          }
        }
        walk(nodes);
        if (allIds.length === 0) return null;
        allIds.sort();
        onlineIds.sort();
        offlineIds.sort();
        return {
          source: "device_list_tree_nodes",
          componentPath: componentPath,
          mapping: "tree node isOnline/online truthy => online; else offline",
          predicateFunction: "DeviceList.setCurrentZtree / tablesClickRowDevice",
          allDeviceIds: allIds,
          onlineDeviceIds: onlineIds,
          offlineDeviceIds: offlineIds,
          counts: { all: allIds.length, online: onlineIds.length, offline: offlineIds.length },
          error: null
        };
      }

      var app = document.querySelector("#app");
      if (!app) {
        return { source: null, componentPath: null, mapping: null, predicateFunction: null,
          allDeviceIds: [], onlineDeviceIds: [], offlineDeviceIds: [],
          counts: { all: 0, online: 0, offline: 0 }, error: "no_app_element" };
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

      var cacheMgr = findCacheMgr(app.__vue__ || {});
      if (!cacheMgr && app.__vue_app__) cacheMgr = findCacheMgr(app.__vue_app__);
      if (!cacheMgr && app.__vue__ && app.__vue__.$store) cacheMgr = findCacheMgr(app.__vue__.$store);

      var deviceList = null;
      for (var c = 0; c < components.length; c++) {
        if (components[c].name === "DeviceList") {
          deviceList = components[c];
          break;
        }
      }

      if (cacheMgr) {
        var path = deviceList ? deviceList.path : "cacheMgr";
        return extractFromCacheMgr(cacheMgr, path);
      }

      if (deviceList && deviceList.vm) {
        var vm = deviceList.vm;
        var treeNodes = vm.cacheAllTreeNodes || vm.currentStateTreeNodes || vm.treeData;
        var treeResult = extractFromTreeNodes(treeNodes, deviceList.path);
        if (treeResult) return treeResult;
      }

      return {
        source: null,
        componentPath: deviceList ? deviceList.path : null,
        mapping: null,
        predicateFunction: null,
        allDeviceIds: [],
        onlineDeviceIds: [],
        offlineDeviceIds: [],
        counts: { all: 0, online: 0, offline: 0 },
        error: "device_list_and_cache_mgr_not_found"
      };
    } catch (e) {
      return {
        source: null,
        componentPath: null,
        mapping: null,
        predicateFunction: null,
        allDeviceIds: [],
        onlineDeviceIds: [],
        offlineDeviceIds: [],
        counts: { all: 0, online: 0, offline: 0 },
        error: String(e && e.message ? e.message : e)
      };
    }
  })()`;
}
