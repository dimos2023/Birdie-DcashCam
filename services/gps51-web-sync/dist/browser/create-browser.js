import { chromium } from "playwright";
export async function launchBrowser(config, options) {
    const headless = options?.forceHeadless ?? config.GPS51_HEADLESS;
    return chromium.launch({
        headless,
        args: ["--disable-dev-shm-usage", "--no-sandbox"],
    });
}
