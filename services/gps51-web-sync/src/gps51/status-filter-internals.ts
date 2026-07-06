export const VUE_INTERNAL_KEYS = new Set([
  "__ob__",
  "_directInactive",
  "_inactive",
  "_isBeingDestroyed",
  "_isDestroyed",
  "_watchers",
  "_events",
  "_uid",
  "_scope",
  "_vnode",
  "_renderProxy",
  "_self",
  "_staticTrees",
  "_provided",
  "_shallowRef",
]);

const TIMESTAMP_FIELD_PATTERN =
  /(^|\.)(createtime|createTime|createdat|createDate|lastactivetime|lastActiveTime|offlinedelay|offlineDelay|updatetime|updateTime|timestamp|time)$/i;

const NAME_FIELD_PATTERN = /(^|\.)(devicename|deviceName|name|plate|platenumber|simno|remark)$/i;

const ID_FIELD_PATTERN = /(^|\.)(deviceid|deviceId|device_id|id|imei|terminalid)$/i;

export function isFrameworkInternalKey(key: string): boolean {
  if (!key) return true;
  if (key.startsWith("_") || key.startsWith("$")) return true;
  if (VUE_INTERNAL_KEYS.has(key)) return true;
  return false;
}

export function isExcludedDeviceStatusField(fieldPath: string): boolean {
  const leaf = fieldPath.split(".").pop()?.replace(/\[\d+\]$/, "") ?? fieldPath;
  if (isFrameworkInternalKey(leaf)) return true;
  if (TIMESTAMP_FIELD_PATTERN.test(fieldPath)) return true;
  if (NAME_FIELD_PATTERN.test(fieldPath)) return true;
  if (ID_FIELD_PATTERN.test(fieldPath)) return true;
  return false;
}

export function sanitizeStateKey(key: string): boolean {
  return !isFrameworkInternalKey(key);
}

const SECRET_PATTERN =
  /token|password|secret|authorization|cookie|session|credential|apikey|api_key|bearer|auth/i;

export function redactSensitiveText(text: string): string {
  if (SECRET_PATTERN.test(text)) return "[REDACTED]";
  return text;
}

export function extractFunctionSnippet(source: string, terms: string[], maxLength = 500): string {
  const normalized = source.replace(/\s+/g, " ");
  const lower = normalized.toLowerCase();
  let bestIndex = -1;
  for (const term of terms) {
    const index = lower.indexOf(term.toLowerCase());
    if (index >= 0 && (bestIndex < 0 || index < bestIndex)) bestIndex = index;
  }
  if (bestIndex < 0) return normalized.slice(0, maxLength);
  const start = Math.max(0, bestIndex - 120);
  const end = Math.min(normalized.length, start + maxLength);
  return redactSensitiveText(normalized.slice(start, end));
}

export const FUNCTION_SOURCE_SEARCH_TERMS = [
  "deviceid",
  "filter(",
  "online",
  "offline",
  "status",
  "lastactivetime",
  "offlinedelay",
  "active",
  "login",
  "connection",
  "tree",
  "monitor",
] as const;
