import type { Page } from "playwright";
import { type ParsedPositionLast } from "./position-last-parser.js";
export type CacheComponentDiscovery = {
    deviceListPath: string | null;
    mapComponentPaths: string[];
    cacheMgrFound: boolean;
    error: string | null;
};
export type CachePositionRecord = {
    deviceId: string;
    fieldPath: string;
    record: Record<string, unknown>;
};
export type CacheSelectionResult = {
    selectedDeviceId: string;
    found: boolean;
    fieldPath: string | null;
    record: Record<string, unknown> | null;
    componentPath: string | null;
    error: string | null;
};
export declare function buildDiscoverCacheComponentsScript(): string;
export declare function buildSelectDeviceAndWaitForCacheScript(deviceId: string, timeoutMs: number): string;
export declare function buildExtractOnlineDeviceIdsScript(): string;
export declare function readCachePositionsOnPage(page: Page, inventoryIds: Set<string>): Promise<Map<string, Record<string, unknown>>>;
export declare function discoverCacheComponentsOnPage(page: Page): Promise<CacheComponentDiscovery>;
export declare function extractOnlineDeviceIdsOnPage(page: Page): Promise<Set<string>>;
export declare function selectDeviceAndWaitForCacheOnPage(page: Page, deviceId: string, timeoutMs: number): Promise<CacheSelectionResult>;
export declare function parseCacheRecord(deviceId: string, record: Record<string, unknown>): ParsedPositionLast | null;
