import { useSyncExternalStore } from "react";
import type { PendingSpatialTransition, SpatialDestinationRelation } from "@marinara-engine/shared";

const STORAGE_KEY = "marinara-pending-spatial-transitions";

export type PendingSpatialTransitionDraft = {
  transition: PendingSpatialTransition;
  destinationName: string;
  relation: SpatialDestinationRelation;
  label?: string;
  status: "ready" | "needs_review";
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
): void {
  const current = pendingTransitions.get(chatId);
  if (!current || current.status === status) return;
  setPendingSpatialTransition(chatId, { ...current, status });
}
