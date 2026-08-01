import { z } from "zod";
import {
  spatialContextDefinitionSchema,
  type CapabilityChatRecord,
  type CapabilityDocumentRecord,
  type CapabilityPersistenceSession,
  type SpatialContextDefinition,
  type SpatialOwnerMode,
} from "@marinara-engine/shared";
import {
  SPATIAL_SHARED_WORLD_LINK_VERSION,
  SPATIAL_SHARED_WORLD_VERSION,
  createSpatialSharedWorldData,
  instantiateSpatialSharedWorld,
  normalizeHierarchyProfile,
  spatialHierarchyProfileSchema,
  type SpatialHierarchyProfile,
  type SpatialSharedWorldLink,
  type SpatialSharedWorldRecord,
  type SpatialSharedWorldStatus,
} from "../../../../maps-shared/src/maps-model.js";
import { parseSpatialMetadata } from "./metadata.js";

export const SPATIAL_SHARED_WORLD_PACKAGE_ID = "hierarchical-maps";
export const SPATIAL_SHARED_WORLD_KIND = "shared-world-map";
export const SPATIAL_SHARED_WORLD_LINK_METADATA_KEY = "spatialSharedWorldLink";
export const SPATIAL_DEFINITION_METADATA_KEY = "spatialContext";
export const SPATIAL_HIERARCHY_PROFILE_METADATA_KEY = "spatialContextHierarchyProfile";

let spatialSharedWorldCreationQueue = Promise.resolve();

export function withSpatialSharedWorldCreationLock<T>(operation: () => Promise<T>): Promise<T> {
  const pending = spatialSharedWorldCreationQueue.then(operation);
  spatialSharedWorldCreationQueue = pending.then(
    () => undefined,
    () => undefined,
  );
  return pending;
}

export async function spatialSharedWorldNameExists(
  persistence: Pick<CapabilityPersistenceSession, "documents">,
  name: string,
  excludedWorldId?: string,
): Promise<boolean> {
  const normalizedName = name.trim().toLowerCase();
  const documents = await persistence.documents.list(SPATIAL_SHARED_WORLD_PACKAGE_ID, SPATIAL_SHARED_WORLD_KIND);
  return documents.some(
    (document) => document.id !== excludedWorldId && document.name.trim().toLowerCase() === normalizedName,
  );
}

const spatialSharedWorldDataSchema = z
  .object({
    version: z.literal(SPATIAL_SHARED_WORLD_VERSION),
    definition: spatialContextDefinitionSchema,
    hierarchyProfile: spatialHierarchyProfileSchema,
  })
  .strict();

const spatialSharedWorldDraftSchema = z
  .object({
    baseWorldRevision: z.number().int().positive().safe(),
    definition: spatialContextDefinitionSchema,
    hierarchyProfile: spatialHierarchyProfileSchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export const spatialSharedWorldLinkSchema = z
  .object({
    version: z.literal(SPATIAL_SHARED_WORLD_LINK_VERSION),
    worldId: z.string().trim().min(1).max(200),
    linkedAt: z.string().datetime(),
    draft: spatialSharedWorldDraftSchema.optional(),
  })
  .strict();

export interface ResolvedSpatialWorldSource {
  definition: SpatialContextDefinition | null;
  hierarchyProfile: SpatialHierarchyProfile;
  corrupt: boolean;
  link: SpatialSharedWorldLink | null;
  world: SpatialSharedWorldRecord | null;
  status: SpatialSharedWorldStatus;
}

export function readSpatialSharedWorldLink(metadata: unknown): SpatialSharedWorldLink | null {
  const parsed = spatialSharedWorldLinkSchema.safeParse(
    parseSpatialMetadata(metadata)[SPATIAL_SHARED_WORLD_LINK_METADATA_KEY],
  );
  return parsed.success ? parsed.data : null;
}

export function readSpatialSharedWorldDocument(
  document: CapabilityDocumentRecord,
  linkedChatCount = 0,
): SpatialSharedWorldRecord | null {
  const parsed = spatialSharedWorldDataSchema.safeParse(document.data);
  if (!parsed.success) return null;
  const data = createSpatialSharedWorldData(parsed.data.definition, parsed.data.hierarchyProfile);
  return {
    id: document.id,
    name: document.name,
    description: document.description,
    data: {
      ...data,
      definition: { ...data.definition, revision: document.revision },
    },
    revision: document.revision,
    linkedChatCount,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

export async function linkedChatIdsForSpatialWorld(
  persistence: Pick<CapabilityPersistenceSession, "listChats">,
  worldId: string,
): Promise<string[]> {
  return (await persistence.listChats()).flatMap((chat) =>
    readSpatialSharedWorldLink(chat.metadata)?.worldId === worldId ? [chat.id] : [],
  );
}

export async function getSpatialSharedWorld(
  persistence: Pick<CapabilityPersistenceSession, "documents" | "listChats">,
  worldId: string,
  includeLinkedChatCount = true,
): Promise<SpatialSharedWorldRecord | null> {
  const document = await persistence.documents.getById(SPATIAL_SHARED_WORLD_PACKAGE_ID, worldId);
  if (!document || document.kind !== SPATIAL_SHARED_WORLD_KIND) return null;
  const linkedChatCount = includeLinkedChatCount
    ? (await linkedChatIdsForSpatialWorld(persistence, worldId)).length
    : 0;
  return readSpatialSharedWorldDocument(document, linkedChatCount);
}

export async function listSpatialSharedWorlds(
  persistence: Pick<CapabilityPersistenceSession, "documents" | "listChats">,
): Promise<SpatialSharedWorldRecord[]> {
  const [documents, chats] = await Promise.all([
    persistence.documents.list(SPATIAL_SHARED_WORLD_PACKAGE_ID, SPATIAL_SHARED_WORLD_KIND),
    persistence.listChats(),
  ]);
  const linkedCounts = new Map<string, number>();
  for (const chat of chats) {
    const link = readSpatialSharedWorldLink(chat.metadata);
    if (!link) continue;
    linkedCounts.set(link.worldId, (linkedCounts.get(link.worldId) ?? 0) + 1);
  }
  return documents.flatMap((document) => {
    const world = readSpatialSharedWorldDocument(document, linkedCounts.get(document.id) ?? 0);
    return world ? [world] : [];
  });
}

export function independentSpatialWorldStatus(): SpatialSharedWorldStatus {
  return {
    mode: "independent",
    worldId: null,
    worldName: null,
    worldRevision: null,
    linkedChatCount: 0,
    pendingChanges: false,
    pendingBaseRevision: null,
    conflict: false,
    missing: false,
  };
}

function linkedSpatialWorldStatus(
  link: SpatialSharedWorldLink,
  world: SpatialSharedWorldRecord | null,
): SpatialSharedWorldStatus {
  return {
    mode: "linked",
    worldId: link.worldId,
    worldName: world?.name ?? null,
    worldRevision: world?.revision ?? null,
    linkedChatCount: world?.linkedChatCount ?? 0,
    pendingChanges: Boolean(link.draft),
    pendingBaseRevision: link.draft?.baseWorldRevision ?? null,
    conflict: Boolean(link.draft && world && link.draft.baseWorldRevision !== world.revision),
    missing: world === null,
  };
}

function readIndependentDefinition(metadata: Record<string, unknown>): {
  definition: SpatialContextDefinition | null;
  corrupt: boolean;
} {
  const candidate = metadata[SPATIAL_DEFINITION_METADATA_KEY];
  if (candidate === undefined || candidate === null) return { definition: null, corrupt: false };
  const parsed = spatialContextDefinitionSchema.safeParse(candidate);
  return parsed.success
    ? { definition: parsed.data as SpatialContextDefinition, corrupt: false }
    : { definition: null, corrupt: true };
}

export async function resolveSpatialWorldSource(
  chat: CapabilityChatRecord,
  persistence: Pick<CapabilityPersistenceSession, "documents" | "listChats">,
  options: { includeLinkedChatCount?: boolean } = {},
): Promise<ResolvedSpatialWorldSource> {
  const metadata = parseSpatialMetadata(chat.metadata);
  const link = readSpatialSharedWorldLink(metadata);
  if (!link) {
    const local = readIndependentDefinition(metadata);
    return {
      definition: local.definition,
      hierarchyProfile: normalizeHierarchyProfile(metadata[SPATIAL_HIERARCHY_PROFILE_METADATA_KEY], local.definition),
      corrupt: local.corrupt,
      link: null,
      world: null,
      status: independentSpatialWorldStatus(),
    };
  }

  const world = await getSpatialSharedWorld(persistence, link.worldId, options.includeLinkedChatCount ?? false);
  const ownerMode: SpatialOwnerMode = chat.mode === "game" ? "game" : "roleplay";
  if (link.draft) {
    const definition = {
      ...link.draft.definition,
      ownerMode,
      enabled: true,
    };
    return {
      definition,
      hierarchyProfile: normalizeHierarchyProfile(link.draft.hierarchyProfile, definition),
      corrupt: false,
      link,
      world,
      status: linkedSpatialWorldStatus(link, world),
    };
  }
  if (!world) {
    return {
      definition: null,
      hierarchyProfile: normalizeHierarchyProfile(null, null),
      corrupt: false,
      link,
      world: null,
      status: linkedSpatialWorldStatus(link, null),
    };
  }
  const instantiated = instantiateSpatialSharedWorld(world.data, ownerMode, world.revision);
  return {
    definition: instantiated.definition,
    hierarchyProfile: instantiated.hierarchyProfile,
    corrupt: false,
    link,
    world,
    status: linkedSpatialWorldStatus(link, world),
  };
}

export function withSpatialSharedWorldLink(
  metadata: Record<string, unknown>,
  link: SpatialSharedWorldLink,
): Record<string, unknown> {
  const {
    [SPATIAL_DEFINITION_METADATA_KEY]: _definition,
    [SPATIAL_HIERARCHY_PROFILE_METADATA_KEY]: _profile,
    ...rest
  } = metadata;
  return { ...rest, [SPATIAL_SHARED_WORLD_LINK_METADATA_KEY]: link };
}

export function withSpatialSharedWorldDraft(
  metadata: Record<string, unknown>,
  link: SpatialSharedWorldLink,
  baseWorldRevision: number,
  definition: SpatialContextDefinition,
  hierarchyProfile: SpatialHierarchyProfile,
  timestamp: string,
): Record<string, unknown> {
  return withSpatialSharedWorldLink(metadata, {
    ...link,
    draft: {
      baseWorldRevision: link.draft?.baseWorldRevision ?? baseWorldRevision,
      definition,
      hierarchyProfile: normalizeHierarchyProfile(hierarchyProfile, definition),
      createdAt: link.draft?.createdAt ?? timestamp,
      updatedAt: timestamp,
    },
  });
}

export function withoutSpatialSharedWorldLink(metadata: Record<string, unknown>): Record<string, unknown> {
  const { [SPATIAL_SHARED_WORLD_LINK_METADATA_KEY]: _link, ...rest } = metadata;
  return rest;
}
