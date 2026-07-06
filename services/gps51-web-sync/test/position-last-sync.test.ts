import { describe, expect, it } from "vitest";
import {
  deriveAccOn,
  derivePositioned,
  parseCoordinatePair,
  parseEpochMilliseconds,
  parsePositionLast,
  parseWebsocketMessage,
} from "../src/gps51/position-last-parser.js";
import {
  isDuplicatePositionId,
  validatePositionLast,
} from "../src/gps51/position-last-validator.js";
import { OfflineStateManager } from "../src/gps51/offline-state-manager.js";
import {
  isGps51LiveWebSocketUrl,
  parseLiveWebSocketFrameForTest,
} from "../src/browser/live-websocket-listener.js";
import { preservedLinksIntact } from "../src/db/live-position-repository.js";
import { redactSecrets } from "../src/browser/redaction.js";

const KNOWN = new Set(["860000000000001", "860000000000002"]);

function samplePositionLast(overrides: Record<string, unknown> = {}) {
  return {
    deviceid: "860000000000001",
    positionlastid: 12345,
    callat: 24_713_600,
    callon: 46_675_300,
    updatetime: 1_719_000_000_000,
    validpoistiontime: 1_719_000_000_000,
    speed: 42,
    course: 180,
    altitude: 650,
    status: 3,
    alarm: 0,
    strstatusen: "ACC On,Located",
    rxlevel: 80,
    gpsvalidnum: 12,
    moving: 1,
    ...overrides,
  };
}

describe("positionLast parsing", () => {
  it("parses canonical positionLast fields", () => {
    const result = parsePositionLast(samplePositionLast());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.position.sourceDeviceId).toBe("860000000000001");
    expect(result.position.sourcePositionId).toBe(12345);
    expect(result.position.latitude).toBeCloseTo(24.7136, 4);
    expect(result.position.longitude).toBeCloseTo(46.6753, 4);
    expect(result.position.speedKmh).toBe(42);
    expect(result.position.directionDeg).toBe(180);
    expect(result.position.altitudeM).toBe(650);
    expect(result.position.signalStrength).toBe(80);
    expect(result.position.satelliteCount).toBe(12);
    expect(result.position.moving).toBe(true);
    expect(result.position.positioned).toBe(true);
  });

  it("parses epoch-millisecond timestamps", () => {
    expect(parseEpochMilliseconds(1_719_000_000_000)).toBe(1_719_000_000_000);
    expect(parseEpochMilliseconds(1_719_000_000)).toBe(1_719_000_000_000);
    expect(parseEpochMilliseconds("2026-06-29T10:00:00.000Z")).toBe(Date.parse("2026-06-29T10:00:00.000Z"));
  });

  it("derives ACC from status bit 0 and detects text mismatch", () => {
    const match = deriveAccOn(3, "ACC On,Located");
    expect(match.accOn).toBe(true);
    expect(match.accTextMismatch).toBe(false);

    const mismatch = deriveAccOn(0, "ACC On,Located");
    expect(mismatch.accOn).toBe(false);
    expect(mismatch.accTextMismatch).toBe(true);
  });

  it("derives positioned from status bit 1 with valid coordinates", () => {
    expect(derivePositioned(2, true)).toBe(true);
    expect(derivePositioned(2, false)).toBe(false);
    expect(derivePositioned(1, true)).toBe(false);
  });

  it("keeps mileage fields in raw payload only", () => {
    const result = parsePositionLast(
      samplePositionLast({ mileage: 1000, totaldistance: 2000, parktime: 30 }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.position.rawPayload.mileage).toBe(1000);
    expect(result.position.rawPayload.totaldistance).toBe(2000);
  });
});

describe("positionLast validation", () => {
  it("rejects unknown devices", () => {
    const parsed = parsePositionLast(samplePositionLast({ deviceid: "999" }));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const result = validatePositionLast(parsed.position, {
      knownDeviceIds: KNOWN,
      latestSourceUpdatedAtMs: new Map(),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("unknown device");
  });

  it("rejects future timestamps beyond 10 minutes", () => {
    const future = Date.now() + 20 * 60 * 1000;
    const parsed = parsePositionLast(samplePositionLast({ updatetime: future }));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const result = validatePositionLast(parsed.position, {
      knownDeviceIds: KNOWN,
      latestSourceUpdatedAtMs: new Map(),
      nowMs: Date.now(),
      maxFutureMs: 600_000,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("timestamp too far in future");
  });

  it("rejects stale updates and duplicate positionlastid keys", () => {
    const parsed = parsePositionLast(samplePositionLast());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const stale = validatePositionLast(parsed.position, {
      knownDeviceIds: KNOWN,
      latestSourceUpdatedAtMs: new Map([[parsed.position.sourceDeviceId, Date.now()]]),
    });
    expect(stale.ok).toBe(false);

    const seen = new Set<string>();
    expect(isDuplicatePositionId(seen, parsed.position)).toBe(false);
    expect(isDuplicatePositionId(seen, parsed.position)).toBe(true);
  });

  it("validates coordinate ranges", () => {
    expect(parseCoordinatePair(950_000_000, 950_000_000)).toBeNull();
    expect(parseCoordinatePair(0, 0)).toBeNull();
    expect(parseCoordinatePair(24.7, 46.6)?.latitude).toBeCloseTo(24.7, 1);
  });
});

describe("WebSocket message handling", () => {
  it("accepts only positionLast and rejects remindMsg as position", () => {
    const positionMsg = { action: "push", positionLast: samplePositionLast() };
    const alarmMsg = { action: "push", remindMsg: { deviceid: "860000000000001", alarmtype: "speed" } };

    expect(parseWebsocketMessage(positionMsg).kind).toBe("positionLast");
    expect(parseWebsocketMessage(alarmMsg).kind).toBe("remindMsg");

    const parsedPosition = parseLiveWebSocketFrameForTest(positionMsg);
    expect(parsedPosition.kind).toBe("positionLast");
    expect(parsedPosition.position?.sourceDeviceId).toBe("860000000000001");

    const parsedAlarm = parseLiveWebSocketFrameForTest(alarmMsg);
    expect(parsedAlarm.kind).toBe("remindMsg");
    expect(parsedAlarm.position).toBeUndefined();
    expect(parsedAlarm.remind?.alarmCode).toBe("speed");
  });

  it("matches gps51 live websocket URLs", () => {
    expect(isGps51LiveWebSocketUrl("wss://gps51.com/wss/wss?serverid=0")).toBe(true);
    expect(isGps51LiveWebSocketUrl("wss://example.com/wss/wss")).toBe(false);
  });

  it("redacts secrets in websocket payloads", () => {
    const sanitized = redactSecrets({
      positionLast: samplePositionLast(),
      token: "secret",
      api_key: "abc",
    }) as Record<string, unknown>;
    expect(sanitized.token).toBe("[REDACTED]");
    expect(sanitized.api_key).toBe("[REDACTED]");
  });
});

describe("offline warmup and stale devices", () => {
  it("does not mark unseen devices offline during warmup", () => {
    const manager = new OfflineStateManager(
      { offlineAfterSeconds: 600, warmupSeconds: 900 },
      1_000_000,
    );
    expect(manager.getOnlineState("860000000000001", 1_000_000 + 60_000)).toBe("unknown");
    expect(manager.isWarmupActive(1_000_000 + 60_000)).toBe(true);
  });

  it("marks previously seen stale devices offline after warmup", () => {
    const started = Date.now() - 20 * 60 * 1000;
    const manager = new OfflineStateManager(
      { offlineAfterSeconds: 600, warmupSeconds: 900 },
      started,
    );
    manager.markPosition("860000000000001", started + 1_000);
    expect(manager.getOnlineState("860000000000001", Date.now())).toBe("offline");
    expect(manager.getStaleDeviceIds(Date.now())).toContain("860000000000001");
  });

  it("keeps never-seen devices as unknown after warmup", () => {
    const started = Date.now() - 20 * 60 * 1000;
    const manager = new OfflineStateManager(
      { offlineAfterSeconds: 600, warmupSeconds: 60 },
      started,
    );
    expect(manager.getOnlineState("860000000000099", Date.now())).toBe("unknown");
  });
});

describe("Birdie link preservation", () => {
  it("detects when links would be lost", () => {
    const before = {
      id: "1",
      source_device_id: "860000000000001",
      birdie_device_id: "birdie-1",
      vehicle_id: "veh-1",
      customer_id: null,
      metadata: null,
      latest_source_updated_at: null,
    };
    const after = { ...before, birdie_device_id: null };
    expect(preservedLinksIntact(before, after)).toBe(false);
    expect(preservedLinksIntact(before, before)).toBe(true);
  });
});
