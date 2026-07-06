import { FORBIDDEN_CLICK_TEXT } from "../gps51/selectors.js";
import { safeScrollDeviceTree } from "./dom-fallback.js";
const ALL_DEVICES_TAB_LABELS = ["All devices", "All Devices", "All", "全部设备", "全部"];
const REFRESH_LABELS = ["Refresh", "刷新", "Reload"];
function isForbiddenInteraction(text) {
    const lower = text.toLowerCase();
    return FORBIDDEN_CLICK_TEXT.some((word) => lower.includes(word.toLowerCase()));
}
async function clickSafeByLabels(page, labels) {
    for (const label of labels) {
        const candidates = [
            page.getByRole("tab", { name: new RegExp(label, "i") }),
            page.getByRole("button", { name: new RegExp(label, "i") }),
            page.locator(`text=${label}`),
        ];
        for (const locator of candidates) {
            const target = locator.first();
            const visible = await target.isVisible().catch(() => false);
            if (!visible)
                continue;
            const text = (await target.innerText().catch(() => label)).trim();
            if (isForbiddenInteraction(text))
                continue;
            await target.click({ timeout: 3000 }).catch(() => undefined);
            await page.waitForTimeout(800);
            return true;
        }
    }
    return false;
}
async function expandReadOnlyTreeNodes(page) {
    const expandIcons = page.locator(".ivu-tree-arrow, .el-tree-node__expand-icon, .tree-switcher, [class*='expand-icon'], [aria-expanded='false']");
    const count = Math.min(await expandIcons.count(), 20);
    for (let i = 0; i < count; i++) {
        const icon = expandIcons.nth(i);
        const parentText = (await icon.locator("xpath=ancestor::*[1]").innerText().catch(() => "")).trim();
        if (parentText && isForbiddenInteraction(parentText))
            continue;
        await icon.click({ timeout: 1500 }).catch(() => undefined);
        await page.waitForTimeout(200);
    }
}
export async function performSafeLiveDiscoveryInteractions(page) {
    await clickSafeByLabels(page, ALL_DEVICES_TAB_LABELS);
    await expandReadOnlyTreeNodes(page);
    await clickSafeByLabels(page, REFRESH_LABELS);
    await safeScrollDeviceTree(page);
}
export async function performPeriodicLiveDiscoveryInteractions(page) {
    await safeScrollDeviceTree(page);
    await expandReadOnlyTreeNodes(page);
}
