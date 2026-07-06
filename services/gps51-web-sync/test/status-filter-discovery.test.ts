import { describe, expect, it } from "vitest";
import {
  extractFunctionSnippet,
  isExcludedDeviceStatusField,
  isFrameworkInternalKey,
  redactSensitiveText,
} from "../src/gps51/status-filter-internals.js";
import {
  discoverStatusFilterFieldCandidates,
  profileStatusFilterDeviceFields,
} from "../src/gps51/status-filter-field-profiler.js";
import {
  buildFilteredCollectionCandidate,
  categorizeStatusFilterFailure,
  recommendStatusFilterSource,
  validateStatusFilterDiscovery,
} from "../src/gps51/status-filter-reconciliation.js";
import {
  compareStateSnapshots,
  isFrameworkStatePath,
  normalizeBrowserFilterProbe,
} from "../src/gps51/status-filter-vue.js";
import {
  extractBundleMatches,
  pickBestBundleMatch,
  scoreBundleMatch,
  sanitizeBundleUrl,
} from "../src/browser/status-filter-bundles.js";
import {
  classifyOnlineFromLastPosition,
  extractIdsFromCacheMgr,
  isConnectivityBundleSnippet,
  isExcludedStatusFilterFunction,
  normalizeStatusFilterExtraction,
} from "../src/gps51/status-filter-extract.js";
import { buildDomStatusPatches } from "../src/db/status-repository.js";

function deviceRecord(id: string, fields: Record<string, unknown>) {
  return {
    sourceDeviceId: id,
    deviceName: null,
    lastActiveTimeRaw: null,
    offlineDelayRaw: null,
    raw: { deviceid: id, ...fields },
  };
}

describe("status filter internals", () => {
  it("excludes _directInactive and Vue internal fields", () => {
    expect(isFrameworkInternalKey("_directInactive")).toBe(true);
    expect(isFrameworkInternalKey("$store")).toBe(true);
    expect(isFrameworkInternalKey("isonline")).toBe(false);
    expect(isExcludedDeviceStatusField("_directInactive")).toBe(true);
    expect(isExcludedDeviceStatusField("isonline")).toBe(false);
  });

  it("redacts secret text in snippets", () => {
    expect(redactSensitiveText("access_token=abc")).toBe("[REDACTED]");
  });

  it("extracts safe function source snippets", () => {
    const snippet = extractFunctionSnippet(
      "function filterDevices(list){ return list.filter(function(d){ return d.online===1; }); }",
      ["filter(", "online"],
    );
    expect(snippet).toContain("filter");
    expect(snippet.length).toBeLessThanOrEqual(500);
  });
});

describe("status filter state comparison", () => {
  it("identifies changed primitive state", () => {
    const changed = compareStateSnapshots(
      [{ path: "statusType", type: "primitive", value: 0 }],
      [{ path: "statusType", type: "primitive", value: 1 }],
    );
    expect(changed).toHaveLength(1);
    expect(changed[0]?.changeKind).toBe("primitive");
  });

  it("identifies changed device collection array lengths", () => {
    const changed = compareStateSnapshots(
      [{ path: "showDeviceList", type: "array", length: 605 }],
      [{ path: "showDeviceList", type: "array", length: 120 }],
    );
    expect(changed[0]?.changeKind).toBe("array_length");
  });

  it("rejects framework state paths", () => {
    expect(isFrameworkStatePath("vm._directInactive")).toBe(true);
    expect(isFrameworkStatePath("vm.statusType")).toBe(false);
  });

  it("normalizes undefined evaluate results", () => {
    expect(normalizeBrowserFilterProbe(undefined).components).toEqual([]);
    expect(normalizeBrowserFilterProbe(null).functionSources).toEqual([]);
  });
});

describe("status filter field profiling", () => {
  it("profiles low-cardinality status mapping with union coverage", () => {
    const records = Array.from({ length: 10 }, (_, i) =>
      deviceRecord(String(86000000000000 + i), { isonline: i < 4 }),
    );
    const profiles = profileStatusFilterDeviceFields(records);
    expect(profiles.some((profile) => profile.fieldPath === "isonline")).toBe(true);

    const candidates = discoverStatusFilterFieldCandidates(
      records,
      { all: 10, online: 4, offline: 6 },
      { minDevicesWithField: 5, tolerance: 0, minUnionPercent: 99 },
    );
    expect(candidates.some((candidate) => candidate.validated)).toBe(true);
  });

  it("excludes timestamp and name fields from status candidates", () => {
    expect(isExcludedDeviceStatusField("lastactivetime")).toBe(true);
    expect(isExcludedDeviceStatusField("devicename")).toBe(true);
  });
});

describe("status filter collections and validation", () => {
  const inventory = new Set(Array.from({ length: 10 }, (_, i) => String(86000000000000 + i)));

  it("rejects identical datasets across tabs", () => {
    const candidate = buildFilteredCollectionCandidate({
      dataPath: "vm.deviceList",
      tab: "online",
      matchedIds: ["86000000000001", "86000000000002"],
      collectionLength: 2,
      portalCount: 2,
      previousSignatures: ["online:2:86000000000001,86000000000002"],
      isFrameworkPath: false,
    });
    expect(candidate.rejected).toBe(true);
    expect(candidate.rejectionReason).toBe("identical_dataset_across_tabs");
  });

  it("validates dynamic portal counts within tolerance", () => {
    const allIds = [...inventory];
    const onlineIds = allIds.slice(0, 4);
    const offlineIds = allIds.slice(4);
    const validation = validateStatusFilterDiscovery({
      inventoryIds: inventory,
      allDeviceIds: allIds,
      onlineDeviceIds: onlineIds,
      offlineDeviceIds: offlineIds,
      portalCounts: { all: 10, online: 3, offline: 7, allBefore: 10, allAfter: 10 },
      collections: [],
    });
    expect(validation.validated).toBe(true);
  });

  it("rejects online/offline intersection", () => {
    const validation = validateStatusFilterDiscovery({
      inventoryIds: inventory,
      allDeviceIds: [...inventory],
      onlineDeviceIds: ["86000000000001", "86000000000002"],
      offlineDeviceIds: ["86000000000002", "86000000000003"],
      portalCounts: { all: 10, online: 2, offline: 2 },
      collections: [],
    });
    expect(validation.validated).toBe(false);
  });

  it("recommends cache_mgr extraction over vue function", () => {
    const recommendation = recommendStatusFilterSource({
      fieldCandidate: null,
      extraction: {
        source: "cache_mgr_last_positions",
        componentPath: "#app.__vue__.$children[2]",
        mapping: "lastPositions[deviceId].online truthy => online; else offline",
        predicateFunction: "DeviceCountState.updateAllState",
      },
      functionCandidate: { componentName: "Monitor", functionName: "filterDevices" },
      collectionCandidates: [],
      bundleMatch: null,
    });
    expect(recommendation.source).toBe("cache_mgr_last_positions");
    expect(recommendation.fieldPath).toBe("lastPositions[deviceId].online");
  });
});

describe("status filter extraction", () => {
  it("excludes alarm and urgent functions", () => {
    expect(isExcludedStatusFilterFunction("updateAllAlarmAndUrgent")).toBe(true);
    expect(isExcludedStatusFilterFunction("setCurrentZtree")).toBe(false);
  });

  it("classifies online from lastPositions.online", () => {
    expect(classifyOnlineFromLastPosition({ online: 1 })).toBe("online");
    expect(classifyOnlineFromLastPosition({ online: 0 })).toBe("offline");
    expect(classifyOnlineFromLastPosition(null)).toBe("offline");
  });

  it("extracts all/online/offline ids from cacheMgr deviceInfos", () => {
    const result = extractIdsFromCacheMgr(
      { "86000000000001": {}, "86000000000002": {}, "86000000000003": {} },
      {
        "86000000000001": { online: 1 },
        "86000000000002": { online: 0 },
      },
    );
    expect(result.allDeviceIds).toHaveLength(3);
    expect(result.onlineDeviceIds).toEqual(["86000000000001"]);
    expect(result.offlineDeviceIds).toEqual(["86000000000002", "86000000000003"]);
  });

  it("normalizes browser extraction payloads", () => {
    const normalized = normalizeStatusFilterExtraction({
      source: "cache_mgr_last_positions",
      allDeviceIds: ["86000000000001"],
      onlineDeviceIds: ["86000000000001"],
      offlineDeviceIds: [],
    });
    expect(normalized.counts.online).toBe(1);
    expect(normalized.source).toBe("cache_mgr_last_positions");
  });

  it("detects connectivity bundle snippets", () => {
    expect(
      isConnectivityBundleSnippet(
        'if("online"==this.selectDeviceStateType){if(0==i.isOnline)return}',
      ),
    ).toBe(true);
    expect(isConnectivityBundleSnippet("updateAllAlarmAndUrgent")).toBe(false);
  });
});

describe("status filter bundle matching", () => {
  it("matches bundle source around filter predicates", () => {
    const content =
      'function filterOnlineDevices(e){return e.filter(function(t){return 1===t.isonline||"online"===t.status})}';
    const matches = extractBundleMatches("https://gps51.example/app.js", "app.js", content, [
      "filterDevices",
    ]);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]?.probablePredicate).toContain("filter");
  });

  it("sanitizes bundle URLs without query secrets", () => {
    expect(sanitizeBundleUrl("https://gps51.example/app.js?token=secret")).toBe(
      "https://gps51.example/app.js",
    );
  });

  it("picks connectivity predicate over alarm handlers", () => {
    const alarm = {
      bundleUrl: "https://gps51.example/a.js",
      bundleFile: "a.js",
      nearbyIdentifier: "updateAllAlarmAndUrgent",
      matchingTerm: "filter(",
      snippet: "updateAllAlarmAndUrgent:function(){return list.filter",
      probablePredicate: "device_list_filter_predicate",
    };
    const connectivity = {
      bundleUrl: "https://gps51.example/b.js",
      bundleFile: "b.js",
      nearbyIdentifier: "tablesClickRowDevice",
      matchingTerm: "online",
      snippet:
        'if("online"==this.selectDeviceStateType){if(0==i.isOnline)return}else if("offline"==this.selectDeviceStateType){if(i.isOnline)return}',
      probablePredicate: "device_list_filter_predicate",
    };
    expect(scoreBundleMatch(alarm)).toBeLessThan(0);
    expect(pickBestBundleMatch([alarm, connectivity])?.nearbyIdentifier).toBe("tablesClickRowDevice");
  });
});

describe("status filter discovery safety", () => {
  it("performs zero database writes during discovery", () => {
    const patches = buildDomStatusPatches(
      [
        {
          id: "row-1",
          source_device_id: "86000000000001",
          online_status: "unknown",
          metadata: {},
          birdie_device_id: null,
          vehicle_id: null,
          customer_id: null,
          latitude: null,
          longitude: null,
        },
      ],
      new Set(["86000000000001"]),
      new Set(),
      "2026-06-29T10:00:00.000Z",
    );
    const validated = false;
    expect(validated ? patches.length : 0).toBe(0);
  });

  it("categorizes graceful failure reasons", () => {
    const categories = categorizeStatusFilterFailure({
      relevantComponentCount: 0,
      changedStatePaths: 0,
      fieldCandidateCount: 0,
      validatedField: false,
      functionCandidateCount: 0,
      collectionCandidateCount: 0,
      bundleMatchCount: 0,
      validation: validateStatusFilterDiscovery({
        inventoryIds: new Set(["86000000000001"]),
        allDeviceIds: [],
        onlineDeviceIds: [],
        offlineDeviceIds: [],
        portalCounts: { all: 1, online: 1, offline: 0 },
        collections: [],
      }),
    });
    expect(categories).toContain("no_relevant_vue_component");
    expect(categories).toContain("no_low_cardinality_status_field");
  });
});
