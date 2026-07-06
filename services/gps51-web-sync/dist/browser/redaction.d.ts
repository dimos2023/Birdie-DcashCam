export declare function isSecretFieldName(key: string): boolean;
export declare function redactSecrets<T>(value: T, depth?: number): T;
export declare function sanitizeUrl(url: string): string;
export declare function sanitizeRequestPayload(raw: string | null): unknown | null;
