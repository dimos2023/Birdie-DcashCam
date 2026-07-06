export type InventoryMediaChannel = {
  logicalChannel: string;
  name: string | null;
};

export type InventoryDeviceMetadata = {
  devicetype?: unknown;
  simiccid?: unknown;
  icon?: unknown;
  overduetime?: unknown;
  isfree?: unknown;
  stared?: unknown;
  creater?: unknown;
  createtime?: unknown;
  forwardid?: unknown;
  remark?: unknown;
  remark2?: unknown;
};

export type InventoryDeviceRecord = {
  sourceDeviceId: string;
  deviceName: string | null;
  simNo: string | null;
  groupPath: string | null;
  onlineStatus: "unknown";
  sourceUpdatedAt: string | null;
  mediaChannels: InventoryMediaChannel[];
  metadata: InventoryDeviceMetadata;
  rawSnapshot: Record<string, unknown>;
};

export type InventoryReconciliation = {
  gps51VisibleDevices: number;
  parsedUniqueDevices: number;
  insertedDevices: number;
  updatedDevices: number;
  unchangedDevices: number;
  databaseDevicesAfterSync: number;
  devicesWithSimNo: number;
  devicesWithVideo: number;
  errors: string[];
  startedAt: string;
  finishedAt: string;
};

export type InventoryDryRunStats = {
  totalDevicesParsed: number;
  uniqueDevices: number;
  duplicates: number;
  accounts: number;
  groups: number;
  devicesWithSimNo: number;
  devicesWithVideo: number;
  devicesWithMissingIdentifier: number;
};

export const MIN_INVENTORY_DEVICE_COUNT = 550;
