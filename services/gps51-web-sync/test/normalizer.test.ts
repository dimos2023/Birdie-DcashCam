import { describe, expect, it } from "vitest";
import { normalizeDeviceRecord, dedupeDevices } from "../src/gps51/normalizer.js";

describe("normalizer", () => {
  it("normalizes micro-degree coordinates", () => {
    const device = normalizeDeviceRecord(
      {
        deviceid: "860000000000001",
        callat: 24_713_600,
        callon: 46_675_300,
        speed: 450,
        online: 1,
      },
      "fixture",
    );
    expect(device.latitude).toBeCloseTo(24.7136, 4);
    expect(device.longitude).toBeCloseTo(46.6753, 4);
    expect(device.onlineStatus).toBe("online");
  });

  it("rejects impossible coordinates", () => {
    const device = normalizeDeviceRecord(
      { deviceid: "x", lat: 950_000_000, lng: 950_000_000 },
      "fixture",
    );
    expect(device.latitude).toBeNull();
    expect(device.longitude).toBeNull();
  });

  it("dedupes by imei preferring richer record", () => {
    const a = normalizeDeviceRecord({ deviceid: "1", imei: "8601" }, "fixture");
    const b = normalizeDeviceRecord(
      { deviceid: "1", imei: "8601", lat: 24.7, lng: 46.6 },
      "fixture",
    );
    const out = dedupeDevices([a, b]);
    expect(out).toHaveLength(1);
    expect(out[0].latitude).toBeCloseTo(24.7, 1);
  });
});
