export async function ensureAccount(sb, organizationId, username, portalUrl, monitorUrl) {
    const { data: existing } = await sb
        .from("gps51_web_accounts")
        .select("id, organization_id, username, status")
        .eq("organization_id", organizationId)
        .eq("username", username)
        .eq("portal_url", portalUrl)
        .maybeSingle();
    if (existing)
        return existing;
    const { data, error } = await sb
        .from("gps51_web_accounts")
        .insert({
        organization_id: organizationId,
        username,
        portal_url: portalUrl,
        monitor_url: monitorUrl,
        status: "active",
        last_auth_at: new Date().toISOString(),
    })
        .select("id, organization_id, username, status")
        .single();
    if (error)
        throw new Error(error.message);
    return data;
}
export async function markAccountReauth(sb, accountId, message) {
    await sb
        .from("gps51_web_accounts")
        .update({
        status: "reauth_required",
        last_error: message,
        updated_at: new Date().toISOString(),
    })
        .eq("id", accountId);
}
export async function markAccountSynced(sb, accountId, status, error) {
    await sb
        .from("gps51_web_accounts")
        .update({
        status: status === "reauth_required" ? "reauth_required" : "active",
        last_sync_at: new Date().toISOString(),
        last_sync_status: status,
        last_error: error ?? null,
    })
        .eq("id", accountId);
}
export async function startSyncRun(sb, organizationId, accountId, mode = "sync") {
    const { data, error } = await sb
        .from("gps51_web_sync_runs")
        .insert({
        organization_id: organizationId,
        account_id: accountId,
        status: "running",
        mode,
    })
        .select("id")
        .single();
    if (error)
        throw new Error(error.message);
    return data.id;
}
export async function finishSyncRun(sb, runId, patch) {
    const { error } = await sb
        .from("gps51_web_sync_runs")
        .update({
        ...patch,
        finished_at: new Date().toISOString(),
    })
        .eq("id", runId);
    if (error)
        throw new Error(error.message);
}
export async function upsertDevice(sb, organizationId, accountId, device) {
    const { data, error } = await sb
        .from("gps51_web_devices")
        .upsert({
        organization_id: organizationId,
        account_id: accountId,
        source_device_id: device.sourceDeviceId,
        device_name: device.deviceName,
        imei: device.imei,
        sim_no: device.simNo,
        group_path: device.groupPath,
        online_status: device.onlineStatus,
        source_updated_at: device.sourceUpdatedAt,
        source_located_at: device.sourceLocatedAt,
        latitude: device.latitude,
        longitude: device.longitude,
        speed_kmh: device.speedKmh,
        acc_on: device.accOn,
        status_text: device.statusText,
        address: device.address,
        satellite_count: device.satelliteCount,
        cellular_signal_percent: device.cellularSignalPercent,
        mileage_km: device.mileageKm,
        media_channels: device.mediaChannels,
        last_scraped_at: new Date().toISOString(),
        raw_snapshot: device.raw,
    }, { onConflict: "account_id,source_device_id" })
        .select("id")
        .single();
    if (error)
        throw new Error(error.message);
    return data.id;
}
export async function insertPositionIfNew(sb, organizationId, accountId, gps51DeviceId, syncRunId, device) {
    if (device.latitude == null || device.longitude == null)
        return false;
    const { error } = await sb.from("gps51_web_positions").insert({
        organization_id: organizationId,
        account_id: accountId,
        gps51_device_id: gps51DeviceId,
        sync_run_id: syncRunId,
        source_updated_at: device.sourceUpdatedAt,
        source_located_at: device.sourceLocatedAt,
        latitude: device.latitude,
        longitude: device.longitude,
        speed_kmh: device.speedKmh,
        acc_on: device.accOn,
        online_status: device.onlineStatus,
        status_text: device.statusText,
        address: device.address,
        satellite_count: device.satelliteCount,
        cellular_signal_percent: device.cellularSignalPercent,
        mileage_km: device.mileageKm,
        raw_payload: device.raw,
    });
    if (error) {
        if (error.code === "23505")
            return false;
        throw new Error(error.message);
    }
    return true;
}
export async function saveRawPayload(sb, organizationId, accountId, syncRunId, payloadHash, sanitizedPayload, sourceUrl, payloadKind) {
    await sb.from("gps51_web_raw_payloads").upsert({
        organization_id: organizationId,
        account_id: accountId,
        sync_run_id: syncRunId,
        payload_hash: payloadHash,
        sanitized_payload: sanitizedPayload,
        source_url: sourceUrl,
        payload_kind: payloadKind,
    }, { onConflict: "account_id,payload_hash" });
}
