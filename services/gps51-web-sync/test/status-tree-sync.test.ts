import { describe, expect, it, vi } from "vitest";
import {
  applyTreeStatusBulkUpdates,
  buildTreeStatusPatches,
  preservedDeviceLinksIntact,
  preservedPositionIntact,
  resolveStatusPrecedence,
  type StatusDeviceRow,
} from "../src/db/status-repository.js";
import { buildWebsocketPositionMetadata } from "../src/gps51/offline-state-manager.js";
import {
  classifyTreeNodeConnectivity,
  extractIdsFromTreeNodes,
  isTruthyOnline,
  pickBestDeviceListCandidate,
  reconcileTreeStatusExtraction,
  scoreDeviceListCandidate,
  type TreeNodeRecord,
} from "../src/gps51/status-tree-extract.js";
import { validateStatusModelDiscovery } from "../src/gps51/status-model-reconciliation.js";
import {
  buildTreeSyncSummary,
  collectInventorySourceFromPayload,
} from "../src/worker/status-tree-sync.js";

function deviceRow(
  sourceDeviceId: string,
  onlineStatus = "unknown",
): StatusDeviceRow {
  return {
    id: `row-${sourceDeviceId}`,
    source_device_id: sourceDeviceId,
    online_status: onlineStatus,
    metadata: {},
    birdie_device_id: null,
    vehicle_id: null,
    customer_id: null,
    latitude: 25.1,
    longitude: 55.2,
  };
}

function treeNode(
  deviceid: string,
  status: Partial<Pick<TreeNodeRecord, "isOnline" | "online">>,
): TreeNodeRecord {
  return { deviceid, ...status };
}

describe("tree node connectivity mapping", () => {
  it("maps boolean isOnline values", () => {
    expect(classifyTreeNodeConnectivity(treeNode("1", { isOnline: true }))).toBe("online");
    expect(classifyTreeNodeConnectivity(treeNode("1", { isOnline: false }))).toBe("offline");
  });

  it("maps numeric isOnline values", () => {
    expect(classifyTreeNodeConnectivity(treeNode("1", { isOnline: 1 }))).toBe("online");
    expect(classifyTreeNodeConnectivity(treeNode("1", { isOnline: 0 }))).toBe("offline");
  });

  it("maps string isOnline values", () => {
    expect(classifyTreeNodeConnectivity(treeNode("1", { isOnline: "1" }))).toBe("online");
    expect(classifyTreeNodeConnectivity(treeNode("1", { isOnline: "0" }))).toBe("offline");
  });

  it("falls back to online field when isOnline is absent", () => {
    expect(classifyTreeNodeConnectivity(treeNode("1", { online: 1 }))).toBe("online");
    expect(classifyTreeNodeConnectivity(treeNode("1", { online: 0 }))).toBe("offline");
  });

  it("excludes malformed nodes from extraction", () => {
    const result = extractIdsFromTreeNodes([
      treeNode("86000000000001", { isOnline: 1 }),
      treeNode("86000000000002", { isOnline: "maybe" }),
      treeNode("86000000000003", {}),
    ]);
    expect(result.allDeviceIds).toEqual(["86000000000001"]);
    expect(result.malformedNodeCount).toBe(2);
  });
});

describe("querydevicestree inventory sourcing", () => {
  it("loads inventory ids from querydevicestree payload without database", () => {
    const source = collectInventorySourceFromPayload({
      groups: [
        {
          children: [
            { deviceid: "86000000000001" },
            { deviceid: "86000000000002" },
          ],
        },
      ],
    });
    expect(source.source).toBe("querydevicestree");
    expect(source.deviceIds).toEqual(["86000000000001", "86000000000002"]);
    expect(source.duplicateIds).toEqual([]);
  });

  it("detects duplicate device ids from querydevicestree payload", () => {
    const source = collectInventorySourceFromPayload({
      groups: [
        {
          children: [
            { deviceid: "86000000000001" },
            { deviceid: "86000000000001" },
          ],
        },
      ],
    });
    expect(source.duplicateIds).toEqual(["86000000000001"]);
  });
});

describe("dynamic DeviceList component discovery", () => {
  const inventory = new Set(["86000000000001", "86000000000002", "86000000000003"]);

  it("scores candidates by inventory overlap", () => {
    const weak = scoreDeviceListCandidate(
      {
        componentPath: "vm.$children[0]",
        componentName: "DeviceList",
        deviceIds: ["86000000000001"],
        hasSetCurrentZtree: true,
        hasTablesClickRowDevice: true,
      },
      inventory,
    );
    const strong = scoreDeviceListCandidate(
      {
        componentPath: "vm.$children[2]",
        componentName: "DeviceList",
        deviceIds: ["86000000000001", "86000000000002", "86000000000003"],
        hasSetCurrentZtree: true,
        hasTablesClickRowDevice: true,
      },
      inventory,
    );
    expect(strong.inventoryOverlapPercentage).toBe(100);
    expect(weak.inventoryOverlapPercentage).toBe(33);
    expect(
      pickBestDeviceListCandidate([weak, strong], 99)?.componentPath,
    ).toBe("vm.$children[2]");
  });

  it("rejects candidates below 99% overlap", () => {
    const candidate = scoreDeviceListCandidate(
      {
        componentPath: "vm.$children[0]",
        componentName: "DeviceList",
        deviceIds: ["86000000000001"],
        hasSetCurrentZtree: true,
        hasTablesClickRowDevice: true,
      },
      inventory,
    );
    expect(pickBestDeviceListCandidate([candidate], 99)).toBeNull();
  });

  it("rejects candidates missing connectivity methods", () => {
    const candidate = scoreDeviceListCandidate(
      {
        componentPath: "vm.$children[0]",
        componentName: "DeviceList",
        deviceIds: ["86000000000001", "86000000000002", "86000000000003"],
        hasSetCurrentZtree: false,
        hasTablesClickRowDevice: true,
      },
      inventory,
    );
    expect(pickBestDeviceListCandidate([candidate], 99)).toBeNull();
  });
});

describe("tree status reconciliation", () => {
  const inventory = new Set(
    Array.from({ length: 10 }, (_, i) => String(86000000000000 + i)),
  );

  it("validates matching portal and extracted counts", () => {
    const allIds = [...inventory];
    const reconciliation = reconcileTreeStatusExtraction({
      extraction: {
        source: "device_list_tree_nodes",
        componentPath: "vm.$children[1]",
        mapping: "treeNode.isOnline",
        predicateFunction: "DeviceList.setCurrentZtree",
        allDeviceIds: allIds,
        onlineDeviceIds: allIds.slice(0, 4),
        offlineDeviceIds: allIds.slice(4),
        malformedNodeCount: 0,
        skippedNodeCount: 0,
        counts: { all: 10, online: 4, offline: 6 },
        error: null,
      },
      inventoryIds: inventory,
      portalCounts: { all: 10, online: 4, offline: 6 },
      tolerance: 2,
      minOverlapPercent: 99,
    });
    expect(reconciliation.validated).toBe(true);
  });

  it("rejects online/offline intersection", () => {
    const validation = validateStatusModelDiscovery({
      inventoryIds: inventory,
      allDeviceIds: [...inventory],
      onlineDeviceIds: ["86000000000001", "86000000000002"],
      offlineDeviceIds: ["86000000000002", "86000000000003"],
      portalCounts: { all: 10, online: 2, offline: 2 },
    });
    expect(validation.validated).toBe(false);
    expect(validation.onlineOfflineIntersection).toEqual(["86000000000002"]);
  });

  it("rejects count mismatch beyond tolerance", () => {
    const allIds = [...inventory];
    const reconciliation = reconcileTreeStatusExtraction({
      extraction: {
        source: "device_list_tree_nodes",
        componentPath: "vm.$children[1]",
        mapping: "treeNode.isOnline",
        predicateFunction: "DeviceList.setCurrentZtree",
        allDeviceIds: allIds,
        onlineDeviceIds: allIds.slice(0, 3),
        offlineDeviceIds: allIds.slice(3),
        malformedNodeCount: 0,
        skippedNodeCount: 0,
        counts: { all: 10, online: 3, offline: 7 },
        error: null,
      },
      inventoryIds: inventory,
      portalCounts: { all: 10, online: 8, offline: 2 },
      tolerance: 2,
      minOverlapPercent: 99,
    });
    expect(reconciliation.validated).toBe(false);
    expect(reconciliation.validationReasons.some((reason) => reason.includes("count_delta"))).toBe(
      true,
    );
  });

  it("rejects inventory overlap below 99%", () => {
    const reconciliation = reconcileTreeStatusExtraction({
      extraction: {
        source: "device_list_tree_nodes",
        componentPath: "vm.$children[1]",
        mapping: "treeNode.isOnline",
        predicateFunction: "DeviceList.setCurrentZtree",
        allDeviceIds: ["86000000000001"],
        onlineDeviceIds: ["86000000000001"],
        offlineDeviceIds: [],
        malformedNodeCount: 0,
        skippedNodeCount: 0,
        counts: { all: 1, online: 1, offline: 0 },
        error: null,
      },
      inventoryIds: inventory,
      portalCounts: { all: 10, online: 1, offline: 0 },
      tolerance: 2,
      minOverlapPercent: 99,
    });
    expect(reconciliation.validated).toBe(false);
    expect(reconciliation.validationReasons).toContain("inventory_overlap_10");
  });
});

describe("tree status database writes", () => {
  it("builds patches only for inventory devices with changed status", () => {
    const rows = [
      deviceRow("86000000000001", "offline"),
      deviceRow("86000000000002", "online"),
      deviceRow("86000000000003", "offline"),
    ];
    const patches = buildTreeStatusPatches(
      rows,
      new Set(["86000000000001", "86000000000002"]),
      new Set(["86000000000003"]),
      "2026-07-06T12:00:00.000Z",
    );
    expect(patches).toHaveLength(1);
    expect(patches[0]?.source_device_id).toBe("86000000000001");
    expect(patches[0]?.online_status).toBe("online");
    expect(patches[0]?.metadata.online_status_source).toBe("gps51_device_list_tree_nodes");
  });

  it("skips devices missing from validated online/offline sets", () => {
    const rows = [deviceRow("86000000000099", "unknown")];
    const patches = buildTreeStatusPatches(
      rows,
      new Set(["86000000000001"]),
      new Set(["86000000000002"]),
      "2026-07-06T12:00:00.000Z",
    );
    expect(patches).toHaveLength(0);
  });

  it("performs zero writes when validation fails", () => {
    const summary = buildTreeSyncSummary({
      status: "failed",
      mode: "dry",
      portalCounts: { all: 10, online: 4, offline: 6 },
      reconciliation: reconcileTreeStatusExtraction({
        extraction: {
          source: "device_list_tree_nodes",
          componentPath: null,
          mapping: "treeNode.isOnline",
          predicateFunction: "DeviceList.setCurrentZtree",
          allDeviceIds: [],
          onlineDeviceIds: [],
          offlineDeviceIds: [],
          malformedNodeCount: 0,
          skippedNodeCount: 0,
          counts: { all: 0, online: 0, offline: 0 },
          error: "device_list_component_not_found",
        },
        inventoryIds: new Set(["86000000000001"]),
        portalCounts: { all: 10, online: 4, offline: 6 },
      }),
      inventoryCount: 10,
      inventorySource: "querydevicestree",
      databaseWrites: 0,
      componentPath: null,
      extractionError: "device_list_component_not_found",
      malformedNodeCount: 0,
      errorMessage: "device_list_component_not_found",
    });
    expect(summary.validated).toBe(false);
    expect(summary.databaseWrites).toBe(0);
  });

  it("creates failed summaries with null extracted counts", () => {
    const summary = buildTreeSyncSummary({
      status: "failed",
      mode: "dry",
      portalCounts: null,
      reconciliation: null,
      inventoryCount: 0,
      inventorySource: null,
      databaseWrites: 0,
      componentPath: null,
      extractionError: null,
      malformedNodeCount: 0,
      errorMessage: "auth_failed",
    });
    expect(summary.status).toBe("failed");
    expect(summary.mode).toBe("dry");
    expect(summary.extractedCounts).toBeNull();
    expect(summary.databaseWrites).toBe(0);
  });

  it("bulk updates only online_status and last_scraped_at fields", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const sb = { from: vi.fn(() => ({ upsert })) } as unknown as Parameters<
      typeof applyTreeStatusBulkUpdates
    >[0];

    await applyTreeStatusBulkUpdates(
      sb,
      "org-id",
      "account-id",
      [
        {
          id: "row-1",
          source_device_id: "86000000000001",
          online_status: "online",
          last_scraped_at: "2026-07-06T12:00:00.000Z",
          metadata: { online_status_source: "gps51_device_list_tree_nodes" },
        },
      ],
      100,
    );

    expect(upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          id: "row-1",
          online_status: "online",
          last_scraped_at: "2026-07-06T12:00:00.000Z",
        }),
      ],
      { onConflict: "id" },
    );
    const payload = upsert.mock.calls[0]?.[0]?.[0] as Record<string, unknown>;
    expect(payload.latitude).toBeUndefined();
    expect(payload.longitude).toBeUndefined();
    expect(payload.birdie_device_id).toBeUndefined();
  });

  it("preserves position and Birdie relationship fields in patch builder", () => {
    const before = deviceRow("86000000000001");
    before.birdie_device_id = "birdie-1";
    before.latitude = 25.1;
    const after = { ...before, online_status: "online" };
    expect(preservedDeviceLinksIntact(before, after)).toBe(true);
    expect(preservedPositionIntact(before, after)).toBe(true);
  });
});

describe("status precedence", () => {
  it("promotes online from websocket positionLast", () => {
    expect(
      resolveStatusPrecedence({
        websocketPositionJustReceived: true,
        treeStatus: "offline",
        hasTreeSnapshot: true,
      }),
    ).toBe("online");
  });

  it("does not downgrade offline from websocket freshness alone", () => {
    expect(
      resolveStatusPrecedence({
        websocketPositionJustReceived: false,
        treeStatus: "offline",
        hasTreeSnapshot: true,
      }),
    ).toBe("offline");
  });

  it("uses unknown only without validated tree snapshot", () => {
    expect(
      resolveStatusPrecedence({
        websocketPositionJustReceived: false,
        treeStatus: "unknown",
        hasTreeSnapshot: false,
      }),
    ).toBe("unknown");
  });

  it("tags websocket metadata without offline downgrade semantics", () => {
    const metadata = buildWebsocketPositionMetadata({ online_status_source: "gps51_device_list_tree_nodes" });
    expect(metadata.online_status_source).toBe("websocket_positionlast");
    expect(metadata.last_websocket_position_at).toBeTruthy();
    expect(isTruthyOnline(1)).toBe(true);
  });
});
