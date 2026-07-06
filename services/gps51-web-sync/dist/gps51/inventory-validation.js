import { MIN_INVENTORY_DEVICE_COUNT } from "./inventory-types.js";
export class InventoryValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = "InventoryValidationError";
    }
}
export class InventoryDuplicateError extends InventoryValidationError {
    duplicateIds;
    constructor(duplicateIds) {
        super(`Duplicate source_device_id values detected: ${duplicateIds.slice(0, 10).join(", ")}`);
        this.duplicateIds = duplicateIds;
    }
}
export class InventoryCountError extends InventoryValidationError {
    constructor(count, minimum) {
        super(`Unique device count ${count} is below required minimum ${minimum}`);
    }
}
export function findDuplicateSourceDeviceIds(devices) {
    const counts = new Map();
    for (const device of devices) {
        counts.set(device.sourceDeviceId, (counts.get(device.sourceDeviceId) ?? 0) + 1);
    }
    return [...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id);
}
export function validateInventoryDevices(devices, minimum = MIN_INVENTORY_DEVICE_COUNT) {
    const duplicateIds = findDuplicateSourceDeviceIds(devices);
    if (duplicateIds.length > 0) {
        throw new InventoryDuplicateError(duplicateIds);
    }
    const uniqueCount = new Set(devices.map((d) => d.sourceDeviceId)).size;
    if (uniqueCount < minimum) {
        throw new InventoryCountError(uniqueCount, minimum);
    }
    const missing = devices.filter((d) => !d.sourceDeviceId);
    if (missing.length > 0) {
        throw new InventoryValidationError(`${missing.length} devices are missing source_device_id`);
    }
}
export function assertOrganizationId(organizationId) {
    const postgresUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const normalizedOrganizationId = organizationId.trim();
    if (!postgresUuid.test(normalizedOrganizationId)) {
        throw new InventoryValidationError(`ORGANIZATION_ID is not a valid PostgreSQL UUID: ${organizationId}`);
    }
}
