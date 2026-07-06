import type { BootstrapDeviceRecord } from "./status-bootstrap-parser.js";

export type ScalarFieldEntry = {
  path: string;
  value: string | number | boolean | null;
  valueType: "boolean" | "number" | "string" | "null";
};

export type FieldValueDistribution = Record<string, number>;

export type DeviceFieldProfile = {
  fieldPath: string;
  valueType: "boolean" | "number" | "string" | "null" | "mixed";
  devicesContaining: number;
  nullCount: number;
  distinctValueCount: number;
  valueDistribution: FieldValueDistribution;
};

export type StatusFieldMapping = {
  onlineValues: Set<string>;
  offlineValues: Set<string>;
  label: string;
};

export type FieldStatusCandidate = {
  source: "querydevicestree";
  fieldPath: string;
  mapping: StatusFieldMapping;
  onlineCount: number;
  offlineCount: number;
  unknownCount: number;
  onlineDeviceIds: string[];
  offlineDeviceIds: string[];
  onlineDelta: number;
  offlineDelta: number;
  validated: boolean;
  validationReasons: string[];
};

export const STATUS_FIELD_HINTS = [
  "online",
  "isonline",
  "isOnline",
  "offline",
  "status",
  "devicestatus",
  "deviceStatus",
  "loginstatus",
  "loginStatus",
  "connectstatus",
  "connectionStatus",
  "islogin",
  "isactive",
  "active",
  "state",
  "runstatus",
  "netstatus",
  "heartstatus",
  "acc",
  "accstatus",
] as const;

const EXCLUDED_SINGLE_FIELD_PATHS =
  /(^|\.)(lastactivetime|lastActiveTime|offlinedelay|offlineDelay|offlinedelaytime)$/i;

const ROOT_RESPONSE_ONLY_PATHS = new Set(["code", "msg", "message", "success"]);

export function isDeviceScalarPath(path: string): boolean {
  const leaf = path.split(".").pop()?.replace(/\[\d+\]$/, "") ?? path;
  if (ROOT_RESPONSE_ONLY_PATHS.has(leaf) && !path.includes(".")) return false;
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function classifyScalar(value: unknown): ScalarFieldEntry["valueType"] | null {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number" && Number.isFinite(value)) return "number";
  if (typeof value === "string") return "string";
  return null;
}

function normalizeScalarKey(value: string | number | boolean | null): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  return value.trim().toLowerCase();
}

export function flattenScalarDeviceFields(
  record: Record<string, unknown>,
  prefix = "",
  output: ScalarFieldEntry[] = [],
): ScalarFieldEntry[] {
  for (const [key, value] of Object.entries(record)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const scalarType = classifyScalar(value);
    if (scalarType) {
      output.push({
        path,
        value: value === undefined ? null : (value as string | number | boolean | null),
        valueType: scalarType,
      });
      continue;
    }
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        if (isRecord(item)) flattenScalarDeviceFields(item, `${path}[${i}]`, output);
      }
      continue;
    }
    if (isRecord(value)) {
      flattenScalarDeviceFields(value, path, output);
    }
  }
  return output;
}

export function profileDeviceFields(records: BootstrapDeviceRecord[]): DeviceFieldProfile[] {
  const aggregates = new Map<
    string,
    {
      types: Set<ScalarFieldEntry["valueType"]>;
      nullCount: number;
      values: Map<string, number>;
      devicesContaining: number;
    }
  >();

  for (const record of records) {
    const fields = flattenScalarDeviceFields(record.raw).filter((field) =>
      isDeviceScalarPath(field.path),
    );
    const seenPaths = new Set<string>();

    for (const field of fields) {
      if (!seenPaths.has(field.path)) {
        seenPaths.add(field.path);
        const bucket = aggregates.get(field.path) ?? {
          types: new Set<ScalarFieldEntry["valueType"]>(),
          nullCount: 0,
          values: new Map<string, number>(),
          devicesContaining: 0,
        };
        bucket.devicesContaining += 1;
        bucket.types.add(field.valueType);
        if (field.value === null) bucket.nullCount += 1;
        const key = normalizeScalarKey(field.value);
        bucket.values.set(key, (bucket.values.get(key) ?? 0) + 1);
        aggregates.set(field.path, bucket);
      }
    }
  }

  return [...aggregates.entries()]
    .map(([fieldPath, bucket]) => ({
      fieldPath,
      valueType:
        bucket.types.size === 1
          ? ([...bucket.types][0] ?? "mixed")
          : ("mixed" as DeviceFieldProfile["valueType"]),
      devicesContaining: bucket.devicesContaining,
      nullCount: bucket.nullCount,
      distinctValueCount: bucket.values.size,
      valueDistribution: Object.fromEntries(bucket.values),
    }))
    .sort((a, b) => {
      const aHint = isStatusHintField(a.fieldPath) ? 1 : 0;
      const bHint = isStatusHintField(b.fieldPath) ? 1 : 0;
      if (aHint !== bHint) return bHint - aHint;
      return a.distinctValueCount - b.distinctValueCount;
    });
}

export function isStatusHintField(fieldPath: string): boolean {
  const leaf = fieldPath.split(".").pop()?.replace(/\[\d+\]$/, "") ?? fieldPath;
  const normalized = leaf.toLowerCase();
  return STATUS_FIELD_HINTS.some((hint) => normalized.includes(hint.toLowerCase()));
}

export function isLowCardinalityProfile(profile: DeviceFieldProfile, maxDistinct = 20): boolean {
  return profile.distinctValueCount > 0 && profile.distinctValueCount <= maxDistinct;
}

export function buildMappingVariants(distinctValues: string[]): StatusFieldMapping[] {
  const values = [...new Set(distinctValues.filter((value) => value !== "null"))];
  const mappings: StatusFieldMapping[] = [];

  const onlineTokens = new Set(["true", "1", "online", "on", "yes", "active", "connected", "login"]);
  const offlineTokens = new Set(["false", "0", "offline", "off", "no", "inactive", "disconnected"]);

  mappings.push({
    label: "standard_online_offline",
    onlineValues: onlineTokens,
    offlineValues: offlineTokens,
  });
  mappings.push({
    label: "reversed_online_offline",
    onlineValues: offlineTokens,
    offlineValues: onlineTokens,
  });

  if (values.length === 2) {
    mappings.push({
      label: `pair_${values[0]}_online`,
      onlineValues: new Set([values[0]!]),
      offlineValues: new Set([values[1]!]),
    });
    mappings.push({
      label: `pair_${values[1]}_online`,
      onlineValues: new Set([values[1]!]),
      offlineValues: new Set([values[0]!]),
    });
  }

  return mappings;
}

function resolveFieldValue(
  record: BootstrapDeviceRecord,
  fieldPath: string,
): string | number | boolean | null {
  const parts = fieldPath.split(".");
  let current: unknown = record.raw;
  for (const part of parts) {
    const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);
    if (arrayMatch) {
      const key = arrayMatch[1]!;
      const index = Number(arrayMatch[2]);
      if (!isRecord(current as object)) return null;
      const arr = (current as Record<string, unknown>)[key];
      current = Array.isArray(arr) ? arr[index] : null;
      continue;
    }
    if (!isRecord(current as object)) return null;
    current = (current as Record<string, unknown>)[part];
  }
  const scalarType = classifyScalar(current);
  return scalarType ? (current as string | number | boolean | null) : null;
}

export function evaluateFieldMapping(
  records: BootstrapDeviceRecord[],
  fieldPath: string,
  mapping: StatusFieldMapping,
): {
  onlineDeviceIds: string[];
  offlineDeviceIds: string[];
  unknownCount: number;
} {
  const onlineDeviceIds: string[] = [];
  const offlineDeviceIds: string[] = [];
  let unknownCount = 0;

  for (const record of records) {
    const value = resolveFieldValue(record, fieldPath);
    const key = normalizeScalarKey(value);
    if (mapping.onlineValues.has(key)) onlineDeviceIds.push(record.sourceDeviceId);
    else if (mapping.offlineValues.has(key)) offlineDeviceIds.push(record.sourceDeviceId);
    else unknownCount += 1;
  }

  return {
    onlineDeviceIds: [...new Set(onlineDeviceIds)],
    offlineDeviceIds: [...new Set(offlineDeviceIds)],
    unknownCount,
  };
}

export function discoverFieldCandidates(
  records: BootstrapDeviceRecord[],
  portal: { all: number | null; online: number | null; offline: number | null },
  tolerance = 2,
): FieldStatusCandidate[] {
  const profiles = profileDeviceFields(records);
  const candidates: FieldStatusCandidate[] = [];

  for (const profile of profiles) {
    if (!isLowCardinalityProfile(profile)) continue;
    if (EXCLUDED_SINGLE_FIELD_PATHS.test(profile.fieldPath)) continue;
    if (!isStatusHintField(profile.fieldPath) && profile.distinctValueCount > 6) continue;

    const distinctValues = Object.keys(profile.valueDistribution);
    for (const mapping of buildMappingVariants(distinctValues)) {
      const evaluation = evaluateFieldMapping(records, profile.fieldPath, mapping);
      const onlineCount = evaluation.onlineDeviceIds.length;
      const offlineCount = evaluation.offlineDeviceIds.length;
      const intersection = evaluation.onlineDeviceIds.filter((id) =>
        evaluation.offlineDeviceIds.includes(id),
      );
      const onlineDelta =
        portal.online != null ? Math.abs(onlineCount - portal.online) : Number.MAX_SAFE_INTEGER;
      const offlineDelta =
        portal.offline != null ? Math.abs(offlineCount - portal.offline) : Number.MAX_SAFE_INTEGER;
      const unionCount = new Set([...evaluation.onlineDeviceIds, ...evaluation.offlineDeviceIds]).size;
      const allDelta = portal.all != null ? Math.abs(unionCount - portal.all) : 0;

      const validationReasons: string[] = [];
      if (evaluation.unknownCount > 0) validationReasons.push(`unknown_values_${evaluation.unknownCount}`);
      if (profile.devicesContaining < records.length) {
        validationReasons.push(`missing_field_${records.length - profile.devicesContaining}`);
      }
      if (intersection.length > 0) validationReasons.push(`intersection_${intersection.length}`);
      if (onlineDelta > tolerance) validationReasons.push(`online_delta_${onlineDelta}`);
      if (offlineDelta > tolerance) validationReasons.push(`offline_delta_${offlineDelta}`);
      if (allDelta > tolerance) validationReasons.push(`union_delta_${allDelta}`);

      candidates.push({
        source: "querydevicestree",
        fieldPath: profile.fieldPath,
        mapping,
        onlineCount,
        offlineCount,
        unknownCount: evaluation.unknownCount,
        onlineDeviceIds: evaluation.onlineDeviceIds,
        offlineDeviceIds: evaluation.offlineDeviceIds,
        onlineDelta,
        offlineDelta,
        validated: validationReasons.length === 0,
        validationReasons,
      });
    }
  }

  return candidates.sort((a, b) => {
    if (a.validated !== b.validated) return a.validated ? -1 : 1;
    const aScore = a.onlineDelta + a.offlineDelta;
    const bScore = b.onlineDelta + b.offlineDelta;
    return aScore - bScore;
  });
}

export function pickBestFieldCandidate(
  candidates: FieldStatusCandidate[],
): FieldStatusCandidate | null {
  return candidates.find((candidate) => candidate.validated) ?? candidates[0] ?? null;
}
