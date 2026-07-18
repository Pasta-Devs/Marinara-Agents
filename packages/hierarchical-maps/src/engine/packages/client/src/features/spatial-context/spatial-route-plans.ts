import { useSyncExternalStore } from "react";
import type {
  SpatialContextDefinition,
  SpatialContextResponse,
  SpatialDestination,
  SpatialDestinationRelation,
  SpatialLocation,
} from "@marinara-engine/shared";
import { generateClientId } from "./package-utils";
import {
  clearPendingSpatialTransition,
  getPendingSpatialTransition,
  setPendingSpatialTransition,
  setPendingSpatialTransitionStatus,
} from "./pending-spatial-transitions";

const STORAGE_KEY = "marinara-spatial-route-plans";

export interface SpatialRouteStep {
  locationId: string;
  locationName: string;
  relation: SpatialDestinationRelation;
  label?: string;
}
export interface SpatialRoutePlan {
  version: 1;
  targetLocationId: string;
  targetLocationName: string;
  locationIds: string[];
  steps: SpatialRouteStep[];
  currentIndex: number;
  expectedDefinitionRevision: number;
  status: "ready" | "needs_review";
}

type GraphEdge = SpatialRouteStep;

const listeners = new Set<() => void>();

function isRoutePlan(value: unknown): value is SpatialRoutePlan {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const plan = value as Partial<SpatialRoutePlan>;
  return (
    plan.version === 1 &&
    typeof plan.targetLocationId === "string" &&
    typeof plan.targetLocationName === "string" &&
    Array.isArray(plan.locationIds) &&
    plan.locationIds.every((id) => typeof id === "string") &&
    Array.isArray(plan.steps) &&
    plan.steps.every(
      (step, index) =>
        step !== null &&
        typeof step === "object" &&
        typeof step.locationId === "string" &&
        typeof step.locationName === "string" &&
        (step.relation === "enter" || step.relation === "leave" || step.relation === "link") &&
        plan.locationIds?.[index + 1] === step.locationId,
    ) &&
    plan.locationIds.length === plan.steps.length + 1 &&
    Number.isInteger(plan.currentIndex) &&
    (plan.currentIndex ?? -1) >= 0 &&
    (plan.currentIndex ?? Number.POSITIVE_INFINITY) < plan.locationIds.length &&
    Number.isInteger(plan.expectedDefinitionRevision) &&
    (plan.status === "ready" || plan.status === "needs_review")
  );
}

function loadPlans(): Map<string, SpatialRoutePlan> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Map();
    return new Map(
      parsed.filter(
        (entry): entry is [string, SpatialRoutePlan] =>
          Array.isArray(entry) && typeof entry[0] === "string" && isRoutePlan(entry[1]),
      ),
    );
  } catch {
    return new Map();
  }
}

let routePlans = loadPlans();

function publish(next: Map<string, SpatialRoutePlan>): void {
  routePlans = next;
  try {
    if (next.size === 0) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
  } catch {
    // Persistence is best-effort; the current tab still keeps the plan.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setSpatialRoutePlan(chatId: string, plan: SpatialRoutePlan): void {
  const next = new Map(routePlans);
  next.set(chatId, plan);
  publish(next);
}

export function getSpatialRoutePlan(chatId: string): SpatialRoutePlan | null {
  return routePlans.get(chatId) ?? null;
}

export function useSpatialRoutePlan(chatId: string | null): SpatialRoutePlan | null {
  return useSyncExternalStore(
    subscribe,
    () => (chatId ? getSpatialRoutePlan(chatId) : null),
    () => null,
  );
}

export function clearSpatialRoutePlan(chatId: string): void {
  if (!routePlans.has(chatId)) return;
  const next = new Map(routePlans);
  next.delete(chatId);
  publish(next);
}

export function cancelSpatialRoute(chatId: string): void {
  clearSpatialRoutePlan(chatId);
  clearPendingSpatialTransition(chatId);
}

function activeLocationIndex(definition: SpatialContextDefinition): Map<string, SpatialLocation> {
  return new Map(
    definition.locations
      .filter((location) => location.status === "active")
      .map((location) => [location.id, location]),
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

export function findSpatialRoute(
  definition: SpatialContextDefinition,
  currentLocationId: string | null,
  targetLocationId: string,
): { locationIds: string[]; steps: SpatialRouteStep[] } | null {
  if (!currentLocationId) return null;
  if (currentLocationId === targetLocationId) return { locationIds: [currentLocationId], steps: [] };
  const graph = routeGraph(definition);
  const visited = new Set([currentLocationId]);
  const queue: Array<{ id: string; locationIds: string[]; steps: SpatialRouteStep[] }> = [
    { id: currentLocationId, locationIds: [currentLocationId], steps: [] },
  ];
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

function queueRouteDestination(
  chatId: string,
  plan: SpatialRoutePlan,
  destination: SpatialDestination,
  currentLocationId: string,
): void {
  setPendingSpatialTransition(chatId, {
    transition: {
      destinationId: destination.id,
      expectedDefinitionRevision: plan.expectedDefinitionRevision,
      expectedCurrentLocationId: currentLocationId,
      commandId: generateClientId(),
    },
    destinationName: destination.name,
    relation: destination.relation,
    ...(destination.label ? { label: destination.label } : {}),
    status: plan.status === "needs_review" ? "needs_review" : "ready",
  });
}

function markSpatialRouteNeedsReview(chatId: string, plan: SpatialRoutePlan): void {
  if (plan.status !== "needs_review") {
    setSpatialRoutePlan(chatId, { ...plan, status: "needs_review" });
  }
  setPendingSpatialTransitionStatus(chatId, "needs_review");
}

export function startSpatialRoute(
  chatId: string,
  definition: SpatialContextDefinition,
  currentLocationId: string,
  targetLocation: SpatialLocation,
  destinations: SpatialDestination[],
): SpatialRoutePlan | null {
  const route = findSpatialRoute(definition, currentLocationId, targetLocation.id);
  if (!route || route.steps.length === 0) return null;
  const plan: SpatialRoutePlan = {
    version: 1,
    targetLocationId: targetLocation.id,
    targetLocationName: targetLocation.name,
    locationIds: route.locationIds,
    steps: route.steps,
    currentIndex: 0,
    expectedDefinitionRevision: definition.revision,
    status: "ready",
  };
  const firstDestination = destinations.find((destination) => destination.id === route.steps[0]!.locationId);
  if (!firstDestination) return null;
  setSpatialRoutePlan(chatId, plan);
  queueRouteDestination(chatId, plan, firstDestination, currentLocationId);
  return plan;
}

export function reconcileSpatialRoutePlan(chatId: string, spatial: SpatialContextResponse): void {
  const plan = getSpatialRoutePlan(chatId);
  const definition = spatial.definition;
  if (!plan || !definition || !spatial.currentLocationId) return;
  if (definition.revision !== plan.expectedDefinitionRevision) {
    markSpatialRouteNeedsReview(chatId, plan);
    return;
  }

  const currentIndex = plan.locationIds.indexOf(spatial.currentLocationId);
  if (currentIndex < plan.currentIndex || currentIndex > plan.currentIndex + 1 || currentIndex < 0) {
    markSpatialRouteNeedsReview(chatId, plan);
    return;
  }
  if (spatial.currentLocationId === plan.targetLocationId) {
    clearSpatialRoutePlan(chatId);
    clearPendingSpatialTransition(chatId);
    return;
  }

  const advancedPlan = currentIndex > plan.currentIndex ? { ...plan, currentIndex } : plan;
  const nextId = advancedPlan.locationIds[currentIndex + 1];
  const nextDestination = spatial.destinations.find((destination) => destination.id === nextId);
  if (!nextId || !nextDestination) {
    markSpatialRouteNeedsReview(chatId, advancedPlan);
    return;
  }

  if (advancedPlan !== plan) setSpatialRoutePlan(chatId, advancedPlan);
  const pending = getPendingSpatialTransition(chatId);
  if (
    pending?.transition.destinationId === nextDestination.id &&
    pending.transition.expectedCurrentLocationId === spatial.currentLocationId &&
    pending.transition.expectedDefinitionRevision === advancedPlan.expectedDefinitionRevision &&
    pending.status === (advancedPlan.status === "needs_review" ? "needs_review" : "ready")
  ) {
    return;
  }
  queueRouteDestination(chatId, advancedPlan, nextDestination, spatial.currentLocationId);
}
