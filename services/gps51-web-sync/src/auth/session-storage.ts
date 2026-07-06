import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { BrowserContext, Page } from "playwright";
import type { AppConfig } from "../config.js";

export const SESSION_STORAGE_FILENAME = "session-storage.json";

export function resolveSessionStoragePath(config: AppConfig): string {
  return path.join(path.dirname(config.storageStatePath), SESSION_STORAGE_FILENAME);
}

export function sessionStorageExists(config: AppConfig): boolean {
  return existsSync(resolveSessionStoragePath(config));
}

export function restrictSessionStoragePermissions(filePath: string): void {
  if (process.platform === "win32") return;
  try {
    chmodSync(filePath, 0o600);
  } catch {
    /* ignore */
  }
}

export function loadSessionStorageSnapshot(config: AppConfig): Record<string, string> | null {
  const filePath = resolveSessionStoragePath(config);
  if (!existsSync(filePath)) return null;
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "string") out[key] = value;
    }
    return Object.keys(out).length > 0 ? out : null;
  } catch {
    return null;
  }
}

export function buildSessionStorageInitScript(data: Record<string, string>): string {
  const json = JSON.stringify(data);
  return `
(function() {
  var entries = ${json};
  try {
    for (var key in entries) {
      if (Object.prototype.hasOwnProperty.call(entries, key)) {
        sessionStorage.setItem(key, entries[key]);
      }
    }
  } catch (e) {}
})();
`.trim();
}

export async function applySessionStorageInitScript(
  context: BrowserContext,
  config: AppConfig,
): Promise<boolean> {
  const snapshot = loadSessionStorageSnapshot(config);
  if (!snapshot) return false;
  await context.addInitScript(buildSessionStorageInitScript(snapshot));
  return true;
}

export async function captureSessionStorage(page: Page): Promise<Record<string, string>> {
  const raw = await page.evaluate(`
(function() {
  var out = {};
  try {
    for (var i = 0; i < sessionStorage.length; i++) {
      var key = sessionStorage.key(i);
      if (key) out[key] = sessionStorage.getItem(key);
    }
  } catch (e) {}
  return out;
})()
`);

  const out: Record<string, string> = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof value === "string") out[key] = value;
    }
  }
  return out;
}

export async function persistSessionStorage(
  page: Page,
  config: AppConfig,
): Promise<{ saved: boolean; keyCount: number }> {
  const snapshot = await captureSessionStorage(page);
  if (Object.keys(snapshot).length === 0) {
    return { saved: false, keyCount: 0 };
  }

  const filePath = resolveSessionStoragePath(config);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(snapshot, null, 2));
  restrictSessionStoragePermissions(filePath);
  return { saved: true, keyCount: Object.keys(snapshot).length };
}

export function sessionStorageHasAuthHints(snapshot: Record<string, string>): boolean {
  return Object.keys(snapshot).some((key) =>
    /token|auth|session|user|login|jwt/i.test(key),
  );
}
