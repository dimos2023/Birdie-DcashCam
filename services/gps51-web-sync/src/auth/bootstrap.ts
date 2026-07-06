import { chmodSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import type { AppConfig } from "../config.js";
import type { Logger } from "../logger.js";
import { LOGIN_FORM_SELECTORS, MONITOR_NAV_SELECTORS } from "../gps51/selectors.js";

const AUTH_WAIT_MS = 10 * 60 * 1000;

export function storageStateExists(config: AppConfig): boolean {
  return existsSync(config.storageStatePath);
}

export function ensureAuthDirs(config: AppConfig): void {
  mkdirSync(path.dirname(config.storageStatePath), { recursive: true });
  mkdirSync(config.captureDir, { recursive: true });
}

export function restrictStorageStatePermissions(storageStatePath: string): void {
  if (process.platform === "win32") return;
  try {
    chmodSync(storageStatePath, 0o600);
  } catch {
    /* ignore */
  }
}

export async function createAuthenticatedContext(
  config: AppConfig,
  browser: Browser,
): Promise<BrowserContext> {
  return browser.newContext({
    storageState: config.storageStatePath,
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
}

export async function isReauthRequired(page: Page): Promise<boolean> {
  const url = page.url();
  if (url.includes("login") || url.includes("#/login")) return true;
  for (const selector of LOGIN_FORM_SELECTORS) {
    if (await page.locator(selector).first().isVisible().catch(() => false)) {
      return true;
    }
  }
  return false;
}

export async function runAuthBootstrap(config: AppConfig, log: Logger): Promise<void> {
  ensureAuthDirs(config);

  const headless = config.GPS51_HEADLESS;
  log.info(
    { login_url: config.loginUrl, headless: !headless ? "headed" : "headless" },
    "Opening GPS51 login — enter BXAW credentials manually when headed",
  );

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  try {
    await page.goto(config.loginUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    log.info("Waiting for manual login (up to 10 minutes)...");

    await waitForAuthSuccess(page, config, log);

    await context.storageState({ path: config.storageStatePath });
    restrictStorageStatePermissions(config.storageStatePath);

    const screenshotPath = `${config.captureDir}/auth-success.png`;
    await page.screenshot({ path: screenshotPath, fullPage: false });

    log.info(
      { storage_state_saved: true, screenshot: screenshotPath },
      "Authentication bootstrap complete",
    );
  } finally {
    await context.close();
    await browser.close();
  }
}

async function waitForAuthSuccess(page: Page, config: AppConfig, log: Logger): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < AUTH_WAIT_MS) {
    const url = page.url();
    if (config.GPS51_AUTH_SUCCESS_URL_PATTERN && url.includes(config.GPS51_AUTH_SUCCESS_URL_PATTERN)) {
      log.info("Login success detected via URL pattern");
      return;
    }
    if (await hasMonitorNavigation(page)) {
      log.info("Login success detected via Monitor/Manage navigation");
      return;
    }
    if (!(await hasLoginForm(page)) && !url.includes("login")) {
      log.info({ hostname: new URL(url).hostname }, "Login success detected — login form gone");
      return;
    }
    await page.waitForTimeout(1500);
  }
  throw new Error("Timed out waiting for manual GPS51 login");
}

async function hasLoginForm(page: Page): Promise<boolean> {
  for (const selector of LOGIN_FORM_SELECTORS) {
    if (await page.locator(selector).first().isVisible().catch(() => false)) return true;
  }
  return false;
}

async function hasMonitorNavigation(page: Page): Promise<boolean> {
  for (const selector of MONITOR_NAV_SELECTORS) {
    if (await page.locator(selector).first().isVisible().catch(() => false)) return true;
  }
  const bodyText = await page.locator("body").innerText().catch(() => "");
  return /monitor|manage|tracking|real.?time/i.test(bodyText);
}

const isMain = process.argv[1]?.includes("bootstrap");

if (isMain) {
  void (async () => {
    const { loadConfig } = await import("../config.js");
    const { createLogger } = await import("../logger.js");
    const config = loadConfig(process.env);
    const log = createLogger(config);
    try {
      await runAuthBootstrap(config, log);
      process.exit(0);
    } catch (err) {
      log.error({ err: err instanceof Error ? err.message : String(err) }, "Auth bootstrap failed");
      process.exit(1);
    }
  })();
}
