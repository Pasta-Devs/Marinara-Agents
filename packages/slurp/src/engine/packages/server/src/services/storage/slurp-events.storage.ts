/**
 * The notification stream.
 *
 * Slurp reported nothing that happened. There was an unseen-post count and DM unread counts, and
 * no surface anywhere for a subscriber, a tip, an unlock, a milestone, or a loss. The world could
 * be made as alive as you like and the player would still see none of it.
 *
 * Every later stage of the live-world plan writes here rather than inventing its own surface.
 */
import { and, desc, eq, isNull } from "../../db/file-query.js";
import { newId, now } from "../../utils/id-generator.js";
import type { DB } from "../../db/connection.js";
import { slurpEvents } from "../../db/schema/slurp.js";
import { slurpEventWeight, type SlurpEventKind, type SlurpEventLike } from "../slurp/slurp-event-weight.js";

export type SlurpEvent = SlurpEventLike & {
  recipientPersonaId: string;
  creatorAccountId: string | null;
  subjectId: string | null;
  actorLabel: string | null;
  seenAt: string | null;
};

export type SlurpEventInput = {
  recipientPersonaId: string;
  kind: SlurpEventKind;
  creatorAccountId?: string | null;
  subjectId?: string | null;
  actorLabel?: string | null;
  amount?: number;
};

/**
 * Kept short. This is an activity feed, not an audit log, and the readable-handful rule means
 * anything older than the last few hundred events is never going to be read.
 */
const RETAIN = 300;

const int = (value: unknown): number => {
  const parsed = Number.parseInt(String(value ?? "0"), 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

function mapEvent(row: any): SlurpEvent {
  return {
    id: String(row.id),
    recipientPersonaId: String(row.recipientPersonaId),
    kind: String(row.kind) as SlurpEventKind,
    creatorAccountId: (row.creatorAccountId as string | null) ?? null,
    subjectId: (row.subjectId as string | null) ?? null,
    actorLabel: (row.actorLabel as string | null) ?? null,
    amount: int(row.amount),
    weight: int(row.weight),
    createdAt: String(row.createdAt),
    seenAt: (row.seenAt as string | null) ?? null,
  };
}

export function createSlurpEventsStorage(db: DB) {
  const storage = {
    /**
     * Record one event.
     *
     * Callers pass the kind and the amount; the weight is computed here so every writer scores the
     * same way and a new call site cannot quietly invent its own importance.
     */
    async record(input: SlurpEventInput): Promise<SlurpEvent | null> {
      if (!input.recipientPersonaId) return null;
      // Math.floor(NaN) is NaN, and a NaN weight would sort unpredictably for the life of the row.
      const raw = input.amount ?? 0;
      const amount = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
      const row = {
        id: newId(),
        recipientPersonaId: input.recipientPersonaId,
        kind: input.kind,
        creatorAccountId: input.creatorAccountId ?? null,
        subjectId: input.subjectId ?? null,
        actorLabel: input.actorLabel ?? null,
        amount: String(amount),
        weight: String(slurpEventWeight(input.kind, amount)),
        createdAt: now(),
        seenAt: null,
      };
      await db.insert(slurpEvents).values(row);
      return mapEvent(row);
    },

    /** Newest first. */
    async list(recipientPersonaId: string, limit = 60): Promise<SlurpEvent[]> {
      const rows = await db
        .select()
        .from(slurpEvents)
        .where(eq(slurpEvents.recipientPersonaId, recipientPersonaId))
        .orderBy(desc(slurpEvents.createdAt))
        .limit(limit);
      return rows.map(mapEvent);
    },

    /** Everything not yet marked seen, newest first. This is what the catch-up panel reads. */
    async listUnseen(recipientPersonaId: string, limit = 60): Promise<SlurpEvent[]> {
      const rows = await db
        .select()
        .from(slurpEvents)
        .where(and(eq(slurpEvents.recipientPersonaId, recipientPersonaId), isNull(slurpEvents.seenAt)))
        .orderBy(desc(slurpEvents.createdAt))
        .limit(limit);
      return rows.map(mapEvent);
    },

    async countUnseen(recipientPersonaId: string): Promise<number> {
      const rows = await db
        .select()
        .from(slurpEvents)
        .where(and(eq(slurpEvents.recipientPersonaId, recipientPersonaId), isNull(slurpEvents.seenAt)));
      return rows.length;
    },

    async markSeen(recipientPersonaId: string): Promise<void> {
      const timestamp = now();
      const rows = await db
        .select()
        .from(slurpEvents)
        .where(and(eq(slurpEvents.recipientPersonaId, recipientPersonaId), isNull(slurpEvents.seenAt)));
      for (const row of rows) {
        await db.update(slurpEvents).set({ seenAt: timestamp }).where(eq(slurpEvents.id, row.id));
      }
    },

    /**
     * Drop everything past the retention window for one persona.
     *
     * Runs after a write rather than on a timer: the table only grows when something happens, so
     * the moment something happens is the only moment it can need pruning.
     */
    async prune(recipientPersonaId: string): Promise<number> {
      const rows = await db
        .select()
        .from(slurpEvents)
        .where(eq(slurpEvents.recipientPersonaId, recipientPersonaId))
        .orderBy(desc(slurpEvents.createdAt));
      const stale = rows.slice(RETAIN);
      for (const row of stale) {
        await db.delete(slurpEvents).where(eq(slurpEvents.id, String(row.id)));
      }
      return stale.length;
    },

    /** Record and prune in one call, so no writer has to remember the second half. */
    async recordAndPrune(input: SlurpEventInput): Promise<SlurpEvent | null> {
      const event = await storage.record(input);
      if (event) await storage.prune(event.recipientPersonaId);
      return event;
    },
  };

  return storage;
}
