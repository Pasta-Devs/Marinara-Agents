import { useSyncExternalStore } from "react";
import type {
  PendingSpatialTransition,
  ResolvedSpatialTravel,
  SpatialContextResponse,
  SpatialDestinationRelation,
} from "@marinara-engine/shared";
import { generateClientId } from "./package-utils";

// A pending move lives in the Engine's chat store (`__MARINARA_HOST__.stores.chat`, capability API 1.341), which the
// Engine's composer reads and saves under "marinara-pending-spatial-transitions". This package used to keep a copy of
// that map and write the same key, so a move the Engine had cleared came back on the next save
// (Pasta-Devs/Marinara-Agents#1487). It reads and changes the Engine's map now, and never writes the key itself.
const STORAGE_KEY = "marinara-pending-spatial-transitions";

export type PendingSpatialTransitionDraft = {
  transition: PendingSpatialTransition;
  destinationName: string;
  relation: SpatialDestinationRelation;
  label?: string;
  status: "ready" | "needs_review";
  reviewMessage?: string;
};

type PendingSpatialTransitions = Map<string, PendingSpatialTransitionDraft>;

/** The part of the Engine's chat store World Maps uses. */
type ChatSpatialSlice = {
  pendingSpatialTransitions: PendingSpatialTransitions;
  setPendingSpatialTransition: (chatId: string, draft: PendingSpatialTransitionDraft) => void;
  clearPendingSpatialTransition: (chatId: string, commandId?: string) => void;
};

type SliceStore = {
  getState: () => ChatSpatialSlice;
  subscribe: (listener: () => void) => () => void;
};

function hostChatStore(): SliceStore | null {
  const host = (globalThis as { __MARINARA_HOST__?: { version?: unknown; stores?: { chat?: unknown } } })
    .__MARINARA_HOST__;
  const store = host?.version === 1 ? (host.stores?.chat as Partial<SliceStore> | undefined) : undefined;
  if (typeof store?.getState !== "function" || typeof store.subscribe !== "function") return null;
  const state = store.getState() as Partial<ChatSpatialSlice> | undefined;
  return state?.pendingSpatialTransitions instanceof Map && typeof state.setPendingSpatialTransition === "function"
    ? (store as SliceStore)
    : null;
}

function savedTransitions(): PendingSpatialTransitions {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Map();
    return new Map(
      parsed.filter(
        (entry): entry is [string, PendingSpatialTransitionDraft] =>
          Array.isArray(entry) &&
          typeof entry[0] === "string" &&
          !!entry[1] &&
          typeof entry[1] === "object" &&
          typeof (entry[1] as PendingSpatialTransitionDraft).transition?.commandId === "string" &&
          typeof (entry[1] as PendingSpatialTransitionDraft).transition?.destinationId === "string" &&
          typeof (entry[1] as PendingSpatialTransitionDraft).destinationName === "string",
      ),
    );
  } catch {
    return new Map();
  }
}

// An Engine without the namespace: the saved moves show, and nothing here changes them or writes the key.
function readOnlySlice(): SliceStore {
  const state: ChatSpatialSlice = {
    pendingSpatialTransitions: savedTransitions(),
    setPendingSpatialTransition: () => undefined,
    clearPendingSpatialTransition: () => undefined,
  };
  return { getState: () => state, subscribe: () => () => undefined };
}

const chatStore = hostChatStore() ?? readOnlySlice();

export function getPendingSpatialTransition(chatId: string): PendingSpatialTransitionDraft | null {
  return chatStore.getState().pendingSpatialTransitions.get(chatId) ?? null;
}

export function usePendingSpatialTransition(chatId: string | null): PendingSpatialTransitionDraft | null {
  return useSyncExternalStore(
    chatStore.subscribe,
    () => (chatId ? getPendingSpatialTransition(chatId) : null),
    () => null,
  );
}

export function setPendingSpatialTransition(chatId: string, draft: PendingSpatialTransitionDraft): void {
  // The Engine hands the same draft back as a prop; storing it again would only save it again.
  if (getPendingSpatialTransition(chatId) === draft) return;
  chatStore.getState().setPendingSpatialTransition(chatId, draft);
}

export function clearPendingSpatialTransition(chatId: string, commandId?: string): void {
  chatStore.getState().clearPendingSpatialTransition(chatId, commandId);
}

export function setPendingSpatialTransitionStatus(
  chatId: string,
  status: PendingSpatialTransitionDraft["status"],
  reviewMessage?: string,
): void {
  const current = getPendingSpatialTransition(chatId);
  if (!current) return;
  // The Engine's own status setter has no review note, so the whole draft goes back through the setter.
  const normalizedReviewMessage = reviewMessage?.trim() || undefined;
  if (
    current.status === status &&
    (status === "ready" || !normalizedReviewMessage || current.reviewMessage === normalizedReviewMessage)
  ) {
    return;
  }
  const next = { ...current, status };
  if (status === "ready") delete next.reviewMessage;
  else if (normalizedReviewMessage) next.reviewMessage = normalizedReviewMessage;
  setPendingSpatialTransition(chatId, next);
}

/**
 * Advance a step-by-step transition after the host commits one hop. The target
 * remains the user's original destination, while the command identity and
 * expected current location move forward for the next turn.
 */
export function reconcileCommittedSpatialTravel(
  chatId: string,
  spatial: SpatialContextResponse,
  travel: ResolvedSpatialTravel,
): void {
  const pending = getPendingSpatialTransition(chatId);
  if (!pending || pending.transition.travelMode !== "step_by_step") return;
  if (travel.mode !== "step_by_step" || travel.complete || travel.remainingLocationIds.length === 0) {
    clearPendingSpatialTransition(chatId, pending.transition.commandId);
    return;
  }
  const definition = spatial.definition;
  const target = definition?.locations.find((location) => location.id === travel.targetLocationId);
  if (!definition || !spatial.currentLocationId || !target) {
    setPendingSpatialTransitionStatus(chatId, "needs_review", "The next route step is no longer available.");
    return;
  }
  const targetDestination = spatial.destinations.find((destination) => destination.id === travel.targetLocationId);
  const { reviewMessage: _reviewMessage, ...pendingWithoutReview } = pending;
  setPendingSpatialTransition(chatId, {
    ...pendingWithoutReview,
    transition: {
      ...pending.transition,
      destinationId: travel.targetLocationId,
      expectedDefinitionRevision: definition.revision,
      expectedCurrentLocationId: spatial.currentLocationId,
      commandId: generateClientId(),
    },
    destinationName: target.name,
    relation: targetDestination?.relation ?? pending.relation,
    ...(targetDestination?.label ? { label: targetDestination.label } : {}),
    status: "ready",
  });
}
