import { validateStatusModelDiscovery } from "./status-model-reconciliation.js";
export function classifyTreeNodeConnectivity(node) {
    if (!node || typeof node !== "object")
        return "malformed";
    const isOnline = readNodeField(node, "isOnline");
    if (isOnline !== undefined) {
        if (isTruthyOnline(isOnline))
            return "online";
        if (isFalsyOffline(isOnline))
            return "offline";
        return "malformed";
    }
    const online = readNodeField(node, "online");
    if (online !== undefined) {
        if (isTruthyOnline(online))
            return "online";
        if (isFalsyOffline(online))
            return "offline";
        return "malformed";
    }
    return "malformed";
}
function readNodeField(node, key) {
    if (Object.prototype.hasOwnProperty.call(node, key))
        return node[key];
    if (node.info && Object.prototype.hasOwnProperty.call(node.info, key))
        return node.info[key];
    return undefined;
}
export function isTruthyOnline(value) {
    return value === true || value === 1 || value === "1";
}
export function isFalsyOffline(value) {
    return value === false || value === 0 || value === "0";
}
export function nodeDeviceId(node) {
    if (node.deviceid != null)
        return String(node.deviceid);
    if (node.info?.deviceid != null)
        return String(node.info.deviceid);
    return null;
}
export function isDeviceTreeNode(node) {
    return nodeDeviceId(node) != null;
}
export function walkTreeNodes(nodes) {
    const found = [];
    const seen = new Set();
    function walk(list) {
        if (!Array.isArray(list))
            return;
        for (const node of list) {
            if (!node)
                continue;
            if (isDeviceTreeNode(node)) {
                const deviceId = nodeDeviceId(node);
                if (deviceId && !seen.has(deviceId)) {
                    seen.add(deviceId);
                    found.push({ deviceId, connectivity: classifyTreeNodeConnectivity(node) });
                }
            }
            if (node.children)
                walk(node.children);
        }
    }
    walk(nodes);
    return found;
}
export function extractIdsFromTreeNodes(nodes) {
    const walked = walkTreeNodes(nodes);
    const allDeviceIds = [];
    const onlineDeviceIds = [];
    const offlineDeviceIds = [];
    let malformedNodeCount = 0;
    for (const entry of walked) {
        if (entry.connectivity === "malformed") {
            malformedNodeCount += 1;
            continue;
        }
        allDeviceIds.push(entry.deviceId);
        if (entry.connectivity === "online")
            onlineDeviceIds.push(entry.deviceId);
        else
            offlineDeviceIds.push(entry.deviceId);
    }
    allDeviceIds.sort();
    onlineDeviceIds.sort();
    offlineDeviceIds.sort();
    return {
        allDeviceIds,
        onlineDeviceIds,
        offlineDeviceIds,
        malformedNodeCount,
        skippedNodeCount: malformedNodeCount,
    };
}
export function scoreDeviceListCandidate(candidate, inventoryIds) {
    const overlap = candidate.deviceIds.filter((id) => inventoryIds.has(id));
    const inventoryOverlapPercentage = inventoryIds.size === 0 ? 0 : Math.round((overlap.length / inventoryIds.size) * 100);
    return {
        ...candidate,
        inventoryOverlapCount: overlap.length,
        inventoryOverlapPercentage,
    };
}
export function pickBestDeviceListCandidate(candidates, minOverlapPercent = 99) {
    const ranked = candidates
        .filter((candidate) => candidate.hasSetCurrentZtree &&
        candidate.hasTablesClickRowDevice &&
        candidate.inventoryOverlapPercentage >= minOverlapPercent)
        .sort((a, b) => {
        if (b.inventoryOverlapCount !== a.inventoryOverlapCount) {
            return b.inventoryOverlapCount - a.inventoryOverlapCount;
        }
        return b.deviceIds.length - a.deviceIds.length;
    });
    return ranked[0] ?? null;
}
export function filterExtractionToInventory(extraction, inventoryIds) {
    const allDeviceIds = extraction.allDeviceIds.filter((id) => inventoryIds.has(id));
    const onlineDeviceIds = extraction.onlineDeviceIds.filter((id) => inventoryIds.has(id));
    const offlineDeviceIds = extraction.offlineDeviceIds.filter((id) => inventoryIds.has(id));
    return {
        allDeviceIds,
        onlineDeviceIds,
        offlineDeviceIds,
        counts: {
            all: allDeviceIds.length,
            online: onlineDeviceIds.length,
            offline: offlineDeviceIds.length,
        },
    };
}
export function normalizeTreeStatusExtraction(raw) {
    const empty = {
        source: "device_list_tree_nodes",
        componentPath: null,
        mapping: "treeNode.isOnline/online truthy => online; falsy => offline; malformed excluded",
        predicateFunction: "DeviceList.setCurrentZtree / tablesClickRowDevice",
        allDeviceIds: [],
        onlineDeviceIds: [],
        offlineDeviceIds: [],
        malformedNodeCount: 0,
        skippedNodeCount: 0,
        counts: { all: 0, online: 0, offline: 0 },
        error: "empty_probe_result",
    };
    if (!raw || typeof raw !== "object")
        return empty;
    const record = raw;
    const allDeviceIds = normalizeIdList(record.allDeviceIds);
    const onlineDeviceIds = normalizeIdList(record.onlineDeviceIds);
    const offlineDeviceIds = normalizeIdList(record.offlineDeviceIds);
    return {
        source: "device_list_tree_nodes",
        componentPath: typeof record.componentPath === "string" ? record.componentPath : null,
        mapping: typeof record.mapping === "string"
            ? record.mapping
            : "treeNode.isOnline/online truthy => online; falsy => offline; malformed excluded",
        predicateFunction: typeof record.predicateFunction === "string"
            ? record.predicateFunction
            : "DeviceList.setCurrentZtree / tablesClickRowDevice",
        allDeviceIds,
        onlineDeviceIds,
        offlineDeviceIds,
        malformedNodeCount: typeof record.malformedNodeCount === "number" ? record.malformedNodeCount : 0,
        skippedNodeCount: typeof record.skippedNodeCount === "number" ? record.skippedNodeCount : 0,
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
export function reconcileTreeStatusExtraction(input) {
    const filtered = filterExtractionToInventory(input.extraction, input.inventoryIds);
    const validation = validateStatusModelDiscovery({
        inventoryIds: input.inventoryIds,
        allDeviceIds: filtered.allDeviceIds,
        onlineDeviceIds: filtered.onlineDeviceIds,
        offlineDeviceIds: filtered.offlineDeviceIds,
        portalCounts: input.portalCounts,
        tolerance: input.tolerance,
        minOverlapPercent: input.minOverlapPercent,
    });
    const reasons = [...validation.validationReasons];
    if (input.extraction.error)
        reasons.push(`extraction_error_${input.extraction.error}`);
    if (!input.extraction.componentPath)
        reasons.push("device_list_component_not_found");
    return {
        ...validation,
        validated: reasons.length === 0,
        validationReasons: reasons,
        portalCounts: input.portalCounts,
        componentPath: input.extraction.componentPath,
        malformedNodeCount: input.extraction.malformedNodeCount,
    };
}
export function buildStatusTreeExtractScript(inventorySample) {
    const serializedInventory = JSON.stringify(inventorySample);
    return `(async () => {
    try {
      var inventorySample = ${serializedInventory};
      var inventorySet = {};
      for (var i = 0; i < inventorySample.length; i++) inventorySet[inventorySample[i]] = true;

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

      function readNodeField(node, key) {
        if (!node || typeof node !== "object") return undefined;
        if (Object.prototype.hasOwnProperty.call(node, key)) return node[key];
        if (node.info && Object.prototype.hasOwnProperty.call(node.info, key)) return node.info[key];
        return undefined;
      }

      function isTruthyOnline(value) {
        return value === true || value === 1 || value === "1";
      }

      function isFalsyOffline(value) {
        return value === false || value === 0 || value === "0";
      }

      function classifyNodeConnectivity(node) {
        var isOnline = readNodeField(node, "isOnline");
        if (isOnline !== undefined) {
          if (isTruthyOnline(isOnline)) return "online";
          if (isFalsyOffline(isOnline)) return "offline";
          return "malformed";
        }
        var online = readNodeField(node, "online");
        if (online !== undefined) {
          if (isTruthyOnline(online)) return "online";
          if (isFalsyOffline(online)) return "offline";
          return "malformed";
        }
        return "malformed";
      }

      function nodeDeviceId(node) {
        if (!node) return null;
        if (node.deviceid != null) return String(node.deviceid);
        if (node.info && node.info.deviceid != null) return String(node.info.deviceid);
        return null;
      }

      function extractFromTreeNodes(nodes, componentPath) {
        if (!Array.isArray(nodes) || nodes.length === 0) return null;
        var allIds = [];
        var onlineIds = [];
        var offlineIds = [];
        var malformed = 0;
        var seen = {};

        function walk(list) {
          if (!Array.isArray(list)) return;
          for (var i = 0; i < list.length; i++) {
            var node = list[i];
            if (!node) continue;
            var id = nodeDeviceId(node);
            if (id && !seen[id]) {
              seen[id] = true;
              var connectivity = classifyNodeConnectivity(node);
              if (connectivity === "malformed") {
                malformed += 1;
                continue;
              }
              allIds.push(id);
              if (connectivity === "online") onlineIds.push(id);
              else offlineIds.push(id);
            }
            if (node.children) walk(node.children);
          }
        }

        walk(nodes);
        if (allIds.length === 0 && malformed === 0) return null;
        allIds.sort();
        onlineIds.sort();
        offlineIds.sort();
        return {
          source: "device_list_tree_nodes",
          componentPath: componentPath,
          mapping: "treeNode.isOnline/online truthy => online; falsy => offline; malformed excluded",
          predicateFunction: "DeviceList.setCurrentZtree / tablesClickRowDevice",
          allDeviceIds: allIds,
          onlineDeviceIds: onlineIds,
          offlineDeviceIds: offlineIds,
          malformedNodeCount: malformed,
          skippedNodeCount: malformed,
          counts: { all: allIds.length, online: onlineIds.length, offline: offlineIds.length },
          error: null
        };
      }

      function inventoryOverlapCount(ids) {
        var count = 0;
        for (var i = 0; i < ids.length; i++) {
          if (inventorySet[ids[i]]) count += 1;
        }
        return count;
      }

      var app = document.querySelector("#app");
      if (!app) {
        return {
          source: "device_list_tree_nodes",
          componentPath: null,
          mapping: "treeNode.isOnline/online truthy => online; falsy => offline; malformed excluded",
          predicateFunction: "DeviceList.setCurrentZtree / tablesClickRowDevice",
          allDeviceIds: [], onlineDeviceIds: [], offlineDeviceIds: [],
          malformedNodeCount: 0, skippedNodeCount: 0,
          counts: { all: 0, online: 0, offline: 0 },
          error: "no_app_element"
        };
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

      function wait(ms) {
        return new Promise(function(resolve) { setTimeout(resolve, ms); });
      }

      var best = null;
      var bestScore = -1;
      var bestVm = null;
      for (var c = 0; c < components.length; c++) {
        var item = components[c];
        if (!hasConnectivityMethods(item.vm)) continue;
        var treeNodes = item.vm.cacheAllTreeNodes || item.vm.currentStateTreeNodes || item.vm.treeData;
        var candidate = extractFromTreeNodes(treeNodes, item.path);
        if (!candidate) continue;
        var overlap = inventoryOverlapCount(candidate.allDeviceIds);
        var score = overlap * 1000;
        if (item.name === "DeviceList") score += 500;
        if (candidate.onlineDeviceIds.length > 0) score += 250;
        if (candidate.offlineDeviceIds.length > 0) score += 250;
        if (candidate.onlineDeviceIds.length === 0 || candidate.offlineDeviceIds.length === 0) score -= 400;
        score -= candidate.malformedNodeCount * 2;
        if (score > bestScore) {
          bestScore = score;
          best = candidate;
          bestVm = item.vm;
        }
      }

      if (best && bestVm) {
        var allNodes = bestVm.cacheAllTreeNodes || bestVm.currentStateTreeNodes || bestVm.treeData;
        var allCandidate = extractFromTreeNodes(allNodes, best.componentPath) || best;

        try {
          bestVm.setCurrentZtree("online");
          await wait(1200);
        } catch (e1) {}
        var onlineNodes = bestVm.currentStateTreeNodes || bestVm.treeData || [];
        var onlineCandidate = extractFromTreeNodes(onlineNodes, best.componentPath);

        try {
          bestVm.setCurrentZtree("offline");
          await wait(1200);
        } catch (e2) {}
        var offlineNodes = bestVm.currentStateTreeNodes || bestVm.treeData || [];
        var offlineCandidate = extractFromTreeNodes(offlineNodes, best.componentPath);

        try {
          bestVm.setCurrentZtree("all");
          await wait(300);
        } catch (e3) {}

        return {
          source: "device_list_tree_nodes",
          componentPath: best.componentPath,
          mapping: "DeviceList.setCurrentZtree filtered tree nodes; isOnline/online truthy => online; offline tab => offline",
          predicateFunction: "DeviceList.setCurrentZtree / tablesClickRowDevice",
          allDeviceIds: (allCandidate && allCandidate.allDeviceIds) || [],
          onlineDeviceIds: (onlineCandidate && onlineCandidate.allDeviceIds) || [],
          offlineDeviceIds: (offlineCandidate && offlineCandidate.allDeviceIds) || [],
          malformedNodeCount:
            ((allCandidate && allCandidate.malformedNodeCount) || 0) +
            ((onlineCandidate && onlineCandidate.malformedNodeCount) || 0) +
            ((offlineCandidate && offlineCandidate.malformedNodeCount) || 0),
          skippedNodeCount:
            ((allCandidate && allCandidate.skippedNodeCount) || 0) +
            ((onlineCandidate && onlineCandidate.skippedNodeCount) || 0) +
            ((offlineCandidate && offlineCandidate.skippedNodeCount) || 0),
          counts: {
            all: ((allCandidate && allCandidate.allDeviceIds) || []).length,
            online: ((onlineCandidate && onlineCandidate.allDeviceIds) || []).length,
            offline: ((offlineCandidate && offlineCandidate.allDeviceIds) || []).length
          },
          error: null
        };
      }

      return {
        source: "device_list_tree_nodes",
        componentPath: null,
        mapping: "treeNode.isOnline/online truthy => online; falsy => offline; malformed excluded",
        predicateFunction: "DeviceList.setCurrentZtree / tablesClickRowDevice",
        allDeviceIds: [], onlineDeviceIds: [], offlineDeviceIds: [],
        malformedNodeCount: 0, skippedNodeCount: 0,
        counts: { all: 0, online: 0, offline: 0 },
        error: "device_list_component_not_found"
      };
    } catch (e) {
      return {
        source: "device_list_tree_nodes",
        componentPath: null,
        mapping: "treeNode.isOnline/online truthy => online; falsy => offline; malformed excluded",
        predicateFunction: "DeviceList.setCurrentZtree / tablesClickRowDevice",
        allDeviceIds: [], onlineDeviceIds: [], offlineDeviceIds: [],
        malformedNodeCount: 0, skippedNodeCount: 0,
        counts: { all: 0, online: 0, offline: 0 },
        error: String(e && e.message ? e.message : e)
      };
    }
  })()`;
}
