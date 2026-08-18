import { useSyncExternalStore } from "react";
import type {
  PendingSpatialTransition,
  ResolvedSpatialTravel,
  SpatialContextResponse,
  SpatialDestinationRelation,
} from "@marinara-engine/shared";
import { generateClientId } from "./package-utils";

const STORAGE_KEY = "marinara-pending-spatial-transitions";

export type PendingSpatialTransitionDraft = {
  transition: PendingSpatialTransition;
  destinationName: string;
  relation: SpatialDestinationRelation;
  label?: string;
  status: "ready" | "needs_review";
  reviewMessage?: string;
};

const listeners = new Set<() => void>();

function loadPendingTransitions(): Map<string, PendingSpatialTransitionDraft> {
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

let pendingTransitions = loadPendingTransitions();

function publish(next: Map<string, PendingSpatialTransitionDraft>): void {
  pendingTransitions = next;
  try {
    if (next.size === 0) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
  } catch {
    // Persistence is best-effort; the current tab still keeps the pending move.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPendingSpatialTransition(chatId: string): PendingSpatialTransitionDraft | null {
  return pendingTransitions.get(chatId) ?? null;
}

export function usePendingSpatialTransition(chatId: string | null): PendingSpatialTransitionDraft | null {
  return useSyncExternalStore(
    subscribe,
    () => (chatId ? getPendingSpatialTransition(chatId) : null),
    () => null,
  );
}

export function setPendingSpatialTransition(chatId: string, draft: PendingSpatialTransitionDraft): void {
  const next = new Map(pendingTransitions);
  next.set(chatId, draft);
  publish(next);
}

export function clearPendingSpatialTransition(chatId: string, commandId?: string): void {
  const current = pendingTransitions.get(chatId);
  if (!current || (commandId && current.transition.commandId !== commandId)) return;
  const next = new Map(pendingTransitions);
  next.delete(chatId);
  publish(next);
}

export function setPendingSpatialTransitionStatus(
  chatId: string,
  status: PendingSpatialTransitionDraft["status"],
  reviewMessage?: string,
): void {
  const current = pendingTransitions.get(chatId);
  if (!current) return;
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
