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

export function startNewSpatialMap(
  definition: SpatialContextDefinition,
  preserveExistingLocations: boolean,
): { definition: SpatialContextDefinition; location: SpatialLocation } {
  const locations = preserveExistingLocations
    ? definition.locations.map((location) => ({
        ...location,
        status: "archived" as const,
        ...(location.parentId === null ? { sortOrder: location.sortOrder + 1 } : {}),
      }))
    : [];
  const result = addSpatialLocation(
    {
      ...definition,
      locations,
      startingLocationId: null,
    },
    { name: "New world", kind: "region" },
  );
  if (!preserveExistingLocations) return result;
  const location = { ...result.location, sortOrder: 0 };
  return {
    location,
    definition: {
      ...result.definition,
      locations: result.definition.locations.map((candidate) =>
        candidate.id === location.id ? location : candidate,
      ),
    },
  };
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

export type SpatialDirectLinkDirection = "outgoing" | "both" | "incoming";

type SpatialDirectLink = SpatialLocation["links"][number];
type SpatialDirectLinkPatch = Partial<Omit<SpatialDirectLink, "targetId" | "bidirectional">>;

interface SpatialDirectLinkRecord {
  sourceId: string;
  linkIndex: number;
  link: SpatialDirectLink;
}

function spatialDirectLinkPairKey(firstId: string, secondId: string): string {
  return firstId < secondId ? `${firstId}\u0000${secondId}` : `${secondId}\u0000${firstId}`;
}

function spatialDirectLinkRecords(
  definition: SpatialContextDefinition,
): Map<string, SpatialDirectLinkRecord[]> {
  const recordsByPair = new Map<string, SpatialDirectLinkRecord[]>();
  for (const location of definition.locations) {
    location.links.forEach((link, linkIndex) => {
      const key = spatialDirectLinkPairKey(location.id, link.targetId);
      const records = recordsByPair.get(key) ?? [];
      records.push({ sourceId: location.id, linkIndex, link });
      recordsByPair.set(key, records);
    });
  }
  return recordsByPair;
}

export function canonicalizeSpatialDirectLinks(
  definition: SpatialContextDefinition,
): SpatialContextDefinition {
  const recordsByPair = spatialDirectLinkRecords(definition);
  const canonicalByPair = new Map<
    string,
    { record: SpatialDirectLinkRecord; bidirectional: boolean }
  >();

  for (const [key, records] of recordsByPair) {
    const oneWayRecords = records.filter((record) => !record.link.bidirectional);
    if (oneWayRecords.length === 0) {
      canonicalByPair.set(key, { record: records[0]!, bidirectional: true });
      continue;
    }

    const oneWaySources = new Set(oneWayRecords.map((record) => record.sourceId));
    canonicalByPair.set(key, {
      record: oneWayRecords[0]!,
      // Opposing one-way records already allow travel in both directions.
      // A one-way record paired with a stale two-way record is authoritative.
      bidirectional: oneWaySources.size > 1,
    });
  }

  let changed = false;
  const locations = definition.locations.map((location) => {
    const links = location.links.flatMap((link, linkIndex) => {
      const key = spatialDirectLinkPairKey(location.id, link.targetId);
      const canonical = canonicalByPair.get(key)!;
      if (canonical.record.sourceId !== location.id || canonical.record.linkIndex !== linkIndex) {
        changed = true;
        return [];
      }
      if (link.bidirectional === canonical.bidirectional) return [link];
      changed = true;
      return [{ ...link, bidirectional: canonical.bidirectional }];
    });
    return links.length === location.links.length && links.every((link, index) => link === location.links[index])
      ? location
      : { ...location, links };
  });

  return changed ? { ...definition, locations } : definition;
}

export function setSpatialDirectLinkDirection(
  definition: SpatialContextDefinition,
  currentLocationId: string,
  relatedLocationId: string,
  direction: SpatialDirectLinkDirection,
): SpatialContextDefinition {
  if (currentLocationId === relatedLocationId) return definition;
  const canonical = canonicalizeSpatialDirectLinks(definition);
  const pairKey = spatialDirectLinkPairKey(currentLocationId, relatedLocationId);
  const existing = spatialDirectLinkRecords(canonical).get(pairKey)?.[0];
  const sourceId =
    direction === "incoming"
      ? relatedLocationId
      : direction === "outgoing"
        ? currentLocationId
        : (existing?.sourceId ?? currentLocationId);
  const targetId = sourceId === currentLocationId ? relatedLocationId : currentLocationId;
  const nextLink: SpatialDirectLink = existing
    ? { ...existing.link, targetId, bidirectional: direction === "both" }
    : { targetId, bidirectional: direction === "both", state: "available" };

  return {
    ...canonical,
    locations: canonical.locations.map((location) => {
      const links = location.links.filter(
        (link) => spatialDirectLinkPairKey(location.id, link.targetId) !== pairKey,
      );
      if (location.id !== sourceId) {
        return links.length === location.links.length ? location : { ...location, links };
      }
      const insertionIndex = existing?.sourceId === sourceId ? Math.min(existing.linkIndex, links.length) : links.length;
      links.splice(insertionIndex, 0, nextLink);
      return { ...location, links };
    }),
  };
}

export function updateSpatialDirectLink(
  definition: SpatialContextDefinition,
  firstLocationId: string,
  secondLocationId: string,
  patch: SpatialDirectLinkPatch,
): SpatialContextDefinition {
  const canonical = canonicalizeSpatialDirectLinks(definition);
  const pairKey = spatialDirectLinkPairKey(firstLocationId, secondLocationId);
  if (!spatialDirectLinkRecords(canonical).has(pairKey)) return canonical;
  return {
    ...canonical,
    locations: canonical.locations.map((location) => {
      const links = location.links.map((link) =>
        spatialDirectLinkPairKey(location.id, link.targetId) === pairKey
          ? { ...link, ...patch, targetId: link.targetId, bidirectional: link.bidirectional }
          : link,
      );
      return links.some((link, index) => link !== location.links[index]) ? { ...location, links } : location;
    }),
  };
}

export function removeSpatialDirectLink(
  definition: SpatialContextDefinition,
  firstLocationId: string,
  secondLocationId: string,
): SpatialContextDefinition {
  const pairKey = spatialDirectLinkPairKey(firstLocationId, secondLocationId);
  let changed = false;
  const locations = definition.locations.map((location) => {
    const links = location.links.filter(
      (link) => spatialDirectLinkPairKey(location.id, link.targetId) !== pairKey,
    );
    if (links.length === location.links.length) return location;
    changed = true;
    return { ...location, links };
  });
  return changed ? { ...definition, locations } : definition;
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

export function removeSpatialSubtree(
  definition: SpatialContextDefinition,
  locationId: string,
): SpatialContextDefinition {
  const removedIds = new Set([locationId, ...getSpatialDescendantIds(definition, locationId)]);
  return {
    ...definition,
    startingLocationId: definition.startingLocationId && removedIds.has(definition.startingLocationId)
      ? null
      : definition.startingLocationId,
    locations: definition.locations
      .filter((location) => !removedIds.has(location.id))
      .map((location) => ({
        ...location,
        links: location.links.filter((link) => !removedIds.has(link.targetId)),
      })),
  };
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
