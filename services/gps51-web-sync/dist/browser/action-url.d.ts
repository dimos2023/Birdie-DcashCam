export declare function extractUrlAction(url: string): string | null;
export declare function isTrackedAction(action: string | null): action is string;
export declare function trackedActions(): string[];
/** Actions that must not be treated as canonical device inventory. */
export declare function isAlarmOrAuxiliaryAction(action: string | null): boolean;
export declare function isDeviceTreeAction(action: string | null): boolean;
