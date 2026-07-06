import type { InventoryDeviceRecord } from "./inventory-types.js";
export declare class InventoryValidationError extends Error {
    constructor(message: string);
}
export declare class InventoryDuplicateError extends InventoryValidationError {
    readonly duplicateIds: string[];
    constructor(duplicateIds: string[]);
}
export declare class InventoryCountError extends InventoryValidationError {
    constructor(count: number, minimum: number);
}
export declare function findDuplicateSourceDeviceIds(devices: InventoryDeviceRecord[]): string[];
export declare function validateInventoryDevices(devices: InventoryDeviceRecord[], minimum?: number): void;
export declare function assertOrganizationId(organizationId: string): void;
