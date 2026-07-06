import type { Page } from "playwright";
import type { AppConfig } from "../config.js";
import type { Logger } from "../logger.js";
export type SubscriptionFrameTemplate = {
    payload: Record<string, unknown>;
    deviceIdField: string;
    supportsBatch: boolean;
};
export declare function loadSubscriptionFrameTemplate(captureDir: string): SubscriptionFrameTemplate | null;
export declare function trySendWebSocketSubscription(page: Page, template: SubscriptionFrameTemplate, deviceIds: string[]): Promise<boolean>;
export declare function buildSubscriptionPayload(template: SubscriptionFrameTemplate, deviceIds: string[]): Record<string, unknown>;
export declare function subscribeViaMonitorUi(page: Page, log: Logger): Promise<number>;
export declare function subscribeAllInventoryDevices(page: Page, config: AppConfig, deviceIds: string[], log: Logger): Promise<{
    subscribedCount: number;
    method: "websocket" | "ui" | "mixed";
}>;
export declare function readPortalStatusCounts(page: Page): Promise<{
    all: number | null;
    online: number | null;
    offline: number | null;
}>;
export declare function clickTab(page: Page, labels: string[]): Promise<boolean>;
export declare function clickAllDevicesTab(page: Page): Promise<boolean>;
export declare function clickOnlineTab(page: Page): Promise<boolean>;
export declare function clickOfflineTab(page: Page): Promise<boolean>;
export declare function selectOneDeviceCheckbox(page: Page): Promise<boolean>;
