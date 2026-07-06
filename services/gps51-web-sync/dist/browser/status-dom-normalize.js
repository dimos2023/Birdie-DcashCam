export function normalizeUnknownArray(value) {
    return Array.isArray(value) ? value : [];
}
export function normalizeRecordArray(value) {
    if (!Array.isArray(value))
        return [];
    return value.filter((item) => item !== null && typeof item === "object" && !Array.isArray(item));
}
export function normalizeStringArray(value) {
    if (!Array.isArray(value))
        return [];
    return value.filter((item) => typeof item === "string");
}
export function describeEvaluateResultType(value) {
    if (value === undefined)
        return "undefined";
    if (value === null)
        return "null";
    if (Array.isArray(value))
        return "array";
    return typeof value;
}
export function appendUniqueReasons(reasons, extra) {
    const merged = new Set(reasons);
    for (const reason of extra) {
        if (reason)
            merged.add(reason);
    }
    return [...merged];
}
export function normalizeAppStatePathEntries(value) {
    return normalizeRecordArray(value)
        .map((entry) => ({
        path: typeof entry.path === "string" ? entry.path : "",
        type: typeof entry.type === "string" ? entry.type : "unknown",
        length: typeof entry.length === "number" && Number.isFinite(entry.length) ? entry.length : 0,
    }))
        .filter((entry) => entry.path.length > 0 && entry.path !== "window");
}
