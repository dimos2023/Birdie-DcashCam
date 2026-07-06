export declare function normalizeUnknownArray(value: unknown): unknown[];
export declare function normalizeRecordArray(value: unknown): Array<Record<string, unknown>>;
export declare function normalizeStringArray(value: unknown): string[];
export declare function describeEvaluateResultType(value: unknown): string;
export declare function appendUniqueReasons(reasons: string[], extra: string[]): string[];
export type AppStatePathEntry = {
    path: string;
    type: string;
    length: number;
};
export declare function normalizeAppStatePathEntries(value: unknown): AppStatePathEntry[];
