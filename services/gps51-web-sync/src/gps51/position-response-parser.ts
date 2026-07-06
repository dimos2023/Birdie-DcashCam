import { parseDevicesFromPayload } from "./device-response-parser.js";
import type { NormalizedGps51Device } from "./types.js";

export function parsePositionsFromPayloads(payloads: unknown[]): NormalizedGps51Device[] {
  const devices: NormalizedGps51Device[] = [];
  for (const payload of payloads) {
    devices.push(...parseDevicesFromPayload(payload));
  }
  return devices.filter((d) => d.latitude != null && d.longitude != null);
}

export function hasPositionData(device: NormalizedGps51Device): boolean {
  return device.latitude != null && device.longitude != null;
}
