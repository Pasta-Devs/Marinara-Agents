import { createHash } from "node:crypto";
import {
  type CapabilityMessageRecord,
  type CapabilityPersistenceSession,
  resolveSpatialBreadcrumb,
  validateSpatialTransition,
  type MessageAttachment,
  type PendingSpatialTransition,
  type SpatialContextSnapshot,
  type SpatialTransitionErrorCode,
} from "@marinara-engine/shared";
import { getPackagePersistence, newId, newTimeSortableId, now } from "./package-runtime.js";
import { parseStoredSpatialDefinition, resolveEffectiveSpatialState } from "./state-resolution.js";
import { selectBoundGameMapForLocation } from "./game-map-binding.js";
import { parseSpatialMetadata } from "./metadata.js";

export type SpatialOwnerTurnErrorCode =
  | SpatialTransitionErrorCode
  | "chat_not_found"
  | "spatial_mode_unsupported"
  | "spatial_transition_requires_new_turn"
  | "spatial_transition_command_mismatch"
  | "spatial_transition_already_applied";

export class SpatialOwnerTurnError extends Error {
  constructor(
    readonly code: SpatialOwnerTurnErrorCode,
    message: string,
    readonly statusCode: 400 | 404 | 409,
    readonly details?: {
      snapshot?: SpatialContextSnapshot;
      messageId?: string;
      currentRevision?: number;
      currentLocationId?: string | null;
      currentBreadcrumb?: Array<{ id: string; name: string }>;
    },
  ) {
    super(message);
    this.name = "SpatialOwnerTurnError";
  }
}

export interface CommitSpatialOwnerTurnInput {
  chatId: string;
  content: string;
  transition: PendingSpatialTransition;
  gameStateSnapshotId?: string | null;
  attachments?: MessageAttachment[];
}

function transitionPayloadHash(transition: PendingSpatialTransition): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        destinationId: transition.destinationId,
        expectedDefinitionRevision: transition.expectedDefinitionRevision,
        expectedCurrentLocationId: transition.expectedCurrentLocationId,
        commandId: transition.commandId,
      }),
    )
    .digest("hex");
}

function messageExtra(attachments?: MessageAttachment[]) {
  return {
    displayText: null,
    isGenerated: false,
    tokenCount: null,
    generationInfo: null,
    ...(attachments?.length ? { attachments } : {}),
  };
}

export async function commitSpatialOwnerTurn(
  input: CommitSpatialOwnerTurnInput,
): Promise<{ message: CapabilityMessageRecord; snapshot: SpatialContextSnapshot }> {
  const persistence = getPackagePersistence();
  return persistence.withChatLock(input.chatId, async () =>
    persistence.transaction(async (transaction: CapabilityPersistenceSession) => {
      const chat = await transaction.getChat(input.chatId);
      if (!chat) throw new SpatialOwnerTurnError("chat_not_found", "Chat not found.", 404);
      if (chat.mode !== "roleplay" && chat.mode !== "game") {
        throw new SpatialOwnerTurnError(
          "spatial_mode_unsupported",
          "Only Roleplay and Game chats can change hierarchical location.",
          400,
        );
      }

      const definition = parseStoredSpatialDefinition(chat.metadata);
      if (!definition) {
        throw new SpatialOwnerTurnError(
          "spatial_definition_invalid",
          "The hierarchical map must be repaired before moving.",
          400,
        );
      }

      const storage = transaction.spatialSnapshots;
      const payloadHash = transitionPayloadHash(input.transition);
      const existing = await storage.getByCommand(input.chatId, input.transition.commandId);
      if (existing) {
        if (existing.transitionPayloadHash !== payloadHash) {
          throw new SpatialOwnerTurnError(
            "spatial_transition_command_mismatch",
            "This movement command was already used for a different destination.",
            409,
          );
        }
        throw new SpatialOwnerTurnError(
          "spatial_transition_already_applied",
          "This movement was already applied.",
          409,
          { snapshot: existing, messageId: existing.messageId },
        );
      }

      const state = await resolveEffectiveSpatialState(input.chatId, {}, transaction);
      const validation = validateSpatialTransition(definition, state.currentLocationId, input.transition);
      if (!validation.ok) {
        const stale =
          validation.code === "spatial_transition_stale_definition" ||
          validation.code === "spatial_transition_stale_location";
        throw new SpatialOwnerTurnError(validation.code, validation.message, stale ? 409 : 400, {
          currentRevision: definition.revision,
          currentLocationId: state.currentLocationId,
          currentBreadcrumb: resolveSpatialBreadcrumb(definition, state.currentLocationId).map(({ id, name }) => ({
            id,
            name,
          })),
        });
      }
      if (chat.mode === "game" && input.gameStateSnapshotId) {
        await transaction.markGameStateSnapshotCommitted(input.chatId, input.gameStateSnapshotId);
      }
      const nextGameMetadata =
        chat.mode === "game"
          ? selectBoundGameMapForLocation(parseSpatialMetadata(chat.metadata), definition, validation.destination.id)
          : null;

      const requestedTimestamp = now();
      const messageId = newId();
      const swipeId = newId();
      const message = await transaction.createMessageWithSwipe({
        id: messageId,
        swipeId,
        chatId: input.chatId,
        role: "user",
        characterId: null,
        content: input.content,
        extra: messageExtra(input.attachments),
        createdAt: requestedTimestamp,
      });
      const timestamp = message.createdAt;

      const snapshot = await storage.create({
        id: newTimeSortableId(),
        chatId: input.chatId,
        messageId,
        swipeIndex: 0,
        currentLocationId: validation.destination.id,
        definitionRevision: definition.revision,
        source: "owner_turn",
        transitionCommandId: input.transition.commandId,
        transitionPayloadHash: payloadHash,
        createdAt: timestamp,
      });
      await transaction.updateChatActivity({
        chatId: input.chatId,
        lastMessageAt: timestamp,
        updatedAt: timestamp,
        ...(nextGameMetadata ? { metadata: nextGameMetadata } : {}),
      });
      return { message, snapshot };
    }),
  );
}
