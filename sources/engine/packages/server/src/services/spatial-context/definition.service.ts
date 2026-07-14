import {
  buildSpatialLocationIndex,
  resolveSpatialBreadcrumb,
  resolveSpatialDestinations,
  spatialContextDefinitionSchema,
  type SpatialContextDefinition,
  type SpatialContextResponse,
  type UpdateSpatialContextRequestInput,
} from "@marinara-engine/shared";
import { eq } from "drizzle-orm";
import type { DB } from "../../db/connection.js";
import { chats } from "../../db/schema/index.js";
import { now } from "../../utils/id-generator.js";
import { createLorebooksStorage } from "../storage/lorebooks.storage.js";
import { withChatMetadataPatchQueue } from "../storage/chats.storage.js";
import { createSpatialContextStorage } from "../storage/spatial-context.storage.js";
import { resolveEffectiveSpatialState } from "./state-resolution.js";
import { parseSpatialMetadata } from "./metadata.js";

const METADATA_KEY = "spatialContext";

export type SpatialContextServiceErrorCode =
  | "chat_not_found"
  | "spatial_mode_unsupported"
  | "spatial_definition_corrupt"
  | "spatial_definition_stale"
  | "spatial_current_location_stale"
  | "spatial_replacement_required"
  | "spatial_replacement_invalid"
  | "spatial_history_location_removal_forbidden";

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
): SpatialContextResponse {
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
  };
}

async function resolveLoreReferenceWarnings(
  db: DB,
  definition: SpatialContextDefinition,
): Promise<SpatialContextResponse["warnings"]> {
  const entryIds = Array.from(
    new Set(definition.locations.flatMap((location) => location.lorebookEntryIds ?? [])),
  );
  if (entryIds.length === 0) return [];
  const storage = createLorebooksStorage(db);
  const existingIds = new Set(
    (
      await Promise.all(entryIds.map(async (entryId) => ((await storage.getEntry(entryId)) ? entryId : null)))
    ).filter((entryId): entryId is string => Boolean(entryId)),
  );
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

export function createSpatialContextService(db: DB) {
  return {
    async get(chatId: string): Promise<SpatialContextResponse> {
      const rows = await db.select().from(chats).where(eq(chats.id, chatId)).limit(1);
      const chat = rows[0];
      if (!chat) throw new SpatialContextServiceError("chat_not_found", "Chat not found.", 404);
      assertSupportedMode(chat.mode);

      const hasCommittedSpatialHistory = await createSpatialContextStorage(db).hasMessageSnapshots(chatId);
      const stored = readDefinition(parseSpatialMetadata(chat.metadata));
      if (!stored.definition) return buildResponse(null, null, stored.corrupt, hasCommittedSpatialHistory);

      const state = await resolveEffectiveSpatialState(db, chatId);
      return buildResponse(
        stored.definition,
        state.currentLocationId,
        false,
        hasCommittedSpatialHistory,
        await resolveLoreReferenceWarnings(db, stored.definition),
      );
    },

    async update(chatId: string, input: UpdateSpatialContextRequestInput): Promise<SpatialContextResponse> {
      return withChatMetadataPatchQueue(chatId, async () => {
        const rows = await db.select().from(chats).where(eq(chats.id, chatId)).limit(1);
        const chat = rows[0];
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

        const state = await resolveEffectiveSpatialState(db, chatId);
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
        const parsedDefinition = spatialContextDefinitionSchema.safeParse(definition);
        if (!parsedDefinition.success) {
          throw new SpatialContextServiceError(
            "spatial_replacement_invalid",
            parsedDefinition.error.issues[0]?.message ?? "The hierarchical map is invalid.",
            400,
          );
        }

        const spatialStorage = createSpatialContextStorage(db);
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

        const nextMetadata = { ...metadata, [METADATA_KEY]: definition };
        await db.transaction(async (tx) => {
          await tx
            .update(chats)
            .set({ metadata: JSON.stringify(nextMetadata), updatedAt: now() })
            .where(eq(chats.id, chatId));

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
            const txStorage = createSpatialContextStorage(tx);
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

        return buildResponse(
          definition,
          nextCurrentLocationId ?? definition.startingLocationId,
          false,
          hasCommittedSpatialHistory || Boolean(state.visibleAnchor),
          await resolveLoreReferenceWarnings(db, definition),
        );
      });
    },
  };
}
