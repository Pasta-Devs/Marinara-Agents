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
import { getPackagePersistence, logger, newId, now } from "./package-runtime.js";
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
  | "spatial_definition_missing"
  | "spatial_location_conflict"
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

    /** Append locations without replacing the map — the additive write path
     *  for Experience packages (Marinara-Engine #5144). Ids may be supplied
     *  (deterministic references for the caller) or are allocated like the
     *  discover directive's, including the next layerOrder under a "layers"
     *  parent; parents may reference other additions in the same batch, must
     *  exist, and must be active. Delegates the actual write to update(),
     *  inheriting its full guard set — corrupt/shared-world checks, the
     *  revision CAS, schema validation, and the repair-snapshot tail. The
     *  current-location CAS is deliberately skipped: a pure add cannot
     *  invalidate the party's position, and party movement does not bump the
     *  revision, so enforcing it would 409 concurrent-play callers for a
     *  conflict that cannot exist (review finding). The revision CAS alone
     *  still rejects every real definition race. On a shared-world-linked
     *  chat this stages the additions in the chat's pending draft, exactly
     *  like the editor — callers should heed sharedWorld.pendingChanges in
     *  the response. */
    async addLocations(
      chatId: string,
      input: {
        expectedRevision: number;
        locations: Array<{
          id?: string;
          parentId?: string | null;
          name: string;
          kind?: SpatialContextDefinition["locations"][number]["kind"];
          description?: string;
        }>;
      },
    ): Promise<MapsSpatialContextResponse & { addedLocationIds: string[] }> {
      // Read the stored world directly rather than through get(): get() folds a
      // corrupt map and an unavailable linked world into definition:null, which
      // would mask them as "no map yet" here — the caller must see the same
      // corrupt/shared-world errors the editor gets (review finding). update()
      // re-checks all of this under the lock; this pre-read only classifies.
      const chat = await persistence.getChat(chatId);
      if (!chat) throw new SpatialContextServiceError("chat_not_found", "Chat not found.", 404);
      assertSupportedMode(chat.mode);
      const stored = await resolveSpatialWorldSource(chat, persistence, { includeLinkedChatCount: true });
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
      if (!stored.definition) {
        throw new SpatialContextServiceError(
          "spatial_definition_missing",
          "This chat has no world map yet — create one before adding locations.",
          409,
        );
      }
      if (input.expectedRevision !== stored.definition.revision) {
        throw new SpatialContextServiceError(
          "spatial_definition_stale",
          "The world map changed. Reload it before saving.",
          409,
        );
      }
      const existing = stored.definition.locations;
      // A friendly cap check before the schema's raw array error (500 is the
      // schema's maxLocations bound).
      if (existing.length + input.locations.length > 500) {
        throw new SpatialContextServiceError(
          "spatial_replacement_invalid",
          `Adding ${input.locations.length} locations would exceed the 500-location map limit (${existing.length} exist).`,
          400,
        );
      }
      const byId = new Map(existing.map((location) => [location.id, location]));
      const additionById = new Map<string, { status: "active"; childPresentation: string; layerOrder?: number }>();
      // sortOrder and layerOrder continue each parent's sibling sequence, like
      // discover — layerOrder is REQUIRED for children of a "layers" parent,
      // and the caller has no field for it, so allocation here is what makes
      // layered buildings reachable at all (review finding).
      const nextSortOrder = new Map<string | null, number>();
      const takeSortOrder = (parentId: string | null): number => {
        if (!nextSortOrder.has(parentId)) {
          const siblings = existing.filter((location) => location.parentId === parentId);
          nextSortOrder.set(parentId, Math.max(-1, ...siblings.map((location) => location.sortOrder)) + 1);
        }
        const value = nextSortOrder.get(parentId) ?? 0;
        nextSortOrder.set(parentId, value + 1);
        return value;
      };
      const nextLayerOrder = new Map<string, number>();
      const takeLayerOrder = (parentId: string): number => {
        if (!nextLayerOrder.has(parentId)) {
          const siblings = existing.filter((location) => location.parentId === parentId);
          nextLayerOrder.set(parentId, Math.max(-1, ...siblings.map((location) => location.layerOrder ?? -1)) + 1);
        }
        const value = nextLayerOrder.get(parentId) ?? 0;
        nextLayerOrder.set(parentId, value + 1);
        return value;
      };
      const additions = input.locations.map((raw) => {
        const id = raw.id ?? `loc_${newId()}`;
        if (byId.has(id) || additionById.has(id)) {
          throw new SpatialContextServiceError(
            "spatial_location_conflict",
            `A location with id ${id} already exists.`,
            409,
          );
        }
        const parentId = raw.parentId ?? null;
        const parent = parentId === null ? null : (byId.get(parentId) ?? additionById.get(parentId) ?? null);
        const parentIsLayers = parent?.childPresentation === "layers";
        const addition = {
          id,
          parentId,
          name: raw.name,
          kind: raw.kind ?? ("place" as const),
          description: raw.description ?? "",
          lorebookEntryIds: [],
          childPresentation: "list" as const,
          links: [],
          status: "active" as const,
          sortOrder: takeSortOrder(parentId),
          ...(parentIsLayers && parentId !== null ? { layerOrder: takeLayerOrder(parentId) } : {}),
        };
        additionById.set(id, addition);
        return addition;
      });
      // Parent checks across the FULL merged set, so a batch can build its own
      // subtree. Existence AND active status: the archive flow forbids active
      // children under an archived parent, and such a child would be
      // unreachable in play (review finding).
      for (const addition of additions) {
        if (addition.parentId === null) continue;
        const parent = byId.get(addition.parentId) ?? additionById.get(addition.parentId);
        if (!parent) {
          throw new SpatialContextServiceError(
            "spatial_replacement_invalid",
            `Location ${addition.name} references a parent (${addition.parentId}) that does not exist.`,
            400,
          );
        }
        if (parent.status !== "active") {
          throw new SpatialContextServiceError(
            "spatial_replacement_invalid",
            `Location ${addition.name} references an archived parent (${addition.parentId}); restore it first.`,
            400,
          );
        }
      }
      const response = await this.update(
        chatId,
        {
          expectedRevision: input.expectedRevision,
          expectedCurrentLocationId: null,
          definition: { ...stored.definition, locations: [...existing, ...additions] },
        },
        { skipCurrentLocationCas: true },
      );
      return { ...response, addedLocationIds: additions.map((addition) => addition.id) };
    },

    async update(
      chatId: string,
      input: UpdateSpatialContextRequestInput & {
        hierarchyProfile?: SpatialHierarchyProfile;
      },
      options: { detachSharedWorld?: boolean; breakHistoryContinuity?: boolean; skipCurrentLocationCas?: boolean } = {},
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
        // skipCurrentLocationCas: the additive path never moves or removes the
        // current location, and get()'s clamped id lives in a different domain
        // than this raw snapshot id — comparing them could wedge a chat with a
        // dangling snapshot permanently (review finding).
        if (!options.skipCurrentLocationCas && input.expectedCurrentLocationId !== currentLocationId) {
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
        const nextCurrentLocationId =
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
