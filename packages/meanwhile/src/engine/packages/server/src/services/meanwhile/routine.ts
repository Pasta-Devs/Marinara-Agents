/** Schedules to routine events, place tags and one run's plan. Pure: no I/O, so tests run without an Engine. */
import { createHash } from "node:crypto";
import { hhmm, msToWall, shiftDay, wallToMs, type RunWindow } from "./clock.js";
import { dealDay, placeNudges, type DayBlock, type Seed } from "./deck.js";
import type { LifeEvent, Nudge } from "./store.js";

export interface PlaceTags {
  characterId: string;
  scheduleHash: string;
  byActivity: Record<string, string>;
  /** The model was asked about the unknown places of this schedule once. */
  asked?: boolean;
}

export const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
export const at = (v: unknown, key: string): unknown => (isRecord(v) ? v[key] : undefined);
export const json = (v: unknown): unknown => {
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
};

/** Text of a long-absence summary until the model fills it. */
export const SUMMARY_PLACEHOLDER = "Time passed.";

/** Name and a one-line personality from a character card. */
export function cardInfo(card: unknown): { name: string; about: string } {
  const parsed = json(card);
  const data = at(parsed, "data") ?? parsed;
  const text = (v: unknown) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "");
  return {
    name: text(at(data, "name")) || "Someone",
    about: (text(at(data, "personality")) || text(at(data, "description"))).slice(0, 100),
  };
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
// Characters without a schedule still live: sleep, day, evening.
const DEFAULT_DAY = [
  { start: 0, end: 420, activity: "sleeping", place: "" },
  { start: 420, end: 1080, activity: "working", place: "" },
  { start: 1080, end: 1440, activity: "relaxing at home", place: "" },
];

// ponytail: keyword guess, first match wins. Slice 3 asks the model about the "unknown" ones.
const PLACE_WORDS: [string, RegExp][] = [
  ["gym", /gym|work ?out|exercise|train|climb|yoga|lift/],
  ["school", /school|class|lecture|college|universit|study/],
  ["work", /work|office|shift|meeting|job|studio|desk|clinic/],
  ["cafe", /caf[eé]|coffee|brunch|lunch|restaurant/],
  ["bar", /\bbar\b|pub|drinks|club|party/],
  ["park", /park|walk|hike|jog|garden|outdoor/],
  ["shop", /shop|grocer|market|errand|store|mall/],
  ["out of town", /travel|trip|commute|flight|vacation|journey/],
  ["online", /game|gaming|stream|online|browse|scroll|social|video/],
  ["home", /sleep|nap|bed|home|relax|cook|clean|shower|breakfast|dinner|rest|wake/],
];

export function placeOf(activity: string): string {
  const text = activity.toLowerCase();
  return PLACE_WORDS.find(([, re]) => re.test(text))?.[0] ?? "unknown";
}

/** "06:00-08:00" to minutes. A range that ends before it starts runs past midnight. */
function parseBlock(time: string): { start: number; end: number } | null {
  const m = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m || +m[1]! > 23 || +m[3]! > 23 || +m[2]! > 59 || +m[4]! > 59) return null;
  const start = +m[1]! * 60 + +m[2]!;
  const end = +m[3]! * 60 + +m[4]!;
  return { start, end: end <= start ? end + 1440 : end };
}

function parseDay(list: unknown): DayBlock[] {
  return (Array.isArray(list) ? list : []).flatMap((b) => {
    const time = at(b, "time");
    const activity = at(b, "activity");
    const span = typeof time === "string" && typeof activity === "string" ? parseBlock(time) : null;
    return span
      ? [
          {
            ...span,
            activity: (activity as string).slice(0, 80),
            place: "",
            status: at(b, "status") as string | undefined,
          },
        ]
      : [];
  });
}

export function blocksFor(schedule: unknown, day: string): DayBlock[] {
  const [y, m, d] = day.split("-").map(Number);
  const name = DAY_NAMES[new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay()]!;
  const blocks = parseDay(at(at(schedule, "days"), name));
  return blocks.length ? blocks : DEFAULT_DAY;
}

/** The chat copy of a character's schedule wins over the card copy. */
export function pickSchedule(characterId: string, chatMetadata: unknown[], card: unknown): unknown {
  const ok = (s: unknown) => (isRecord(s) && isRecord(s.days) ? s : null);
  for (const meta of chatMetadata) {
    const found = ok(at(at(json(meta), "characterSchedules"), characterId));
    if (found) return found;
  }
  const data = json(card);
  return (
    ok(at(at(data, "extensions"), "conversationSchedule")) ??
    ok(at(at(at(data, "data"), "extensions"), "conversationSchedule"))
  );
}

/** Reuses the stored tags while the schedule is unchanged, so later model answers are kept. */
export function tagsFor(characterId: string, schedule: unknown, existing?: PlaceTags): PlaceTags {
  const hash = createHash("sha256")
    .update(JSON.stringify(schedule ?? null))
    .digest("hex")
    .slice(0, 16);
  if (existing?.scheduleHash === hash) return existing;
  const days = Object.values(isRecord(at(schedule, "days")) ? (at(schedule, "days") as object) : {});
  const activities = new Set([...DEFAULT_DAY, ...days.flatMap(parseDay)].map((b) => b.activity));
  return {
    characterId,
    scheduleHash: hash,
    byActivity: Object.fromEntries([...activities].map((a) => [a, placeOf(a)])),
  };
}

/**
 * What one run adds for the window: routine events, seeds for each Circle day and the place tags.
 * `chatTruth` is the Circle time of the newest linked chat message per character. Nothing starts before it.
 */
export function planLife(input: {
  circle: {
    id: string;
    castIds: string[];
    clock: { timezone: string };
    pace: string;
    allowedKinds: string[];
    bigKindsAllowed: string[];
  };
  window: RunWindow;
  schedules: Record<string, unknown>;
  chatTruth: Record<string, number>;
  tags: PlaceTags[];
  seeds: readonly Seed[];
  haveIds: ReadonlySet<string>;
  dealtDays: ReadonlySet<string>; // "circleId:day" for every day already dealt, even with zero seeds
  /** Characters with a major event waiting for the user: routine only, no new seeds. */
  holdIds?: ReadonlySet<string>;
  /** Open nudges of this Circle. */
  nudges?: readonly Nudge[];
  /** "circleId:day" for every day whose beat call is done. */
  beatDays?: ReadonlySet<string>;
  now: number;
}): { events: LifeEvent[]; seeds: Seed[]; tags: PlaceTags[]; dealtDays: string[] } {
  const { circle, window } = input;
  const tz = circle.clock.timezone;
  const fromMs = Date.parse(window.from);
  const toMs = Date.parse(window.to);
  const tags = new Map(input.tags.map((t) => [t.characterId, t]));
  for (const id of circle.castIds) tags.set(id, tagsFor(id, input.schedules[id], tags.get(id)));
  const events: LifeEvent[] = [];
  const dealt: Seed[] = [];
  const known = [...input.seeds];

  if (window.summary) {
    const id = `s:${circle.id}:${window.summary.from}`;
    if (!input.haveIds.has(id)) {
      events.push({
        id,
        circleId: circle.id,
        start: window.summary.from,
        end: window.summary.to,
        createdAt: input.now,
        cast: circle.castIds,
        kind: "summary",
        weight: "summary",
        text: SUMMARY_PLACEHOLDER,
        source: "summary",
        status: "accepted",
        visibility: "circle",
      });
    }
  }

  const firstDay = msToWall(fromMs, tz).slice(0, 10);
  const lastDay = msToWall(toMs, tz).slice(0, 10);
  const dealtDays: string[] = [];
  // Starts a day early so a block that runs past midnight and is still going at `from` is found.
  for (let day = shiftDay(firstDay, -1); day <= lastDay; day = shiftDay(day, 1)) {
    const byChar: Record<string, DayBlock[]> = {};
    for (const id of circle.castIds) {
      const byActivity = tags.get(id)!.byActivity;
      byChar[id] = blocksFor(input.schedules[id], day).map((b) => ({
        ...b,
        place: byActivity[b.activity] ?? "unknown",
      }));
      const from = Math.max(fromMs, input.chatTruth[id] ?? 0);
      for (const b of byChar[id]!) {
        const start = wallToMs(`${day}T${hhmm(b.start)}`, tz);
        if (start === null || start >= toMs) continue;
        const end = start + (b.end - b.start) * 60_000;
        if (end <= from) continue;
        // The id uses the block's own start, so a block already stored by an earlier run is not stored again.
        const eventId = `r:${circle.id}:${id}:${start}`;
        if (input.haveIds.has(eventId)) continue;
        events.push({
          id: eventId,
          circleId: circle.id,
          start: new Date(Math.max(start, from)).toISOString(), // a block in progress is cut at `from`
          end: new Date(end).toISOString(),
          createdAt: input.now,
          cast: [id],
          place: b.place,
          kind: "routine",
          weight: "routine",
          text: b.activity,
          source: "schedule",
          status: "accepted",
          visibility: "circle",
        });
      }
    }
    const marker = `${circle.id}:${day}`;
    if (day < firstDay || input.dealtDays.has(marker) || known.some((s) => s.circleId === circle.id && s.day === day))
      continue;
    const open = Object.fromEntries(Object.entries(byChar).filter(([id]) => !input.holdIds?.has(id)));
    const nudges = (input.nudges ?? [])
      .filter((n) => n.cast.every((id) => !input.holdIds?.has(id)))
      // One seed per nudge at a time: a seed whose day is not beaten yet still carries it.
      .filter((n) => !known.some((s) => s.nudgeId === n.id && !input.beatDays?.has(`${circle.id}:${s.day}`)))
      .map((n) => ({ ...n, startDay: msToWall(Date.parse(n.createdCircle), tz).slice(0, 10) }));
    const cards = placeNudges(dealDay({ circle, day, blocks: open, recent: known }), {
      circleId: circle.id,
      day,
      pace: circle.pace,
      nudges,
    });
    known.push(...cards);
    dealt.push(...cards);
    dealtDays.push(marker);
  }
  return { events, seeds: dealt, tags: [...tags.values()], dealtDays };
}

/** The block a character is in at a Circle time, read from the schedule. Null when none matches. */
export function currentBlock(
  schedule: unknown,
  nowMs: number,
  tz: string,
  byActivity: Record<string, string> = {},
): { activity: string; place: string; until: string; status?: string; left: number } | null {
  const wall = msToWall(nowMs, tz);
  const day = wall.slice(0, 10);
  const minute = +wall.slice(11, 13) * 60 + +wall.slice(14, 16);
  // Yesterday's blocks can run past midnight, so they are checked with a 1440 minute shift.
  for (const [d, shift] of [
    [day, 0],
    [shiftDay(day, -1), 1440],
  ] as const) {
    const b = blocksFor(schedule, d).find((x) => x.start - shift <= minute && minute < x.end - shift);
    if (b)
      return {
        activity: b.activity,
        place: byActivity[b.activity] ?? placeOf(b.activity),
        until: hhmm(b.end - shift),
        status: b.status,
        left: b.end - shift - minute,
      };
  }
  return null;
}
