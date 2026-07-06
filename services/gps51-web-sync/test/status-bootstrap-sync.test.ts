import { describe, expect, it } from "vitest";
import {
  calibrateStatusRule,
  collectBootstrapDeviceRecords,
  evaluateAllDeviceStatuses,
  evaluateDeviceStatus,
  findDuplicateDeviceIds,
  parseLastActiveMs,
  parseOfflineDelaySeconds,
  summarizeDeviceStatuses,
} from "../src/gps51/status-bootstrap-parser.js";
import {
  preservedDeviceLinksIntact,
  preservedPositionIntact,
  resolveStatusPrecedence,
} from "../src/db/status-repository.js";
import { preservedLinksIntact } from "../src/db/live-position-repository.js";
import { buildWebsocketPositionMetadata } from "../src/gps51/offline-state-manager.js";

const PORTAL_ONLINE = 118;
const PORTAL_OFFLINE = 487;
const NOW_MS = Date.parse("2026-06-29T12:00:00.000Z");
const THRESHOLD_SECONDS = 600;

function buildPortalAlignedTree(onlineCount: number, offlineCount: number) {
  const devices = [];
  for (let i = 0; i < onlineCount; i++) {
    devices.push({
      deviceid: `860000000000${String(i).padStart(3, "0")}`,
      lastactivetime: NOW_MS - 60_000,
      offlinedelay: THRESHOLD_SECONDS,
      online: 1,
    });
  }
  for (let i = 0; i < offlineCount; i++) {
    devices.push({
      deviceid: `860000000001${String(i).padStart(3, "0")}`,
      lastactivetime: NOW_MS - 3_600_000,
      offlinedelay: THRESHOLD_SECONDS,
      online: 0,
    });
  }
  return { groups: [{ devices }] };
}

describe("status bootstrap parser", () => {
  it("parses Unix millisecond lastactivetime", () => {
    expect(parseLastActiveMs(1_719_000_000_000, "milliseconds")).toBe(1_719_000_000_000);
    expect(parseLastActiveMs(1_719_000_000, "milliseconds")).toBe(1_719_000_000_000);
  });

  it("parses Unix second lastactivetime", () => {
    expect(parseLastActiveMs(1_719_000, "seconds")).toBe(1_719_000_000);
    expect(parseLastActiveMs(1_719_000_000, "seconds")).toBe(1_719_000_000);
  });

  it("parses offlinedelay in seconds", () => {
    expect(parseOfflineDelaySeconds(600, "seconds", 300)).toBe(600);
  });

  it("parses offlinedelay in minutes", () => {
    expect(parseOfflineDelaySeconds(10, "minutes", 300)).toBe(600);
  });

  it("parses offlinedelay in milliseconds", () => {
    expect(parseOfflineDelaySeconds(600_000, "milliseconds", 300)).toBe(600);
  });

  it("calibrates against portal counts within tolerance", () => {
    const payload = buildPortalAlignedTree(PORTAL_ONLINE, PORTAL_OFFLINE);
    const records = collectBootstrapDeviceRecords(payload);
    expect(records).toHaveLength(PORTAL_ONLINE + PORTAL_OFFLINE);

    const calibration = calibrateStatusRule(
      records,
      { online: PORTAL_ONLINE, offline: PORTAL_OFFLINE },
      THRESHOLD_SECONDS,
      5,
      NOW_MS,
    );

    expect(calibration.selectedRule).not.toBeNull();
    expect(calibration.mismatchCount).toBeLessThanOrEqual(5);
    expect(calibration.calculatedCounts.online).toBe(PORTAL_ONLINE);
    expect(calibration.calculatedCounts.offline).toBe(PORTAL_OFFLINE);
    expect(calibration.calculatedCounts.unknown).toBe(0);
  });

  it("rejects calibration when mismatch exceeds 5 devices", () => {
    const payload = buildPortalAlignedTree(10, 10);
    const records = collectBootstrapDeviceRecords(payload);
    const calibration = calibrateStatusRule(
      records,
      { online: PORTAL_ONLINE, offline: PORTAL_OFFLINE },
      THRESHOLD_SECONDS,
      5,
      NOW_MS,
    );

    expect(calibration.selectedRule).toBeNull();
    expect(calibration.mismatchCount).toBeGreaterThan(5);
  });

  it("detects duplicate device IDs", () => {
    const payload = {
      groups: [
        {
          devices: [
            { deviceid: "860000000000001" },
            { deviceid: "860000000000001" },
          ],
        },
      ],
    };
    expect(findDuplicateDeviceIds(payload)).toEqual(["860000000000001"]);
  });
});

describe("status precedence", () => {
  it("gives WebSocket positionLast immediate Online precedence", () => {
    expect(
      resolveStatusPrecedence({
        websocketPositionJustReceived: true,
        treeStatus: "offline",
        hasTreeSnapshot: true,
      }),
    ).toBe("online");
  });

  it("uses tree snapshot offline when no fresh websocket position", () => {
    expect(
      resolveStatusPrecedence({
        websocketPositionJustReceived: false,
        treeStatus: "offline",
        hasTreeSnapshot: true,
      }),
    ).toBe("offline");
  });

  it("returns unknown when no tree snapshot and no websocket", () => {
    expect(
      resolveStatusPrecedence({
        websocketPositionJustReceived: false,
        treeStatus: "unknown",
        hasTreeSnapshot: false,
      }),
    ).toBe("unknown");
  });
});

describe("status persistence guards", () => {
  it("marks websocket metadata without erasing tree metadata keys", () => {
    const metadata = buildWebsocketPositionMetadata({
      online_status_source: "gps51_querydevicestree",
      status_calculated_at: "2026-06-29T10:00:00.000Z",
    });
    expect(metadata.online_status_source).toBe("websocket_positionlast");
    expect(metadata.status_calculated_at).toBe("2026-06-29T10:00:00.000Z");
  });

  it("preserves Birdie links during status-only updates", () => {
    const before = {
      id: "1",
      source_device_id: "d1",
      online_status: "unknown",
      metadata: null,
      birdie_device_id: "birdie-1",
      vehicle_id: "vehicle-1",
      customer_id: "customer-1",
      latitude: null,
      longitude: null,
    };
    const after = { ...before, online_status: "online" };
    expect(preservedDeviceLinksIntact(before, after)).toBe(true);
    expect(preservedLinksIntact(
      {
        id: "1",
        source_device_id: "d1",
        birdie_device_id: "birdie-1",
        vehicle_id: "vehicle-1",
        customer_id: "customer-1",
        metadata: null,
        latest_source_updated_at: null,
      },
      {
        id: "1",
        source_device_id: "d1",
        birdie_device_id: "birdie-1",
        vehicle_id: "vehicle-1",
        customer_id: "customer-1",
        metadata: null,
        latest_source_updated_at: null,
      },
    )).toBe(true);
  });

  it("preserves latest position coordinates during status-only updates", () => {
    const before = {
      id: "1",
      source_device_id: "d1",
      online_status: "online",
      metadata: null,
      birdie_device_id: null,
      vehicle_id: null,
      customer_id: null,
      latitude: 24.7136,
      longitude: 46.6753,
    };
    const after = { ...before, online_status: "offline" };
    expect(preservedPositionIntact(before, after)).toBe(true);
  });

  it("evaluates tree offline status from stale lastactivetime", () => {
    const record = collectBootstrapDeviceRecords({
      devices: [
        {
          deviceid: "860000000000001",
          lastactivetime: NOW_MS - 3_600_000,
          offlinedelay: THRESHOLD_SECONDS,
        },
      ],
    })[0]!;

    const evaluation = evaluateDeviceStatus(
      record,
      {
        ruleType: "lastactivetime_threshold",
        lastActiveTimeUnit: "milliseconds",
        offlineDelayUnit: "seconds",
        thresholdSeconds: THRESHOLD_SECONDS,
      },
      NOW_MS,
    );

    expect(evaluation.status).toBe("offline");
    const counts = summarizeDeviceStatuses(
      evaluateAllDeviceStatuses([record], {
        ruleType: "lastactivetime_threshold",
        lastActiveTimeUnit: "milliseconds",
        offlineDelayUnit: "seconds",
        thresholdSeconds: THRESHOLD_SECONDS,
      }, NOW_MS),
    );
    expect(counts.offline).toBe(1);
  });
});
