import { createHash } from "node:crypto";
import { parseEpochMilliseconds } from "./position-last-parser.js";
export const GPS51_MAP_CACHE_SOURCE = "GPS51 Web Map Cache";
export function buildCachePositionFingerprint(organizationId, gps51DeviceId, position) {
    const gpsMs = parseEpochMilliseconds(position.sourceLocatedAt) ??
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
export function buildCacheDedupeKey(organizationId, gps51DeviceId, position) {
    if (position.sourcePositionId != null) {
        return `${gps51DeviceId}:id:${position.sourcePositionId}:${position.sourceUpdatedAt}`;
    }
    return `${gps51DeviceId}:fp:${buildCachePositionFingerprint(organizationId, gps51DeviceId, position)}`;
}
export function isDuplicateCachePosition(seenKeys, organizationId, gps51DeviceId, position) {
    const key = buildCacheDedupeKey(organizationId, gps51DeviceId, position);
    if (seenKeys.has(key))
        return true;
    seenKeys.add(key);
    return false;
}
export function positionTimestampMs(position) {
    return (parseEpochMilliseconds(position.sourceLocatedAt) ??
        parseEpochMilliseconds(position.sourceUpdatedAt) ??
        0);
}
export function isStaleCachePosition(position, storedLatestMs) {
    if (storedLatestMs == null)
        return false;
    const incomingMs = positionTimestampMs(position);
    if (incomingMs <= 0)
        return true;
    return incomingMs <= storedLatestMs;
}
