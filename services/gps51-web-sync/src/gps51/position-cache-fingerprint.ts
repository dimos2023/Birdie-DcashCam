import { createHash } from "node:crypto";
import type { ParsedPositionLast } from "./position-last-parser.js";
import { parseEpochMilliseconds } from "./position-last-parser.js";

export const GPS51_MAP_CACHE_SOURCE = "GPS51 Web Map Cache";

export function buildCachePositionFingerprint(
  organizationId: string,
  gps51DeviceId: string,
  position: ParsedPositionLast,
): string {
  const gpsMs =
    parseEpochMilliseconds(position.sourceLocatedAt) ??
    parseEpochMilliseconds(position.sourceUpdatedAt) ??
    0;
  const payload = [
    organizationId,
    gps51DeviceId,
    String(gpsMs),
    position.latitude.toFixed(6),
    position.longitude.toFixed(6),
    position.speedKmh != null ? position.speedKmh.toFixed(2) : "-1",
  ].join("|");
  return createHash("sha256").update(payload).digest("hex");
}

export function buildCacheDedupeKey(
  organizationId: string,
  gps51DeviceId: string,
  position: ParsedPositionLast,
): string {
  if (position.sourcePositionId != null) {
    return `${gps51DeviceId}:id:${position.sourcePositionId}:${position.sourceUpdatedAt}`;
  }
  return `${gps51DeviceId}:fp:${buildCachePositionFingerprint(organizationId, gps51DeviceId, position)}`;
}

export function isDuplicateCachePosition(
  seenKeys: Set<string>,
  organizationId: string,
  gps51DeviceId: string,
  position: ParsedPositionLast,
): boolean {
  const key = buildCacheDedupeKey(organizationId, gps51DeviceId, position);
  if (seenKeys.has(key)) return true;
  seenKeys.add(key);
  return false;
}

export function positionTimestampMs(position: ParsedPositionLast): number {
  return (
    parseEpochMilliseconds(position.sourceLocatedAt) ??
    parseEpochMilliseconds(position.sourceUpdatedAt) ??
    0
  );
}

export function isStaleCachePosition(
  position: ParsedPositionLast,
  storedLatestMs: number | null | undefined,
): boolean {
  if (storedLatestMs == null) return false;
  const incomingMs = positionTimestampMs(position);
  if (incomingMs <= 0) return true;
  return incomingMs <= storedLatestMs;
}
