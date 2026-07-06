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
export declare function normalizeIdentityText(value: string | null | undefined): string;
export declare function buildGroupNameKey(groupPathNormalized: string, deviceNameNormalized: string): string;
export declare function buildInventoryIdentityIndex(records: BootstrapDeviceRecord[]): InventoryIdentityIndex;
export type RowResolutionMethod = "id" | "unique_name" | "group_name" | "duplicate_name" | "unresolved";
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
export declare function resolveRowToDeviceId(row: SanitizedRowFields, index: InventoryIdentityIndex): RowResolution;
export declare function serializeIdentityIndexForBrowser(index: InventoryIdentityIndex): {
    deviceIds: string[];
    uniqueNames: Record<string, string>;
    groupNames: Record<string, string>;
    duplicateNames: string[];
};
