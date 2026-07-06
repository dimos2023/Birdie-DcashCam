import type { AppConfig } from "../config.js";
import { parseInventoryDeviceTree } from "../gps51/device-tree-parser.js";
import type { InventoryDeviceRecord } from "../gps51/inventory-types.js";
export type InventorySyncMode = "dry" | "sync" | "reconcile";
export declare class ReauthRequiredError extends Error {
    constructor();
}
export type InventoryCaptureResult = {
    devices: InventoryDeviceRecord[];
    summary: ReturnType<typeof parseInventoryDeviceTree>["summary"];
    payload: unknown;
};
export declare function runInventorySync(mode: InventorySyncMode, config: AppConfig): Promise<void>;
