import type { GameMap, SpatialContextDefinition } from "@marinara-engine/shared";
import { getGameMapId, getGameMapsFromMeta, withActiveGameMapMeta } from "../game/map-position.service.js";

export interface GameMapDraftReference {
  maps: Array<Record<string, unknown>>;
  requiredLocationNames: string[];
  truncated: boolean;
}

export interface GameMapAutoBindingResult {
  metadata: Record<string, unknown>;
  bindingCount: number;
}

export type GameMapBindingTarget =
  | { target: "map"; mapId: string }
  | { target: "cell"; mapId: string; x: number; y: number }
  | { target: "node"; mapId: string; nodeId: string };

export type UpdateGameMapBindingInput = GameMapBindingTarget & { spatialLocationId: string | null };

export class GameMapBindingError extends Error {
  constructor(
    readonly code: "map_missing" | "target_missing" | "target_type_mismatch",
    message: string,
  ) {
    super(message);
    this.name = "GameMapBindingError";
  }
}

function withSpatialLocationId<T extends { spatialLocationId?: string }>(
  value: T,
  spatialLocationId: string | null,
): T {
  const next = { ...value };
  if (spatialLocationId) next.spatialLocationId = spatialLocationId;
  else delete next.spatialLocationId;
  return next;
}

function boundedText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

function normalizeBindingName(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFKD")
    .toLocaleLowerCase()
    .replace(/[_-]+/gu, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\b(?:the|a|an)\b/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function orderActiveMapFirst(maps: GameMap[], metadata: Record<string, unknown>): GameMap[] {
  const activeId =
    typeof metadata.activeGameMapId === "string"
      ? metadata.activeGameMapId
      : getGameMapId(metadata.gameMap as GameMap | null | undefined);
  if (!activeId) return maps;
  return [...maps].sort((left, right) => {
    const leftActive = getGameMapId(left) === activeId ? 1 : 0;
    const rightActive = getGameMapId(right) === activeId ? 1 : 0;
    return rightActive - leftActive;
  });
}

export function buildGameMapDraftReference(metadata: Record<string, unknown>): GameMapDraftReference | null {
  const allMaps = orderActiveMapFirst(getGameMapsFromMeta(metadata), metadata);
  const maps = allMaps.slice(0, 4);
  if (maps.length === 0) return null;
  const truncated =
    allMaps.length > maps.length ||
    maps.some(
      (map) =>
        (map.type === "node" && ((map.nodes?.length ?? 0) > 50 || (map.edges?.length ?? 0) > 100)) ||
        (map.type === "grid" && (map.cells?.length ?? 0) > 100),
    );

  const requiredLocationNames: string[] = [];
  const seenNames = new Set<string>();
  const requireName = (value: unknown) => {
    const name = boundedText(value, 200);
    if (!name || seenNames.has(name)) return;
    seenNames.add(name);
    requiredLocationNames.push(name);
  };

  const referenceMaps = maps.map((map, mapIndex) => {
    requireName(map.name);
    const base = {
      id: getGameMapId(map, mapIndex),
      type: map.type,
      name: boundedText(map.name, 200) ?? `Map ${mapIndex + 1}`,
      description: boundedText(map.description, 1_000),
      partyPosition: map.partyPosition,
    };
    if (map.type === "node") {
      const nodes = (map.nodes ?? []).slice(0, 50).map((node) => {
        requireName(node.label);
        return {
          id: boundedText(node.id, 128),
          name: boundedText(node.label, 200),
          description: boundedText(node.description, 600),
          icon: boundedText(node.emoji, 64),
          discovered: node.discovered,
          placement: { x: node.x, y: node.y },
        };
      });
      return {
        ...base,
        nodes,
        edges: (map.edges ?? []).slice(0, 100).map((edge) => ({
          from: edge.from,
          to: edge.to,
          ...(boundedText(edge.label, 200) ? { label: boundedText(edge.label, 200) } : {}),
        })),
      };
    }

    const cells = (map.cells ?? []).slice(0, 100).map((cell) => {
      requireName(cell.label);
      return {
        x: cell.x,
        y: cell.y,
        name: boundedText(cell.label, 200),
        description: boundedText(cell.description, 600),
        icon: boundedText(cell.emoji, 64),
        terrain: boundedText(cell.terrain, 200),
        discovered: cell.discovered,
      };
    });
    return { ...base, width: map.width, height: map.height, cells };
  });

  return { maps: referenceMaps, requiredLocationNames, truncated };
}

function buildUniqueSpatialLocationIndex(definition: SpatialContextDefinition): Map<string, string> {
  const uniqueLocations = new Map<string, string>();
  const ambiguousNames = new Set<string>();
  for (const location of definition.locations) {
    if (location.status !== "active") continue;
    const name = normalizeBindingName(location.name);
    if (!name || ambiguousNames.has(name)) continue;
    if (uniqueLocations.has(name)) {
      uniqueLocations.delete(name);
      ambiguousNames.add(name);
      continue;
    }
    uniqueLocations.set(name, location.id);
  }
  return uniqueLocations;
}

function bindExactLocation<T extends { spatialLocationId?: string }>(
  value: T,
  name: unknown,
  locationsByName: ReadonlyMap<string, string>,
): { value: T; bound: boolean } {
  if (value.spatialLocationId?.trim()) return { value, bound: false };
  const locationId = locationsByName.get(normalizeBindingName(name));
  return locationId
    ? { value: withSpatialLocationId(value, locationId), bound: true }
    : { value, bound: false };
}

export function bindGameMapsToExactSpatialLocations(
  metadata: Record<string, unknown>,
  definition: SpatialContextDefinition,
): GameMapAutoBindingResult {
  const maps = getGameMapsFromMeta(metadata);
  if (maps.length === 0) return { metadata, bindingCount: 0 };

  const locationsByName = buildUniqueSpatialLocationIndex(definition);
  let bindingCount = 0;
  const updatedMaps = maps.map((map) => {
    const mapBinding = bindExactLocation(map, map.name, locationsByName);
    if (mapBinding.bound) bindingCount += 1;
    let updatedMap = mapBinding.value;

    if (updatedMap.type === "node") {
      updatedMap = {
        ...updatedMap,
        nodes: (updatedMap.nodes ?? []).map((node) => {
          const nodeBinding = bindExactLocation(node, node.label, locationsByName);
          if (nodeBinding.bound) bindingCount += 1;
          return nodeBinding.value;
        }),
      };
    } else {
      updatedMap = {
        ...updatedMap,
        cells: (updatedMap.cells ?? []).map((cell) => {
          const cellBinding = bindExactLocation(cell, cell.label, locationsByName);
          if (cellBinding.bound) bindingCount += 1;
          return cellBinding.value;
        }),
      };
    }
    return updatedMap;
  });

  if (bindingCount === 0) return { metadata, bindingCount };
  const previousActiveId =
    typeof metadata.activeGameMapId === "string"
      ? metadata.activeGameMapId
      : getGameMapId(metadata.gameMap as GameMap | null | undefined);
  const activeMap =
    updatedMaps.find((map, index) => getGameMapId(map, index) === previousActiveId) ?? updatedMaps[0]!;
  return {
    metadata: {
      ...metadata,
      gameMaps: updatedMaps,
      gameMap: activeMap,
      activeGameMapId: getGameMapId(activeMap),
    },
    bindingCount,
  };
}

export function updateGameMapBinding(
  metadata: Record<string, unknown>,
  input: UpdateGameMapBindingInput,
): Record<string, unknown> {
  const maps = getGameMapsFromMeta(metadata);
  const mapIndex = maps.findIndex((map, index) => getGameMapId(map, index) === input.mapId);
  if (mapIndex < 0) throw new GameMapBindingError("map_missing", "The selected Game map no longer exists.");

  const map = maps[mapIndex]!;
  let updatedMap: GameMap;
  if (input.target === "map") {
    updatedMap = withSpatialLocationId(map, input.spatialLocationId);
  } else if (input.target === "cell") {
    if (map.type !== "grid") {
      throw new GameMapBindingError("target_type_mismatch", "Only grid maps contain bindable cells.");
    }
    const cells = map.cells ?? [];
    const targetIndex = cells.findIndex((cell) => cell.x === input.x && cell.y === input.y);
    if (targetIndex < 0) throw new GameMapBindingError("target_missing", "The selected map cell no longer exists.");
    updatedMap = {
      ...map,
      cells: cells.map((cell, index) =>
        index === targetIndex ? withSpatialLocationId(cell, input.spatialLocationId) : cell,
      ),
    };
  } else {
    if (map.type !== "node") {
      throw new GameMapBindingError("target_type_mismatch", "Only node maps contain bindable nodes.");
    }
    const nodes = map.nodes ?? [];
    const targetIndex = nodes.findIndex((node) => node.id === input.nodeId);
    if (targetIndex < 0) throw new GameMapBindingError("target_missing", "The selected map node no longer exists.");
    updatedMap = {
      ...map,
      nodes: nodes.map((node, index) =>
        index === targetIndex ? withSpatialLocationId(node, input.spatialLocationId) : node,
      ),
    };
  }

  const nextMaps = maps.map((entry, index) => (index === mapIndex ? updatedMap : entry));
  const previousActiveId =
    typeof metadata.activeGameMapId === "string"
      ? metadata.activeGameMapId
      : getGameMapId(metadata.gameMap as GameMap | null | undefined);
  const activeMap =
    nextMaps.find((entry, index) => getGameMapId(entry, index) === previousActiveId) ?? nextMaps[0] ?? updatedMap;
  return {
    ...metadata,
    gameMaps: nextMaps,
    gameMap: activeMap,
    activeGameMapId: getGameMapId(activeMap),
  };
}

export function selectBoundGameMapForLocation(
  metadata: Record<string, unknown>,
  definition: SpatialContextDefinition,
  destinationId: string,
): Record<string, unknown> {
  const maps = getGameMapsFromMeta(metadata);
  if (maps.length === 0) return metadata;

  const byId = new Map(definition.locations.map((location) => [location.id, location]));
  const locationIds: string[] = [];
  const visited = new Set<string>();
  let current = byId.get(destinationId);
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    locationIds.push(current.id);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  for (const locationId of locationIds) {
    const map = maps.find((candidate) => candidate.spatialLocationId === locationId);
    if (map) return withActiveGameMapMeta({ ...metadata, gameMaps: maps }, map);
  }
  return metadata;
}
