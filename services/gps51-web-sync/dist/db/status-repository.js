import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { STATUS_BOOTSTRAP_SUMMARY_FILE, buildDeviceTreeStatusMetadata, loadCalibratedRuleFromSummary, } from "../gps51/status-bootstrap-parser.js";
export async function fetchStatusDeviceRows(sb, accountId) {
    const { data, error } = await sb
        .from("gps51_web_devices")
        .select("id, source_device_id, online_status, metadata, birdie_device_id, vehicle_id, customer_id, latitude, longitude")
        .eq("account_id", accountId);
    if (error)
        throw new Error(error.message);
    return (data ?? []);
}
export function buildTreeStatusUpdates(evaluations, calculatedAt) {
    const updates = [];
    for (const evaluation of evaluations.values()) {
        updates.push({
            sourceDeviceId: evaluation.sourceDeviceId,
            onlineStatus: evaluation.status,
            evaluation,
        });
    }
    return updates;
}
export async function applyTreeStatusUpdates(sb, accountId, updates, existingRows, calculatedAt) {
    const bySourceId = new Map(existingRows.map((row) => [row.source_device_id, row]));
    let updated = 0;
    let online = 0;
    let offline = 0;
    let unknown = 0;
    for (const update of updates) {
        const existing = bySourceId.get(update.sourceDeviceId);
        if (!existing)
            continue;
        if (update.onlineStatus === "online")
            online += 1;
        else if (update.onlineStatus === "offline")
            offline += 1;
        else
            unknown += 1;
        const metadata = {
            ...(existing.metadata ?? {}),
            ...buildDeviceTreeStatusMetadata(update.evaluation, calculatedAt),
        };
        const patch = {
            online_status: update.onlineStatus,
            last_scraped_at: calculatedAt,
            metadata,
        };
        if (update.evaluation.lastActiveMs != null) {
            patch.source_updated_at = new Date(update.evaluation.lastActiveMs).toISOString();
        }
        if (existing.online_status === update.onlineStatus)
            continue;
        const { error } = await sb
            .from("gps51_web_devices")
            .update(patch)
            .eq("id", existing.id)
            .eq("account_id", accountId);
        if (!error)
            updated += 1;
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
export function compareBootstrapToPortal(calculated, portal) {
    let delta = 0;
    if (portal.online != null)
        delta += Math.abs(calculated.online - portal.online);
    if (portal.offline != null)
        delta += Math.abs(calculated.offline - portal.offline);
    return delta;
}
export function loadCalibratedRuleFromCaptureDir(captureDir) {
    const summaryPath = path.join(captureDir, STATUS_BOOTSTRAP_SUMMARY_FILE);
    if (!existsSync(summaryPath))
        return null;
    try {
        const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
        return loadCalibratedRuleFromSummary(summary);
    }
    catch {
        return null;
    }
}
export function preservedDeviceLinksIntact(before, after) {
    if (before.birdie_device_id && !after.birdie_device_id)
        return false;
    if (before.vehicle_id && !after.vehicle_id)
        return false;
    if (before.customer_id && !after.customer_id)
        return false;
    return true;
}
export function preservedPositionIntact(before, after) {
    if (before.latitude != null && after.latitude == null)
        return false;
    if (before.longitude != null && after.longitude == null)
        return false;
    return true;
}
/**
 * Status precedence for display / merge decisions:
 * 1. Fresh WebSocket positionLast => online
 * 2. Fresh querydevicestree snapshot => authoritative online/offline
 * 3. Otherwise unknown
 */
export function resolveStatusPrecedence(input) {
    if (input.websocketPositionJustReceived)
        return "online";
    if (input.hasTreeSnapshot && input.treeStatus !== "unknown")
        return input.treeStatus;
    if (input.hasTreeSnapshot)
        return "unknown";
    return "unknown";
}
export function buildDomStatusMetadata(calculatedAt, statusPortalTab) {
    return {
        online_status_source: "gps51_monitor_filtered_tree",
        status_snapshot_at: calculatedAt,
        status_portal_tab: statusPortalTab,
    };
}
export function buildTreeNodeStatusMetadata(calculatedAt) {
    return {
        online_status_source: "gps51_device_list_tree_nodes",
        status_snapshot_at: calculatedAt,
        status_field: "treeNode.isOnline",
        status_mapping: "isOnline/online truthy => online; falsy => offline",
    };
}
export function buildTreeStatusPatches(existingRows, onlineIds, offlineIds, calculatedAt) {
    const patches = [];
    for (const row of existingRows) {
        let nextStatus = null;
        if (onlineIds.has(row.source_device_id)) {
            nextStatus = "online";
        }
        else if (offlineIds.has(row.source_device_id)) {
            nextStatus = "offline";
        }
        if (!nextStatus)
            continue;
        if (row.online_status === nextStatus)
            continue;
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
export async function applyTreeStatusBulkUpdates(sb, organizationId, accountId, patches, batchSize = 100) {
    if (patches.length === 0)
        return { updated: 0, changed: 0 };
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
        if (!error)
            updated += chunk.length;
    }
    return { updated, changed: patches.length };
}
export function buildDomStatusPatches(existingRows, onlineIds, offlineIds, calculatedAt) {
    const patches = [];
    for (const row of existingRows) {
        let nextStatus = null;
        let tab = null;
        if (onlineIds.has(row.source_device_id)) {
            nextStatus = "online";
            tab = "online";
        }
        else if (offlineIds.has(row.source_device_id)) {
            nextStatus = "offline";
            tab = "offline";
        }
        if (!nextStatus || !tab)
            continue;
        if (row.online_status === nextStatus)
            continue;
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
export async function applyDomStatusUpdates(sb, organizationId, accountId, patches, batchSize = 100) {
    if (patches.length === 0)
        return { updated: 0, skipped: 0 };
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
        if (!error)
            updated += chunk.length;
    }
    return { updated, skipped: 0 };
}
