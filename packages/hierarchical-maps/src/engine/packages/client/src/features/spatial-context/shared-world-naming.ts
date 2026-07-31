const SHARED_WORLD_NAME_LIMIT = 120;

function normalizedWorldName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

function nameWithSuffix(baseName: string, suffix: string): string {
  const availableBaseLength = Math.max(1, SHARED_WORLD_NAME_LIMIT - suffix.length);
  return `${baseName.slice(0, availableBaseLength).trimEnd()}${suffix}`;
}

export function nextAvailableSharedWorldName(baseName: string, existingNames: readonly string[]): string {
  const cleanBaseName = baseName.trim() || "Untitled world";
  const usedNames = new Set(existingNames.map(normalizedWorldName));
  if (!usedNames.has(normalizedWorldName(cleanBaseName))) return cleanBaseName.slice(0, SHARED_WORLD_NAME_LIMIT);

  for (let copyNumber = 1; copyNumber < 10_000; copyNumber += 1) {
    const suffix = copyNumber === 1 ? " (copy)" : ` (copy ${copyNumber})`;
    const candidate = nameWithSuffix(cleanBaseName, suffix);
    if (!usedNames.has(normalizedWorldName(candidate))) return candidate;
  }

  return nameWithSuffix(cleanBaseName, ` (copy ${Date.now()})`);
}
