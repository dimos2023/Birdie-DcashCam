import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseDeviceTree, parseInventoryDeviceTree } from "../src/gps51/device-tree-parser.js";
import {
  parseDevicesFromPayload,
  scoreJsonPayload,
} from "../src/gps51/device-response-parser.js";
import { parseAlarmPayload } from "../src/gps51/alarm-response-parser.js";
import {
  normalizeInventoryDevice,
  parseVideoChannels,
} from "../src/gps51/inventory-normalizer.js";
import {
  findDuplicateSourceDeviceIds,
  validateInventoryDevices,
  InventoryCountError,
  InventoryDuplicateError,
} from "../src/gps51/inventory-validation.js";
import {
  classifyUpsertOutcome,
  inventoryRowChanged,
  buildInventoryUpsertPayload,
} from "../src/db/inventory-repository.js";
import type { InventoryDeviceRecord } from "../src/gps51/inventory-types.js";
import type { ExistingInventoryDevice } from "../src/db/inventory-repository.js";

const fixtureDir = path.dirname(fileURLToPath(import.meta.url));

function build605DeviceTree(): Record<string, unknown> {
  const devices = Array.from({ length: 605 }, (_, index) => ({
    deviceid: String(860000000000001n + BigInt(index)),
    devicename: `Unit ${index + 1}`,
    simnum: index % 2 === 0 ? `9665${String(index).padStart(8, "0")}` : undefined,
    videochannelcount: index % 3 === 0 ? 4 : 0,
    videochannelsetting: index % 3 === 0 ? "Front,Rear,Cabin,Side" : undefined,
  }));

  return {
    status: 0,
    rootuser: {
      username: "BXAW",
      groups: [{ groupname: "Fleet A", devices }],
    },
  };
}

describe("device tree parser", () => {
  it("parses nested querydevicestree.rootuser structure", () => {
    const raw = readFileSync(
      path.join(fixtureDir, "fixtures/querydevicestree-nested.json"),
      "utf8",
    );
    const payload = JSON.parse(raw);
    const result = parseDeviceTree(payload);

    expect(result.root?.kind).toBe("account");
    expect(result.summary.accountNodeCount).toBeGreaterThanOrEqual(1);
    expect(result.summary.groupNodeCount).toBeGreaterThanOrEqual(3);
    expect(result.summary.detectedDeviceCount).toBe(4);
    expect(result.summary.uniqueDeviceCount).toBe(4);
    expect(result.summary.duplicateDeviceCount).toBe(0);

    const ids = result.devices.map((d) => d.sourceDeviceId).sort();
    expect(ids).toEqual([
      "860000000000001",
      "860000000000002",
      "860000000000003",
      "860000000000004",
    ]);
  });

  it("walks deeply nested children arrays", () => {
    const payload = {
      rootuser: {
        username: "root",
        children: [
          {
            groupname: "L1",
            children: [
              {
                groupname: "L2",
                devices: [{ deviceid: "111111111111111", devicename: "Deep" }],
              },
            ],
          },
        ],
      },
    };
    const result = parseDeviceTree(payload);
    expect(result.devices).toHaveLength(1);
    expect(result.devices[0].sourceDeviceId).toBe("111111111111111");
  });
});

describe("inventory device tree parser", () => {
  it("builds readable account and group paths", () => {
    const payload = {
      rootuser: {
        username: "BXAW",
        groups: [
          {
            groupname: "Customer Account",
            groups: [{ groupname: "Vehicle Group", devices: [{ deviceid: "1", devicename: "Van 1" }] }],
          },
        ],
      },
    };

    const result = parseInventoryDeviceTree(payload);
    expect(result.devices[0].groupPath).toBe("BXAW / Customer Account / Vehicle Group");
    expect(result.devices[0].onlineStatus).toBe("unknown");
    expect(result.devices[0].deviceName).toBe("Van 1");
  });

  it("includes subuser names in readable paths", () => {
    const payload = {
      rootuser: {
        username: "BXAW",
        subusers: [
          {
            username: "Customer Account",
            groups: [{ groupname: "Vehicle Group", devices: [{ deviceid: "99", devicename: "Van" }] }],
          },
        ],
      },
    };
    const result = parseInventoryDeviceTree(payload);
    expect(result.devices[0].groupPath).toBe("BXAW / Customer Account / Vehicle Group");
  });

  it("parses 605 unique inventory devices", () => {
    const result = parseInventoryDeviceTree(build605DeviceTree());
    expect(result.summary.detectedDeviceCount).toBe(605);
    expect(result.summary.uniqueDeviceCount).toBe(605);
    expect(result.summary.duplicateDeviceCount).toBe(0);
    expect(() => validateInventoryDevices(result.devices)).not.toThrow();
  });

  it("rejects duplicate source_device_id values", () => {
    const payload = {
      rootuser: {
        username: "BXAW",
        groups: [
          {
            groupname: "Fleet",
            devices: [
              { deviceid: "860000000000001", devicename: "A" },
              { deviceid: "860000000000001", devicename: "B" },
            ],
          },
        ],
      },
    };
    const result = parseInventoryDeviceTree(payload);
    const dupes = findDuplicateSourceDeviceIds(result.devices);
    expect(dupes).toEqual(["860000000000001"]);
    expect(() => validateInventoryDevices(result.devices, 1)).toThrow(InventoryDuplicateError);
  });

  it("fails validation below 550 unique devices", () => {
    const payload = {
      rootuser: {
        username: "BXAW",
        groups: [{ groupname: "Small", devices: [{ deviceid: "1", devicename: "One" }] }],
      },
    };
    const result = parseInventoryDeviceTree(payload);
    expect(() => validateInventoryDevices(result.devices)).toThrow(InventoryCountError);
  });
});

describe("inventory normalizer", () => {
  it("maps simnum, metadata, and leaves imei unset", () => {
    const device = normalizeInventoryDevice(
      {
        deviceid: "860000000000001",
        devicename: "Unit 1",
        simnum: "966512345678",
        devicetype: 1,
        simiccid: "8944",
        videochannelcount: 2,
        videochannelsetting: "Front,Rear",
        lastactivetime: "2026-06-29T10:00:00.000Z",
        lat: 24.7,
        lon: 46.6,
      },
      "BXAW / Fleet",
    );

    expect(device?.simNo).toBe("966512345678");
    expect(device?.sourceUpdatedAt).toBe("2026-06-29T10:00:00.000Z");
    expect(device?.metadata.devicetype).toBe(1);
    expect(device?.metadata.simiccid).toBe("8944");
    expect(device?.mediaChannels).toHaveLength(2);
    expect(device?.rawSnapshot.lat).toBe(24.7);
    expect(device?.rawSnapshot).not.toHaveProperty("_parseSource");
  });

  it("does not populate source_updated_at from unverified fields", () => {
    const device = normalizeInventoryDevice(
      { deviceid: "1", devicename: "X", updatetime: "2026-01-01T00:00:00Z" },
      null,
    );
    expect(device?.sourceUpdatedAt).toBeNull();
  });

  it("normalizes video channels from count and setting", () => {
    const channels = parseVideoChannels({
      videochannelcount: 3,
      videochannelsetting: "A;B;C",
    });
    expect(channels).toEqual([
      { logicalChannel: "1", name: "A" },
      { logicalChannel: "2", name: "B" },
      { logicalChannel: "3", name: "C" },
    ]);
  });

  it("ignores coordinates for inventory records", () => {
    const payload = {
      rootuser: {
        username: "BXAW",
        groups: [{ groupname: "G", devices: [{ deviceid: "1", devicename: "X", lat: 24.7, lon: 46.6 }] }],
      },
    };
    const result = parseInventoryDeviceTree(payload);
    const upsert = buildInventoryUpsertPayload("org", "acct", result.devices[0], new Date().toISOString());
    expect(upsert.latitude).toBeNull();
    expect(upsert.longitude).toBeNull();
    expect(upsert.imei).toBeNull();
  });
});

describe("inventory upsert classification", () => {
  const incoming: InventoryDeviceRecord = {
    sourceDeviceId: "860000000000001",
    deviceName: "Unit 1",
    simNo: "966500000001",
    groupPath: "BXAW / Fleet",
    onlineStatus: "unknown",
    sourceUpdatedAt: null,
    mediaChannels: [{ logicalChannel: "1", name: "Front" }],
    metadata: { devicetype: 1 },
    rawSnapshot: { deviceid: "860000000000001" },
  };

  it("preserves Birdie links by omitting them from upsert payload", () => {
    const payload = buildInventoryUpsertPayload("org-id", "acct-id", incoming, new Date().toISOString());
    expect(payload).not.toHaveProperty("birdie_device_id");
    expect(payload).not.toHaveProperty("vehicle_id");
    expect(payload).not.toHaveProperty("customer_id");
  });

  it("classifies unchanged rows when comparable fields match", () => {
    const existing: ExistingInventoryDevice = {
      id: "row-1",
      source_device_id: incoming.sourceDeviceId,
      device_name: incoming.deviceName,
      sim_no: incoming.simNo,
      group_path: incoming.groupPath,
      birdie_device_id: "birdie-1",
      vehicle_id: "veh-1",
      customer_id: "cust-1",
      online_status: "unknown",
      source_updated_at: null,
      media_channels: incoming.mediaChannels,
      metadata: incoming.metadata,
      raw_snapshot: incoming.rawSnapshot,
    };

    expect(inventoryRowChanged(existing, incoming)).toBe(false);
    expect(classifyUpsertOutcome(existing, incoming)).toBe("unchanged");
    expect(classifyUpsertOutcome(undefined, incoming)).toBe("inserted");
  });

  it("detects updates when inventory fields change", () => {
    const existing: ExistingInventoryDevice = {
      id: "row-1",
      source_device_id: incoming.sourceDeviceId,
      device_name: "Old Name",
      sim_no: incoming.simNo,
      group_path: incoming.groupPath,
      birdie_device_id: "birdie-1",
      vehicle_id: null,
      customer_id: null,
      online_status: "unknown",
      source_updated_at: null,
      media_channels: [],
      metadata: {},
      raw_snapshot: {},
    };

    expect(classifyUpsertOutcome(existing, incoming)).toBe("updated");
  });
});

describe("alarm vs device inventory", () => {
  it("parses sanitized monitor list fixture for generic discovery scoring", () => {
    const raw = readFileSync(path.join(fixtureDir, "fixtures/monitor-list-sample.json"), "utf8");
    const payload = JSON.parse(raw);
    expect(
      scoreJsonPayload(payload, "https://gps51.com/webapi?action=querymonitorlist"),
    ).toBeGreaterThan(10);
    const devices = parseDevicesFromPayload(payload);
    expect(devices.length).toBe(2);
    expect(devices[0].sourceDeviceId).toBe("860000000000001");
  });

  it("does not treat queryalarm records as canonical device inventory", () => {
    const raw = readFileSync(path.join(fixtureDir, "fixtures/queryalarm-sample.json"), "utf8");
    const payload = JSON.parse(raw);
    const url = "https://gps51.com/webapi?action=queryalarm";

    expect(scoreJsonPayload(payload, url, "queryalarm")).toBeLessThan(0);
    expect(parseDevicesFromPayload(payload, url)).toHaveLength(0);

    const alarms = parseAlarmPayload(payload);
    expect(alarms).toHaveLength(2);
    expect(alarms[0].kind).toBe("alarm");
  });
});
