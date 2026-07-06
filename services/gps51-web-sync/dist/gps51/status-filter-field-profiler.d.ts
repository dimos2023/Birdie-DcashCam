import type { BootstrapDeviceRecord } from "./status-bootstrap-parser.js";
import { type DeviceFieldProfile, type FieldStatusCandidate } from "./status-model-field-profiler.js";
export type StatusFilterFieldCandidate = FieldStatusCandidate & {
    devicesWithField: number;
    distinctValueCount: number;
    unionCoveragePercent: number;
};
export declare function profileStatusFilterDeviceFields(records: BootstrapDeviceRecord[]): DeviceFieldProfile[];
export declare function discoverStatusFilterFieldCandidates(records: BootstrapDeviceRecord[], portal: {
    all: number | null;
    online: number | null;
    offline: number | null;
}, options?: {
    minDevicesWithField?: number;
    maxDistinct?: number;
    tolerance?: number;
    minUnionPercent?: number;
}): StatusFilterFieldCandidate[];
export declare function pickBestStatusFilterFieldCandidate(candidates: StatusFilterFieldCandidate[]): StatusFilterFieldCandidate | null;
