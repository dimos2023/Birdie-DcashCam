import { parseEpochMilliseconds } from "./position-last-parser.js";
const DEFAULT_MAX_FUTURE_MS = 10 * 60 * 1000;
export function validatePositionLast(position, ctx) {
    const nowMs = ctx.nowMs ?? Date.now();
    const maxFutureMs = ctx.maxFutureMs ?? DEFAULT_MAX_FUTURE_MS;
    if (!ctx.knownDeviceIds.has(position.sourceDeviceId)) {
        return { ok: false, reason: "unknown device" };
    }
    if (position.latitude < -90 || position.latitude > 90) {
        return { ok: false, reason: "latitude out of range" };
    }
    if (position.longitude < -180 || position.longitude > 180) {
        return { ok: false, reason: "longitude out of range" };
    }
    if (position.latitude === 0 && position.longitude === 0) {
        return { ok: false, reason: "zero coordinates" };
    }
    const updatedMs = parseEpochMilliseconds(position.sourceUpdatedAt);
    if (updatedMs == null) {
        return { ok: false, reason: "invalid source_updated_at" };
    }
    if (updatedMs > nowMs + maxFutureMs) {
        return { ok: false, reason: "timestamp too far in future" };
    }
    const storedLatest = ctx.latestSourceUpdatedAtMs.get(position.sourceDeviceId);
    if (storedLatest != null && updatedMs <= storedLatest) {
        return { ok: false, reason: "stale source update" };
    }
    return { ok: true, position };
}
export function isDuplicatePositionId(seenKeys, position) {
    if (position.sourcePositionId == null)
        return false;
    const key = `${position.sourceDeviceId}:${position.sourcePositionId}:${position.sourceUpdatedAt}`;
    if (seenKeys.has(key))
        return true;
    seenKeys.add(key);
    return false;
}
