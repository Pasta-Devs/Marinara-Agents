/**
 * Who may read a continuity record, and how a record's status may change.
 *
 * Pure and deterministic, like the other Slurp rule modules. Every read path filters through
 * `slurpContinuityReadable`, so privacy is decided in one place rather than at each prompt.
 *
 * ## Audience
 *
 * - A post reads the Creator's own facts: public ones, cross-platform ones, and their private plans
 *   and boundaries. It never reads anything that belongs to one fan.
 * - A fan's thread reads all of that, plus the private records of that same thread and no other.
 * - `canon_only` records exist for later adapters and reach only the editor.
 *
 * ## Reality
 *
 * Slurp reads what is literally true on Slurp: canon, Slurp, and campaign records. Conversation,
 * roleplay, and game records are stored for later adapters and never reach a Slurp prompt until
 * something explicitly promotes them. A scene is not history just because it happened.
 */

import type {
  SlurpAudienceScope,
  SlurpContinuityStatus,
  SlurpContinuitySurface,
  SlurpRealityScope,
} from "../../../../../shared/src/slp/slp-continuity.js";

const SURFACE_AUDIENCES: Record<SlurpContinuitySurface, readonly SlurpAudienceScope[]> = {
  public_post: ["creator_public", "cross_platform", "creator_private"],
  locked_post: ["creator_public", "cross_platform", "creator_private"],
  fan_thread: ["creator_public", "cross_platform", "creator_private", "thread_private", "fan_private"],
  creator_editor: [
    "creator_public",
    "cross_platform",
    "creator_private",
    "thread_private",
    "fan_private",
    "canon_only",
  ],
};

/** Audiences that belong to one thread and are only ever read inside it. */
const THREAD_BOUND: ReadonlySet<SlurpAudienceScope> = new Set(["thread_private", "fan_private"]);

const SLURP_REALITIES: ReadonlySet<SlurpRealityScope> = new Set(["canon", "slurp", "campaign"]);

/** Statuses a prompt may rely on. Proposed, disputed, and retracted records are never read. */
const READABLE_STATUSES: ReadonlySet<SlurpContinuityStatus> = new Set(["confirmed", "active"]);

export function slurpContinuityReadable(
  record: {
    audienceScope: SlurpAudienceScope;
    realityScope: SlurpRealityScope;
    status: SlurpContinuityStatus;
    threadId: string | null;
    expiresAt: string | null;
  },
  surface: SlurpContinuitySurface,
  context: { at: Date; threadId?: string | null },
): boolean {
  if (!SURFACE_AUDIENCES[surface].includes(record.audienceScope)) return false;
  if (THREAD_BOUND.has(record.audienceScope) && surface !== "creator_editor") {
    // A thread-bound record without a thread is unplaceable, so it is read nowhere but the editor.
    if (!record.threadId || record.threadId !== context.threadId) return false;
  }
  if (surface === "creator_editor") return true;
  if (!SLURP_REALITIES.has(record.realityScope)) return false;
  if (!READABLE_STATUSES.has(record.status)) return false;
  if (record.expiresAt && Date.parse(record.expiresAt) <= context.at.getTime()) return false;
  return true;
}

/**
 * Where a record's status may go.
 *
 * Retracted and rejected are final: a retracted fact must not come back through a later
 * extraction of the same source. A disputed record can be confirmed again or retracted.
 */
const STATUS_NEXT: Partial<Record<SlurpContinuityStatus, readonly SlurpContinuityStatus[]>> = {
  proposed: ["confirmed", "active", "rejected", "disputed"],
  confirmed: ["active", "expired", "disputed", "retracted"],
  active: ["confirmed", "expired", "disputed", "retracted"],
  expired: ["active", "retracted"],
  disputed: ["confirmed", "active", "retracted", "rejected"],
};

export function slurpContinuityCanMove(from: SlurpContinuityStatus, to: SlurpContinuityStatus): boolean {
  return STATUS_NEXT[from]?.includes(to) ?? false;
}

/** How long a finished record is kept before retention removes it. */
export const SLURP_CONTINUITY_FINISHED_RETENTION_MS = 30 * 24 * 60 * 60_000;
/** The most events one Creator keeps. Facts are not capped: they are few and edited by hand. */
export const SLURP_CONTINUITY_MAX_EVENTS = 500;

const FINISHED: ReadonlySet<SlurpContinuityStatus> = new Set(["expired", "retracted", "rejected"]);

/**
 * Which events retention removes: finished ones past their retention window, then the oldest of
 * whatever still exceeds the cap. `events` must be newest first.
 */
export function slurpContinuityPrunable<T extends { id: string; status: SlurpContinuityStatus; createdAt: string }>(
  events: readonly T[],
  at: Date,
): string[] {
  const doomed = new Set(
    events
      .filter(
        (event) =>
          FINISHED.has(event.status) &&
          at.getTime() - Date.parse(event.createdAt) > SLURP_CONTINUITY_FINISHED_RETENTION_MS,
      )
      .map((event) => event.id),
  );
  const kept = events.filter((event) => !doomed.has(event.id));
  for (const event of kept.slice(SLURP_CONTINUITY_MAX_EVENTS)) doomed.add(event.id);
  return [...doomed];
}

/** Bounds for any text written to the ledger, manual or extracted. */
export const SLURP_CONTINUITY_TEXT_MAX = 500;
export const SLURP_CONTINUITY_EVIDENCE_MAX = 1000;
