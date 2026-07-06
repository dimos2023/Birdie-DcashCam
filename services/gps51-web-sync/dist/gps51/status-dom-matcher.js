const DIGIT_TOKEN_PATTERN = /\d{8,17}/g;
export function extractInventoryMatchesFromText(text, inventoryIds) {
    if (!text || inventoryIds.size === 0)
        return [];
    const matches = new Set();
    for (const token of text.match(DIGIT_TOKEN_PATTERN) ?? []) {
        if (inventoryIds.has(token))
            matches.add(token);
    }
    for (const id of inventoryIds) {
        if (text.includes(id))
            matches.add(id);
    }
    return [...matches];
}
export function extractInventoryMatchesFromTexts(texts, inventoryIds) {
    const matches = new Set();
    for (const text of texts) {
        for (const id of extractInventoryMatchesFromText(text, inventoryIds)) {
            matches.add(id);
        }
    }
    return [...matches].sort();
}
export function collectDuplicateIds(ids) {
    const seen = new Set();
    const duplicates = new Set();
    for (const id of ids) {
        if (seen.has(id))
            duplicates.add(id);
        seen.add(id);
    }
    return [...duplicates];
}
