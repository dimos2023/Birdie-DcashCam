import { chromium, type Browser } from "playwright";
import type { AppConfig } from "../config.js";

export async function launchBrowser(config: AppConfig, options?: { forceHeadless?: boolean }): Promise<Browser> {
  const headless = options?.forceHeadless ?? config.GPS51_HEADLESS;
  return chromium.launch({
    headless,
    args: ["--disable-dev-shm-usage", "--no-sandbox"],
  });
}
