import type { Locator, Page } from "playwright";
export type SafeDomRect = {
    top: number | null;
    left: number | null;
    width: number | null;
    height: number | null;
};
export type SafeScrollMetrics = {
    top: number | null;
    height: number | null;
};
export type ClickTabResult = {
    clicked: boolean;
    matchedLabel: string | null;
    strategy: string | null;
};
export declare const STATUS_TAB_FALLBACKS: {
    readonly all: readonly ["All devices", "All Devices", "All", "全部设备", "全部"];
    readonly online: readonly ["Online", "Online devices", "On line", "在线", "在线设备"];
    readonly offline: readonly ["Offline", "Offline devices", "离线", "离线设备"];
};
export declare const DEVICE_TREE_CONTAINER_SELECTORS: string[];
export declare const COUNT_BADGE_SELECTORS: string[];
export declare const MASTER_DEVICE_TREE_SELECTORS: string[];
export declare function normalizeDomRect(rect: {
    top?: number | null;
    left?: number | null;
    width?: number | null;
    height?: number | null;
} | null | undefined): SafeDomRect;
export declare function normalizeScrollMetrics(value: unknown): SafeScrollMetrics;
export declare function getSafeBoundingBox(locator: Locator): Promise<SafeDomRect | null>;
export declare function pickTopmostRect(rects: Array<SafeDomRect | null | undefined>): SafeDomRect | null;
export declare function readSafeDomRectFromLocator(locator: Locator): Promise<SafeDomRect | null>;
export declare function scrollDeviceTreeSafely(page: Page): Promise<boolean>;
export declare function clickStatusTab(page: Page, tab: keyof typeof STATUS_TAB_FALLBACKS): Promise<ClickTabResult>;
export declare function buildFailureSummary(input: {
    startedAt: string;
    error: unknown;
}): Record<string, unknown>;
