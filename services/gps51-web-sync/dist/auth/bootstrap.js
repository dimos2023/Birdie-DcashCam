import { chmodSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { LOGIN_FORM_SELECTORS, MONITOR_NAV_SELECTORS } from "../gps51/selectors.js";
import { persistSessionStorage } from "./session-storage.js";
const AUTH_WAIT_MS = 10 * 60 * 1000;
export function storageStateExists(config) {
    return existsSync(config.storageStatePath);
}
export function ensureAuthDirs(config) {
    mkdirSync(path.dirname(config.storageStatePath), { recursive: true });
    mkdirSync(config.captureDir, { recursive: true });
}
export function restrictStorageStatePermissions(storageStatePath) {
    if (process.platform === "win32")
        return;
    try {
        chmodSync(storageStatePath, 0o600);
    }
    catch {
        /* ignore */
    }
}
export async function persistAuthArtifacts(context, page, config, log) {
    await context.storageState({ path: config.storageStatePath });
    restrictStorageStatePermissions(config.storageStatePath);
    const sessionResult = await persistSessionStorage(page, config);
    if (sessionResult.saved) {
        log.info({ session_storage_keys: sessionResult.keyCount }, "Session storage snapshot saved");
    }
    const screenshotPath = `${config.captureDir}/auth-success.png`;
    await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => undefined);
    log.info({ storage_state_saved: true, screenshot: screenshotPath }, "Authentication artifacts saved");
}
export async function isReauthRequired(page) {
    const url = page.url();
    if (url.includes("login") || url.includes("#/login"))
        return true;
    for (const selector of LOGIN_FORM_SELECTORS) {
        if (await page.locator(selector).first().isVisible().catch(() => false)) {
            return true;
        }
    }
    return false;
}
export async function waitForAuthSuccess(page, config, log) {
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
async function hasLoginForm(page) {
    for (const selector of LOGIN_FORM_SELECTORS) {
        if (await page.locator(selector).first().isVisible().catch(() => false))
            return true;
    }
    return false;
}
async function hasMonitorNavigation(page) {
    for (const selector of MONITOR_NAV_SELECTORS) {
        if (await page.locator(selector).first().isVisible().catch(() => false))
            return true;
    }
    const bodyText = await page.locator("body").innerText().catch(() => "");
    return /monitor|manage|tracking|real.?time/i.test(bodyText);
}
export async function runAuthBootstrap(config, log, options = {}) {
    const closeOnSuccess = options.closeOnSuccess ?? true;
    ensureAuthDirs(config);
    if (!closeOnSuccess) {
        const { ensureAuthenticatedPage } = await import("./authenticated-page.js");
        return ensureAuthenticatedPage(config, log, {
            forceHeadless: options.forceHeadless,
            targetUrl: options.targetUrl,
        });
    }
    const headless = options.forceHeadless ?? config.GPS51_HEADLESS;
    log.info({ login_url: config.loginUrl, headless: !headless ? "headed" : "headless" }, "Opening GPS51 login — enter credentials manually when headed");
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
        await persistAuthArtifacts(context, page, config, log);
        const targetUrl = options.targetUrl ?? config.monitorUrl;
        await page.goto(targetUrl, {
            waitUntil: "domcontentloaded",
            timeout: config.SYNC_REQUEST_TIMEOUT_MS,
        });
        log.info("Authentication bootstrap complete");
    }
    finally {
        await context.close();
        await browser.close();
    }
}
const isMain = process.argv[1]?.includes("bootstrap");
if (isMain) {
    void (async () => {
        const { loadConfig } = await import("../config.js");
        const { createLogger } = await import("../logger.js");
        const config = loadConfig(process.env);
        const log = createLogger(config);
        try {
            await runAuthBootstrap(config, log, { closeOnSuccess: true });
            process.exit(0);
        }
        catch (err) {
            log.error({ err: err instanceof Error ? err.message : String(err) }, "Auth bootstrap failed");
            process.exit(1);
        }
    })();
}
