import { parseDevicesFromPayload } from "./device-response-parser.js";
export function parsePositionsFromPayloads(payloads) {
    const devices = [];
    for (const payload of payloads) {
        devices.push(...parseDevicesFromPayload(payload));
    }
    return devices.filter((d) => d.latitude != null && d.longitude != null);
}
export function hasPositionData(device) {
    return device.latitude != null && device.longitude != null;
}
