import {
  type CapabilityPersistenceSession,
  spatialContextDefinitionSchema,
  type SpatialContextDefinition,
  type SpatialContextSnapshot,
} from "@marinara-engine/shared";
import { getPackagePersistence, newTimeSortableId, now } from "./package-runtime.js";
import { parseSpatialMetadata } from "./metadata.js";

export interface SpatialMessageAnchor {
  messageId: string;
  swipeIndex: number;
}

export interface EffectiveSpatialState {
  definition: SpatialContextDefinition | null;
  snapshot: SpatialContextSnapshot | null;
  currentLocationId: string | null;
  definitionRevision: number;
  visibleAnchor: SpatialMessageAnchor | null;
  virtual: boolean;
}

export interface ResolveSpatialStateOptions {
  exactAnchor?: SpatialMessageAnchor;
  throughMessageId?: string;
  beforeMessageId?: string;
}

export function parseStoredSpatialDefinition(rawMetadata: unknown): SpatialContextDefinition | null {
  const candidate = parseSpatialMetadata(rawMetadata).spatialContext;
  const parsed = spatialContextDefinitionSchema.safeParse(candidate);
  return parsed.success ? (parsed.data as SpatialContextDefinition) : null;
}

function anchorForMessage(message: { id: string; role: string; activeSwipeIndex: number }): SpatialMessageAnchor {
  return {
    messageId: message.id,
    swipeIndex: message.role === "assistant" ? message.activeSwipeIndex : 0,
  };
}

export async function resolveEffectiveSpatialState(
  chatId: string,
  options: ResolveSpatialStateOptions = {},
  persistence: CapabilityPersistenceSession = getPackagePersistence(),
): Promise<EffectiveSpatialState> {
  const chat = await persistence.getChat(chatId);
  const definition = chat ? parseStoredSpatialDefinition(chat.metadata) : null;
  const storage = persistence.spatialSnapshots;

  if (options.exactAnchor) {
    const snapshot = await storage.getByAnchor(chatId, options.exactAnchor.messageId, options.exactAnchor.swipeIndex);
    return {
      definition,
      snapshot,
      currentLocationId: snapshot?.currentLocationId ?? null,
      definitionRevision: snapshot?.definitionRevision ?? definition?.revision ?? 0,
      visibleAnchor: options.exactAnchor,
      virtual: false,
    };
  }

  const ordered = await persistence.listMessages(chatId);

  let end = ordered.length - 1;
  if (options.beforeMessageId) {
    const index = ordered.findIndex((message) => message.id === options.beforeMessageId);
    end = index < 0 ? -1 : index - 1;
  } else if (options.throughMessageId) {
    const index = ordered.findIndex((message) => message.id === options.throughMessageId);
    end = index < 0 ? -1 : index;
  }

  const visibleMessage = end >= 0 ? ordered[end] : undefined;
  const visibleAnchor = visibleMessage ? anchorForMessage(visibleMessage) : null;
  const eligibleAnchors = ordered.slice(0, end + 1).map(anchorForMessage);
  const snapshots = await storage.listByAnchors(chatId, eligibleAnchors);
  const snapshotsByAnchor = new Map(
    snapshots.map((snapshot) => [`${snapshot.messageId}\u0000${snapshot.swipeIndex}`, snapshot]),
  );
  for (let index = end; index >= 0; index -= 1) {
    const message = ordered[index];
    if (!message) continue;
    const anchor = anchorForMessage(message);
    const snapshot = snapshotsByAnchor.get(`${anchor.messageId}\u0000${anchor.swipeIndex}`);
    if (!snapshot) continue;
    return {
      definition,
      snapshot,
      currentLocationId: snapshot.currentLocationId,
      definitionRevision: snapshot.definitionRevision,
      visibleAnchor,
      virtual: false,
    };
  }

  const bootstrap = await storage.getBootstrap(chatId);
  if (bootstrap) {
    return {
      definition,
      snapshot: bootstrap,
      currentLocationId: bootstrap.currentLocationId,
      definitionRevision: bootstrap.definitionRevision,
      visibleAnchor,
      virtual: false,
    };
  }

  const startingLocationId = definition?.enabled ? definition.startingLocationId : null;
  return {
    definition,
    snapshot: null,
    currentLocationId: startingLocationId,
    definitionRevision: definition?.revision ?? 0,
    visibleAnchor,
    virtual: startingLocationId !== null,
  };
}

export async function materializeAssistantSpatialState(
  input: {
    chatId: string;
    messageId: string;
    swipeIndex: number;
    regenerate: boolean;
    continuation: boolean;
  },
): Promise<SpatialContextSnapshot | null> {
  const persistence = getPackagePersistence();
  const state = input.regenerate
    ? await resolveEffectiveSpatialState(input.chatId, { beforeMessageId: input.messageId }, persistence)
    : input.continuation
      ? await resolveEffectiveSpatialState(input.chatId, { throughMessageId: input.messageId }, persistence)
      : await resolveEffectiveSpatialState(input.chatId, {}, persistence);

  if (!state.definition?.enabled || state.currentLocationId === null) return null;
  return persistence.spatialSnapshots.replaceAtAnchor({
    id: newTimeSortableId(),
    chatId: input.chatId,
    messageId: input.messageId,
    swipeIndex: input.swipeIndex,
    currentLocationId: state.currentLocationId,
    definitionRevision: state.definition.revision,
    source: "assistant_swipe",
    transitionCommandId: null,
    transitionPayloadHash: null,
    createdAt: now(),
  });
}
