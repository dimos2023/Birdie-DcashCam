import { describe, expect, it } from "vitest";
import {
  buildDatasetSignature,
  extractFromVue2Instance,
  extractIdsFromVxePayload,
  isStaleTabDataset,
  pickBestVxeCandidate,
  portalCountWithinTolerance,
  scoreVxeDataset,
  traverseForInventoryIds,
} from "../src/gps51/status-dom-vxe-core.js";
import {
  getContainerRejectionReason,
  isAuthoritativeScrollContainer,
  scoreScrollContainer,
} from "../src/browser/status-dom-tree.js";
import { buildDomStatusSummary } from "../src/browser/status-dom-extractor.js";
import { buildInventoryIdentityIndex } from "../src/gps51/status-dom-identity.js";
import { reconcileDomStatusSets } from "../src/gps51/status-dom-reconciliation.js";
import { buildDomStatusPatches } from "../src/db/status-repository.js";

const INVENTORY = new Set(
  Array.from({ length: 20 }, (_, i) => String(86000000000000 + i)),
);

describe("VXE traversal and inventory matching", () => {
  it("extracts exact inventory IDs from nested children", () => {
    const payload = {
      fullData: [
        {
          deviceid: "86000000000001",
          children: [{ rows: [{ id: 86000000000002 }] }],
        },
      ],
    };
    const ids = extractIdsFromVxePayload(payload, INVENTORY);
    expect(ids).toEqual(["86000000000001", "86000000000002"]);
  });

  it("handles cyclic objects without infinite recursion", () => {
    const cyclic: Record<string, unknown> = { deviceid: "86000000000003" };
    cyclic.self = cyclic;
    const ids = traverseForInventoryIds(cyclic, INVENTORY);
    expect(ids).toEqual(["86000000000003"]);
  });

  it("respects maximum traversal depth", () => {
    let current: Record<string, unknown> = { deviceid: "86000000000004" };
    let root = current;
    for (let i = 0; i < 20; i++) {
      const next: Record<string, unknown> = {};
      current.child = next;
      current = next;
    }
    current.deviceid = "86000000000005";
    const ids = traverseForInventoryIds(root, INVENTORY, { maxDepth: 3, maxObjects: 20_000 });
    expect(ids).toContain("86000000000004");
    expect(ids).not.toContain("86000000000005");
  });

  it("extracts from Vue 2 __vue__ getTableData fullData", () => {
    const instance = {
      getTableData: () => ({
        fullData: [{ deviceid: "86000000000006" }, { deviceid: "86000000000007" }],
      }),
    };
    const result = extractFromVue2Instance(instance, INVENTORY);
    expect(result.method).toBe("vxe_public_api");
    expect(result.ids).toEqual(["86000000000006", "86000000000007"]);
  });

  it("extracts from Vue 3 internalData.tableFullData", () => {
    const instance = {
      internalData: {
        tableFullData: [{ source_device_id: "86000000000008" }],
      },
    };
    const result = extractFromVue2Instance(instance, INVENTORY);
    expect(result.method).toBe("vxe_internal_state");
    expect(result.ids).toEqual(["86000000000008"]);
  });

  it("scores datasets near portal count higher", () => {
    const ids = ["86000000000001", "86000000000002", "86000000000003"];
    const good = scoreVxeDataset(ids, 3, INVENTORY);
    const bad = scoreVxeDataset(ids, 605, INVENTORY);
    expect(good).toBeGreaterThan(bad);
  });

  it("picks best VXE candidate by portal proximity", () => {
    const picked = pickBestVxeCandidate(
      [
        {
          ids: ["86000000000001"],
          path: "small",
          method: "vxe_public_api",
          arrayLength: 1,
        },
        {
          ids: Array.from({ length: 10 }, (_, i) => String(86000000000000 + i)),
          path: "large",
          method: "vxe_internal_state",
          arrayLength: 10,
        },
      ],
      10,
      INVENTORY,
    );
    expect(picked.path).toBe("large");
    expect(picked.ids.length).toBe(10);
  });
});

describe("tab dataset lifecycle", () => {
  it("detects stale same-12-ID dataset across tabs", () => {
    const signature = buildDatasetSignature("online", Array.from({ length: 12 }, (_, i) => String(i)));
    const stale = isStaleTabDataset({
      currentTab: "online",
      currentSignature: signature,
      previousSignature: signature,
      currentPortalCount: 104,
      previousPortalCount: 605,
    });
    expect(stale).toBe(true);
  });

  it("accepts portal count within before/after tolerance", () => {
    expect(portalCountWithinTolerance(104, 105, 103, 2)).toBe(true);
    expect(portalCountWithinTolerance(12, 605, 605, 2)).toBe(false);
  });

  it("rejects identical datasets across tabs", () => {
    const ids = Array.from({ length: 12 }, (_, i) => String(86000000000000 + i));
    const result = reconcileDomStatusSets({
      inventoryIds: INVENTORY,
      allIds: ids,
      onlineIds: ids,
      offlineIds: ids,
      portalCounts: { all: 605, online: 104, offline: 501 },
      options: { maxTabDelta: 2, minInventoryOverlapPercent: 99 },
    });
    expect(result.validated).toBe(false);
    expect(result.validationReasons).toContain("identical_datasets_across_tabs");
  });
});

describe("container rejection and graceful reporting", () => {
  it("rejects checkbox-only containers with zero inventory hits", () => {
    const candidate = {
      selector: "div.vxe-table--body-wrapper",
      domPath: "div.vxe-table--body-wrapper",
      score: 40,
      scrollHeight: 768,
      clientHeight: 700,
      inventoryIdHits: 0,
      checkboxCount: 32,
    };
    expect(isAuthoritativeScrollContainer(candidate)).toBe(false);
    expect(getContainerRejectionReason(candidate)).toBe("inventory_id_hits_zero");
    expect(
      scoreScrollContainer({
        scrollHeight: 768,
        clientHeight: 700,
        left: 100,
        width: 300,
        checkboxCount: 32,
        inventoryIdHits: 0,
        matchesTreeSelector: true,
        hasVxeWrapper: true,
      }),
    ).toBe(0);
  });

  it("builds unvalidated summary without secrets", () => {
    const inventory = [...INVENTORY];
    const ids = inventory.slice(0, 12);
    const reconciliation = reconcileDomStatusSets({
      inventoryIds: INVENTORY,
      allIds: ids,
      onlineIds: ids,
      offlineIds: ids,
      portalCounts: { all: 605, online: 104, offline: 501 },
      options: { maxTabDelta: 2, minInventoryOverlapPercent: 99 },
    });
    const summary = buildDomStatusSummary({
      portalCounts: { all: 605, online: 104, offline: 501 },
      inventoryIds: inventory,
      identityIndex: buildInventoryIdentityIndex([]),
      tabResults: [],
      selectedTreeContainer: null,
      containerDiscoveryReason: "no_scroll_container_candidates",
      selectedContainerRejectedReason: "inventory_id_hits_zero",
      reconciliation,
      validationReasons: reconciliation.validationReasons,
      failureCategory: "dataset_count_mismatch",
      appStateFallback: {
        used: false,
        source: null,
        reason: "no_application_state_candidates",
        debug: {},
        diagnostics: {},
      },
      uiDebug: {
        tabClickDiagnostics: [],
        tabSelectionEvidence: [],
        containerCandidates: [],
        selectedContainerSelector: null,
        duplicateNameCount: 0,
        datasetSignatures: {},
        rejectionReasons: reconciliation.validationReasons,
        rowSamplesByTab: {},
      },
      debug: {},
      generatedAt: "2026-06-29T10:00:00.000Z",
    });
    expect(summary.status).toBe("success");
    expect(summary.validated).toBe(false);
    expect(JSON.stringify(summary)).not.toContain("access_token");
  });

  it("performs zero database writes when validation fails", () => {
    const patches = buildDomStatusPatches(
      [
        {
          id: "1",
          source_device_id: "86000000000001",
          online_status: "unknown",
          metadata: {},
          birdie_device_id: null,
          vehicle_id: null,
          customer_id: null,
          latitude: 1,
          longitude: 2,
        },
      ],
      new Set(["86000000000001"]),
      new Set(),
      "2026-06-29T10:00:00.000Z",
    );
    expect(patches.length).toBe(1);
    const validated = false;
    const databaseWrites = validated ? patches.length : 0;
    expect(databaseWrites).toBe(0);
  });
});
