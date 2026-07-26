import {
  buildSpatialLocationIndex,
  resolveSpatialBreadcrumb,
  resolveSpatialDestinations,
  spatialContextDefinitionSchema,
  type CapabilityPersistenceSession,
  type SpatialContextDefinition,
  type SpatialContextResponse,
  type UpdateSpatialContextRequestInput,
} from "@marinara-engine/shared";
import { getPackagePersistence, logger, now } from "./package-runtime.js";
import { createSpatialContextStorage } from "../storage/spatial-context.storage.js";
import { resolveEffectiveSpatialState } from "./state-resolution.js";
import { parseSpatialMetadata } from "./metadata.js";
import {
  applyGameMapBindingReconciliation,
  bindGameMapsToExactSpatialLocations,
  buildGameMapBindingReconciliationPreview,
  GameMapBindingError,
  type GameMapBindingReconciliationSelection,
} from "./game-map-binding.js";
import {
  defaultGenerationPreferences,
  normalizeGenerationPreferences,
  normalizeHierarchyProfile,
  spatialGenerationPreferencesSchema,
  type MapsSpatialContextResponse,
  type SpatialGenerationPreferences,
  type SpatialHierarchyProfile,
} from "../../../../maps-shared/src/maps-model.js";

const METADATA_KEY = "spatialContext";
const HIERARCHY_PROFILE_KEY = "spatialContextHierarchyProfile";
const GENERATION_PREFERENCES_KEY = "spatialMapGenerationPreferences";

export type SpatialContextServiceErrorCode =
  | "chat_not_found"
  | "spatial_mode_unsupported"
  | "spatial_definition_corrupt"
  | "spatial_definition_stale"
  | "spatial_current_location_stale"
  | "spatial_replacement_required"
  | "spatial_replacement_invalid"
  | "spatial_history_location_removal_forbidden"
  | "spatial_game_map_reconciliation_unavailable"
  | "spatial_game_map_reconciliation_stale";

export class SpatialContextServiceError extends Error {
  constructor(
    readonly code: SpatialContextServiceErrorCode,
    message: string,
    readonly statusCode: 400 | 404 | 409,
  ) {
    super(message);
    this.name = "SpatialContextServiceError";
  }
}

function readDefinition(metadata: Record<string, unknown>): {
  definition: SpatialContextDefinition | null;
  corrupt: boolean;
} {
  if (metadata[METADATA_KEY] === undefined || metadata[METADATA_KEY] === null) {
    return { definition: null, corrupt: false };
  }
  const parsed = spatialContextDefinitionSchema.safeParse(metadata[METADATA_KEY]);
  return parsed.success
    ? { definition: parsed.data as SpatialContextDefinition, corrupt: false }
    : { definition: null, corrupt: true };
}
function assertSupportedMode(mode: string | null): asserts mode is "roleplay" | "game" {
  if (mode !== "roleplay" && mode !== "game") {
    throw new SpatialContextServiceError(
      "spatial_mode_unsupported",
      "Hierarchical maps are available only in Roleplay and Game chats.",
      400,
    );
  }
}

function buildResponse(
  definition: SpatialContextDefinition | null,
  currentLocationId: string | null,
  corrupt = false,
  hasCommittedSpatialHistory = false,
  referenceWarnings: SpatialContextResponse["warnings"] = [],
  hierarchyProfile: SpatialHierarchyProfile = normalizeHierarchyProfile(null, definition),
  generationPreferences: SpatialGenerationPreferences = defaultGenerationPreferences(),
): MapsSpatialContextResponse {
  if (!definition) {
    return {
      definition: null,
      currentLocationId: null,
      breadcrumb: [],
      destinations: [],
      hasCommittedSpatialHistory,
      warnings: corrupt
        ? [
            {
              code: "stored_definition_invalid",
              message: "The stored hierarchical map is invalid and has been disabled.",
              path: [METADATA_KEY],
            },
          ]
        : [],
      hierarchyProfile,
      generationPreferences,
    };
  }

  const byId = buildSpatialLocationIndex(definition);
  const current = currentLocationId === null ? undefined : byId.get(currentLocationId);
  const effectiveCurrentId = current?.id ?? null;
  return {
    definition,
    currentLocationId: effectiveCurrentId,
    breadcrumb: resolveSpatialBreadcrumb(definition, effectiveCurrentId).map(({ id, name }) => ({ id, name })),
    destinations: resolveSpatialDestinations(definition, effectiveCurrentId),
    warnings: referenceWarnings,
    hasCommittedSpatialHistory,
    hierarchyProfile,
    generationPreferences,
  };
}

function readGenerationPreferences(
  metadata: Record<string, unknown>,
  ownerMode: "roleplay" | "game",
): SpatialGenerationPreferences {
  return normalizeGenerationPreferences(metadata[GENERATION_PREFERENCES_KEY], ownerMode);
}

async function resolveLoreReferenceWarnings(
  definition: SpatialContextDefinition,
  persistence: Pick<CapabilityPersistenceSession, "listExistingLorebookEntryIds">,
): Promise<SpatialContextResponse["warnings"]> {
  const entryIds = Array.from(
    new Set(definition.locations.flatMap((location) => location.lorebookEntryIds ?? [])),
  );
  if (entryIds.length === 0) return [];
  const existingIds = new Set(await persistence.listExistingLorebookEntryIds(entryIds));
  return definition.locations.flatMap((location, locationIndex) =>
    (location.lorebookEntryIds ?? []).flatMap((entryId, entryIndex) =>
      existingIds.has(entryId)
        ? []
        : [
            {
              code: "lorebook_entry_missing" as const,
              message: `Linked lore entry ${entryId} no longer exists. Detach it or import the missing lorebook.`,
              path: ["locations", locationIndex, "lorebookEntryIds", entryIndex],
              locationId: location.id,
            },
          ],
    ),
  );
}

export function createSpatialContextService() {
  const persistence = getPackagePersistence();
  return {
    async get(chatId: string): Promise<MapsSpatialContextResponse> {
      const chat = await persistence.getChat(chatId);
      if (!chat) throw new SpatialContextServiceError("chat_not_found", "Chat not found.", 404);
      assertSupportedMode(chat.mode);

      const hasCommittedSpatialHistory = await createSpatialContextStorage(persistence).hasMessageSnapshots(chatId);
      const metadata = parseSpatialMetadata(chat.metadata);
      const stored = readDefinition(metadata);
      const hierarchyProfile = normalizeHierarchyProfile(metadata[HIERARCHY_PROFILE_KEY], stored.definition);
      const generationPreferences = readGenerationPreferences(metadata, chat.mode);
      if (!stored.definition) {
        return buildResponse(
          null,
          null,
          stored.corrupt,
          hasCommittedSpatialHistory,
          [],
          hierarchyProfile,
          generationPreferences,
        );
      }

      const state = await resolveEffectiveSpatialState(chatId, {}, persistence);
      return buildResponse(
        stored.definition,
        state.currentLocationId,
        false,
        hasCommittedSpatialHistory,
        await resolveLoreReferenceWarnings(stored.definition, persistence),
        hierarchyProfile,
        generationPreferences,
      );
    },

    async updateGenerationPreferences(
      chatId: string,
      input: SpatialGenerationPreferences,
    ): Promise<SpatialGenerationPreferences> {
      return persistence.withChatLock(chatId, async () => {
        const chat = await persistence.getChat(chatId);
        if (!chat) throw new SpatialContextServiceError("chat_not_found", "Chat not found.", 404);
        assertSupportedMode(chat.mode);
        const parsed = spatialGenerationPreferencesSchema.safeParse(input);
        if (!parsed.success) {
          throw new SpatialContextServiceError(
            "spatial_replacement_invalid",
            parsed.error.issues[0]?.message ?? "The generation prompt preference is invalid.",
            400,
          );
        }
        const metadata = parseSpatialMetadata(chat.metadata);
        await persistence.updateChatMetadata({
          chatId,
          metadata: { ...metadata, [GENERATION_PREFERENCES_KEY]: parsed.data },
          updatedAt: now(),
        });
        return parsed.data;
      });
    },

    async getGameMapBindingReconciliation(chatId: string) {
      const chat = await persistence.getChat(chatId);
      if (!chat) throw new SpatialContextServiceError("chat_not_found", "Chat not found.", 404);
      if (chat.mode !== "game") {
        throw new SpatialContextServiceError(
          "spatial_game_map_reconciliation_unavailable",
          "Game map reconciliation is available only in Game chats.",
          400,
        );
      }
      const metadata = parseSpatialMetadata(chat.metadata);
      const stored = readDefinition(metadata);
      if (stored.corrupt || !stored.definition) {
        throw new SpatialContextServiceError(
          "spatial_game_map_reconciliation_unavailable",
          "Save the hierarchical map before reviewing existing Game map matches.",
          409,
        );
      }
      return buildGameMapBindingReconciliationPreview(metadata, stored.definition);
    },

    async reconcileGameMapBindings(
      chatId: string,
      input: {
        expectedDefinitionRevision: number;
        bindings: GameMapBindingReconciliationSelection[];
      },
    ) {
      return persistence.withChatLock(chatId, async () => {
        const chat = await persistence.getChat(chatId);
        if (!chat) throw new SpatialContextServiceError("chat_not_found", "Chat not found.", 404);
        if (chat.mode !== "game") {
          throw new SpatialContextServiceError(
            "spatial_game_map_reconciliation_unavailable",
            "Game map reconciliation is available only in Game chats.",
            400,
          );
        }
        const metadata = parseSpatialMetadata(chat.metadata);
        const stored = readDefinition(metadata);
        if (stored.corrupt || !stored.definition) {
          throw new SpatialContextServiceError(
            "spatial_game_map_reconciliation_unavailable",
            "Save the hierarchical map before reviewing existing Game map matches.",
            409,
          );
        }
        if (stored.definition.revision !== input.expectedDefinitionRevision) {
          throw new SpatialContextServiceError(
            "spatial_game_map_reconciliation_stale",
            "The hierarchical map changed. Review existing Game map matches again.",
            409,
          );
        }

        let applied;
        try {
          applied = applyGameMapBindingReconciliation(metadata, stored.definition, input.bindings);
        } catch (error) {
          if (error instanceof GameMapBindingError) {
            throw new SpatialContextServiceError("spatial_game_map_reconciliation_stale", error.message, 409);
          }
          throw error;
        }
        if (applied.bindingCount > 0) {
          await persistence.updateChatMetadata({ chatId, metadata: applied.metadata, updatedAt: now() });
          logger.info(
            "[spatial/game-map-binding] Reconciled %d reviewed Game map positions for chat %s",
            applied.bindingCount,
            chatId,
          );
        }
        return {
          ...buildGameMapBindingReconciliationPreview(applied.metadata, stored.definition),
          bindingCount: applied.bindingCount,
        };
      });
    },

    async update(
      chatId: string,
      input: UpdateSpatialContextRequestInput & { hierarchyProfile?: SpatialHierarchyProfile },
    ): Promise<MapsSpatialContextResponse> {
      return persistence.withChatLock(chatId, async () => {
        const chat = await persistence.getChat(chatId);
        if (!chat) throw new SpatialContextServiceError("chat_not_found", "Chat not found.", 404);
        assertSupportedMode(chat.mode);

        const metadata = parseSpatialMetadata(chat.metadata);
        const stored = readDefinition(metadata);
        if (stored.corrupt) {
          throw new SpatialContextServiceError(
            "spatial_definition_corrupt",
            "The stored hierarchical map is invalid and must be repaired before it can be updated.",
            409,
          );
        }

        const currentRevision = stored.definition?.revision ?? 0;
        if (input.expectedRevision !== currentRevision) {
          throw new SpatialContextServiceError(
            "spatial_definition_stale",
            "The hierarchical map changed. Reload it before saving.",
            409,
          );
        }

        const state = await resolveEffectiveSpatialState(chatId, {}, persistence);
        const currentLocationId = state.currentLocationId;
        if (input.expectedCurrentLocationId !== currentLocationId) {
          throw new SpatialContextServiceError(
            "spatial_current_location_stale",
            "The current location changed. Reload the map before saving.",
            409,
          );
        }

        const definition: SpatialContextDefinition = {
          ...(input.definition as SpatialContextDefinition),
          ownerMode: chat.mode,
          revision: currentRevision + 1,
        };
        const hierarchyProfile = normalizeHierarchyProfile(
          input.hierarchyProfile ?? metadata[HIERARCHY_PROFILE_KEY],
          definition,
        );
        const parsedDefinition = spatialContextDefinitionSchema.safeParse(definition);
        if (!parsedDefinition.success) {
          throw new SpatialContextServiceError(
            "spatial_replacement_invalid",
            parsedDefinition.error.issues[0]?.message ?? "The hierarchical map is invalid.",
            400,
          );
        }

        const spatialStorage = createSpatialContextStorage(persistence);
        const hasCommittedSpatialHistory = await spatialStorage.hasMessageSnapshots(chatId);
        if (hasCommittedSpatialHistory && stored.definition) {
          const nextIds = new Set(definition.locations.map((location) => location.id));
          const removedLocation = stored.definition.locations.find((location) => !nextIds.has(location.id));
          if (removedLocation) {
            throw new SpatialContextServiceError(
              "spatial_history_location_removal_forbidden",
              `Campaign history uses this map. Keep ${removedLocation.name || "every existing location"} and archive locations instead of removing them.`,
              409,
            );
          }
        }

        const byId = buildSpatialLocationIndex(definition);
        const currentStillActive = currentLocationId === null || byId.get(currentLocationId)?.status === "active";
        let nextCurrentLocationId = currentLocationId;
        if (!currentStillActive) {
          if (input.replacementCurrentLocationId === undefined) {
            throw new SpatialContextServiceError(
              "spatial_replacement_required",
              "Choose an active replacement before removing or archiving the current location.",
              409,
            );
          }
          nextCurrentLocationId = input.replacementCurrentLocationId;
        }

        if (nextCurrentLocationId !== null && byId.get(nextCurrentLocationId)?.status !== "active") {
          throw new SpatialContextServiceError(
            "spatial_replacement_invalid",
            "The replacement location must exist and be active.",
            400,
          );
        }

        const initialGameMapBindings =
          chat.mode === "game" && !stored.definition && metadata.gameSessionStatus === "ready"
            ? bindGameMapsToExactSpatialLocations(metadata, definition)
            : { metadata, bindingCount: 0 };
        const nextMetadata = {
          ...initialGameMapBindings.metadata,
          [METADATA_KEY]: definition,
          [HIERARCHY_PROFILE_KEY]: hierarchyProfile,
        };
        await persistence.transaction(async (transaction) => {
          await transaction.updateChatMetadata({ chatId, metadata: nextMetadata, updatedAt: now() });

          if (!state.snapshot || nextCurrentLocationId !== currentLocationId) {
            const visibleSnapshot =
              state.snapshot &&
              state.visibleAnchor &&
              state.snapshot.messageId === state.visibleAnchor.messageId &&
              state.snapshot.swipeIndex === state.visibleAnchor.swipeIndex
                ? state.snapshot
                : null;
            const snapshotInput = {
              chatId,
              currentLocationId: nextCurrentLocationId ?? definition.startingLocationId,
              definitionRevision: definition.revision,
              source: state.snapshot || state.visibleAnchor ? ("definition_repair" as const) : ("bootstrap" as const),
              transitionCommandId: visibleSnapshot?.transitionCommandId ?? null,
              transitionPayloadHash: visibleSnapshot?.transitionPayloadHash ?? null,
            };
            const txStorage = createSpatialContextStorage(transaction);
            if (state.visibleAnchor) {
              await txStorage.replaceAtAnchor({
                ...snapshotInput,
                messageId: state.visibleAnchor.messageId,
                swipeIndex: state.visibleAnchor.swipeIndex,
              });
            } else {
              await txStorage.replaceBootstrap(snapshotInput);
            }
          }
        });

        if (initialGameMapBindings.bindingCount > 0) {
          logger.info(
            "[spatial/game-map-binding] Bound %d accepted Game map positions for chat %s",
            initialGameMapBindings.bindingCount,
            chatId,
          );
        }

        return buildResponse(
          definition,
          nextCurrentLocationId ?? definition.startingLocationId,
          false,
          hasCommittedSpatialHistory || Boolean(state.visibleAnchor),
          await resolveLoreReferenceWarnings(definition, persistence),
          hierarchyProfile,
          readGenerationPreferences(metadata, chat.mode),
        );
      });
    },
  };
}
