import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { FORBIDDEN_CLICK_TEXT } from "../gps51/selectors.js";
import { buildWebSocketSendScript, parsePortalStatusCountsFromText, } from "./browser-page-scripts.js";
import { incrementSubscriptionErrors, setSubscriptionBatchCount, setSubscriptionCompletedAt, setSubscribedDeviceCount, } from "../worker/live-sync-metrics.js";
import { COUNT_BADGE_SELECTORS, clickStatusTab, MASTER_DEVICE_TREE_SELECTORS, } from "./monitor-dom-safety.js";
function isForbidden(text) {
    return FORBIDDEN_CLICK_TEXT.some((w) => text.toLowerCase().includes(w.toLowerCase()));
}
export function loadSubscriptionFrameTemplate(captureDir) {
    const summaryPath = path.join(captureDir, "subscription-summary.json");
    if (!existsSync(summaryPath))
        return null;
    try {
        const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
        if (!summary.recommendedFrame)
            return null;
        return {
            payload: summary.recommendedFrame,
            deviceIdField: summary.deviceIdField ?? "deviceids",
            supportsBatch: true,
        };
    }
    catch {
        return null;
    }
}
export async function trySendWebSocketSubscription(page, template, deviceIds) {
    const frame = buildSubscriptionPayload(template, deviceIds);
    const script = buildWebSocketSendScript(JSON.stringify(frame));
    return page.evaluate(script);
}
export function buildSubscriptionPayload(template, deviceIds) {
    const payload = { ...template.payload };
    payload[template.deviceIdField] = deviceIds;
    if (deviceIds.length === 1) {
        payload.deviceid = deviceIds[0];
    }
    return payload;
}
export async function subscribeViaMonitorUi(page, log) {
    await clickStatusTab(page, "all");
    await page.waitForTimeout(1000);
    const masterCount = await clickMasterCheckbox(page);
    if (masterCount > 0) {
        log.info({ selected_hint: masterCount }, "Selected devices via master checkbox");
        return masterCount;
    }
    const groupCount = await clickGroupCheckbox(page, DEFAULT_GROUP);
    if (groupCount > 0) {
        log.info({ selected_hint: groupCount }, "Selected devices via default group checkbox");
        return groupCount;
    }
    const treeCount = await selectAllTreeCheckboxes(page);
    log.info({ selected_hint: treeCount }, "Selected devices via tree checkboxes");
    return treeCount;
}
export async function subscribeAllInventoryDevices(page, config, deviceIds, log) {
    if (!config.GPS51_SUBSCRIBE_ALL) {
        return { subscribedCount: 0, method: "ui" };
    }
    const template = loadSubscriptionFrameTemplate(config.captureDir);
    const batches = chunk(deviceIds, config.GPS51_SUBSCRIPTION_BATCH_SIZE);
    let subscribedCount = 0;
    let method = "ui";
    let wsSuccess = false;
    if (template) {
        setSubscriptionBatchCount(batches.length);
        for (const batch of batches) {
            const sent = await trySendWebSocketSubscription(page, template, batch);
            if (sent) {
                wsSuccess = true;
                subscribedCount += batch.length;
                method = "websocket";
            }
            else {
                incrementSubscriptionErrors();
                break;
            }
            await sleep(config.GPS51_SUBSCRIPTION_BATCH_DELAY_MS);
        }
    }
    if (!wsSuccess) {
        const uiCount = await subscribeViaMonitorUi(page, log);
        subscribedCount = Math.max(subscribedCount, uiCount, deviceIds.length);
        method = wsSuccess ? "mixed" : "ui";
    }
    else {
        subscribedCount = deviceIds.length;
    }
    setSubscribedDeviceCount(subscribedCount);
    setSubscriptionCompletedAt(new Date().toISOString());
    return { subscribedCount, method };
}
const DEFAULT_GROUP = ["Default", "Default group", "默认"];
export async function readPortalStatusCounts(page) {
    const text = await page.locator("body").innerText().catch(() => "");
    const parsed = parsePortalStatusCountsFromText(text);
    if (parsed.all != null && parsed.online != null && parsed.offline != null) {
        return parsed;
    }
    for (const selector of COUNT_BADGE_SELECTORS) {
        const badges = page.locator(selector);
        const count = Math.min(await badges.count().catch(() => 0), 20);
        for (let i = 0; i < count; i++) {
            const badgeText = (await badges.nth(i).innerText().catch(() => "")).trim();
            const numeric = Number(badgeText.replace(/[^\d]/g, ""));
            if (!Number.isFinite(numeric) || numeric <= 0)
                continue;
            if (parsed.all == null && /all/i.test(badgeText))
                parsed.all = numeric;
            if (parsed.online == null && /online/i.test(badgeText))
                parsed.online = numeric;
            if (parsed.offline == null && /offline/i.test(badgeText))
                parsed.offline = numeric;
        }
    }
    return parsed;
}
export async function clickTab(page, labels) {
    for (const label of labels) {
        const strategies = [
            page.getByRole("tab", { name: new RegExp(label, "i") }).first(),
            page.locator(`text=${label}`).first(),
            page.getByRole("button", { name: new RegExp(label, "i") }).first(),
            page.locator("[class*='tab'], .ivu-tabs-tab, .el-tabs__item").filter({ hasText: label }).first(),
        ];
        for (const tab of strategies) {
            if (!(await tab.isVisible().catch(() => false)))
                continue;
            const text = (await tab.innerText().catch(() => label)).trim();
            if (isForbidden(text))
                continue;
            await tab.click({ timeout: 3000 }).catch(() => undefined);
            await page.waitForTimeout(800);
            return true;
        }
    }
    return false;
}
export async function clickAllDevicesTab(page) {
    const result = await clickStatusTab(page, "all");
    return result.clicked;
}
export async function clickOnlineTab(page) {
    const result = await clickStatusTab(page, "online");
    return result.clicked;
}
export async function clickOfflineTab(page) {
    const result = await clickStatusTab(page, "offline");
    return result.clicked;
}
async function clickMasterCheckbox(page) {
    for (const selector of MASTER_DEVICE_TREE_SELECTORS) {
        const box = page.locator(selector).first();
        if (!(await box.isVisible().catch(() => false)))
            continue;
        await box.click({ timeout: 2000 }).catch(() => undefined);
        await page.waitForTimeout(500);
        return await countCheckedBoxes(page);
    }
    return 0;
}
async function clickGroupCheckbox(page, labels) {
    for (const label of labels) {
        const row = page.locator(".ivu-tree-title, .el-tree-node__content").filter({ hasText: label }).first();
        if (!(await row.isVisible().catch(() => false)))
            continue;
        const checkbox = row.locator("input[type='checkbox'], .ivu-checkbox, .el-checkbox").first();
        if (await checkbox.isVisible().catch(() => false)) {
            await checkbox.click({ timeout: 2000 }).catch(() => undefined);
            await page.waitForTimeout(500);
            return await countCheckedBoxes(page);
        }
    }
    return 0;
}
async function selectAllTreeCheckboxes(page) {
    const boxes = page.locator(".ivu-tree input[type='checkbox'], .el-tree input[type='checkbox']");
    const count = Math.min(await boxes.count(), 30);
    for (let i = 0; i < count; i++) {
        await boxes.nth(i).click({ timeout: 1000 }).catch(() => undefined);
    }
    return await countCheckedBoxes(page);
}
async function countCheckedBoxes(page) {
    return page.locator("input[type='checkbox']:checked").count();
}
function chunk(items, size) {
    const out = [];
    for (let i = 0; i < items.length; i += size) {
        out.push(items.slice(i, i + size));
    }
    return out;
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
export async function selectOneDeviceCheckbox(page) {
    const box = page.locator(".ivu-tree input[type='checkbox'], .el-tree input[type='checkbox']").first();
    if (!(await box.isVisible().catch(() => false)))
        return false;
    await box.click({ timeout: 2000 }).catch(() => undefined);
    await page.waitForTimeout(800);
    return true;
}
