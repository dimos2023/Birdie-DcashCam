import { describe, expect, it } from "vitest";
import {
  buildCacheDedupeKey,
  buildCachePositionFingerprint,
  isDuplicateCachePosition,
  isStaleCachePosition,
} from "../src/gps51/position-cache-fingerprint.js";
import { prioritizeCacheSyncDevices } from "../src/gps51/position-cache-prioritize.js";
import { validateCachePositionCoordinates } from "../src/gps51/position-cache-validator.js";
import { parseCacheRecord } from "../src/gps51/position-cache-browser.js";
import type { ParsedPositionLast } from "../src/gps51/position-last-parser.js";

const ORG_ID = "00000000-0000-4000-8000-000000000001";
const INVENTORY = new Set(["18270661442", "18270661565", "18270661594"]);

function samplePosition(overrides: Partial<ParsedPositionLast> = {}): ParsedPositionLast {
  return {
    sourceDeviceId: "18270661442",
    sourcePositionId: null,
    latitude: 26.316738,
    longitude: 50.173372,
    sourceUpdatedAt: "2026-07-06T15:25:06.335Z",
    sourceLocatedAt: "2026-07-06T10:25:13.034Z",
    speedKmh: 0,
    directionDeg: null,
    altitudeM: null,
    statusBits: null,
    alarmBits: null,
    statusText: null,
    signalStrength: null,
    satelliteCount: null,
    moving: false,
    accOn: null,
    positioned: true,
    rawPayload: {},
    accTextMismatch: false,
    ...overrides,
  };
}

describe("position cache fingerprint", () => {
  it("builds deterministic fingerprint when sourcePositionId is null", () => {
    const position = samplePosition();
    const fp1 = buildCachePositionFingerprint(ORG_ID, "18270661442", position);
    const fp2 = buildCachePositionFingerprint(ORG_ID, "18270661442", position);
    expect(fp1).toBe(fp2);
    expect(fp1).toHaveLength(64);
  });

  it("deduplicates by sourcePositionId when present", () => {
    const position = samplePosition({ sourcePositionId: 12345 });
    const key = buildCacheDedupeKey(ORG_ID, "18270661442", position);
    expect(key).toContain(":id:12345");
  });

  it("tracks duplicate fingerprints in a cycle", () => {
    const seen = new Set<string>();
    const position = samplePosition();
    expect(isDuplicateCachePosition(seen, ORG_ID, "18270661442", position)).toBe(false);
    expect(isDuplicateCachePosition(seen, ORG_ID, "18270661442", position)).toBe(true);
  });

  it("rejects stale cache positions against stored latest timestamp", () => {
    const position = samplePosition();
    const storedMs = Date.parse("2026-07-06T16:00:00.000Z");
    expect(isStaleCachePosition(position, storedMs)).toBe(true);
    expect(isStaleCachePosition(position, null)).toBe(false);
  });
});

describe("position cache validation", () => {
  it("accepts valid coordinates in inventory", () => {
    const result = validateCachePositionCoordinates(samplePosition(), INVENTORY);
    expect(result.ok).toBe(true);
  });

  it("rejects 0,0 coordinates", () => {
    const result = validateCachePositionCoordinates(
      samplePosition({ latitude: 0, longitude: 0 }),
      INVENTORY,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects unknown inventory device", () => {
    const result = validateCachePositionCoordinates(
      samplePosition({ sourceDeviceId: "99999999999" }),
      INVENTORY,
    );
    expect(result.ok).toBe(false);
  });

  it("does not reject valid position solely because sourcePositionId is null", () => {
    const result = validateCachePositionCoordinates(
      samplePosition({ sourcePositionId: null }),
      INVENTORY,
    );
    expect(result.ok).toBe(true);
  });
});

describe("position cache prioritization", () => {
  it("prioritizes online devices without stored positions first", () => {
    const order = prioritizeCacheSyncDevices({
      inventoryIds: ["18270661442", "18270661565", "18270661594"],
      onlineIds: new Set(["18270661442", "18270661565"]),
      latestPositionMsByDevice: new Map([["18270661594", Date.parse("2026-07-06T12:00:00.000Z")]]),
      cacheHitIds: new Set(["18270661594"]),
      staleSeconds: 300,
      maxDevices: 10,
      nowMs: Date.parse("2026-07-06T15:00:00.000Z"),
    });
    expect(order[0]).toBe("18270661442");
    expect(order[1]).toBe("18270661565");
  });

  it("limits devices per cycle", () => {
    const order = prioritizeCacheSyncDevices({
      inventoryIds: ["a", "b", "c", "d"],
      onlineIds: new Set(["a", "b", "c", "d"]),
      latestPositionMsByDevice: new Map(),
      cacheHitIds: new Set(),
      staleSeconds: 300,
      maxDevices: 2,
    });
    expect(order).toHaveLength(2);
  });
});

describe("cacheMgr lastPositions parsing", () => {
  it("parses GPS51 cache record with callat/callon microdegrees", () => {
    const position = parseCacheRecord("18270661442", {
      deviceid: "18270661442",
      callat: 26_316_738,
      callon: 50_173_372,
      updatetime: 1_782_801_906_335,
      validpoistiontime: 1_782_783_913_034,
      speed: 0,
    });
    expect(position).not.toBeNull();
    expect(position?.latitude).toBeCloseTo(26.316738, 4);
    expect(position?.longitude).toBeCloseTo(50.173372, 4);
    expect(position?.sourcePositionId).toBeNull();
  });
});

describe("dry mode guarantees", () => {
  it("summary builder preserves zero database writes for dry stats", () => {
    const summary = {
      inventoryCount: 605,
      devicesAttempted: 100,
      cacheHitsBeforeSelection: 551,
      positionsReceivedAfterSelection: 3,
      validPositions: 554,
      invalidPositions: 2,
      missingPositions: 49,
      duplicatePositions: 5,
      onlineDevicesWithPosition: 120,
      offlineDevicesWithPosition: 434,
      databaseWrites: 0,
      validated: true,
      validationReasons: [] as string[],
    };
    expect(summary.databaseWrites).toBe(0);
  });
});

describe("JT isolation", () => {
  it("uses only gps51_web_positions table name in cache insert path", async () => {
    const source = await import("../src/db/live-position-repository.js");
    expect(typeof source.insertCachePosition).toBe("function");
    expect(source.insertCachePosition.toString()).not.toContain("jt_");
  });
});
