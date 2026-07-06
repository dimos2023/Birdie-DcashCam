import { buildDatasetSignature, portalCountWithinTolerance } from "./status-dom-vxe-core.js";
const FORBIDDEN_DEVICE_SOURCES = /^(html|body|window|document|#app)$/i;
export function isForbiddenDeviceSource(path) {
    return FORBIDDEN_DEVICE_SOURCES.test(path.trim());
}
export function rejectStaleModelCandidate(input) {
    if (isForbiddenDeviceSource(input.dataPath))
        return "forbidden_page_root_source";
    if (input.previousSignatures.includes(input.datasetSignature)) {
        return "identical_dataset_across_tabs";
    }
    if (input.portalCount != null && input.matchedInventoryCount < input.portalCount * 0.9) {
        return "below_90_percent_expected_count";
    }
    return null;
}
export function scoreModelCandidate(input) {
    if (input.rejected)
        return 0;
    let score = input.matchedInventoryCount;
    if (input.hasPerDeviceStatus)
        score += 500;
    if (input.source === "querydevicestree_field")
        score += 1000;
    if (input.source === "vue_state" || input.source === "pinia_store" || input.source === "vuex_store") {
        score += 400;
    }
    if (input.portalCount != null) {
        const delta = Math.abs(input.matchedInventoryCount - input.portalCount);
        if (delta <= 2)
            score += 300;
        else
            score -= delta * 5;
    }
    return score;
}
export function buildModelCandidate(input) {
    const uniqueMatchedIds = [...new Set(input.matchedIds)].sort();
    const datasetSignature = buildDatasetSignature(input.tab, uniqueMatchedIds);
    const rejectionReason = rejectStaleModelCandidate({
        tab: input.tab,
        matchedInventoryCount: uniqueMatchedIds.length,
        portalCount: input.portalCount,
        datasetSignature,
        previousSignatures: input.previousSignatures,
        dataPath: input.dataPath,
    });
    const rejected = rejectionReason != null;
    const score = scoreModelCandidate({
        matchedInventoryCount: uniqueMatchedIds.length,
        portalCount: input.portalCount,
        hasPerDeviceStatus: input.hasPerDeviceStatus,
        source: input.source,
        rejected,
    });
    return {
        source: input.source,
        dataPath: input.dataPath,
        tab: input.tab,
        matchedInventoryCount: uniqueMatchedIds.length,
        collectionLength: input.collectionLength,
        uniqueMatchedIds,
        statusFields: input.statusFields,
        datasetSignature,
        hasPerDeviceStatus: input.hasPerDeviceStatus,
        rejected,
        rejectionReason,
        score,
    };
}
export function recommendModelSource(input) {
    const validatedField = input.fieldCandidates.find((candidate) => candidate.validated);
    if (validatedField) {
        return {
            source: "querydevicestree_field",
            dataPath: "querydevicestree",
            fieldPath: validatedField.fieldPath,
            mapping: validatedField.mapping.label,
            priority: 1,
        };
    }
    const statusModel = input.modelCandidates
        .filter((candidate) => !candidate.rejected && candidate.hasPerDeviceStatus)
        .sort((a, b) => b.score - a.score)[0];
    if (statusModel) {
        return {
            source: statusModel.source,
            dataPath: statusModel.dataPath,
            fieldPath: statusModel.statusFields[0] ?? null,
            mapping: null,
            priority: 2,
        };
    }
    const filteredCollections = input.modelCandidates
        .filter((candidate) => !candidate.rejected)
        .sort((a, b) => b.score - a.score);
    const online = filteredCollections.find((candidate) => candidate.tab === "online");
    const offline = filteredCollections.find((candidate) => candidate.tab === "offline");
    if (online && offline) {
        return {
            source: online.source,
            dataPath: `${online.dataPath}|${offline.dataPath}`,
            fieldPath: null,
            mapping: "filtered_tab_collections",
            priority: 3,
        };
    }
    return {
        source: null,
        dataPath: null,
        fieldPath: null,
        mapping: null,
        priority: 4,
    };
}
export function validateStatusModelDiscovery(input) {
    const tolerance = input.tolerance ?? 2;
    const minOverlap = input.minOverlapPercent ?? 99;
    const allSet = new Set(input.allDeviceIds);
    const onlineSet = new Set(input.onlineDeviceIds);
    const offlineSet = new Set(input.offlineDeviceIds);
    const intersection = [...onlineSet].filter((id) => offlineSet.has(id));
    const unionSet = new Set([...onlineSet, ...offlineSet]);
    const referenceAll = allSet.size > 0 ? allSet : unionSet;
    const inventoryOverlap = [...input.inventoryIds].filter((id) => referenceAll.has(id));
    const inventoryOverlapPercentage = input.inventoryIds.size === 0
        ? 0
        : Math.round((inventoryOverlap.length / input.inventoryIds.size) * 100);
    const extraIds = [...referenceAll].filter((id) => !input.inventoryIds.has(id));
    const extractedCounts = {
        all: referenceAll.size,
        online: onlineSet.size,
        offline: offlineSet.size,
    };
    const validationReasons = [];
    const portalAll = input.portalCounts.allAfter ?? input.portalCounts.allBefore ?? input.portalCounts.all;
    const portalOnline = input.portalCounts.onlineAfter ?? input.portalCounts.onlineBefore ?? input.portalCounts.online;
    const portalOffline = input.portalCounts.offlineAfter ?? input.portalCounts.offlineBefore ?? input.portalCounts.offline;
    if (portalAll != null && Math.abs(extractedCounts.all - portalAll) > tolerance) {
        validationReasons.push(`all_count_delta_${Math.abs(extractedCounts.all - portalAll)}`);
    }
    if (portalOnline != null && Math.abs(extractedCounts.online - portalOnline) > tolerance) {
        validationReasons.push(`online_count_delta_${Math.abs(extractedCounts.online - portalOnline)}`);
    }
    if (portalOffline != null && Math.abs(extractedCounts.offline - portalOffline) > tolerance) {
        validationReasons.push(`offline_count_delta_${Math.abs(extractedCounts.offline - portalOffline)}`);
    }
    if (intersection.length > 0)
        validationReasons.push(`online_offline_intersection_${intersection.length}`);
    if (unionSet.size > 0 && allSet.size > 0 && Math.abs(unionSet.size - allSet.size) > tolerance) {
        validationReasons.push(`union_all_mismatch_${unionSet.size}_vs_${allSet.size}`);
    }
    if (inventoryOverlapPercentage < minOverlap) {
        validationReasons.push(`inventory_overlap_${inventoryOverlapPercentage}`);
    }
    if (extraIds.length > 0)
        validationReasons.push(`extra_ids_${extraIds.length}`);
    const identical = allSet.size > 0 &&
        [...allSet].every((id) => onlineSet.has(id) && offlineSet.has(id)) &&
        portalOnline != null &&
        portalOffline != null &&
        portalOnline !== portalOffline;
    if (identical)
        validationReasons.push("identical_datasets_across_tabs");
    let failureCategory = null;
    if (validationReasons.length > 0) {
        if (validationReasons.some((reason) => reason.includes("count_delta"))) {
            failureCategory = "model_count_mismatch";
        }
        else if (validationReasons.includes("identical_datasets_across_tabs")) {
            failureCategory = "no_filtered_model_collections";
        }
        else {
            failureCategory = "model_count_mismatch";
        }
    }
    return {
        allDeviceIds: [...referenceAll].sort(),
        onlineDeviceIds: [...onlineSet].sort(),
        offlineDeviceIds: [...offlineSet].sort(),
        extractedCounts,
        onlineOfflineIntersection: intersection.sort(),
        unionCount: unionSet.size,
        inventoryOverlapCount: inventoryOverlap.length,
        inventoryOverlapPercentage,
        extraIds: extraIds.sort(),
        validated: validationReasons.length === 0,
        validationReasons,
        failureCategory,
    };
}
export function portalCountMatchesTab(tab, count, portalCounts, tolerance = 2) {
    if (tab === "online") {
        return portalCountWithinTolerance(count, portalCounts.onlineBefore ?? portalCounts.online, portalCounts.onlineAfter ?? portalCounts.online, tolerance);
    }
    if (tab === "offline") {
        return portalCountWithinTolerance(count, portalCounts.offlineBefore ?? portalCounts.offline, portalCounts.offlineAfter ?? portalCounts.offline, tolerance);
    }
    return portalCountWithinTolerance(count, portalCounts.allBefore ?? portalCounts.all, portalCounts.allAfter ?? portalCounts.all, tolerance);
}
export function categorizeModelDiscoveryFailure(input) {
    if (input.validatedFieldCandidate || input.validation.validated)
        return "none";
    if (input.fieldCandidateCount === 0)
        return "no_inventory_status_field";
    if (input.vueCandidates === 0 && input.modelCandidateCount === 0)
        return "no_vue_device_store";
    if (input.validation.validationReasons.includes("identical_datasets_across_tabs")) {
        return "no_filtered_model_collections";
    }
    return input.validation.failureCategory ?? "model_count_mismatch";
}
