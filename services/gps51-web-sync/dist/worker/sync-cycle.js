import { launchBrowser } from "../browser/create-browser.js";
import { NetworkCapture, waitForNetworkSettle } from "../browser/network-capture.js";
import { safeScrollDeviceTree, scrapeDevicesFromDom } from "../browser/dom-fallback.js";
import { createAuthenticatedContext, isReauthRequired } from "../auth/session.js";
import { parseDevicesFromPayload, pickBestDeviceListPayload } from "../gps51/device-response-parser.js";
import { dedupeDevices } from "../gps51/normalizer.js";
import { ensureAccount, finishSyncRun, insertPositionIfNew, markAccountReauth, markAccountSynced, saveRawPayload, startSyncRun, upsertDevice, } from "../db/repositories.js";
export async function runSyncCycle(sb, config, log) {
    const started = Date.now();
    const account = await ensureAccount(sb, config.ORGANIZATION_ID, config.GPS51_USERNAME, config.GPS51_BASE_URL, config.monitorUrl);
    const runId = await startSyncRun(sb, config.ORGANIZATION_ID, account.id, "sync");
    let devicesUpserted = 0;
    let positionsInserted = 0;
    let parseFailures = 0;
    let reauthRequired = false;
    const browser = await launchBrowser(config, { forceHeadless: true });
    const context = await createAuthenticatedContext(config, browser);
    const page = await context.newPage();
    const capture = new NetworkCapture();
    capture.attach(page);
    try {
        await page.goto(config.monitorUrl, {
            waitUntil: "domcontentloaded",
            timeout: config.SYNC_REQUEST_TIMEOUT_MS,
        });
        if (await isReauthRequired(page)) {
            reauthRequired = true;
            await markAccountReauth(sb, account.id, "Redirected to login — run npm run auth");
            await finishSyncRun(sb, runId, {
                status: "reauth_required",
                duration_ms: Date.now() - started,
                error_message: "Authentication expired",
            });
            return {
                runId,
                status: "reauth_required",
                devicesVisible: 0,
                devicesUpserted: 0,
                positionsInserted: 0,
                parseFailures: 0,
                reauthRequired: true,
                errorMessage: "Authentication expired",
            };
        }
        await waitForNetworkSettle(page, config.SYNC_REQUEST_TIMEOUT_MS);
        await safeScrollDeviceTree(page);
        await page.waitForTimeout(1500);
        const candidates = capture.getCandidates(3);
        const bestPayload = pickBestDeviceListPayload(candidates);
        let devices = [];
        if (bestPayload) {
            try {
                devices = parseDevicesFromPayload(bestPayload);
                const top = candidates[0];
                if (top) {
                    await saveRawPayload(sb, config.ORGANIZATION_ID, account.id, runId, top.payloadHash, top.sanitizedBody, top.url, "device_list");
                }
            }
            catch {
                parseFailures += 1;
            }
        }
        if (devices.length === 0) {
            log.warn("Network parse empty — using DOM fallback");
            try {
                devices = await scrapeDevicesFromDom(page, config.SYNC_MAX_DEVICES);
            }
            catch {
                parseFailures += 1;
            }
        }
        devices = dedupeDevices(devices).slice(0, config.SYNC_MAX_DEVICES);
        for (const device of devices) {
            try {
                const deviceId = await upsertDevice(sb, config.ORGANIZATION_ID, account.id, device);
                devicesUpserted += 1;
                const inserted = await insertPositionIfNew(sb, config.ORGANIZATION_ID, account.id, deviceId, runId, device);
                if (inserted)
                    positionsInserted += 1;
            }
            catch {
                parseFailures += 1;
            }
        }
        const status = parseFailures > 0 && devicesUpserted > 0 ? "partial" : "success";
        await finishSyncRun(sb, runId, {
            status,
            devices_visible: devices.length,
            devices_upserted: devicesUpserted,
            positions_inserted: positionsInserted,
            parse_failures: parseFailures,
            duration_ms: Date.now() - started,
            summary: { hostname: new URL(config.monitorUrl).hostname },
        });
        await markAccountSynced(sb, account.id, status);
        log.info({
            sync_run_id: runId,
            account_id: account.id,
            devices_visible: devices.length,
            devices_upserted: devicesUpserted,
            positions_inserted: positionsInserted,
            duration_ms: Date.now() - started,
        }, "Sync cycle complete");
        return {
            runId,
            status,
            devicesVisible: devices.length,
            devicesUpserted,
            positionsInserted,
            parseFailures,
            reauthRequired: false,
            errorMessage: null,
        };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Sync failed";
        await finishSyncRun(sb, runId, {
            status: "failed",
            devices_upserted: devicesUpserted,
            positions_inserted: positionsInserted,
            parse_failures: parseFailures,
            duration_ms: Date.now() - started,
            error_message: message,
        });
        await markAccountSynced(sb, account.id, "failed", message);
        log.error({ sync_run_id: runId, err: message }, "Sync cycle failed");
        return {
            runId,
            status: "failed",
            devicesVisible: 0,
            devicesUpserted,
            positionsInserted,
            parseFailures,
            reauthRequired,
            errorMessage: message,
        };
    }
    finally {
        await context.close();
        await browser.close();
    }
}
