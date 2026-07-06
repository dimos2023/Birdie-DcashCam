import type { DomPortalCounts } from "./status-dom-reconciliation.js";
import type { SanitizedRowSample } from "../browser/status-dom-rows.js";
export type StatusIconMapping = {
    iconSignature: string;
    inferredStatus: "online" | "offline";
    matchedDeviceCount: number;
};
export type StatusIconInference = {
    mappings: StatusIconMapping[];
    validated: boolean;
    reason: string | null;
};
export declare function buildIconSignature(classes: string[]): string;
export declare function inferStatusIconMappings(input: {
    rowSamples: Array<SanitizedRowSample & {
        statusIconClasses?: string[];
    }>;
    onlineIds: Set<string>;
    offlineIds: Set<string>;
    portalCounts: DomPortalCounts;
}): StatusIconInference;
