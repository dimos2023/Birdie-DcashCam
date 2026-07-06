import { type Browser } from "playwright";
import type { AppConfig } from "../config.js";
export declare function launchBrowser(config: AppConfig, options?: {
    forceHeadless?: boolean;
}): Promise<Browser>;
