import type { ParsedPositionLast } from "./position-last-parser.js";
import { parseEpochMilliseconds } from "./position-last-parser.js";

export type CachePositionValidationResult =
  | { ok: true; position: ParsedPositionLast }
  | { ok: false; reason: string };

export function validateCachePositionCoordinates(
  position: ParsedPositionLast,
  inventoryIds: Set<string>,
): CachePositionValidationResult {
  if (!inventoryIds.has(position.sourceDeviceId)) {
    return { ok: false, reason: "unknown_device" };
  }
  if (position.latitude < -90 || position.latitude > 90) {
    return { ok: false, reason: "latitude_out_of_range" };
  }
  if (position.longitude < -180 || position.longitude > 180) {
    return { ok: false, reason: "longitude_out_of_range" };
  }
  if (position.latitude === 0 && position.longitude === 0) {
    return { ok: false, reason: "zero_coordinates" };
  }

  const updatedMs = parseEpochMilliseconds(position.sourceUpdatedAt);
  if (updatedMs == null) {
    return { ok: false, reason: "invalid_update_timestamp" };
  }

  const locatedMs = parseEpochMilliseconds(position.sourceLocatedAt);
  if (locatedMs != null && !Number.isFinite(locatedMs)) {
    return { ok: false, reason: "invalid_gps_timestamp" };
  }

  return { ok: true, position };
}
