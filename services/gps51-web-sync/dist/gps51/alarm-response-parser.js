import { collectRecordArrays, normalizeDeviceRecord } from "./normalizer.js";
export function parseAlarmPayload(payload) {
    const records = collectRecordArrays(payload);
    return records.map((record) => {
        const normalized = normalizeDeviceRecord(record, "network");
        return {
            kind: "alarm",
            sourceDeviceId: normalized.sourceDeviceId === "unknown" ? null : normalized.sourceDeviceId,
            alarmType: typeof record.alarmtype === "string"
                ? record.alarmtype
                : typeof record.alarmType === "string"
                    ? record.alarmType
                    : typeof record.type === "string"
                        ? record.type
                        : null,
            latitude: normalized.latitude,
            longitude: normalized.longitude,
            speedKmh: normalized.speedKmh,
            recordedAt: normalized.sourceUpdatedAt,
            address: normalized.address,
            raw: record,
        };
    });
}
export function summarizeAlarmPayload(payload) {
    const records = parseAlarmPayload(payload);
    return {
        recordCount: records.length,
        sample: records.slice(0, 5),
    };
}
export function parseMediaPayload(payload) {
    return collectRecordArrays(payload)
        .map((r) => normalizeDeviceRecord(r, "network"))
        .filter((d) => d.sourceDeviceId !== "unknown");
}
