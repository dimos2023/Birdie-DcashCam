import type { InventoryDeviceRecord } from "./inventory-types.js";
import type { NormalizedGps51Device } from "./types.js";
export type TreeNodeKind = "account" | "group" | "device" | "unknown";
export type ParsedTreeNode = {
    kind: TreeNodeKind;
    path: string[];
    namePath: string[];
    identifiers: Record<string, string>;
    names: Record<string, string>;
    statusFields: Record<string, unknown>;
    rawKeys: string[];
    children: ParsedTreeNode[];
};
export type DeviceTreeSummary = {
    totalObjectsVisited: number;
    accountNodeCount: number;
    groupNodeCount: number;
    detectedDeviceCount: number;
    uniqueDeviceCount: number;
    duplicateDeviceCount: number;
    identifierFieldFrequency: Record<string, number>;
    nameFieldFrequency: Record<string, number>;
    childCollectionFrequency: Record<string, number>;
    sampleDeviceKeys: string[];
    sampleDevices: Array<{
        sourceDeviceId: string;
        deviceName: string | null;
        groupPath: string | null;
        onlineStatus: string;
        latitude: number | null;
        longitude: number | null;
    }>;
};
export type DeviceTreeParseResult = {
    root: ParsedTreeNode | null;
    devices: NormalizedGps51Device[];
    summary: DeviceTreeSummary;
};
export type InventoryTreeParseResult = {
    root: ParsedTreeNode | null;
    devices: InventoryDeviceRecord[];
    summary: DeviceTreeSummary;
};
export declare function parseDeviceTree(payload: unknown): DeviceTreeParseResult;
export declare function parseInventoryDeviceTree(payload: unknown): InventoryTreeParseResult;
