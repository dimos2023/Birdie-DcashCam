import type { Page } from "playwright";
import { STATUS_TAB_FALLBACKS } from "./monitor-dom-safety.js";
import type { DomPortalCounts } from "../gps51/status-dom-reconciliation.js";
export type TabClickDiagnostics = {
    clicked: boolean;
    matchedLabel: string | null;
    matchedElementTag: string | null;
    matchedElementClasses: string | null;
    clickableAncestorTag: string | null;
    clickableAncestorClasses: string | null;
    textBeforeClick: string | null;
    textAfterClick: string | null;
    strategy: string | null;
};
export type TabSelectionEvidence = {
    ariaSelected: boolean;
    activeClass: boolean;
    classChangedAfterClick: boolean;
    portalCountMatches: boolean;
    rowSignatureChanged: boolean;
    anotherTabLostActive: boolean;
    selected: boolean;
    reasons: string[];
};
export declare function buildClickStatusTabScript(labels: string[]): string;
export declare function normalizeTabClickDiagnostics(raw: unknown): TabClickDiagnostics;
export declare function clickStatusTabSafely(page: Page, tab: keyof typeof STATUS_TAB_FALLBACKS): Promise<TabClickDiagnostics & {
    classChangedAfterClick: boolean;
}>;
export declare function waitForStablePortalCount(page: Page, tab: keyof typeof STATUS_TAB_FALLBACKS, settleMs: number): Promise<{
    before: number | null;
    after: number | null;
    counts: DomPortalCounts;
}>;
export declare function waitForLoadingToSettle(page: Page, timeoutMs?: number): Promise<boolean>;
export declare function buildTabSelectionEvidence(input: {
    clickDiagnostics: TabClickDiagnostics & {
        classChangedAfterClick?: boolean;
    };
    ariaSelected: boolean;
    activeClass: boolean;
    portalCountMatches: boolean;
    rowSignatureChanged: boolean;
    anotherTabLostActive: boolean;
}): TabSelectionEvidence;
export declare function buildInspectTabActiveStateScript(labels: string[]): string;
export declare function inspectTabActiveState(page: Page, tab: keyof typeof STATUS_TAB_FALLBACKS): Promise<{
    ariaSelected: boolean;
    activeClass: boolean;
}>;
