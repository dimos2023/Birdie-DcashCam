const TRACKED_ACTIONS = new Set([
  "querydevicestree",
  "queryalarm",
  "querylastdevicemedias",
  "querymsg",
]);

export function extractUrlAction(url: string): string | null {
  try {
    const parsed = new URL(url);
    const action = parsed.searchParams.get("action");
    return action?.toLowerCase() ?? null;
  } catch {
    const match = url.match(/[?&]action=([^&]+)/i);
    return match?.[1]?.toLowerCase() ?? null;
  }
}

export function isTrackedAction(action: string | null): action is string {
  return action != null && TRACKED_ACTIONS.has(action);
}

export function trackedActions(): string[] {
  return [...TRACKED_ACTIONS];
}

/** Actions that must not be treated as canonical device inventory. */
export function isAlarmOrAuxiliaryAction(action: string | null): boolean {
  return action === "queryalarm" || action === "querymsg" || action === "querylastdevicemedias";
}

export function isDeviceTreeAction(action: string | null): boolean {
  return action === "querydevicestree";
}
