import { normalizeDeviceRecord } from "./normalizer.js";
import { normalizeInventoryDevice, pickInventorySourceDeviceId, } from "./inventory-normalizer.js";
const DEVICE_ID_KEYS = [
    "deviceid",
    "deviceId",
    "device_id",
    "imei",
    "deviceno",
    "deviceNo",
    "terminalno",
    "simno",
    "sim_no",
];
const INVENTORY_DEVICE_ID_KEYS = ["deviceid", "deviceId", "device_id"];
const DEVICE_NAME_KEYS = ["devicename", "deviceName", "device_name", "name", "carno", "plate"];
const CHILD_COLLECTION_KEYS = [
    "children",
    "childusers",
    "users",
    "subusers",
    "groups",
    "devices",
    "deviceinfos",
    "records",
];
const ACCOUNT_HINT_KEYS = ["username", "usertype", "userid", "accountname", "accountid"];
const GROUP_HINT_KEYS = ["groupname", "groupid", "group_name"];
const STATUS_FIELD_KEYS = [
    "lat",
    "latitude",
    "lng",
    "lon",
    "longitude",
    "speed",
    "status",
    "online",
    "acc",
    "updatetime",
    "lasttime",
    "locatedtime",
    "address",
];
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function pickField(record, keys) {
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
function hasDeviceIdentifier(record, inventoryMode) {
    const keys = inventoryMode ? INVENTORY_DEVICE_ID_KEYS : DEVICE_ID_KEYS;
    return keys.some((k) => pickField(record, [k]) != null);
}
function hasAccountHints(record) {
    return ACCOUNT_HINT_KEYS.some((k) => pickField(record, [k]) != null);
}
function hasGroupHints(record) {
    return GROUP_HINT_KEYS.some((k) => pickField(record, [k]) != null);
}
function classifyNode(record, inventoryMode) {
    if (hasDeviceIdentifier(record, inventoryMode))
        return "device";
    if (hasGroupHints(record))
        return "group";
    if (hasAccountHints(record))
        return "account";
    return "unknown";
}
function resolveNodeName(record, kind) {
    if (kind === "account") {
        return pickField(record, ["username", "accountname", "accountName"]);
    }
    if (kind === "group") {
        return pickField(record, ["groupname", "group_name", "groupName", "name"]);
    }
    return null;
}
function increment(map, key) {
    map[key] = (map[key] ?? 0) + 1;
}
function collectChildEntries(record) {
    const entries = [];
    for (const key of Object.keys(record)) {
        const lower = key.toLowerCase();
        if (!CHILD_COLLECTION_KEYS.includes(lower) && !CHILD_COLLECTION_KEYS.includes(key))
            continue;
        const val = record[key];
        if (Array.isArray(val)) {
            entries.push({ key, items: val });
        }
        else if (isRecord(val)) {
            entries.push({ key, items: [val] });
        }
    }
    return entries;
}
function extractRootUser(payload) {
    if (!isRecord(payload))
        return payload;
    if ("rootuser" in payload)
        return payload.rootuser;
    if ("rootUser" in payload)
        return payload.rootUser;
    return payload;
}
function visitNode(value, path, namePath, ctx) {
    if (!isRecord(value))
        return null;
    ctx.stats.totalObjectsVisited += 1;
    for (const key of Object.keys(value)) {
        const lower = key.toLowerCase();
        if (DEVICE_ID_KEYS.some((id) => id.toLowerCase() === lower)) {
            increment(ctx.stats.identifierFieldFrequency, key);
        }
        if (DEVICE_NAME_KEYS.some((n) => n.toLowerCase() === lower)) {
            increment(ctx.stats.nameFieldFrequency, key);
        }
    }
    const kind = classifyNode(value, ctx.inventoryMode);
    if (kind === "account")
        ctx.stats.accountNodeCount += 1;
    if (kind === "group")
        ctx.stats.groupNodeCount += 1;
    const nodeName = resolveNodeName(value, kind);
    const childNamePath = nodeName ? [...namePath, nodeName] : namePath;
    const identifiers = {};
    for (const key of DEVICE_ID_KEYS) {
        const val = pickField(value, [key]);
        if (val)
            identifiers[key] = val;
    }
    const names = {};
    for (const key of DEVICE_NAME_KEYS) {
        const val = pickField(value, [key]);
        if (val)
            names[key] = val;
    }
    const statusFields = {};
    for (const key of Object.keys(value)) {
        if (STATUS_FIELD_KEYS.some((s) => s.toLowerCase() === key.toLowerCase())) {
            statusFields[key] = value[key];
        }
    }
    const childNodes = [];
    for (const { key, items } of collectChildEntries(value)) {
        increment(ctx.stats.childCollectionFrequency, key);
        for (let i = 0; i < items.length; i++) {
            const child = visitNode(items[i], [...path, `${key}[${i}]`], childNamePath, ctx);
            if (child)
                childNodes.push(child);
        }
    }
    if (kind === "device") {
        const readablePath = namePath.length ? namePath.join(" / ") : null;
        if (ctx.inventoryMode) {
            const inventoryDevice = normalizeInventoryDevice(value, readablePath);
            if (!inventoryDevice) {
                return {
                    kind: "unknown",
                    path,
                    namePath,
                    identifiers,
                    names,
                    statusFields,
                    rawKeys: Object.keys(value),
                    children: childNodes,
                };
            }
            ctx.inventoryDevices.push(inventoryDevice);
            for (const key of Object.keys(value)) {
                ctx.stats.sampleDeviceKeys.add(key);
            }
            ctx.deviceIdsSeen.set(inventoryDevice.sourceDeviceId, (ctx.deviceIdsSeen.get(inventoryDevice.sourceDeviceId) ?? 0) + 1);
        }
        else {
            const normalized = normalizeDeviceRecord(value, "network");
            if (normalized.sourceDeviceId === "unknown" && !pickInventorySourceDeviceId(value)) {
                return {
                    kind: "unknown",
                    path,
                    namePath,
                    identifiers,
                    names,
                    statusFields,
                    rawKeys: Object.keys(value),
                    children: childNodes,
                };
            }
            normalized.groupPath = readablePath;
            ctx.devices.push(normalized);
            for (const key of Object.keys(value)) {
                ctx.stats.sampleDeviceKeys.add(key);
            }
            ctx.deviceIdsSeen.set(normalized.sourceDeviceId, (ctx.deviceIdsSeen.get(normalized.sourceDeviceId) ?? 0) + 1);
        }
    }
    return {
        kind,
        path,
        namePath,
        identifiers,
        names,
        statusFields,
        rawKeys: Object.keys(value),
        children: childNodes,
    };
}
function buildSummary(ctx) {
    const duplicateDeviceCount = [...ctx.deviceIdsSeen.values()].reduce((sum, count) => sum + (count > 1 ? count - 1 : 0), 0);
    const sampleSource = ctx.inventoryMode ? ctx.inventoryDevices : ctx.devices;
    return {
        totalObjectsVisited: ctx.stats.totalObjectsVisited,
        accountNodeCount: ctx.stats.accountNodeCount,
        groupNodeCount: ctx.stats.groupNodeCount,
        detectedDeviceCount: sampleSource.length,
        uniqueDeviceCount: ctx.deviceIdsSeen.size,
        duplicateDeviceCount,
        identifierFieldFrequency: ctx.stats.identifierFieldFrequency,
        nameFieldFrequency: ctx.stats.nameFieldFrequency,
        childCollectionFrequency: ctx.stats.childCollectionFrequency,
        sampleDeviceKeys: [...ctx.stats.sampleDeviceKeys].sort().slice(0, 40),
        sampleDevices: sampleSource.slice(0, 5).map((d) => ({
            sourceDeviceId: d.sourceDeviceId,
            deviceName: d.deviceName,
            groupPath: d.groupPath,
            onlineStatus: d.onlineStatus,
            latitude: "latitude" in d ? d.latitude : null,
            longitude: "longitude" in d ? d.longitude : null,
        })),
    };
}
function createContext(inventoryMode) {
    return {
        inventoryMode,
        stats: {
            totalObjectsVisited: 0,
            accountNodeCount: 0,
            groupNodeCount: 0,
            identifierFieldFrequency: {},
            nameFieldFrequency: {},
            childCollectionFrequency: {},
            sampleDeviceKeys: new Set(),
        },
        devices: [],
        inventoryDevices: [],
        deviceIdsSeen: new Map(),
    };
}
export function parseDeviceTree(payload) {
    const ctx = createContext(false);
    const rootValue = extractRootUser(payload);
    const root = rootValue ? visitNode(rootValue, ["rootuser"], [], ctx) : null;
    return { root, devices: ctx.devices, summary: buildSummary(ctx) };
}
export function parseInventoryDeviceTree(payload) {
    const ctx = createContext(true);
    const rootValue = extractRootUser(payload);
    const initialNamePath = [];
    const root = rootValue ? visitNode(rootValue, ["rootuser"], initialNamePath, ctx) : null;
    if (root && root.kind === "account") {
        const rootName = resolveNodeName(rootValue, "account");
        if (rootName && root.namePath.length === 0) {
            root.namePath = [rootName];
        }
    }
    return { root, devices: ctx.inventoryDevices, summary: buildSummary(ctx) };
}
