import { createHash } from "node:crypto";
import {
  type CapabilityMessageRecord,
  type CapabilityPersistenceSession,
  resolveSpatialBreadcrumb,
  resolveSpatialRoute,
  validateSpatialTransition,
  type MessageAttachment,
  type PendingSpatialTransition,
  type ResolvedSpatialTravel,
  type SpatialContextSnapshot,
  type SpatialTransitionErrorCode,
} from "@marinara-engine/shared";
import { getPackagePersistence, newId, newTimeSortableId, now } from "./package-runtime.js";
import { resolveEffectiveSpatialState } from "./state-resolution.js";
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
      travel?: ResolvedSpatialTravel;
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

export type AppliedSpatialOwnerTurn = {
  messageId: string;
  snapshot: SpatialContextSnapshot;
  travel?: ResolvedSpatialTravel;
};

function transitionPayloadHash(transition: PendingSpatialTransition): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        destinationId: transition.destinationId,
        ...(transition.travelMode ? { travelMode: transition.travelMode } : {}),
        expectedDefinitionRevision: transition.expectedDefinitionRevision,
        expectedCurrentLocationId: transition.expectedCurrentLocationId,
        commandId: transition.commandId,
      }),
    )
    .digest("hex");
}

async function resolveAppliedTravel(
  chatId: string,
  transition: PendingSpatialTransition,
  transaction?: CapabilityPersistenceSession,
): Promise<ResolvedSpatialTravel | undefined> {
  if (!transition.travelMode || !transition.expectedCurrentLocationId) return undefined;
  const state = await resolveEffectiveSpatialState(chatId, {}, transaction);
  const definition = state.definition;
  const routeLocationIds = definition
    ? resolveSpatialRoute(definition, transition.expectedCurrentLocationId, transition.destinationId)
    : null;
  if (!routeLocationIds || routeLocationIds.length === 0) return undefined;
  const remainingLocationIds = transition.travelMode === "step_by_step" ? routeLocationIds.slice(1) : [];
  return {
    mode: transition.travelMode,
    fromLocationId: transition.expectedCurrentLocationId,
    targetLocationId: transition.destinationId,
    routeLocationIds,
    remainingLocationIds,
    complete: remainingLocationIds.length === 0,
  };
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

export async function findAppliedSpatialOwnerTurn(
  input: Pick<CommitSpatialOwnerTurnInput, "chatId" | "transition">,
): Promise<AppliedSpatialOwnerTurn | null> {
  const existing = await getPackagePersistence().spatialSnapshots.getByCommand(
    input.chatId,
    input.transition.commandId,
  );
  if (!existing) return null;
  if (existing.transitionPayloadHash !== transitionPayloadHash(input.transition)) {
    throw new SpatialOwnerTurnError(
      "spatial_transition_command_mismatch",
      "This movement command was already used for a different destination.",
      409,
    );
  }
  const travel = input.transition.travelMode
    ? await resolveAppliedTravel(input.chatId, input.transition)
    : undefined;
  return {
    messageId: existing.messageId,
    snapshot: existing,
    ...(travel ? { travel } : {}),
  };
}

export async function commitSpatialOwnerTurn(input: CommitSpatialOwnerTurnInput): Promise<{
  message: CapabilityMessageRecord;
  snapshot: SpatialContextSnapshot;
  travel?: ResolvedSpatialTravel;
}> {
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
        const recoveredTravel = input.transition.travelMode
          ? await resolveAppliedTravel(input.chatId, input.transition, transaction)
          : undefined;
        throw new SpatialOwnerTurnError(
          "spatial_transition_already_applied",
          "This movement was already applied.",
          409,
          {
            snapshot: existing,
            messageId: existing.messageId,
            ...(recoveredTravel ? { travel: recoveredTravel } : {}),
          },
        );
      }

      const state = await resolveEffectiveSpatialState(input.chatId, {}, transaction);
      const definition = state.definition;
      if (!definition) {
        throw new SpatialOwnerTurnError(
          "spatial_definition_invalid",
          "The world map must be repaired before moving.",
          400,
        );
      }
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
      return {
        message,
        snapshot,
        ...(validation.travel ? { travel: validation.travel } : {}),
      };
    }),
  );
}
