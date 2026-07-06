export function reconcileDomStatusSets(input) {
    const maxTabDelta = input.options?.maxTabDelta ?? 2;
    const minOverlap = input.options?.minInventoryOverlapPercent ?? 99;
    const allSet = new Set(input.allIds);
    const onlineSet = new Set(input.onlineIds);
    const offlineSet = new Set(input.offlineIds);
    const duplicateIds = [
        ...findDuplicates(input.allIds),
        ...findDuplicates(input.onlineIds),
        ...findDuplicates(input.offlineIds),
    ];
    const onlineOfflineIntersection = [...onlineSet].filter((id) => offlineSet.has(id));
    const unionSet = new Set([...onlineSet, ...offlineSet]);
    const unionCount = unionSet.size;
    const inventoryOverlap = [...input.inventoryIds].filter((id) => unionSet.has(id) || allSet.has(id));
    const inventoryOverlapCount = inventoryOverlap.length;
    const inventoryOverlapPercentage = input.inventoryIds.size === 0
        ? 0
        : Math.round((inventoryOverlapCount / input.inventoryIds.size) * 100);
    const referenceAllSet = allSet.size > 0 ? allSet : unionSet;
    const missingInventoryIds = [...input.inventoryIds].filter((id) => !referenceAllSet.has(id));
    const extraIds = [...referenceAllSet].filter((id) => !input.inventoryIds.has(id));
    const extractedCounts = {
        all: allSet.size > 0 ? allSet.size : unionCount,
        online: onlineSet.size,
        offline: offlineSet.size,
    };
    const validationReasons = [];
    if (onlineOfflineIntersection.length > 0) {
        validationReasons.push(`online_offline_intersection_${onlineOfflineIntersection.length}`);
    }
    if (unionCount > 0 && allSet.size > 0 && unionCount !== allSet.size) {
        validationReasons.push(`union_all_mismatch_${unionCount}_vs_${allSet.size}`);
    }
    if (input.portalCounts.all != null) {
        const delta = Math.abs(extractedCounts.all - input.portalCounts.all);
        if (delta > maxTabDelta)
            validationReasons.push(`all_count_delta_${delta}`);
    }
    if (input.portalCounts.online != null) {
        const delta = Math.abs(extractedCounts.online - input.portalCounts.online);
        if (delta > maxTabDelta)
            validationReasons.push(`online_count_delta_${delta}`);
    }
    if (input.portalCounts.offline != null) {
        const delta = Math.abs(extractedCounts.offline - input.portalCounts.offline);
        if (delta > maxTabDelta)
            validationReasons.push(`offline_count_delta_${delta}`);
    }
    for (const snapshot of input.tabSnapshots ?? []) {
        const targetIds = snapshot.tab === "online"
            ? onlineSet
            : snapshot.tab === "offline"
                ? offlineSet
                : allSet;
        const extractedCount = targetIds.size;
        const withinBefore = snapshot.portalCountBefore != null &&
            Math.abs(extractedCount - snapshot.portalCountBefore) <= maxTabDelta;
        const withinAfter = snapshot.portalCountAfter != null &&
            Math.abs(extractedCount - snapshot.portalCountAfter) <= maxTabDelta;
        if ((snapshot.portalCountBefore != null || snapshot.portalCountAfter != null) &&
            !withinBefore &&
            !withinAfter) {
            validationReasons.push(`${snapshot.tab}_portal_snapshot_delta`);
        }
    }
    const identicalReason = rejectIdenticalDatasetsAcrossTabs({
        allIds: input.allIds,
        onlineIds: input.onlineIds,
        offlineIds: input.offlineIds,
        portalCounts: input.portalCounts,
    });
    if (identicalReason)
        validationReasons.push(identicalReason);
    if (inventoryOverlapPercentage < minOverlap) {
        validationReasons.push(`inventory_overlap_${inventoryOverlapPercentage}`);
    }
    if (duplicateIds.length > 0) {
        validationReasons.push(`duplicate_ids_${duplicateIds.length}`);
    }
    const tabsMissingSelection = (input.tabSnapshots ?? []).filter((snapshot) => snapshot.tabSelectionEvidenceSelected === false);
    if (tabsMissingSelection.length > 0) {
        validationReasons.push(`tab_selection_evidence_missing_${tabsMissingSelection.length}`);
    }
    return {
        allIds: [...allSet].sort(),
        onlineIds: [...onlineSet].sort(),
        offlineIds: [...offlineSet].sort(),
        duplicateIds: [...new Set(duplicateIds)].sort(),
        onlineOfflineIntersection: onlineOfflineIntersection.sort(),
        unionCount,
        inventoryOverlapCount,
        inventoryOverlapPercentage,
        missingInventoryIds: missingInventoryIds.sort(),
        extraIds: extraIds.sort(),
        extractedCounts,
        validated: validationReasons.length === 0,
        validationReasons,
    };
}
function findDuplicates(ids) {
    const seen = new Set();
    const duplicates = new Set();
    for (const id of ids) {
        if (seen.has(id))
            duplicates.add(id);
        seen.add(id);
    }
    return [...duplicates];
}
function rejectIdenticalDatasetsAcrossTabs(input) {
    const signature = (ids) => [...new Set(ids)].sort().join(",");
    const allSig = signature(input.allIds);
    const onlineSig = signature(input.onlineIds);
    const offlineSig = signature(input.offlineIds);
    const portalDistinct = input.portalCounts.all != null &&
        input.portalCounts.online != null &&
        input.portalCounts.offline != null &&
        !(input.portalCounts.all === input.portalCounts.online &&
            input.portalCounts.all === input.portalCounts.offline);
    if (portalDistinct && allSig.length > 0 && allSig === onlineSig && onlineSig === offlineSig) {
        return "identical_datasets_across_tabs";
    }
    return null;
}
