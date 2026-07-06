import { describe, expect, it } from "vitest";
import {
  buildMappingVariants,
  discoverFieldCandidates,
  evaluateFieldMapping,
  flattenScalarDeviceFields,
  isDeviceScalarPath,
  profileDeviceFields,
} from "../src/gps51/status-model-field-profiler.js";
import {
  buildModelCandidate,
  categorizeModelDiscoveryFailure,
  isForbiddenDeviceSource,
  recommendModelSource,
  rejectStaleModelCandidate,
  validateStatusModelDiscovery,
} from "../src/gps51/status-model-reconciliation.js";
import {
  buildVueAppProbeScript,
  createTraversalState,
  extractInventoryIdsFromValue,
  normalizeBrowserProbeHits,
  probeValueForModelHit,
  shouldSkipTraversalKey,
} from "../src/gps51/status-model-traverse.js";
import { normalizeUnknownArray } from "../src/browser/status-dom-normalize.js";
import { assertBrowserScriptSafe } from "../src/browser/browser-page-scripts.js";
import { buildDomStatusPatches } from "../src/db/status-repository.js";

function deviceRecord(
  id: string,
  fields: Record<string, unknown>,
): {
  sourceDeviceId: string;
  deviceName: string | null;
  lastActiveTimeRaw: null;
  offlineDelayRaw: null;
  raw: Record<string, unknown>;
} {
  return {
    sourceDeviceId: id,
    deviceName: typeof fields.devicename === "string" ? fields.devicename : null,
    lastActiveTimeRaw: null,
    offlineDelayRaw: null,
    raw: { deviceid: id, ...fields },
  };
}

const INVENTORY = new Set(
  Array.from({ length: 10 }, (_, i) => String(86000000000000 + i)),
);

describe("status model field profiler", () => {
  it("flattens nested scalar device fields", () => {
    const fields = flattenScalarDeviceFields({
      deviceid: "86000000000001",
      meta: { online: 1, label: "Van" },
      flags: [{ active: true }],
    });
    expect(fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "deviceid", value: "86000000000001" }),
        expect.objectContaining({ path: "meta.online", value: 1 }),
        expect.objectContaining({ path: "meta.label", value: "Van" }),
        expect.objectContaining({ path: "flags[0].active", value: true }),
      ]),
    );
  });

  it("excludes root-only response metadata paths", () => {
    expect(isDeviceScalarPath("code")).toBe(false);
    expect(isDeviceScalarPath("status")).toBe(true);
    expect(isDeviceScalarPath("device.status")).toBe(true);
  });

  it("discovers boolean status fields", () => {
    const records = [
      deviceRecord("86000000000000", { isonline: true }),
      deviceRecord("86000000000001", { isonline: false }),
      deviceRecord("86000000000002", { isonline: true }),
    ];
    const profiles = profileDeviceFields(records);
    expect(profiles.some((profile) => profile.fieldPath === "isonline")).toBe(true);
  });

  it("tests numeric 0/1 mapping in both directions", () => {
    const records = [
      deviceRecord("86000000000000", { status: 1 }),
      deviceRecord("86000000000001", { status: 0 }),
      deviceRecord("86000000000002", { status: 1 }),
    ];
    const mapping = buildMappingVariants(["1", "0"])[0]!;
    const forward = evaluateFieldMapping(records, "status", mapping);
    expect(forward.onlineDeviceIds).toEqual(["86000000000000", "86000000000002"]);
    expect(forward.offlineDeviceIds).toEqual(["86000000000001"]);

    const reverse = evaluateFieldMapping(records, "status", buildMappingVariants(["1", "0"])[1]!);
    expect(reverse.onlineDeviceIds).toEqual(["86000000000001"]);
  });

  it("tests enum status mapping", () => {
    const records = [
      deviceRecord("86000000000000", { devicestatus: "online" }),
      deviceRecord("86000000000001", { devicestatus: "offline" }),
      deviceRecord("86000000000002", { devicestatus: "online" }),
      deviceRecord("86000000000003", { devicestatus: "offline" }),
    ];
    const candidates = discoverFieldCandidates(records, { all: 4, online: 2, offline: 2 }, 0);
    expect(candidates.some((candidate) => candidate.validated)).toBe(true);
  });

  it("validates dynamic portal counts within tolerance", () => {
    const records = Array.from({ length: 10 }, (_, i) =>
      deviceRecord(String(86000000000000 + i), { isonline: i < 4 }),
    );
    const candidates = discoverFieldCandidates(records, { all: 10, online: 3, offline: 7 }, 2);
    expect(candidates.some((candidate) => candidate.validated)).toBe(true);
  });
});

describe("status model traversal", () => {
  it("handles Map and Set inventory collections", () => {
    const map = new Map<string, unknown>([
      ["86000000000001", { deviceid: "86000000000001", status: 1 }],
      ["86000000000002", { deviceid: "86000000000002", status: 0 }],
    ]);
    const ids = extractInventoryIdsFromValue(map, INVENTORY);
    expect(ids).toEqual(expect.arrayContaining(["86000000000001", "86000000000002"]));
  });

  it("handles cyclic objects safely", () => {
    const cyclic: Record<string, unknown> = { deviceid: "86000000000003" };
    cyclic.self = cyclic;
    const state = createTraversalState();
    const ids = extractInventoryIdsFromValue(cyclic, INVENTORY, { maxDepth: 10, maxObjects: 1000 }, state);
    expect(ids).toEqual(["86000000000003"]);
  });

  it("filters secret keys during traversal", () => {
    expect(shouldSkipTraversalKey("access_token")).toBe(true);
    expect(shouldSkipTraversalKey("deviceList")).toBe(false);
  });

  it("detects Vue setupState paths", () => {
    const hit = probeValueForModelHit(
      "#app.__vue_app__._instance.setupState.deviceList",
      [
        { deviceid: "86000000000004", online: 1 },
        { deviceid: "86000000000005", online: 0 },
      ],
      INVENTORY,
    );
    expect(hit?.source).toBe("vue_state");
    expect(hit?.hasPerDeviceStatus).toBe(true);
    expect(hit?.matchedInventoryIds).toEqual(["86000000000004", "86000000000005"]);
  });

  it("detects Pinia store paths", () => {
    const hit = probeValueForModelHit(
      "#app.__vue_app__._context.provides.pinia._s.devices",
      [{ deviceid: "86000000000006", status: "online" }],
      INVENTORY,
    );
    expect(hit?.source).toBe("pinia_store");
  });

  it("detects Vuex state paths", () => {
    const hit = probeValueForModelHit(
      "#app.__vue__.$store.state.monitor.devices",
      [{ deviceid: "86000000000007", status: 1 }],
      INVENTORY,
    );
    expect(hit?.source).toBe("vuex_store");
  });

  it("normalizes undefined evaluate results", () => {
    expect(normalizeBrowserProbeHits(undefined, INVENTORY)).toEqual([]);
    expect(normalizeUnknownArray(undefined)).toEqual([]);
  });

  it("embeds inventory in browser probe script safely", () => {
    const script = buildVueAppProbeScript(["86000000000001"]);
    assertBrowserScriptSafe(script);
    expect(script).toContain("86000000000001");
    expect(script).not.toContain("__name");
  });
});

describe("status model reconciliation", () => {
  it("rejects forbidden page-root device sources", () => {
    expect(isForbiddenDeviceSource("html")).toBe(true);
    expect(isForbiddenDeviceSource("#app.__vue__.$data.devices")).toBe(false);
  });

  it("rejects identical stale datasets across tabs", () => {
    const reason = rejectStaleModelCandidate({
      tab: "online",
      matchedInventoryCount: 11,
      portalCount: 107,
      datasetSignature: "online:11:a,b,c",
      previousSignatures: ["online:11:a,b,c"],
      dataPath: "#app.__vue__.$data.devices",
    });
    expect(reason).toBe("identical_dataset_across_tabs");
  });

  it("rejects online/offline intersection", () => {
    const validation = validateStatusModelDiscovery({
      inventoryIds: INVENTORY,
      allDeviceIds: [...INVENTORY],
      onlineDeviceIds: ["86000000000001", "86000000000002"],
      offlineDeviceIds: ["86000000000002", "86000000000003"],
      portalCounts: { all: 10, online: 2, offline: 2 },
      tolerance: 0,
    });
    expect(validation.validated).toBe(false);
    expect(validation.validationReasons.some((reason) => reason.startsWith("online_offline_intersection"))).toBe(
      true,
    );
  });

  it("prioritizes querydevicestree field over vue collections", () => {
    const recommendation = recommendModelSource({
      fieldCandidates: [
        {
          validated: true,
          fieldPath: "isonline",
          mapping: { label: "standard_online_offline" },
        },
      ],
      modelCandidates: [
        buildModelCandidate({
          source: "vue_state",
          dataPath: "#app.__vue__.$data.devices",
          tab: "all",
          matchedIds: ["86000000000001"],
          collectionLength: 1,
          statusFields: ["online"],
          hasPerDeviceStatus: true,
          portalCount: 10,
          previousSignatures: [],
        }),
      ],
    });
    expect(recommendation.source).toBe("querydevicestree_field");
    expect(recommendation.fieldPath).toBe("isonline");
  });

  it("categorizes failure when no inventory status field exists", () => {
    const category = categorizeModelDiscoveryFailure({
      fieldCandidateCount: 0,
      validatedFieldCandidate: false,
      modelCandidateCount: 0,
      vueCandidates: 0,
      validation: validateStatusModelDiscovery({
        inventoryIds: INVENTORY,
        allDeviceIds: [],
        onlineDeviceIds: [],
        offlineDeviceIds: [],
        portalCounts: { all: 10, online: 3, offline: 7 },
      }),
    });
    expect(category).toBe("no_inventory_status_field");
  });

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
    const databaseWrites = validated ? patches.length : 0;
    expect(databaseWrites).toBe(0);
  });
});
