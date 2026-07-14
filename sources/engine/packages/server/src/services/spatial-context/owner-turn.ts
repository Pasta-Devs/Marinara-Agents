import { createHash } from "node:crypto";
import {
  resolveSpatialBreadcrumb,
  validateSpatialTransition,
  type MessageAttachment,
  type PendingSpatialTransition,
  type SpatialContextSnapshot,
  type SpatialTransitionErrorCode,
} from "@marinara-engine/shared";
import { and, eq } from "drizzle-orm";
import type { DB } from "../../db/connection.js";
import { chats, gameStateSnapshots, messages, messageSwipes } from "../../db/schema/index.js";
import { newId, now } from "../../utils/id-generator.js";
import { withChatMetadataPatchQueue } from "../storage/chats.storage.js";
import { createSpatialContextStorage } from "../storage/spatial-context.storage.js";
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
  return JSON.stringify({
    displayText: null,
    isGenerated: false,
    tokenCount: null,
    generationInfo: null,
    ...(attachments?.length ? { attachments } : {}),
  });
}

export async function commitSpatialOwnerTurn(
  db: DB,
  input: CommitSpatialOwnerTurnInput,
): Promise<{ message: typeof messages.$inferSelect; snapshot: SpatialContextSnapshot }> {
  return withChatMetadataPatchQueue(input.chatId, async () =>
    db.transaction(async (tx) => {
      const chatRows = await tx.select().from(chats).where(eq(chats.id, input.chatId)).limit(1);
      const chat = chatRows[0];
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

      const storage = createSpatialContextStorage(tx);
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

      const state = await resolveEffectiveSpatialState(tx, input.chatId);
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
        await tx
          .update(gameStateSnapshots)
          .set({ committed: 1 })
          .where(
            and(eq(gameStateSnapshots.id, input.gameStateSnapshotId), eq(gameStateSnapshots.chatId, input.chatId)),
          );
      }
      const nextGameMetadata =
        chat.mode === "game"
          ? selectBoundGameMapForLocation(parseSpatialMetadata(chat.metadata), definition, validation.destination.id)
          : null;

      const timestamp = now();
      const messageId = newId();
      const swipeId = newId();
      await tx.insert(messages).values({
        id: messageId,
        chatId: input.chatId,
        role: "user",
        characterId: null,
        content: input.content,
        activeSwipeIndex: 0,
        extra: messageExtra(input.attachments),
        createdAt: timestamp,
      });
      await tx.insert(messageSwipes).values({
        id: swipeId,
        messageId,
        index: 0,
        content: input.content,
        extra: JSON.stringify({}),
        createdAt: timestamp,
      });

      const snapshot = await storage.create({
        chatId: input.chatId,
        messageId,
        swipeIndex: 0,
        currentLocationId: validation.destination.id,
        definitionRevision: definition.revision,
        source: "owner_turn",
        transitionCommandId: input.transition.commandId,
        transitionPayloadHash: payloadHash,
      });
      await tx
        .update(chats)
        .set({
          lastMessageAt: timestamp,
          updatedAt: timestamp,
          ...(nextGameMetadata ? { metadata: JSON.stringify(nextGameMetadata) } : {}),
        })
        .where(eq(chats.id, input.chatId));

      const createdRows = await tx.select().from(messages).where(eq(messages.id, messageId)).limit(1);
      const message = createdRows[0];
      if (!message) throw new Error("Spatial owner turn committed without a user message.");
      return { message, snapshot };
    }),
  );
}
