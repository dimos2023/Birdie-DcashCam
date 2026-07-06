import { existsSync } from "node:fs";
import { launchBrowser } from "../browser/create-browser.js";
import { ensureAuthDirs, isReauthRequired, persistAuthArtifacts, waitForAuthSuccess, } from "./bootstrap.js";
import { applySessionStorageInitScript, sessionStorageExists, } from "./session-storage.js";
export async function createAuthenticatedContext(config, browser) {
    const context = await browser.newContext({
        storageState: existsSync(config.storageStatePath) ? config.storageStatePath : undefined,
        viewport: { width: 1440, height: 900 },
        ignoreHTTPSErrors: true,
    });
    await applySessionStorageInitScript(context, config);
    return context;
}
export async function ensureAuthenticatedPage(config, log, options = {}) {
    ensureAuthDirs(config);
    const headless = options.forceHeadless ?? config.GPS51_HEADLESS;
    const targetUrl = options.targetUrl ?? config.monitorUrl;
    const browser = await launchBrowser(config, { forceHeadless: headless });
    const context = await createAuthenticatedContext(config, browser);
    const page = await context.newPage();
    const cleanup = async () => {
        await context.close().catch(() => undefined);
        await browser.close().catch(() => undefined);
    };
    try {
        log.info({
            target_url: targetUrl,
            storage_state: existsSync(config.storageStatePath),
            session_storage: sessionStorageExists(config),
        }, "Opening GPS51 monitor with saved session");
        await page.goto(targetUrl, {
            waitUntil: "domcontentloaded",
            timeout: config.SYNC_REQUEST_TIMEOUT_MS,
        });
        if (!(await isReauthRequired(page))) {
            log.info("Saved GPS51 session is valid");
            return { browser, context, page, cleanup };
        }
        log.warn("Saved GPS51 session is invalid — starting embedded manual login");
        await page.goto(config.loginUrl, {
            waitUntil: "domcontentloaded",
            timeout: 60_000,
        });
        log.info("Waiting for manual login (up to 10 minutes)...");
        await waitForAuthSuccess(page, config, log);
        await persistAuthArtifacts(context, page, config, log);
        await page.goto(targetUrl, {
            waitUntil: "domcontentloaded",
            timeout: config.SYNC_REQUEST_TIMEOUT_MS,
        });
        if (await isReauthRequired(page)) {
            await cleanup();
            throw new Error("GPS51 session still invalid after manual login");
        }
        log.info({ target_url: targetUrl }, "Embedded login complete — continuing on authenticated page");
        return { browser, context, page, cleanup };
    }
    catch (err) {
        await cleanup();
        throw err;
    }
}
