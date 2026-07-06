export const LIVE_DEVICE_ID_KEYS = [
    "deviceid",
    "deviceId",
    "device_id",
    "imei",
    "deviceno",
    "deviceNo",
    "terminalno",
    "simnum",
    "simNum",
    "sim_num",
];
export const LIVE_LATITUDE_KEYS = ["lat", "latitude", "glat", "callat", "calLat"];
export const LIVE_LONGITUDE_KEYS = ["lng", "lon", "longitude", "glng", "callon", "calLon"];
export const LIVE_SPEED_KEYS = ["speed", "speed_kmh", "speedKmh", "spd"];
export const LIVE_ONLINE_KEYS = ["online", "isonline", "isOnline", "device_status", "status"];
export const LIVE_ACC_KEYS = ["acc", "accstatus", "acc_on", "accStatus"];
export const LIVE_TIMESTAMP_KEYS = [
    "updatetime",
    "updateTime",
    "locatedtime",
    "locateTime",
    "lastactivetime",
    "lastActiveTime",
    "gpstime",
    "gpsTime",
    "devicetime",
    "time",
    "timestamp",
];
export const LIVE_ADDRESS_KEYS = ["address", "addr", "formattedAddress"];
export const ALARM_URL_HINTS = ["queryalarm", "alarm", "alert"];
export const PLAYBACK_URL_HINTS = ["playback", "trackhistory", "history", "replay", "recordfile"];
export function pickLiveField(record, keys) {
    for (const key of keys) {
        for (const candidate of [key, key.toLowerCase()]) {
            const val = record[candidate];
            if (val != null && typeof val !== "object") {
                const s = String(val).trim();
                if (s)
                    return s;
            }
        }
    }
    return null;
}
export function recordHasFieldGroup(record, group) {
    switch (group) {
        case "deviceId":
            return pickLiveField(record, LIVE_DEVICE_ID_KEYS) != null;
        case "latitude":
            return pickLiveField(record, LIVE_LATITUDE_KEYS) != null;
        case "longitude":
            return pickLiveField(record, LIVE_LONGITUDE_KEYS) != null;
        case "speed":
            return pickLiveField(record, LIVE_SPEED_KEYS) != null;
        case "online":
            return pickLiveField(record, LIVE_ONLINE_KEYS) != null;
        case "acc":
            return pickLiveField(record, LIVE_ACC_KEYS) != null;
        case "timestamp":
            return pickLiveField(record, LIVE_TIMESTAMP_KEYS) != null;
        case "address":
            return pickLiveField(record, LIVE_ADDRESS_KEYS) != null;
        default:
            return false;
    }
}
export function extractLiveDeviceId(record) {
    return pickLiveField(record, LIVE_DEVICE_ID_KEYS);
}
export function recordHasCoordinates(record) {
    const latRaw = pickLiveField(record, LIVE_LATITUDE_KEYS);
    const lngRaw = pickLiveField(record, LIVE_LONGITUDE_KEYS);
    if (latRaw == null || lngRaw == null)
        return false;
    let lat = Number(latRaw);
    let lng = Number(lngRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lng))
        return false;
    if (Math.abs(lat) > 90)
        lat /= 1_000_000;
    if (Math.abs(lng) > 180)
        lng /= 1_000_000;
    if (lat === 0 && lng === 0)
        return false;
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}
export function parseLiveTimestamp(record) {
    const raw = pickLiveField(record, LIVE_TIMESTAMP_KEYS);
    if (!raw)
        return null;
    const numeric = Number(raw);
    if (Number.isFinite(numeric) && raw.trim() === String(numeric)) {
        const ms = numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
        const d = new Date(ms);
        return Number.isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
}
export function incrementFieldFrequency(target, record) {
    for (const key of Object.keys(record)) {
        target[key] = (target[key] ?? 0) + 1;
    }
}
