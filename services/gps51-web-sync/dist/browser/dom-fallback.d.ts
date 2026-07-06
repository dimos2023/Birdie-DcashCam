import type { Page } from "playwright";
import type { NormalizedGps51Device } from "../gps51/types.js";
export declare function scrapeDevicesFromDom(page: Page, maxDevices: number): Promise<NormalizedGps51Device[]>;
export declare function safeScrollDeviceTree(page: Page): Promise<void>;
