import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import {
  generateSpatialMapDraftRequestSchema,
  pendingSpatialTransitionSchema,
  updateSpatialContextRequestSchema,
  type CapabilityChatRecord,
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
  SPATIAL_DRAFT_SIZE_SPECS,
} from "../services/spatial-context/ai-draft.js";
import {
  createSpatialContextService,
  SpatialContextServiceError,
} from "../services/spatial-context/definition.service.js";
import { commitSpatialOwnerTurn, SpatialOwnerTurnError } from "../services/spatial-context/owner-turn.js";
import {
  buildGameMapDraftReference,
  type GameMapDraftReference,
} from "../services/spatial-context/game-map-binding.js";
import { parseSpatialMetadata } from "../services/spatial-context/metadata.js";
import {
  getPackageJson,
  getPackageLanguageModels,
  getPackagePersistence,
  getPackageResources,
  isDebugAgentsEnabled,
  logger,
  logDebugOverride,
  updatePackageAgentSettings,
} from "../services/spatial-context/package-runtime.js";
import {
  GENERATION_PROMPT_LIBRARIES_VERSION,
  normalizeHierarchyProfile,
  parseSpatialGenerationPromptLibraries,
  resolveSpatialGenerationPromptOption,
  SPATIAL_GENERATION_PROMPT_LIBRARIES_SETTINGS_KEY,
  SPATIAL_TURN_PROMPT_TEMPLATES_SETTINGS_KEY,
  spatialGenerationCustomVariableValues,
  spatialGenerationPromptLibrarySchema,
  spatialGenerationPreferencesSchema,
  spatialHierarchyProfileSchema,
  spatialTurnPromptTemplatesSchema,
  type SpatialGenerationPromptLibraries,
  type SpatialHierarchyProfile,
} from "../../../maps-shared/src/maps-model.js";

interface ChatSpatialParams {
  chatId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function withoutKeys(value: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const omitted = new Set(keys);
  return Object.fromEntries(Object.entries(value).filter(([key]) => !omitted.has(key)));
}

const GAME_LOREBOOK_KEEPER_SOURCE_ID = "game-lorebook-keeper";

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

  app.put("/spatial-context/global-generation-prompt-libraries/:ownerMode", async (request, reply) => {
    const ownerMode = z.enum(["roleplay", "game"]).safeParse(
      (request.params as { ownerMode?: unknown }).ownerMode,
    );
    const library = spatialGenerationPromptLibrarySchema.safeParse(request.body);
    if (!ownerMode.success || !library.success) {
      return reply.status(400).send({
        error:
          library.success
            ? "Choose Roleplay or Game mode."
            : library.error.issues[0]?.message ?? "The generation prompt library is invalid.",
        code: "spatial_global_generation_prompt_library_invalid",
        ...(!library.success ? { issues: library.error.issues } : {}),
      });
    }

    const settings = await updatePackageAgentSettings("hierarchical-maps", (current) => {
      const existing = parseSpatialGenerationPromptLibraries(
        current[SPATIAL_GENERATION_PROMPT_LIBRARIES_SETTINGS_KEY],
      );
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
    return parseSpatialGenerationPromptLibraries(
      settings[SPATIAL_GENERATION_PROMPT_LIBRARIES_SETTINGS_KEY],
    );
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
    return spatialTurnPromptTemplatesSchema.parse(
      settings[SPATIAL_TURN_PROMPT_TEMPLATES_SETTINGS_KEY],
    );
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
    const parsed = generateSpatialMapDraftRequestSchema.safeParse(
      withoutKeys(body, ["hierarchyMode", "hierarchyProfile", "generationPreferencesOverride"]),
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
        generationPreferencesOverride.error.issues[0]?.message ??
          "The edited generation prompt preference is invalid.",
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
      body.hierarchyProfile === undefined
        ? null
        : spatialHierarchyProfileSchema.safeParse(body.hierarchyProfile);
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
        "This chat already has a hierarchical map. Expand it, or replace it before campaign history begins.",
      );
    }
    if (operation === "replace" && !hasExistingMap) {
      throw new SpatialMapPromptRequestError(
        409,
        "spatial_ai_map_missing",
        "There is no existing map to replace. Create the first map instead.",
      );
    }
    if (operation === "replace" && spatial.hasCommittedSpatialHistory) {
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
      throw new SpatialMapPromptRequestError(
        400,
        "spatial_ai_target_invalid",
        "Choose an active location to expand.",
      );
    }

    const gameMapReference =
      ownerMode === "game" && operation !== "expand"
        ? buildGameMapDraftReference(parseSpatialMetadata(chat.metadata))
        : null;
    const requiredLocationNames = gameMapReference?.requiredLocationNames ?? [];
    const draftSize = SPATIAL_DRAFT_SIZE_SPECS[parsed.data.size];
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

  app.put<{ Params: ChatSpatialParams }>(
    "/:chatId/spatial-context/generation-preferences",
    async (req, reply) => {
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
    },
  );

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

  app.put<{ Params: ChatSpatialParams }>("/:chatId/spatial-context", async (req, reply) => {
    const body = isRecord(req.body) ? req.body : {};
    const parsed = updateSpatialContextRequestSchema.safeParse(withoutKeys(body, ["hierarchyProfile"]));
    if (!parsed.success) {
      return reply.status(400).send({
        error: parsed.error.issues[0]?.message ?? "Invalid hierarchical map.",
        code: "spatial_request_invalid",
        issues: parsed.error.issues,
      });
    }
    const parsedHierarchyProfile =
      body.hierarchyProfile === undefined
        ? null
        : spatialHierarchyProfileSchema.safeParse(body.hierarchyProfile);
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

  app.post<{ Params: ChatSpatialParams }>(
    "/:chatId/spatial-context/generation-prompt/preview",
    async (req, reply) => {
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
    },
  );

  app.post<{ Params: ChatSpatialParams }>("/:chatId/spatial-context/generate", async (req, reply) => {
    let prepared;
    try {
      prepared = await prepareSpatialMapPrompt(req.params.chatId, req.body);
    } catch (error) {
      return sendPromptRequestError(reply, error);
    }
    const {
      request: parsed,
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
      resolved = await languageModels.resolve(parsed.connectionId ?? chat.connectionId);
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
      let parsedPlan: unknown;
      try {
        parsedPlan = json.parseJsonish(raw);
      } catch {
        logger.warn(
          "[spatial/map-draft] Model response was not valid JSON for chat %s (%d chars, likely truncated)",
          chat.id,
          raw.length,
        );
        return reply.status(502).send({
          error:
            "The model's map draft was not valid JSON, most likely because the response was cut off. Raise the connection's Max Output Tokens or choose a smaller map size, then try again.",
          code: "spatial_ai_generation_failed",
        });
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
              })
            : normalizeSpatialMapPlan(parsedPlan, {
                ownerMode,
                revision: existingDefinition?.revision ?? 0,
                enabled: existingDefinition?.enabled ?? false,
                size: parsed.size,
                sourceEntryIdsByKey: loreCatalog.sourceEntryIdsByKey,
                requireLoreSource: groundingMode === "lore_strict",
                requiredLocationNames,
              });
      } catch (normalizeError) {
        logger.warn(normalizeError, "[spatial/map-draft] Draft did not match the map structure for chat %s", chat.id);
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
