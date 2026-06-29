export type ParsedGps51Fields = {
  deviceId: string | null;
  latitude: number | null;
  longitude: number | null;
  speedKmh: number | null;
  recordedAt: string | null;
  address: string | null;
  gpsStatus: string | null;
};

const EMPTY_FIELDS: ParsedGps51Fields = {
  deviceId: null,
  latitude: null,
  longitude: null,
  speedKmh: null,
  recordedAt: null,
  address: null,
  gpsStatus: null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (value == null || value === "") continue;
    if (typeof value === "object") continue;
    return String(value).trim();
  }
  return null;
}

function pickNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (value == null || value === "") continue;
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(parsed)) continue;
    return parsed;
  }
  return null;
}

function normalizeSpeedToKmh(record: Record<string, unknown>, speed: number | null): number | null {
  if (speed == null) return null;

  const unit = pickString(record, ["speedUnit", "speed_unit", "unit"])?.toLowerCase();
  if (unit === "m/s" || unit === "mps") return speed * 3.6;
  if (unit === "kn" || unit === "knot" || unit === "knots") return speed * 1.852;

  return speed;
}

function parseTimestamp(record: Record<string, unknown>): string | null {
  const raw = pickString(record, [
    "time",
    "gpstime",
    "gpsTime",
    "updateTime",
    "locateTime",
    "timestamp",
    "recorded_at",
    "recordTime",
    "datetime",
    "dateTime",
    "devicetime",
    "deviceTime",
  ]);

  if (!raw) {
    const epoch = pickNumber(record, [
      "time",
      "timestamp",
      "gpstime",
      "gpsTime",
      "updateTime",
      "locateTime",
      "deviceTime",
    ]);
    if (epoch != null) {
      const ms = epoch > 1_000_000_000_000 ? epoch : epoch * 1000;
      const date = new Date(ms);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
    return null;
  }

  const numeric = Number(raw);
  if (Number.isFinite(numeric) && raw.trim() === String(numeric)) {
    const ms = numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
    const date = new Date(ms);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  return null;
}

function parseFieldsFromRecord(record: Record<string, unknown>): ParsedGps51Fields {
  const deviceId = pickString(record, [
    "deviceId",
    "device_id",
    "device",
    "deviceid",
    "imei",
    "terminalId",
    "terminal_id",
    "gpsId",
    "gps_id",
    "devId",
    "dev_id",
    "id",
  ]);

  const latitude = pickNumber(record, ["latitude", "lat", "Latitude", "LAT"]);
  const longitude = pickNumber(record, ["longitude", "lng", "lon", "Longitude", "LNG", "LON"]);
  const rawSpeed = pickNumber(record, ["speed", "speed_kmh", "speedKmh", "spd", "velocity"]);

  return {
    deviceId,
    latitude,
    longitude,
    speedKmh: normalizeSpeedToKmh(record, rawSpeed),
    recordedAt: parseTimestamp(record),
    address: pickString(record, ["address", "addr", "locationAddress", "formattedAddress"]),
    gpsStatus: pickString(record, ["status", "state", "accStatus", "onlineStatus"]),
  };
}

function normalizePayloadRecords(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord);
  }

  if (!isRecord(payload)) return [];

  const nestedKeys = ["data", "payload", "location", "gps", "point", "message", "body"];
  for (const key of nestedKeys) {
    const nested = payload[key];
    if (Array.isArray(nested)) {
      return nested.filter(isRecord);
    }
    if (isRecord(nested)) {
      return [nested];
    }
  }

  return [payload];
}

export function parseGps51PayloadFields(payload: unknown): ParsedGps51Fields {
  const records = normalizePayloadRecords(payload);
  if (!records.length) return { ...EMPTY_FIELDS };
  return parseFieldsFromRecord(records[0]);
}

export function parseGps51LocationRecords(payload: unknown): ParsedGps51Fields[] {
  return normalizePayloadRecords(payload)
    .map(parseFieldsFromRecord)
    .filter(
      (fields) =>
        Boolean(fields.deviceId) && fields.latitude != null && fields.longitude != null
    );
}

export function fieldsToLogSummary(fields: ParsedGps51Fields) {
  return {
    parsed_device_id: fields.deviceId,
    parsed_latitude: fields.latitude,
    parsed_longitude: fields.longitude,
    parsed_speed_kmh: fields.speedKmh,
    parsed_address: fields.address,
    parsed_gps_status: fields.gpsStatus,
  };
}

export function hasAnyParsedFields(fields: ParsedGps51Fields): boolean {
  return Boolean(
    fields.deviceId ||
      fields.latitude != null ||
      fields.longitude != null ||
      fields.speedKmh != null ||
      fields.recordedAt ||
      fields.address ||
      fields.gpsStatus
  );
}
