import { formatDistanceToNow } from "date-fns";
import type { Gps51WebDeviceLive } from "@/lib/types";

export type Gps51DisplayStatus = "online" | "offline" | "unknown" | "stale";

export const GPS51_SOURCE_LABEL = "GPS51 Web";
export const RECENTLY_UPDATED_MS = 10 * 60 * 1000;
export const PAGE_SIZE = 50;

export function hasValidCoordinates(
  device: Pick<Gps51WebDeviceLive, "latitude" | "longitude">
): boolean {
  if (device.latitude == null || device.longitude == null) return false;
  if (device.latitude === 0 && device.longitude === 0) return false;
  return (
    device.latitude >= -90 &&
    device.latitude <= 90 &&
    device.longitude >= -180 &&
    device.longitude <= 180
  );
}

export function parseTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

export function isRecentlySeen(device: Gps51WebDeviceLive, nowMs = Date.now()): boolean {
  const seen = parseTimestamp(device.last_seen_at) ?? parseTimestamp(device.received_at);
  if (seen == null) return false;
  return nowMs - seen <= RECENTLY_UPDATED_MS;
}

export function getDisplayStatus(device: Gps51WebDeviceLive, nowMs = Date.now()): Gps51DisplayStatus {
  const base = device.online_status;
  if (base === "unknown") return "unknown";
  if (base === "offline") return "offline";
  if (base === "online" && !isRecentlySeen(device, nowMs)) return "stale";
  return "online";
}

export function formatRelativeTime(value: string | null | undefined): string {
  const ms = parseTimestamp(value);
  if (ms == null) return "—";
  return formatDistanceToNow(new Date(ms), { addSuffix: true });
}

export function formatExactTime(value: string | null | undefined): string {
  const ms = parseTimestamp(value);
  if (ms == null) return "No timestamp";
  return new Date(ms).toLocaleString();
}

export function formatCoordinates(
  latitude: number | null,
  longitude: number | null
): string {
  if (!hasValidCoordinates({ latitude, longitude })) return "—";
  return `${latitude!.toFixed(5)}, ${longitude!.toFixed(5)}`;
}

export function googleMapsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

export type Gps51FleetFilters = {
  search: string;
  status: "all" | Gps51DisplayStatus;
  group: string;
  hasPosition: "all" | "yes" | "no";
  acc: "all" | "on" | "off";
  recentlyUpdated: boolean;
};

export const DEFAULT_GPS51_FILTERS: Gps51FleetFilters = {
  search: "",
  status: "all",
  group: "all",
  hasPosition: "all",
  acc: "all",
  recentlyUpdated: false,
};

export function collectGroupPaths(devices: Gps51WebDeviceLive[]): string[] {
  const groups = new Set<string>();
  for (const device of devices) {
    if (device.group_path?.trim()) groups.add(device.group_path.trim());
  }
  return [...groups].sort((a, b) => a.localeCompare(b));
}

export function filterGps51Devices(
  devices: Gps51WebDeviceLive[],
  filters: Gps51FleetFilters,
  nowMs = Date.now()
): Gps51WebDeviceLive[] {
  const search = filters.search.trim().toLowerCase();

  return devices.filter((device) => {
    if (search) {
      const name = device.device_name?.toLowerCase() ?? "";
      const id = device.source_device_id.toLowerCase();
      if (!name.includes(search) && !id.includes(search)) return false;
    }

    if (filters.status !== "all") {
      if (getDisplayStatus(device, nowMs) !== filters.status) return false;
    }

    if (filters.group !== "all") {
      if ((device.group_path ?? "").trim() !== filters.group) return false;
    }

    if (filters.hasPosition === "yes" && !hasValidCoordinates(device)) return false;
    if (filters.hasPosition === "no" && hasValidCoordinates(device)) return false;

    if (filters.acc === "on" && device.acc_on !== true) return false;
    if (filters.acc === "off" && device.acc_on !== false) return false;

    if (filters.recentlyUpdated && !isRecentlySeen(device, nowMs)) return false;

    return true;
  });
}

export type Gps51FleetSummary = {
  total: number;
  online: number;
  offline: number;
  unknown: number;
  withPosition: number;
  seenRecently: number;
};

export function computeFleetSummary(
  devices: Gps51WebDeviceLive[],
  nowMs = Date.now()
): Gps51FleetSummary {
  let online = 0;
  let offline = 0;
  let unknown = 0;
  let withPosition = 0;
  let seenRecently = 0;

  for (const device of devices) {
    const status = getDisplayStatus(device, nowMs);
    if (status === "online" || status === "stale") online += 1;
    else if (status === "offline") offline += 1;
    else unknown += 1;

    if (hasValidCoordinates(device)) withPosition += 1;
    if (isRecentlySeen(device, nowMs)) seenRecently += 1;
  }

  return {
    total: devices.length,
    online,
    offline,
    unknown,
    withPosition,
    seenRecently,
  };
}

export function statusBadgeClass(status: Gps51DisplayStatus): string {
  switch (status) {
    case "online":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "offline":
      return "bg-red-100 text-red-800 border-red-200";
    case "stale":
      return "bg-amber-100 text-amber-900 border-amber-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

export function statusLabel(status: Gps51DisplayStatus): string {
  switch (status) {
    case "online":
      return "Online";
    case "offline":
      return "Offline";
    case "stale":
      return "Stale";
    default:
      return "Unknown";
  }
}

export function markerColor(status: Gps51DisplayStatus): string {
  switch (status) {
    case "online":
      return "#22c55e";
    case "offline":
      return "#ef4444";
    case "stale":
      return "#f59e0b";
    default:
      return "#9ca3af";
  }
}
