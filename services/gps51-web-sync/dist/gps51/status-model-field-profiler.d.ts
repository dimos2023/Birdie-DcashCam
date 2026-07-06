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
export declare const STATUS_FIELD_HINTS: readonly ["online", "isonline", "isOnline", "offline", "status", "devicestatus", "deviceStatus", "loginstatus", "loginStatus", "connectstatus", "connectionStatus", "islogin", "isactive", "active", "state", "runstatus", "netstatus", "heartstatus", "acc", "accstatus"];
export declare function isDeviceScalarPath(path: string): boolean;
export declare function flattenScalarDeviceFields(record: Record<string, unknown>, prefix?: string, output?: ScalarFieldEntry[]): ScalarFieldEntry[];
export declare function profileDeviceFields(records: BootstrapDeviceRecord[]): DeviceFieldProfile[];
export declare function isStatusHintField(fieldPath: string): boolean;
export declare function isLowCardinalityProfile(profile: DeviceFieldProfile, maxDistinct?: number): boolean;
export declare function buildMappingVariants(distinctValues: string[]): StatusFieldMapping[];
export declare function evaluateFieldMapping(records: BootstrapDeviceRecord[], fieldPath: string, mapping: StatusFieldMapping): {
    onlineDeviceIds: string[];
    offlineDeviceIds: string[];
    unknownCount: number;
};
export declare function discoverFieldCandidates(records: BootstrapDeviceRecord[], portal: {
    all: number | null;
    online: number | null;
    offline: number | null;
}, tolerance?: number): FieldStatusCandidate[];
export declare function pickBestFieldCandidate(candidates: FieldStatusCandidate[]): FieldStatusCandidate | null;
