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
  clearGameMapSpatialLocationBindings,
  countGameMapBindingsBySpatialLocation,
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
  type SpatialLocationDeletionProtection,
  type SpatialSharedWorldStatus,
} from "../../../../maps-shared/src/maps-model.js";
import {
  independentSpatialWorldStatus,
  resolveSpatialWorldSource,
  withoutSpatialSharedWorldLink,
  withSpatialSharedWorldDraft,
} from "./shared-world.service.js";

const METADATA_KEY = "spatialContext";
const HIERARCHY_PROFILE_KEY = "spatialContextHierarchyProfile";
const GENERATION_PREFERENCES_KEY = "spatialMapGenerationPreferences";

export type SpatialContextServiceErrorCode =
  | "chat_not_found"
  | "spatial_mode_unsupported"
  | "spatial_definition_corrupt"
  | "spatial_definition_stale"
  | "spatial_current_location_stale"
  | "spatial_shared_world_missing"
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

function assertSupportedMode(mode: string | null): asserts mode is "roleplay" | "game" {
  if (mode !== "roleplay" && mode !== "game") {
    throw new SpatialContextServiceError(
      "spatial_mode_unsupported",
      "World maps are available only in Roleplay and Game chats.",
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
  sharedWorld: SpatialSharedWorldStatus = independentSpatialWorldStatus(),
  locationDeletionProtections: SpatialLocationDeletionProtection[] = [],
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
              message: "The stored world map is invalid and has been disabled.",
              path: [METADATA_KEY],
            },
          ]
        : [],
      hierarchyProfile,
      generationPreferences,
      sharedWorld,
      locationDeletionProtections,
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
    sharedWorld,
    locationDeletionProtections,
  };
}

async function resolveLocationDeletionProtections(
  chatId: string,
  metadata: Record<string, unknown>,
  persistence: CapabilityPersistenceSession,
): Promise<SpatialLocationDeletionProtection[]> {
  const historyCounts = new Map<string, number>();
  const snapshots = await createSpatialContextStorage(persistence).listForChat(chatId);
  for (const snapshot of snapshots) {
    if (!snapshot.messageId.trim() || !snapshot.currentLocationId) continue;
    historyCounts.set(snapshot.currentLocationId, (historyCounts.get(snapshot.currentLocationId) ?? 0) + 1);
  }
  const bindingCounts = countGameMapBindingsBySpatialLocation(metadata);
  return [...new Set([...historyCounts.keys(), ...bindingCounts.keys()])].map((locationId) => ({
    locationId,
    historySnapshotCount: historyCounts.get(locationId) ?? 0,
    gameMapBindingCount: bindingCounts.get(locationId) ?? 0,
  }));
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
  const activeLocations = definition.locations.flatMap((location, locationIndex) =>
    location.status === "active" ? [{ location, locationIndex }] : [],
  );
  const entryIds = Array.from(new Set(activeLocations.flatMap(({ location }) => location.lorebookEntryIds ?? [])));
  if (entryIds.length === 0) return [];
  const existingIds = new Set(await persistence.listExistingLorebookEntryIds(entryIds));
  return activeLocations.flatMap(({ location, locationIndex }) =>
    (location.lorebookEntryIds ?? []).flatMap((entryId, entryIndex) =>
      existingIds.has(entryId)
        ? []
        : [
            {
              code: "lorebook_entry_missing" as const,
              message: `“${location.name}” links to a lore entry that was deleted or is unavailable. Open Linked lore for this location and detach the missing entry, or restore/import its lorebook.`,
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
      const stored = await resolveSpatialWorldSource(chat, persistence, {
        includeLinkedChatCount: true,
      });
      const hierarchyProfile = stored.hierarchyProfile;
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
          stored.status,
        );
      }

      const [state, locationDeletionProtections] = await Promise.all([
        resolveEffectiveSpatialState(chatId, {}, persistence),
        resolveLocationDeletionProtections(chatId, metadata, persistence),
      ]);
      return buildResponse(
        stored.definition,
        state.currentLocationId,
        false,
        hasCommittedSpatialHistory,
        await resolveLoreReferenceWarnings(stored.definition, persistence),
        hierarchyProfile,
        generationPreferences,
        stored.status,
        locationDeletionProtections,
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
      const stored = await resolveSpatialWorldSource(chat, persistence, {
        includeLinkedChatCount: true,
      });
      if (stored.corrupt || !stored.definition) {
        throw new SpatialContextServiceError(
          "spatial_game_map_reconciliation_unavailable",
          "Save the world map before reviewing existing Game map matches.",
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
        const stored = await resolveSpatialWorldSource(chat, persistence, {
          includeLinkedChatCount: true,
        });
        if (stored.corrupt || !stored.definition) {
          throw new SpatialContextServiceError(
            "spatial_game_map_reconciliation_unavailable",
            "Save the world map before reviewing existing Game map matches.",
            409,
          );
        }
        if (stored.definition.revision !== input.expectedDefinitionRevision) {
          throw new SpatialContextServiceError(
            "spatial_game_map_reconciliation_stale",
            "The world map changed. Review existing Game map matches again.",
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
          await persistence.updateChatMetadata({
            chatId,
            metadata: applied.metadata,
            updatedAt: now(),
          });
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
      input: UpdateSpatialContextRequestInput & {
        hierarchyProfile?: SpatialHierarchyProfile;
      },
      options: { detachSharedWorld?: boolean; breakHistoryContinuity?: boolean } = {},
    ): Promise<MapsSpatialContextResponse> {
      return persistence.withChatLock(chatId, async () => {
        const chat = await persistence.getChat(chatId);
        if (!chat) throw new SpatialContextServiceError("chat_not_found", "Chat not found.", 404);
        assertSupportedMode(chat.mode);

        const metadata = parseSpatialMetadata(chat.metadata);
        const stored = await resolveSpatialWorldSource(chat, persistence, {
          includeLinkedChatCount: true,
        });
        if (stored.corrupt) {
          throw new SpatialContextServiceError(
            "spatial_definition_corrupt",
            "The stored world map is invalid and must be repaired before it can be updated.",
            409,
          );
        }
        if (stored.link && !stored.world) {
          throw new SpatialContextServiceError(
            "spatial_shared_world_missing",
            "This chat's shared world was removed or is unavailable. Fork a recovered copy or link another world.",
            409,
          );
        }

        const currentRevision = stored.definition?.revision ?? 0;
        if (input.expectedRevision !== currentRevision) {
          throw new SpatialContextServiceError(
            "spatial_definition_stale",
            "The world map changed. Reload it before saving.",
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
          input.hierarchyProfile ?? stored.hierarchyProfile ?? metadata[HIERARCHY_PROFILE_KEY],
          definition,
        );
        const parsedDefinition = spatialContextDefinitionSchema.safeParse(definition);
        if (!parsedDefinition.success) {
          throw new SpatialContextServiceError(
            "spatial_replacement_invalid",
            parsedDefinition.error.issues[0]?.message ?? "The world map is invalid.",
            400,
          );
        }

        const hasCommittedSpatialHistory = await createSpatialContextStorage(persistence).hasMessageSnapshots(chatId);
        if (stored.definition) {
          const nextIds = new Set(definition.locations.map((location) => location.id));
          const removedLocations = stored.definition.locations.filter((location) => !nextIds.has(location.id));
          if (removedLocations.length > 0 && stored.link && !options.detachSharedWorld) {
            throw new SpatialContextServiceError(
              "spatial_history_location_removal_forbidden",
              "Detach and keep an independent copy before permanently deleting locations from a linked shared world.",
              409,
            );
          }
          if (removedLocations.length > 0 && !options.breakHistoryContinuity) {
            const deletionProtections = await resolveLocationDeletionProtections(chatId, metadata, persistence);
            const protectionById = new Map(
              deletionProtections.map((protection) => [protection.locationId, protection]),
            );
            const protectedLocation = removedLocations.find((location) => {
              const protection = protectionById.get(location.id);
              return (
                location.id === stored.definition?.startingLocationId ||
                location.id === currentLocationId ||
                Boolean(protection?.historySnapshotCount) ||
                Boolean(protection?.gameMapBindingCount)
              );
            });
            if (protectedLocation) {
              const protection = protectionById.get(protectedLocation.id);
              const reasons = [
                protectedLocation.id === stored.definition.startingLocationId ? "the saved starting location" : null,
                protectedLocation.id === currentLocationId ? "the current story location" : null,
                protection?.historySnapshotCount
                  ? `${protection.historySnapshotCount} historical message${protection.historySnapshotCount === 1 ? "" : "s"}`
                  : null,
                protection?.gameMapBindingCount
                  ? `${protection.gameMapBindingCount} Game map binding${protection.gameMapBindingCount === 1 ? "" : "s"}`
                  : null,
              ].filter(Boolean);
              throw new SpatialContextServiceError(
                "spatial_history_location_removal_forbidden",
                `Keep ${protectedLocation.name || "this location"}; it is referenced by ${reasons.join(", ")}. Archive it instead.`,
                409,
              );
            }
          }
        }

        const byId = buildSpatialLocationIndex(definition);
        const currentStillActive = currentLocationId === null || byId.get(currentLocationId)?.status === "active";
        let nextCurrentLocationId =
          input.replacementCurrentLocationId === undefined ? currentLocationId : input.replacementCurrentLocationId;
        if (!currentStillActive && input.replacementCurrentLocationId === undefined) {
          throw new SpatialContextServiceError(
            "spatial_replacement_required",
            "Choose an active replacement before removing or archiving the current location.",
            409,
          );
        }

        if (nextCurrentLocationId !== null && byId.get(nextCurrentLocationId)?.status !== "active") {
          throw new SpatialContextServiceError(
            "spatial_replacement_invalid",
            "The replacement location must exist and be active.",
            400,
          );
        }

        const metadataForUpdate = options.breakHistoryContinuity
          ? clearGameMapSpatialLocationBindings(metadata)
          : metadata;
        const initialGameMapBindings =
          chat.mode === "game" && !stored.definition && metadata.gameSessionStatus === "ready"
            ? bindGameMapsToExactSpatialLocations(metadataForUpdate, definition)
            : { metadata: metadataForUpdate, bindingCount: 0 };
        const nextMetadata =
          stored.link && !options.detachSharedWorld
            ? withSpatialSharedWorldDraft(
                initialGameMapBindings.metadata,
                stored.link,
                stored.link.draft?.baseWorldRevision ?? stored.world?.revision ?? currentRevision,
                definition,
                hierarchyProfile,
                now(),
              )
            : {
                ...withoutSpatialSharedWorldLink(initialGameMapBindings.metadata),
                [METADATA_KEY]: definition,
                [HIERARCHY_PROFILE_KEY]: hierarchyProfile,
              };
        await persistence.transaction(async (transaction) => {
          await transaction.updateChatMetadata({
            chatId,
            metadata: nextMetadata,
            updatedAt: now(),
          });

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

        const nextSharedWorldStatus: SpatialSharedWorldStatus =
          stored.link && !options.detachSharedWorld
            ? {
                ...stored.status,
                pendingChanges: true,
                pendingBaseRevision: stored.link.draft?.baseWorldRevision ?? stored.world?.revision ?? currentRevision,
                conflict:
                  Boolean(stored.world) &&
                  (stored.link.draft?.baseWorldRevision ?? stored.world?.revision ?? currentRevision) !==
                    stored.world!.revision,
              }
            : independentSpatialWorldStatus();
        return buildResponse(
          definition,
          nextCurrentLocationId ?? definition.startingLocationId,
          false,
          hasCommittedSpatialHistory || Boolean(state.visibleAnchor),
          await resolveLoreReferenceWarnings(definition, persistence),
          hierarchyProfile,
          readGenerationPreferences(metadata, chat.mode),
          nextSharedWorldStatus,
          await resolveLocationDeletionProtections(chatId, nextMetadata, persistence),
        );
      });
    },
  };
}
