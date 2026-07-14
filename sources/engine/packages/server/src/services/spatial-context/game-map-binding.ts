import type { GameMap, SpatialContextDefinition } from "@marinara-engine/shared";
import { getGameMapId, getGameMapsFromMeta, withActiveGameMapMeta } from "../game/map-position.service.js";

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
