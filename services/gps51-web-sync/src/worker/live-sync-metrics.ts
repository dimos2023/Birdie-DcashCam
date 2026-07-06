export type LiveSyncMetrics = {
  websocketConnected: boolean;
  authenticated: boolean;
  reauthRequired: boolean;
  lastFrameAt: string | null;
  lastPositionAt: string | null;
  framesReceived: number;
  positionsAccepted: number;
  positionsRejected: number;
  remindMsgCount: number;
  uniqueDevicesSeen: number;
  reconnectCount: number;
  parseErrors: number;
};

const metrics: LiveSyncMetrics = {
  websocketConnected: false,
  authenticated: false,
  reauthRequired: false,
  lastFrameAt: null,
  lastPositionAt: null,
  framesReceived: 0,
  positionsAccepted: 0,
  positionsRejected: 0,
  remindMsgCount: 0,
  uniqueDevicesSeen: 0,
  reconnectCount: 0,
  parseErrors: 0,
};

export function getLiveSyncMetrics(): LiveSyncMetrics {
  return { ...metrics };
}

export function resetLiveSyncMetrics(): void {
  metrics.websocketConnected = false;
  metrics.authenticated = false;
  metrics.reauthRequired = false;
  metrics.lastFrameAt = null;
  metrics.lastPositionAt = null;
  metrics.framesReceived = 0;
  metrics.positionsAccepted = 0;
  metrics.positionsRejected = 0;
  metrics.remindMsgCount = 0;
  metrics.uniqueDevicesSeen = 0;
  metrics.reconnectCount = 0;
  metrics.parseErrors = 0;
}

export function setLiveAuthenticated(value: boolean): void {
  metrics.authenticated = value;
}

export function setLiveWebsocketConnected(value: boolean): void {
  metrics.websocketConnected = value;
}

export function setLiveReauthRequired(value: boolean): void {
  metrics.reauthRequired = value;
}

export function incrementLiveFramesReceived(): void {
  metrics.framesReceived += 1;
  metrics.lastFrameAt = new Date().toISOString();
}

export function incrementLivePositionsAccepted(): void {
  metrics.positionsAccepted += 1;
  metrics.lastPositionAt = new Date().toISOString();
}

export function incrementLivePositionsRejected(): void {
  metrics.positionsRejected += 1;
}

export function incrementLiveRemindMsgCount(): void {
  metrics.remindMsgCount += 1;
}

export function incrementLiveParseErrors(): void {
  metrics.parseErrors += 1;
}

export function incrementLiveReconnectCount(): void {
  metrics.reconnectCount += 1;
}

export function setLiveUniqueDevicesSeen(count: number): void {
  metrics.uniqueDevicesSeen = count;
}

export function liveMetricsForHealth(): Record<string, unknown> {
  const m = getLiveSyncMetrics();
  return {
    websocketConnected: m.websocketConnected,
    authenticated: m.authenticated,
    lastFrameAt: m.lastFrameAt,
    lastPositionAt: m.lastPositionAt,
    framesReceived: m.framesReceived,
    positionsAccepted: m.positionsAccepted,
    positionsRejected: m.positionsRejected,
    uniqueDevicesSeen: m.uniqueDevicesSeen,
    reconnectCount: m.reconnectCount,
    reauthRequired: m.reauthRequired,
    gps51_websocket_connected: m.websocketConnected ? 1 : 0,
    gps51_frames_received_total: m.framesReceived,
    gps51_positions_inserted_total: m.positionsAccepted,
    gps51_positions_rejected_total: m.positionsRejected,
    gps51_unique_devices_seen: m.uniqueDevicesSeen,
    gps51_websocket_reconnects_total: m.reconnectCount,
  };
}
