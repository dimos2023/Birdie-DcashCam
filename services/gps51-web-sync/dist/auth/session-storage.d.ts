import type { BrowserContext, Page } from "playwright";
import type { AppConfig } from "../config.js";
export declare const SESSION_STORAGE_FILENAME = "session-storage.json";
export declare function resolveSessionStoragePath(config: AppConfig): string;
export declare function sessionStorageExists(config: AppConfig): boolean;
export declare function restrictSessionStoragePermissions(filePath: string): void;
export declare function loadSessionStorageSnapshot(config: AppConfig): Record<string, string> | null;
export declare function buildSessionStorageInitScript(data: Record<string, string>): string;
export declare function applySessionStorageInitScript(context: BrowserContext, config: AppConfig): Promise<boolean>;
export declare function captureSessionStorage(page: Page): Promise<Record<string, string>>;
export declare function persistSessionStorage(page: Page, config: AppConfig): Promise<{
    saved: boolean;
    keyCount: number;
}>;
export declare function sessionStorageHasAuthHints(snapshot: Record<string, string>): boolean;
