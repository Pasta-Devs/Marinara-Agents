import type {
  LtmNote,
  LtmStoryTime,
  LtmStoryTimeJump,
  LtmStoryTimeOrigin,
  LtmStoryTimeScan,
  LtmStoryTimeUnit,
} from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import { textHashForLtmSourceMaterial } from "../extraction/source-hash.js";
import { ltmSourceLastMessageNumber } from "../identity/chat-scope.js";

// Story dates: where in the story a chat piece or a memory happened. Pure functions, no I/O. A date keeps the story's
// own words; the only arithmetic is the day count below.

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const WEEKDAY_PATTERN = /\b(sun|mon|tues|wednes|thurs|fri|satur)day\b/i;
export type LtmWeekday = (typeof WEEKDAYS)[number];

// Lower is stronger. A weaker origin never replaces a stronger one.
const ORIGIN_RANK: Record<LtmStoryTimeOrigin, number> = {
  manual: 0,
  world_state: 1,
  game_clock: 1,
  message_time: 1,
  stated: 2,
};
// Typed by the user or read from the Engine for the piece's own messages, so the piece stays on these dates whatever
// its text says.
const PINNED_ORIGINS = new Set<LtmStoryTimeOrigin>(["manual", "world_state", "game_clock", "message_time"]);

/**
 * The date to keep when a new reading arrives. A stronger origin replaces a weaker one and an equal one refreshes it;
 * a weaker one never replaces a stronger one, so nothing automated replaces a date the user typed. A reading that holds
 * only a time of day gives way to a dated one, so a time-only Engine stamp does not hide a stated date.
 */
export function mergeStoryTime(existing: LtmStoryTime | undefined, incoming: LtmStoryTime | undefined) {
  if (!existing || !incoming) return incoming ?? existing;
  if (existing.origin !== "manual" && !existing.start.date && incoming.start.date) {
    // The old time of day is carried only when it was read from the same piece text (or no text is recorded for it).
    const carried =
        !existing.sourceHash || existing.sourceHash === incoming.sourceHash ? existing.start.time : undefined,
      time = incoming.start.time ?? carried;
    return time ? { ...incoming, start: { ...incoming.start, time } } : incoming;
  }
  return ORIGIN_RANK[incoming.origin] <= ORIGIN_RANK[existing.origin] ? incoming : existing;
}

/** A step after the last exact position: amount null is vague ("a few days"), unit null has no length at all. */
export type LtmStoryStep = Pick<LtmStoryTimeJump, "amount" | "unit">;

export type LtmStoryPosition =
  | { kind: "unknown" }
  // A stored date shown as written (a date the user typed on a memory).
  | { kind: "date"; origin: LtmStoryTimeOrigin; date?: string; time?: string }
  // A position in a chat's day count. anchor null counts days from the chat's first piece (Day 1); otherwise it counts
  // from the last date the story named. after holds the steps that could not be added exactly. origin is set when the
  // position is a stored date rather than a counted one.
  | {
      kind: "counted";
      anchor: string | null;
      days: number;
      after: LtmStoryStep[];
      weekday?: LtmWeekday;
      time?: string;
      origin?: LtmStoryTimeOrigin;
    };

export type LtmStoryDayPiece = {
  id: string;
  // Hash of the piece text now; a date or scan read from older text is ignored.
  sourceHash: string;
  storyTime?: LtmStoryTime;
  storyTimeScan?: LtmStoryTimeScan;
};

// steps: where the piece stands after each of its jumps, in order (empty when its jumps were not added).
export type LtmStoryDayResult = {
  id: string;
  start: LtmStoryPosition;
  end: LtmStoryPosition;
  steps: LtmStoryPosition[];
};

type DayState = { anchor: string | null; days: number; after: LtmStoryStep[]; weekday?: number };

const UNKNOWN: LtmStoryPosition = { kind: "unknown" };

/**
 * Walks one chat's pieces, given in message order, and returns where each starts and ends. Day 1 is the first piece.
 * Exact day and week jumps add days, and the weekday follows only from a named weekday plus such jumps. A vague jump
 * or a month or year jump drops the weekday and the exact day until the story names a date again. A piece with no
 * jump stays on the previous piece's day. A named date restarts the count from it; a weekday alone or a time of day
 * does not. `storyTime.start` is where a piece begins, before its jumps, and `storyTime.end` where it ends, after them.
 * A piece is counted only when every earlier piece is dated or scanned: after one that is neither, every later piece is
 * unknown, because its jumps are missing. A date the user typed or the Engine gave covers the whole piece: its jumps
 * are not added. A stated date or a scan read from older piece text is ignored; a date the user typed never is.
 * ponytail: counting runs within one chat, so a branch starts a new count at Day 1. Upgrade path: seed a branch from
 * its parent's piece at the branch point.
 */
export function countStoryDays(pieces: readonly LtmStoryDayPiece[]): LtmStoryDayResult[] {
  let state: DayState | undefined = { anchor: null, days: 0, after: [] };
  return pieces.map((piece) => {
    const storyTime = currentStoryTime(piece),
      scan = currentStoryTimeScan(piece);
    if (!state || (!storyTime?.start.date && !storyTime?.end?.date && !scan)) {
      state = undefined;
      return { id: piece.id, start: UNKNOWN, end: UNKNOWN, steps: [] };
    }
    let next: DayState = storyTime?.start.date ? markDate(state, storyTime.start.date) : state;
    const startOrigin = storyTime?.start.date ? storyTime.origin : undefined,
      start = position(next, storyTime?.start.time, startOrigin);
    // A pinned date covers the whole piece, so its text cannot move it. Without an end it ends where it began.
    const pinned = isPinnedStoryDate(storyTime),
      jumps = pinned ? [] : (scan?.jumps ?? []);
    const steps: LtmStoryPosition[] = [];
    for (const jump of jumps) {
      next = applyJump(next, jump);
      steps.push(position(next, undefined, undefined));
    }
    let endTime = jumps.length ? undefined : storyTime?.start.time,
      endOrigin = jumps.length ? undefined : startOrigin;
    if (storyTime?.end) {
      if (storyTime.end.date) next = markDate(next, storyTime.end.date);
      endTime = storyTime.end.time;
      endOrigin = storyTime.end.date || pinned ? storyTime.origin : undefined;
    }
    state = next;
    return { id: piece.id, start, end: position(next, endTime, endOrigin), steps };
  });
}

/** A piece's stored date, unless it was read from older piece text; a date the user typed is always current. */
export function currentStoryTime(piece: Pick<LtmStoryDayPiece, "sourceHash" | "storyTime">) {
  const { storyTime } = piece;
  return storyTime?.origin !== "manual" && storyTime?.sourceHash && storyTime.sourceHash !== piece.sourceHash
    ? undefined
    : storyTime;
}

/** The scan's result for a piece, unless it was read from older piece text. */
export function currentStoryTimeScan(piece: Pick<LtmStoryDayPiece, "sourceHash" | "storyTimeScan">) {
  return piece.storyTimeScan?.sourceHash === piece.sourceHash ? piece.storyTimeScan : undefined;
}

/** A date typed by the user or read from the Engine: the piece stays on it whatever its text says. */
export function isPinnedStoryDate(storyTime: LtmStoryTime | undefined) {
  return storyTime !== undefined && PINNED_ORIGINS.has(storyTime.origin) && !!storyTime.start.date;
}

function weekdayIn(text: string) {
  const match = WEEKDAY_PATTERN.exec(text);
  return match ? WEEKDAYS.findIndex((day) => day.toLowerCase().startsWith(match[1]!.toLowerCase())) : undefined;
}

/** True for a date that names only a weekday ("Monday", "on the Friday"), which does not restart the count. */
export function isWeekdayOnly(date: string) {
  return (
    weekdayIn(date) !== undefined &&
    !date
      .replace(WEEKDAY_PATTERN, "")
      .replace(/\b(on|the)\b/gi, "")
      .replace(/[\s\p{P}]+/gu, "")
  );
}

function markDate(state: DayState, date: string): DayState {
  const weekday = weekdayIn(date);
  if (!isWeekdayOnly(date)) return { anchor: date, days: 0, after: [], ...(weekday === undefined ? {} : { weekday }) };
  if (state.weekday === undefined || state.weekday === weekday) return { ...state, weekday };
  // The story names another weekday than the count reached, so time passed that no jump recorded. Say so; never
  // guess how much.
  return { ...state, after: [...state.after, { amount: null, unit: null }], weekday };
}

// ponytail: hours are not counted; a jump within the day is not a jump, and any jump drops the time of day. Upgrade
// path: an hour unit on jumps.
function applyJump(state: DayState, jump: LtmStoryStep): DayState {
  const step = { amount: jump.amount, unit: jump.unit },
    days =
      jump.amount !== null && (jump.unit === "day" || jump.unit === "week")
        ? jump.amount * (jump.unit === "week" ? 7 : 1)
        : undefined;
  if (days === undefined) return { anchor: state.anchor, days: state.days, after: [...state.after, step] };
  const weekday = state.weekday === undefined ? {} : { weekday: (state.weekday + days) % 7 };
  return state.after.length
    ? { anchor: state.anchor, days: state.days, after: [...state.after, step], ...weekday }
    : { anchor: state.anchor, days: state.days + days, after: [], ...weekday };
}

function position(state: DayState, time: string | undefined, origin: LtmStoryTimeOrigin | undefined): LtmStoryPosition {
  return {
    kind: "counted",
    anchor: state.anchor,
    days: state.days,
    after: state.after.map((step) => ({ ...step })),
    ...(state.weekday === undefined ? {} : { weekday: WEEKDAYS[state.weekday] }),
    ...(time ? { time } : {}),
    ...(origin ? { origin } : {}),
  };
}

const UNIT_ORDER: LtmStoryTimeUnit[] = ["year", "month", "week", "day"];

// The largest unit stands for the whole span; "about" marks a span that is not an exact number of days.
function describeSteps(steps: LtmStoryStep[]) {
  if (steps.some((step) => step.unit === null)) return "some time";
  const unit = UNIT_ORDER.find((candidate) => steps.some((step) => step.unit === candidate))!,
    same = steps.filter((step) => step.unit === unit);
  if (same.some((step) => step.amount === null)) return `a few ${unit}s`;
  const total = same.reduce((sum, step) => sum + step.amount!, 0),
    about = same.length < steps.length || unit === "month" || unit === "year";
  return `${about ? "about " : ""}${total} ${unit}${total === 1 ? "" : "s"}`;
}

/** Display text for a position: "Day 23 · Friday", "about 2 months after Day 23", "not worked out yet". */
export function formatStoryPosition(position: LtmStoryPosition, dot = " · ") {
  if (position.kind === "unknown") return "not worked out yet";
  if (position.kind === "date") return [position.date, position.time].filter(Boolean).join(", ");
  const steps: LtmStoryStep[] =
      position.anchor !== null && position.days
        ? [{ amount: position.days, unit: "day" }, ...position.after]
        : position.after,
    base = position.anchor ?? `Day ${position.days + 1}`,
    weekday =
      position.weekday && !(steps.length === 0 && position.anchor && weekdayIn(position.anchor) !== undefined)
        ? position.weekday
        : undefined,
    detail = [weekday, position.time].filter(Boolean).join(" ");
  if (steps.length) {
    const span = `${describeSteps(steps)} after ${base}`;
    return detail ? `${detail}, ${span}` : span;
  }
  if (!detail) return base;
  return position.anchor === null ? `${base}${dot}${detail}` : `${base}, ${detail}`;
}

export type LtmChatPiece = LtmNote & { provenance: NonNullable<LtmNote["provenance"]> };

// An archived piece is left out of the count, so a piece the user archived unscanned does not stop the chat's count.
export function isChatPiece(note: LtmNote | undefined): note is LtmChatPiece {
  return note?.type === "source" && note.status !== "archived" && note.provenance?.kind === "chat_transcript";
}

export function pieceOrder(note: LtmChatPiece): [number, number] {
  const part = /:part:(\d+)$/.exec(note.provenance.entryId ?? "");
  return [ltmSourceLastMessageNumber(note) ?? Number.MAX_SAFE_INTEGER, part ? Number(part[1]) : 1];
}

export function byPieceOrder(left: LtmChatPiece, right: LtmChatPiece) {
  const [leftMessage, leftPart] = pieceOrder(left),
    [rightMessage, rightPart] = pieceOrder(right);
  return leftMessage - rightMessage || leftPart - rightPart || left.id.localeCompare(right.id);
}

/** Each chat's count by piece id, so a caller resolving many notes counts each chat once. */
export type LtmStoryDayCounts = Map<string, Map<string, LtmStoryDayResult>>;

function countChat(chatId: string, notes: Iterable<LtmNote>) {
  const pieces = [...notes]
    .filter((note): note is LtmChatPiece => isChatPiece(note) && note.provenance.sourceId === chatId)
    .sort(byPieceOrder);
  return new Map(
    countStoryDays(
      pieces.map((note) => ({
        id: note.id,
        sourceHash: textHashForLtmSourceMaterial({ sourceText: note.sections.source?.text ?? "" }),
        ...(note.storyTime ? { storyTime: note.storyTime } : {}),
        ...(note.storyTimeScan ? { storyTimeScan: note.storyTimeScan } : {}),
      })),
    ).map((result) => [result.id, result]),
  );
}

// The chat pieces behind a memory's section contributions, in message order.
// ponytail: a memory drawing on pieces of several chats is dated from the chat of its newest contribution, since each
// chat counts on its own. Upgrade path: one count across a branch and its parent.
function contributingPieces(note: LtmNote, sourceNotesById: ReadonlyMap<string, LtmNote>) {
  const updatedAt = new Map<string, string>();
  for (const section of Object.values(note.sections))
    for (const contribution of section.contributions ?? []) {
      if (contribution.owner !== "source" || !isChatPiece(sourceNotesById.get(contribution.sourceNoteId))) continue;
      const previous = updatedAt.get(contribution.sourceNoteId);
      if (!previous || Date.parse(contribution.updatedAt) > Date.parse(previous))
        updatedAt.set(contribution.sourceNoteId, contribution.updatedAt);
    }
  const pieces = [...updatedAt.keys()].map((id) => sourceNotesById.get(id) as LtmChatPiece);
  if (!pieces.length) return [];
  const newest = pieces.reduce((latest, piece) =>
    Date.parse(updatedAt.get(piece.id)!) > Date.parse(updatedAt.get(latest.id)!) ? piece : latest,
  );
  return pieces.filter((piece) => piece.provenance.sourceId === newest.provenance.sourceId).sort(byPieceOrder);
}

export type LtmResolvedStoryTime = {
  start: LtmStoryPosition;
  end?: LtmStoryPosition;
  // Not a timeline event: the position of the newest piece the memory draws on, shown "as of".
  asOf?: true;
  // The chat pieces the position was read from, in message order.
  sourceNoteIds: string[];
};

/**
 * Where a note sits in the story: a date the user typed on it; else the chat pieces behind its section contributions
 * (a chat piece reads its own); else unknown. A piece's position is its stored date or, without one, its count.
 * `sourceNotesById` must hold every chat piece of the note's chat, since counting reads the earlier ones. A caller
 * resolving many notes passes one `counts` map, so each chat is counted once; it must not change the pieces between
 * calls. A chat piece is counted with itself as given, never from `counts`.
 */
export function resolveStoryTime(
  note: LtmNote,
  sourceNotesById: ReadonlyMap<string, LtmNote>,
  counts?: LtmStoryDayCounts,
): LtmResolvedStoryTime {
  if (!isChatPiece(note) && note.storyTime) {
    const { start, end, origin } = note.storyTime;
    return {
      start: { kind: "date", origin, ...start },
      ...(end ? { end: { kind: "date", origin, ...end } } : {}),
      sourceNoteIds: [],
    };
  }
  const pieces = isChatPiece(note) ? [note] : contributingPieces(note, sourceNotesById);
  const first = pieces[0],
    last = pieces.at(-1);
  if (!first || !last) return { start: UNKNOWN, sourceNoteIds: [] };
  const chatId = first.provenance.sourceId,
    counted = isChatPiece(note)
      ? countChat(chatId, new Map(sourceNotesById).set(note.id, note).values())
      : (counts?.get(chatId) ?? countChat(chatId, sourceNotesById.values()));
  if (counts && !isChatPiece(note)) counts.set(chatId, counted);
  const sourceNoteIds = pieces.map((piece) => piece.id);
  // ponytail: a timeline event spans its pieces, not the messages it came from. Upgrade path: per-unit dates from
  // the extractor.
  if (isChatPiece(note) || note.type === "timeline_event")
    return {
      start: counted.get(first.id)?.start ?? UNKNOWN,
      end: counted.get(last.id)?.end ?? UNKNOWN,
      sourceNoteIds,
    };
  return { start: counted.get(last.id)?.end ?? UNKNOWN, asOf: true, sourceNoteIds };
}

/**
 * The bracket prefix of a timeline bullet in the recall prompt: "3rd of Frostfall, evening", "Day 23, Friday",
 * "about 2 months after Day 23", "Day 3 to Day 5"; undefined when the start is not worked out.
 */
export function formatStoryTimeForPrompt(resolved: LtmResolvedStoryTime) {
  if (resolved.start.kind === "unknown") return undefined;
  const start = formatStoryPosition(resolved.start, ", "),
    end = resolved.end && resolved.end.kind !== "unknown" ? formatStoryPosition(resolved.end, ", ") : start;
  return end === start ? start : `${start} to ${end}`;
}

export type LtmStoryDateSource = LtmStoryTimeOrigin | "counted" | "unknown";

/**
 * What the Vault shows for a note: the date text, where it came from, and the quote of a date found in the text.
 * ponytail: the counted words ("Day", "about … after", weekdays) are English, as the recall prompt's. Upgrade path:
 * return the position and format it with locale keys on the client.
 */
export function describeStoryTime(note: LtmNote, sourceNotesById: ReadonlyMap<string, LtmNote>) {
  const resolved = resolveStoryTime(note, sourceNotesById),
    shown = resolved.start,
    piece = sourceNotesById.get((resolved.asOf ? resolved.sourceNoteIds.at(-1) : resolved.sourceNoteIds[0]) ?? ""),
    source: LtmStoryDateSource =
      shown.kind === "unknown" ? "unknown" : shown.kind === "date" ? shown.origin : (shown.origin ?? "counted"),
    evidence = source === "stated" && piece ? piece.storyTime?.evidence : undefined,
    end = resolved.end && resolved.end.kind !== "unknown" ? formatStoryPosition(resolved.end) : undefined,
    text = shown.kind === "unknown" ? undefined : formatStoryPosition(shown);
  return {
    ...(text ? { text } : {}),
    ...(end && end !== text ? { end } : {}),
    source,
    ...(evidence ? { evidence } : {}),
    ...(resolved.asOf ? { asOf: true as const } : {}),
    // The date the user typed on this note, for the edit field.
    ...(note.storyTime?.origin === "manual" ? { typed: note.storyTime } : {}),
  };
}
