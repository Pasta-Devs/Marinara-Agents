import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import {
  generateSpatialMapDraftRequestSchema,
  pendingSpatialTransitionSchema,
  spatialContextDefinitionSchema,
  updateSpatialContextRequestSchema,
  type CapabilityChatRecord,
  type CapabilityDocumentRecord,
  type CapabilityResolvedLanguageModel,
  type CapabilityResourceHost,
  type GenerateSpatialMapDraftResponse,
  type SpatialContextDefinition,
  type SpatialMapGroundingMode,
  type SpatialMapGroundingSummary,
  type SpatialMapLocationProvenance,
  type SpatialOwnerMode,
} from "@marinara-engine/shared";
import {
  buildSpatialMapDraftPrompt,
  buildSpatialMapExpansionPrompt,
  normalizeSpatialMapExpansionPlan,
  normalizeSpatialMapPlan,
  readSpatialHierarchyProfile,
  readSpatialMapPlanProvenance,
  resolveSpatialDraftSizeSpec,
  SPATIAL_CUSTOM_TARGET_LOCATION_LIMIT,
} from "../services/spatial-context/ai-draft.js";
import {
  createSpatialContextService,
  SpatialContextServiceError,
} from "../services/spatial-context/definition.service.js";
import {
  buildSpatialMapJsonRepairMessages,
  parseSpatialMapJsonWithRepair,
  spatialMapJsonErrorPayload,
} from "../services/spatial-context/map-json-response.js";
import {
  commitSpatialOwnerTurn,
  findAppliedSpatialOwnerTurn,
  SpatialOwnerTurnError,
} from "../services/spatial-context/owner-turn.js";
import {
  buildGameMapDraftReference,
  type GameMapDraftReference,
} from "../services/spatial-context/game-map-binding.js";
import { parseSpatialMetadata } from "../services/spatial-context/metadata.js";
import {
  getPackageAgentConnectionId,
  getPackageAgentSettings,
  getPackageJson,
  getPackageLanguageModels,
  getPackagePersistence,
  getPackageResources,
  isDebugAgentsEnabled,
  logger,
  logDebugOverride,
  newTimeSortableId,
  now,
  updatePackageAgentConfiguration,
  updatePackageAgentSettings,
} from "../services/spatial-context/package-runtime.js";
import {
  GENERATION_PROMPT_LIBRARIES_VERSION,
  defaultGenerationPreferences,
  generationPreferencesWithPromptLibrary,
  normalizeHierarchyProfile,
  createSpatialMapTemplateData,
  createSpatialSharedWorldData,
  parseSpatialGenerationPromptLibraries,
  resolveSpatialGenerationPromptOption,
  SPATIAL_GENERATION_PROMPT_LIBRARIES_SETTINGS_KEY,
  SPATIAL_TURN_PROMPT_TEMPLATES_SETTINGS_KEY,
  spatialGenerationCustomVariableValues,
  spatialGenerationPromptLibrarySchema,
  spatialGenerationPreferencesSchema,
  spatialHierarchyProfileSchema,
  spatialTurnPromptTemplatesSchema,
  SPATIAL_MAP_TEMPLATE_VERSION,
  SPATIAL_SHARED_WORLD_LINK_VERSION,
  type SpatialMapTemplateRecord,
  type SpatialGenerationPromptLibraries,
  type SpatialHierarchyProfile,
} from "../../../maps-shared/src/maps-model.js";
import { resolveEffectiveSpatialState } from "../services/spatial-context/state-resolution.js";
import {
  SPATIAL_HIERARCHY_PROFILE_METADATA_KEY,
  SPATIAL_SHARED_WORLD_KIND,
  SPATIAL_SHARED_WORLD_PACKAGE_ID,
  getSpatialSharedWorld,
  linkedChatIdsForSpatialWorld,
  listSpatialSharedWorlds,
  readSpatialSharedWorldDocument,
  resolveSpatialWorldSource,
  spatialSharedWorldNameExists,
  withSpatialSharedWorldCreationLock,
  withSpatialSharedWorldLink,
  withoutSpatialSharedWorldLink,
} from "../services/spatial-context/shared-world.service.js";

interface ChatSpatialParams {
  chatId: string;
}

interface ChatSpatialCommandParams extends ChatSpatialParams {
  commandId: string;
}

interface SpatialTurnRecoveryQuery {
  destinationId?: string;
  travelMode?: string;
  expectedDefinitionRevision?: string;
  expectedCurrentLocationId?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function withoutKeys(value: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const omitted = new Set(keys);
  return Object.fromEntries(Object.entries(value).filter(([key]) => !omitted.has(key)));
}

function spatialMapJsonRepairRequest(resolved: CapabilityResolvedLanguageModel, maxTokens: number, debugMode: boolean) {
  return async (malformedRaw: string) => {
    const repairPrompt = resolved.fitContext(buildSpatialMapJsonRepairMessages(malformedRaw), { maxTokens });
    if (repairPrompt.trimmed) {
      throw new Error("The malformed response could not fit in a complete formatting-repair request.");
    }
    return resolved.chatComplete(repairPrompt.messages, {
      temperature: 0,
      maxTokens,
      debugMode,
    });
  };
}

const GAME_LOREBOOK_KEEPER_SOURCE_ID = "game-lorebook-keeper";
const spatialAgentConfigurationUpdateSchema = z.object({
  description: z.string(),
  phase: z.literal("pre_generation"),
  connectionId: z.string().nullable(),
  settings: z.object({
    author: z.string(),
  }),
});

const SPATIAL_MAP_TEMPLATE_PACKAGE_ID = "hierarchical-maps";
const SPATIAL_MAP_TEMPLATE_KIND = "map-template";
const spatialCustomTargetLocationSchema = z.number().int().min(1).max(SPATIAL_CUSTOM_TARGET_LOCATION_LIMIT);

const spatialMapTemplateInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(1_000).default(""),
    definition: spatialContextDefinitionSchema,
    hierarchyProfile: spatialHierarchyProfileSchema,
  })
  .strict();

const spatialMapTemplateUpdateSchema = spatialMapTemplateInputSchema.extend({
  expectedRevision: z.number().int().positive().safe(),
});

const spatialMapTemplateDeleteSchema = z.object({ expectedRevision: z.number().int().positive().safe() }).strict();

const spatialSharedWorldInputSchema = spatialMapTemplateInputSchema;
const spatialSharedWorldUpdateSchema = spatialMapTemplateUpdateSchema;
const spatialSharedWorldDeleteSchema = spatialMapTemplateDeleteSchema;
const spatialSharedWorldAttachSchema = z
  .object({
    worldId: z.string().trim().min(1).max(200),
    expectedWorldRevision: z.number().int().positive().safe(),
    expectedRevision: z.number().int().nonnegative().safe(),
    expectedCurrentLocationId: z.string().trim().min(1).nullable(),
  })
  .strict();
const spatialSharedWorldDraftActionSchema = z
  .object({
    expectedWorldRevision: z.number().int().positive().safe(),
    definition: spatialContextDefinitionSchema,
    hierarchyProfile: spatialHierarchyProfileSchema,
  })
  .strict();
const spatialSharedWorldChatActionSchema = z
  .object({
    expectedRevision: z.number().int().nonnegative().safe(),
    expectedCurrentLocationId: z.string().trim().min(1).nullable(),
  })
  .strict();

const spatialMapTemplateDataSchema = z
  .object({
    version: z.literal(SPATIAL_MAP_TEMPLATE_VERSION),
    definition: spatialContextDefinitionSchema,
    hierarchyProfile: spatialHierarchyProfileSchema,
  })
  .strict();

function readSpatialMapTemplate(document: CapabilityDocumentRecord): SpatialMapTemplateRecord | null {
  const data = spatialMapTemplateDataSchema.safeParse(document.data);
  if (!data.success) {
    logger.warn("Ignored invalid World Maps template document %s", document.id);
    return null;
  }
  return {
    id: document.id,
    name: document.name,
    description: document.description,
    data: data.data,
    revision: document.revision,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

function firstRemovedSpatialLocation(
  current: SpatialContextDefinition,
  next: SpatialContextDefinition,
): { id: string; name: string } | null {
  const nextIds = new Set(next.locations.map((location) => location.id));
  const removed = current.locations.find((location) => !nextIds.has(location.id));
  return removed ? { id: removed.id, name: removed.name } : null;
}

function sameSpatialLocationIds(left: SpatialContextDefinition, right: SpatialContextDefinition): boolean {
  const leftIds = new Set(left.locations.map((location) => location.id));
  return leftIds.size === right.locations.length && right.locations.every((location) => leftIds.has(location.id));
}

function readTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function resolveLorebookScopeExclusions(
  chatMode: unknown,
  metadata: Record<string, unknown>,
): { excludedLorebookIds: string[]; excludedSourceAgentIds: string[] } {
  const userExcludedLorebookIds = Array.isArray(metadata.excludedLorebookIds)
    ? metadata.excludedLorebookIds.filter(
        (value): value is string => typeof value === "string" && value.trim().length > 0,
      )
    : [];
  const hideGameKeeper = chatMode === "game" && metadata.gameLorebookKeeperEnabled !== true;
  const gameLorebookId = hideGameKeeper ? readTrimmedString(metadata.gameLorebookKeeperLorebookId) : null;
  return {
    excludedLorebookIds: [...new Set([...userExcludedLorebookIds, ...(gameLorebookId ? [gameLorebookId] : [])])],
    excludedSourceAgentIds: hideGameKeeper ? [GAME_LOREBOOK_KEEPER_SOURCE_ID] : [],
  };
}

const spatialOwnerTurnSchema = z.object({
  content: z.string().default(""),
  transition: pendingSpatialTransitionSchema,
  attachments: z
    .array(
      z.object({
        type: z.string().min(1),
        data: z.string().optional(),
        url: z.string().optional(),
        filename: z.string().optional(),
        name: z.string().optional(),
      }),
    )
    .optional(),
});

const gameMapBindingTargetSchema = z.discriminatedUnion("target", [
  z.object({ target: z.literal("map"), mapId: z.string().trim().min(1) }).strict(),
  z
    .object({
      target: z.literal("cell"),
      mapId: z.string().trim().min(1),
      x: z.number().int().safe(),
      y: z.number().int().safe(),
    })
    .strict(),
  z
    .object({
      target: z.literal("node"),
      mapId: z.string().trim().min(1),
      nodeId: z.string().trim().min(1),
    })
    .strict(),
]);

const gameMapBindingReconciliationSchema = z
  .object({
    expectedDefinitionRevision: z.number().int().nonnegative().safe(),
    bindings: z
      .array(
        z
          .object({
            target: gameMapBindingTargetSchema,
            spatialLocationId: z.string().trim().min(1),
          })
          .strict(),
      )
      .max(500),
  })
  .strict();

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === "string");
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

function excerpt(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

const SPATIAL_LORE_CATALOG_ENTRY_LIMIT = 100;
const SPATIAL_LORE_CATALOG_CHARACTER_LIMIT = 24_000;

interface SpatialLoreCatalogItem {
  sourceKey: string;
  entryId: string;
  lorebookId: string;
  lorebookName: string;
  entryName: string;
  excerpt: string;
}

interface BuiltSpatialLoreCatalog {
  prompt: string;
  sourceEntryIdsByKey: Map<string, string>;
  itemsByEntryId: Map<string, SpatialLoreCatalogItem>;
  grounding: SpatialMapGroundingSummary;
}

class SpatialMapPromptRequestError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly issues?: unknown,
  ) {
    super(message);
    this.name = "SpatialMapPromptRequestError";
  }
}

async function buildSpatialLoreCatalog(
  resources: CapabilityResourceHost,
  mode: SpatialMapGroundingMode,
  sourceLorebookIds: string[],
  sourceEntryIds: string[],
  exclusions: {
    excludedLorebookIds: string[];
    excludedSourceAgentIds: string[];
  },
): Promise<BuiltSpatialLoreCatalog> {
  const selectedLorebookIds = Array.from(new Set(sourceLorebookIds));
  const selectedEntryIds = Array.from(new Set(sourceEntryIds));
  if (mode === "setup") {
    return {
      prompt: "",
      sourceEntryIdsByKey: new Map(),
      itemsByEntryId: new Map(),
      grounding: {
        mode,
        selectedLorebookCount: 0,
        selectedEntryCount: 0,
        consideredEntryCount: 0,
        omittedEntryCount: 0,
      },
    };
  }

  const orderedEntries = await resources.listEligibleLorebookEntries({
    lorebookIds: selectedLorebookIds,
    entryIds: selectedEntryIds,
    ...exclusions,
  });
  const items: SpatialLoreCatalogItem[] = [];
  let usedCharacters = 0;

  for (const entry of orderedEntries) {
    if (items.length >= SPATIAL_LORE_CATALOG_ENTRY_LIMIT) break;
    const item: SpatialLoreCatalogItem = {
      sourceKey: `source_${items.length + 1}`,
      entryId: entry.id,
      lorebookId: entry.lorebookId,
      lorebookName: entry.lorebookName,
      entryName: entry.name,
      excerpt: (excerpt(entry.content, 1_000) ?? excerpt(entry.description, 1_000) ?? "").trim(),
    };
    const promptItem = JSON.stringify({
      sourceKey: item.sourceKey,
      lorebook: item.lorebookName,
      entry: item.entryName,
      content: item.excerpt,
    });
    if (usedCharacters + promptItem.length > SPATIAL_LORE_CATALOG_CHARACTER_LIMIT) break;
    items.push(item);
    usedCharacters += promptItem.length;
  }

  return {
    prompt: JSON.stringify(
      items.map((item) => ({
        sourceKey: item.sourceKey,
        lorebook: item.lorebookName,
        entry: item.entryName,
        content: item.excerpt,
      })),
      null,
      2,
    ),
    sourceEntryIdsByKey: new Map(items.map((item) => [item.sourceKey, item.entryId])),
    itemsByEntryId: new Map(items.map((item) => [item.entryId, item])),
    grounding: {
      mode,
      selectedLorebookCount: selectedLorebookIds.length,
      selectedEntryCount: selectedEntryIds.length,
      consideredEntryCount: items.length,
      omittedEntryCount: Math.max(0, orderedEntries.length - items.length),
    },
  };
}

function buildSpatialMapProvenance(
  plan: unknown,
  generatedLocations: Array<{ id: string; lorebookEntryIds: string[] }>,
  catalog: BuiltSpatialLoreCatalog,
  mode: SpatialMapGroundingMode,
): Record<string, SpatialMapLocationProvenance> | undefined {
  if (mode === "setup") return undefined;
  const planProvenance = readSpatialMapPlanProvenance(plan);
  return Object.fromEntries(
    generatedLocations.map((location, index) => {
      const sources = location.lorebookEntryIds.flatMap((entryId) => {
        const item = catalog.itemsByEntryId.get(entryId);
        return item
          ? [
              {
                entryId: item.entryId,
                lorebookId: item.lorebookId,
                lorebookName: item.lorebookName,
                entryName: item.entryName,
                excerpt: item.excerpt,
              },
            ]
          : [];
      });
      const kind =
        sources.length > 0 ? "lore_backed" : planProvenance[index]?.origin === "inferred" ? "inferred" : "added_by_ai";
      return [location.id, { kind, sources } satisfies SpatialMapLocationProvenance];
    }),
  );
}

async function buildDraftSourceContext(
  chat: CapabilityChatRecord,
  resources: CapabilityResourceHost,
  gameMapReference: GameMapDraftReference | null,
): Promise<string> {
  const metadata = parseSpatialMetadata(chat.metadata);
  const setup = parseSpatialMetadata(metadata.gameSetupConfig);
  const characterContext: Array<Record<string, string>> = [];
  const characterIds = stringArray(chat.characterIds)
    .filter((characterId) => !characterId.startsWith("npc:"))
    .slice(0, 8);
  for (const character of await resources.listCharacters(characterIds)) {
    const data = parseSpatialMetadata(character.data);
    characterContext.push({
      name: excerpt(data.name, 200) ?? "Character",
      ...(excerpt(data.description, 1_200) ? { description: excerpt(data.description, 1_200)! } : {}),
      ...(excerpt(data.personality, 800) ? { personality: excerpt(data.personality, 800)! } : {}),
      ...(excerpt(data.scenario, 1_000) ? { scenario: excerpt(data.scenario, 1_000)! } : {}),
    });
  }

  const source =
    chat.mode === "game"
      ? {
          chatName: chat.name,
          mode: chat.mode,
          setup: {
            genre: excerpt(setup.genre, 300),
            setting: excerpt(setup.setting, 2_000),
            tone: excerpt(setup.tone, 500),
            playerGoals: excerpt(setup.playerGoals, 1_200),
            specialInstructions: excerpt(setup.gameSpecialInstructions, 1_200),
          },
          worldOverview: excerpt(metadata.gameWorldOverview, 3_000),
          storyArc: excerpt(metadata.gameStoryArc, 2_000),
          ...(gameMapReference
            ? {
                acceptedGameMap: {
                  authority: "accepted_game_setup_map",
                  maps: gameMapReference.maps,
                },
              }
            : {}),
          characters: characterContext,
        }
      : {
          chatName: chat.name,
          mode: chat.mode,
          scenario:
            excerpt(metadata.sceneDescription, 2_000) ??
            excerpt(metadata.roleplayScenario, 2_000) ??
            excerpt(metadata.scenario, 2_000),
          characters: characterContext,
        };
  return JSON.stringify(source, null, 2).slice(0, 16_000);
}

function sendServiceError(reply: FastifyReply, error: unknown) {
  if (error instanceof SpatialContextServiceError) {
    return reply.status(error.statusCode).send({ error: error.message, code: error.code });
  }
  throw error;
}

function sendPromptRequestError(reply: FastifyReply, error: unknown) {
  if (error instanceof SpatialMapPromptRequestError) {
    return reply.status(error.statusCode).send({
      error: error.message,
      code: error.code,
      ...(error.issues === undefined ? {} : { issues: error.issues }),
    });
  }
  return sendServiceError(reply, error);
}

export async function spatialContextRoutes(app: FastifyInstance) {
  const service = createSpatialContextService();
  const persistence = getPackagePersistence();
  const resources = getPackageResources();
  const languageModels = getPackageLanguageModels();
  const json = getPackageJson();

  app.patch("/spatial-context/agent-configuration", async (request, reply) => {
    const patch = spatialAgentConfigurationUpdateSchema.safeParse(request.body);
    if (!patch.success) {
      return reply.status(400).send({
        error: patch.error.issues[0]?.message ?? "The World Maps agent configuration is invalid.",
        code: "spatial_agent_configuration_invalid",
        issues: patch.error.issues,
      });
    }
    return updatePackageAgentConfiguration("hierarchical-maps", patch.data);
  });

  app.put("/spatial-context/global-generation-prompt-libraries/:ownerMode", async (request, reply) => {
    const ownerMode = z.enum(["roleplay", "game"]).safeParse((request.params as { ownerMode?: unknown }).ownerMode);
    const library = spatialGenerationPromptLibrarySchema.safeParse(request.body);
    if (!ownerMode.success || !library.success) {
      return reply.status(400).send({
        error: library.success
          ? "Choose Roleplay or Game mode."
          : (library.error.issues[0]?.message ?? "The generation prompt library is invalid."),
        code: "spatial_global_generation_prompt_library_invalid",
        ...(!library.success ? { issues: library.error.issues } : {}),
      });
    }

    const settings = await updatePackageAgentSettings("hierarchical-maps", (current) => {
      const existing = parseSpatialGenerationPromptLibraries(current[SPATIAL_GENERATION_PROMPT_LIBRARIES_SETTINGS_KEY]);
      const libraries: SpatialGenerationPromptLibraries = {
        version: GENERATION_PROMPT_LIBRARIES_VERSION,
        ...(existing ?? {}),
        [ownerMode.data]: library.data,
      };
      return {
        ...current,
        [SPATIAL_GENERATION_PROMPT_LIBRARIES_SETTINGS_KEY]: libraries,
      };
    });
    return parseSpatialGenerationPromptLibraries(settings[SPATIAL_GENERATION_PROMPT_LIBRARIES_SETTINGS_KEY]);
  });

  app.put("/spatial-context/global-turn-prompt-templates", async (request, reply) => {
    const templates = spatialTurnPromptTemplatesSchema.safeParse(request.body);
    if (!templates.success) {
      return reply.status(400).send({
        error: templates.error.issues[0]?.message ?? "The turn prompt templates are invalid.",
        code: "spatial_global_turn_prompt_templates_invalid",
        issues: templates.error.issues,
      });
    }

    const settings = await updatePackageAgentSettings("hierarchical-maps", (current) => ({
      ...current,
      [SPATIAL_TURN_PROMPT_TEMPLATES_SETTINGS_KEY]: templates.data,
    }));
    return spatialTurnPromptTemplatesSchema.parse(settings[SPATIAL_TURN_PROMPT_TEMPLATES_SETTINGS_KEY]);
  });

  app.get("/spatial-context/templates", async () => {
    const documents = await persistence.documents.list(SPATIAL_MAP_TEMPLATE_PACKAGE_ID, SPATIAL_MAP_TEMPLATE_KIND);
    return documents.flatMap((document) => {
      const template = readSpatialMapTemplate(document);
      return template ? [template] : [];
    });
  });

  app.post("/spatial-context/templates", async (request, reply) => {
    const input = spatialMapTemplateInputSchema.safeParse(request.body);
    if (!input.success) {
      return reply.status(400).send({
        error: input.error.issues[0]?.message ?? "The map template is invalid.",
        code: "spatial_map_template_invalid",
        issues: input.error.issues,
      });
    }
    const timestamp = now();
    const document = await persistence.documents.create({
      id: newTimeSortableId(),
      packageId: SPATIAL_MAP_TEMPLATE_PACKAGE_ID,
      kind: SPATIAL_MAP_TEMPLATE_KIND,
      name: input.data.name,
      description: input.data.description,
      data: createSpatialMapTemplateData(input.data.definition, input.data.hierarchyProfile),
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    return reply.status(201).send(readSpatialMapTemplate(document));
  });

  app.put("/spatial-context/templates/:templateId", async (request, reply) => {
    const templateId = z
      .string()
      .trim()
      .min(1)
      .safeParse((request.params as { templateId?: unknown }).templateId);
    const input = spatialMapTemplateUpdateSchema.safeParse(request.body);
    if (!templateId.success || !input.success) {
      return reply.status(400).send({
        error: input.success
          ? "Choose a map template."
          : (input.error.issues[0]?.message ?? "The map template is invalid."),
        code: "spatial_map_template_invalid",
        ...(!input.success ? { issues: input.error.issues } : {}),
      });
    }
    const document = await persistence.documents.update({
      id: templateId.data,
      packageId: SPATIAL_MAP_TEMPLATE_PACKAGE_ID,
      expectedRevision: input.data.expectedRevision,
      name: input.data.name,
      description: input.data.description,
      data: createSpatialMapTemplateData(input.data.definition, input.data.hierarchyProfile),
      updatedAt: now(),
    });
    if (!document) {
      return reply.status(409).send({
        error: "This map template changed or was removed. Return to the library and open it again.",
        code: "spatial_map_template_stale",
      });
    }
    return readSpatialMapTemplate(document);
  });

  app.delete("/spatial-context/templates/:templateId", async (request, reply) => {
    const templateId = z
      .string()
      .trim()
      .min(1)
      .safeParse((request.params as { templateId?: unknown }).templateId);
    const input = spatialMapTemplateDeleteSchema.safeParse(request.body);
    if (!templateId.success || !input.success) {
      return reply.status(400).send({
        error: input.success
          ? "Choose a map template."
          : (input.error.issues[0]?.message ?? "The map template revision is invalid."),
        code: "spatial_map_template_invalid",
      });
    }
    const removed = await persistence.documents.remove(
      SPATIAL_MAP_TEMPLATE_PACKAGE_ID,
      templateId.data,
      input.data.expectedRevision,
    );
    if (!removed) {
      return reply.status(409).send({
        error: "This map template changed or was already removed. Refresh the library.",
        code: "spatial_map_template_stale",
      });
    }
    return reply.status(204).send();
  });

  app.get("/spatial-context/shared-worlds", async () => listSpatialSharedWorlds(persistence));

  app.post("/spatial-context/shared-worlds", async (request, reply) => {
    const input = spatialSharedWorldInputSchema.safeParse(request.body);
    if (!input.success) {
      return reply.status(400).send({
        error: input.error.issues[0]?.message ?? "The shared world is invalid.",
        code: "spatial_shared_world_invalid",
        issues: input.error.issues,
      });
    }
    const document = await withSpatialSharedWorldCreationLock(async () => {
      if (await spatialSharedWorldNameExists(persistence, input.data.name)) return null;
      const timestamp = now();
      return persistence.documents.create({
        id: newTimeSortableId(),
        packageId: SPATIAL_SHARED_WORLD_PACKAGE_ID,
        kind: SPATIAL_SHARED_WORLD_KIND,
        name: input.data.name,
        description: input.data.description,
        data: createSpatialSharedWorldData(input.data.definition, input.data.hierarchyProfile),
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    });
    if (!document) {
      return reply.status(409).send({
        error: "A shared world with that name already exists. Refresh the World library and choose another name.",
        code: "spatial_shared_world_name_conflict",
      });
    }
    return reply.status(201).send(readSpatialSharedWorldDocument(document, 0));
  });

  app.put("/spatial-context/shared-worlds/:worldId", async (request, reply) => {
    const worldId = z
      .string()
      .trim()
      .min(1)
      .safeParse((request.params as { worldId?: unknown }).worldId);
    const input = spatialSharedWorldUpdateSchema.safeParse(request.body);
    if (!worldId.success || !input.success) {
      return reply.status(400).send({
        error: input.success
          ? "Choose a shared world."
          : (input.error.issues[0]?.message ?? "The shared world is invalid."),
        code: "spatial_shared_world_invalid",
        ...(!input.success ? { issues: input.error.issues } : {}),
      });
    }
    const current = await getSpatialSharedWorld(persistence, worldId.data);
    if (!current) {
      return reply.status(404).send({
        error: "The shared world was removed or is unavailable.",
        code: "spatial_shared_world_missing",
      });
    }
    if (current.linkedChatCount > 0) {
      const removed = firstRemovedSpatialLocation(current.data.definition, input.data.definition);
      if (removed) {
        return reply.status(409).send({
          error: `“${removed.name || removed.id}” is used by a linked world. Archive it instead of deleting it.`,
          code: "spatial_shared_world_location_removal_forbidden",
        });
      }
    }
    const updateResult = await withSpatialSharedWorldCreationLock(async () => {
      if (await spatialSharedWorldNameExists(persistence, input.data.name, worldId.data)) {
        return { nameConflict: true as const, document: null };
      }
      return {
        nameConflict: false as const,
        document: await persistence.documents.update({
          id: worldId.data,
          packageId: SPATIAL_SHARED_WORLD_PACKAGE_ID,
          expectedRevision: input.data.expectedRevision,
          name: input.data.name,
          description: input.data.description,
          data: createSpatialSharedWorldData(input.data.definition, input.data.hierarchyProfile),
          updatedAt: now(),
        }),
      };
    });
    if (updateResult.nameConflict) {
      return reply.status(409).send({
        error: "A shared world with that name already exists. Refresh the World library and choose another name.",
        code: "spatial_shared_world_name_conflict",
      });
    }
    const { document } = updateResult;
    if (!document) {
      return reply.status(409).send({
        error: "This shared world changed or was removed. Return to the library and open it again.",
        code: "spatial_shared_world_stale",
      });
    }
    return readSpatialSharedWorldDocument(document, current.linkedChatCount);
  });

  app.delete("/spatial-context/shared-worlds/:worldId", async (request, reply) => {
    const worldId = z
      .string()
      .trim()
      .min(1)
      .safeParse((request.params as { worldId?: unknown }).worldId);
    const input = spatialSharedWorldDeleteSchema.safeParse(request.body);
    if (!worldId.success || !input.success) {
      return reply.status(400).send({
        error: "Choose a valid shared world revision.",
        code: "spatial_shared_world_invalid",
      });
    }
    const linkedChatIds = await linkedChatIdsForSpatialWorld(persistence, worldId.data);
    if (linkedChatIds.length > 0) {
      return reply.status(409).send({
        error: `This world is linked to ${linkedChatIds.length} chat${linkedChatIds.length === 1 ? "" : "s"}. Fork or relink those chats before deleting it.`,
        code: "spatial_shared_world_in_use",
        linkedChatCount: linkedChatIds.length,
      });
    }
    const removed = await persistence.documents.remove(
      SPATIAL_SHARED_WORLD_PACKAGE_ID,
      worldId.data,
      input.data.expectedRevision,
    );
    if (!removed) {
      return reply.status(409).send({
        error: "This shared world changed or was already removed. Refresh the library.",
        code: "spatial_shared_world_stale",
      });
    }
    return reply.status(204).send();
  });

  app.post<{ Params: ChatSpatialParams }>("/:chatId/spatial-context/shared-world/link", async (request, reply) => {
    const input = spatialSharedWorldAttachSchema.safeParse(request.body);
    if (!input.success) {
      return reply.status(400).send({
        error: input.error.issues[0]?.message ?? "Choose a shared world.",
        code: "spatial_shared_world_invalid",
      });
    }
    const chat = await persistence.getChat(request.params.chatId);
    if (!chat) return reply.status(404).send({ error: "Chat not found.", code: "spatial_chat_missing" });
    if (chat.mode !== "roleplay" && chat.mode !== "game") {
      return reply.status(400).send({
        error: "Shared worlds are available only in Roleplay and Game chats.",
        code: "spatial_mode_unsupported",
      });
    }
    const [current, world] = await Promise.all([
      service.get(chat.id),
      getSpatialSharedWorld(persistence, input.data.worldId),
    ]);
    if (!world) {
      return reply.status(404).send({
        error: "The shared world was removed or is unavailable.",
        code: "spatial_shared_world_missing",
      });
    }
    if (world.revision !== input.data.expectedWorldRevision) {
      return reply.status(409).send({
        error: "This shared world changed after it was selected. Return to the library and choose it again.",
        code: "spatial_shared_world_selection_stale",
      });
    }
    if (current.sharedWorld.pendingChanges) {
      return reply.status(409).send({
        error: "Publish, discard, or fork this chat's unpublished world changes before linking another shared world.",
        code: "spatial_shared_world_pending_changes",
      });
    }
    if ((current.definition?.revision ?? 0) !== input.data.expectedRevision) {
      return reply.status(409).send({
        error: "This chat's map changed. Reload it before linking a shared world.",
        code: "spatial_definition_stale",
      });
    }
    if (current.currentLocationId !== input.data.expectedCurrentLocationId) {
      return reply.status(409).send({
        error: "The current location changed. Reload before linking a shared world.",
        code: "spatial_current_location_stale",
      });
    }
    const sharedIds = new Set(world.data.definition.locations.map((location) => location.id));
    if (current.currentLocationId && !sharedIds.has(current.currentLocationId)) {
      return reply.status(409).send({
        error:
          "The current location does not exist in this shared world. Start from an independent copy or migrate this chat's current map first.",
        code: "spatial_shared_world_current_location_missing",
      });
    }
    if (current.hasCommittedSpatialHistory && current.definition) {
      const missingHistoricalLocation = current.definition.locations.find((location) => !sharedIds.has(location.id));
      if (missingHistoricalLocation) {
        return reply.status(409).send({
          error: `Campaign history uses “${missingHistoricalLocation.name || missingHistoricalLocation.id}”, which is not in this shared world. Migrate this map into a new shared world or use an independent copy.`,
          code: "spatial_shared_world_history_mismatch",
        });
      }
    }
    const metadata = parseSpatialMetadata(chat.metadata);
    await persistence.updateChatMetadata({
      chatId: chat.id,
      metadata: withSpatialSharedWorldLink(metadata, {
        version: SPATIAL_SHARED_WORLD_LINK_VERSION,
        worldId: world.id,
        linkedAt: now(),
      }),
      updatedAt: now(),
    });
    return service.get(chat.id);
  });

  app.post<{ Params: ChatSpatialParams }>(
    "/:chatId/spatial-context/shared-world/independent-copy",
    async (request, reply) => {
      const body = isRecord(request.body) ? request.body : {};
      const parsed = updateSpatialContextRequestSchema.safeParse(withoutKeys(body, ["hierarchyProfile"]));
      const parsedHierarchyProfile =
        body.hierarchyProfile === undefined ? null : spatialHierarchyProfileSchema.safeParse(body.hierarchyProfile);
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? "Invalid independent world map.",
          code: "spatial_request_invalid",
          issues: parsed.error.issues,
        });
      }
      if (parsedHierarchyProfile && !parsedHierarchyProfile.success) {
        return reply.status(400).send({
          error: parsedHierarchyProfile.error.issues[0]?.message ?? "Invalid hierarchy profile.",
          code: "spatial_request_invalid",
          issues: parsedHierarchyProfile.error.issues,
        });
      }
      try {
        return await service.update(
          request.params.chatId,
          {
            ...parsed.data,
            ...(parsedHierarchyProfile?.success ? { hierarchyProfile: parsedHierarchyProfile.data } : {}),
          },
          { detachSharedWorld: true },
        );
      } catch (error) {
        return sendServiceError(reply, error);
      }
    },
  );

  app.post<{ Params: ChatSpatialParams }>("/:chatId/spatial-context/shared-world/fork", async (request, reply) => {
    const input = spatialSharedWorldChatActionSchema.safeParse(request.body);
    if (!input.success) {
      return reply.status(400).send({
        error: "The map revision is invalid.",
        code: "spatial_request_invalid",
      });
    }
    const chat = await persistence.getChat(request.params.chatId);
    if (!chat) return reply.status(404).send({ error: "Chat not found.", code: "spatial_chat_missing" });
    const source = await resolveSpatialWorldSource(chat, persistence);
    if (!source.link || !source.definition) {
      return reply.status(409).send({
        error: "This chat is not linked to an available shared world.",
        code: "spatial_shared_world_not_linked",
      });
    }
    const state = await resolveEffectiveSpatialState(chat.id, {}, persistence);
    if (
      source.definition.revision !== input.data.expectedRevision ||
      state.currentLocationId !== input.data.expectedCurrentLocationId
    ) {
      return reply.status(409).send({
        error: "The linked world or current location changed. Reload before forking.",
        code: "spatial_shared_world_stale",
      });
    }
    const metadata = withoutSpatialSharedWorldLink(parseSpatialMetadata(chat.metadata));
    await persistence.updateChatMetadata({
      chatId: chat.id,
      metadata: {
        ...metadata,
        spatialContext: source.definition,
        [SPATIAL_HIERARCHY_PROFILE_METADATA_KEY]: source.hierarchyProfile,
      },
      updatedAt: now(),
    });
    return service.get(chat.id);
  });

  app.post<{ Params: ChatSpatialParams }>("/:chatId/spatial-context/shared-world/discard", async (request, reply) => {
    const input = spatialSharedWorldChatActionSchema.safeParse(request.body);
    if (!input.success) {
      return reply.status(400).send({
        error: "The map revision is invalid.",
        code: "spatial_request_invalid",
      });
    }
    const chat = await persistence.getChat(request.params.chatId);
    if (!chat) return reply.status(404).send({ error: "Chat not found.", code: "spatial_chat_missing" });
    const source = await resolveSpatialWorldSource(chat, persistence);
    if (!source.link?.draft || !source.world || !source.definition) {
      return reply.status(409).send({
        error: "This linked chat has no unpublished map changes.",
        code: "spatial_shared_world_no_draft",
      });
    }
    const state = await resolveEffectiveSpatialState(chat.id, {}, persistence);
    if (
      source.definition.revision !== input.data.expectedRevision ||
      state.currentLocationId !== input.data.expectedCurrentLocationId
    ) {
      return reply.status(409).send({
        error: "The linked map or current location changed. Reload before discarding changes.",
        code: "spatial_shared_world_stale",
      });
    }
    const canonicalIds = new Set(source.world.data.definition.locations.map((location) => location.id));
    if (state.currentLocationId && !canonicalIds.has(state.currentLocationId)) {
      return reply.status(409).send({
        error:
          "The current location exists only in this chat's unpublished changes. Move to a shared location or fork the map before discarding.",
        code: "spatial_shared_world_current_location_local",
      });
    }
    const { draft: _draft, ...link } = source.link;
    await persistence.updateChatMetadata({
      chatId: chat.id,
      metadata: withSpatialSharedWorldLink(parseSpatialMetadata(chat.metadata), link),
      updatedAt: now(),
    });
    return service.get(chat.id);
  });

  app.post<{ Params: ChatSpatialParams }>("/:chatId/spatial-context/shared-world/publish", async (request, reply) => {
    const input = spatialSharedWorldDraftActionSchema.safeParse(request.body);
    if (!input.success) {
      return reply.status(400).send({
        error: input.error.issues[0]?.message ?? "The shared-world changes are invalid.",
        code: "spatial_shared_world_invalid",
      });
    }
    const chat = await persistence.getChat(request.params.chatId);
    if (!chat) return reply.status(404).send({ error: "Chat not found.", code: "spatial_chat_missing" });
    const source = await resolveSpatialWorldSource(chat, persistence, {
      includeLinkedChatCount: true,
    });
    if (!source.link?.draft || !source.world) {
      return reply.status(409).send({
        error: "This linked chat has no unpublished map changes.",
        code: "spatial_shared_world_no_draft",
      });
    }
    if (
      source.world.revision !== input.data.expectedWorldRevision ||
      source.link.draft.baseWorldRevision !== source.world.revision
    ) {
      return reply.status(409).send({
        error:
          "The shared world changed after this chat began editing it. Fork this chat or discard its changes before publishing.",
        code: "spatial_shared_world_conflict",
      });
    }
    if (!sameSpatialLocationIds(source.link.draft.definition, input.data.definition)) {
      return reply.status(400).send({
        error: "Published artwork may be remapped, but the submitted locations must match this chat's reviewed draft.",
        code: "spatial_shared_world_draft_mismatch",
      });
    }
    const removed = firstRemovedSpatialLocation(source.world.data.definition, input.data.definition);
    if (removed && source.world.linkedChatCount > 0) {
      return reply.status(409).send({
        error: `“${removed.name || removed.id}” belongs to a linked world. Archive it instead of deleting it.`,
        code: "spatial_shared_world_location_removal_forbidden",
      });
    }
    const document = await persistence.documents.update({
      id: source.world.id,
      packageId: SPATIAL_SHARED_WORLD_PACKAGE_ID,
      expectedRevision: source.world.revision,
      name: source.world.name,
      description: source.world.description,
      data: createSpatialSharedWorldData(input.data.definition, input.data.hierarchyProfile),
      updatedAt: now(),
    });
    if (!document) {
      return reply.status(409).send({
        error: "The shared world changed while publishing. Reload before trying again.",
        code: "spatial_shared_world_conflict",
      });
    }
    const { draft: _draft, ...link } = source.link;
    await persistence.updateChatMetadata({
      chatId: chat.id,
      metadata: withSpatialSharedWorldLink(parseSpatialMetadata(chat.metadata), link),
      updatedAt: now(),
    });
    const linkedChatCount = (await linkedChatIdsForSpatialWorld(persistence, source.world.id)).length;
    return {
      world: readSpatialSharedWorldDocument(document, linkedChatCount),
      spatial: await service.get(chat.id),
    };
  });

  app.post("/spatial-context/templates/generate", async (request, reply) => {
    const body = isRecord(request.body) ? request.body : {};
    const targetLocationCountResult =
      body.targetLocationCount === undefined
        ? null
        : spatialCustomTargetLocationSchema.safeParse(body.targetLocationCount);
    const parsed = generateSpatialMapDraftRequestSchema.safeParse(
      withoutKeys(body, [
        "hierarchyMode",
        "hierarchyProfile",
        "generationPreferencesOverride",
        "targetLocationCount",
        "breakHistoryContinuity",
      ]),
    );
    const hierarchyMode = z.enum(["auto", "template", "custom"]).safeParse(body.hierarchyMode ?? "auto");
    const requestedProfile =
      body.hierarchyProfile === undefined ? null : spatialHierarchyProfileSchema.safeParse(body.hierarchyProfile);
    const preferenceOverride =
      body.generationPreferencesOverride === undefined
        ? null
        : spatialGenerationPreferencesSchema.safeParse(body.generationPreferencesOverride);
    if (
      !parsed.success ||
      (targetLocationCountResult && !targetLocationCountResult.success) ||
      parsed.data.operation !== "create" ||
      !hierarchyMode.success ||
      (requestedProfile && !requestedProfile.success) ||
      (preferenceOverride && !preferenceOverride.success)
    ) {
      return reply.status(400).send({
        error: "A new map template needs a valid create-map request.",
        code: "spatial_map_template_generation_invalid",
      });
    }

    const groundingMode = parsed.data.groundingMode;
    const loreCatalog = await buildSpatialLoreCatalog(
      resources,
      groundingMode,
      parsed.data.sourceLorebookIds,
      parsed.data.sourceEntryIds,
      { excludedLorebookIds: [], excludedSourceAgentIds: [] },
    );
    if (groundingMode !== "setup" && loreCatalog.grounding.consideredEntryCount === 0) {
      return reply.status(400).send({
        error: "None of the selected lore entries are available.",
        code: "spatial_ai_lore_sources_unavailable",
      });
    }

    const agentSettings: Record<string, unknown> = await getPackageAgentSettings("hierarchical-maps").catch(
      (): Record<string, unknown> => ({}),
    );
    const libraries = parseSpatialGenerationPromptLibraries(
      agentSettings[SPATIAL_GENERATION_PROMPT_LIBRARIES_SETTINGS_KEY],
    );
    const preferences = preferenceOverride?.success
      ? preferenceOverride.data
      : generationPreferencesWithPromptLibrary(
          libraries?.roleplay,
          defaultGenerationPreferences("roleplay"),
          "roleplay",
        );
    const promptOption = resolveSpatialGenerationPromptOption(preferences);
    let prompt;
    try {
      prompt = buildSpatialMapDraftPrompt({
        ownerMode: "roleplay",
        size: parsed.data.size,
        targetLocations: targetLocationCountResult?.success ? targetLocationCountResult.data : undefined,
        groundingMode,
        loreCatalog: loreCatalog.prompt,
        sourceContext: "{}",
        instructions: parsed.data.instructions,
        requiredLocationNames: [],
        hierarchyMode: hierarchyMode.data,
        hierarchyProfile: requestedProfile?.success ? requestedProfile.data : undefined,
        creatorGuidance: promptOption.guidance,
        promptVariables: spatialGenerationCustomVariableValues(promptOption),
        promptTemplates: promptOption.prompts,
      });
    } catch (error) {
      return reply.status(400).send({
        error: error instanceof Error ? error.message : "The map template prompt is invalid.",
        code: "spatial_map_template_generation_invalid",
      });
    }

    let resolved;
    try {
      const agentConnectionId = await getPackageAgentConnectionId("hierarchical-maps");
      resolved = await languageModels.resolve(parsed.data.connectionId ?? agentConnectionId);
    } catch (error) {
      return reply.status(400).send({
        error: error instanceof Error ? error.message : "Choose a Maps language model connection first.",
        code: "spatial_ai_connection_invalid",
      });
    }

    const debugOverrideEnabled = parsed.data.debugMode || isDebugAgentsEnabled();
    logDebugOverride(
      debugOverrideEnabled,
      "[debug/spatial/map-template] final prompt model=%s:\n%s",
      resolved.model,
      JSON.stringify(prompt.messages, null, 2),
    );

    try {
      const result = await resolved.chatComplete(prompt.messages, {
        temperature: 0.55,
        maxTokens: prompt.maxTokens,
        debugMode: debugOverrideEnabled,
      });
      const raw = result.content?.trim();
      if (!raw) throw new Error("The model returned an empty response.");
      logDebugOverride(
        debugOverrideEnabled,
        "[debug/spatial/map-template] raw response chars=%d:\n%s",
        raw.length,
        raw,
      );
      const parsedResponse = await parseSpatialMapJsonWithRepair({
        raw,
        finishReason: result.finishReason,
        parse: json.parseJsonish,
        repair: spatialMapJsonRepairRequest(resolved, prompt.maxTokens, debugOverrideEnabled),
      });
      if (!parsedResponse.ok) {
        const payload = spatialMapJsonErrorPayload(parsedResponse);
        logger.warn(
          "[spatial/map-template] Model response was not valid JSON (finishReason=%s chars=%d parser=%s kind=%s repairAttempted=%s)",
          parsedResponse.primaryFailure.finishReason,
          parsedResponse.primaryFailure.responseLength,
          parsedResponse.primaryFailure.parserDetail,
          parsedResponse.failure.kind,
          parsedResponse.repairAttempted,
        );
        return reply.status(502).send(payload);
      }
      const parsedPlan = parsedResponse.value;
      if (parsedResponse.repaired) {
        logger.warn(
          "[spatial/map-template] Repaired malformed JSON (finishReason=%s chars=%d parser=%s)",
          parsedResponse.primaryFailure?.finishReason ?? "unknown",
          parsedResponse.primaryFailure?.responseLength ?? raw.length,
          parsedResponse.primaryFailure?.parserDetail ?? "unknown",
        );
      }
      const definition = normalizeSpatialMapPlan(parsedPlan, {
        ownerMode: "roleplay",
        revision: 0,
        enabled: false,
        size: parsed.data.size,
        targetLocations: targetLocationCountResult?.success ? targetLocationCountResult.data : undefined,
        sourceEntryIdsByKey: loreCatalog.sourceEntryIdsByKey,
        requireLoreSource: groundingMode === "lore_strict",
        requiredLocationNames: [],
      });
      const hierarchyProfile = normalizeHierarchyProfile(
        readSpatialHierarchyProfile(
          parsedPlan,
          definition.locations,
          requestedProfile?.success ? requestedProfile.data : undefined,
        ),
        definition,
      );
      const provenance = buildSpatialMapProvenance(parsedPlan, definition.locations, loreCatalog, groundingMode);
      logger.info(
        "[spatial/map-template] Generated %d template locations with model %s",
        definition.locations.length,
        resolved.model,
      );
      return {
        definition,
        operation: "create",
        size: parsed.data.size,
        source: "roleplay_setup",
        generatedLocationCount: definition.locations.length,
        ...(provenance ? { provenance } : {}),
        grounding: loreCatalog.grounding,
        hierarchyProfile,
      } satisfies GenerateSpatialMapDraftResponse & {
        hierarchyProfile: SpatialHierarchyProfile;
      };
    } catch (error) {
      logger.error(error, "[spatial/map-template] Generation failed");
      return reply.status(502).send({
        error:
          "The AI could not create a valid map template. Try again, add clearer instructions, or choose a smaller size.",
        code: "spatial_ai_generation_failed",
      });
    }
  });

  const prepareSpatialMapPrompt = async (
    chatId: string,
    requestBody: unknown,
    options: {
      allowDraftPreviewWithExistingMap?: boolean;
    } = {},
  ) => {
    const body = isRecord(requestBody) ? requestBody : {};
    if (body.promptOverride !== undefined) {
      throw new SpatialMapPromptRequestError(
        400,
        "spatial_ai_prompt_override_unsupported",
        "Per-request prompt replacement is not supported. Use a validated map generation prompt option instead.",
      );
    }
    const targetLocationCountResult =
      body.targetLocationCount === undefined
        ? null
        : spatialCustomTargetLocationSchema.safeParse(body.targetLocationCount);
    if (targetLocationCountResult && !targetLocationCountResult.success) {
      throw new SpatialMapPromptRequestError(
        400,
        "spatial_ai_request_invalid",
        targetLocationCountResult.error.issues[0]?.message ?? "The custom location target is invalid.",
        targetLocationCountResult.error.issues,
      );
    }
    const targetLocationCount = targetLocationCountResult?.success ? targetLocationCountResult.data : undefined;
    const parsed = generateSpatialMapDraftRequestSchema.safeParse(
      withoutKeys(body, [
        "hierarchyMode",
        "hierarchyProfile",
        "generationPreferencesOverride",
        "targetLocationCount",
        "breakHistoryContinuity",
      ]),
    );
    if (!parsed.success) {
      throw new SpatialMapPromptRequestError(
        400,
        "spatial_ai_request_invalid",
        parsed.error.issues[0]?.message ?? "Invalid map generation request.",
        parsed.error.issues,
      );
    }
    const generationPreferencesOverride =
      body.generationPreferencesOverride === undefined
        ? null
        : spatialGenerationPreferencesSchema.safeParse(body.generationPreferencesOverride);
    if (generationPreferencesOverride && !generationPreferencesOverride.success) {
      throw new SpatialMapPromptRequestError(
        400,
        "spatial_ai_prompt_template_override_invalid",
        generationPreferencesOverride.error.issues[0]?.message ?? "The edited generation prompt preference is invalid.",
        generationPreferencesOverride.error.issues,
      );
    }
    const hierarchyMode = z.enum(["auto", "template", "custom"]).safeParse(body.hierarchyMode ?? "auto");
    if (!hierarchyMode.success) {
      throw new SpatialMapPromptRequestError(
        400,
        "spatial_ai_request_invalid",
        "Choose Auto, Template, or Custom hierarchy mode.",
      );
    }
    const requestedProfileResult =
      body.hierarchyProfile === undefined ? null : spatialHierarchyProfileSchema.safeParse(body.hierarchyProfile);
    if (requestedProfileResult && !requestedProfileResult.success) {
      throw new SpatialMapPromptRequestError(
        400,
        "spatial_ai_request_invalid",
        requestedProfileResult.error.issues[0]?.message ?? "Invalid hierarchy profile.",
        requestedProfileResult.error.issues,
      );
    }

    const spatial = await service.get(chatId);
    const chat = await persistence.getChat(chatId);
    if (!chat) {
      throw new SpatialMapPromptRequestError(404, "spatial_chat_missing", "Chat not found.");
    }
    const ownerMode = chat.mode as SpatialOwnerMode;
    const operation = parsed.data.operation;
    const existingDefinition = spatial.definition;
    const requestedHierarchyProfile: SpatialHierarchyProfile | undefined =
      operation === "expand"
        ? spatial.hierarchyProfile
        : requestedProfileResult?.success
          ? requestedProfileResult.data
          : undefined;
    const hasExistingMap = Boolean(existingDefinition?.locations.length);
    if (operation === "create" && hasExistingMap && !options.allowDraftPreviewWithExistingMap) {
      throw new SpatialMapPromptRequestError(
        409,
        "spatial_ai_map_already_exists",
        "This chat already has a world map. Expand it, or replace it before campaign history begins.",
      );
    }
    if (operation === "replace" && !hasExistingMap) {
      throw new SpatialMapPromptRequestError(
        409,
        "spatial_ai_map_missing",
        "There is no existing map to replace. Create the first map instead.",
      );
    }
    if (
      operation === "replace" &&
      spatial.hasCommittedSpatialHistory &&
      body.breakHistoryContinuity !== true
    ) {
      throw new SpatialMapPromptRequestError(
        409,
        "spatial_ai_replacement_protected",
        "Campaign history uses this map. Expand it instead of replacing existing location IDs.",
      );
    }
    if (operation === "expand" && !hasExistingMap) {
      throw new SpatialMapPromptRequestError(
        409,
        "spatial_ai_map_missing",
        "Create the first map before expanding it.",
      );
    }
    if (
      operation === "expand" &&
      !existingDefinition?.locations.some(
        (location) => location.id === parsed.data.targetLocationId && location.status === "active",
      )
    ) {
      throw new SpatialMapPromptRequestError(400, "spatial_ai_target_invalid", "Choose an active location to expand.");
    }

    const gameMapReference =
      ownerMode === "game" && operation !== "expand"
        ? buildGameMapDraftReference(parseSpatialMetadata(chat.metadata))
        : null;
    const requiredLocationNames = gameMapReference?.requiredLocationNames ?? [];
    const draftSize = resolveSpatialDraftSizeSpec(parsed.data.size, targetLocationCount);
    if (gameMapReference?.truncated) {
      throw new SpatialMapPromptRequestError(
        409,
        "spatial_ai_game_map_reference_too_large",
        "The accepted Game maps are too large to include safely in one hierarchy draft. Reconcile them manually so no locations or connections are silently omitted.",
      );
    }
    if (requiredLocationNames.length > draftSize.maxLocations) {
      throw new SpatialMapPromptRequestError(
        409,
        "spatial_ai_game_map_too_large",
        `The accepted Game map has ${requiredLocationNames.length} named locations, but the ${parsed.data.size} hierarchy can preserve at most ${draftSize.maxLocations}. Choose a larger draft size or reconcile the maps manually.`,
      );
    }

    const sourceContext = await buildDraftSourceContext(chat, resources, gameMapReference);
    const generationPreferences = generationPreferencesOverride?.data ?? spatial.generationPreferences;
    const generationPromptOption = resolveSpatialGenerationPromptOption(generationPreferences);
    const groundingMode = parsed.data.groundingMode;
    const lorebookScopeExclusions = resolveLorebookScopeExclusions(chat.mode, parseSpatialMetadata(chat.metadata));
    const loreCatalog = await buildSpatialLoreCatalog(
      resources,
      groundingMode,
      parsed.data.sourceLorebookIds,
      parsed.data.sourceEntryIds,
      lorebookScopeExclusions,
    );
    if (groundingMode !== "setup" && loreCatalog.grounding.consideredEntryCount === 0) {
      throw new SpatialMapPromptRequestError(
        400,
        "spatial_ai_lore_sources_unavailable",
        "None of the selected lore entries are available. Check disabled books, entries, folders, or chat exclusions.",
      );
    }

    let prompt;
    try {
      prompt =
        operation === "expand"
          ? buildSpatialMapExpansionPrompt({
              definition: existingDefinition!,
              targetLocationId: parsed.data.targetLocationId!,
              size: parsed.data.size,
              targetLocations: targetLocationCount,
              groundingMode,
              loreCatalog: loreCatalog.prompt,
              sourceContext,
              instructions: parsed.data.instructions,
              hierarchyProfile: requestedHierarchyProfile,
              creatorGuidance: generationPromptOption.guidance,
              promptVariables: spatialGenerationCustomVariableValues(generationPromptOption),
              promptTemplates: generationPromptOption.prompts,
            })
          : buildSpatialMapDraftPrompt({
              ownerMode,
              size: parsed.data.size,
              targetLocations: targetLocationCount,
              groundingMode,
              loreCatalog: loreCatalog.prompt,
              sourceContext,
              instructions: parsed.data.instructions,
              requiredLocationNames,
              hierarchyMode: hierarchyMode.data,
              hierarchyProfile: requestedHierarchyProfile,
              creatorGuidance: generationPromptOption.guidance,
              promptVariables: spatialGenerationCustomVariableValues(generationPromptOption),
              promptTemplates: generationPromptOption.prompts,
            });
    } catch (error) {
      throw new SpatialMapPromptRequestError(
        409,
        "spatial_ai_expansion_unavailable",
        error instanceof Error ? error.message : "This location cannot be expanded.",
      );
    }

    return {
      request: parsed.data,
      ...(targetLocationCount === undefined ? {} : { targetLocationCount }),
      spatial,
      chat,
      ownerMode,
      operation,
      existingDefinition,
      requestedHierarchyProfile,
      requiredLocationNames,
      groundingMode,
      loreCatalog,
      prompt,
    };
  };

  app.get<{ Params: ChatSpatialParams }>("/:chatId/spatial-context", async (req, reply) => {
    try {
      return await service.get(req.params.chatId);
    } catch (error) {
      return sendServiceError(reply, error);
    }
  });

  app.put<{ Params: ChatSpatialParams }>("/:chatId/spatial-context/generation-preferences", async (req, reply) => {
    const parsed = spatialGenerationPreferencesSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: parsed.error.issues[0]?.message ?? "Invalid generation prompt preference.",
        code: "spatial_request_invalid",
        issues: parsed.error.issues,
      });
    }
    try {
      return await service.updateGenerationPreferences(req.params.chatId, parsed.data);
    } catch (error) {
      return sendServiceError(reply, error);
    }
  });

  app.get<{ Params: ChatSpatialParams }>(
    "/:chatId/spatial-context/game-map-bindings/reconciliation",
    async (req, reply) => {
      try {
        return await service.getGameMapBindingReconciliation(req.params.chatId);
      } catch (error) {
        return sendServiceError(reply, error);
      }
    },
  );

  app.post<{ Params: ChatSpatialParams }>(
    "/:chatId/spatial-context/game-map-bindings/reconciliation",
    async (req, reply) => {
      const parsed = gameMapBindingReconciliationSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? "Invalid Game map reconciliation.",
          code: "spatial_request_invalid",
          issues: parsed.error.issues,
        });
      }
      try {
        return await service.reconcileGameMapBindings(req.params.chatId, parsed.data);
      } catch (error) {
        return sendServiceError(reply, error);
      }
    },
  );

  app.post<{ Params: ChatSpatialParams }>("/:chatId/spatial-context/turn", async (req, reply) => {
    const parsed = spatialOwnerTurnSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: parsed.error.issues[0]?.message ?? "Invalid spatial owner turn.",
        code: "spatial_request_invalid",
        issues: parsed.error.issues,
      });
    }
    const chat = await persistence.getChat(req.params.chatId);
    if (!chat) return reply.status(404).send({ error: "Chat not found.", code: "spatial_chat_missing" });
    if (chat.mode !== "roleplay") {
      return reply.status(400).send({
        error: "Manual spatial turns are available only in Roleplay chats.",
        code: "spatial_manual_turn_mode_unsupported",
      });
    }
    try {
      const committed = await commitSpatialOwnerTurn({
        chatId: req.params.chatId,
        content: parsed.data.content,
        transition: parsed.data.transition,
        attachments: parsed.data.attachments,
      });
      return {
        message: committed.message,
        spatial: await service.get(req.params.chatId),
        ...(committed.travel ? { travel: committed.travel } : {}),
      };
    } catch (error) {
      if (error instanceof SpatialOwnerTurnError) {
        return reply.status(error.statusCode).send({
          error: error.message,
          code: error.code,
          ...(error.details ?? {}),
        });
      }
      throw error;
    }
  });

  app.get<{ Params: ChatSpatialCommandParams; Querystring: SpatialTurnRecoveryQuery }>(
    "/:chatId/spatial-context/turn/:commandId",
    async (req, reply) => {
    const commandId = z.string().trim().min(1).max(200).safeParse(req.params.commandId);
    if (!commandId.success) {
      return reply.status(400).send({
        error: "Choose a valid movement command.",
        code: "spatial_request_invalid",
      });
    }
    const snapshot = await persistence.spatialSnapshots.getByCommand(req.params.chatId, commandId.data);
    if (!snapshot) {
      return reply.status(404).send({
        error: "This movement command has not been applied.",
        code: "spatial_transition_not_applied",
      });
    }
    let recoveredTravel;
    const hasRecoveryQuery = Object.values(req.query).some((value) => value !== undefined);
    if (hasRecoveryQuery) {
      const expectedDefinitionRevision = Number(req.query.expectedDefinitionRevision);
      const parsedTransition = pendingSpatialTransitionSchema.safeParse({
        destinationId: req.query.destinationId,
        ...(req.query.travelMode ? { travelMode: req.query.travelMode } : {}),
        expectedDefinitionRevision,
        expectedCurrentLocationId: req.query.expectedCurrentLocationId ?? null,
        commandId: commandId.data,
      });
      if (!parsedTransition.success) {
        return reply.status(400).send({
          error: parsedTransition.error.issues[0]?.message ?? "Invalid movement recovery request.",
          code: "spatial_request_invalid",
          issues: parsedTransition.error.issues,
        });
      }
      try {
        const applied = await findAppliedSpatialOwnerTurn({
          chatId: req.params.chatId,
          transition: parsedTransition.data,
        });
        recoveredTravel = applied?.travel;
      } catch (error) {
        if (error instanceof SpatialOwnerTurnError) {
          return reply.status(error.statusCode).send({
            error: error.message,
            code: error.code,
            ...(error.details ?? {}),
          });
        }
        throw error;
      }
    }
    return {
      applied: true,
      messageId: snapshot.messageId,
      currentLocationId: snapshot.currentLocationId,
      definitionRevision: snapshot.definitionRevision,
      ...(recoveredTravel ? { travel: recoveredTravel } : {}),
    };
    },
  );

  app.put<{ Params: ChatSpatialParams }>("/:chatId/spatial-context", async (req, reply) => {
    const body = isRecord(req.body) ? req.body : {};
    const parsed = updateSpatialContextRequestSchema.safeParse(withoutKeys(body, ["hierarchyProfile"]));
    if (!parsed.success) {
      return reply.status(400).send({
        error: parsed.error.issues[0]?.message ?? "Invalid world map.",
        code: "spatial_request_invalid",
        issues: parsed.error.issues,
      });
    }
    const parsedHierarchyProfile =
      body.hierarchyProfile === undefined ? null : spatialHierarchyProfileSchema.safeParse(body.hierarchyProfile);
    if (parsedHierarchyProfile && !parsedHierarchyProfile.success) {
      return reply.status(400).send({
        error: parsedHierarchyProfile.error.issues[0]?.message ?? "Invalid hierarchy profile.",
        code: "spatial_request_invalid",
        issues: parsedHierarchyProfile.error.issues,
      });
    }

    try {
      return await service.update(req.params.chatId, {
        ...parsed.data,
        ...(parsedHierarchyProfile?.success ? { hierarchyProfile: parsedHierarchyProfile.data } : {}),
      });
    } catch (error) {
      return sendServiceError(reply, error);
    }
  });

  app.post<{ Params: ChatSpatialParams }>("/:chatId/spatial-context/start-over", async (req, reply) => {
    const body = isRecord(req.body) ? req.body : {};
    if (body.breakHistoryContinuity !== true) {
      return reply.status(400).send({
        error: "Confirm that starting over may break historical map links.",
        code: "spatial_start_over_confirmation_required",
      });
    }
    const parsed = updateSpatialContextRequestSchema.safeParse(
      withoutKeys(body, ["hierarchyProfile", "breakHistoryContinuity"]),
    );
    if (!parsed.success) {
      return reply.status(400).send({
        error: parsed.error.issues[0]?.message ?? "Invalid replacement world map.",
        code: "spatial_request_invalid",
        issues: parsed.error.issues,
      });
    }
    if (parsed.data.replacementCurrentLocationId !== parsed.data.definition.startingLocationId) {
      return reply.status(400).send({
        error: "Starting over must move the story to the new map's starting location.",
        code: "spatial_start_over_location_invalid",
      });
    }
    const parsedHierarchyProfile =
      body.hierarchyProfile === undefined ? null : spatialHierarchyProfileSchema.safeParse(body.hierarchyProfile);
    if (parsedHierarchyProfile && !parsedHierarchyProfile.success) {
      return reply.status(400).send({
        error: parsedHierarchyProfile.error.issues[0]?.message ?? "Invalid hierarchy profile.",
        code: "spatial_request_invalid",
        issues: parsedHierarchyProfile.error.issues,
      });
    }

    try {
      return await service.update(
        req.params.chatId,
        {
          ...parsed.data,
          ...(parsedHierarchyProfile?.success ? { hierarchyProfile: parsedHierarchyProfile.data } : {}),
        },
        { detachSharedWorld: true, breakHistoryContinuity: true },
      );
    } catch (error) {
      return sendServiceError(reply, error);
    }
  });

  app.post<{ Params: ChatSpatialParams }>("/:chatId/spatial-context/generation-prompt/preview", async (req, reply) => {
    try {
      const prepared = await prepareSpatialMapPrompt(req.params.chatId, req.body, {
        allowDraftPreviewWithExistingMap: true,
      });
      return {
        ownerMode: prepared.ownerMode,
        operation: prepared.operation,
        size: prepared.request.size,
        maxTokens: prepared.prompt.maxTokens,
        containsPrivateContext: true,
        system: prepared.prompt.messages.find((message) => message.role === "system")?.content ?? "",
        user: prepared.prompt.messages.find((message) => message.role === "user")?.content ?? "",
      };
    } catch (error) {
      return sendPromptRequestError(reply, error);
    }
  });

  app.post<{ Params: ChatSpatialParams }>("/:chatId/spatial-context/generate", async (req, reply) => {
    let prepared;
    try {
      prepared = await prepareSpatialMapPrompt(req.params.chatId, req.body);
    } catch (error) {
      return sendPromptRequestError(reply, error);
    }
    const {
      request: parsed,
      targetLocationCount,
      spatial,
      chat,
      ownerMode,
      operation,
      existingDefinition,
      requestedHierarchyProfile,
      requiredLocationNames,
      groundingMode,
      loreCatalog,
    } = prepared;
    const prompt = prepared.prompt;

    let resolved;
    try {
      const agentConnectionId = await getPackageAgentConnectionId("hierarchical-maps").catch((error) => {
        logger.warn(
          "Could not read the World Maps connection override; using the chat connection: %s",
          error instanceof Error ? error.message : String(error),
        );
        return null;
      });
      resolved = await languageModels.resolve(parsed.connectionId ?? agentConnectionId ?? chat.connectionId);
    } catch (error) {
      return reply.status(400).send({
        error: error instanceof Error ? error.message : "A language model connection is required.",
        code: "spatial_ai_connection_invalid",
      });
    }

    const debugOverrideEnabled = parsed.debugMode || isDebugAgentsEnabled();
    logDebugOverride(
      debugOverrideEnabled,
      "[debug/spatial/map-draft] final prompt chatId=%s model=%s:\n%s",
      chat.id,
      resolved.model,
      JSON.stringify(prompt.messages, null, 2),
    );

    try {
      const result = await resolved.chatComplete(prompt.messages, {
        temperature: 0.55,
        maxTokens: prompt.maxTokens,
        debugMode: debugOverrideEnabled,
      });
      const raw = result.content?.trim();
      if (!raw) {
        return reply.status(502).send({
          error: "The model returned an empty response. Try again, or check that the selected connection is working.",
          code: "spatial_ai_generation_failed",
        });
      }
      logDebugOverride(
        debugOverrideEnabled,
        "[debug/spatial/map-draft] raw response chatId=%s chars=%d:\n%s",
        chat.id,
        raw.length,
        raw,
      );
      const parsedResponse = await parseSpatialMapJsonWithRepair({
        raw,
        finishReason: result.finishReason,
        parse: json.parseJsonish,
        repair: spatialMapJsonRepairRequest(resolved, prompt.maxTokens, debugOverrideEnabled),
      });
      if (!parsedResponse.ok) {
        const payload = spatialMapJsonErrorPayload(parsedResponse);
        logger.warn(
          "[spatial/map-draft] Model response was not valid JSON for chat %s (finishReason=%s chars=%d parser=%s kind=%s repairAttempted=%s)",
          chat.id,
          parsedResponse.primaryFailure.finishReason,
          parsedResponse.primaryFailure.responseLength,
          parsedResponse.primaryFailure.parserDetail,
          parsedResponse.failure.kind,
          parsedResponse.repairAttempted,
        );
        return reply.status(502).send(payload);
      }
      const parsedPlan = parsedResponse.value;
      if (parsedResponse.repaired) {
        logger.warn(
          "[spatial/map-draft] Repaired malformed JSON for chat %s (finishReason=%s chars=%d parser=%s)",
          chat.id,
          parsedResponse.primaryFailure?.finishReason ?? "unknown",
          parsedResponse.primaryFailure?.responseLength ?? raw.length,
          parsedResponse.primaryFailure?.parserDetail ?? "unknown",
        );
      }
      let definition: SpatialContextDefinition;
      try {
        definition =
          operation === "expand"
            ? normalizeSpatialMapExpansionPlan(parsedPlan, {
                definition: existingDefinition!,
                targetLocationId: parsed.targetLocationId!,
                sourceEntryIdsByKey: loreCatalog.sourceEntryIdsByKey,
                requireLoreSource: groundingMode === "lore_strict",
                size: parsed.size,
                targetLocations: targetLocationCount,
              })
            : normalizeSpatialMapPlan(parsedPlan, {
                ownerMode,
                revision: existingDefinition?.revision ?? 0,
                enabled: existingDefinition?.enabled ?? false,
                size: parsed.size,
                targetLocations: targetLocationCount,
                sourceEntryIdsByKey: loreCatalog.sourceEntryIdsByKey,
                requireLoreSource: groundingMode === "lore_strict",
                requiredLocationNames,
              });
      } catch (normalizeError) {
        logger.warn(
          "[spatial/map-draft] Draft did not match the map structure for chat %s: %s",
          chat.id,
          normalizeError instanceof Error ? normalizeError.message : String(normalizeError),
        );
        return reply.status(502).send({
          error:
            normalizeError instanceof Error && normalizeError.message
              ? `The model's map draft could not be used: ${normalizeError.message}`
              : "The model returned JSON that did not match the required map structure. Try again or add clearer instructions.",
          code: "spatial_ai_generation_failed",
        });
      }
      const generatedLocationCount =
        operation === "expand"
          ? definition.locations.length - existingDefinition!.locations.length
          : definition.locations.length;
      const generatedLocations =
        operation === "expand"
          ? definition.locations.slice(existingDefinition!.locations.length)
          : definition.locations;
      const generatedHierarchyProfile = readSpatialHierarchyProfile(
        parsedPlan,
        generatedLocations,
        requestedHierarchyProfile,
      );
      const hierarchyProfile =
        operation === "expand"
          ? normalizeHierarchyProfile(
              {
                ...spatial.hierarchyProfile,
                locationTypeIds: {
                  ...spatial.hierarchyProfile.locationTypeIds,
                  ...generatedHierarchyProfile.locationTypeIds,
                },
              },
              definition,
            )
          : normalizeHierarchyProfile(generatedHierarchyProfile, definition);
      const provenance = buildSpatialMapProvenance(parsedPlan, generatedLocations, loreCatalog, groundingMode);
      logger.info(
        "[spatial/map-draft] Generated %d %s locations for chat %s with model %s",
        generatedLocationCount,
        operation,
        chat.id,
        resolved.model,
      );
      return {
        definition,
        operation,
        size: parsed.size,
        source: ownerMode === "game" ? "game_setup" : "roleplay_setup",
        generatedLocationCount,
        ...(operation === "expand" ? { targetLocationId: parsed.targetLocationId } : {}),
        ...(provenance ? { provenance } : {}),
        grounding: loreCatalog.grounding,
        hierarchyProfile,
      } satisfies GenerateSpatialMapDraftResponse & {
        hierarchyProfile: SpatialHierarchyProfile;
      };
    } catch (error) {
      logger.error(error, "[spatial/map-draft] Generation failed for chat %s", chat.id);
      return reply.status(502).send({
        error:
          "The AI could not create a valid map draft. Try again, add clearer instructions, or choose a smaller size.",
        code: "spatial_ai_generation_failed",
      });
    }
  });
}
