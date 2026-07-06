import { describe, expect, it } from "vitest";
import {
  buildAppStateProbeResult,
  mergeDomDiscoveryValidationReasons,
  probeAppStateDeviceSets,
  redactAppStateValue,
} from "../src/browser/status-dom-app-state.js";
import {
  normalizeAppStatePathEntries,
  normalizeRecordArray,
  normalizeStringArray,
  normalizeUnknownArray,
} from "../src/browser/status-dom-normalize.js";
import {
  buildDomStatusSummary,
  type DomStatusExtractionResult,
} from "../src/browser/status-dom-extractor.js";
import {
  buildScrollContainerDiscoveryResult,
  buildScrollContainerDiscoveryScript,
  scoreScrollContainer,
  scoreScrollContainerCandidates,
  shouldStopTreeExpansion,
} from "../src/browser/status-dom-tree.js";
import {
  extractInventoryMatchesFromText,
  extractInventoryMatchesFromTexts,
} from "../src/gps51/status-dom-matcher.js";
import { reconcileDomStatusSets } from "../src/gps51/status-dom-reconciliation.js";
import { buildInventoryIdentityIndex } from "../src/gps51/status-dom-identity.js";
import {
  buildDomStatusMetadata,
  buildDomStatusPatches,
  preservedDeviceLinksIntact,
  preservedPositionIntact,
  type StatusDeviceRow,
} from "../src/db/status-repository.js";

function buildInventory(count: number): Set<string> {
  return new Set(Array.from({ length: count }, (_, i) => String(86000000000000 + i)));
}

function buildMinimalExtraction(
  overrides: Partial<DomStatusExtractionResult> = {},
): DomStatusExtractionResult {
  const reconciliation = reconcileDomStatusSets({
    inventoryIds: buildInventory(3),
    allIds: [],
    onlineIds: [],
    offlineIds: [],
    portalCounts: { all: 3, online: 1, offline: 2 },
    options: { maxTabDelta: 2, minInventoryOverlapPercent: 99 },
  });

  return {
    portalCounts: { all: 3, online: 1, offline: 2 },
    inventoryIds: ["86000000000000", "86000000000001", "86000000000002"],
    identityIndex: buildInventoryIdentityIndex([]),
    tabResults: [],
    selectedTreeContainer: null,
    containerDiscoveryReason: "no_scroll_container_candidates",
    selectedContainerRejectedReason: null,
    reconciliation,
    validationReasons: [
      "no_scroll_container_candidates",
      "no_application_state_candidates",
    ],
    failureCategory: "no_device_container",
    appStateFallback: {
      used: false,
      source: null,
      reason: "no_application_state_candidates",
      debug: {},
      diagnostics: {
        evaluateResultType: "undefined",
        normalizedCandidateCount: 0,
        inspectedPropertyCount: 0,
        matchedInventoryIdCount: 0,
        fallbackUsed: true,
        fallbackSucceeded: false,
      },
    },
    uiDebug: {
      tabClickDiagnostics: [],
      tabSelectionEvidence: [],
      containerCandidates: [],
      selectedContainerSelector: null,
      duplicateNameCount: 0,
      datasetSignatures: {},
      rejectionReasons: [],
      rowSamplesByTab: {},
    },
    debug: {},
    generatedAt: "2026-06-29T10:00:00.000Z",
    ...overrides,
  };
}

describe("status DOM normalize helpers", () => {
  it("normalizes undefined evaluate results to empty arrays", () => {
    expect(normalizeUnknownArray(undefined)).toEqual([]);
    expect(normalizeRecordArray(undefined)).toEqual([]);
    expect(normalizeStringArray(undefined)).toEqual([]);
  });

  it("filters null and primitive record values", () => {
    expect(normalizeRecordArray([null, "bad", { path: "window.app" }])).toEqual([
      { path: "window.app" },
    ]);
  });

  it("normalizes app-state path entries safely", () => {
    expect(normalizeAppStatePathEntries(undefined)).toEqual([]);
    expect(
      normalizeAppStatePathEntries([
        null,
        { path: "window.store", type: "array", length: 3 },
        { path: "window", type: "object", length: 0 },
        "bad",
      ]),
    ).toEqual([{ path: "window.store", type: "array", length: 3 }]);
  });
});

describe("scroll container discovery normalization", () => {
  const validCandidate = {
    selector: "div.tree",
    domPath: "div.tree",
    scrollHeight: 4000,
    clientHeight: 500,
    left: 120,
    width: 320,
    checkboxCount: 10,
    inventoryIdHits: 8,
    matchesTreeSelector: true,
  };

  it("handles undefined rawCandidates", () => {
    const result = buildScrollContainerDiscoveryResult(undefined);
    expect(result.diagnostics.rawCandidateType).toBe("undefined");
    expect(result.reason).toBe("no_scroll_container_candidates");
  });

  it("handles null and object rawCandidates", () => {
    expect(buildScrollContainerDiscoveryResult(null).candidates).toEqual([]);
    expect(buildScrollContainerDiscoveryResult({ foo: "bar" }).candidates).toEqual([]);
  });

  it("filters mixed invalid candidate entries", () => {
    const result = buildScrollContainerDiscoveryResult([null, "bad", 42, validCandidate]);
    expect(result.diagnostics.validCandidateCount).toBe(1);
    expect(result.selectedContainer?.selector).toBe("div.tree");
  });

  it("embeds inventory and selectors in evaluate script without external args", () => {
    const script = buildScrollContainerDiscoveryScript(["86000000000001"], [".ivu-tree"]);
    expect(script).toContain('"86000000000001"');
    expect(script).toContain('".ivu-tree"');
    expect(script).not.toContain("treeSelectorUnion");
    expect(script).toContain("return []");
  });
});

describe("application-state probe", () => {
  it("does not slice undefined path snapshots", () => {
    const result = buildAppStateProbeResult({ rawPaths: undefined, pathMatches: [] });
    expect(result.candidates).toEqual([]);
    expect(result.reason).toBe("no_application_state_candidates");
    expect(result.diagnostics.evaluateResultType).toBe("undefined");
  });

  it("handles null and object evaluate results", () => {
    expect(buildAppStateProbeResult({ rawPaths: null, pathMatches: [] }).candidates).toEqual([]);
    expect(buildAppStateProbeResult({ rawPaths: { candidates: "bad" }, pathMatches: [] }).candidates).toEqual(
      [],
    );
  });

  it("handles candidates property that is a string", () => {
    const result = buildAppStateProbeResult({
      rawPaths: "not-an-array",
      pathMatches: [],
    });
    expect(result.candidates.length).toBe(0);
    expect(result.matchedDeviceIds).toEqual([]);
  });

  it("merges container and app-state validation reasons", () => {
    const reasons = mergeDomDiscoveryValidationReasons({
      reconciliationReasons: ["all_count_delta_5"],
      containerReason: "no_scroll_container_candidates",
      appStateReason: "no_application_state_candidates",
    });
    expect(reasons).toEqual([
      "all_count_delta_5",
      "no_scroll_container_candidates",
      "no_application_state_candidates",
    ]);
  });

  it("does not throw when page evaluate returns undefined", async () => {
    const page = {
      evaluate: async () => undefined,
    };
    const result = await probeAppStateDeviceSets(page as never, new Set(["86000000000001"]));
    expect(result.reason).toBe("no_application_state_candidates");
    expect(result.matchedDeviceIds).toEqual([]);
    expect(result.diagnostics.fallbackSucceeded).toBe(false);
  });

  it("redacts secrets from diagnostics samples", () => {
    expect(redactAppStateValue("access_token", "secret-value")).toBe("[REDACTED]");
    expect(redactAppStateValue("devices", [{ id: "1" }])).toEqual([{ id: "1" }]);
  });
});

describe("status DOM summary reporting", () => {
  it("generates completed unvalidated report without throwing", () => {
    const summary = buildDomStatusSummary(buildMinimalExtraction());
    expect(summary.status).toBe("success");
    expect(summary.validated).toBe(false);
    expect(summary.validationReasons).toEqual([
      "no_scroll_container_candidates",
      "no_application_state_candidates",
    ]);
    expect(JSON.stringify(summary)).not.toContain("access_token");
    expect(JSON.stringify(summary)).not.toContain("cookie");
  });
});

describe("status DOM matcher", () => {
  it("matches only known inventory IDs from mixed text", () => {
    const inventory = new Set(["86000000000001", "86000000000002", "99999999999999"]);
    const text = "Device 86000000000001 online, plate ABC, ref 12345678901234";
    expect(extractInventoryMatchesFromText(text, inventory)).toEqual(["86000000000001"]);
  });

  it("deduplicates IDs across collected texts", () => {
    const inventory = new Set(["86000000000001", "86000000000002"]);
    const ids = extractInventoryMatchesFromTexts(
      ["86000000000001", "86000000000001", "86000000000002"],
      inventory,
    );
    expect(ids).toEqual(["86000000000001", "86000000000002"]);
  });
});

describe("status DOM reconciliation", () => {
  it("rejects online/offline intersection", () => {
    const inventory = buildInventory(10);
    const allIds = [...inventory];
    const onlineIds = allIds.slice(0, 5);
    const offlineIds = [...allIds.slice(5), onlineIds[0]];

    const result = reconcileDomStatusSets({
      inventoryIds: inventory,
      allIds,
      onlineIds,
      offlineIds,
      portalCounts: { all: 10, online: 5, offline: 5 },
      options: { maxTabDelta: 2, minInventoryOverlapPercent: 99 },
    });

    expect(result.validated).toBe(false);
    expect(result.validationReasons.some((r) => r.startsWith("online_offline_intersection"))).toBe(
      true,
    );
  });

  it("validates dynamic portal counts within tolerance", () => {
    const inventory = buildInventory(605);
    const allIds = [...inventory];
    const onlineIds = allIds.slice(0, 105);
    const offlineIds = allIds.slice(105);

    const result = reconcileDomStatusSets({
      inventoryIds: inventory,
      allIds,
      onlineIds,
      offlineIds,
      portalCounts: { all: 605, online: 105, offline: 500 },
      options: { maxTabDelta: 2, minInventoryOverlapPercent: 99 },
    });

    expect(result.validated).toBe(true);
    expect(result.onlineOfflineIntersection).toEqual([]);
    expect(result.unionCount).toBe(605);
    expect(result.inventoryOverlapPercentage).toBe(100);
  });
});

describe("status DOM repository patches", () => {
  const baseRow = (overrides: Partial<StatusDeviceRow> = {}): StatusDeviceRow => ({
    id: "row-1",
    source_device_id: "86000000000001",
    online_status: "unknown",
    metadata: { existing: true },
    birdie_device_id: "birdie-1",
    vehicle_id: "vehicle-1",
    customer_id: "customer-1",
    latitude: 25.1,
    longitude: 55.2,
    ...overrides,
  });

  it("builds patches only for changed rows", () => {
    const rows = [
      baseRow(),
      baseRow({ id: "row-2", source_device_id: "86000000000002", online_status: "offline" }),
    ];
    const patches = buildDomStatusPatches(
      rows,
      new Set(["86000000000001"]),
      new Set(["86000000000002"]),
      "2026-06-29T10:00:00.000Z",
    );
    expect(patches).toHaveLength(1);
    expect(patches[0]?.online_status).toBe("online");
  });

  it("preserves coordinates and Birdie links in patch helpers", () => {
    const before = baseRow();
    const after = { ...before, online_status: "online" };
    expect(preservedDeviceLinksIntact(before, after)).toBe(true);
    expect(preservedPositionIntact(before, after)).toBe(true);
  });

  it("stores monitor tree metadata fields", () => {
    const metadata = buildDomStatusMetadata("2026-06-29T10:00:00.000Z", "offline");
    expect(metadata.online_status_source).toBe("gps51_monitor_filtered_tree");
  });
});

describe("status DOM tree helpers", () => {
  it("stops nested expansion after three stale passes", () => {
    expect(shouldStopTreeExpansion(3)).toBe(true);
  });

  it("scores scroll containers with inventory hits and left-side bias", () => {
    const high = scoreScrollContainer({
      scrollHeight: 4000,
      clientHeight: 500,
      left: 120,
      width: 320,
      checkboxCount: 20,
      inventoryIdHits: 12,
      inventoryNameHits: 0,
      matchesTreeSelector: true,
    });
    const low = scoreScrollContainer({
      scrollHeight: 4000,
      clientHeight: 500,
      left: 900,
      width: 320,
      checkboxCount: 0,
      inventoryIdHits: 0,
      inventoryNameHits: 0,
      matchesTreeSelector: false,
    });
    expect(high).toBeGreaterThan(low);
  });

  it("scores containers using name matches when ID hits are absent", () => {
    const withNames = scoreScrollContainer({
      scrollHeight: 4000,
      clientHeight: 500,
      left: 120,
      width: 320,
      checkboxCount: 10,
      inventoryIdHits: 0,
      inventoryNameHits: 15,
      matchesTreeSelector: true,
      hasVxeWrapper: true,
    });
    expect(withNames).toBeGreaterThan(0);
  });

  it("scores only valid object candidates", () => {
    const scored = scoreScrollContainerCandidates(
      normalizeRecordArray([
        {
          selector: "div.tree",
          scrollHeight: 4000,
          clientHeight: 500,
          inventoryIdHits: 5,
          matchesTreeSelector: true,
        },
      ]),
    );
    expect(scored.length).toBe(1);
  });
});
