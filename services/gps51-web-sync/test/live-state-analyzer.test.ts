import { describe, expect, it } from "vitest";
import { redactSecrets } from "../src/browser/redaction.js";
import {
  analyzeLiveCandidate,
  analyzeQueryAlarmLiveState,
  buildLiveStateSummary,
  collectLiveRecords,
  computeOverlap,
  computeRankingScore,
  rankLiveCandidates,
  tryParseJsonPayload,
  type RawLiveCapture,
} from "../src/gps51/live-state-analyzer.js";
import {
  extractLiveDeviceId,
  recordHasCoordinates,
  recordHasFieldGroup,
} from "../src/gps51/live-field-aliases.js";

const INVENTORY = new Set(["860000000000001", "860000000000002", "860000000000003"]);

function capture(
  partial: Partial<RawLiveCapture> & Pick<RawLiveCapture, "endpointKey" | "transportType" | "url">,
): RawLiveCapture {
  return {
    action: null,
    payloads: [],
    frameCount: 0,
    ...partial,
  };
}

describe("live-state overlap calculation", () => {
  it("computes overlap count and percentage against inventory IDs", () => {
    const overlap = computeOverlap(
      ["860000000000001", "860000000000002", "999999999999999", null],
      INVENTORY,
    );
    expect(overlap.uniqueDeviceIdCount).toBe(3);
    expect(overlap.overlapCount).toBe(2);
    expect(overlap.overlapPercentage).toBeCloseTo(66.67, 1);
  });

  it("analyzes candidate overlap with inventory device IDs", () => {
    const candidate = analyzeLiveCandidate(
      capture({
        endpointKey: "fetch:querylastposition",
        transportType: "fetch",
        url: "https://gps51.com/webapi?action=querylastposition",
        action: "querylastposition",
        payloads: [
          {
            records: [
              { deviceid: "860000000000001", lat: 24.71, lng: 46.67, online: 1, updatetime: new Date().toISOString() },
              { deviceid: "860000000000002", latitude: 24.72, longitude: 46.68, speed: 40 },
              { deviceid: "860000000000003", glat: 24.73, glng: 46.69, acc: 1 },
            ],
          },
        ],
        frameCount: 1,
      }),
      INVENTORY,
      (record) => record,
    );

    expect(candidate.recordCount).toBe(3);
    expect(candidate.overlapCount).toBe(3);
    expect(candidate.overlapPercentage).toBe(100);
    expect(candidate.recordsWithCoordinates).toBe(3);
    expect(candidate.recordsWithSpeed).toBe(1);
    expect(candidate.recordsWithOnlineStatus).toBe(1);
    expect(candidate.recordsWithAcc).toBe(1);
  });
});

describe("coordinate alias detection", () => {
  it("detects lat/lng, latitude/longitude, and glat/glng aliases", () => {
    expect(recordHasCoordinates({ lat: 24.7136, lng: 46.6753 })).toBe(true);
    expect(recordHasCoordinates({ latitude: 24.7136, longitude: 46.6753 })).toBe(true);
    expect(recordHasCoordinates({ glat: 24.7136, glng: 46.6753 })).toBe(true);
    expect(recordHasCoordinates({ lat: 0, lng: 0 })).toBe(false);
  });

  it("detects device identifier aliases", () => {
    expect(extractLiveDeviceId({ deviceid: "860000000000001" })).toBe("860000000000001");
    expect(extractLiveDeviceId({ deviceId: "860000000000002" })).toBe("860000000000002");
    expect(extractLiveDeviceId({ terminalno: "860000000000003" })).toBe("860000000000003");
    expect(extractLiveDeviceId({ simnum: "966512345678" })).toBe("966512345678");
  });

  it("detects status and timestamp aliases", () => {
    expect(recordHasFieldGroup({ online: 1 }, "online")).toBe(true);
    expect(recordHasFieldGroup({ device_status: "offline" }, "online")).toBe(true);
    expect(recordHasFieldGroup({ lastactivetime: "2026-06-29T10:00:00Z" }, "timestamp")).toBe(true);
    expect(recordHasFieldGroup({ address: "Riyadh" }, "address")).toBe(true);
  });
});

describe("WebSocket JSON parsing", () => {
  it("parses JSON websocket frames", () => {
    const payload = tryParseJsonPayload(
      JSON.stringify({ deviceid: "860000000000001", lat: 24.7, lng: 46.6 }),
    );
    expect(payload).toEqual({ deviceid: "860000000000001", lat: 24.7, lng: 46.6 });
  });

  it("parses double-encoded JSON websocket frames", () => {
    const inner = JSON.stringify([{ deviceid: "860000000000001", speed: 30 }]);
    const payload = tryParseJsonPayload(JSON.stringify(inner));
    expect(Array.isArray(payload)).toBe(true);
    expect(collectLiveRecords(payload)).toHaveLength(1);
  });

  it("analyzes websocket transport candidates separately", () => {
    const candidate = analyzeLiveCandidate(
      capture({
        endpointKey: "websocket:wss://gps51.com/ws",
        transportType: "websocket",
        url: "wss://gps51.com/ws",
        payloads: [{ records: [{ deviceid: "860000000000001", lat: 1, lng: 2 }] }],
        frameCount: 4,
      }),
      INVENTORY,
      (record) => record,
    );
    expect(candidate.transportType).toBe("websocket");
    expect(candidate.responseOrFrameCount).toBe(4);
    expect(candidate.overlapCount).toBe(1);
  });
});

describe("alarm-only rejection", () => {
  it("penalizes queryalarm candidates in ranking", () => {
    const metrics = analyzeLiveCandidate(
      capture({
        endpointKey: "fetch:queryalarm",
        transportType: "fetch",
        url: "https://gps51.com/webapi?action=queryalarm",
        action: "queryalarm",
        payloads: [
          {
            records: Array.from({ length: 100 }, (_, i) => ({
              deviceid: String(860000000000001n + BigInt(i % 3)),
              alarmtype: "overspeed",
              lat: 24.7,
              lng: 46.6,
              time: "2025-01-01T00:00:00Z",
            })),
          },
        ],
        frameCount: 1,
      }),
      INVENTORY,
      (record) => record,
    );

    expect(metrics.isAlarmCandidate).toBe(true);
    expect(metrics.rankingBreakdown.alarmOnlyRecords).toBe(-20);

    const alarmAnalysis = analyzeQueryAlarmLiveState(
      capture({
        endpointKey: "fetch:queryalarm",
        transportType: "fetch",
        url: "https://gps51.com/webapi?action=queryalarm",
        action: "queryalarm",
        payloads: metrics.sampleRecords.length ? [{ records: metrics.sampleRecords }] : [],
        frameCount: 1,
      }).payloads,
      INVENTORY,
      (record) => record,
    );
    expect(alarmAnalysis.safeForLiveStatus).toBe(false);
    expect(["historical_alarms", "mixed", "unknown"]).toContain(alarmAnalysis.assessment);
  });
});

describe("candidate ranking", () => {
  it("ranks high-overlap coordinate feeds above alarm-only feeds", () => {
    const liveFeed = analyzeLiveCandidate(
      capture({
        endpointKey: "fetch:querylastposition",
        transportType: "fetch",
        url: "https://gps51.com/webapi?action=querylastposition",
        action: "querylastposition",
        payloads: [
          {
            records: INVENTORY.values().map((deviceid) => ({
              deviceid,
              lat: 24.7,
              lng: 46.6,
              online: 1,
              updatetime: new Date().toISOString(),
              speed: 20,
              acc: 1,
            })),
          },
        ],
        frameCount: 1,
      }),
      INVENTORY,
      (record) => record,
    );

    const alarmFeed = analyzeLiveCandidate(
      capture({
        endpointKey: "fetch:queryalarm",
        transportType: "fetch",
        url: "https://gps51.com/webapi?action=queryalarm",
        action: "queryalarm",
        payloads: [{ records: [{ deviceid: "860000000000001", alarmtype: "speed", time: "2020-01-01" }] }],
        frameCount: 1,
      }),
      INVENTORY,
      (record) => record,
    );

    const ranked = rankLiveCandidates([alarmFeed, liveFeed]);
    expect(ranked[0].endpointKey).toBe("fetch:querylastposition");
    expect(ranked[0].rankingScore).toBeGreaterThan(alarmFeed.rankingScore);
  });

  it("applies scoring breakdown thresholds", () => {
    const { rankingScore, rankingBreakdown } = computeRankingScore({
      endpointKey: "fetch:test",
      action: "test",
      url: "https://gps51.com/webapi?action=test",
      transportType: "fetch",
      responseOrFrameCount: 1,
      recordCount: 605,
      uniqueDeviceIdCount: 605,
      overlapCount: 605,
      overlapPercentage: 100,
      recordsWithCoordinates: 605,
      recordsWithSpeed: 400,
      recordsWithOnlineStatus: 605,
      recordsWithAcc: 300,
      recordsWithTimestamp: 605,
      newestRecordTimestamp: new Date().toISOString(),
      oldestRecordTimestamp: new Date().toISOString(),
      allRecordsOlderThan24h: false,
      fieldNameFrequency: {},
      rootKeys: ["records"],
      sampleRecords: [],
      isAlarmCandidate: false,
      isPlaybackCandidate: false,
    });

    expect(rankingBreakdown.overlapAbove90Percent).toBe(20);
    expect(rankingBreakdown.containsLatitudeLongitude).toBe(15);
    expect(rankingBreakdown.containsOnlineOfflineStatus).toBe(10);
    expect(rankingScore).toBeGreaterThanOrEqual(58);
  });

  it("builds summary with validated flag false until manual confirmation", () => {
    const candidate = analyzeLiveCandidate(
      capture({
        endpointKey: "fetch:querylastposition",
        transportType: "fetch",
        url: "https://gps51.com/webapi?action=querylastposition",
        action: "querylastposition",
        payloads: [{ records: [{ deviceid: "860000000000001", lat: 1, lng: 2, updatetime: new Date().toISOString() }] }],
        frameCount: 1,
      }),
      INVENTORY,
      (record) => record,
    );

    const summary = buildLiveStateSummary(
      605,
      new Date().toISOString(),
      new Date().toISOString(),
      90_000,
      [candidate],
      [],
      null,
    );

    expect(summary.topRecommendation?.validated).toBe(false);
  });
});

describe("secret redaction for live discovery", () => {
  it("redacts api_key and token fields from live records", () => {
    const sanitized = redactSecrets({
      deviceid: "860000000000001",
      lat: 24.7,
      token: "secret-token",
      api_key: "secret-key",
      nested: { authorization: "Bearer abc", speed: 10 },
    }) as Record<string, unknown>;

    expect(sanitized.token).toBe("[REDACTED]");
    expect(sanitized.api_key).toBe("[REDACTED]");
    expect((sanitized.nested as Record<string, unknown>).authorization).toBe("[REDACTED]");
    expect(sanitized.deviceid).toBe("860000000000001");
  });
});
