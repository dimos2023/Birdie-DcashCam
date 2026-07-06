import type { Page } from "playwright";
export type BundleMatch = {
    bundleUrl: string;
    bundleFile: string;
    nearbyIdentifier: string | null;
    matchingTerm: string;
    snippet: string;
    probablePredicate: string;
};
export declare function buildScriptUrlCollectorScript(): string;
export declare function sanitizeBundleUrl(url: string): string;
export declare function hashBundleContent(content: string): string;
export declare function extractBundleMatches(bundleUrl: string, bundleFile: string, content: string, extraTerms?: string[]): BundleMatch[];
export declare function collectBundleMatches(page: Page, bundleDir: string, extraTerms?: string[]): Promise<BundleMatch[]>;
export declare function scoreBundleMatch(match: BundleMatch): number;
export declare function pickBestBundleMatch(matches: BundleMatch[]): BundleMatch | null;
