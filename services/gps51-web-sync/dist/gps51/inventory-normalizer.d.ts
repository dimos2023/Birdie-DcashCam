import type { InventoryDeviceMetadata, InventoryDeviceRecord, InventoryMediaChannel } from "./inventory-types.js";
export declare function pickInventorySourceDeviceId(record: Record<string, unknown>): string | null;
export declare function parseLastActiveTime(record: Record<string, unknown>): string | null;
export declare function parseVideoChannels(record: Record<string, unknown>): InventoryMediaChannel[];
export declare function extractInventoryMetadata(record: Record<string, unknown>): InventoryDeviceMetadata;
export declare function sanitizeDeviceSnapshot(record: Record<string, unknown>): Record<string, unknown>;
export declare function normalizeInventoryDevice(record: Record<string, unknown>, groupPath: string | null): InventoryDeviceRecord | null;
export declare function countInventoryStats(devices: InventoryDeviceRecord[]): {
    devicesWithSimNo: number;
    devicesWithVideo: number;
    devicesWithMissingIdentifier: number;
};
