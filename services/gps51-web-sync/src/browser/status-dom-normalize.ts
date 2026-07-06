export function normalizeUnknownArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function normalizeRecordArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Record<string, unknown> =>
      item !== null && typeof item === "object" && !Array.isArray(item),
  );
}

export function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function describeEvaluateResultType(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

export function appendUniqueReasons(reasons: string[], extra: string[]): string[] {
  const merged = new Set(reasons);
  for (const reason of extra) {
    if (reason) merged.add(reason);
  }
  return [...merged];
}

export type AppStatePathEntry = {
  path: string;
  type: string;
  length: number;
};

export function normalizeAppStatePathEntries(value: unknown): AppStatePathEntry[] {
  return normalizeRecordArray(value)
    .map((entry) => ({
      path: typeof entry.path === "string" ? entry.path : "",
      type: typeof entry.type === "string" ? entry.type : "unknown",
      length: typeof entry.length === "number" && Number.isFinite(entry.length) ? entry.length : 0,
    }))
    .filter((entry) => entry.path.length > 0 && entry.path !== "window");
}
