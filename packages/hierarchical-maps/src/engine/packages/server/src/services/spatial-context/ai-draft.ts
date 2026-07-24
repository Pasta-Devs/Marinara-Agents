import {
  SPATIAL_CONTEXT_LIMITS,
  compareSpatialLocations,
  resolveSpatialLocationDepth,
  resolveSpatialBreadcrumb,
  spatialRadialPlacement,
  spatialContextDefinitionSchema,
  wouldCreateSpatialCycle,
  type SpatialChildPresentation,
  type SpatialContextDefinition,
  type SpatialLinkState,
  type SpatialLocation,
  type SpatialLocationKind,
  type SpatialMapDraftSize,
  type SpatialMapGroundingMode,
  type SpatialOwnerMode,
} from "@marinara-engine/shared";
import { newId } from "./package-runtime.js";
import {
  defaultHierarchyProfile,
  defaultGenerationPreferences,
  hierarchyTypeId,
  normalizeHierarchyProfile,
  renderSpatialGenerationPromptTemplate,
  resolveSpatialGenerationPromptOption,
  type SpatialHierarchyProfile,
  type SpatialHierarchyType,
  type SpatialGenerationPromptTemplates,
} from "../../../../maps-shared/src/maps-model.js";

interface SpatialDraftSizeSpec {
  targetLocations: number;
  maxLocations: number;
  maxDepth: number;
  maxTokens: number;
}

interface NormalizeSpatialMapPlanOptions {
  ownerMode: SpatialOwnerMode;
  revision: number;
  enabled: boolean;
  size: SpatialMapDraftSize;
  maxLocations?: number;
  maxDepth?: number;
  sourceEntryIdsByKey?: ReadonlyMap<string, string>;
  requireLoreSource?: boolean;
  requiredLocationNames?: readonly string[];
  externalDefinition?: SpatialContextDefinition;
  externalLinkTargetIdsByKey?: ReadonlyMap<string, string>;
}

interface BuildSpatialMapPromptOptions {
  ownerMode: SpatialOwnerMode;
  size: SpatialMapDraftSize;
  sourceContext: string;
  instructions?: string;
  groundingMode?: SpatialMapGroundingMode;
  loreCatalog?: string;
  requiredLocationNames?: readonly string[];
  hierarchyMode?: SpatialHierarchyProfile["mode"];
  hierarchyProfile?: SpatialHierarchyProfile;
  creatorGuidance?: string;
  promptVariables?: Readonly<Record<string, string>>;
  promptTemplates?: SpatialGenerationPromptTemplates;
}

interface NormalizeSpatialMapExpansionOptions {
  definition: SpatialContextDefinition;
  targetLocationId: string;
  size: SpatialMapDraftSize;
  sourceEntryIdsByKey?: ReadonlyMap<string, string>;
  requireLoreSource?: boolean;
}

interface BuildSpatialMapExpansionPromptOptions {
  definition: SpatialContextDefinition;
  targetLocationId: string;
  size: SpatialMapDraftSize;
  sourceContext: string;
  instructions?: string;
  groundingMode?: SpatialMapGroundingMode;
  loreCatalog?: string;
  hierarchyProfile?: SpatialHierarchyProfile;
  creatorGuidance?: string;
  promptVariables?: Readonly<Record<string, string>>;
  promptTemplates?: SpatialGenerationPromptTemplates;
}

interface PlanLocationSource {
  record: Record<string, unknown>;
  key: string;
  id: string;
  aliases: string[];
  originalIndex: number;
}

// maxTokens is the requested output budget for the draft/expansion call. It is
// deliberately generous so reasoning-heavy models (which spend much of the
// budget on hidden thinking) can still emit complete JSON. The Engine caps this
// request to the connection's configured Max Output Tokens, so a lower
// connection setting is still respected while a higher one now takes effect —
// previously these values were too small for the connection setting to matter
// (Marinara-Engine #4026).
export const SPATIAL_DRAFT_SIZE_SPECS: Record<SpatialMapDraftSize, SpatialDraftSizeSpec> = {
  small: { targetLocations: 8, maxLocations: 12, maxDepth: 3, maxTokens: 12_000 },
  medium: { targetLocations: 16, maxLocations: 24, maxDepth: 5, maxTokens: 24_000 },
  large: { targetLocations: 28, maxLocations: 40, maxDepth: 7, maxTokens: 40_000 },
};

const LOCATION_KINDS = new Set<SpatialLocationKind>(["region", "settlement", "place", "building", "floor", "room"]);
const CHILD_PRESENTATIONS = new Set<SpatialChildPresentation>(["map", "layers", "list"]);
const LINK_STATES = new Set<SpatialLinkState>(["available", "hidden", "blocked"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function alias(value: unknown): string {
  return typeof value === "string" ? value.trim().toLocaleLowerCase() : "";
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean)),
  );
}


function finiteNumber(value: unknown): number | null {

  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function clampCoordinate(value: unknown): number | null {
  const parsed = finiteNumber(value);
  return parsed === null ? null : Math.min(100, Math.max(0, parsed));
}

function uniquePlanKey(value: unknown, name: string, index: number, used: Set<string>): string {
  const source = text(value, 80) || name || `location-${index + 1}`;
  const cleaned =
    source
      .toLocaleLowerCase()
      .replace(/[^a-z0-9._:-]+/gu, "-")
      .replace(/^[^a-z0-9]+/u, "")
      .replace(/-+$/u, "")
      .slice(0, 64) || `location-${index + 1}`;
  let candidate = cleaned;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${cleaned.slice(0, 56)}-${suffix++}`;
  }
  used.add(candidate);
  return candidate;
}

function inferKind(name: string, root: boolean): SpatialLocationKind {
  const normalized = name.toLocaleLowerCase();
  if (/floor|level|deck|basement|cellar|attic/u.test(normalized)) return "floor";
  if (/room|chamber|hall|office|bedroom|kitchen|library/u.test(normalized)) return "room";
  if (/tower|castle|inn|house|temple|shop|building|station|palace/u.test(normalized)) return "building";
  if (/city|town|village|settlement|camp/u.test(normalized)) return "settlement";
  return root ? "region" : "place";
}

function locationKind(value: unknown, name: string, root: boolean): SpatialLocationKind {
  return typeof value === "string" && LOCATION_KINDS.has(value as SpatialLocationKind)
    ? (value as SpatialLocationKind)
    : inferKind(name, root);
}

function childPresentation(value: unknown): SpatialChildPresentation {
  return typeof value === "string" && CHILD_PRESENTATIONS.has(value as SpatialChildPresentation)
    ? (value as SpatialChildPresentation)
    : "list";
}

function linkState(value: unknown): SpatialLinkState {
  return typeof value === "string" && LINK_STATES.has(value as SpatialLinkState)
    ? (value as SpatialLinkState)
    : "available";
}

const GENERATED_ICON_NAME_RULES: Array<[RegExp, string]> = [
  [/(?:castle|citadel|fortress|palace|keep)/u, "🏰"],
  [/(?:harbou?r|dock|port|pier|marina)/u, "⚓"],
  [/(?:tavern|inn|pub|alehouse|bar)/u, "🍺"],
  [/(?:lighthouse|watchtower|tower|spire)/u, "🗼"],
  [/(?:forest|woods|grove|woodland)/u, "🌲"],
  [/(?:mountain|peak|summit|cliff)/u, "⛰️"],
  [/(?:river|lake|sea|ocean|coast|beach|waterfall)/u, "🌊"],
  [/(?:sewer|tunnel|cavern|cave|catacomb)/u, "🕳️"],
  [/(?:mine|quarry)/u, "⛏️"],
  [/(?:library|archive|study|scriptorium)/u, "📚"],
  [/(?:temple|shrine|church|chapel|sanctuary)/u, "⛩️"],
  [/(?:market|shop|store|bazaar|merchant)/u, "🏪"],
  [/(?:house|home|cottage|manor|villa)/u, "🏠"],
  [/(?:garden|park|meadow|orchard)/u, "🌿"],
  [/(?:dungeon|prison|jail|gaol)/u, "⛓️"],
  [/(?:academy|school|university|college)/u, "🏫"],
  [/(?:hospital|clinic|infirmary|healer)/u, "🏥"],
  [/(?:farm|field|granary|mill)/u, "🌾"],
  [/(?:bridge|crossing)/u, "🌉"],
  [/(?:road|trail|path|highway)/u, "🛣️"],
];

const GENERATED_ICON_KIND_DEFAULTS: Record<SpatialLocationKind, string> = {
  region: "🗺️",
  settlement: "🏘️",
  place: "📍",
  building: "🏛️",
  floor: "🪜",
  room: "🚪",
};

function generatedLocationIcon(value: unknown, name: string, kind: SpatialLocationKind): string {
  const supplied = text(value, 64);
  const emoji = supplied.match(
    /(?:\p{Regional_Indicator}{2}|[0-9#*]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\p{Emoji_Modifier})?)*)/u,
  )?.[0];
  if (emoji) return emoji;

  const normalizedName = name.toLocaleLowerCase();
  return GENERATED_ICON_NAME_RULES.find(([pattern]) => pattern.test(normalizedName))?.[1] ?? GENERATED_ICON_KIND_DEFAULTS[kind];
}

function readPlacement(record: Record<string, unknown>): SpatialLocation["placement"] {
  const placement = isRecord(record.placement) ? record.placement : record;
  const x = clampCoordinate(placement.x);
  const y = clampCoordinate(placement.y);
  return x === null || y === null ? undefined : { x, y };
}

function readPlanLocations(value: unknown): Record<string, unknown>[] {
  if (!isRecord(value)) return [];
  const container = Array.isArray(value.locations) ? value : isRecord(value.map) ? value.map : value;
  return Array.isArray(container.locations) ? container.locations.filter(isRecord) : [];
}

function assertRequiredLocationNames(
  definition: SpatialContextDefinition,
  requiredLocationNames: readonly string[] = [],
): void {
  if (requiredLocationNames.length === 0) return;
  const normalizeRequiredName = (name: string) => name.normalize("NFC").trim().replace(/\s+/gu, " ");
  const counts = new Map<string, number>();
  for (const location of definition.locations) {
    const name = normalizeRequiredName(location.name);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const missing = requiredLocationNames.filter((name) => (counts.get(normalizeRequiredName(name)) ?? 0) === 0);
  if (missing.length > 0) {
    throw new Error(`The generated hierarchy omitted accepted Game map locations: ${missing.join(", ")}.`);
  }
  const duplicated = requiredLocationNames.filter((name) => (counts.get(normalizeRequiredName(name)) ?? 0) > 1);
  if (duplicated.length > 0) {
    throw new Error(`The generated hierarchy duplicated accepted Game map locations: ${duplicated.join(", ")}.`);
  }
}
export interface SpatialMapPlanProvenanceRecord {
  sourceKeys: string[];
  origin: "inferred" | "added_by_ai";
}

export function readSpatialMapPlanProvenance(value: unknown): SpatialMapPlanProvenanceRecord[] {
  return readPlanLocations(value).map((location) => ({
    sourceKeys: stringList(location.sourceKeys),
    origin:
      location.origin === "inferred" || location.provenance === "inferred"
        ? "inferred"
        : "added_by_ai",
  }));
}

function readPlanHierarchyTypes(value: unknown): SpatialHierarchyType[] {
  if (!isRecord(value)) return [];
  const container = isRecord(value.map) && !Array.isArray(value.locationTypes) ? value.map : value;
  if (!Array.isArray(container.locationTypes)) return [];
  const used = new Set<string>();
  return container.locationTypes.filter(isRecord).flatMap((record) => {
    const label = text(record.label ?? record.name, 80);
    const baseKind = locationKind(record.baseKind ?? record.kind, label, false);
    if (!label) return [];
    let id = hierarchyTypeId(text(record.key ?? record.id, 80) || label);
    let suffix = 2;
    const baseId = id;
    while (used.has(id)) id = `${baseId}_${suffix++}`;
    used.add(id);
    return [{ id, label, baseKind, ...(text(record.description, 240) ? { description: text(record.description, 240) } : {}) }];
  });
}

export function readSpatialHierarchyProfile(
  value: unknown,
  locations: SpatialLocation[],
  requestedProfile?: SpatialHierarchyProfile,
): SpatialHierarchyProfile {
  const generatedTypes = requestedProfile?.types.length ? requestedProfile.types : readPlanHierarchyTypes(value);
  const fallback = defaultHierarchyProfile({ locations });
  const types = generatedTypes.length > 0 ? generatedTypes : fallback.types;
  const exactTypeByPromptKey = new Map<string, SpatialHierarchyType>();
  for (const type of types) {
    exactTypeByPromptKey.set(alias(type.id), type);
  }
  const aliasedTypeByPromptKey = new Map<string, SpatialHierarchyType>();
  for (const type of types) {
    for (const key of [type.id.replace(/^type_/u, ""), type.label]) {
      const promptKey = alias(key);
      if (!exactTypeByPromptKey.has(promptKey) && !aliasedTypeByPromptKey.has(promptKey)) {
        aliasedTypeByPromptKey.set(promptKey, type);
      }
    }
  }
  const firstTypeByKind = new Map<SpatialLocationKind, SpatialHierarchyType>();
  for (const type of types) {
    if (!firstTypeByKind.has(type.baseKind)) firstTypeByKind.set(type.baseKind, type);
  }
  const rawLocations = readPlanLocations(value);
  const claimedRawIndexes = new Set<number>();
  const locationTypeIds: Record<string, string> = { ...(requestedProfile?.locationTypeIds ?? {}) };
  locations.forEach((location, index) => {
    const normalizedName = alias(location.name);
    let rawIndex = rawLocations.findIndex(
      (raw, candidateIndex) =>
        !claimedRawIndexes.has(candidateIndex) &&
        [raw.key, raw.id, raw.name].some((candidate) => alias(candidate) === normalizedName),
    );
    if (rawIndex < 0 && rawLocations[index] && !claimedRawIndexes.has(index)) rawIndex = index;
    if (rawIndex >= 0) claimedRawIndexes.add(rawIndex);
    const raw = rawIndex >= 0 ? rawLocations[rawIndex] : undefined;
    const requestedType = raw ? alias(raw.typeKey ?? raw.typeId ?? raw.type) : "";
    const type =
      exactTypeByPromptKey.get(requestedType) ??
      aliasedTypeByPromptKey.get(requestedType) ??
      firstTypeByKind.get(location.kind) ??
      types[0]!;
    locationTypeIds[location.id] = type.id;
  });
  return normalizeHierarchyProfile(
    {
      version: 1,
      mode: requestedProfile?.mode ?? "auto",
      name:
        requestedProfile?.name ||
        (isRecord(value) ? text(value.hierarchyName ?? value.worldName, 120) : "") ||
        "AI-inferred hierarchy",
      types,
      locationTypeIds,
    },
    { locations },
  );
}


function normalizeLayouts(locations: SpatialLocation[]): SpatialLocation[] {
  const childrenByParent = new Map<string, SpatialLocation[]>();
  for (const location of locations) {
    if (!location.parentId) continue;
    const children = childrenByParent.get(location.parentId) ?? [];
    children.push(location);
    childrenByParent.set(location.parentId, children);
  }

  const inferredParents = locations.map((location) => {
    const children = childrenByParent.get(location.id) ?? [];
    if (children.length === 0 || location.childPresentation !== "list") return location;
    if (children.some((child) => child.kind === "floor")) {
      return { ...location, childPresentation: "layers" as const };
    }
    if (children.length >= 3 && ["region", "settlement", "place"].includes(location.kind)) {
      return { ...location, childPresentation: "map" as const };
    }
    return location;
  });
  const presentationById = new Map(inferredParents.map((location) => [location.id, location.childPresentation]));
  const siblingIndex = new Map<string, number>();
  const siblingCounts = new Map<string, number>();
  for (const location of inferredParents) {
    if (!location.parentId) continue;
    siblingCounts.set(location.parentId, (siblingCounts.get(location.parentId) ?? 0) + 1);
  }

  return inferredParents.map((location) => {
    if (!location.parentId) {
      return { ...location, placement: undefined, layerOrder: undefined };
    }
    const presentation = presentationById.get(location.parentId) ?? "list";
    const index = siblingIndex.get(location.parentId) ?? 0;
    siblingIndex.set(location.parentId, index + 1);
    if (presentation === "map") {
      return {
        ...location,
        placement: location.placement ?? spatialRadialPlacement(index, siblingCounts.get(location.parentId) ?? 1),
        layerOrder: undefined,
      };
    }
    if (presentation === "layers") {
      return { ...location, placement: undefined, layerOrder: index };
    }
    return { ...location, placement: undefined, layerOrder: undefined };
  });
}

function inferredRouteLabel(
  parent: SpatialLocation | undefined,
  source: SpatialLocation,
  target: SpatialLocation,
): string {
  if (parent?.childPresentation === "layers" || (source.kind === "floor" && target.kind === "floor")) {
    return "Stairs";
  }
  if (
    parent?.kind === "building" ||
    parent?.kind === "floor" ||
    source.kind === "room" ||
    target.kind === "room"
  ) {
    return "Hallway";
  }
  if (parent?.kind === "settlement") return "Street";
  if (parent?.kind === "region") return "Road";
  return "Path";
}

function ensureSparseSiblingRouteLinks(locations: SpatialLocation[]): SpatialLocation[] {
  const next = locations.map((location) => ({
    ...location,
    links: location.links.map((link) => ({ ...link })),
  }));
  const byId = new Map(next.map((location) => [location.id, location]));
  const groups = new Map<string | null, SpatialLocation[]>();
  for (const location of next) {
    const siblings = groups.get(location.parentId) ?? [];
    siblings.push(location);
    groups.set(location.parentId, siblings);
  }

  const areConnected = (sourceId: string, targetId: string, siblingIds: ReadonlySet<string>): boolean => {
    const visited = new Set([sourceId]);
    const pending = [sourceId];
    while (pending.length > 0) {
      const currentId = pending.shift()!;
      if (currentId === targetId) return true;
      for (const location of next) {
        if (!siblingIds.has(location.id)) continue;
        for (const link of location.links) {
          if (!siblingIds.has(link.targetId)) continue;
          const neighborId = location.id === currentId ? link.targetId : link.targetId === currentId ? location.id : null;
          if (!neighborId || visited.has(neighborId)) continue;
          visited.add(neighborId);
          pending.push(neighborId);
        }
      }
    }
    return false;
  };

  for (const [parentId, unsortedSiblings] of groups) {
    if (unsortedSiblings.length < 2) continue;
    const parent = parentId ? byId.get(parentId) : undefined;
    const siblings = [...unsortedSiblings].sort((left, right) => {
      if (parent?.childPresentation === "layers") {
        return (left.layerOrder ?? left.sortOrder) - (right.layerOrder ?? right.sortOrder);
      }
      return compareSpatialLocations(left, right);
    });
    const siblingIds = new Set(siblings.map((location) => location.id));

    for (let index = 1; index < siblings.length; index += 1) {
      let source = siblings[index]!;
      let target = siblings[index - 1]!;
      if (areConnected(source.id, target.id, siblingIds)) continue;
      if (source.links.length >= SPATIAL_CONTEXT_LIMITS.maxLinksPerLocation) {
        [source, target] = [target, source];
      }
      if (source.links.length >= SPATIAL_CONTEXT_LIMITS.maxLinksPerLocation) continue;
      source.links.push({
        targetId: target.id,
        label: inferredRouteLabel(parent, source, target),
        bidirectional: true,
        state: "available",
      });
    }
  }

  return next;
}

export function normalizeSpatialMapPlan(
  value: unknown,
  options: NormalizeSpatialMapPlanOptions,
): SpatialContextDefinition {
  const locationLimit = Math.max(
    0,
    Math.min(options.maxLocations ?? SPATIAL_DRAFT_SIZE_SPECS[options.size].maxLocations, SPATIAL_CONTEXT_LIMITS.maxLocations),
  );
  const rawLocations = readPlanLocations(value).slice(0, locationLimit);
  if (rawLocations.length === 0) {
    throw new Error("The model did not return any locations.");
  }

  const usedKeys = new Set<string>();
  const sources: PlanLocationSource[] = rawLocations.map((record, index) => {
    const name = text(record.name, SPATIAL_CONTEXT_LIMITS.maxNameLength) || `Location ${index + 1}`;
    const key = uniquePlanKey(record.key ?? record.id, name, index, usedKeys);
    return {
      record,
      key,
      id: `loc_${newId()}`,
      aliases: [key, alias(record.key), alias(record.id), alias(name)].filter(Boolean),
      originalIndex: index,
    };
  });
  const sourceByAlias = new Map<string, PlanLocationSource>();
  for (const source of sources) {
    for (const candidate of source.aliases) {
      if (!sourceByAlias.has(candidate)) sourceByAlias.set(candidate, source);
    }
  }

  let locations: SpatialLocation[] = sources.map((source) => {
    const { record, originalIndex } = source;
    const name = text(record.name, SPATIAL_CONTEXT_LIMITS.maxNameLength) || `Location ${originalIndex + 1}`;
    const parentSource = sourceByAlias.get(alias(record.parentKey ?? record.parentId));
    const modelMemory = text(record.modelMemory, SPATIAL_CONTEXT_LIMITS.maxModelMemoryLength);
    const awarenessSummary = text(record.awarenessSummary, SPATIAL_CONTEXT_LIMITS.maxAwarenessSummaryLength);
    const kind = locationKind(record.kind, name, !parentSource);
    const icon = generatedLocationIcon(record.icon, name, kind);
    const lorebookEntryIds = Array.from(
      new Set(
        stringList(record.sourceKeys).flatMap((sourceKey) => options.sourceEntryIdsByKey?.get(sourceKey) ?? []),
      ),
    ).slice(0, SPATIAL_CONTEXT_LIMITS.maxLorebookEntryIdsPerLocation);
    if (options.requireLoreSource && lorebookEntryIds.length === 0) {
      throw new Error(`Strict canon location "${name}" did not cite a valid lore source.`);
    }
    return {
      id: source.id,
      parentId: parentSource && parentSource.id !== source.id ? parentSource.id : null,
      name,
      kind,
      description: text(record.description, SPATIAL_CONTEXT_LIMITS.maxDescriptionLength),
      ...(modelMemory ? { modelMemory } : {}),
      ...(awarenessSummary ? { awarenessSummary } : {}),
      ...(icon ? { icon } : {}),
      lorebookEntryIds,
      childPresentation: childPresentation(record.childPresentation),
      ...(readPlacement(record) ? { placement: readPlacement(record) } : {}),
      links: [],
      status: "active",
      sortOrder: originalIndex,
    };
  });

  locations = locations.map((location) =>
    location.parentId && wouldCreateSpatialCycle({ locations }, location.id, location.parentId)
      ? { ...location, parentId: null }
      : location,
  );
  const maxDepth = Math.max(
    1,
    Math.min(options.maxDepth ?? SPATIAL_DRAFT_SIZE_SPECS[options.size].maxDepth, SPATIAL_CONTEXT_LIMITS.maxDepth),
  );
  locations = locations.map((location) =>
    resolveSpatialLocationDepth({ locations }, location) > maxDepth ? { ...location, parentId: null } : location,
  );

  locations = locations.map((location, index) => {
    const rawLinks = Array.isArray(sources[index]?.record.links) ? sources[index]!.record.links.filter(isRecord) : [];
    const seenTargets = new Set<string>();
    const links = rawLinks.flatMap((rawLink) => {
      const targetKey = alias(rawLink.targetKey ?? rawLink.targetId);
      const targetId =
        sourceByAlias.get(targetKey)?.id ?? options.externalLinkTargetIdsByKey?.get(targetKey);
      if (!targetId || targetId === location.id || seenTargets.has(targetId)) return [];
      seenTargets.add(targetId);
      const label = text(rawLink.label, SPATIAL_CONTEXT_LIMITS.maxLinkLabelLength);
      return [
        {
          targetId,
          ...(label ? { label } : {}),
          bidirectional: rawLink.bidirectional !== false,
          state: linkState(rawLink.state),
        },
      ];
    });
    return { ...location, links: links.slice(0, SPATIAL_CONTEXT_LIMITS.maxLinksPerLocation) };
  });
  locations = normalizeLayouts(locations);
  locations = ensureSparseSiblingRouteLinks(locations);

  const rootRecord = isRecord(value) && isRecord(value.map) && !Array.isArray(value.locations) ? value.map : value;
  const startingKey = isRecord(rootRecord) ? (rootRecord.startingLocationKey ?? rootRecord.startingLocationId) : null;
  const startingSource =
    sourceByAlias.get(alias(startingKey)) ??
    sources.find((source) => {
      const location = locations.find((candidate) => candidate.id === source.id);
      return location?.parentId === null;
    }) ??
    sources[0]!;

  const definition: SpatialContextDefinition = {
    schemaVersion: 1,
    ownerMode: options.ownerMode,
    enabled: options.enabled,
    locations,
    startingLocationId: startingSource.id,
    revision: options.revision,
  };
  const generatedIds = new Set(locations.map((location) => location.id));
  const validationDefinition = options.externalDefinition
    ? {
        ...options.externalDefinition,
        locations: [...options.externalDefinition.locations, ...locations],
      }
    : definition;
  const parsed = spatialContextDefinitionSchema.safeParse(validationDefinition);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "The generated map is invalid.");
  }
  const normalized = options.externalDefinition
    ? {
        ...definition,
        locations: parsed.data.locations.filter((location) => generatedIds.has(location.id)),
      }
    : parsed.data;
  assertRequiredLocationNames(normalized, options.requiredLocationNames);
  return normalized;
}

export function normalizeSpatialMapExpansionPlan(
  value: unknown,
  options: NormalizeSpatialMapExpansionOptions,
): SpatialContextDefinition {
  const target = options.definition.locations.find((location) => location.id === options.targetLocationId);
  if (!target || target.status !== "active") {
    throw new Error("Choose an active location to expand.");
  }

  const remainingLocationCapacity = SPATIAL_CONTEXT_LIMITS.maxLocations - options.definition.locations.length;
  if (remainingLocationCapacity < 1) {
    throw new Error("This map already contains the maximum number of locations.");
  }
  const availableDepth = SPATIAL_CONTEXT_LIMITS.maxDepth - resolveSpatialLocationDepth(options.definition, target);
  if (availableDepth < 1) {
    throw new Error("This location is already at the maximum nesting depth.");
  }
  const existingChildren = options.definition.locations.filter((location) => location.parentId === target.id);
  const activeExistingChildren = existingChildren.filter((location) => location.status === "active");
  const externalLinkTargetIdsByKey = new Map(
    activeExistingChildren.map((location) => [alias(location.id), location.id]),
  );

  const generated = normalizeSpatialMapPlan(value, {
    ownerMode: options.definition.ownerMode,
    revision: options.definition.revision,
    enabled: options.definition.enabled,
    size: options.size,
    maxLocations: Math.min(SPATIAL_DRAFT_SIZE_SPECS[options.size].maxLocations, remainingLocationCapacity),
    sourceEntryIdsByKey: options.sourceEntryIdsByKey,
    requireLoreSource: options.requireLoreSource,
    maxDepth: Math.min(SPATIAL_DRAFT_SIZE_SPECS[options.size].maxDepth, availableDepth),
    externalDefinition: options.definition,
    externalLinkTargetIdsByKey,
  });
  const existingIds = new Set(options.definition.locations.map((location) => location.id));
  if (generated.locations.some((location) => existingIds.has(location.id))) {
    throw new Error("The generated expansion reused an existing location ID.");
  }

  const generatedRootIds = new Set(
    generated.locations.filter((location) => location.parentId === null).map((location) => location.id),
  );
  const rootLocations = generated.locations.filter((location) => generatedRootIds.has(location.id));
  const firstSortOrder = Math.max(-1, ...existingChildren.map((location) => location.sortOrder)) + 1;
  const firstLayerOrder =
    Math.max(-1, ...existingChildren.map((location) => location.layerOrder ?? -1)) + 1;
  const rootIndexById = new Map(rootLocations.map((location, index) => [location.id, index]));
  const combinedSiblingCount = existingChildren.length + rootLocations.length;

  let addedLocations = generated.locations.map((location) => {
    const rootIndex = rootIndexById.get(location.id);
    if (rootIndex === undefined) return location;
    const base = {
      ...location,
      parentId: target.id,
      sortOrder: firstSortOrder + rootIndex,
    };
    if (target.childPresentation === "map") {
      return {
        ...base,
        placement: spatialRadialPlacement(existingChildren.length + rootIndex, combinedSiblingCount),
        layerOrder: undefined,
      };
    }
    if (target.childPresentation === "layers") {
      return {
        ...base,
        placement: undefined,
        layerOrder: firstLayerOrder + rootIndex,
      };
    }
    return { ...base, placement: undefined, layerOrder: undefined };
  });

  const activeExistingChildIds = new Set(activeExistingChildren.map((location) => location.id));
  const hasExistingAttachment = addedLocations.some((location) =>
    location.links.some((link) => activeExistingChildIds.has(link.targetId)),
  );
  if (!hasExistingAttachment && activeExistingChildren.length > 0 && rootLocations.length > 0) {
    const source = addedLocations
      .filter((location) => generatedRootIds.has(location.id))
      .sort(compareSpatialLocations)[0];
    let attachmentTarget: SpatialLocation | undefined;
    if (source && target.childPresentation === "map" && source.placement) {
      attachmentTarget = [...activeExistingChildren]
        .filter((location) => location.placement)
        .sort((left, right) => {
          const leftDistance =
            (left.placement!.x - source.placement!.x) ** 2 +
            (left.placement!.y - source.placement!.y) ** 2;
          const rightDistance =
            (right.placement!.x - source.placement!.x) ** 2 +
            (right.placement!.y - source.placement!.y) ** 2;
          return leftDistance - rightDistance;
        })[0];
    }
    if (!attachmentTarget && target.childPresentation === "layers") {
      attachmentTarget = [...activeExistingChildren].sort(
        (left, right) => (right.layerOrder ?? right.sortOrder) - (left.layerOrder ?? left.sortOrder),
      )[0];
    }
    attachmentTarget ??= [...activeExistingChildren].sort(compareSpatialLocations).at(-1);
    if (
      source &&
      attachmentTarget &&
      source.links.length < SPATIAL_CONTEXT_LIMITS.maxLinksPerLocation
    ) {
      addedLocations = addedLocations.map((location) =>
        location.id === source.id
          ? {
              ...location,
              links: [
                ...location.links,
                {
                  targetId: attachmentTarget.id,
                  label: inferredRouteLabel(target, location, attachmentTarget),
                  bidirectional: true,
                  state: "available" as const,
                },
              ],
            }
          : location,
      );
    }
  }

  const definition: SpatialContextDefinition = {
    ...options.definition,
    locations: [...options.definition.locations, ...addedLocations],
  };
  const parsed = spatialContextDefinitionSchema.safeParse(definition);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "The generated expansion is invalid.");
  }
  return parsed.data;
}
function groundingPromptLines(mode: SpatialMapGroundingMode = "setup"): string[] {
  if (mode === "setup") return [];
  const shared = [
    "The lore catalog is the only authoritative canon source. Cite catalog items using their temporary sourceKey values; never invent source keys.",
    "For every directly supported location, set sourceKeys to every catalog item that supports it.",
  ];
  if (mode === "lore_strict") {
    return [
      ...shared,
      "Strict canon mode: every generated location must have at least one valid sourceKeys item. Do not infer or add unsourced locations.",
    ];
  }
  return [
    ...shared,
    'Canon with expansion mode: unsourced locations are allowed, but sourceKeys must be empty and origin must be "inferred" or "added_by_ai".',
  ];
}

function routeGraphPromptLines(): string[] {
  return [
    "Hierarchy expresses containment. Links express direct travel between sibling locations; do not treat parentKey as a substitute for routes.",
    "Infer links from the physical meaning and layout you create: floors use stairs, lifts, ladders, or ramps; rooms use doors, halls, or stairs; city areas use streets, gates, bridges, or transit; wilderness and dungeon areas use roads, trails, corridors, or passages.",
    "Every sibling group with two or more ordinary reachable locations must form one sparse connected travel graph. Connect adjacent layers in order and connect map or list siblings through the most believable routes.",
    "Prefer a minimal route network with useful branches or loops. Do not create an all-to-all graph. Ordinary travel links should be bidirectional; hidden or blocked links require a specific world reason.",
    "Give each link a short concrete route label such as North Road, Service Stairs, East Hall, Canal Bridge, or Hidden Passage.",
  ];
}

function hierarchyPromptLines(
  mode: SpatialHierarchyProfile["mode"] = "auto",
  profile?: SpatialHierarchyProfile,
): string[] {
  if (profile) {
    return [
      "Use the supplied location-type vocabulary. Set every location typeKey to one supplied type ID. Keep kind as that type's baseKind for movement and validation.",
      `Location-type vocabulary:\n${JSON.stringify(
        profile.types.map((type) => ({ key: type.id, label: type.label, baseKind: type.baseKind })),
        null,
        2,
      )}`,
    ];
  }
  if (mode === "auto") {
    return [
      "Infer a concise location-type vocabulary that fits this specific world instead of forcing a fixed World/Region/City hierarchy.",
      "Return locationTypes before locations. Each type needs a stable key, user-facing label, and one semantic baseKind used for validation. Multiple custom types may share one baseKind or appear at the same depth.",
      "Set every location typeKey to one returned locationTypes key. Examples include Star System/Planet/Settlement, House/Floor/Room, or Dungeon Tower/Floor/Boss Arena, but prefer the supplied setting's own vocabulary.",
    ];
  }
  return [];
}


export function buildSpatialMapExpansionPrompt(options: BuildSpatialMapExpansionPromptOptions): {
  messages: Array<{ role: "system" | "user"; content: string }>;
  maxTokens: number;
} {
  const target = options.definition.locations.find((location) => location.id === options.targetLocationId);
  if (!target || target.status !== "active") {
    throw new Error("Choose an active location to expand.");
  }
  const remainingLocationCapacity = SPATIAL_CONTEXT_LIMITS.maxLocations - options.definition.locations.length;
  if (remainingLocationCapacity < 1) {
    throw new Error("This map already contains the maximum number of locations.");
  }
  const availableDepth = SPATIAL_CONTEXT_LIMITS.maxDepth - resolveSpatialLocationDepth(options.definition, target);
  if (availableDepth < 1) {
    throw new Error("This location is already at the maximum nesting depth.");
  }

  const size = SPATIAL_DRAFT_SIZE_SPECS[options.size];
  const maxNewLocations = Math.min(size.maxLocations, remainingLocationCapacity);
  const targetLocations = Math.min(size.targetLocations, maxNewLocations);
  const maxNewDepth = Math.min(size.maxDepth, availableDepth);
  const breadcrumb = resolveSpatialBreadcrumb(options.definition, target.id).map((location) => location.name).join(" > ");
  const existingChildIds = new Set(
    options.definition.locations
      .filter((location) => location.parentId === target.id && location.status === "active")
      .map((location) => location.id),
  );
  const existingChildren = options.definition.locations
    .filter((location) => location.parentId === target.id && location.status === "active")
    .sort(compareSpatialLocations)
    .slice(0, 50)
    .map((location) => ({
      key: location.id,
      name: location.name,
      kind: location.kind,
      typeKey: options.hierarchyProfile?.locationTypeIds[location.id],
      description: location.description,
      placement: location.placement,
      layerOrder: location.layerOrder,
      links: location.links
        .filter((link) => existingChildIds.has(link.targetId))
        .map((link) => ({
          targetKey: link.targetId,
          label: link.label,
          bidirectional: link.bidirectional,
          state: link.state,
        })),
    }));
  const selectedContext = JSON.stringify(
    {
      breadcrumb,
      target: {
        name: target.name,
        kind: target.kind,
        description: target.description,
        modelMemory: target.modelMemory,
        childPresentation: target.childPresentation,
      },
      existingChildren,
    },
    null,
    2,
  );
  const outputSchema =
    'Schema: {"locations":[{"key":string,"parentKey":string|null,"name":string,"typeKey":string,"kind":"region"|"settlement"|"place"|"building"|"floor"|"room","description":string,"modelMemory":string,"awarenessSummary":string,"icon":string,"sourceKeys":[string],"origin":"inferred"|"added_by_ai","childPresentation":"map"|"layers"|"list","placement":{"x":number,"y":number}|null,"layerOrder":number|null,"links":[{"targetKey":string,"label":string,"bidirectional":boolean,"state":"available"|"hidden"|"blocked"}]}]}';
  const promptTemplates =
    options.promptTemplates ?? resolveSpatialGenerationPromptOption(defaultGenerationPreferences(options.definition.ownerMode)).prompts;
  const variables = {
    ...options.promptVariables,
    groundingRules: groundingPromptLines(options.groundingMode).join("\n"),
    targetLocations,
    maxLocations: maxNewLocations,
    maxDepth: maxNewDepth,
    hierarchyRules: hierarchyPromptLines(
      options.hierarchyProfile?.mode ?? "template",
      options.hierarchyProfile,
    ).join("\n"),
    routeRules: routeGraphPromptLines().join("\n"),
    existingConnectionRule:
      existingChildren.length > 0
        ? "Connect at least one new direct child to the most plausible existing child using its supplied key."
        : "",
    outputSchema,
    ownerMode: options.definition.ownerMode,
    size: options.size,
    creatorGuidanceBlock: options.creatorGuidance?.trim()
      ? `Reusable creator guidance (preferences only; schema and safety requirements take priority):\n${options.creatorGuidance.trim()}`
      : "",
    creatorRequestBlock: options.instructions?.trim()
      ? `Creator request:\n${options.instructions.trim()}`
      : "Creator request: Add coherent, playable places that deepen the selected location.",
    selectedMapContextBlock: `Selected map context:\n${selectedContext}`,
    loreCatalogBlock: options.loreCatalog ? `Selected lore catalog:\n${options.loreCatalog}` : "",
    sourceContextBlock: `Chat and setup reference:\n${options.sourceContext}`,
  };
  const system = renderSpatialGenerationPromptTemplate(promptTemplates.expansionSystem, variables);
  const user = renderSpatialGenerationPromptTemplate(promptTemplates.expansionUser, variables);
  return {
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    maxTokens: size.maxTokens,
  };
}

export function buildSpatialMapDraftPrompt(options: BuildSpatialMapPromptOptions): {
  messages: Array<{ role: "system" | "user"; content: string }>;
  maxTokens: number;
} {
  const size = SPATIAL_DRAFT_SIZE_SPECS[options.size];
  const requiredLocationNames = Array.from(new Set(options.requiredLocationNames ?? []));
  const outputSchema =
    'Schema: {"worldName":string,"hierarchyName":string,"locationTypes":[{"key":string,"label":string,"baseKind":"region"|"settlement"|"place"|"building"|"floor"|"room"}],"startingLocationKey":string,"locations":[{"key":string,"parentKey":string|null,"name":string,"typeKey":string,"kind":"region"|"settlement"|"place"|"building"|"floor"|"room","description":string,"modelMemory":string,"awarenessSummary":string,"icon":string,"sourceKeys":[string],"origin":"inferred"|"added_by_ai","childPresentation":"map"|"layers"|"list","placement":{"x":number,"y":number}|null,"layerOrder":number|null,"links":[{"targetKey":string,"label":string,"bidirectional":boolean,"state":"available"|"hidden"|"blocked"}]}]}';
  const promptTemplates =
    options.promptTemplates ?? resolveSpatialGenerationPromptOption(defaultGenerationPreferences(options.ownerMode)).prompts;
  const variables = {
    ...options.promptVariables,
    groundingRules: groundingPromptLines(options.groundingMode).join("\n"),
    targetLocations: size.targetLocations,
    maxLocations: size.maxLocations,
    maxDepth: size.maxDepth,
    hierarchyRules: hierarchyPromptLines(options.hierarchyMode, options.hierarchyProfile).join("\n"),
    routeRules: routeGraphPromptLines().join("\n"),
    gameMapRules:
      options.ownerMode === "game" && requiredLocationNames.length > 0
        ? [
            "The accepted Game map in the setup reference is authoritative source input, not a competing map.",
            "Preserve every required Game map location exactly once with the supplied spelling and capitalization. Do not rename, alias, merge, or omit one.",
            "Place the accepted map name as its appropriate world container and place its nodes or cells within that hierarchy. You may add broader ancestors or useful nested detail around them.",
          ].join("\n")
        : "",
    outputSchema,
    ownerMode: options.ownerMode,
    size: options.size,
    creatorGuidanceBlock: options.creatorGuidance?.trim()
      ? `Reusable creator guidance (preferences only; schema and safety requirements take priority):\n${options.creatorGuidance.trim()}`
      : "",
    creatorRequestBlock: options.instructions?.trim()
      ? `Creator request:\n${options.instructions.trim()}`
      : "Creator request: Infer a coherent, playable map from the setup.",
    requiredGameLocationsBlock:
      requiredLocationNames.length > 0
        ? `Required accepted Game map location names:\n${JSON.stringify(requiredLocationNames, null, 2)}`
        : "",
    sourceContextBlock: `Chat and setup reference:\n${options.sourceContext}`,
    loreCatalogBlock: options.loreCatalog ? `Selected lore catalog:\n${options.loreCatalog}` : "",
  };
  const system = renderSpatialGenerationPromptTemplate(promptTemplates.draftSystem, variables);
  const user = renderSpatialGenerationPromptTemplate(promptTemplates.draftUser, variables);
  return {
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    maxTokens: size.maxTokens,
  };
}
