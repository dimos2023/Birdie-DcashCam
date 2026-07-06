const DIGIT_TOKEN_PATTERN = /\d{8,17}/g;

export function extractInventoryMatchesFromText(
  text: string,
  inventoryIds: Set<string>,
): string[] {
  if (!text || inventoryIds.size === 0) return [];

  const matches = new Set<string>();
  for (const token of text.match(DIGIT_TOKEN_PATTERN) ?? []) {
    if (inventoryIds.has(token)) matches.add(token);
  }

  for (const id of inventoryIds) {
    if (text.includes(id)) matches.add(id);
  }

  return [...matches];
}

export function extractInventoryMatchesFromTexts(
  texts: string[],
  inventoryIds: Set<string>,
): string[] {
  const matches = new Set<string>();
  for (const text of texts) {
    for (const id of extractInventoryMatchesFromText(text, inventoryIds)) {
      matches.add(id);
    }
  }
  return [...matches].sort();
}

export function collectDuplicateIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  return [...duplicates];
}
