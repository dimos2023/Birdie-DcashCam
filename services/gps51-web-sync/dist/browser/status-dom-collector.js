import { DEVICE_TREE_ROW_SELECTORS, FORBIDDEN_CLICK_TEXT } from "../gps51/selectors.js";
import { scrollDeviceTreeSafely } from "./monitor-dom-safety.js";
const DEVICE_ID_PATTERN = /\b(\d{14,17})\b/g;
function isForbidden(text) {
    return FORBIDDEN_CLICK_TEXT.some((word) => text.toLowerCase().includes(word.toLowerCase()));
}
export function extractDeviceIdsFromText(text) {
    const ids = new Set();
    for (const match of text.matchAll(DEVICE_ID_PATTERN)) {
        if (match[1])
            ids.add(match[1]);
    }
    return [...ids];
}
export async function collectVisibleDeviceIds(page, maxScrollPasses = 20) {
    const ids = new Set();
    let scrollPasses = 0;
    for (let pass = 0; pass < maxScrollPasses; pass++) {
        scrollPasses = pass + 1;
        const bodyText = await page.locator("body").innerText().catch(() => "");
        for (const id of extractDeviceIdsFromText(bodyText))
            ids.add(id);
        for (const selector of DEVICE_TREE_ROW_SELECTORS) {
            const rows = page.locator(selector);
            const count = Math.min(await rows.count().catch(() => 0), 500);
            for (let i = 0; i < count; i++) {
                const text = (await rows.nth(i).innerText().catch(() => "")).trim();
                if (!text || isForbidden(text))
                    continue;
                for (const id of extractDeviceIdsFromText(text))
                    ids.add(id);
            }
        }
        const scrolled = await scrollDeviceTreeSafely(page);
        if (!scrolled)
            break;
        await page.waitForTimeout(400);
    }
    return { deviceIds: [...ids].sort(), scrollPasses };
}
export function reconcileDeviceSets(input) {
    const onlineSet = new Set(input.onlineIds);
    const offlineSet = new Set(input.offlineIds);
    const allSet = new Set(input.allIds.length > 0 ? input.allIds : [...onlineSet, ...offlineSet]);
    const duplicateOnline = input.onlineIds.filter((id, idx) => input.onlineIds.indexOf(id) !== idx);
    const duplicateOffline = input.offlineIds.filter((id, idx) => input.offlineIds.indexOf(id) !== idx);
    const missingInventory = [...input.inventoryIds].filter((id) => !allSet.has(id));
    const extraInventory = [...allSet].filter((id) => !input.inventoryIds.has(id));
    const overlap = [...input.inventoryIds].filter((id) => allSet.has(id)).length;
    const overlapInventoryPercent = input.inventoryIds.size === 0 ? 0 : Math.round((overlap / input.inventoryIds.size) * 100);
    return {
        onlineCount: onlineSet.size,
        offlineCount: offlineSet.size,
        allCount: allSet.size,
        duplicateOnline: [...new Set(duplicateOnline)],
        duplicateOffline: [...new Set(duplicateOffline)],
        missingInventory,
        extraInventory,
        overlapInventoryPercent,
    };
}
