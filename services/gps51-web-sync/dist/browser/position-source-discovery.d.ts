import type { Page } from "playwright";
import { normalizePositionSourceInspection } from "../gps51/position-source-extract.js";
export declare const POSITION_SOURCE_SUMMARY_FILE = "position-source-summary.json";
export declare const POSITION_SOURCE_FIELDS_FILE = "position-source-fields.json";
export declare const POSITION_SOURCE_NETWORK_FILE = "position-source-network.json";
export declare function inspectPositionSourceOnPage(page: Page, selectedDeviceId: string): Promise<ReturnType<typeof normalizePositionSourceInspection>>;
export declare function runPositionSourceDiscovery(): Promise<void>;
