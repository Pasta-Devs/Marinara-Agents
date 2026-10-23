import type { DB } from "../../../db/connection.js";
import { desc, eq } from "../../../db/file-query.js";
import { slurpLiveShows } from "../../../db/schema/slurp.js";
import { newId } from "../../../utils/id-generator.js";
import type { SlurpLiveEvent, SlurpLiveLine, SlurpLiveShow } from "../../modules/live/slp-live.js";

const parse = <T>(value: string, fallback: T): T => { try { return JSON.parse(value) as T; } catch { return fallback; } };
const map = (row: typeof slurpLiveShows.$inferSelect): SlurpLiveShow => ({
  id: row.id, hostKind: row.hostKind as "creator" | "player", hostId: row.hostId, startedAt: row.startedAt, endsAt: row.endsAt,
  endedAt: row.endedAt ?? null, goal: Number(row.goal), raised: Number(row.raised), goalHitAt: row.goalHitAt ?? null,
  script: parse(row.script, []), events: parse(row.events, []), lastReplyAt: row.lastReplyAt ?? null, recapPostId: row.recapPostId ?? null,
});

export function createSlurpLiveStorage(db: DB) {
  return {
    async list(limit = 20) { return (await db.select().from(slurpLiveShows).orderBy(desc(slurpLiveShows.startedAt)).limit(limit)).map(map); },
    async get(id: string) { const rows = await db.select().from(slurpLiveShows).where(eq(slurpLiveShows.id, id)); return rows[0] ? map(rows[0]) : null; },
    async active() { const rows = await db.select().from(slurpLiveShows); return rows.map(map).find((show) => !show.endedAt) ?? null; },
    async create(input: { hostKind: "creator" | "player"; hostId: string; startedAt: Date; endsAt: Date; goal: number; script?: SlurpLiveLine[] }) {
      const row = { id: newId(), hostKind: input.hostKind, hostId: input.hostId, startedAt: input.startedAt.toISOString(), endsAt: input.endsAt.toISOString(), endedAt: null, goal: String(input.goal), raised: "0", goalHitAt: null, script: JSON.stringify(input.script ?? []), events: "[]", lastReplyAt: null, recapPostId: null };
      await db.insert(slurpLiveShows).values(row); return map(row);
    },
    async update(id: string, patch: Partial<{ endedAt: string | null; raised: number; goalHitAt: string | null; script: SlurpLiveLine[]; events: SlurpLiveEvent[]; lastReplyAt: string | null; recapPostId: string | null }>) {
      await db.update(slurpLiveShows).set({ ...patch, ...(patch.raised !== undefined ? { raised: String(patch.raised) } : {}), ...(patch.script ? { script: JSON.stringify(patch.script) } : {}), ...(patch.events ? { events: JSON.stringify(patch.events) } : {}) } as never).where(eq(slurpLiveShows.id, id));
      return this.get(id);
    },
  };
}
