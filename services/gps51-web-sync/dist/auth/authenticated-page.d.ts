import type { Browser, BrowserContext, Page } from "playwright";
import type { AppConfig } from "../config.js";
import type { Logger } from "../logger.js";
export type AuthenticatedBrowserSession = {
    browser: Browser;
    context: BrowserContext;
    page: Page;
    cleanup: () => Promise<void>;
};
export type EnsureAuthenticatedOptions = {
    forceHeadless?: boolean;
    targetUrl?: string;
};
export declare function createAuthenticatedContext(config: AppConfig, browser: Browser): Promise<BrowserContext>;
export declare function ensureAuthenticatedPage(config: AppConfig, log: Logger, options?: EnsureAuthenticatedOptions): Promise<AuthenticatedBrowserSession>;
