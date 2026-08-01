import {
  resolveSpatialBreadcrumb,
  resolveSpatialDestinations,
  SPATIAL_CONTEXT_LIMITS,
  type CapabilityPersistenceSession,
  spatialContextDefinitionSchema,
  type SpatialContextDefinition,
  type SpatialContextSnapshot,
  type SpatialLocation,
} from "@marinara-engine/shared";
import { getPackagePersistence, logger, newId, newTimeSortableId, now } from "./package-runtime.js";
import { parseSpatialMetadata } from "./metadata.js";
import {
  readSpatialSharedWorldLink,
  resolveSpatialWorldSource,
  withSpatialSharedWorldDraft,
} from "./shared-world.service.js";
import { selectBoundGameMapForLocation } from "./game-map-binding.js";

export type AssistantSpatialDirective =
  | { type: "move"; destinationId: string }
  | {
      type: "discover";
      name: string;
      relation: "enter" | "link";
      description?: string;
    };

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

function normalizedLocationName(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[_-]+/gu, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/^\s*(?:the|a|an)\s+/u, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function numberedLayerIdentity(value: string): string | null {
  const match = value.trim().match(/^(level|floor|storey|story|deck)\s+([a-z]?\d+[a-z]?)\b/iu);
  return match ? `${match[1]!.toLowerCase()} ${match[2]!.toLowerCase()}` : null;
}

function knownLocationMatches(definition: SpatialContextDefinition, guidance: string): SpatialLocation[] {
  const expected = normalizedLocationName(guidance);
  if (!expected) return [];
  const exact = definition.locations.filter((location) => {
    if (location.status !== "active") return false;
    const breadcrumb = resolveSpatialBreadcrumb(definition, location.id)
      .map((entry) => entry.name)
      .join(" > ");
    return normalizedLocationName(location.name) === expected || normalizedLocationName(breadcrumb) === expected;
  });
  if (exact.length > 0) return exact;
  const layerIdentity = numberedLayerIdentity(guidance);
  return layerIdentity
    ? definition.locations.filter(
        (location) => location.status === "active" && numberedLayerIdentity(location.name) === layerIdentity,
      )
    : [];
}

function exactGuidanceDestination(definition: SpatialContextDefinition, guidance: string): string | null {
  const matches = knownLocationMatches(definition, guidance);
  return matches.length === 1 ? matches[0]!.id : null;
}

function addAvailableLink(
  definition: SpatialContextDefinition,
  currentLocationId: string,
  destinationId: string,
): SpatialContextDefinition | null {
  const current = definition.locations.find((location) => location.id === currentLocationId);
  if (!current) return null;
  const existing = current.links.find((link) => link.targetId === destinationId);
  if (!existing && current.links.length >= SPATIAL_CONTEXT_LIMITS.maxLinksPerLocation) return null;
  return {
    ...definition,
    revision: definition.revision + 1,
    locations: definition.locations.map((location) =>
      location.id !== currentLocationId
        ? location
        : {
            ...location,
            links: existing
              ? location.links.map((link) =>
                  link.targetId === destinationId
                    ? {
                        ...link,
                        bidirectional: true,
                        state: "available" as const,
                      }
                    : link,
                )
              : [
                  ...location.links,
                  {
                    targetId: destinationId,
                    bidirectional: true,
                    state: "available" as const,
                  },
                ],
          },
    ),
  };
}

function discoverLocation(
  definition: SpatialContextDefinition,
  currentLocationId: string,
  directive: Extract<AssistantSpatialDirective, { type: "discover" }>,
): { definition: SpatialContextDefinition; destinationId: string } | null {
  const nameKey = normalizedLocationName(directive.name);
  if (!nameKey) return null;
  const matching = knownLocationMatches(definition, directive.name);
  const reachableIds = new Set(resolveSpatialDestinations(definition, currentLocationId).map((entry) => entry.id));
  const reachableMatching = matching.filter((location) => reachableIds.has(location.id));
  if (reachableMatching.length === 1) {
    return { definition, destinationId: reachableMatching[0]!.id };
  }
  if (matching.length === 1) {
    const linked = addAvailableLink(definition, currentLocationId, matching[0]!.id);
    return linked ? { definition: linked, destinationId: matching[0]!.id } : null;
  }
  if (matching.length > 1 || definition.locations.length >= SPATIAL_CONTEXT_LIMITS.maxLocations) return null;

  const current = definition.locations.find((location) => location.id === currentLocationId);
  if (!current) return null;
  const parentId = directive.relation === "enter" ? currentLocationId : current.parentId;
  const siblings = definition.locations.filter((location) => location.parentId === parentId);
  const sortOrder = Math.max(-1, ...siblings.map((location) => location.sortOrder)) + 1;
  const layerOrder =
    directive.relation === "enter" && current.childPresentation === "layers"
      ? Math.max(-1, ...siblings.map((location) => location.layerOrder ?? -1)) + 1
      : undefined;
  const destinationId = `loc_${newId()}`;
  const discovered: SpatialLocation = {
    id: destinationId,
    parentId,
    name: directive.name,
    kind: "place",
    description: directive.description ?? "A location discovered during the story.",
    lorebookEntryIds: [],
    childPresentation: "list",
    links: [],
    status: "active",
    sortOrder,
    ...(layerOrder === undefined ? {} : { layerOrder }),
  };
  let nextDefinition: SpatialContextDefinition = {
    ...definition,
    revision: definition.revision + 1,
    locations: [...definition.locations, discovered],
  };
  if (directive.relation === "link") {
    const linked = addAvailableLink(
      { ...nextDefinition, revision: definition.revision },
      currentLocationId,
      destinationId,
    );
    if (!linked) return null;
    nextDefinition = linked;
  }
  const parsed = spatialContextDefinitionSchema.safeParse(nextDefinition);
  return parsed.success ? { definition: parsed.data as SpatialContextDefinition, destinationId } : null;
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
  const definition = chat ? (await resolveSpatialWorldSource(chat, persistence)).definition : null;
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

export async function materializeAssistantSpatialState(input: {
  chatId: string;
  messageId: string;
  swipeIndex: number;
  regenerate: boolean;
  continuation: boolean;
  directive?: AssistantSpatialDirective | null;
  locationGuidance?: string | null;
}): Promise<SpatialContextSnapshot | null> {
  const persistence = getPackagePersistence();
  return persistence.withChatLock(input.chatId, async () =>
    persistence.transaction(async (transaction) => {
      const existingAtAnchor = await transaction.spatialSnapshots.getByAnchor(
        input.chatId,
        input.messageId,
        input.swipeIndex,
      );
      if (input.locationGuidance && existingAtAnchor?.transitionCommandId?.startsWith("assistant:")) {
        return existingAtAnchor;
      }
      const state = input.regenerate
        ? await resolveEffectiveSpatialState(input.chatId, { beforeMessageId: input.messageId }, transaction)
        : input.continuation
          ? await resolveEffectiveSpatialState(input.chatId, { throughMessageId: input.messageId }, transaction)
          : await resolveEffectiveSpatialState(input.chatId, {}, transaction);

      if (!state.definition?.enabled || state.currentLocationId === null) return null;
      let definition = state.definition;
      let destinationId = state.currentLocationId;
      let transitionApplied = false;

      if (input.directive?.type === "move") {
        const requestedDestinationId = input.directive.destinationId;
        const reachable = new Set(
          resolveSpatialDestinations(definition, state.currentLocationId).map((destination) => destination.id),
        );
        const destination = definition.locations.find(
          (location) => location.id === requestedDestinationId && location.status === "active",
        );
        if (destination && destination.id !== state.currentLocationId) {
          if (!reachable.has(destination.id)) {
            const linked = addAvailableLink(definition, state.currentLocationId, destination.id);
            if (linked) definition = linked;
          }
        }
        if (
          destination &&
          (destination.id === state.currentLocationId ||
            reachable.has(destination.id) ||
            definition !== state.definition)
        ) {
          destinationId = destination.id;
          transitionApplied = destinationId !== state.currentLocationId;
        }
      } else if (input.directive?.type === "discover") {
        const discovered = discoverLocation(definition, state.currentLocationId, input.directive);
        if (discovered) {
          definition = discovered.definition;
          destinationId = discovered.destinationId;
          transitionApplied =
            destinationId !== state.currentLocationId || definition.revision !== state.definition.revision;
        }
      } else if (input.locationGuidance) {
        const guidedDestinationId = exactGuidanceDestination(definition, input.locationGuidance);
        if (guidedDestinationId && guidedDestinationId !== state.currentLocationId) {
          const reachable = new Set(
            resolveSpatialDestinations(definition, state.currentLocationId).map((destination) => destination.id),
          );
          if (!reachable.has(guidedDestinationId)) {
            const linked = addAvailableLink(definition, state.currentLocationId, guidedDestinationId);
            if (linked) definition = linked;
          }
          if (reachable.has(guidedDestinationId) || definition !== state.definition) {
            destinationId = guidedDestinationId;
            transitionApplied = true;
          }
        }
      }

      const chat = await transaction.getChat(input.chatId);
      if (!chat) return null;
      const metadata = parseSpatialMetadata(chat.metadata);
      let nextMetadata = metadata;
      if (definition.revision !== state.definition.revision) {
        const link = readSpatialSharedWorldLink(metadata);
        if (link) {
          const source = await resolveSpatialWorldSource(chat, transaction);
          nextMetadata = withSpatialSharedWorldDraft(
            nextMetadata,
            link,
            link.draft?.baseWorldRevision ?? source.world?.revision ?? state.definition.revision,
            definition,
            source.hierarchyProfile,
            now(),
          );
        } else {
          nextMetadata = { ...nextMetadata, spatialContext: definition };
        }
      }
      if (chat.mode === "game" && transitionApplied) {
        nextMetadata = selectBoundGameMapForLocation(nextMetadata, definition, destinationId);
      }
      if (nextMetadata !== metadata) {
        await transaction.updateChatMetadata({
          chatId: input.chatId,
          metadata: nextMetadata,
          updatedAt: now(),
        });
      }

      const transitionCommandId = transitionApplied
        ? `assistant:${input.messageId}:${input.swipeIndex}`.slice(0, 200)
        : (existingAtAnchor?.transitionCommandId ?? null);
      const snapshot = await transaction.spatialSnapshots.replaceAtAnchor({
        id: newTimeSortableId(),
        chatId: input.chatId,
        messageId: input.messageId,
        swipeIndex: input.swipeIndex,
        currentLocationId: destinationId,
        definitionRevision: definition.revision,
        source: "assistant_swipe",
        transitionCommandId,
        transitionPayloadHash: null,
        createdAt: now(),
      });
      if (transitionApplied) {
        logger.info(
          "[spatial/assistant] Applied narrated location transition for chat %s to %s",
          input.chatId,
          destinationId,
        );
      }
      return snapshot;
    }),
  );
}
