import { buildMappingVariants, evaluateFieldMapping, isLowCardinalityProfile, pickBestFieldCandidate, profileDeviceFields, } from "./status-model-field-profiler.js";
import { isExcludedDeviceStatusField } from "./status-filter-internals.js";
export function profileStatusFilterDeviceFields(records) {
    return profileDeviceFields(records).filter((profile) => !isExcludedDeviceStatusField(profile.fieldPath));
}
export function discoverStatusFilterFieldCandidates(records, portal, options = {}) {
    const minDevices = options.minDevicesWithField ?? 500;
    const maxDistinct = options.maxDistinct ?? 20;
    const tolerance = options.tolerance ?? 2;
    const minUnionPercent = options.minUnionPercent ?? 99;
    const profiles = profileStatusFilterDeviceFields(records);
    const candidates = [];
    for (const profile of profiles) {
        if (!isLowCardinalityProfile(profile, maxDistinct))
            continue;
        if (profile.devicesContaining < minDevices)
            continue;
        if (isExcludedDeviceStatusField(profile.fieldPath))
            continue;
        const distinctValues = Object.keys(profile.valueDistribution);
        for (const mapping of buildMappingVariants(distinctValues)) {
            const evaluation = evaluateFieldMapping(records, profile.fieldPath, mapping);
            const onlineCount = evaluation.onlineDeviceIds.length;
            const offlineCount = evaluation.offlineDeviceIds.length;
            const intersection = evaluation.onlineDeviceIds.filter((id) => evaluation.offlineDeviceIds.includes(id));
            const unionSet = new Set([...evaluation.onlineDeviceIds, ...evaluation.offlineDeviceIds]);
            const unionCoveragePercent = records.length === 0 ? 0 : Math.round((unionSet.size / records.length) * 100);
            const onlineDelta = portal.online != null ? Math.abs(onlineCount - portal.online) : Number.MAX_SAFE_INTEGER;
            const offlineDelta = portal.offline != null ? Math.abs(offlineCount - portal.offline) : Number.MAX_SAFE_INTEGER;
            const validationReasons = [];
            if (evaluation.unknownCount > 0)
                validationReasons.push(`unknown_values_${evaluation.unknownCount}`);
            if (intersection.length > 0)
                validationReasons.push(`intersection_${intersection.length}`);
            if (onlineDelta > tolerance)
                validationReasons.push(`online_delta_${onlineDelta}`);
            if (offlineDelta > tolerance)
                validationReasons.push(`offline_delta_${offlineDelta}`);
            if (unionCoveragePercent < minUnionPercent) {
                validationReasons.push(`union_coverage_${unionCoveragePercent}`);
            }
            candidates.push({
                source: "querydevicestree",
                fieldPath: profile.fieldPath,
                mapping,
                onlineCount,
                offlineCount,
                unknownCount: evaluation.unknownCount,
                onlineDeviceIds: evaluation.onlineDeviceIds,
                offlineDeviceIds: evaluation.offlineDeviceIds,
                onlineDelta,
                offlineDelta,
                validated: validationReasons.length === 0,
                validationReasons,
                devicesWithField: profile.devicesContaining,
                distinctValueCount: profile.distinctValueCount,
                unionCoveragePercent,
            });
        }
    }
    return candidates.sort((a, b) => {
        if (a.validated !== b.validated)
            return a.validated ? -1 : 1;
        return a.onlineDelta + a.offlineDelta - (b.onlineDelta + b.offlineDelta);
    });
}
export function pickBestStatusFilterFieldCandidate(candidates) {
    return pickBestFieldCandidate(candidates);
}
