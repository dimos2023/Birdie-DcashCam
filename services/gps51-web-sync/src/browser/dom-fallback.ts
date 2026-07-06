import type { Page } from "playwright";
import {
  DEVICE_DETAIL_LABELS,
  DEVICE_TREE_ROW_SELECTORS,
  FORBIDDEN_CLICK_TEXT,
} from "../gps51/selectors.js";
import type { NormalizedGps51Device } from "../gps51/types.js";
import { normalizeDeviceRecord } from "../gps51/normalizer.js";

export async function scrapeDevicesFromDom(
  page: Page,
  maxDevices: number,
): Promise<NormalizedGps51Device[]> {
  const devices: NormalizedGps51Device[] = [];
  const seen = new Set<string>();

  for (const selector of DEVICE_TREE_ROW_SELECTORS) {
    const rows = page.locator(selector);
    const count = await rows.count();
    for (let i = 0; i < count && devices.length < maxDevices; i++) {
      const row = rows.nth(i);
      const text = (await row.innerText().catch(() => "")).trim();
      if (!text || isForbiddenInteraction(text)) continue;

      const deviceId = extractDeviceIdFromText(text);
      if (!deviceId || seen.has(deviceId)) continue;
      seen.add(deviceId);

      const online = /online|acc on|moving/i.test(text);
      const offline = /offline|acc off|expired/i.test(text);

      devices.push(
        normalizeDeviceRecord(
          {
            deviceid: deviceId,
            devicename: text.split("\n")[0],
            online: online ? 1 : offline ? 0 : undefined,
          },
          "dom",
        ),
      );
    }
  }

  const detail = await readDetailPanel(page);
  if (detail?.sourceDeviceId && !seen.has(detail.sourceDeviceId)) {
    devices.push(detail);
  }

  return devices;
}

async function readDetailPanel(page: Page): Promise<NormalizedGps51Device | null> {
  const bodyText = await page.locator("body").innerText().catch(() => "");
  if (!bodyText.includes("Device ID") && !bodyText.includes("device id")) return null;

  const fields: Record<string, string> = {};
  for (const label of DEVICE_DETAIL_LABELS) {
    const pattern = new RegExp(`${label}\\s*[:：]\\s*(.+)$`, "im");
    const match = bodyText.match(pattern);
    if (match?.[1]) fields[label] = match[1].trim();
  }

  const deviceId = fields["Device ID"] ?? fields["device id"];
  if (!deviceId) return null;

  return normalizeDeviceRecord(
    {
      deviceid: deviceId,
      devicename: fields.Name ?? fields["Plate"] ?? null,
      latitude: parseFloat(fields.Latitude ?? fields.lat ?? ""),
      longitude: parseFloat(fields.Longitude ?? fields.lng ?? ""),
      speed: parseFloat(fields.Speed ?? ""),
      address: fields.Address ?? null,
      gpstime: fields.Update ?? fields["Loc Type"] ?? null,
      acc: /acc on/i.test(bodyText) ? 1 : /acc off/i.test(bodyText) ? 0 : undefined,
    },
    "dom",
  );
}

function extractDeviceIdFromText(text: string): string | null {
  const imei = text.match(/\b(\d{14,17})\b/);
  if (imei) return imei[1];
  const shortId = text.match(/\b(\d{8,13})\b/);
  return shortId?.[1] ?? null;
}

function isForbiddenInteraction(text: string): boolean {
  return FORBIDDEN_CLICK_TEXT.some((word) => text.toLowerCase().includes(word.toLowerCase()));
}

export async function safeScrollDeviceTree(page: Page): Promise<void> {
  const scrollers = page.locator(
    ".device-tree, .tree, [class*='device-list'], [class*='sidebar'], .ivu-tree, .el-tree",
  );
  const count = await scrollers.count();
  for (let i = 0; i < count; i++) {
    await scrollers
      .nth(i)
      .evaluate((el) => {
        el.scrollTop = Math.min(el.scrollTop + 400, el.scrollHeight);
      })
      .catch(() => undefined);
    await page.waitForTimeout(300);
  }
}
