import { describe, expect, it } from "vitest";
import {
  buildTreePositionMetadata,
} from "../src/db/live-position-repository.js";
import {
  candidateFromRecord,
  collectPositionFieldMatches,
  extractNetworkPositionCandidates,
  normalizePositionInventoryExtraction,
  recommendPositionSource,
  resolveCoordinatesFromRecord,
  validatePositionCandidate,
} from "../src/gps51/position-source-extract.js";

describe("position source extraction", () => {
  it("resolves coordinates from callat/callon microdegrees", () => {
    const coords = resolveCoordinatesFromRecord({
      callat: 24_713_600,
      callon: 46_675_300,
    });
    expect(coords).not.toBeNull();
    expect(coords?.latitude).toBeCloseTo(24.7136, 4);
    expect(coords?.longitude).toBeCloseTo(46.6753, 4);
  });

  it("rejects zero coordinates", () => {
    expect(resolveCoordinatesFromRecord({ callat: 0, callon: 0 })).toBeNull();
  });

  it("builds candidate from cacheMgr lastPositions record", () => {
    const candidate = candidateFromRecord(
      "map_component_state",
      "cacheMgr.lastPositions[860000000000001]",
      {
        deviceid: "860000000000001",
        callat: 24.7136,
        callon: 46.6753,
        speed: 42,
        updatetime: 1_719_000_000_000,
        positionlastid: 99,
      },
    );
    expect(candidate).not.toBeNull();
    expect(candidate?.deviceId).toBe("860000000000001");
    expect(candidate?.latitude).toBeCloseTo(24.7136, 4);
  });

  it("validates candidate device id and coordinate bounds", () => {
    const candidate = candidateFromRecord(
      "map_component_state",
      "cacheMgr.lastPositions[860000000000001]",
      {
        deviceid: "860000000000001",
        callat: 24.7136,
        callon: 46.6753,
        updatetime: 1_719_000_000_000,
      },
    );
    expect(candidate).not.toBeNull();
    if (!candidate) return;
    expect(validatePositionCandidate(candidate, "860000000000001").ok).toBe(true);
    expect(validatePositionCandidate(candidate, "other").ok).toBe(false);
  });

  it("prioritizes tree nodes over map state over network over websocket", () => {
    const tree = candidateFromRecord("device_list_tree_nodes", "treeNode", {
      deviceid: "860000000000001",
      callat: 24.7,
      callon: 46.6,
      updatetime: 1_719_000_000_000,
    });
    const map = candidateFromRecord("map_component_state", "cacheMgr.lastPositions[x]", {
      deviceid: "860000000000001",
      callat: 24.8,
      callon: 46.7,
      updatetime: 1_719_000_000_000,
    });
    const network = candidateFromRecord("xhr_fetch", "response.records[0]", {
      deviceid: "860000000000001",
      callat: 24.9,
      callon: 46.8,
      updatetime: 1_719_000_000_000,
    });
    const websocket = candidateFromRecord("websocket_positionLast", "positionLast", {
      deviceid: "860000000000001",
      callat: 25.0,
      callon: 46.9,
      updatetime: 1_719_000_000_000,
    });
    const candidates = [websocket, network, map, tree].filter(
      (item): item is NonNullable<typeof tree> => item != null,
    );
    const recommendation = recommendPositionSource(candidates, "860000000000001");
    expect(recommendation.validated).toBe(true);
    expect(recommendation.positionSource).toBe("device_list_tree_nodes");
    expect(recommendation.candidate?.latitude).toBeCloseTo(24.7, 4);
  });

  it("falls back to map_component_state when tree nodes lack coordinates", () => {
    const map = candidateFromRecord("map_component_state", "cacheMgr.lastPositions[x]", {
      deviceid: "860000000000001",
      callat: 24.8,
      callon: 46.7,
      updatetime: 1_719_000_000_000,
    });
    const recommendation = recommendPositionSource([map!], "860000000000001");
    expect(recommendation.validated).toBe(true);
    expect(recommendation.positionSource).toBe("map_component_state");
  });

  it("excludes reportmileagedetail and poibatch from network extraction", () => {
    const candidates = extractNetworkPositionCandidates(
      [
        {
          action: "reportmileagedetail",
          body: {
            records: [{ deviceid: "860000000000001", callat: 24.7, callon: 46.6 }],
          },
        },
        {
          action: "querydevicestree",
          body: {
            records: [{ deviceid: "860000000000001", callat: 24.7, callon: 46.6, updatetime: 1_719_000_000_000 }],
          },
        },
      ],
      "860000000000001",
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.source).toBe("xhr_fetch");
  });

  it("normalizes inventory extraction from cacheMgr records", () => {
    const extraction = normalizePositionInventoryExtraction(
      {
        source: "map_component_state",
        fieldPath: "cacheMgr.lastPositions[deviceId]",
        componentPath: "cacheMgr",
        records: [
          {
            deviceId: "860000000000001",
            fieldPath: "cacheMgr.lastPositions[860000000000001]",
            record: {
              deviceid: "860000000000001",
              callat: 24.7136,
              callon: 46.6753,
              updatetime: 1_719_000_000_000,
            },
          },
          {
            deviceId: "860000000000002",
            fieldPath: "cacheMgr.lastPositions[860000000000002]",
            record: {
              deviceid: "860000000000002",
              callat: 0,
              callon: 0,
            },
          },
        ],
      },
      new Set(["860000000000001", "860000000000002", "860000000000003"]),
    );
    expect(extraction.validDeviceIds).toEqual(["860000000000001"]);
    expect(extraction.invalidDeviceIds).toEqual(["860000000000002"]);
    expect(extraction.missingDeviceIds).toEqual(["860000000000003"]);
    expect(extraction.positions).toHaveLength(1);
  });

  it("profiles semantic position fields from flattened tree nodes", () => {
    const matches = collectPositionFieldMatches({
      "info.deviceid": 605,
      callat: 120,
      callon: 120,
      speed: 80,
    });
    expect(matches.callat[0]?.count).toBe(120);
    expect(matches.latitude).toEqual([]);
  });

  it("builds tree position metadata without overwriting status source", () => {
    const metadata = buildTreePositionMetadata(
      { online_status_source: "gps51_device_list_tree_nodes" },
      "cacheMgr.lastPositions[860000000000001]",
    );
    expect(metadata.online_status_source).toBe("gps51_device_list_tree_nodes");
    expect(metadata.position_source).toBe("cache_mgr_last_positions");
    expect(metadata.position_field_path).toBe("cacheMgr.lastPositions[860000000000001]");
  });
});
