import type { DB } from "../../../db/connection.js";
import { and, desc, eq, isNull, lte, or } from "../../../db/file-query.js";
import { slurpLiveShows } from "../../../db/schema/slurp.js";
import { newId } from "../../../utils/id-generator.js";
import { slurpLiveCapEvents, slurpLiveClaimTipEvent, slurpLiveCrowdClaimAllowed, slurpLiveReplyClaimAllowed, type SlurpLiveEvent, type SlurpLiveLine, type SlurpLiveShow } from "../../modules/live/slp-live.js";

const parse = <T>(value: string, fallback: T): T => { try { return JSON.parse(value) as T; } catch { return fallback; } };
const map = (row: typeof slurpLiveShows.$inferSelect): SlurpLiveShow => ({
  id: row.id, hostKind: row.hostKind as "creator" | "player", hostId: row.hostId, startedAt: row.startedAt, endsAt: row.endsAt,
  endedAt: row.endedAt ?? null, goal: Number(row.goal), raised: Number(row.raised), goalHitAt: row.goalHitAt ?? null,
  script: parse(row.script, []), events: parse(row.events, []), lastReplyAt: row.lastReplyAt ?? null, recapPostId: row.recapPostId ?? null,
});
const decodeEvents = (value: string) => parse<SlurpLiveEvent[]>(value, []);
const capEvents = (events: SlurpLiveEvent[]) => slurpLiveCapEvents(events);

export function createSlurpLiveStorage(db: DB) {
  return {
    async list(limit = 20) { return (await db.select().from(slurpLiveShows).orderBy(desc(slurpLiveShows.startedAt)).limit(limit)).map(map); },
    async get(id: string) { const rows = await db.select().from(slurpLiveShows).where(eq(slurpLiveShows.id, id)); return rows[0] ? map(rows[0]) : null; },
    async active() { const rows = await db.select().from(slurpLiveShows); return rows.map(map).find((show) => !show.endedAt) ?? null; },
    async create(input: { hostKind: "creator" | "player"; hostId: string; startedAt: Date; endsAt: Date; goal: number; script?: SlurpLiveLine[] }) {
      const row = { id: newId(), hostKind: input.hostKind, hostId: input.hostId, startedAt: input.startedAt.toISOString(), endsAt: input.endsAt.toISOString(), endedAt: null, goal: String(input.goal), raised: "0", goalHitAt: null, script: JSON.stringify(input.script ?? []), events: "[]", lastReplyAt: null, recapPostId: null };
      await db.insert(slurpLiveShows).values(row); return map(row);
    },
    async createIfNone(input: { hostKind: "creator" | "player"; hostId: string; startedAt: Date; endsAt: Date; goal: number }) {
      return db.transaction(async (tx) => {
        const rows = await tx.select().from(slurpLiveShows);
        if (rows.some((row) => !row.endedAt)) return null;
        const row = { id: newId(), hostKind: input.hostKind, hostId: input.hostId, startedAt: input.startedAt.toISOString(), endsAt: input.endsAt.toISOString(), endedAt: null, goal: String(input.goal), raised: "0", goalHitAt: null, script: "[]", events: "[]", lastReplyAt: null, recapPostId: null };
        await tx.insert(slurpLiveShows).values(row);
        return map(row);
      });
    },
    async update(id: string, patch: Partial<{ endedAt: string | null; raised: number; goalHitAt: string | null; script: SlurpLiveLine[]; events: SlurpLiveEvent[]; lastReplyAt: string | null; recapPostId: string | null }>) {
      await db.update(slurpLiveShows).set({ ...patch, ...(patch.raised !== undefined ? { raised: String(patch.raised) } : {}), ...(patch.script ? { script: JSON.stringify(patch.script) } : {}), ...(patch.events ? { events: JSON.stringify(capEvents(patch.events)) } : {}) } as never).where(eq(slurpLiveShows.id, id));
      return this.get(id);
    },
    async appendEvent(id: string, event: SlurpLiveEvent) {
      return db.transaction(async (tx) => {
        const rows = await tx.select().from(slurpLiveShows).where(eq(slurpLiveShows.id, id));
        const row = rows[0];
        if (!row || row.endedAt) return null;
        const events = capEvents([...decodeEvents(row.events), event]);
        await tx.update(slurpLiveShows).set({ events: JSON.stringify(events) }).where(eq(slurpLiveShows.id, id));
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
        await tx.update(slurpLiveShows).set({ script: JSON.stringify(next) }).where(eq(slurpLiveShows.id, id));
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
        await tx.update(slurpLiveShows).set({
          events: JSON.stringify(claim.events),
          raised: String(claim.raised),
          ...(claim.hitGoal && !row.goalHitAt ? { goalHitAt: new Date().toISOString() } : {}),
        }).where(eq(slurpLiveShows.id, id));
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
        await tx.update(slurpLiveShows).set({
          events: JSON.stringify(capEvents(events.filter((item) => item !== removed))),
          raised: String(raised),
          ...(raised < Number(row.goal) ? { goalHitAt: null } : {}),
        }).where(eq(slurpLiveShows.id, id));
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
        await tx.update(slurpLiveShows).set({ lastReplyAt: at.toISOString() }).where(
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
        if (!row || row.endedAt || row.hostKind !== "player" || !slurpLiveCrowdClaimAllowed(row.lastReplyAt ?? null, at)) return false;
        const cutoff = new Date(at.getTime() - 30_000).toISOString();
        await tx.update(slurpLiveShows).set({ lastReplyAt: at.toISOString() }).where(
          and(eq(slurpLiveShows.id, id), isNull(slurpLiveShows.endedAt), or(lte(slurpLiveShows.lastReplyAt, cutoff), isNull(slurpLiveShows.lastReplyAt))),
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
        await tx.update(slurpLiveShows).set({ endedAt: at.toISOString(), recapPostId }).where(and(eq(slurpLiveShows.id, id), isNull(slurpLiveShows.endedAt)));
        return this.get(id);
      });
    },
    async claimEnd(id: string, at: Date) {
      const row = (await db.select().from(slurpLiveShows).where(eq(slurpLiveShows.id, id)))[0];
      if (!row || row.endedAt || row.hostKind !== "player") return null;
      await db.update(slurpLiveShows).set({ endedAt: at.toISOString() }).where(and(eq(slurpLiveShows.id, id), isNull(slurpLiveShows.endedAt)));
      const claimed = (await db.select().from(slurpLiveShows).where(eq(slurpLiveShows.id, id)))[0];
      return claimed?.endedAt === at.toISOString() ? map(claimed) : null;
    },
    async setRecap(id: string, recapPostId: string | null) {
      await db.update(slurpLiveShows).set({ recapPostId }).where(eq(slurpLiveShows.id, id));
      return this.get(id);
    },
    async releaseReply(id: string, at: Date) {
      await db.update(slurpLiveShows).set({ lastReplyAt: null }).where(and(eq(slurpLiveShows.id, id), eq(slurpLiveShows.lastReplyAt, at.toISOString())));
      return this.get(id);
    },
  };
}
