/** The model calls of Meanwhile: beats, place tags, long-absence summary. Code decides, the model writes. */
import { DAY, hhmm, msToWall, wallToMs } from "./clock.js";
import { BIG_KINDS, KINDS, type Seed } from "./deck.js";
import { blocksFor, isRecord, placeOf, type PlaceTags } from "./routine.js";
import { PLACES, beatMessages, placeMessages, retryMessage, summaryMessages, type Msg } from "./prompts.js";
import { getMeanwhileRuntime, type Circle, type LifeEvent, type PromiseRecord, type Usage } from "./store.js";

/** How far a beat may start from its seed time. */
export const TIME_TOLERANCE_MIN = 90;
const LINE_MAX = 160;

export interface Gate {
  usage: Usage;
  /** Model calls left today for this Circle. */
  left(): number;
  /** Parsed JSON, or null when the reply is not JSON. Throws on a provider error. */
  complete(messages: Msg[], maxTokens: number, temperature?: number): Promise<unknown>;
}

export function usageRow(rows: readonly Usage[], circleId: string, now: number): Usage {
  const realDay = new Date(now).toISOString().slice(0, 10);
  return (
    rows.find((u) => u.circleId === circleId && u.realDay === realDay) ?? {
      realDay,
      circleId,
      calls: 0,
      promptTokens: 0,
      outputTokens: 0,
    }
  );
}

/** Resolves the Circle's model. Every call is counted before it runs, so a failure still costs a call. */
/** `over` ignores the daily limit (calls still count). `stop` ends the run at the next check. */
export async function makeGate(
  circle: Circle,
  row: Usage,
  opts: { over?: boolean; stop?: () => boolean } = {},
): Promise<Gate> {
  const runtime = getMeanwhileRuntime();
  const model = await runtime.languageModels.resolve(circle.connectionId);
  const usage = { ...row };
  return {
    usage,
    left: () => (opts.stop?.() ? 0 : opts.over ? Infinity : circle.budgetCallsPerDay - usage.calls),
    async complete(messages, maxTokens, temperature = 0.9) {
      usage.calls += 1;
      const out = await model.chatComplete(messages, {
        maxTokens,
        temperature,
        responseFormat: { type: "json_object" },
      });
      usage.promptTokens += out.usage?.promptTokens ?? 0;
      usage.outputTokens += out.usage?.completionTokens ?? 0;
      try {
        return runtime.json.parseJsonish(out.content ?? "");
      } catch {
        return null;
      }
    },
  };
}

export interface World {
  circle: Circle;
  cast: Record<string, { name: string; about: string }>;
  schedules: Record<string, unknown>;
  tags: readonly PlaceTags[];
  chatTruth: Record<string, number>;
  /** Persona names of the linked chats: the user must not appear in events. */
  personas: string[];
  /** Events known so far, for the last-14-days lines. */
  events: readonly LifeEvent[];
  /** Promises of this Circle. `beatDay` marks the ones it honours as kept. */
  promises: PromiseRecord[];
  now: number;
}

const line = (v: unknown, max = LINE_MAX) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");
const castNumber = (circle: Circle, id: string) => circle.castIds.indexOf(id);

/** "numbered cast line": name, one-line personality, and the day's blocks with places. */
function castLine(w: World, id: string, day: string): string {
  const places = w.tags.find((t) => t.characterId === id)?.byActivity ?? {};
  const blocks = blocksFor(w.schedules[id], day).map((b) => {
    const place = places[b.activity] ?? placeOf(b.activity);
    return `${hhmm(b.start)}-${hhmm(b.end % 1440)} ${b.activity}${place !== "unknown" ? ` (${place})` : ""}`;
  });
  const info = w.cast[id];
  return `${castNumber(w.circle, id)}: ${info?.name ?? "Someone"}${info?.about ? `, ${info.about}` : ""}. Today: ${blocks.join(", ")}`;
}

/** The last 14 days as one-liners before `toMs`, oldest first. */
export function oneLiners(w: World, toMs: number): string[] {
  const tz = w.circle.clock.timezone;
  return w.events
    .filter(
      (e) =>
        e.circleId === w.circle.id &&
        e.status === "accepted" &&
        e.weight !== "routine" &&
        Date.parse(e.end) <= toMs &&
        Date.parse(e.end) > toMs - 14 * DAY,
    )
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
    .slice(-30)
    .map((e) => `${msToWall(Date.parse(e.start), tz).slice(5, 10)} ${e.text}`);
}

/** Recent kinds, places and pairs, so the model does not repeat them. */
function motifs(w: World, toMs: number): string[] {
  const out = new Set<string>();
  for (const e of w.events) {
    if (e.circleId !== w.circle.id || e.weight === "routine" || e.weight === "summary") continue;
    if (Date.parse(e.end) > toMs || Date.parse(e.end) <= toMs - 14 * DAY) continue;
    out.add(`${e.kind}${e.place ? ` at ${e.place}` : ""}`);
    if (e.cast.length > 1) out.add(e.cast.map((id) => w.cast[id]?.name ?? id).join(" and "));
  }
  return [...out].slice(0, 12);
}

/** One filled beat for the first seed, with that seed's own cast numbers, so the model copies the shape. */
function exampleBeat(w: World, seed: Seed): string {
  const nums = seed.cast.map((id) => castNumber(w.circle, id));
  const names = seed.cast.map((id) => w.cast[id]?.name ?? "Someone");
  return JSON.stringify({
    seed: "s1",
    start: seed.time,
    end: hhmm(((minutes(seed.time) ?? 0) + 30) % 1440),
    text: `${names.join(" and ")} spend half an hour at the ${seed.place}.`,
    diary: { [nums[0]!]: `That half hour at the ${seed.place} was the best part of my day.` },
    hook: { [nums[0]!]: `Wants to show you what they found at the ${seed.place}` },
  });
}

const SEASONS = [
  "winter",
  "winter",
  "spring",
  "spring",
  "spring",
  "summer",
  "summer",
  "summer",
  "autumn",
  "autumn",
  "autumn",
  "winter",
];

/**
 * Words a line must not contain: the user's persona names, the {{user}} macro and, unless `secondPerson`
 * is false, "you". Edges use letters and digits, so names that end in "ë" still match.
 */
export function bannedWords(personas: string[], castNames: string[], secondPerson = true): RegExp {
  const cast = new Set(castNames.map((n) => n.toLowerCase()));
  const names = personas
    .filter((p) => p && !cast.has(p.toLowerCase()))
    .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const words = [...(secondPerson ? ["you", "your", "yours", "yourself"] : []), ...names];
  const parts = ["\\{\\{?user\\}?\\}"];
  if (words.length) parts.unshift(`(?<![\\p{L}\\p{N}])(?:${words.join("|")})(?![\\p{L}\\p{N}])`);
  return new RegExp(parts.join("|"), "iu");
}

export interface BeatCheck {
  circle: Circle;
  day: string;
  labels: ReadonlyMap<string, Seed>;
  used: Set<string>;
  kinds: ReadonlySet<string>;
  chatTruth: Record<string, number>;
  banned: RegExp;
  /** For hooks: persona names only, "you" is fine there. */
  bannedHook: RegExp;
  now: number;
  /** Circle now: a beat must end before it. */
  toMs: number;
}

const clock = /^(\d{2}):(\d{2})$/;
const minutes = (v: unknown) => {
  const m = typeof v === "string" ? clock.exec(v) : null;
  return m && +m[1]! < 24 && +m[2]! < 60 ? +m[1]! * 60 + +m[2]! : null;
};

/** One model beat against its seed. Returns the event, or the reason it was rejected. */
export function checkBeat(raw: unknown, c: BeatCheck): { label: string; event: LifeEvent } | string {
  if (!isRecord(raw)) return "A beat must be an object";
  const label = String(raw.seed);
  const seed = c.labels.get(label);
  if (!seed) return `Unknown seed ${label}`;
  if (c.used.has(label)) return `${label}: the seed was used twice`;
  const bad = (reason: string) => `${label}: ${reason}`;
  const tz = c.circle.clock.timezone;
  const a = minutes(raw.start);
  const b = minutes(raw.end);
  if (a === null || b === null || b <= a) return bad("start and end must be HH:MM on the day, with end after start");
  const seedMin = minutes(seed.time) ?? a;
  if (Math.abs(a - seedMin) > TIME_TOLERANCE_MIN)
    return bad(`start must be within ${TIME_TOLERANCE_MIN} minutes of ${seed.time}`);
  const start = wallToMs(`${c.day}T${hhmm(a)}`, tz);
  const end = wallToMs(`${c.day}T${hhmm(b)}`, tz);
  if (start === null || end === null) return bad("the time does not exist on that day");
  if (seed.cast.some((id) => start < (c.chatTruth[id] ?? 0)))
    return bad("it starts before the last chat with a cast member");
  const text = typeof raw.text === "string" ? raw.text.trim() : "";
  if (!text || text.length > 140) return bad("text must have 1 to 140 characters");
  if (c.banned.test(text)) return bad("text must not name or address the user");
  if (end > c.toMs) return bad("it ends in the future");
  if (!c.kinds.has(seed.kind)) return bad("the kind is not allowed");
  const inSeed = new Set(seed.cast.map((id) => String(castNumber(c.circle, id))));
  const byId = (field: unknown, banned: RegExp): Record<string, string> | string => {
    if (field === undefined) return {};
    if (!isRecord(field)) return bad("diary and hook must be objects");
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(field)) {
      if (!inSeed.has(key)) return bad(`cast number ${key} is not in the seed`);
      const id = c.circle.castIds[Number(key)]!;
      if (banned.test(line(value))) return bad("diary and hook must not name or address the user");
      if (line(value)) out[id] = line(value);
    }
    return out;
  };
  const diary = byId(raw.diary, c.banned);
  const hook = byId(raw.hook, c.bannedHook);
  if (typeof diary === "string") return diary;
  if (typeof hook === "string") return hook;
  const major = BIG_KINDS.includes(seed.kind);
  return {
    label,
    event: {
      id: `b:${seed.id}`,
      circleId: c.circle.id,
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
      createdAt: c.now,
      cast: seed.cast,
      place: seed.place,
      kind: seed.kind,
      weight: major ? "major" : "notable",
      text,
      source: "generated",
      // Big events wait for the user; the review queue itself is the next slice.
      status: major ? "proposed" : "accepted",
      visibility: "circle",
      seedId: seed.id,
      ...(Object.keys(diary).length ? { diary } : {}),
      ...(Object.keys(hook).length ? { hook } : {}),
    },
  };
}

/** One beat call for one Circle day, with one retry on a bad reply. Rejected beats are dropped. */
async function beatDay(w: World, gate: Gate, day: string, seeds: Seed[], toMs: number): Promise<LifeEvent[]> {
  const circle = w.circle;
  const labels = new Map(seeds.map((s, n) => [`s${n + 1}`, s] as const));
  const kinds = new Set([...(circle.allowedKinds.length ? circle.allowedKinds : KINDS), ...circle.bigKindsAllowed]);
  // Open promises that are due by this day, in the model's cast numbers.
  const due = w.promises.filter((p) => p.circleId === circle.id && p.status === "open" && p.due <= day);
  const base = beatMessages({
    promises: due.map((p) => `${castNumber(circle, p.characterId)}: ${line(p.text)}`),
    setting: circle.setting,
    day,
    weekday: new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }),
    season: SEASONS[Number(day.slice(5, 7)) - 1] ?? "spring",
    cast: circle.castIds.map((id) => castLine(w, id, day)),
    seeds: [...labels].map(([seed, s]) => ({
      seed,
      kind: s.kind,
      cast: s.cast.map((id) => castNumber(circle, id)),
      place: s.place,
      time: s.time,
    })),
    recent: oneLiners(w, toMs),
    avoid: motifs(w, toMs),
    pace: circle.pace,
    kinds: [...kinds],
    spicy: circle.allowedKinds.includes("spicy"),
    example: exampleBeat(w, [...labels][0]![1]),
  });
  const castNames = circle.castIds.map((id) => w.cast[id]?.name ?? "");
  const check: BeatCheck = {
    circle,
    day,
    labels,
    used: new Set(),
    kinds,
    chatTruth: w.chatTruth,
    banned: bannedWords(w.personas, castNames),
    bannedHook: bannedWords(w.personas, castNames, false),
    now: w.now,
    toMs,
  };
  const accepted = new Map<string, LifeEvent>();
  let messages = base;
  for (let attempt = 0; attempt < 2; attempt++) {
    const data = await gate.complete(messages, 1200);
    const list = isRecord(data) && Array.isArray(data.beats) ? data.beats : null;
    const errors: string[] = list
      ? list.length
        ? []
        : ["beats is empty"]
      : ["The reply must be JSON with a beats array"];
    for (const raw of list ?? []) {
      const result = checkBeat(raw, check);
      if (typeof result === "string") errors.push(result);
      else {
        accepted.set(result.label, result.event);
        check.used.add(result.label);
      }
    }
    const pending = [...labels.keys()].filter((l) => !accepted.has(l));
    if (!errors.length || !pending.length || gate.left() < 1) break;
    messages = [...base, retryMessage(errors, pending)];
  }
  // One hook per character per day: the first beat in time order keeps it.
  const told = new Set<string>();
  const events = [...accepted.values()].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  for (const e of events) {
    for (const id of Object.keys(e.hook ?? {})) {
      if (told.has(id)) delete e.hook![id];
      told.add(id);
    }
    if (e.hook && !Object.keys(e.hook).length) delete e.hook;
  }
  // A promise that has a beat for its character is kept; the event carries the anchor so an edit can mark it stale.
  for (const e of events) {
    for (const p of due) {
      if (!e.cast.includes(p.characterId)) continue;
      e.anchors = [...(e.anchors ?? []), p.anchor];
      if (e.visibility === "circle") e.visibility = p.visibility;
      p.status = "kept";
    }
  }
  return events;
}

export interface BeatRun {
  events: LifeEvent[];
  /** Days whose beats are done. */
  done: string[];
  /** First day left undone because of the budget. Null when all days ran. */
  stoppedAt: string | null;
}

/** Beat calls for the given Circle days in order, filling `run`. Stops at the budget. A provider error throws and `run` keeps what was done. */
export async function runBeats(
  run: BeatRun,
  w: World,
  gate: Gate,
  days: string[],
  seeds: readonly Seed[],
  toMs: number,
  onDay?: (done: number) => void,
): Promise<void> {
  for (const day of days) {
    const mine = seeds.filter((s) => s.circleId === w.circle.id && s.day === day);
    if (mine.length) {
      if (gate.left() < 1) {
        run.stoppedAt = day;
        return;
      }
      run.events.push(...(await beatDay({ ...w, events: [...w.events, ...run.events] }, gate, day, mine, toMs)));
    }
    run.done.push(day);
    onDay?.(run.done.length);
  }
}

/** Fills the unknown places once per schedule. Returns the tags, changed or not. */
export async function askPlaces(
  gate: Gate,
  tags: readonly PlaceTags[],
): Promise<{ tags: PlaceTags[]; changed: boolean }> {
  const todo = tags.filter((t) => !t.asked && Object.values(t.byActivity).includes("unknown"));
  const unknown = [
    ...new Set(
      todo.flatMap((t) =>
        Object.entries(t.byActivity)
          .filter(([, p]) => p === "unknown")
          .map(([a]) => a),
      ),
    ),
  ];
  if (!unknown.length || gate.left() < 1) return { tags: [...tags], changed: false };
  const data = await gate.complete(placeMessages(unknown), 400, 0.2);
  const answer = isRecord(data) ? data : {};
  return {
    changed: true,
    tags: tags.map((t) =>
      todo.includes(t)
        ? {
            ...t,
            asked: true,
            byActivity: Object.fromEntries(
              Object.entries(t.byActivity).map(([a, p]) => [
                a,
                p === "unknown" && PLACES.includes(String(answer[a])) ? String(answer[a]) : p,
              ]),
            ),
          }
        : t,
    ),
  };
}

/** Writes the text and diary of a long-absence summary event. A bad reply keeps the placeholder. */
export async function askSummary(w: World, gate: Gate, event: LifeEvent): Promise<void> {
  if (gate.left() < 1) return;
  const circle = w.circle;
  const tz = circle.clock.timezone;
  const data = await gate.complete(
    summaryMessages({
      setting: circle.setting,
      from: msToWall(Date.parse(event.start), tz).slice(0, 10),
      to: msToWall(Date.parse(event.end), tz).slice(0, 10),
      cast: circle.castIds.map(
        (id) =>
          `${castNumber(circle, id)}: ${w.cast[id]?.name ?? "Someone"}${w.cast[id]?.about ? `, ${w.cast[id]!.about}` : ""}`,
      ),
      recent: oneLiners(w, Date.parse(event.start)),
    }),
    600,
  );
  if (!isRecord(data)) return;
  const text = line(data.text, 280);
  if (text) event.text = text;
  const diary: Record<string, string> = {};
  if (isRecord(data.diary)) {
    for (const [key, value] of Object.entries(data.diary)) {
      const id = circle.castIds[Number(key)];
      if (id && line(value)) diary[id] = line(value);
    }
  }
  if (Object.keys(diary).length) event.diary = diary;
}
