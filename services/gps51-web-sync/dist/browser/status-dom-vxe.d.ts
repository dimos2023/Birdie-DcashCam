import type { Page } from "playwright";
import { type VxeCandidateDiagnostic, type VxeExtractionMethod } from "../gps51/status-dom-vxe-core.js";
export type VxeTabExtractionResult = {
    deviceIds: string[];
    extractionMethod: VxeExtractionMethod;
    selectedDataPath: string | null;
    candidateDatasetCounts: VxeCandidateDiagnostic[];
    datasetSignature: string;
};
export declare function buildVxeExtractionScript(inventoryIds: string[], tabName: string, portalCount?: number | null): string;
export declare function buildVxeVirtualScrollScript(inventoryIds: string[]): string;
export declare function extractVxeDeviceIdsForCurrentTab(page: Page, inventoryIds: Set<string>, tabName: string, portalCount: number | null): Promise<VxeTabExtractionResult>;
