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
export function normalizeIdentityText(value) {
    if (!value)
        return "";
    return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}
function pickGroupPath(raw) {
    for (const key of GROUP_PATH_KEYS) {
        for (const candidate of [key, key.toLowerCase()]) {
            const value = raw[candidate];
            if (typeof value === "string" && value.trim())
                return value.trim();
        }
    }
    return null;
}
export function buildGroupNameKey(groupPathNormalized, deviceNameNormalized) {
    return `${groupPathNormalized}|${deviceNameNormalized}`;
}
export function buildInventoryIdentityIndex(records) {
    const deviceIdSet = new Set();
    const entries = [];
    const nameCounts = new Map();
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
    const duplicateNames = new Set();
    for (const [name, count] of nameCounts) {
        if (count > 1)
            duplicateNames.add(name);
    }
    const uniqueNameToId = new Map();
    const groupNameToId = new Map();
    for (const entry of entries) {
        if (entry.deviceNameNormalized && !duplicateNames.has(entry.deviceNameNormalized)) {
            uniqueNameToId.set(entry.deviceNameNormalized, entry.sourceDeviceId);
        }
        if (entry.deviceNameNormalized && entry.groupPathNormalized) {
            groupNameToId.set(buildGroupNameKey(entry.groupPathNormalized, entry.deviceNameNormalized), entry.sourceDeviceId);
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
export function resolveRowToDeviceId(row, index) {
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
            const groupKey = buildGroupNameKey(normalizeIdentityText(row.groupLabel), normalizedName);
            const grouped = index.groupNameToId.get(groupKey);
            if (grouped)
                return { sourceDeviceId: grouped, method: "group_name" };
            return { sourceDeviceId: null, method: "duplicate_name" };
        }
        const unique = index.uniqueNameToId.get(normalizedName);
        if (unique)
            return { sourceDeviceId: unique, method: "unique_name" };
        const groupKey = buildGroupNameKey(normalizeIdentityText(row.groupLabel), normalizedName);
        const grouped = index.groupNameToId.get(groupKey);
        if (grouped)
            return { sourceDeviceId: grouped, method: "group_name" };
    }
    return { sourceDeviceId: null, method: "unresolved" };
}
function extractDigitTokens(text) {
    return text.match(/\d{8,17}/g) ?? [];
}
export function serializeIdentityIndexForBrowser(index) {
    return {
        deviceIds: [...index.deviceIdSet],
        uniqueNames: Object.fromEntries(index.uniqueNameToId),
        groupNames: Object.fromEntries(index.groupNameToId),
        duplicateNames: [...index.duplicateNames],
    };
}
