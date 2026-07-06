export type SanitizedStateEntry = {
    path: string;
    type: "primitive" | "array" | "object";
    value?: string | number | boolean | null;
    length?: number;
    keyCount?: number;
};
export type ChangedStatePath = {
    path: string;
    before: SanitizedStateEntry | null;
    after: SanitizedStateEntry;
    changeKind: "primitive" | "array_length" | "object_keys";
};
export type VueComponentRecord = {
    componentPath: string;
    componentName: string | null;
    fileHint: string | null;
    dataKeys: string[];
    propKeys: string[];
    computedKeys: string[];
    methodKeys: string[];
    watcherKeys: string[];
    arrayStateLengths: Record<string, number>;
    objectStateKeyCounts: Record<string, number>;
};
export type FunctionSourceRecord = {
    componentPath: string;
    componentName: string | null;
    kind: "computed" | "method" | "watch" | "filter";
    name: string;
    snippet: string;
    matchedTerms: string[];
};
export type BrowserFilterProbeResult = {
    components: VueComponentRecord[];
    stateSnapshot: SanitizedStateEntry[];
    functionSources: FunctionSourceRecord[];
    collectionHits: Array<{
        dataPath: string;
        matchedInventoryIds: string[];
        collectionLength: number;
    }>;
    rowSignature: string;
};
export declare function compareStateSnapshots(before: SanitizedStateEntry[], after: SanitizedStateEntry[]): ChangedStatePath[];
export declare function isFrameworkStatePath(path: string): boolean;
export declare function buildStatusFilterProbeScript(inventorySample: string[], tabLabels: string[]): string;
export declare function normalizeBrowserFilterProbe(raw: unknown): BrowserFilterProbeResult;
