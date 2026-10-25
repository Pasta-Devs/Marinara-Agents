import { slurpFanTypeWeeklyBudget, type SlurpFanType } from "../../../../../shared/src/slp/slp-fan-types.js";
import { slurpLiveRoomRewind, type SlurpLiveRoom } from "./slp-live-room.js";

export type SlurpLivePhase = "warmup" | "main" | "finish";
/** `act` is a segment's title on stage; `shot` is the segment's camera brief, server only (never sent to viewers). */
export type SlurpLiveLineKind = "narration" | "crowd" | "reaction" | "picture" | "act" | "shot";
export type SlurpLiveEventKind = "tip" | "chat";
export type SlurpLiveMenuItem = { id: string; label: string; price: number; picture: boolean };
export type SlurpLiveOrder = {
  itemId: string;
  label: string;
  name: string;
  viewerId?: string;
  personaId?: string;
  at: number;
  served: boolean;
  /** The segment whose lines play this order; its picture waits until that segment is on. */
  servedIn?: number;
  requestId: string;
  status?: "pending" | "paid";
};
export type SlurpLiveSegment = { index: number; lease: string | null; claimedAt: string | null };
export type SlurpLiveLine = {
  at: number;
  kind: SlurpLiveLineKind;
  name?: string;
  text: string;
  personaId?: string;
  private?: boolean;
  mediaId?: string;
  /** Written ahead on a condition: `goal-open` lines drop out once the tip goal is hit. */
  requires?: "goal-open" | "goal-hit";
};
export type SlurpLiveEvent = {
  at: number;
  kind: SlurpLiveEventKind;
  name: string;
  amount?: number;
  text: string;
  requestId?: string;
  personaId?: string;
  private?: boolean;
  /** Sent by the player (chat or tip); her live reply answers these. */
  fromPlayer?: boolean;
  /** The player opened the show; hidden in chat, she greets them. `text` is "regular" or "new". */
  join?: boolean;
  /** Her own live reply to the player. */
  host?: boolean;
};
export type SlurpLivePrivate = { personaId: string; until: string; block: number };
export type SlurpLivePrivateClaim = {
  requestId: string;
  personaId: string;
  showId?: string;
  status: "pending" | "paid";
  block: number;
  at: string;
};
export type SlurpLivePicture = {
  personaId: string;
  trigger: string;
  status: "pending" | "ready";
  mediaId?: string;
  mediaPath?: string;
};
export type SlurpLivePictureViewer = { personaId: string; mode: "text" | "pictures"; seenAt: string | null };
export type SlurpLiveShow = {
  id: string;
  hostKind: "creator" | "player";
  hostId: string;
  startedAt: string;
  endsAt: string;
  endedAt: string | null;
  goal: number;
  raised: number;
  goalHitAt: string | null;
  script: SlurpLiveLine[];
  events: SlurpLiveEvent[];
  audienceTipKeys: string[];
  lastReplyAt: string | null;
  recapPostId: string | null;
  room: SlurpLiveRoom;
  crowd: string | null;
  menu: SlurpLiveMenuItem[];
  queue: SlurpLiveOrder[];
  segment: SlurpLiveSegment | null;
  lastSeenAt: string | null;
  missedSummary: string[] | null;
  announcedFor: string | null;
  reminders: string[];
  announcementPostId: string | null;
  startedNoticeAt: string | null;
  mode: "text" | "pictures";
  private: SlurpLivePrivate | null;
  privateClaims: SlurpLivePrivateClaim[];
  pictures: SlurpLivePicture[];
  pictureViewers: SlurpLivePictureViewer[];
  pictureViewerId: string | null;
  pictureSeenAt: string | null;
  pictureModeBusy?: boolean;
  privatePrice?: number;
  picturesAllowed?: boolean;
};

export function slurpLivePrivatePrice(ppvPrice: number): number {
  return Math.max(1, Math.round((Number.isFinite(ppvPrice) ? ppvPrice : 1) * 3));
}

export function slurpLivePrivateUntil(current: SlurpLivePrivate | null, personaId: string, at: Date): string {
  const base =
    current?.personaId === personaId && Date.parse(current.until) > at.getTime()
      ? Date.parse(current.until)
      : at.getTime();
  return new Date(base + 10 * 60_000).toISOString();
}

/** Pictures one viewer can have per show. */
export const SLURP_LIVE_PICTURE_CAP = 12;

/** A viewer starts in pictures mode when the show allows pictures and nobody else holds that mode. */
export function slurpLivePicturesFree(
  show: Pick<SlurpLiveShow, "picturesAllowed" | "pictureViewers" | "pictureViewerId">,
  personaId: string,
): boolean {
  return (
    show.picturesAllowed &&
    !(show.pictureViewers ?? []).some((item) => item.mode === "pictures" && item.personaId !== personaId) &&
    (!show.pictureViewerId || show.pictureViewerId === personaId)
  );
}

export function slurpLivePictureTriggers(show: SlurpLiveShow, personaId: string, at: Date): string[] {
  const viewer = (show.pictureViewers ?? []).find((item) => item.personaId === personaId);
  const pictureViewer =
    viewer ?? (show.pictureViewerId === personaId ? { mode: show.mode, seenAt: show.pictureSeenAt } : null);
  if (pictureViewer?.mode !== "pictures" || !slurpLiveWatched(pictureViewer.seenAt, at)) return [];
  const triggers: string[] = [];
  // The goal picture is made from 80% on, so it is ready when the goal is hit; it stays hidden until then.
  if (show.goalHitAt || show.raised >= show.goal * 0.8) triggers.push("goal");
  const lastSegment = Math.ceil((Date.parse(show.endsAt) - Date.parse(show.startedAt)) / SLURP_LIVE_SEGMENT_MS) - 1;
  if (
    show.segment?.index === lastSegment &&
    slurpLiveSegmentIndex(show, at) === lastSegment &&
    !show.segment.lease &&
    show.script.some((line) => line.at >= show.segment!.index * SLURP_LIVE_SEGMENT_MS && line.kind === "narration")
  )
    triggers.push("finale");
  for (const order of show.queue.filter(
    (item) =>
      item.served &&
      (item.servedIn ?? 0) <= slurpLiveSegmentIndex(show, at) &&
      show.menu.some((entry) => entry.id === item.itemId && entry.picture),
  ))
    triggers.push(`menu:${order.requestId}`);
  // Her camera brief for the current segment: one picture per segment, once the shot is on screen.
  const segmentStart = slurpLiveSegmentIndex(show, at) * SLURP_LIVE_SEGMENT_MS;
  const elapsedMs = at.getTime() - Date.parse(show.startedAt);
  if (
    show.script.some(
      (line) =>
        line.kind === "shot" &&
        line.at >= segmentStart &&
        line.at < segmentStart + SLURP_LIVE_SEGMENT_MS &&
        line.at <= elapsedMs &&
        (!line.personaId || line.personaId === personaId),
    )
  )
    triggers.push(`shot:${slurpLiveSegmentIndex(show, at)}`);
  if (show.private?.personaId === personaId && Date.parse(show.private.until) > at.getTime())
    triggers.push(`private:${show.private.block}`);
  const used = show.pictures.filter((picture) => picture.personaId === personaId);
  return (
    triggers
      .filter((trigger) => !used.some((picture) => picture.trigger === trigger))
      // A goal picture still hidden (goal not hit) does not take one of the 12 slots.
      .slice(
        0,
        Math.max(
          0,
          SLURP_LIVE_PICTURE_CAP - used.filter((picture) => picture.trigger !== "goal" || show.goalHitAt).length,
        ),
      )
  );
}

export function slurpLiveForViewer(show: SlurpLiveShow, personaId: string | null, at: Date): SlurpLiveShow {
  const isPrivate = !!show.private && Date.parse(show.private.until) > at.getTime();
  const privateViewer = isPrivate && show.private?.personaId === personaId;
  const goalHit = show.goalHitAt ? Date.parse(show.goalHitAt) - Date.parse(show.startedAt) : null;
  const pictureViewers = show.pictureViewers ?? [];
  const pictureViewer = pictureViewers.find((item) => item.personaId === personaId);
  const pictureMode =
    pictureViewer?.mode ??
    (show.pictureViewerId === personaId
      ? show.mode
      : personaId && slurpLivePicturesFree(show, personaId)
        ? "pictures"
        : "text");
  const pictureModeBusy =
    pictureViewers.some((item) => item.mode === "pictures" && item.personaId !== personaId) ||
    (!!show.pictureViewerId && show.pictureViewerId !== personaId);
  return {
    ...show,
    room: { ...show.room, before: undefined },
    private: isPrivate
      ? {
          personaId: privateViewer ? show.private!.personaId : "",
          until: show.private!.until,
          block: show.private!.block,
        }
      : null,
    privateClaims: [],
    pictures: [],
    pictureViewers: pictureViewers.filter((item) => item.personaId === personaId),
    mode: pictureMode,
    pictureViewerId: pictureViewer?.mode === "pictures" ? personaId : null,
    pictureSeenAt: pictureViewer?.seenAt ?? null,
    pictureModeBusy,
    script: show.script
      .filter(
        (line) =>
          line.kind !== "shot" &&
          (!line.personaId || line.personaId === personaId) &&
          (!isPrivate || privateViewer || !line.personaId) &&
          !(line.requires === "goal-open" && goalHit !== null && line.at >= goalHit) &&
          !(line.requires === "goal-hit" && goalHit === null),
      )
      .map((line) =>
        line.requires === "goal-hit" && goalHit !== null ? { ...line, at: Math.max(line.at, goalHit) } : line,
      ),
    events: show.events.filter((event) => !event.personaId || event.personaId === personaId),
    queue: show.queue.filter((order) => !order.personaId || order.personaId === personaId),
  };
}

export const SLURP_LIVE_EVENT_LIMIT = 200;
export const SLURP_LIVE_SEGMENT_MS = 4 * 60_000;

export type SlurpLiveScheduleSettings = {
  liveFrequency: "rare" | "normal" | "often";
  liveStartHour: number;
  liveEndHour: number;
  liveMinMinutes: number;
  liveMaxMinutes: number;
};

function liveHash(value: string): number {
  let hash = 0x811c9dc5;
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193);
  return hash >>> 0;
}

export function slurpLiveNextSlot(
  creatorId: string,
  previous: Date | null,
  now: Date,
  trend: number,
  settings: SlurpLiveScheduleSettings,
): { startsAt: Date; endsAt: Date; announcedFor: string | null } {
  const baseHours = { rare: 120, normal: 60, often: 30 }[settings.liveFrequency];
  const interval =
    (baseHours * (0.8 + (liveHash(`${creatorId}:${previous?.toISOString() ?? "first"}`) % 41) / 100)) /
    (1 + Math.min(2, Math.max(0, trend) / 100));
  const earliest = new Date(
    Math.max(
      now.getTime() + 7 * 3_600_000,
      previous
        ? previous.getTime() + interval * 3_600_000
        : now.getTime() + (liveHash(`${creatorId}:first`) % 24) * 3_600_000,
    ),
  );
  const startsAt = new Date(earliest);
  startsAt.setHours(settings.liveStartHour, 0, 0, 0);
  if (startsAt.getTime() < earliest.getTime()) startsAt.setDate(startsAt.getDate() + 1);
  const hours = settings.liveEndHour - settings.liveStartHour;
  while (true) {
    const offset = liveHash(`${creatorId}:${startsAt.toDateString()}`) % (hours * 60);
    startsAt.setHours(settings.liveStartHour, offset, 0, 0);
    if (startsAt.getTime() >= earliest.getTime()) break;
    startsAt.setDate(startsAt.getDate() + 1);
  }
  const span = settings.liveMaxMinutes - settings.liveMinMinutes + 1;
  const minutes = settings.liveMinMinutes + (liveHash(`${creatorId}:length:${startsAt.toISOString()}`) % span);
  const announced = liveHash(`${creatorId}:announce:${startsAt.toISOString()}`) % 2 === 0;
  return {
    startsAt,
    endsAt: new Date(startsAt.getTime() + minutes * 60_000),
    announcedFor: announced ? startsAt.toISOString() : null,
  };
}

export function slurpLiveAnnouncementDue(
  show: Pick<SlurpLiveShow, "id" | "startedAt" | "announcedFor" | "announcementPostId">,
  at: Date,
): boolean {
  if (!show.announcedFor || show.announcementPostId) return false;
  const leadHours = 2 + (liveHash(show.id) % 5);
  return (
    at.getTime() >= Date.parse(show.startedAt) - leadHours * 3_600_000 && at.getTime() < Date.parse(show.startedAt)
  );
}

export function slurpLiveAnnouncementText(startsAt: Date): string {
  return `Live at ${startsAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })} 🔴`;
}

export function slurpLiveDueNotifications(reminders: readonly string[], recipient: string | null): string[] {
  return [...new Set(reminders)].filter((id) => id !== recipient);
}

export function slurpLiveMayStart(
  shows: readonly Pick<SlurpLiveShow, "hostKind" | "hostId" | "startedNoticeAt" | "endedAt" | "endsAt">[],
  hostKind: "creator" | "player",
  hostId: string,
  at: Date,
): boolean {
  const active = shows.filter(
    (show) => show.startedNoticeAt && !show.endedAt && Date.parse(show.endsAt) > at.getTime(),
  );
  return (
    !active.some((show) => show.hostId === hostId) &&
    active.filter((show) => show.hostKind === hostKind).length < (hostKind === "creator" ? 2 : 1)
  );
}

export function slurpLiveCanWatch(personaId: string | undefined, validPersona: boolean): boolean {
  return !!personaId && validPersona;
}

export function slurpLiveAudienceTipDue(keys: readonly string[], key: string): boolean {
  return !keys.includes(key);
}

export function slurpLivePruneBefore(at: Date): string {
  return new Date(at.getTime() - 7 * 86_400_000).toISOString();
}

export function slurpLiveMenuClaimState(
  queue: readonly SlurpLiveOrder[],
  requestId: string,
  itemId: string,
  viewerId: string,
): "new" | "resume" | "duplicate" | "conflict" {
  const existing = queue.find((order) => order.requestId === requestId);
  if (!existing) return "new";
  if (existing.itemId !== itemId || existing.viewerId !== viewerId) return "conflict";
  return existing.status === "pending" ? "resume" : "duplicate";
}

export function slurpLiveMenuServed(queue: readonly SlurpLiveOrder[], requestId: string): SlurpLiveOrder[] | null {
  const order = queue.find((entry) => entry.requestId === requestId);
  if (!order || order.status !== "paid") return null;
  if (order.served) return [...queue];
  return queue.map((entry) => (entry.requestId === requestId ? { ...entry, served: true } : entry));
}

export function slurpLiveSegmentIndex(show: Pick<SlurpLiveShow, "startedAt">, at: Date): number {
  return Math.max(0, Math.floor((at.getTime() - Date.parse(show.startedAt)) / SLURP_LIVE_SEGMENT_MS));
}

/** The segment to write now: the current one until it is done, then the next one from halfway, so chat never runs dry. */
export function slurpLiveSegmentToWrite(
  show: Pick<SlurpLiveShow, "startedAt" | "endsAt" | "segment">,
  at: Date,
): number | null {
  const current = slurpLiveSegmentIndex(show, at);
  const segment = show.segment;
  if (!segment || segment.index < current || (segment.index === current && segment.lease)) return current;
  if (segment.index > current) return segment.index === current + 1 && segment.lease ? current + 1 : null;
  const total = Math.ceil((Date.parse(show.endsAt) - Date.parse(show.startedAt)) / SLURP_LIVE_SEGMENT_MS);
  const elapsed = at.getTime() - Date.parse(show.startedAt) - current * SLURP_LIVE_SEGMENT_MS;
  return current + 1 < total && elapsed >= SLURP_LIVE_SEGMENT_MS / 2 ? current + 1 : null;
}

/** A private show that starts after the next segment was written: drop that public segment so it is written again as private. */
export function slurpLiveDropAhead(
  show: Pick<SlurpLiveShow, "startedAt" | "segment" | "script" | "queue" | "room">,
  at: Date,
): Pick<SlurpLiveShow, "segment" | "script" | "queue" | "room"> | null {
  const current = slurpLiveSegmentIndex(show, at);
  const segment = show.segment;
  if (!segment || segment.index <= current || segment.lease) return null;
  const start = segment.index * SLURP_LIVE_SEGMENT_MS;
  return {
    segment: { index: current, lease: null, claimedAt: null },
    room: slurpLiveRoomRewind(show.room, segment.index),
    script: show.script.filter((line) => line.personaId || line.at < start),
    queue: show.queue.map((order) =>
      order.servedIn === segment.index ? { ...order, served: false, servedIn: undefined } : order,
    ),
  };
}

/** A segment written late squeezes its lines into the time it has left instead of dumping them at once. */
export function slurpLiveSegmentLineAt(index: number, lineAt: number, elapsed: number): number {
  const start = index * SLURP_LIVE_SEGMENT_MS;
  const offset = Math.max(0, Math.min(SLURP_LIVE_SEGMENT_MS - 1, lineAt));
  const from = elapsed + 2_000;
  if (start >= from) return start + offset;
  const left = Math.max(0, start + SLURP_LIVE_SEGMENT_MS - from);
  return from + Math.floor((offset * left) / SLURP_LIVE_SEGMENT_MS);
}

export function slurpLiveWatched(lastSeenAt: string | null, at: Date): boolean {
  return !!lastSeenAt && Date.parse(lastSeenAt) <= at.getTime() && Date.parse(lastSeenAt) >= at.getTime() - 90_000;
}

export function slurpLiveTipOffset(showId: string, fanId: string, durationMs: number): number {
  let hash = 0x811c9dc5;
  for (const char of `${showId}:${fanId}`) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193);
  return Math.floor(((hash >>> 0) / 0x100000000) * Math.max(1, durationMs));
}

export function slurpLiveFanDue(showId: string, fanId: string, durationMs: number, tipChance: number): number | null {
  if (!slurpLivePlayerTipDue({ fanId, showId, tipChance, seed: 1 })) return null;
  return slurpLiveTipOffset(showId, fanId, durationMs);
}

export const SLURP_LIVE_REACTIONS = ["Nice!", "Wow", "Yes!", "🔥", "❤️", "👏"] as const;

export function slurpLiveViewerCount(elapsed: number, duration: number, audience: number): number {
  const progress = Math.min(1, Math.max(0, elapsed / Math.max(1, duration)));
  return Math.max(1, Math.round(audience * (0.2 + 0.8 * Math.sin(Math.PI * progress))));
}

export function slurpLiveRecap(show: SlurpLiveShow): string {
  const top = slurpLiveTipTopper(show.events);
  return `Live show recap: ${show.raised} coins raised. Goal ${show.raised >= show.goal ? "reached" : "not reached"} (${show.goal}). ${top ? `Top tipper: ${top.name} (${top.amount} coins).` : "No tips were received."} ${show.queue.filter((order) => order.served).length} menu items served.`;
}

export function slurpLiveCapEvents(events: readonly SlurpLiveEvent[]): SlurpLiveEvent[] {
  // Tips stay for the whole show: tip dedupe and the recap totals read them. Only chat and the rest roll off.
  // ponytail: tips are bounded by fans per show plus player tips; cap them too if a show ever gets thousands.
  const others = events.filter((event) => event.kind !== "tip");
  if (others.length <= SLURP_LIVE_EVENT_LIMIT) return [...events];
  const drop = new Set(others.slice(0, others.length - SLURP_LIVE_EVENT_LIMIT));
  return events.filter((event) => !drop.has(event));
}

export function slurpLiveTipRequestSeen(events: readonly SlurpLiveEvent[], requestId: string): boolean {
  return events.some((event) => event.kind === "tip" && event.requestId === requestId);
}

export function slurpLiveClaimTipEvent(
  events: readonly SlurpLiveEvent[],
  raised: number,
  goal: number,
  event: SlurpLiveEvent,
) {
  if (event.requestId && slurpLiveTipRequestSeen(events, event.requestId)) return null;
  const nextRaised = raised + (event.amount ?? 0);
  return {
    events: slurpLiveCapEvents([...events, event]),
    raised: nextRaised,
    hitGoal: raised < goal && nextRaised >= goal,
  };
}

/** Her live replies come at most this often; lines sent in between are answered together. */
export const SLURP_LIVE_REPLY_GAP_MS = 8_000;

export function slurpLiveReplyClaimAllowed(lastReplyAt: string | null, at: Date): boolean {
  return !lastReplyAt || Date.parse(lastReplyAt) <= at.getTime() - SLURP_LIVE_REPLY_GAP_MS;
}

export function slurpLiveCrowdClaimAllowed(lastCrowdAt: string | null, at: Date): boolean {
  return !lastCrowdAt || Date.parse(lastCrowdAt) <= at.getTime() - 30_000;
}

export function slurpLivePlayerTipAmount(type: SlurpFanType, memberId: string): number {
  return Math.max(1, Math.round(slurpFanTypeWeeklyBudget(type, memberId) * type.spend.tipChance));
}

export function slurpLiveTipTopper(events: readonly SlurpLiveEvent[]): SlurpLiveEvent | null {
  return events
    .filter((event) => event.kind === "tip")
    .reduce<SlurpLiveEvent | null>(
      (best, event) => (!best || (event.amount ?? 0) > (best.amount ?? 0) ? event : best),
      null,
    );
}

export function slurpLivePlayerTipDue(input: {
  fanId: string;
  showId: string;
  tipChance: number;
  seed: number;
}): boolean {
  if (!(input.tipChance > 0)) return false;
  let hash = 0x811c9dc5;
  for (const char of `${input.showId}:${input.fanId}:${input.seed}`)
    hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193);
  return (hash >>> 0) / 0x100000000 < Math.min(1, input.tipChance);
}

export function slurpLiveParseLines(value: unknown): SlurpLiveLine[] {
  let parsed = value;
  if (typeof parsed === "string") {
    const unfenced = parsed
      .trim()
      .replace(/^```(?:json)?\s*/iu, "")
      .replace(/\s*```$/u, "");
    try {
      parsed = JSON.parse(unfenced) as unknown;
    } catch {
      return [];
    }
  }
  const rows = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object"
      ? (parsed as { lines?: unknown }).lines
      : null;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((line) => {
    if (!line || typeof line !== "object") return [];
    const item = line as Record<string, unknown>;
    const kind = item.kind;
    if (kind !== "narration" && kind !== "crowd" && kind !== "reaction" && kind !== "picture") return [];
    if (typeof item.text !== "string" || typeof item.at !== "number" || !Number.isFinite(item.at)) return [];
    return [
      {
        at: Math.max(0, item.at),
        kind,
        ...(typeof item.name === "string" ? { name: item.name } : {}),
        ...(typeof item.mediaId === "string" ? { mediaId: item.mediaId } : {}),
        ...(item.requires === "goal-open" ? { requires: "goal-open" as const } : {}),
        text: item.text.slice(0, 1000),
      },
    ];
  });
}

/** The segment's stage title and camera brief, stored as script lines at its start. */
export function slurpLiveActLines(parsed: unknown, at: number): SlurpLiveLine[] {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
  const item = parsed as Record<string, unknown>;
  return (["act", "shot"] as const).flatMap((kind) => {
    const text =
      typeof item[kind] === "string" ? (item[kind] as string).trim().slice(0, kind === "act" ? 60 : 300) : "";
    return text ? [{ at, kind, text }] : [];
  });
}

/** The camera brief of the segment a `shot:<n>` picture trigger names. */
export function slurpLiveShotText(show: Pick<SlurpLiveShow, "script">, trigger: string): string | undefined {
  if (!trigger.startsWith("shot:")) return undefined;
  const index = Number(trigger.slice(5));
  return show.script.find((line) => line.kind === "shot" && Math.floor(line.at / SLURP_LIVE_SEGMENT_MS) === index)
    ?.text;
}

export function slurpLiveScriptFailed(lines: readonly SlurpLiveLine[]): boolean {
  return lines.length === 0;
}

export function slurpLiveDurationMinutes(seed: number): number {
  const value = Math.abs(Math.trunc(seed)) % 21;
  return 20 + value;
}

export function slurpLivePhase(
  show: Pick<SlurpLiveShow, "startedAt" | "endsAt" | "goal" | "raised" | "goalHitAt">,
  now = new Date(),
): SlurpLivePhase {
  if (show.goalHitAt || show.raised >= show.goal) return "finish";
  const start = Date.parse(show.startedAt);
  const end = Date.parse(show.endsAt);
  return now.getTime() >= start + Math.max(0, end - start) * 0.8
    ? "finish"
    : now.getTime() < start + (end - start) * 0.2
      ? "warmup"
      : "main";
}

export function slurpLiveVisible(show: Pick<SlurpLiveShow, "startedAt" | "script" | "events">, now = new Date()) {
  const at = now.getTime() - Date.parse(show.startedAt);
  return {
    script: show.script.filter((line) => line.at <= at),
    events: show.events.filter((event) => event.at <= at),
  };
}

export function slurpLiveTipSchedule(types: readonly SlurpFanType[], seed: number, durationMinutes: number) {
  const eligible = types.filter((type) => type.enabled && type.spend.tipChance > 0);
  return eligible.map((type, index) => ({
    at: ((Math.abs(seed) + index * 997) % Math.max(1, durationMinutes * 60)) * 1000,
    name: type.name,
    amount: Math.max(1, Math.round(type.spend.weeklyBudget[0] * type.spend.tipChance)),
  }));
}

export function slurpLiveTopTip(events: readonly SlurpLiveEvent[]) {
  return events.filter((event) => event.kind === "tip").sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))[0] ?? null;
}

export function slurpLivePrivateOffersDue(show: SlurpLiveShow): boolean {
  return (
    show.hostKind === "player" &&
    show.privateClaims.filter((claim) => claim.requestId.includes(":private-offer:")).length < 2
  );
}

export function slurpLiveMenuPriceInBounds(price: number): boolean {
  return Number.isInteger(price) && price >= 1 && price <= 9999;
}

export function slurpLivePlayerMenuDue(showId: string, fanId: string, segment: number): boolean {
  return liveHash(`${showId}:${fanId}:menu:${segment}`) % 4 === 0;
}

export function slurpLivePlayerRecapText(show: SlurpLiveShow): string {
  // Menu purchases are already added to `raised` when their order is claimed.
  const earnings =
    show.raised ??
    show.events.filter((event) => event.kind === "tip").reduce((total, event) => total + (event.amount ?? 0), 0);
  const topTipper = slurpLiveTipTopper(show.events)?.name ?? "nobody";
  const served = show.queue.filter((order) => order.served).length;
  return `Live show recap: ${earnings} earned, ${served} menu items served, top tipper: ${topTipper}.`;
}

export function slurpLiveReplyAllowed(lastReplyAt: string | null, now = new Date()) {
  return !lastReplyAt || now.getTime() - Date.parse(lastReplyAt) >= 60_000;
}

export function slurpLiveShouldStart(input: { active: boolean; slurpTrendScore?: number; random?: number }) {
  if (input.active) return false;
  const score = Math.max(0, input.slurpTrendScore ?? 0);
  const chance = Math.min(0.35, 0.03 + score / 1000);
  return (input.random ?? Math.random()) < chance;
}
