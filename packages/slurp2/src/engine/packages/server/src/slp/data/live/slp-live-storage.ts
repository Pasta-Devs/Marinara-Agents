import type { DB } from "../../../db/connection.js";
import { and, desc, eq, isNotNull, isNull, lt, lte, or } from "../../../db/file-query.js";
import { slurpLiveShows } from "../../../db/schema/slurp.js";
import { newId } from "../../../utils/id-generator.js";
import { createSlurpLivePrivateStorage } from "./slp-live-private-storage.js";
import { slurpLiveMergeRoom, slurpLiveParseRoom, type SlurpLiveRoom } from "../../modules/live/slp-live-room.js";
import {
  slurpLiveCapEvents,
  slurpLiveClaimTipEvent,
  slurpLiveCrowdClaimAllowed,
  slurpLiveReplyClaimAllowed,
  SLURP_LIVE_REPLY_GAP_MS,
  slurpLiveSegmentToWrite,
  slurpLiveMenuClaimState,
  slurpLiveMenuServed,
  slurpLiveAudienceTipDue,
  slurpLivePruneBefore,
  slurpLiveMayStart,
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
  audienceTipKeys: parse(row.audienceTipKeys ?? "[]", []),
  lastReplyAt: row.lastReplyAt ?? null,
  recapPostId: row.recapPostId ?? null,
  room: slurpLiveParseRoom(row.room),
  menu: parse(row.menu ?? "[]", []),
  queue: parse(row.queue ?? "[]", []),
  segment: parse(row.segment ?? "null", null),
  lastSeenAt: row.lastSeenAt ?? null,
  missedSummary: parse(row.missedSummary ?? "null", null),
  announcedFor: row.announcedFor ?? null,
  reminders: parse(row.reminders ?? "[]", []),
  announcementPostId: row.announcementPostId ?? null,
  startedNoticeAt: row.startedNoticeAt === "legacy" ? row.startedAt : (row.startedNoticeAt ?? null),
  mode: row.mode === "pictures" ? "pictures" : "text",
  private: parse(row.privateState ?? "null", null),
  privateClaims: parse(row.privateClaims ?? "[]", []),
  pictures: parse(row.pictureStates ?? "[]", []),
  pictureViewers: parse(row.pictureViewers ?? "[]", []),
  pictureViewerId: row.pictureViewerId ?? null,
  pictureSeenAt: row.pictureSeenAt ?? null,
});
const decodeEvents = (value: string) => parse<SlurpLiveEvent[]>(value, []);
const capEvents = (events: SlurpLiveEvent[]) => slurpLiveCapEvents(events);

export function createSlurpLiveStorage(db: DB) {
  return {
    async list(limit = 20, at = new Date()) {
      const shows = (await db.select().from(slurpLiveShows).orderBy(desc(slurpLiveShows.startedAt)))
        .map(map)
        .filter((show) => show.startedNoticeAt && show.startedAt <= at.toISOString());
      return [
        ...shows.filter((show) => !show.endedAt && show.endsAt > at.toISOString()),
        ...shows.filter((show) => show.endedAt || show.endsAt <= at.toISOString()),
      ].slice(0, limit);
    },
    async upcomingAnnounced(at = new Date()) {
      return (await this.upcoming(at)).filter(
        (show) => !show.startedNoticeAt && show.announcedFor && show.announcementPostId,
      );
    },
    async get(id: string) {
      const rows = await db.select().from(slurpLiveShows).where(eq(slurpLiveShows.id, id));
      return rows[0] ? map(rows[0]) : null;
    },
    async byStirRequestId(requestId: string) {
      const rows = await db.select().from(slurpLiveShows).where(eq(slurpLiveShows.stirRequestId, requestId));
      return rows[0] ? map(rows[0]) : null;
    },
    async active() {
      const rows = await db
        .select()
        .from(slurpLiveShows)
        .where(and(isNull(slurpLiveShows.endedAt), isNotNull(slurpLiveShows.startedNoticeAt)))
        .limit(1);
      return rows[0] ? map(rows[0]) : null;
    },
    async activeShows(at = new Date()) {
      return (
        await db
          .select()
          .from(slurpLiveShows)
          .where(
            and(
              isNull(slurpLiveShows.endedAt),
              isNotNull(slurpLiveShows.startedNoticeAt),
              lte(slurpLiveShows.startedAt, at.toISOString()),
            ),
          )
      ).map(map);
    },
    async upcoming(at = new Date()) {
      return (
        await db
          .select()
          .from(slurpLiveShows)
          .where(and(isNull(slurpLiveShows.endedAt), lt(at.toISOString(), slurpLiveShows.startedAt)))
      ).map(map);
    },
    async planned() {
      return (
        await db
          .select()
          .from(slurpLiveShows)
          .where(and(isNull(slurpLiveShows.endedAt), isNull(slurpLiveShows.startedNoticeAt)))
      ).map(map);
    },
    async latestFor(hostId: string) {
      const rows = await db
        .select()
        .from(slurpLiveShows)
        .where(eq(slurpLiveShows.hostId, hostId))
        .orderBy(desc(slurpLiveShows.startedAt))
        .limit(1);
      return rows[0] ? map(rows[0]) : null;
    },
    async plan(
      hostId: string,
      startsAt: Date,
      endsAt: Date,
      announcedFor: string | null,
      goal: number,
      menu: SlurpLiveMenuItem[],
      requestId?: string,
      mode: "text" | "pictures" = "text",
    ) {
      return db.transaction(async (tx) => {
        if (requestId) {
          const existing = (
            await tx.select().from(slurpLiveShows).where(eq(slurpLiveShows.stirRequestId, requestId))
          )[0];
          if (existing) return map(existing);
        }
        const rows = await tx
          .select()
          .from(slurpLiveShows)
          .where(eq(slurpLiveShows.hostId, hostId))
          .orderBy(desc(slurpLiveShows.startedAt));
        // A not-yet-started plan gives way: an older one to the scheduler, any of them to a Stir request
        // (Stir takes over her slot). Shows whose end time passed never block.
        const replaced = new Set<string>();
        for (const planned of rows) {
          if (planned.endedAt || planned.startedNoticeAt) continue;
          if (requestId || planned.startedAt < startsAt.toISOString()) {
            await tx.delete(slurpLiveShows).where(eq(slurpLiveShows.id, planned.id));
            replaced.add(planned.id);
          }
        }
        const current = rows.filter(
          (planned) =>
            !planned.endedAt &&
            !replaced.has(planned.id) &&
            planned.endsAt > startsAt.toISOString() &&
            (requestId || !planned.startedNoticeAt || planned.startedAt >= startsAt.toISOString()),
        );
        if (current.length) return null;
        const row = {
          id: newId(),
          hostKind: "creator",
          hostId,
          startedAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          endedAt: null,
          goal: String(goal),
          raised: "0",
          goalHitAt: null,
          script: "[]",
          events: "[]",
          audienceTipKeys: "[]",
          lastReplyAt: null,
          recapPostId: null,
          menu: JSON.stringify(menu),
          queue: "[]",
          segment: null,
          lastSeenAt: null,
          missedSummary: null,
          announcedFor,
          reminders: "[]",
          announcementPostId: null,
          startedNoticeAt: null,
          mode,
          privateState: null,
          privateClaims: "[]",
          privateRequestId: null,
          pictureStates: "[]",
          pictureViewerId: null,
          pictureSeenAt: null,
          stirRequestId: requestId ?? null,
        };
        await tx.insert(slurpLiveShows).values(row);
        return map(row);
      });
    },
    async remind(id: string, personaId: string, at = new Date()) {
      return db.transaction(async (tx) => {
        const row = (await tx.select().from(slurpLiveShows).where(eq(slurpLiveShows.id, id)))[0];
        if (
          !row ||
          row.endedAt ||
          row.startedNoticeAt ||
          !row.announcedFor ||
          !row.announcementPostId ||
          row.startedAt <= at.toISOString()
        )
          return false;
        const reminders = parse<string[]>(row.reminders ?? "[]", []);
        if (!reminders.includes(personaId))
          await tx
            .update(slurpLiveShows)
            .set({ reminders: JSON.stringify([...reminders, personaId]) })
            .where(eq(slurpLiveShows.id, id));
        return true;
      });
    },
    async setAnnouncement(id: string, postId: string) {
      await db
        .update(slurpLiveShows)
        .set({ announcementPostId: postId })
        .where(and(eq(slurpLiveShows.id, id), isNull(slurpLiveShows.announcementPostId)));
    },
    async cancelUnstarted(id: string) {
      await db
        .delete(slurpLiveShows)
        .where(and(eq(slurpLiveShows.id, id), isNull(slurpLiveShows.startedNoticeAt), isNull(slurpLiveShows.endedAt)));
    },
    async startPlanned(id: string, at: Date) {
      return db.transaction(async (tx) => {
        const row = (await tx.select().from(slurpLiveShows).where(eq(slurpLiveShows.id, id)))[0];
        if (!row || row.endedAt || row.startedNoticeAt || row.startedAt > at.toISOString()) return null;
        const started = await tx
          .select()
          .from(slurpLiveShows)
          .where(and(isNull(slurpLiveShows.endedAt), isNotNull(slurpLiveShows.startedNoticeAt)));
        if (!slurpLiveMayStart(started, "creator", row.hostId, at)) return null;
        const delay = Math.max(0, at.getTime() - Date.parse(row.startedAt));
        const patch = {
          startedAt: at.toISOString(),
          endsAt: new Date(Date.parse(row.endsAt) + delay).toISOString(),
          startedNoticeAt: at.toISOString(),
        };
        await tx
          .update(slurpLiveShows)
          .set(patch)
          .where(
            and(
              eq(slurpLiveShows.id, id),
              isNull(slurpLiveShows.endedAt),
              isNull(slurpLiveShows.startedNoticeAt),
              lte(slurpLiveShows.startedAt, at.toISOString()),
            ),
          );
        const startedRow = (await tx.select().from(slurpLiveShows).where(eq(slurpLiveShows.id, id)))[0];
        if (!startedRow || startedRow.startedNoticeAt !== at.toISOString()) return null;
        return map(startedRow);
      });
    },
    async deferPlanned(id: string, at: Date) {
      return db.transaction(async (tx) => {
        const row = (await tx.select().from(slurpLiveShows).where(eq(slurpLiveShows.id, id)))[0];
        if (!row || row.startedNoticeAt || row.endedAt || row.startedAt > at.toISOString()) return null;
        const startsAt = new Date(at.getTime() + 15 * 60_000).toISOString();
        const patch = {
          startedAt: startsAt,
          endsAt: new Date(Date.parse(startsAt) + Date.parse(row.endsAt) - Date.parse(row.startedAt)).toISOString(),
          ...(row.announcedFor ? { announcedFor: startsAt } : {}),
        };
        await tx.update(slurpLiveShows).set(patch).where(eq(slurpLiveShows.id, id));
        return map({ ...row, ...patch });
      });
    },
    async pruneEnded(at: Date) {
      await db.delete(slurpLiveShows).where(lt(slurpLiveShows.endedAt, slurpLivePruneBefore(at)));
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
        audienceTipKeys: "[]",
        lastReplyAt: null,
        recapPostId: null,
        menu: JSON.stringify(input.menu ?? []),
        queue: "[]",
        segment: null,
        lastSeenAt: null,
        missedSummary: null,
        announcedFor: null,
        reminders: "[]",
        announcementPostId: null,
        startedNoticeAt: input.startedAt.toISOString(),
        mode: input.mode ?? "text",
        privateState: null,
        privateClaims: "[]",
        privateRequestId: null,
        pictureStates: "[]",
        pictureViewerId: null,
        pictureSeenAt: null,
        stirRequestId: null,
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
        const active = await tx
          .select()
          .from(slurpLiveShows)
          .where(and(isNull(slurpLiveShows.endedAt), isNotNull(slurpLiveShows.startedNoticeAt)));
        if (!slurpLiveMayStart(active, input.hostKind, input.hostId, input.startedAt)) return null;
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
          audienceTipKeys: "[]",
          lastReplyAt: null,
          recapPostId: null,
          menu: JSON.stringify(input.menu ?? []),
          queue: "[]",
          segment: null,
          lastSeenAt: null,
          missedSummary: null,
          announcedFor: null,
          reminders: "[]",
          announcementPostId: null,
          startedNoticeAt: input.startedAt.toISOString(),
          mode: input.mode ?? "text",
          privateState: null,
          privateClaims: "[]",
          privateRequestId: null,
          pictureStates: "[]",
          pictureViewerId: null,
          pictureSeenAt: null,
          stirRequestId: null,
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
    async seen(id: string, at: Date, viewerId?: string) {
      const current = viewerId ? await this.get(id) : null;
      const pictureViewer = current?.pictureViewers.find((viewer) => viewer.personaId === viewerId);
      await db
        .update(slurpLiveShows)
        .set({
          lastSeenAt: at.toISOString(),
          ...(viewerId && pictureViewer?.mode === "pictures"
            ? {
                pictureSeenAt: at.toISOString(),
                pictureViewers: JSON.stringify(
                  current!.pictureViewers.map((viewer) =>
                    viewer.personaId === viewerId ? { ...viewer, seenAt: at.toISOString() } : viewer,
                  ),
                ),
              }
            : {}),
        })
        .where(and(eq(slurpLiveShows.id, id), isNull(slurpLiveShows.endedAt)));
      return this.get(id);
    },
    ...createSlurpLivePrivateStorage(db),
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
        if (!row || row.endedAt || slurpLiveSegmentToWrite(map(row), at) !== index) return null;
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
    async completeSegment(
      id: string,
      index: number,
      lease: string,
      lines: SlurpLiveLine[],
      room: Partial<SlurpLiveRoom> = {},
      keptPromises = false,
    ) {
      return db.transaction(async (tx) => {
        const row = (await tx.select().from(slurpLiveShows).where(eq(slurpLiveShows.id, id)))[0];
        if (!row || row.endedAt) return false;
        const segment = parse<SlurpLiveShow["segment"]>(row.segment ?? "null", null);
        if (segment?.index !== index || segment.lease !== lease) return false;
        const current = parse<SlurpLiveShow["private"]>(row.privateState ?? "null", null);
        const isPrivate =
          !!current &&
          current.until > new Date(Date.parse(row.startedAt) + index * 240_000).toISOString() &&
          lines.some((line) => line.personaId === current.personaId);
        const roomBefore = slurpLiveParseRoom(row.room);
        const queue = parse<SlurpLiveOrder[]>(row.queue ?? "[]", []).map((order) =>
          order.served || isPrivate || order.status === "pending" || order.at > (index + 1) * 240_000
            ? order
            : { ...order, served: true, servedIn: index },
        );
        await tx
          .update(slurpLiveShows)
          .set({
            script: JSON.stringify([...parse<SlurpLiveLine[]>(row.script, []), ...lines]),
            queue: JSON.stringify(queue),
            segment: JSON.stringify({ index, lease: null, claimedAt: null }),
            room: JSON.stringify({
              ...slurpLiveMergeRoom(roomBefore, room, keptPromises),
              before: { ...slurpLiveMergeRoom(roomBefore, {}), index },
            }),
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
        if (slurpLiveMenuClaimState(queue, order.requestId, order.itemId, order.viewerId ?? "") !== "new") return false;
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
    async menuClaimState(id: string, requestId: string, itemId: string, viewerId: string) {
      const show = await this.get(id);
      return show ? slurpLiveMenuClaimState(show.queue, requestId, itemId, viewerId) : "conflict";
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
    async markMenuServed(id: string, requestId: string) {
      return db.transaction(async (tx) => {
        const row = (await tx.select().from(slurpLiveShows).where(eq(slurpLiveShows.id, id)))[0];
        if (!row || row.hostKind !== "player" || row.endedAt) return null;
        const queue = parse<SlurpLiveOrder[]>(row.queue ?? "[]", []);
        const next = slurpLiveMenuServed(queue, requestId);
        if (!next) return null;
        if (next.every((order, index) => order === queue[index])) return map(row);
        await tx
          .update(slurpLiveShows)
          .set({ queue: JSON.stringify(next) })
          .where(eq(slurpLiveShows.id, id));
        return map({ ...row, queue: JSON.stringify(next) });
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
        const audienceKey = event.requestId?.startsWith(`live:${id}:fan-tip:`) ? event.requestId : null;
        const keys = parse<string[]>(row.audienceTipKeys ?? "[]", []);
        if (audienceKey && !slurpLiveAudienceTipDue(keys, audienceKey)) return false;
        const claim = slurpLiveClaimTipEvent(events, Number(row.raised), Number(row.goal), event);
        if (!claim) return false;
        await tx
          .update(slurpLiveShows)
          .set({
            events: JSON.stringify(claim.events),
            ...(audienceKey ? { audienceTipKeys: JSON.stringify([...keys, audienceKey]) } : {}),
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
        const keys = parse<string[]>(row.audienceTipKeys ?? "[]", []);
        if (!removed) return false;
        const raised = Math.max(0, Number(row.raised) - (removed.amount ?? 0));
        await tx
          .update(slurpLiveShows)
          .set({
            events: JSON.stringify(capEvents(events.filter((item) => item !== removed))),
            ...(keys.includes(requestId)
              ? { audienceTipKeys: JSON.stringify(keys.filter((key) => key !== requestId)) }
              : {}),
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
        const cutoff = new Date(at.getTime() - SLURP_LIVE_REPLY_GAP_MS).toISOString();
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
    async claimPrivateOffer(id: string, personaId: string, requestId: string, at = new Date()) {
      return db.transaction(async (tx) => {
        const row = (await tx.select().from(slurpLiveShows).where(eq(slurpLiveShows.id, id)))[0];
        if (!row || row.hostKind !== "player" || row.endedAt) return false;
        const claims = parse<SlurpLiveShow["privateClaims"]>(row.privateClaims ?? "[]", []);
        if (claims.some((claim) => claim.requestId === requestId)) return false;
        const offers = claims.filter((claim) => claim.requestId.includes(":private-offer:"));
        if (offers.length >= 2) return false;
        const next = [...claims, { requestId, personaId, status: "pending" as const, block: 0, at: at.toISOString() }];
        await tx
          .update(slurpLiveShows)
          .set({ privateClaims: JSON.stringify(next) })
          .where(eq(slurpLiveShows.id, id));
        return true;
      });
    },
    async releaseReply(id: string, at: Date, previous: string | null = null) {
      await db
        .update(slurpLiveShows)
        .set({ lastReplyAt: previous })
        .where(and(eq(slurpLiveShows.id, id), eq(slurpLiveShows.lastReplyAt, at.toISOString())));
      return this.get(id);
    },
  };
}
