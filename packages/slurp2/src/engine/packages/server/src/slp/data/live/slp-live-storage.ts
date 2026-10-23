import type { DB } from "../../../db/connection.js";
import { and, desc, eq, isNull, lte, or } from "../../../db/file-query.js";
import { slurpLiveShows } from "../../../db/schema/slurp.js";
import { newId } from "../../../utils/id-generator.js";
import {
  slurpLiveCapEvents,
  slurpLiveClaimTipEvent,
  slurpLiveCrowdClaimAllowed,
  slurpLiveReplyClaimAllowed,
  slurpLiveSegmentIndex,
  type SlurpLiveEvent,
  type SlurpLiveLine,
  type SlurpLiveShow,
  type SlurpLiveMenuItem,
  type SlurpLiveOrder,
} from "../../modules/live/slp-live.js";

const parse = <T>(value: string, fallback: T): T => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};
const map = (row: typeof slurpLiveShows.$inferSelect): SlurpLiveShow => ({
  id: row.id,
  hostKind: row.hostKind as "creator" | "player",
  hostId: row.hostId,
  startedAt: row.startedAt,
  endsAt: row.endsAt,
  endedAt: row.endedAt ?? null,
  goal: Number(row.goal),
  raised: Number(row.raised),
  goalHitAt: row.goalHitAt ?? null,
  script: parse(row.script, []),
  events: parse(row.events, []),
  lastReplyAt: row.lastReplyAt ?? null,
  recapPostId: row.recapPostId ?? null,
  menu: parse(row.menu ?? "[]", []),
  queue: parse(row.queue ?? "[]", []),
  segment: parse(row.segment ?? "null", null),
  lastSeenAt: row.lastSeenAt ?? null,
  missedSummary: parse(row.missedSummary ?? "null", null),
  announcedFor: row.announcedFor ?? null,
  mode: row.mode === "pictures" ? "pictures" : "text",
});
const decodeEvents = (value: string) => parse<SlurpLiveEvent[]>(value, []);
const capEvents = (events: SlurpLiveEvent[]) => slurpLiveCapEvents(events);

export function createSlurpLiveStorage(db: DB) {
  return {
    async list(limit = 20) {
      return (await db.select().from(slurpLiveShows).orderBy(desc(slurpLiveShows.startedAt)).limit(limit)).map(map);
    },
    async get(id: string) {
      const rows = await db.select().from(slurpLiveShows).where(eq(slurpLiveShows.id, id));
      return rows[0] ? map(rows[0]) : null;
    },
    async active() {
      const rows = await db.select().from(slurpLiveShows);
      return rows.map(map).find((show) => !show.endedAt) ?? null;
    },
    async activeShows() {
      return (await db.select().from(slurpLiveShows)).map(map).filter((show) => !show.endedAt);
    },
    async create(input: {
      hostKind: "creator" | "player";
      hostId: string;
      startedAt: Date;
      endsAt: Date;
      goal: number;
      script?: SlurpLiveLine[];
      menu?: SlurpLiveMenuItem[];
      mode?: "text" | "pictures";
    }) {
      const row = {
        id: newId(),
        hostKind: input.hostKind,
        hostId: input.hostId,
        startedAt: input.startedAt.toISOString(),
        endsAt: input.endsAt.toISOString(),
        endedAt: null,
        goal: String(input.goal),
        raised: "0",
        goalHitAt: null,
        script: JSON.stringify(input.script ?? []),
        events: "[]",
        lastReplyAt: null,
        recapPostId: null,
        menu: JSON.stringify(input.menu ?? []),
        queue: "[]",
        segment: null,
        lastSeenAt: null,
        missedSummary: null,
        announcedFor: null,
        mode: input.mode ?? "text",
      };
      await db.insert(slurpLiveShows).values(row);
      return map(row);
    },
    async createIfNone(input: {
      hostKind: "creator" | "player";
      hostId: string;
      startedAt: Date;
      endsAt: Date;
      goal: number;
      menu?: SlurpLiveMenuItem[];
      mode?: "text" | "pictures";
    }) {
      return db.transaction(async (tx) => {
        const rows = await tx.select().from(slurpLiveShows);
        const active = rows.filter((row) => !row.endedAt);
        if (
          active.some((row) => row.hostId === input.hostId) ||
          active.filter((row) => row.hostKind === input.hostKind).length >= (input.hostKind === "creator" ? 2 : 1)
        )
          return null;
        const row = {
          id: newId(),
          hostKind: input.hostKind,
          hostId: input.hostId,
          startedAt: input.startedAt.toISOString(),
          endsAt: input.endsAt.toISOString(),
          endedAt: null,
          goal: String(input.goal),
          raised: "0",
          goalHitAt: null,
          script: "[]",
          events: "[]",
          lastReplyAt: null,
          recapPostId: null,
          menu: JSON.stringify(input.menu ?? []),
          queue: "[]",
          segment: null,
          lastSeenAt: null,
          missedSummary: null,
          announcedFor: null,
          mode: input.mode ?? "text",
        };
        await tx.insert(slurpLiveShows).values(row);
        return map(row);
      });
    },
    async update(
      id: string,
      patch: Partial<{
        endedAt: string | null;
        raised: number;
        goalHitAt: string | null;
        script: SlurpLiveLine[];
        events: SlurpLiveEvent[];
        lastReplyAt: string | null;
        recapPostId: string | null;
        queue: SlurpLiveOrder[];
        missedSummary: string[] | null;
        lastSeenAt: string | null;
      }>,
    ) {
      await db
        .update(slurpLiveShows)
        .set({
          ...patch,
          ...(patch.raised !== undefined ? { raised: String(patch.raised) } : {}),
          ...(patch.script ? { script: JSON.stringify(patch.script) } : {}),
          ...(patch.events ? { events: JSON.stringify(capEvents(patch.events)) } : {}),
          ...(patch.queue ? { queue: JSON.stringify(patch.queue) } : {}),
          ...(patch.missedSummary !== undefined ? { missedSummary: JSON.stringify(patch.missedSummary) } : {}),
        } as never)
        .where(eq(slurpLiveShows.id, id));
      return this.get(id);
    },
    async seen(id: string, at: Date) {
      await db
        .update(slurpLiveShows)
        .set({ lastSeenAt: at.toISOString() })
        .where(and(eq(slurpLiveShows.id, id), isNull(slurpLiveShows.endedAt)));
      return this.get(id);
    },
    async claimMissed(id: string) {
      return db.transaction(async (tx) => {
        const row = (await tx.select().from(slurpLiveShows).where(eq(slurpLiveShows.id, id)))[0];
        if (!row || row.endedAt || row.missedSummary !== null) return false;
        await tx
          .update(slurpLiveShows)
          .set({ missedSummary: "[]" })
          .where(and(eq(slurpLiveShows.id, id), isNull(slurpLiveShows.missedSummary)));
        return (await tx.select().from(slurpLiveShows).where(eq(slurpLiveShows.id, id)))[0]?.missedSummary === "[]";
      });
    },
    async setMissed(id: string, lines: string[]) {
      await db
        .update(slurpLiveShows)
        .set({ missedSummary: JSON.stringify(lines) })
        .where(eq(slurpLiveShows.id, id));
    },
    async claimSegment(id: string, index: number, at: Date) {
      return db.transaction(async (tx) => {
        const row = (await tx.select().from(slurpLiveShows).where(eq(slurpLiveShows.id, id)))[0];
        if (!row || row.endedAt || slurpLiveSegmentIndex(map(row), at) !== index) return null;
        const segment = parse<SlurpLiveShow["segment"]>(row.segment ?? "null", null);
        if (
          segment &&
          (segment.index > index ||
            (segment.index === index &&
              (!segment.lease || (segment.claimedAt && Date.parse(segment.claimedAt) > at.getTime() - 120_000))))
        )
          return null;
        const lease = newId();
        await tx
          .update(slurpLiveShows)
          .set({ segment: JSON.stringify({ index, lease, claimedAt: at.toISOString() }) })
          .where(eq(slurpLiveShows.id, id));
        return lease;
      });
    },
    async completeSegment(id: string, index: number, lease: string, lines: SlurpLiveLine[]) {
      return db.transaction(async (tx) => {
        const row = (await tx.select().from(slurpLiveShows).where(eq(slurpLiveShows.id, id)))[0];
        if (!row || row.endedAt) return false;
        const segment = parse<SlurpLiveShow["segment"]>(row.segment ?? "null", null);
        if (segment?.index !== index || segment.lease !== lease) return false;
        const queue = parse<SlurpLiveOrder[]>(row.queue ?? "[]", []).map((order) => ({
          ...order,
          served: order.served || (order.status !== "pending" && order.at <= (index + 1) * 240_000),
        }));
        await tx
          .update(slurpLiveShows)
          .set({
            script: JSON.stringify([...parse<SlurpLiveLine[]>(row.script, []), ...lines]),
            queue: JSON.stringify(queue),
            segment: JSON.stringify({ index, lease: null, claimedAt: null }),
          })
          .where(eq(slurpLiveShows.id, id));
        return true;
      });
    },
    async claimMenu(id: string, order: SlurpLiveOrder, amount: number) {
      return db.transaction(async (tx) => {
        const row = (await tx.select().from(slurpLiveShows).where(eq(slurpLiveShows.id, id)))[0];
        if (
          !row ||
          row.endedAt ||
          !parse<SlurpLiveMenuItem[]>(row.menu ?? "[]", []).some(
            (item) => item.id === order.itemId && item.price === amount,
          )
        )
          return false;
        const queue = parse<SlurpLiveOrder[]>(row.queue ?? "[]", []);
        if (queue.some((entry) => entry.requestId === order.requestId)) return false;
        const claim = slurpLiveClaimTipEvent(decodeEvents(row.events), Number(row.raised), Number(row.goal), {
          at: order.at,
          kind: "tip",
          name: order.name,
          amount,
          text: order.label,
          requestId: order.requestId,
        });
        if (!claim) return false;
        await tx
          .update(slurpLiveShows)
          .set({
            queue: JSON.stringify([...queue, { ...order, status: "pending" }]),
            events: JSON.stringify(claim.events),
            raised: String(claim.raised),
            ...(claim.hitGoal ? { goalHitAt: new Date().toISOString() } : {}),
          })
          .where(eq(slurpLiveShows.id, id));
        return true;
      });
    },
    async releaseMenu(id: string, requestId: string) {
      await this.releaseTip(id, requestId);
      const show = await this.get(id);
      if (show) await this.update(id, { queue: show.queue.filter((order) => order.requestId !== requestId) });
    },
    async confirmMenu(id: string, requestId: string) {
      return db.transaction(async (tx) => {
        const row = (await tx.select().from(slurpLiveShows).where(eq(slurpLiveShows.id, id)))[0];
        if (!row) return false;
        const queue = parse<SlurpLiveOrder[]>(row.queue ?? "[]", []);
        if (!queue.some((order) => order.requestId === requestId)) return false;
        await tx
          .update(slurpLiveShows)
          .set({
            queue: JSON.stringify(
              queue.map((order) => (order.requestId === requestId ? { ...order, status: "paid" } : order)),
            ),
          })
          .where(eq(slurpLiveShows.id, id));
        return true;
      });
    },
    async appendEvent(id: string, event: SlurpLiveEvent) {
      return db.transaction(async (tx) => {
        const rows = await tx.select().from(slurpLiveShows).where(eq(slurpLiveShows.id, id));
        const row = rows[0];
        if (!row || row.endedAt) return null;
        const events = capEvents([...decodeEvents(row.events), event]);
        await tx
          .update(slurpLiveShows)
          .set({ events: JSON.stringify(events) })
          .where(eq(slurpLiveShows.id, id));
        return map({ ...row, events: JSON.stringify(events) });
      });
    },
    async appendLine(id: string, line: SlurpLiveLine) {
      return db.transaction(async (tx) => {
        const rows = await tx.select().from(slurpLiveShows).where(eq(slurpLiveShows.id, id));
        const row = rows[0];
        if (!row || row.endedAt) return null;
        const script = parse<SlurpLiveLine[]>(row.script, []);
        const next = [...script, line];
        await tx
          .update(slurpLiveShows)
          .set({ script: JSON.stringify(next) })
          .where(eq(slurpLiveShows.id, id));
        return map({ ...row, script: JSON.stringify(next) });
      });
    },
    async claimTip(id: string, event: SlurpLiveEvent & { requestId?: string }) {
      return db.transaction(async (tx) => {
        const rows = await tx.select().from(slurpLiveShows).where(eq(slurpLiveShows.id, id));
        const row = rows[0];
        if (!row || row.endedAt) return false;
        const events = decodeEvents(row.events);
        const claim = slurpLiveClaimTipEvent(events, Number(row.raised), Number(row.goal), event);
        if (!claim) return false;
        await tx
          .update(slurpLiveShows)
          .set({
            events: JSON.stringify(claim.events),
            raised: String(claim.raised),
            ...(claim.hitGoal && !row.goalHitAt ? { goalHitAt: new Date().toISOString() } : {}),
          })
          .where(eq(slurpLiveShows.id, id));
        return true;
      });
    },
    async releaseTip(id: string, requestId: string) {
      return db.transaction(async (tx) => {
        const rows = await tx.select().from(slurpLiveShows).where(eq(slurpLiveShows.id, id));
        const row = rows[0];
        if (!row) return false;
        const events = decodeEvents(row.events);
        const removed = events.find((item) => item.requestId === requestId);
        if (!removed) return false;
        const raised = Math.max(0, Number(row.raised) - (removed.amount ?? 0));
        await tx
          .update(slurpLiveShows)
          .set({
            events: JSON.stringify(capEvents(events.filter((item) => item !== removed))),
            raised: String(raised),
            ...(raised < Number(row.goal) ? { goalHitAt: null } : {}),
          })
          .where(eq(slurpLiveShows.id, id));
        return true;
      });
    },
    async claimReply(id: string, at: Date) {
      return db.transaction(async (tx) => {
        const rows = await tx.select().from(slurpLiveShows).where(eq(slurpLiveShows.id, id));
        const row = rows[0];
        if (!row || row.endedAt) return false;
        const cutoff = new Date(at.getTime() - 60_000).toISOString();
        if (!slurpLiveReplyClaimAllowed(row.lastReplyAt ?? null, at)) return false;
        await tx
          .update(slurpLiveShows)
          .set({ lastReplyAt: at.toISOString() })
          .where(
            and(
              eq(slurpLiveShows.id, id),
              isNull(slurpLiveShows.endedAt),
              or(lte(slurpLiveShows.lastReplyAt, cutoff), isNull(slurpLiveShows.lastReplyAt)),
            ),
          );
        const claimed = (await tx.select().from(slurpLiveShows).where(eq(slurpLiveShows.id, id)))[0];
        return claimed?.lastReplyAt === at.toISOString();
      });
    },
    async claimCrowd(id: string, at: Date) {
      return db.transaction(async (tx) => {
        const row = (await tx.select().from(slurpLiveShows).where(eq(slurpLiveShows.id, id)))[0];
        if (
          !row ||
          row.endedAt ||
          row.hostKind !== "player" ||
          !slurpLiveCrowdClaimAllowed(row.lastReplyAt ?? null, at)
        )
          return false;
        const cutoff = new Date(at.getTime() - 30_000).toISOString();
        await tx
          .update(slurpLiveShows)
          .set({ lastReplyAt: at.toISOString() })
          .where(
            and(
              eq(slurpLiveShows.id, id),
              isNull(slurpLiveShows.endedAt),
              or(lte(slurpLiveShows.lastReplyAt, cutoff), isNull(slurpLiveShows.lastReplyAt)),
            ),
          );
        const claimed = (await tx.select().from(slurpLiveShows).where(eq(slurpLiveShows.id, id)))[0];
        return claimed?.lastReplyAt === at.toISOString();
      });
    },
    async finish(id: string, at: Date, recapPostId: string | null) {
      return db.transaction(async (tx) => {
        const rows = await tx.select().from(slurpLiveShows).where(eq(slurpLiveShows.id, id));
        const row = rows[0];
        if (!row || row.endedAt) return null;
        await tx
          .update(slurpLiveShows)
          .set({ endedAt: at.toISOString(), recapPostId })
          .where(and(eq(slurpLiveShows.id, id), isNull(slurpLiveShows.endedAt)));
        return this.get(id);
      });
    },
    async claimEnd(id: string, at: Date) {
      const row = (await db.select().from(slurpLiveShows).where(eq(slurpLiveShows.id, id)))[0];
      if (!row || row.endedAt || row.hostKind !== "player") return null;
      await db
        .update(slurpLiveShows)
        .set({ endedAt: at.toISOString() })
        .where(and(eq(slurpLiveShows.id, id), isNull(slurpLiveShows.endedAt)));
      const claimed = (await db.select().from(slurpLiveShows).where(eq(slurpLiveShows.id, id)))[0];
      return claimed?.endedAt === at.toISOString() ? map(claimed) : null;
    },
    async setRecap(id: string, recapPostId: string | null) {
      await db.update(slurpLiveShows).set({ recapPostId }).where(eq(slurpLiveShows.id, id));
      return this.get(id);
    },
    async releaseReply(id: string, at: Date) {
      await db
        .update(slurpLiveShows)
        .set({ lastReplyAt: null })
        .where(and(eq(slurpLiveShows.id, id), eq(slurpLiveShows.lastReplyAt, at.toISOString())));
      return this.get(id);
    },
  };
}
