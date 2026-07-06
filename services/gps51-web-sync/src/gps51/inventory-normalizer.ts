import { redactSecrets } from "../browser/redaction.js";
import type {
  InventoryDeviceMetadata,
  InventoryDeviceRecord,
  InventoryMediaChannel,
} from "./inventory-types.js";

const METADATA_KEYS = [
  "devicetype",
  "simiccid",
  "icon",
  "overduetime",
  "isfree",
  "stared",
  "creater",
  "createtime",
  "forwardid",
  "remark",
  "remark2",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    for (const candidate of [key, key.toLowerCase()]) {
      const val = record[candidate];
      if (val != null && typeof val !== "object") {
        const s = String(val).trim();
        if (s) return s;
      }
    }
  }
  return null;
}

function pickNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    for (const candidate of [record[key], record[key.toLowerCase()]]) {
      if (candidate == null || candidate === "") continue;
      const n = typeof candidate === "number" ? candidate : Number(candidate);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

export function pickInventorySourceDeviceId(record: Record<string, unknown>): string | null {
  return pickString(record, ["deviceid", "deviceId", "device_id"]);
}

export function parseLastActiveTime(record: Record<string, unknown>): string | null {
  const raw = pickString(record, ["lastactivetime", "lastActiveTime"]);
  if (!raw) return null;

  const numeric = Number(raw);
  if (Number.isFinite(numeric) && raw.trim() === String(numeric)) {
    const ms = numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function parseVideoChannels(record: Record<string, unknown>): InventoryMediaChannel[] {
  const count =
    pickNumber(record, ["videochannelcount", "videoChannelCount", "video_channel_count"]) ?? 0;
  const setting = record.videochannelsetting ?? record.videoChannelSetting ?? record.video_channel_setting;

  let names: string[] = [];
  if (typeof setting === "string") {
    names = setting
      .split(/[,|;]/)
      .map((part) => part.trim())
      .filter(Boolean);
  } else if (Array.isArray(setting)) {
    names = setting.map((item) => String(item).trim()).filter(Boolean);
  } else if (isRecord(setting)) {
    names = Object.values(setting).map((item) => String(item).trim()).filter(Boolean);
  }

  const total = Math.max(count, names.length);
  if (total <= 0) return [];

  const channels: InventoryMediaChannel[] = [];
  for (let i = 0; i < total; i++) {
    channels.push({
      logicalChannel: String(i + 1),
      name: names[i] ?? null,
    });
  }
  return channels;
}

export function extractInventoryMetadata(record: Record<string, unknown>): InventoryDeviceMetadata {
  const metadata: InventoryDeviceMetadata = {};
  for (const key of METADATA_KEYS) {
    for (const candidate of [key, key.toLowerCase()]) {
      const val = record[candidate];
      if (val !== undefined && val !== null && val !== "") {
        metadata[key] = val;
        break;
      }
    }
  }
  return metadata;
}

export function sanitizeDeviceSnapshot(record: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...record };
  delete copy._parseSource;
  return redactSecrets(copy) as Record<string, unknown>;
}

export function normalizeInventoryDevice(
  record: Record<string, unknown>,
  groupPath: string | null,
): InventoryDeviceRecord | null {
  const sourceDeviceId = pickInventorySourceDeviceId(record);
  if (!sourceDeviceId) return null;

  return {
    sourceDeviceId,
    deviceName: pickString(record, ["devicename", "deviceName", "device_name", "name"]),
    simNo: pickString(record, ["simnum", "simNum", "sim_num"]),
    groupPath,
    onlineStatus: "unknown",
    sourceUpdatedAt: parseLastActiveTime(record),
    mediaChannels: parseVideoChannels(record),
    metadata: extractInventoryMetadata(record),
    rawSnapshot: sanitizeDeviceSnapshot(record),
  };
}

export function countInventoryStats(devices: InventoryDeviceRecord[]): {
  devicesWithSimNo: number;
  devicesWithVideo: number;
  devicesWithMissingIdentifier: number;
} {
  return {
    devicesWithSimNo: devices.filter((d) => Boolean(d.simNo)).length,
    devicesWithVideo: devices.filter((d) => d.mediaChannels.length > 0).length,
    devicesWithMissingIdentifier: devices.filter((d) => !d.sourceDeviceId).length,
  };
}
