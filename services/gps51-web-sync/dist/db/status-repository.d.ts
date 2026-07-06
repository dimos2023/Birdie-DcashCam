import type { SupabaseClient } from "@supabase/supabase-js";
import type { BootstrapStatusCounts, DeviceStatusEvaluation, StatusCalibrationRule } from "../gps51/status-bootstrap-parser.js";
export type StatusDeviceRow = {
    id: string;
    source_device_id: string;
    online_status: string;
    metadata: Record<string, unknown> | null;
    birdie_device_id: string | null;
    vehicle_id: string | null;
    customer_id: string | null;
    latitude: number | null;
    longitude: number | null;
};
export type TreeStatusUpdate = {
    sourceDeviceId: string;
    onlineStatus: "online" | "offline" | "unknown";
    evaluation: DeviceStatusEvaluation;
};
export declare function fetchStatusDeviceRows(sb: SupabaseClient, accountId: string): Promise<StatusDeviceRow[]>;
export declare function buildTreeStatusUpdates(evaluations: Map<string, DeviceStatusEvaluation>, calculatedAt: string): TreeStatusUpdate[];
export declare function applyTreeStatusUpdates(sb: SupabaseClient, accountId: string, updates: TreeStatusUpdate[], existingRows: StatusDeviceRow[], calculatedAt: string): Promise<{
    updated: number;
    counts: BootstrapStatusCounts;
}>;
export declare function compareBootstrapToPortal(calculated: Pick<BootstrapStatusCounts, "online" | "offline">, portal: {
    online: number | null;
    offline: number | null;
}): number;
export declare function loadCalibratedRuleFromCaptureDir(captureDir: string): StatusCalibrationRule | null;
export declare function preservedDeviceLinksIntact(before: StatusDeviceRow, after: StatusDeviceRow): boolean;
export declare function preservedPositionIntact(before: StatusDeviceRow, after: StatusDeviceRow): boolean;
/**
 * Status precedence for display / merge decisions:
 * 1. Fresh WebSocket positionLast => online
 * 2. Fresh querydevicestree snapshot => authoritative online/offline
 * 3. Otherwise unknown
 */
export declare function resolveStatusPrecedence(input: {
    websocketPositionJustReceived: boolean;
    treeStatus: "online" | "offline" | "unknown";
    hasTreeSnapshot: boolean;
}): "online" | "offline" | "unknown";
export type DomStatusPatch = {
    id: string;
    source_device_id: string;
    online_status: "online" | "offline";
    last_scraped_at: string;
    metadata: Record<string, unknown>;
};
export declare function buildDomStatusMetadata(calculatedAt: string, statusPortalTab: "online" | "offline"): Record<string, unknown>;
export declare function buildTreeNodeStatusMetadata(calculatedAt: string): Record<string, unknown>;
export declare function buildTreeStatusPatches(existingRows: StatusDeviceRow[], onlineIds: Set<string>, offlineIds: Set<string>, calculatedAt: string): DomStatusPatch[];
export declare function applyTreeStatusBulkUpdates(sb: SupabaseClient, organizationId: string, accountId: string, patches: DomStatusPatch[], batchSize?: number): Promise<{
    updated: number;
    changed: number;
}>;
export declare function buildDomStatusPatches(existingRows: StatusDeviceRow[], onlineIds: Set<string>, offlineIds: Set<string>, calculatedAt: string): DomStatusPatch[];
export declare function applyDomStatusUpdates(sb: SupabaseClient, organizationId: string, accountId: string, patches: DomStatusPatch[], batchSize?: number): Promise<{
    updated: number;
    skipped: number;
}>;
