const RAW_ONLY_FIELDS = [
    "mileage",
    "totaldistance",
    "parktime",
    "parkduration",
    "accswitchtime",
    "accduration",
];
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function pickNumber(record, keys) {
    for (const key of keys) {
        for (const candidate of [record[key], record[key.toLowerCase()]]) {
            if (candidate == null || candidate === "")
                continue;
            const n = typeof candidate === "number" ? candidate : Number(candidate);
            if (Number.isFinite(n))
                return n;
        }
    }
    return null;
}
function pickString(record, keys) {
    for (const key of keys) {
        for (const candidate of [record[key], record[key.toLowerCase()]]) {
            if (candidate != null && typeof candidate !== "object") {
                const s = String(candidate).trim();
                if (s)
                    return s;
            }
        }
    }
    return null;
}
export function parseEpochMilliseconds(value) {
    if (value == null || value === "")
        return null;
    if (typeof value === "string" && /[-T:]/.test(value)) {
        const parsed = Date.parse(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n))
        return null;
    if (n <= 0)
        return null;
    return n > 1_000_000_000_000 ? n : n * 1000;
}
export function parseCoordinatePair(latRaw, lngRaw) {
    if (latRaw == null || lngRaw == null)
        return null;
    let latitude = latRaw;
    let longitude = lngRaw;
    if (Math.abs(latitude) > 90)
        latitude /= 1_000_000;
    if (Math.abs(longitude) > 180)
        longitude /= 1_000_000;
    if (latitude === 0 && longitude === 0)
        return null;
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180)
        return null;
    return { latitude, longitude };
}
export function deriveAccOn(statusBits, statusText) {
    const accFromBit = statusBits != null ? (statusBits & 1) === 1 : null;
    let accFromText = null;
    const text = statusText?.trim() ?? "";
    if (text.startsWith("ACC On"))
        accFromText = true;
    else if (text.startsWith("ACC Off"))
        accFromText = false;
    const accTextMismatch = accFromBit != null && accFromText != null && accFromBit !== accFromText;
    return { accOn: accFromBit, accTextMismatch };
}
export function derivePositioned(statusBits, hasValidCoords) {
    if (!hasValidCoords)
        return false;
    if (statusBits == null)
        return hasValidCoords;
    return (statusBits & 2) === 2;
}
function resolveTimestamp(record) {
    return (parseEpochMilliseconds(record.validpoistiontime ?? record.validPoistionTime) ??
        parseEpochMilliseconds(record.updatetime ?? record.updateTime) ??
        parseEpochMilliseconds(record.arrivedtime ?? record.arrivedTime));
}
function buildSanitizedRaw(record, accTextMismatch) {
    const raw = {};
    for (const [key, value] of Object.entries(record)) {
        raw[key] = value;
    }
    for (const key of RAW_ONLY_FIELDS) {
        if (record[key] != null)
            raw[key] = record[key];
    }
    if (accTextMismatch) {
        raw._metadata = { acc_text_mismatch: true };
    }
    return raw;
}
export function parsePositionLast(value) {
    if (!isRecord(value)) {
        return { ok: false, reason: "positionLast is not an object" };
    }
    const sourceDeviceId = pickString(value, ["deviceid", "deviceId", "device_id"]);
    if (!sourceDeviceId) {
        return { ok: false, reason: "missing deviceid" };
    }
    const coords = parseCoordinatePair(pickNumber(value, ["callat", "calLat", "lat", "latitude"]), pickNumber(value, ["callon", "calLon", "lng", "lon", "longitude"]));
    if (!coords) {
        return { ok: false, reason: "invalid coordinates" };
    }
    const updatedMs = parseEpochMilliseconds(value.updatetime ?? value.updateTime);
    if (updatedMs == null) {
        return { ok: false, reason: "missing or invalid updatetime" };
    }
    const locatedMs = parseEpochMilliseconds(value.validpoistiontime ?? value.validPoistionTime) ??
        updatedMs;
    const statusBits = pickNumber(value, ["status"]);
    const statusText = pickString(value, ["strstatusen", "strStatusEn", "status_text"]);
    const { accOn, accTextMismatch } = deriveAccOn(statusBits, statusText);
    const speedKmh = pickNumber(value, ["speed", "speed_kmh"]);
    const movingFlag = pickNumber(value, ["moving"]);
    const moving = movingFlag === 1 || (speedKmh != null && speedKmh > 0);
    const rxlevel = pickNumber(value, ["rxlevel", "rxLevel"]);
    const signalStrength = rxlevel != null && rxlevel >= 0 && rxlevel <= 100 ? rxlevel : null;
    const gpsvalidnum = pickNumber(value, ["gpsvalidnum", "gpsValidNum"]);
    const satelliteCount = gpsvalidnum != null && gpsvalidnum >= 0 ? gpsvalidnum : null;
    const positioned = derivePositioned(statusBits, true);
    return {
        ok: true,
        position: {
            sourceDeviceId,
            sourcePositionId: pickNumber(value, ["positionlastid", "positionLastId"]),
            latitude: coords.latitude,
            longitude: coords.longitude,
            sourceUpdatedAt: new Date(updatedMs).toISOString(),
            sourceLocatedAt: new Date(locatedMs).toISOString(),
            speedKmh,
            directionDeg: pickNumber(value, ["course", "direction_deg"]),
            altitudeM: pickNumber(value, ["altitude", "altitude_m"]),
            statusBits,
            alarmBits: pickNumber(value, ["alarm", "alarm_bits"]),
            statusText,
            signalStrength,
            satelliteCount,
            moving,
            accOn,
            positioned,
            rawPayload: buildSanitizedRaw(value, accTextMismatch),
            accTextMismatch,
        },
    };
}
export function parseWebsocketMessage(payload) {
    if (!isRecord(payload))
        return { kind: "ignored", data: null };
    if (payload.positionLast != null)
        return { kind: "positionLast", data: payload.positionLast };
    if (payload.remindMsg != null)
        return { kind: "remindMsg", data: payload.remindMsg };
    return { kind: "ignored", data: null };
}
export function extractRemindMsgLogFields(value) {
    if (!isRecord(value))
        return { deviceId: null, alarmCode: null };
    return {
        deviceId: pickString(value, ["deviceid", "deviceId"]),
        alarmCode: pickString(value, ["alarmtype", "alarmType", "alarm", "code", "type"]),
    };
}
