import { type BrowserContext, type Page } from "playwright";
import type { AppConfig } from "../config.js";
import type { Logger } from "../logger.js";
export type AuthBootstrapOptions = {
    closeOnSuccess?: boolean;
    forceHeadless?: boolean;
    targetUrl?: string;
};
export declare function storageStateExists(config: AppConfig): boolean;
export declare function ensureAuthDirs(config: AppConfig): void;
export declare function restrictStorageStatePermissions(storageStatePath: string): void;
export declare function persistAuthArtifacts(context: BrowserContext, page: Page, config: AppConfig, log: Logger): Promise<void>;
export declare function isReauthRequired(page: Page): Promise<boolean>;
export declare function waitForAuthSuccess(page: Page, config: AppConfig, log: Logger): Promise<void>;
export declare function runAuthBootstrap(config: AppConfig, log: Logger, options?: AuthBootstrapOptions): Promise<import("./authenticated-page.js").AuthenticatedBrowserSession | void>;
