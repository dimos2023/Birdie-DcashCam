import type { Page } from "playwright";
export declare const TELEMETRY_SUMMARY_FILE = "device-telemetry-summary.json";
export declare const TELEMETRY_FIELDS_FILE = "device-telemetry-fields.json";
export declare const TELEMETRY_SAMPLE_FILE = "device-telemetry-sample.json";
export declare const POSITION_REFRESH_SUMMARY_FILE = "position-refresh-summary.json";
export type PositionRefreshSelection = {
    selectedDeviceId: string | null;
    componentPath: string | null;
    onlineCount: number;
    selectionMethod: string | null;
    error: string | null;
};
export declare function buildDeviceTelemetryInspectScript(inventorySample: string[]): string;
export declare function buildSafeSelectOnlineDeviceScript(targetDeviceId?: string | null): string;
export declare function inspectDeviceTelemetryOnPage(page: Page, inventoryIds: Set<string>): Promise<Record<string, unknown>>;
export declare function safelySelectOnlineDeviceOnPage(page: Page, targetDeviceId?: string | null): Promise<PositionRefreshSelection>;
