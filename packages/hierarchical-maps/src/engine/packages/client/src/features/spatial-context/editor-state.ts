import {
  buildSpatialLocationIndex,
  compareSpatialLocations,
  getSpatialDescendantIds,
  spatialContextDefinitionSchema,
  validateSpatialContextDefinition,
  wouldCreateSpatialCycle,
  type SpatialChildPresentation,
  type SpatialContextDefinition,
  type SpatialDefinitionIssue,
  type SpatialLocation,
  type SpatialLocationKind,
  type SpatialOwnerMode,
} from "@marinara-engine/shared";

export interface SpatialDefinitionDifference {
  added: string[];
  removed: string[];
  changed: string[];
  settingsChanged: boolean;
}

export function cloneSpatialDefinition(definition: SpatialContextDefinition): SpatialContextDefinition {
  return structuredClone(definition);
}

export function createEmptySpatialDefinition(ownerMode: SpatialOwnerMode): SpatialContextDefinition {
  return {
    schemaVersion: 1,
    ownerMode,
    enabled: false,
    locations: [],
    startingLocationId: null,
    revision: 0,
  };
}

function createId(locations: SpatialLocation[]): string {
  const used = new Set(locations.map((location) => location.id));
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const uuid = globalThis.crypto?.randomUUID?.().replaceAll("-", "") ?? `${Date.now()}${attempt}`;
    const id = `loc_${uuid}`;
    if (!used.has(id)) return id;
  }
  return `loc_${Date.now()}_${locations.length}`;
}

function nextSortOrder(definition: SpatialContextDefinition, parentId: string | null): number {
  const siblings = definition.locations.filter((location) => location.parentId === parentId);
  return siblings.length === 0 ? 0 : Math.max(...siblings.map((location) => location.sortOrder)) + 1;
}

function nextLayerOrder(definition: SpatialContextDefinition, parentId: string | null): number {
  const orders = definition.locations
    .filter((location) => location.parentId === parentId && location.layerOrder !== undefined)
    .map((location) => location.layerOrder ?? 0);
  return orders.length === 0 ? 0 : Math.max(...orders) + 1;
}

function childLayout(
  definition: SpatialContextDefinition,
  parentId: string | null,
): Pick<SpatialLocation, "placement" | "layerOrder"> {
  const parent = parentId ? definition.locations.find((location) => location.id === parentId) : undefined;
  if (parent?.childPresentation === "map") return { placement: { x: 50, y: 50 } };
  if (parent?.childPresentation === "layers") return { layerOrder: nextLayerOrder(definition, parentId) };
  return {};
}

export function createSpatialLocation(
  definition: SpatialContextDefinition,
  options: {
    parentId?: string | null;
    name?: string;
    kind?: SpatialLocationKind;
  } = {},
): SpatialLocation {
  const parentId = options.parentId ?? null;
  return {
    id: createId(definition.locations),
    parentId,
    name: options.name ?? (parentId === null ? "New world" : "New location"),
    kind: options.kind ?? (parentId === null ? "region" : "place"),
    description: "",
    lorebookEntryIds: [],
    childPresentation: "list",
    links: [],
    status: "active",
    sortOrder: nextSortOrder(definition, parentId),
    ...childLayout(definition, parentId),
  };
}

export function addSpatialLocation(
  definition: SpatialContextDefinition,
  options: Parameters<typeof createSpatialLocation>[1] = {},
): { definition: SpatialContextDefinition; location: SpatialLocation } {
  const location = createSpatialLocation(definition, options);
  const next = { ...definition, locations: [...definition.locations, location] };
  if (next.startingLocationId === null) next.startingLocationId = location.id;
  return { definition: next, location };
}

function normalizeChildPresentation(
  definition: SpatialContextDefinition,
  parentId: string,
  presentation: SpatialChildPresentation,
): SpatialContextDefinition {
  const orderedChildIds = definition.locations
    .filter((location) => location.parentId === parentId)
    .sort(compareSpatialLocations)
    .map((location) => location.id);
  const layerOrderById = new Map(orderedChildIds.map((id, index) => [id, index]));
  return {
    ...definition,
    locations: definition.locations.map((location) => {
      if (location.parentId !== parentId) return location;
      if (presentation === "map") {
        return { ...location, placement: location.placement ?? { x: 50, y: 50 }, layerOrder: undefined };
      }
      if (presentation === "layers") {
        return { ...location, placement: undefined, layerOrder: layerOrderById.get(location.id) ?? 0 };
      }
      return { ...location, placement: undefined, layerOrder: undefined };
    }),
  };
}

export function updateSpatialLocation(
  definition: SpatialContextDefinition,
  locationId: string,
  patch: Partial<SpatialLocation>,
): SpatialContextDefinition {
  let next = {
    ...definition,
    locations: definition.locations.map((location) =>
      location.id === locationId ? { ...location, ...patch, id: location.id } : location,
    ),
  };
  if (patch.childPresentation) next = normalizeChildPresentation(next, locationId, patch.childPresentation);
  return next;
}

export function reparentSpatialLocation(
  definition: SpatialContextDefinition,
  locationId: string,
  parentId: string | null,
): SpatialContextDefinition {
  if (parentId && wouldCreateSpatialCycle(definition, locationId, parentId)) {
    return definition;
  }
  const layout = childLayout(definition, parentId);
  return updateSpatialLocation(definition, locationId, {
    parentId,
    sortOrder: nextSortOrder(definition, parentId),
    placement: layout.placement,
    layerOrder: layout.layerOrder,
  });
}

export function duplicateSpatialSubtree(
  definition: SpatialContextDefinition,
  locationId: string,
): { definition: SpatialContextDefinition; rootId: string } | null {
  const byId = buildSpatialLocationIndex(definition);
  const source = byId.get(locationId);
  if (!source) return null;
  const subtreeIds = new Set([locationId, ...getSpatialDescendantIds(definition, locationId)]);
  const ordered = definition.locations.filter((location) => subtreeIds.has(location.id));
  const idMap = new Map<string, string>();
  const staged: SpatialLocation[] = [];
  for (const location of ordered) {
    const id = createId([...definition.locations, ...staged]);
    idMap.set(location.id, id);
    staged.push({ ...location, id });
  }
  const copies = staged.map((copy, index) => {
    const original = ordered[index]!;
    const parentId =
      original.id === source.id ? source.parentId : (idMap.get(original.parentId ?? "") ?? original.parentId);
    const placement = original.placement
      ? { x: Math.min(100, original.placement.x + 5), y: Math.min(100, original.placement.y + 5) }
      : undefined;
    return {
      ...copy,
      parentId,
      name: original.id === source.id ? `${source.name} copy` : copy.name,
      sortOrder: original.id === source.id ? nextSortOrder(definition, parentId) : copy.sortOrder,
      placement,
      links: original.links.map((link) => ({ ...link, targetId: idMap.get(link.targetId) ?? link.targetId })),
    };
  });
  return {
    definition: { ...definition, locations: [...definition.locations, ...copies] },
    rootId: idMap.get(locationId)!,
  };
}

export function archiveSpatialLocation(
  definition: SpatialContextDefinition,
  locationId: string,
  replacementLocationId?: string | null,
): SpatialContextDefinition {
  const next = updateSpatialLocation(definition, locationId, { status: "archived" });
  return next.startingLocationId === locationId
    ? { ...next, startingLocationId: replacementLocationId ?? null, enabled: false }
    : next;
}

export function spatialDefinitionIssues(definition: SpatialContextDefinition): SpatialDefinitionIssue[] {
  const issues = [...validateSpatialContextDefinition(definition).issues];
  const parsed = spatialContextDefinitionSchema.safeParse(definition);
  if (!parsed.success) {
    for (const schemaIssue of parsed.error.issues) {
      const path = schemaIssue.path.filter(
        (part): part is string | number => typeof part === "string" || typeof part === "number",
      );
      if (
        issues.some(
          (existing) =>
            existing.message === schemaIssue.message && JSON.stringify(existing.path) === JSON.stringify(path),
        )
      ) {
        continue;
      }
      const params =
        "params" in schemaIssue && schemaIssue.params && typeof schemaIssue.params === "object"
          ? (schemaIssue.params as Record<string, unknown>)
          : null;
      const locationIndex = path[0] === "locations" && typeof path[1] === "number" ? path[1] : null;
      const locationId =
        typeof params?.locationId === "string"
          ? params.locationId
          : locationIndex !== null
            ? definition.locations[locationIndex]?.id
            : undefined;
      issues.push({
        code:
          typeof params?.spatialCode === "string"
            ? (params.spatialCode as SpatialDefinitionIssue["code"])
            : "stored_definition_invalid",
        message: schemaIssue.message,
        path,
        ...(locationId ? { locationId } : {}),
      });
    }
  }
  if (definition.enabled && definition.startingLocationId === null) {
    issues.push({
      code: "starting_location_missing",
      message: "Choose an active starting location before enabling the map.",
      path: ["startingLocationId"],
    });
  }
  return issues;
}

export function compareSpatialDefinitions(
  base: SpatialContextDefinition | null,
  draft: SpatialContextDefinition,
): SpatialDefinitionDifference {
  if (!base) {
    return { added: draft.locations.map((location) => location.id), removed: [], changed: [], settingsChanged: true };
  }
  const baseById = buildSpatialLocationIndex(base);
  const draftById = buildSpatialLocationIndex(draft);
  const added = draft.locations.filter((location) => !baseById.has(location.id)).map((location) => location.id);
  const removed = base.locations.filter((location) => !draftById.has(location.id)).map((location) => location.id);
  const changed = draft.locations
    .filter((location) => {
      const previous = baseById.get(location.id);
      return previous && JSON.stringify(previous) !== JSON.stringify(location);
    })
    .map((location) => location.id);
  return {
    added,
    removed,
    changed,
    settingsChanged:
      base.enabled !== draft.enabled ||
      base.startingLocationId !== draft.startingLocationId ||
      base.ownerMode !== draft.ownerMode,
  };
}

export function isSpatialDefinitionDirty(
  base: SpatialContextDefinition | null,
  draft: SpatialContextDefinition,
): boolean {
  if (!base) return draft.locations.length > 0 || draft.enabled;
  return JSON.stringify(base) !== JSON.stringify(draft);
}
