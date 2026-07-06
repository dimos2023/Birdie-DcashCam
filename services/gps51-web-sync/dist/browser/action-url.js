const TRACKED_ACTIONS = new Set([
    "querydevicestree",
    "queryalarm",
    "querylastdevicemedias",
    "querymsg",
]);
export function extractUrlAction(url) {
    try {
        const parsed = new URL(url);
        const action = parsed.searchParams.get("action");
        return action?.toLowerCase() ?? null;
    }
    catch {
        const match = url.match(/[?&]action=([^&]+)/i);
        return match?.[1]?.toLowerCase() ?? null;
    }
}
export function isTrackedAction(action) {
    return action != null && TRACKED_ACTIONS.has(action);
}
export function trackedActions() {
    return [...TRACKED_ACTIONS];
}
/** Actions that must not be treated as canonical device inventory. */
export function isAlarmOrAuxiliaryAction(action) {
    return action === "queryalarm" || action === "querymsg" || action === "querylastdevicemedias";
}
export function isDeviceTreeAction(action) {
    return action === "querydevicestree";
}
