import { fetchKnownDevices } from "../db/live-position-repository.js";
export async function loadInventoryIdsForRefresh(sb, accountId) {
    const devices = await fetchKnownDevices(sb, accountId);
    return new Set(devices.map((device) => device.source_device_id));
}
