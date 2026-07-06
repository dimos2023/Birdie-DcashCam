export declare const VUE_INTERNAL_KEYS: Set<string>;
export declare function isFrameworkInternalKey(key: string): boolean;
export declare function isExcludedDeviceStatusField(fieldPath: string): boolean;
export declare function sanitizeStateKey(key: string): boolean;
export declare function redactSensitiveText(text: string): string;
export declare function extractFunctionSnippet(source: string, terms: string[], maxLength?: number): string;
export declare const FUNCTION_SOURCE_SEARCH_TERMS: readonly ["deviceid", "filter(", "online", "offline", "status", "lastactivetime", "offlinedelay", "active", "login", "connection", "tree", "monitor"];
