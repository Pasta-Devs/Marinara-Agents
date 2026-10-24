import type { DB } from "../../../db/connection.js";
import { eq } from "../../../db/file-query.js";
import { slurpLiveShows } from "../../../db/schema/slurp.js";
import {
  slurpLiveDropAhead,
  slurpLivePictureTriggers,
  slurpLiveWatched,
  slurpLivePrivateUntil,
  type SlurpLiveLine,
  type SlurpLivePicture,
  type SlurpLivePrivateClaim,
  type SlurpLiveShow,
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

export function createSlurpLivePrivateStorage(db: DB) {
  return {
    async setMode(id: string, personaId: string, mode: "text" | "pictures", at: Date) {
      return db.transaction(async (tx) => {
        const row = (await tx.select().from(slurpLiveShows).where(eq(slurpLiveShows.id, id)))[0];
        if (!row || row.hostKind !== "creator" || !row.startedNoticeAt || row.endsAt <= at.toISOString()) return null;
        const viewers = parse<SlurpLiveShow["pictureViewers"]>(row.pictureViewers ?? "[]", []);
        const current = viewers.find((viewer) => viewer.personaId === personaId);
        await tx
          .update(slurpLiveShows)
          .set({
            mode,
            pictureViewers: JSON.stringify([
              ...viewers.filter((viewer) => viewer.personaId !== personaId),
              { personaId, mode, seenAt: mode === "pictures" ? at.toISOString() : (current?.seenAt ?? null) },
            ]),
            pictureViewerId:
              mode === "pictures" ? personaId : row.pictureViewerId === personaId ? null : row.pictureViewerId,
            pictureSeenAt:
              mode === "pictures" ? at.toISOString() : row.pictureViewerId === personaId ? null : row.pictureSeenAt,
          })
          .where(eq(slurpLiveShows.id, id));
        return mode;
      });
    },
    async privateClaim(id: string, personaId: string, requestId: string, at: Date) {
      return db.transaction(async (tx) => {
        const row = (await tx.select().from(slurpLiveShows).where(eq(slurpLiveShows.id, id)))[0];
        if (!row) return "unavailable" as const;
        const claims = parse<SlurpLivePrivateClaim[]>(row.privateClaims ?? "[]", []);
        const found = claims.find((claim) => claim.requestId === requestId);
        if (!row.hostKind || (!found && (row.endedAt || !row.startedNoticeAt || row.endsAt <= at.toISOString())))
          return "unavailable" as const;
        if (found)
          return found.personaId !== personaId || (found.showId !== undefined && found.showId !== id)
            ? ("conflict" as const)
            : found.status === "paid"
              ? ("duplicate" as const)
              : ("resume" as const);
        if (row.privateRequestId) return "busy" as const;
        const current = parse<SlurpLiveShow["private"]>(row.privateState ?? "null", null);
        if (current && current.personaId !== personaId && current.until > at.toISOString()) return "busy" as const;
        const block = Math.max(0, ...claims.map((claim) => claim.block)) + 1;
        await tx
          .update(slurpLiveShows)
          .set({
            privateClaims: JSON.stringify([
              ...claims,
              { requestId, personaId, showId: id, status: "pending", block, at: at.toISOString() },
            ]),
            privateRequestId: requestId,
          })
          .where(eq(slurpLiveShows.id, id));
        return "new" as const;
      });
    },
    async privateRelease(id: string, requestId: string) {
      return db.transaction(async (tx) => {
        const row = (await tx.select().from(slurpLiveShows).where(eq(slurpLiveShows.id, id)))[0];
        if (!row) return;
        const claims = parse<SlurpLivePrivateClaim[]>(row.privateClaims ?? "[]", []);
        await tx
          .update(slurpLiveShows)
          .set({
            privateClaims: JSON.stringify(claims.filter((claim) => claim.requestId !== requestId)),
            privateRequestId: row.privateRequestId === requestId ? null : row.privateRequestId,
          })
          .where(eq(slurpLiveShows.id, id));
      });
    },
    async privateConfirm(id: string, requestId: string, at: Date) {
      return db.transaction(async (tx) => {
        const row = (await tx.select().from(slurpLiveShows).where(eq(slurpLiveShows.id, id)))[0];
        if (!row) return null;
        const claims = parse<SlurpLivePrivateClaim[]>(row.privateClaims ?? "[]", []);
        const claim = claims.find((item) => item.requestId === requestId);
        if (!claim || (claim.showId && claim.showId !== id)) return null;
        if (claim.status === "paid") return map(row);
        const current = parse<SlurpLiveShow["private"]>(row.privateState ?? "null", null);
        if (current && current.personaId !== claim.personaId && current.until > at.toISOString()) return null;
        const privateState = {
          personaId: claim.personaId,
          until: row.endedAt ? at.toISOString() : slurpLivePrivateUntil(current, claim.personaId, at),
          block: claim.block,
        };
        const extending = !!current && current.until > at.toISOString();
        const dropped = extending ? null : slurpLiveDropAhead(map(row), at);
        const script = dropped?.script ?? parse<SlurpLiveLine[]>(row.script, []);
        const alreadyPrivateNotice = script.some((line) => line.text === "she went private 🔒");
        const withNotice =
          extending || alreadyPrivateNotice
            ? script
            : [
                ...script,
                { at: at.getTime() - Date.parse(row.startedAt), kind: "crowd" as const, text: "she went private 🔒" },
              ];
        const patch = {
          endsAt: row.endedAt
            ? row.endsAt
            : new Date(Math.max(Date.parse(row.endsAt), Date.parse(privateState.until))).toISOString(),
          privateState: JSON.stringify(privateState),
          privateRequestId: null,
          privateClaims: JSON.stringify(
            claims.map((item) => (item.requestId === requestId ? { ...item, status: "paid" } : item)),
          ),
          script: JSON.stringify(withNotice),
          ...(dropped
            ? {
                segment: JSON.stringify(dropped.segment),
                queue: JSON.stringify(dropped.queue),
                room: JSON.stringify(dropped.room),
              }
            : {}),
        };
        await tx.update(slurpLiveShows).set(patch).where(eq(slurpLiveShows.id, id));
        return map({ ...row, ...patch });
      });
    },
    async pictureClaim(id: string, personaId: string, trigger: string, at: Date) {
      return db.transaction(async (tx) => {
        const row = (await tx.select().from(slurpLiveShows).where(eq(slurpLiveShows.id, id)))[0];
        if (!row || row.endedAt) return false;
        const show = map(row);
        const viewer = show.pictureViewers.find((item) => item.personaId === personaId);
        const viewerShow = viewer ? { ...show, mode: viewer.mode, pictureSeenAt: viewer.seenAt } : show;
        if (!slurpLivePictureTriggers(viewerShow, personaId, at).includes(trigger)) return false;
        await tx
          .update(slurpLiveShows)
          .set({
            pictureStates: JSON.stringify([...show.pictures, { personaId, trigger, status: "pending" as const }]),
          })
          .where(eq(slurpLiveShows.id, id));
        return true;
      });
    },
    async pictureComplete(
      id: string,
      personaId: string,
      trigger: string,
      mediaId: string,
      mediaPath: string,
      at: Date,
    ) {
      return db.transaction(async (tx) => {
        const row = (await tx.select().from(slurpLiveShows).where(eq(slurpLiveShows.id, id)))[0];
        if (!row || row.endedAt) return false;
        const viewers = parse<SlurpLiveShow["pictureViewers"]>(row.pictureViewers ?? "[]", []);
        const viewer = viewers.find((item) => item.personaId === personaId);
        if ((viewer?.mode ?? (row.pictureViewerId === personaId ? "pictures" : "text")) !== "pictures") return false;
        if (!slurpLiveWatched(viewer?.seenAt ?? (row.pictureViewerId === personaId ? row.pictureSeenAt : null), at))
          return false;
        const pictures = parse<SlurpLivePicture[]>(row.pictureStates ?? "[]", []);
        if (
          !pictures.some(
            (picture) => picture.personaId === personaId && picture.trigger === trigger && picture.status === "pending",
          )
        )
          return false;
        const patch = {
          pictureStates: JSON.stringify(
            pictures.map((picture) =>
              picture.personaId === personaId && picture.trigger === trigger
                ? { ...picture, status: "ready", mediaId, mediaPath }
                : picture,
            ),
          ),
          script: JSON.stringify([
            ...parse<SlurpLiveLine[]>(row.script, []),
            { at: at.getTime() - Date.parse(row.startedAt), kind: "picture", text: "", mediaId, personaId },
          ]),
        };
        await tx.update(slurpLiveShows).set(patch).where(eq(slurpLiveShows.id, id));
        return true;
      });
    },
    async pictureRelease(id: string, personaId: string, trigger: string) {
      return db.transaction(async (tx) => {
        const row = (await tx.select().from(slurpLiveShows).where(eq(slurpLiveShows.id, id)))[0];
        if (!row) return;
        const pictures = parse<SlurpLivePicture[]>(row.pictureStates ?? "[]", []);
        await tx
          .update(slurpLiveShows)
          .set({
            pictureStates: JSON.stringify(
              pictures.filter((picture) => picture.personaId !== personaId || picture.trigger !== trigger),
            ),
          })
          .where(eq(slurpLiveShows.id, id));
      });
    },
  };
}
