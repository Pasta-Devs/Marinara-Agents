import type { SpatialContextDefinition, SpatialDestinationRelation, SpatialLocation } from "@marinara-engine/shared";
import { clearPendingSpatialTransition } from "./pending-spatial-transitions";

export interface SpatialRouteStep {
  locationId: string;
  locationName: string;
  relation: SpatialDestinationRelation;
  label?: string;
}

type GraphEdge = SpatialRouteStep;

function activeLocationIndex(definition: SpatialContextDefinition): Map<string, SpatialLocation> {
  return new Map(
    definition.locations.filter((location) => location.status === "active").map((location) => [location.id, location]),
  );
}

function routeGraph(definition: SpatialContextDefinition): Map<string, GraphEdge[]> {
  const active = activeLocationIndex(definition);
  const graph = new Map<string, GraphEdge[]>();
  const add = (fromId: string, edge: GraphEdge) => {
    if (!active.has(fromId) || !active.has(edge.locationId)) return;
    const edges = graph.get(fromId) ?? [];
    if (!edges.some((candidate) => candidate.locationId === edge.locationId)) edges.push(edge);
    graph.set(fromId, edges);
  };

  for (const location of active.values()) {
    if (location.parentId && active.has(location.parentId)) {
      const parent = active.get(location.parentId)!;
      add(parent.id, {
        locationId: location.id,
        locationName: location.name,
        relation: "enter",
        label: `Enter ${location.name}`,
      });
      add(location.id, {
        locationId: parent.id,
        locationName: parent.name,
        relation: "leave",
        label: `Leave for ${parent.name}`,
      });
    }
    for (const link of location.links) {
      if (link.state !== "available") continue;
      const target = active.get(link.targetId);
      if (!target) continue;
      add(location.id, {
        locationId: target.id,
        locationName: target.name,
        relation: "link",
        ...(link.label?.trim() ? { label: link.label.trim() } : {}),
      });
      if (link.bidirectional) {
        add(target.id, {
          locationId: location.id,
          locationName: location.name,
          relation: "link",
          ...(link.label?.trim() ? { label: link.label.trim() } : {}),
        });
      }
    }
  }
  return graph;
}

/** Read-only route preview. The pending transition is the only persisted travel state. */
export function findSpatialRoute(
  definition: SpatialContextDefinition,
  currentLocationId: string | null,
  targetLocationId: string,
): { locationIds: string[]; steps: SpatialRouteStep[] } | null {
  if (!currentLocationId || currentLocationId === targetLocationId) {
    return currentLocationId === targetLocationId ? { locationIds: [currentLocationId], steps: [] } : null;
  }
  const graph = routeGraph(definition);
  const visited = new Set([currentLocationId]);
  const queue: Array<{
    id: string;
    locationIds: string[];
    steps: SpatialRouteStep[];
  }> = [{ id: currentLocationId, locationIds: [currentLocationId], steps: [] }];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of graph.get(current.id) ?? []) {
      if (visited.has(edge.locationId)) continue;
      const locationIds = [...current.locationIds, edge.locationId];
      const steps = [...current.steps, edge];
      if (edge.locationId === targetLocationId) return { locationIds, steps };
      visited.add(edge.locationId);
      queue.push({ id: edge.locationId, locationIds, steps });
    }
  }
  return null;
}

/** Compatibility helper for editor cleanup; it clears the one pending transition. */
export function cancelSpatialRoute(chatId: string): void {
  clearPendingSpatialTransition(chatId);
}
