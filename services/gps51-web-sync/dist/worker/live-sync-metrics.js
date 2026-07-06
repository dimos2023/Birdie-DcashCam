const metrics = {
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
    uniqueDevicesSeenSinceStartup: 0,
    reconnectCount: 0,
    parseErrors: 0,
    subscribedDeviceCount: 0,
    subscriptionBatchCount: 0,
    subscriptionLastCompletedAt: null,
    subscriptionErrors: 0,
    lastStatusRefreshAt: null,
    statusRefreshSuccess: false,
    statusPortalAllCount: null,
    statusPortalOnlineCount: null,
    statusPortalOfflineCount: null,
    statusExtractedAllCount: 0,
    statusExtractedOnlineCount: 0,
    statusExtractedOfflineCount: 0,
    statusOnlineCount: 0,
    statusOfflineCount: 0,
    statusUnknownCount: 0,
    statusRefreshErrors: 0,
    statusValidationErrors: [],
    statusChangedDeviceCount: 0,
};
export function getLiveSyncMetrics() {
    return { ...metrics };
}
export function resetLiveSyncMetrics() {
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
    metrics.uniqueDevicesSeenSinceStartup = 0;
    metrics.reconnectCount = 0;
    metrics.parseErrors = 0;
    metrics.subscribedDeviceCount = 0;
    metrics.subscriptionBatchCount = 0;
    metrics.subscriptionLastCompletedAt = null;
    metrics.subscriptionErrors = 0;
    metrics.lastStatusRefreshAt = null;
    metrics.statusRefreshSuccess = false;
    metrics.statusPortalAllCount = null;
    metrics.statusPortalOnlineCount = null;
    metrics.statusPortalOfflineCount = null;
    metrics.statusExtractedAllCount = 0;
    metrics.statusExtractedOnlineCount = 0;
    metrics.statusExtractedOfflineCount = 0;
    metrics.statusOnlineCount = 0;
    metrics.statusOfflineCount = 0;
    metrics.statusUnknownCount = 0;
    metrics.statusRefreshErrors = 0;
    metrics.statusValidationErrors = [];
    metrics.statusChangedDeviceCount = 0;
}
export function setLiveAuthenticated(value) {
    metrics.authenticated = value;
}
export function setLiveWebsocketConnected(value) {
    metrics.websocketConnected = value;
}
export function setLiveReauthRequired(value) {
    metrics.reauthRequired = value;
}
export function incrementLiveFramesReceived() {
    metrics.framesReceived += 1;
    metrics.lastFrameAt = new Date().toISOString();
}
export function incrementLivePositionsAccepted() {
    metrics.positionsAccepted += 1;
    metrics.lastPositionAt = new Date().toISOString();
}
export function incrementLivePositionsRejected() {
    metrics.positionsRejected += 1;
}
export function incrementLiveRemindMsgCount() {
    metrics.remindMsgCount += 1;
}
export function incrementLiveParseErrors() {
    metrics.parseErrors += 1;
}
export function incrementLiveReconnectCount() {
    metrics.reconnectCount += 1;
}
export function setLiveUniqueDevicesSeen(count) {
    metrics.uniqueDevicesSeen = count;
    metrics.uniqueDevicesSeenSinceStartup = count;
}
export function setSubscribedDeviceCount(count) {
    metrics.subscribedDeviceCount = count;
}
export function setSubscriptionBatchCount(count) {
    metrics.subscriptionBatchCount = count;
}
export function setSubscriptionCompletedAt(iso) {
    metrics.subscriptionLastCompletedAt = iso;
}
export function incrementSubscriptionErrors() {
    metrics.subscriptionErrors += 1;
}
export function setStatusPortalCounts(all, online, offline, extractedAll, extractedOnline, extractedOffline) {
    metrics.statusPortalAllCount = all;
    metrics.statusPortalOnlineCount = online;
    metrics.statusPortalOfflineCount = offline;
    metrics.statusExtractedAllCount = extractedAll;
    metrics.statusExtractedOnlineCount = extractedOnline;
    metrics.statusExtractedOfflineCount = extractedOffline;
}
export function setStatusChangedDeviceCount(count) {
    metrics.statusChangedDeviceCount = count;
}
export function setStatusValidationErrors(errors) {
    metrics.statusValidationErrors = errors;
}
export function setStatusRefreshSuccess(success) {
    metrics.statusRefreshSuccess = success;
    if (success)
        metrics.lastStatusRefreshAt = new Date().toISOString();
}
export function setStatusRefreshCounts(online, offline, unknown) {
    metrics.statusOnlineCount = online;
    metrics.statusOfflineCount = offline;
    metrics.statusUnknownCount = unknown;
}
export function incrementStatusRefreshErrors() {
    metrics.statusRefreshErrors += 1;
    metrics.statusRefreshSuccess = false;
}
export function liveMetricsForHealth() {
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
        uniqueDevicesSeenSinceStartup: m.uniqueDevicesSeenSinceStartup,
        reconnectCount: m.reconnectCount,
        reauthRequired: m.reauthRequired,
        subscribedDeviceCount: m.subscribedDeviceCount,
        subscriptionBatchCount: m.subscriptionBatchCount,
        subscriptionLastCompletedAt: m.subscriptionLastCompletedAt,
        subscriptionErrors: m.subscriptionErrors,
        gps51_websocket_connected: m.websocketConnected ? 1 : 0,
        gps51_frames_received_total: m.framesReceived,
        gps51_positions_inserted_total: m.positionsAccepted,
        gps51_positions_rejected_total: m.positionsRejected,
        gps51_unique_devices_seen: m.uniqueDevicesSeen,
        gps51_unique_devices_seen_since_startup: m.uniqueDevicesSeenSinceStartup,
        gps51_websocket_reconnects_total: m.reconnectCount,
        gps51_subscribed_device_count: m.subscribedDeviceCount,
        gps51_subscription_batch_count: m.subscriptionBatchCount,
        gps51_subscription_errors_total: m.subscriptionErrors,
        lastStatusRefreshAt: m.lastStatusRefreshAt,
        lastStatusRefreshSuccess: m.statusRefreshSuccess,
        statusPortalAllCount: m.statusPortalAllCount,
        statusPortalOnlineCount: m.statusPortalOnlineCount,
        statusPortalOfflineCount: m.statusPortalOfflineCount,
        statusExtractedAllCount: m.statusExtractedAllCount,
        statusExtractedOnlineCount: m.statusExtractedOnlineCount,
        statusExtractedOfflineCount: m.statusExtractedOfflineCount,
        statusOnlineCount: m.statusOnlineCount,
        statusOfflineCount: m.statusOfflineCount,
        statusUnknownCount: m.statusUnknownCount,
        statusRefreshErrors: m.statusRefreshErrors,
        statusValidationErrors: m.statusValidationErrors,
        statusChangedDeviceCount: m.statusChangedDeviceCount,
        statusRefreshSuccess: m.statusRefreshSuccess,
        gps51_status_refresh_success: m.statusRefreshSuccess ? 1 : 0,
        gps51_status_online_count: m.statusOnlineCount,
        gps51_status_offline_count: m.statusOfflineCount,
        gps51_status_unknown_count: m.statusUnknownCount,
        gps51_status_refresh_errors_total: m.statusRefreshErrors,
    };
}
