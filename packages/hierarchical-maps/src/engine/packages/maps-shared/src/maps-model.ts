import { z } from "zod";
import type {
  SpatialContextDefinition,
  SpatialContextResponse,
  SpatialLocation,
  SpatialLocationKind,
} from "@marinara-engine/shared";

export const HIERARCHY_PROFILE_VERSION = 1 as const;
export const GENERATION_PREFERENCES_VERSION = 1 as const;

export const BUILT_IN_GENERATION_GUIDANCE =
  "Build a practical, easy-to-browse location hierarchy that matches this setting. Use the world's own vocabulary, include only useful playable places, and connect ordinary travel routes without overfilling the map.";

export const SPATIAL_LOCATION_KINDS = [
  "region",
  "settlement",
  "place",
  "building",
  "floor",
  "room",
] as const satisfies readonly SpatialLocationKind[];

export interface SpatialHierarchyType {
  id: string;
  label: string;
  baseKind: SpatialLocationKind;
  description?: string;
}

export interface SpatialHierarchyProfile {
  version: typeof HIERARCHY_PROFILE_VERSION;
  mode: "auto" | "template" | "custom";
  name: string;
  types: SpatialHierarchyType[];
  locationTypeIds: Record<string, string>;
}

export interface SpatialGenerationPreferences {
  version: typeof GENERATION_PREFERENCES_VERSION;
  mode: "default" | "custom";
  guidance: string;
}

export interface MapsSpatialContextResponse extends SpatialContextResponse {
  hierarchyProfile: SpatialHierarchyProfile;
  generationPreferences: SpatialGenerationPreferences;
}

const hierarchyIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u, "Use letters, numbers, dots, underscores, colons, or hyphens.");

export const spatialHierarchyTypeSchema = z
  .object({
    id: hierarchyIdSchema,
    label: z.string().trim().min(1).max(80),
    baseKind: z.enum(SPATIAL_LOCATION_KINDS),
    description: z.string().trim().max(240).optional(),
  })
  .strict();

const spatialHierarchyProfileBaseSchema = z
  .object({
    version: z.literal(HIERARCHY_PROFILE_VERSION),
    mode: z.enum(["auto", "template", "custom"]),
    name: z.string().trim().min(1).max(120),
    types: z.array(spatialHierarchyTypeSchema).min(1).max(40),
    locationTypeIds: z.record(z.string(), hierarchyIdSchema).default({}),
  })
  .strict();

export const spatialHierarchyProfileSchema = spatialHierarchyProfileBaseSchema.superRefine((profile, context) => {
    const ids = new Set<string>();
    for (const [index, type] of profile.types.entries()) {
      if (ids.has(type.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Hierarchy type ID ${type.id} is duplicated.`,
          path: ["types", index, "id"],
        });
      }
      ids.add(type.id);
    }
    for (const [locationId, typeId] of Object.entries(profile.locationTypeIds)) {
      if (!ids.has(typeId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Location ${locationId} references unknown hierarchy type ${typeId}.`,
          path: ["locationTypeIds", locationId],
        });
      }
    }
  });

export const spatialGenerationPreferencesSchema = z
  .object({
    version: z.literal(GENERATION_PREFERENCES_VERSION),
    mode: z.enum(["default", "custom"]),
    guidance: z.string().trim().max(4_000),
  })
  .strict();

const DEFAULT_TYPE_LABELS: Record<SpatialLocationKind, string> = {
  region: "Region",
  settlement: "Settlement",
  place: "Place",
  building: "Building",
  floor: "Floor",
  room: "Room",
};

export const HIERARCHY_TEMPLATES: Array<{
  id: string;
  name: string;
  path: string;
  types: SpatialHierarchyType[];
}> = [
  {
    id: "world",
    name: "World map",
    path: "World → Region → City → District → Building → Room",
    types: [
      { id: "type_world", label: "World", baseKind: "region" },
      { id: "type_region", label: "Region", baseKind: "region" },
      { id: "type_city", label: "City", baseKind: "settlement" },
      { id: "type_district", label: "District", baseKind: "place" },
      { id: "type_building", label: "Building", baseKind: "building" },
      { id: "type_room", label: "Room", baseKind: "room" },
    ],
  },
  {
    id: "house",
    name: "House",
    path: "House → Floors → Rooms",
    types: [
      { id: "type_house", label: "House", baseKind: "building" },
      { id: "type_floor", label: "Floor", baseKind: "floor" },
      { id: "type_room", label: "Room", baseKind: "room" },
    ],
  },
  {
    id: "dungeon-tower",
    name: "Dungeon tower",
    path: "Dungeon Tower → Floors → Rooms and Boss Arenas",
    types: [
      { id: "type_dungeon_tower", label: "Dungeon Tower", baseKind: "building" },
      { id: "type_floor", label: "Floor", baseKind: "floor" },
      { id: "type_room", label: "Room", baseKind: "room" },
      { id: "type_boss_arena", label: "Boss Arena", baseKind: "room" },
    ],
  },
  {
    id: "star-system",
    name: "Star system",
    path: "Star System → Planets → Settlements",
    types: [
      { id: "type_star_system", label: "Star System", baseKind: "region" },
      { id: "type_planet", label: "Planet", baseKind: "region" },
      { id: "type_settlement", label: "Settlement", baseKind: "settlement" },
    ],
  },
];

export function hierarchyTypeId(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/gu, "_")
    .replace(/^_+|_+$/gu, "")
    .slice(0, 64);
  return `type_${normalized || "place"}`;
}

export function defaultGenerationPreferences(): SpatialGenerationPreferences {
  return {
    version: GENERATION_PREFERENCES_VERSION,
    mode: "default",
    guidance: BUILT_IN_GENERATION_GUIDANCE,
  };
}

export function defaultHierarchyProfile(
  definition?: Pick<SpatialContextDefinition, "locations"> | null,
): SpatialHierarchyProfile {
  const types = SPATIAL_LOCATION_KINDS.map((baseKind) => ({
    id: `type_${baseKind}`,
    label: DEFAULT_TYPE_LABELS[baseKind],
    baseKind,
  }));
  return {
    version: HIERARCHY_PROFILE_VERSION,
    mode: "template",
    name: "Default location types",
    types,
    locationTypeIds: Object.fromEntries(
      (definition?.locations ?? []).map((location) => [location.id, `type_${location.kind}`]),
    ),
  };
}

export function profileFromTemplate(
  templateId: string,
  definition?: Pick<SpatialContextDefinition, "locations"> | null,
): SpatialHierarchyProfile {
  const template = HIERARCHY_TEMPLATES.find((candidate) => candidate.id === templateId) ?? HIERARCHY_TEMPLATES[0]!;
  const firstTypeByKind = new Map<SpatialLocationKind, string>();
  for (const type of template.types) {
    if (!firstTypeByKind.has(type.baseKind)) firstTypeByKind.set(type.baseKind, type.id);
  }
  return {
    version: HIERARCHY_PROFILE_VERSION,
    mode: "template",
    name: template.name,
    types: template.types.map((type) => ({ ...type })),
    locationTypeIds: Object.fromEntries(
      (definition?.locations ?? []).map((location) => [
        location.id,
        firstTypeByKind.get(location.kind) ?? template.types[0]!.id,
      ]),
    ),
  };
}

export function normalizeHierarchyProfile(
  value: unknown,
  definition?: Pick<SpatialContextDefinition, "locations"> | null,
): SpatialHierarchyProfile {
  const parsed = spatialHierarchyProfileBaseSchema.safeParse(value);
  if (!parsed.success) return defaultHierarchyProfile(definition);
  const locationIds = new Set((definition?.locations ?? []).map((location) => location.id));
  const typeById = new Map(parsed.data.types.map((type) => [type.id, type]));
  const firstTypeByKind = new Map<SpatialLocationKind, string>();
  for (const type of parsed.data.types) {
    if (!firstTypeByKind.has(type.baseKind)) firstTypeByKind.set(type.baseKind, type.id);
  }
  const locationTypeIds: Record<string, string> = {};
  for (const location of definition?.locations ?? []) {
    const assigned = parsed.data.locationTypeIds[location.id];
    locationTypeIds[location.id] =
      (assigned && typeById.has(assigned) ? assigned : firstTypeByKind.get(location.kind)) ?? parsed.data.types[0]!.id;
  }
  for (const [locationId, typeId] of Object.entries(parsed.data.locationTypeIds)) {
    if (!definition || locationIds.has(locationId)) locationTypeIds[locationId] = typeId;
  }
  return { ...parsed.data, locationTypeIds };
}

export function hierarchyTypeForLocation(
  profile: SpatialHierarchyProfile,
  location: Pick<SpatialLocation, "id" | "kind">,
): SpatialHierarchyType {
  const assigned = profile.types.find((type) => type.id === profile.locationTypeIds[location.id]);
  return assigned ?? profile.types.find((type) => type.baseKind === location.kind) ?? profile.types[0]!;
}

export function withLocationHierarchyType(
  profile: SpatialHierarchyProfile,
  locationId: string,
  typeId: string,
): SpatialHierarchyProfile {
  const type = profile.types.find((candidate) => candidate.id === typeId);
  if (!type) return profile;
  return {
    ...profile,
    locationTypeIds: { ...profile.locationTypeIds, [locationId]: typeId },
  };
}
