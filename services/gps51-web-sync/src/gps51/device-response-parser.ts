import { DEVICE_ID_KEYS, LOCATION_KEYS } from "./selectors.js";
import { collectRecordArrays, normalizeDeviceRecord } from "./normalizer.js";
import type { NormalizedGps51Device } from "./types.js";
import { extractUrlAction, isAlarmOrAuxiliaryAction, isDeviceTreeAction } from "../browser/action-url.js";

const AUTH_URL_HINTS = ["login", "auth", "account", "userinfo", "captcha"];
const MAP_URL_HINTS = [".png", ".jpg", "tile", "mapbox", "googleapis/maps"];

export function scoreJsonPayload(body: unknown, url: string, action?: string | null): number {
  let score = 0;
  const lowerUrl = url.toLowerCase();
  const resolvedAction = action ?? extractUrlAction(url);

  if (isAlarmOrAuxiliaryAction(resolvedAction)) return -25;
  if (isDeviceTreeAction(resolvedAction)) return 20;

  if (AUTH_URL_HINTS.some((h) => lowerUrl.includes(h))) score -= 10;
  if (MAP_URL_HINTS.some((h) => lowerUrl.includes(h))) score -= 10;

  if (/device|monitor|location|vehicle|terminal|gps|list|position|track|query/i.test(lowerUrl)) {
    score += 3;
  }

  const arrays = collectRecordArrays(body);
  if (arrays.length === 0) return score;

  score += 5;

  const sample = arrays[0];
  const keys = Object.keys(sample).map((k) => k.toLowerCase());

  if (DEVICE_ID_KEYS.some((k) => keys.includes(k.toLowerCase()))) score += 5;
  if (keys.some((k) => /name|plate|device/.test(k))) score += 3;
  if (LOCATION_KEYS.some((k) => keys.includes(k.toLowerCase()))) score += 5;
  if (keys.some((k) => /speed|acc|status|online/.test(k))) score += 3;

  return score;
}

/** Generic parser — excludes alarm/auxiliary actions. Prefer parseDeviceTree for inventory. */
export function parseDevicesFromPayload(payload: unknown, url?: string): NormalizedGps51Device[] {
  if (url) {
    const action = extractUrlAction(url);
    if (isAlarmOrAuxiliaryAction(action)) return [];
  }

  const records = collectRecordArrays(payload);
  return records
    .map((record) => normalizeDeviceRecord(record, "network"))
    .filter((d) => d.sourceDeviceId !== "unknown");
}

export function pickBestDeviceListPayload(
  candidates: Array<{ score: number; sanitizedBody: unknown; action?: string | null }>,
): unknown {
  const sorted = [...candidates]
    .filter((c) => !isAlarmOrAuxiliaryAction(c.action ?? null))
    .sort((a, b) => b.score - a.score);
  return sorted[0]?.sanitizedBody ?? null;
}
