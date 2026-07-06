import type { Page } from "playwright";
export type DomDeviceIdCollection = {
    deviceIds: string[];
    scrollPasses: number;
};
export declare function extractDeviceIdsFromText(text: string): string[];
export declare function collectVisibleDeviceIds(page: Page, maxScrollPasses?: number): Promise<DomDeviceIdCollection>;
export declare function reconcileDeviceSets(input: {
    inventoryIds: Set<string>;
    onlineIds: string[];
    offlineIds: string[];
    allIds: string[];
}): {
    onlineCount: number;
    offlineCount: number;
    allCount: number;
    duplicateOnline: string[];
    duplicateOffline: string[];
    missingInventory: string[];
    extraInventory: string[];
    overlapInventoryPercent: number;
};
