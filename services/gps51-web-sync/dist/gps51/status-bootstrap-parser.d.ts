export type BootstrapDeviceRecord = {
    sourceDeviceId: string;
    deviceName: string | null;
    lastActiveTimeRaw: unknown;
    offlineDelayRaw: unknown;
    raw: Record<string, unknown>;
};
export type StatusRuleType = "explicit_online_field" | "lastactivetime_threshold";
export type StatusCalibrationRule = {
    ruleType: StatusRuleType;
    lastActiveTimeUnit?: "milliseconds" | "seconds";
    offlineDelayUnit?: "seconds" | "minutes" | "milliseconds";
    thresholdSeconds?: number;
};
export type BootstrapStatusCounts = {
    total: number;
    online: number;
    offline: number;
    unknown: number;
};
export type DeviceStatusEvaluation = {
    sourceDeviceId: string;
    status: "online" | "offline" | "unknown";
    lastActiveMs: number | null;
    offlineDelaySeconds: number | null;
    lastActiveSourceValue: unknown;
    offlineDelaySourceValue: unknown;
};
export type CalibrationCandidate = {
    rule: StatusCalibrationRule;
    counts: BootstrapStatusCounts;
    mismatchCount: number;
    onlineDelta: number;
    offlineDelta: number;
};
export type BootstrapCalibrationResult = {
    selectedRule: StatusCalibrationRule | null;
    calculatedCounts: BootstrapStatusCounts;
    mismatchCount: number;
    onlineDelta: number;
    offlineDelta: number;
    candidatesWithinTolerance: number;
};
declare const STATUS_BOOTSTRAP_SUMMARY_FILE = "status-bootstrap-summary.json";
export declare function parseExplicitOnlineStatus(record: Record<string, unknown>): "online" | "offline" | "unknown";
export declare function collectBootstrapDeviceRecords(payload: unknown): BootstrapDeviceRecord[];
export declare function findDuplicateDeviceIds(payload: unknown): string[];
export declare function parseLastActiveMs(raw: unknown, unit: "milliseconds" | "seconds"): number | null;
export declare function isValidLastActiveTime(raw: unknown, unit: "milliseconds" | "seconds"): boolean;
export declare function parseOfflineDelaySeconds(raw: unknown, unit: "seconds" | "minutes" | "milliseconds", fallbackSeconds: number): number;
export declare function isValidOfflineDelay(raw: unknown): boolean;
export declare function evaluateDeviceStatus(record: BootstrapDeviceRecord, rule: StatusCalibrationRule, nowMs?: number): DeviceStatusEvaluation;
export declare function evaluateAllDeviceStatuses(records: BootstrapDeviceRecord[], rule: StatusCalibrationRule, nowMs?: number): Map<string, DeviceStatusEvaluation>;
export declare function summarizeDeviceStatuses(evaluations: Map<string, DeviceStatusEvaluation>): BootstrapStatusCounts;
export declare function scorePortalDelta(counts: BootstrapStatusCounts, portal: {
    online: number | null;
    offline: number | null;
}): {
    mismatchCount: number;
    onlineDelta: number;
    offlineDelta: number;
};
export declare function buildCalibrationCandidates(records: BootstrapDeviceRecord[], portal: {
    online: number | null;
    offline: number | null;
}, defaultThresholdSeconds: number, nowMs?: number): CalibrationCandidate[];
export declare function calibrateStatusRule(records: BootstrapDeviceRecord[], portal: {
    online: number | null;
    offline: number | null;
}, defaultThresholdSeconds: number, maxMismatch?: number, nowMs?: number): BootstrapCalibrationResult;
export declare function countInvalidLastActiveTime(records: BootstrapDeviceRecord[], rule: StatusCalibrationRule): number;
export declare function countInvalidOfflineDelay(records: BootstrapDeviceRecord[], rule: StatusCalibrationRule): number;
export declare function buildDeviceTreeStatusMetadata(evaluation: DeviceStatusEvaluation, calculatedAt: string): Record<string, unknown>;
export declare function formatSelectedRule(rule: StatusCalibrationRule): string;
export declare function loadCalibratedRuleFromSummary(summary: Record<string, unknown>): StatusCalibrationRule | null;
export { STATUS_BOOTSTRAP_SUMMARY_FILE };
