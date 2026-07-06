import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BootstrapStatusCounts,
  DeviceStatusEvaluation,
  StatusCalibrationRule,
} from "../gps51/status-bootstrap-parser.js";
import {
  STATUS_BOOTSTRAP_SUMMARY_FILE,
  buildDeviceTreeStatusMetadata,
  loadCalibratedRuleFromSummary,
} from "../gps51/status-bootstrap-parser.js";

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

export async function fetchStatusDeviceRows(
  sb: SupabaseClient,
  accountId: string,
): Promise<StatusDeviceRow[]> {
  const { data, error } = await sb
    .from("gps51_web_devices")
    .select(
      "id, source_device_id, online_status, metadata, birdie_device_id, vehicle_id, customer_id, latitude, longitude",
    )
    .eq("account_id", accountId);

  if (error) throw new Error(error.message);
  return (data ?? []) as StatusDeviceRow[];
}

export function buildTreeStatusUpdates(
  evaluations: Map<string, DeviceStatusEvaluation>,
  calculatedAt: string,
): TreeStatusUpdate[] {
  const updates: TreeStatusUpdate[] = [];
  for (const evaluation of evaluations.values()) {
    updates.push({
      sourceDeviceId: evaluation.sourceDeviceId,
      onlineStatus: evaluation.status,
      evaluation,
    });
  }
  return updates;
}

export async function applyTreeStatusUpdates(
  sb: SupabaseClient,
  accountId: string,
  updates: TreeStatusUpdate[],
  existingRows: StatusDeviceRow[],
  calculatedAt: string,
): Promise<{ updated: number; counts: BootstrapStatusCounts }> {
  const bySourceId = new Map(existingRows.map((row) => [row.source_device_id, row]));
  let updated = 0;
  let online = 0;
  let offline = 0;
  let unknown = 0;

  for (const update of updates) {
    const existing = bySourceId.get(update.sourceDeviceId);
    if (!existing) continue;

    if (update.onlineStatus === "online") online += 1;
    else if (update.onlineStatus === "offline") offline += 1;
    else unknown += 1;

    const metadata = {
      ...(existing.metadata ?? {}),
      ...buildDeviceTreeStatusMetadata(update.evaluation, calculatedAt),
    };

    const patch: Record<string, unknown> = {
      online_status: update.onlineStatus,
      last_scraped_at: calculatedAt,
      metadata,
    };

    if (update.evaluation.lastActiveMs != null) {
      patch.source_updated_at = new Date(update.evaluation.lastActiveMs).toISOString();
    }

    if (existing.online_status === update.onlineStatus) continue;

    const { error } = await sb
      .from("gps51_web_devices")
      .update(patch)
      .eq("id", existing.id)
      .eq("account_id", accountId);

    if (!error) updated += 1;
  }

  return {
    updated,
    counts: {
      total: updates.length,
      online,
      offline,
      unknown,
    },
  };
}

export function compareBootstrapToPortal(
  calculated: Pick<BootstrapStatusCounts, "online" | "offline">,
  portal: { online: number | null; offline: number | null },
): number {
  let delta = 0;
  if (portal.online != null) delta += Math.abs(calculated.online - portal.online);
  if (portal.offline != null) delta += Math.abs(calculated.offline - portal.offline);
  return delta;
}

export function loadCalibratedRuleFromCaptureDir(
  captureDir: string,
): StatusCalibrationRule | null {
  const summaryPath = path.join(captureDir, STATUS_BOOTSTRAP_SUMMARY_FILE);
  if (!existsSync(summaryPath)) return null;
  try {
    const summary = JSON.parse(readFileSync(summaryPath, "utf8")) as Record<string, unknown>;
    return loadCalibratedRuleFromSummary(summary);
  } catch {
    return null;
  }
}

export function preservedDeviceLinksIntact(before: StatusDeviceRow, after: StatusDeviceRow): boolean {
  if (before.birdie_device_id && !after.birdie_device_id) return false;
  if (before.vehicle_id && !after.vehicle_id) return false;
  if (before.customer_id && !after.customer_id) return false;
  return true;
}

export function preservedPositionIntact(before: StatusDeviceRow, after: StatusDeviceRow): boolean {
  if (before.latitude != null && after.latitude == null) return false;
  if (before.longitude != null && after.longitude == null) return false;
  return true;
}

/**
 * Status precedence for display / merge decisions:
 * 1. Fresh WebSocket positionLast => online
 * 2. Fresh querydevicestree snapshot => authoritative online/offline
 * 3. Otherwise unknown
 */
export function resolveStatusPrecedence(input: {
  websocketPositionJustReceived: boolean;
  treeStatus: "online" | "offline" | "unknown";
  hasTreeSnapshot: boolean;
}): "online" | "offline" | "unknown" {
  if (input.websocketPositionJustReceived) return "online";
  if (input.hasTreeSnapshot && input.treeStatus !== "unknown") return input.treeStatus;
  if (input.hasTreeSnapshot) return "unknown";
  return "unknown";
}

export type DomStatusPatch = {
  id: string;
  source_device_id: string;
  online_status: "online" | "offline";
  last_scraped_at: string;
  metadata: Record<string, unknown>;
};

export function buildDomStatusMetadata(
  calculatedAt: string,
  statusPortalTab: "online" | "offline",
): Record<string, unknown> {
  return {
    online_status_source: "gps51_monitor_filtered_tree",
    status_snapshot_at: calculatedAt,
    status_portal_tab: statusPortalTab,
  };
}

export function buildTreeNodeStatusMetadata(calculatedAt: string): Record<string, unknown> {
  return {
    online_status_source: "gps51_device_list_tree_nodes",
    status_snapshot_at: calculatedAt,
    status_field: "treeNode.isOnline",
    status_mapping: "isOnline/online truthy => online; falsy => offline",
  };
}

export function buildTreeStatusPatches(
  existingRows: StatusDeviceRow[],
  onlineIds: Set<string>,
  offlineIds: Set<string>,
  calculatedAt: string,
): DomStatusPatch[] {
  const patches: DomStatusPatch[] = [];

  for (const row of existingRows) {
    let nextStatus: "online" | "offline" | null = null;

    if (onlineIds.has(row.source_device_id)) {
      nextStatus = "online";
    } else if (offlineIds.has(row.source_device_id)) {
      nextStatus = "offline";
    }

    if (!nextStatus) continue;
    if (row.online_status === nextStatus) continue;

    patches.push({
      id: row.id,
      source_device_id: row.source_device_id,
      online_status: nextStatus,
      last_scraped_at: calculatedAt,
      metadata: {
        ...(row.metadata ?? {}),
        ...buildTreeNodeStatusMetadata(calculatedAt),
      },
    });
  }

  return patches;
}

export async function applyTreeStatusBulkUpdates(
  sb: SupabaseClient,
  organizationId: string,
  accountId: string,
  patches: DomStatusPatch[],
  batchSize = 100,
): Promise<{ updated: number; changed: number }> {
  if (patches.length === 0) return { updated: 0, changed: 0 };

  let updated = 0;
  for (let i = 0; i < patches.length; i += batchSize) {
    const chunk = patches.slice(i, i + batchSize).map((patch) => ({
      id: patch.id,
      organization_id: organizationId,
      account_id: accountId,
      source_device_id: patch.source_device_id,
      online_status: patch.online_status,
      last_scraped_at: patch.last_scraped_at,
      metadata: patch.metadata,
    }));

    const { error } = await sb.from("gps51_web_devices").upsert(chunk, { onConflict: "id" });
    if (!error) updated += chunk.length;
  }

  return { updated, changed: patches.length };
}

export function buildDomStatusPatches(
  existingRows: StatusDeviceRow[],
  onlineIds: Set<string>,
  offlineIds: Set<string>,
  calculatedAt: string,
): DomStatusPatch[] {
  const patches: DomStatusPatch[] = [];

  for (const row of existingRows) {
    let nextStatus: "online" | "offline" | null = null;
    let tab: "online" | "offline" | null = null;

    if (onlineIds.has(row.source_device_id)) {
      nextStatus = "online";
      tab = "online";
    } else if (offlineIds.has(row.source_device_id)) {
      nextStatus = "offline";
      tab = "offline";
    }

    if (!nextStatus || !tab) continue;
    if (row.online_status === nextStatus) continue;

    patches.push({
      id: row.id,
      source_device_id: row.source_device_id,
      online_status: nextStatus,
      last_scraped_at: calculatedAt,
      metadata: {
        ...(row.metadata ?? {}),
        ...buildDomStatusMetadata(calculatedAt, tab),
      },
    });
  }

  return patches;
}

export async function applyDomStatusUpdates(
  sb: SupabaseClient,
  organizationId: string,
  accountId: string,
  patches: DomStatusPatch[],
  batchSize = 100,
): Promise<{ updated: number; skipped: number }> {
  if (patches.length === 0) return { updated: 0, skipped: 0 };

  let updated = 0;
  for (let i = 0; i < patches.length; i += batchSize) {
    const chunk = patches.slice(i, i + batchSize).map((patch) => ({
      id: patch.id,
      organization_id: organizationId,
      account_id: accountId,
      source_device_id: patch.source_device_id,
      online_status: patch.online_status,
      last_scraped_at: patch.last_scraped_at,
      metadata: patch.metadata,
    }));

    const { error } = await sb.from("gps51_web_devices").upsert(chunk, { onConflict: "id" });
    if (!error) updated += chunk.length;
  }

  return { updated, skipped: 0 };
}
