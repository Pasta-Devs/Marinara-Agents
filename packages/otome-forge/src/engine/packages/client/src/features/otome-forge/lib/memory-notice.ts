// ──────────────────────────────────────────────
// Otome Forge: what the story memory's status asks of the player, on every screen of an open story
// (components/MemoryBanner.tsx) and beside the connection that writes the summaries (Settings' MemorySection).
// ──────────────────────────────────────────────
// A failed summary (phase `error`, which the kit always marks retryable) is never silent: it offers Retry, with the
// provider's own words (a context that is too small, say), and the way to the Memory connection. Memory that waits
// because no connection can write summaries asks for one instead, while a finished chapter waits (or while the count
// is unknown). Ordinary catch-up (pending, stale) and ready memory ask for nothing.
import type { MemoryStatus } from "../shared/api-types";

/** The status as the client caches it: `retrying` while upkeep runs again after a failed summary. */
export type MemoryView = MemoryStatus & { retrying?: true };

export type MemoryNotice =
  /** Retry and the way to the connection; `message` is the provider's own, shortened, or null without one. */
  | { kind: "failed"; message: string | null }
  /** Upkeep runs again after a failure: its progress, the buttons kept. */
  | { kind: "retrying" }
  /** No connection can write summaries: the way to the connection, no Retry. */
  | { kind: "no-connection" }
  | null;

/** How much of the provider's message the banner shows; the whole of it is under Settings → Connections. */
export const NOTICE_MESSAGE_CHARACTERS = 200;

/**
 * The status just read, as cached. Upkeep that runs after a failed summary is its retry (a failed summary is never
 * retried by itself: a Retry here, in Settings or in another tab, or a chapter finished since) until it settles.
 */
export function nextMemoryView(before: MemoryView | undefined, status: MemoryStatus): MemoryView {
  return status.phase === "pending" && (before?.phase === "error" || before?.retrying)
    ? { ...status, retrying: true }
    : status;
}

/** The provider's message on one line, cut at a word within `limit` characters, or null when there is none. */
export function shortMessage(message: string | undefined, limit = NOTICE_MESSAGE_CHARACTERS): string | null {
  const text = (message ?? "").replace(/\s+/gu, " ").trim();
  if (!text) return null;
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > limit / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** What the status asks of the player (see the header), or null when it asks nothing. */
export function memoryNotice(view: MemoryView | undefined): MemoryNotice {
  if (!view) return null;
  if (view.noConnection && view.unsummarized !== 0) return { kind: "no-connection" };
  if (view.retrying && view.phase === "pending") return { kind: "retrying" };
  if (view.phase === "error") return { kind: "failed", message: shortMessage(view.message) };
  return null;
}

/**
 * A notice's Retry: offered on a failure, kept but running while the Retry request (`busy`) or the upkeep it started
 * runs, and none without a connection. Every notice also offers the way to the connection.
 */
export function retryAction(notice: NonNullable<MemoryNotice>, busy = false): "offered" | "running" | null {
  if (notice.kind === "no-connection") return null;
  return busy || notice.kind === "retrying" ? "running" : "offered";
}

/**
 * How often the status is read again, in ms: every 2 s while a retry runs, or while upkeep runs and the memory's own
 * section is open (`watching`, Settings); every 10 s for other upkeep (the catch-up after a chapter, which shows
 * nothing until it fails); and every 30 s otherwise, so a summary that fails in the background still shows.
 */
export function memoryPollMs(view: MemoryView | undefined, watching = false): number {
  if (view?.retrying || (watching && view?.phase === "pending")) return 2_000;
  return view?.phase === "pending" ? 10_000 : 30_000;
}
