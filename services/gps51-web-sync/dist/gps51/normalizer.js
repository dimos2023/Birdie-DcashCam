import { DEVICE_ID_KEYS, STATUS_KEYS } from "./selectors.js";
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function pickString(record, keys) {
    for (const key of keys) {
        const direct = record[key];
        if (direct != null && typeof direct !== "object") {
            const s = String(direct).trim();
            if (s)
                return s;
        }
        const lower = record[key.toLowerCase()];
        if (lower != null && typeof lower !== "object") {
            const s = String(lower).trim();
            if (s)
                return s;
        }
    }
    return null;
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
function parseOnlineStatus(record) {
    for (const key of STATUS_KEYS) {
        const val = record[key] ?? record[key.toLowerCase()];
        if (val === true || val === 1 || val === "1" || val === "online")
            return "online";
        if (val === false || val === 0 || val === "0" || val === "offline")
            return "offline";
    }
    return "unknown";
}
function parseTimestamp(record) {
    const raw = pickString(record, [
        "gpstime",
        "gpsTime",
        "updatetime",
        "updateTime",
        "locatetime",
        "locateTime",
        "devicetime",
        "deviceTime",
        "time",
        "timestamp",
    ]);
    if (!raw) {
        const epoch = pickNumber(record, ["gpstime", "time", "timestamp"]);
        if (epoch != null) {
            const ms = epoch > 1_000_000_000_000 ? epoch : epoch * 1000;
            const d = new Date(ms);
            if (!Number.isNaN(d.getTime()))
                return d.toISOString();
        }
        return null;
    }
    const numeric = Number(raw);
    if (Number.isFinite(numeric) && raw.trim() === String(numeric)) {
        const ms = numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
        const d = new Date(ms);
        if (!Number.isNaN(d.getTime()))
            return d.toISOString();
    }
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
function validCoordinate(lat, lng) {
    if (lat == null || lng == null)
        return false;
    if (lat === 0 && lng === 0)
        return false;
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}
export function normalizeDeviceRecord(record, source) {
    const sourceDeviceId = pickString(record, DEVICE_ID_KEYS) ?? pickString(record, ["sim", "simno", "sim_no"]) ?? "unknown";
    let latitude = pickNumber(record, ["latitude", "lat", "callat", "calLat"]);
    let longitude = pickNumber(record, ["longitude", "lng", "lon", "callon", "calLon"]);
    if (latitude != null && Math.abs(latitude) > 90) {
        latitude = latitude / 1_000_000;
    }
    if (longitude != null && Math.abs(longitude) > 180) {
        longitude = longitude / 1_000_000;
    }
    if (!validCoordinate(latitude, longitude)) {
        latitude = null;
        longitude = null;
    }
    const speedRaw = pickNumber(record, ["speed", "speed_kmh", "speedKmh", "spd"]);
    const accRaw = record.acc ?? record.accstatus ?? record.acc_on;
    let accOn = null;
    if (accRaw === 1 || accRaw === true || accRaw === "1")
        accOn = true;
    if (accRaw === 0 || accRaw === false || accRaw === "0")
        accOn = false;
    const updatedAt = parseTimestamp(record);
    return {
        sourceDeviceId,
        deviceName: pickString(record, ["devicename", "deviceName", "name", "carno", "plate", "plateNumber"]),
        imei: pickString(record, ["imei", "IMEI"]),
        simNo: pickString(record, ["sim", "simno", "sim_no", "simcard"]),
        groupPath: pickString(record, ["group", "groupname", "group_path", "groupPath"]),
        onlineStatus: parseOnlineStatus(record),
        sourceUpdatedAt: updatedAt,
        sourceLocatedAt: pickString(record, ["locatetime", "locateTime"]) ? updatedAt : updatedAt,
        latitude,
        longitude,
        speedKmh: speedRaw,
        accOn,
        statusText: pickString(record, ["status", "statustext", "state"]),
        address: pickString(record, ["address", "addr", "formattedAddress"]),
        satelliteCount: pickNumber(record, ["satellite", "satellites", "satcount", "gnss"]),
        cellularSignalPercent: pickNumber(record, ["signal", "gsm", "csq", "signalpercent"]),
        mileageKm: pickNumber(record, ["mileage", "mileage_km", "totaldistance"]),
        mediaChannels: [],
        raw: { ...record, _parseSource: source },
    };
}
export function dedupeDevices(devices) {
    const map = new Map();
    for (const device of devices) {
        const key = device.imei ?? device.sourceDeviceId;
        const existing = map.get(key);
        if (!existing) {
            map.set(key, device);
            continue;
        }
        if ((device.latitude != null && existing.latitude == null) || (device.sourceUpdatedAt && !existing.sourceUpdatedAt)) {
            map.set(key, device);
        }
    }
    return [...map.values()];
}
export function collectRecordArrays(payload) {
    const results = [];
    function walk(value, depth = 0) {
        if (depth > 6 || value == null)
            return;
        if (Array.isArray(value)) {
            if (value.length > 0 && isRecord(value[0])) {
                results.push(...value.filter(isRecord));
            }
            for (const item of value)
                walk(item, depth + 1);
            return;
        }
        if (!isRecord(value))
            return;
        for (const nested of Object.values(value))
            walk(nested, depth + 1);
    }
    walk(payload);
    return results;
}
