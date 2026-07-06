export function buildIconSignature(classes) {
    return classes
        .map((value) => value.trim())
        .filter(Boolean)
        .sort()
        .join(" ");
}
export function inferStatusIconMappings(input) {
    const byIcon = new Map();
    for (const row of input.rowSamples) {
        const deviceId = row.resolvedDeviceId;
        const signature = buildIconSignature(row.statusIconClasses ?? []);
        if (!deviceId || !signature)
            continue;
        const bucket = byIcon.get(signature) ?? { online: 0, offline: 0 };
        if (input.onlineIds.has(deviceId))
            bucket.online += 1;
        if (input.offlineIds.has(deviceId))
            bucket.offline += 1;
        byIcon.set(signature, bucket);
    }
    const mappings = [];
    for (const [iconSignature, counts] of byIcon) {
        if (counts.online === 0 && counts.offline === 0)
            continue;
        if (counts.online > 0 && counts.offline > 0)
            continue;
        mappings.push({
            iconSignature,
            inferredStatus: counts.online > 0 ? "online" : "offline",
            matchedDeviceCount: counts.online + counts.offline,
        });
    }
    if (mappings.length === 0) {
        return { mappings: [], validated: false, reason: "no_icon_samples" };
    }
    const onlineFromIcons = mappings
        .filter((mapping) => mapping.inferredStatus === "online")
        .reduce((sum, mapping) => sum + mapping.matchedDeviceCount, 0);
    const offlineFromIcons = mappings
        .filter((mapping) => mapping.inferredStatus === "offline")
        .reduce((sum, mapping) => sum + mapping.matchedDeviceCount, 0);
    const onlineValid = input.portalCounts.online == null ||
        Math.abs(onlineFromIcons - input.portalCounts.online) <= 2;
    const offlineValid = input.portalCounts.offline == null ||
        Math.abs(offlineFromIcons - input.portalCounts.offline) <= 2;
    return {
        mappings,
        validated: onlineValid && offlineValid,
        reason: onlineValid && offlineValid ? null : "icon_count_mismatch",
    };
}
