export interface NormalizedGps51Device {
  sourceDeviceId: string;
  deviceName: string | null;
  imei: string | null;
  simNo: string | null;
  groupPath: string | null;
  onlineStatus: "online" | "offline" | "unknown";
  sourceUpdatedAt: string | null;
  sourceLocatedAt: string | null;
  latitude: number | null;
  longitude: number | null;
  speedKmh: number | null;
  accOn: boolean | null;
  statusText: string | null;
  address: string | null;
  satelliteCount: number | null;
  cellularSignalPercent: number | null;
  mileageKm: number | null;
  mediaChannels: Array<{
    logicalChannel: string;
    name: string | null;
  }>;
  raw: Record<string, unknown>;
}

export type ParseSource = "network" | "dom" | "fixture";
