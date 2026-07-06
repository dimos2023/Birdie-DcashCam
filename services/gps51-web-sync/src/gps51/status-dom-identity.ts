import type { BootstrapDeviceRecord } from "./status-bootstrap-parser.js";

export type InventoryDeviceEntry = {
  sourceDeviceId: string;
  deviceName: string | null;
  deviceNameNormalized: string;
  groupPath: string | null;
  groupPathNormalized: string;
};

export type InventoryIdentityIndex = {
  deviceIdSet: Set<string>;
  uniqueNameToId: Map<string, string>;
  duplicateNames: Set<string>;
  groupNameToId: Map<string, string>;
  entries: InventoryDeviceEntry[];
  duplicateNameCount: number;
};

const GROUP_PATH_KEYS = [
  "grouppath",
  "group_path",
  "groupPath",
  "groupname",
  "groupName",
  "group",
  "accountname",
  "accountName",
  "pathname",
  "pathName",
];

export function normalizeIdentityText(value: string | null | undefined): string {
  if (!value) return "";
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function pickGroupPath(raw: Record<string, unknown>): string | null {
  for (const key of GROUP_PATH_KEYS) {
    for (const candidate of [key, key.toLowerCase()]) {
      const value = raw[candidate];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  return null;
}

export function buildGroupNameKey(groupPathNormalized: string, deviceNameNormalized: string): string {
  return `${groupPathNormalized}|${deviceNameNormalized}`;
}

export function buildInventoryIdentityIndex(
  records: BootstrapDeviceRecord[],
): InventoryIdentityIndex {
  const deviceIdSet = new Set<string>();
  const entries: InventoryDeviceEntry[] = [];
  const nameCounts = new Map<string, number>();

  for (const record of records) {
    deviceIdSet.add(record.sourceDeviceId);
    const deviceNameNormalized = normalizeIdentityText(record.deviceName);
    const groupPath = pickGroupPath(record.raw);
    const groupPathNormalized = normalizeIdentityText(groupPath);
    entries.push({
      sourceDeviceId: record.sourceDeviceId,
      deviceName: record.deviceName,
      deviceNameNormalized,
      groupPath,
      groupPathNormalized,
    });
    if (deviceNameNormalized) {
      nameCounts.set(deviceNameNormalized, (nameCounts.get(deviceNameNormalized) ?? 0) + 1);
    }
  }

  const duplicateNames = new Set<string>();
  for (const [name, count] of nameCounts) {
    if (count > 1) duplicateNames.add(name);
  }

  const uniqueNameToId = new Map<string, string>();
  const groupNameToId = new Map<string, string>();

  for (const entry of entries) {
    if (entry.deviceNameNormalized && !duplicateNames.has(entry.deviceNameNormalized)) {
      uniqueNameToId.set(entry.deviceNameNormalized, entry.sourceDeviceId);
    }
    if (entry.deviceNameNormalized && entry.groupPathNormalized) {
      groupNameToId.set(
        buildGroupNameKey(entry.groupPathNormalized, entry.deviceNameNormalized),
        entry.sourceDeviceId,
      );
    }
  }

  return {
    deviceIdSet,
    uniqueNameToId,
    duplicateNames,
    groupNameToId,
    entries,
    duplicateNameCount: duplicateNames.size,
  };
}

export type RowResolutionMethod =
  | "id"
  | "unique_name"
  | "group_name"
  | "duplicate_name"
  | "unresolved";

export type RowResolution = {
  sourceDeviceId: string | null;
  method: RowResolutionMethod;
};

export type SanitizedRowFields = {
  text: string;
  title: string | null;
  ariaLabel: string | null;
  dataAttributes: Record<string, string>;
  groupLabel: string | null;
  level: number | null;
  statusIconClasses: string[];
};

export function resolveRowToDeviceId(
  row: SanitizedRowFields,
  index: InventoryIdentityIndex,
): RowResolution {
  const haystacks = [
    row.text,
    row.title ?? "",
    row.ariaLabel ?? "",
    ...Object.values(row.dataAttributes),
    row.groupLabel ?? "",
  ];

  for (const haystack of haystacks) {
    for (const token of extractDigitTokens(haystack)) {
      if (index.deviceIdSet.has(token)) {
        return { sourceDeviceId: token, method: "id" };
      }
    }
    for (const id of index.deviceIdSet) {
      if (haystack.includes(id)) {
        return { sourceDeviceId: id, method: "id" };
      }
    }
  }

  const normalizedName = normalizeIdentityText(row.text.split("\n")[0]);
  if (normalizedName) {
    if (index.duplicateNames.has(normalizedName)) {
      const groupKey = buildGroupNameKey(
        normalizeIdentityText(row.groupLabel),
        normalizedName,
      );
      const grouped = index.groupNameToId.get(groupKey);
      if (grouped) return { sourceDeviceId: grouped, method: "group_name" };
      return { sourceDeviceId: null, method: "duplicate_name" };
    }
    const unique = index.uniqueNameToId.get(normalizedName);
    if (unique) return { sourceDeviceId: unique, method: "unique_name" };
    const groupKey = buildGroupNameKey(
      normalizeIdentityText(row.groupLabel),
      normalizedName,
    );
    const grouped = index.groupNameToId.get(groupKey);
    if (grouped) return { sourceDeviceId: grouped, method: "group_name" };
  }

  return { sourceDeviceId: null, method: "unresolved" };
}

function extractDigitTokens(text: string): string[] {
  return text.match(/\d{8,17}/g) ?? [];
}

export function serializeIdentityIndexForBrowser(index: InventoryIdentityIndex): {
  deviceIds: string[];
  uniqueNames: Record<string, string>;
  groupNames: Record<string, string>;
  duplicateNames: string[];
} {
  return {
    deviceIds: [...index.deviceIdSet],
    uniqueNames: Object.fromEntries(index.uniqueNameToId),
    groupNames: Object.fromEntries(index.groupNameToId),
    duplicateNames: [...index.duplicateNames],
  };
}
