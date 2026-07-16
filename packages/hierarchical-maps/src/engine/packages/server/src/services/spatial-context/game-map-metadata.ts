import type { GameMap } from "@marinara-engine/shared";

function slugifyGameMapId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizeGameMapName(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\b(?:the|a|an)\b/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isGameMap(value: unknown): value is GameMap {
  if (!value || typeof value !== "object") return false;
  const map = value as Partial<GameMap>;
  return map.type === "grid" || map.type === "node";
}

export function getGameMapId(
  map: GameMap | null | undefined,
  fallbackIndex = 0,
): string | null {
  if (!map) return null;
  const explicit = map.id?.trim();
  if (explicit) return explicit;
  return slugifyGameMapId(map.name || "") || `map-${fallbackIndex + 1}`;
}

function ensureGameMapId(
  map: GameMap,
  existingMaps: readonly GameMap[] = [],
): GameMap {
  const explicit = map.id?.trim();
  if (explicit) return explicit === map.id ? map : { ...map, id: explicit };

  const usedIds = new Set(
    existingMaps
      .map((entry, index) => getGameMapId(entry, index))
      .filter(Boolean) as string[],
  );
  const base = slugifyGameMapId(map.name || "") || "map";
  let id = base;
  let suffix = 2;
  while (usedIds.has(id)) id = `${base}-${suffix++}`;
  return { ...map, id };
}

function upsertGameMap(maps: readonly GameMap[], map: GameMap): GameMap[] {
  const explicitId = map.id?.trim();
  const normalizedName = normalizeGameMapName(map.name || "");
  const existingIndex = maps.findIndex((entry, index) => {
    if (explicitId) return getGameMapId(entry, index) === explicitId;
    return (
      normalizedName !== "" &&
      normalizeGameMapName(entry.name || "") === normalizedName
    );
  });

  const mapWithId =
    existingIndex >= 0 && !explicitId
      ? {
          ...map,
          id: getGameMapId(maps[existingIndex], existingIndex) ?? undefined,
        }
      : ensureGameMapId(map, maps);

  if (existingIndex < 0) return [...maps, mapWithId];
  const next = [...maps];
  next[existingIndex] = mapWithId;
  return next;
}

export function getGameMapsFromMeta(meta: Record<string, unknown>): GameMap[] {
  const rawMaps = Array.isArray(meta.gameMaps) ? meta.gameMaps : [];
  const maps = rawMaps
    .filter(isGameMap)
    .reduce<GameMap[]>((acc, map) => upsertGameMap(acc, map), []);
  const activeMap = isGameMap(meta.gameMap) ? meta.gameMap : null;
  return activeMap ? upsertGameMap(maps, activeMap) : maps;
}

export function withActiveGameMapMeta(
  meta: Record<string, unknown>,
  map: GameMap,
): Record<string, unknown> {
  const maps = upsertGameMap(getGameMapsFromMeta(meta), map);
  const mapId = getGameMapId(map);
  const activeMap =
    maps.find((entry, index) => getGameMapId(entry, index) === mapId) ?? map;
  return {
    ...meta,
    gameMap: activeMap,
    gameMaps: maps,
    activeGameMapId: getGameMapId(activeMap),
  };
}
