const EXACT_SECRET_KEYS = new Set([
  "token",
  "authorization",
  "cookie",
  "password",
  "access_token",
  "refresh_token",
  "session",
  "secret",
  "service_role",
  "api_key",
  "key",
]);

const SECRET_KEY_PATTERN =
  /token|password|secret|authorization|cookie|session|credential|apikey|api_key|access_key|refresh|service_role/i;

export function isSecretFieldName(key: string): boolean {
  const lower = key.toLowerCase();
  if (EXACT_SECRET_KEYS.has(lower)) return true;
  return SECRET_KEY_PATTERN.test(key);
}

export function redactSecrets<T>(value: T, depth = 0): T {
  if (depth > 20) return "[TRUNCATED]" as T;
  if (value == null || typeof value !== "object") return value;

  if (Array.isArray(value)) {
    return value.map((item) => redactSecrets(item, depth + 1)) as T;
  }

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (isSecretFieldName(key)) {
      out[key] = "[REDACTED]";
      continue;
    }
    if (typeof val === "string" && val.length > 500 && SECRET_KEY_PATTERN.test(val)) {
      out[key] = "[REDACTED]";
      continue;
    }
    out[key] = redactSecrets(val, depth + 1);
  }
  return out as T;
}

export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    for (const key of [...parsed.searchParams.keys()]) {
      if (isSecretFieldName(key)) {
        parsed.searchParams.set(key, "[REDACTED]");
      }
    }
    return parsed.toString();
  } catch {
    return url.split("?")[0] ?? url;
  }
}

export function sanitizeRequestPayload(raw: string | null): unknown | null {
  if (!raw?.trim()) return null;
  try {
    return redactSecrets(JSON.parse(raw));
  } catch {
    return null;
  }
}
