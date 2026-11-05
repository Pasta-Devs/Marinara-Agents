// ──────────────────────────────────────────────
// Big Cheese: the Cheese Board, M1 "Playable" and M2 "Alive"
// (cheese-board.md)
// Set plays on meters, feelings, cards, time, threads, relations, secrets, ambition and rooms; Spin plans
// from one line through `board.plan`; a journal and Coming up; rewind and revert from snapshots.
// The code owns every number: each Set is validated by zod, then clamped by the core rules.
// ──────────────────────────────────────────────

import { randomBytes } from "node:crypto";
import type { CapabilityDocumentRecord, CapabilityDocumentStore } from "@marinara-engine/shared";
import { z } from "zod";
import { BOARD_PLAN_VERBS, runTask, type BoardPlanOutput, type ModelCall, type PlanBeat } from "./ai/tasks.js";
import { addCard } from "./core/cards.js";
import { TERM_WEEKS, WEEKS } from "./core/clock.js";
import {
  DAYS,
  HOURS,
  K,
  METERS,
  clamp,
  dayIndex,
  draft,
  kitOf,
  shiftRelation,
  type Run as Game,
} from "./core/index.js";
import { newId } from "./core/run.js";
import { closeThread, openStory, openThread, planCardBeat } from "./core/threads.js";
import { SLOTS, type Slot } from "./core/types.js";
import { view } from "./game.js";
import { BigCheeseError, PACKAGE_ID, upgradeGame, type Run, type RunStore } from "./store.js";

// ponytail: 20 play snapshots (cheese-board.md §8 says 50 plus a base snapshot); raise the cap and add the base once M4 needs it.
export const MAX_SNAPSHOTS = 20;
const MAX_MORNINGS = 7;
const MAX_ACTIONS = 8;
const PREVIEW_MS = 30 * 60 * 1000;
const PAGE = 20;

const bad = (message: string) => new BigCheeseError(400, message, "bad-request");
const conflict = () => new BigCheeseError(409, "The run changed. Reload it.", "conflict");
const wrongPhase = (message: string) => new BigCheeseError(409, message, "wrong-phase");
const notFound = (message: string) => new BigCheeseError(404, message, "not-found");

// ── Actions ──
const Id = z.string().min(1).max(40);
const Num = z.number().finite().min(-1e6).max(1e6);
const Sev = z.union([z.literal(1), z.literal(2), z.literal(3)]);
const When = z.object({
  week: z.number().int().min(1).max(WEEKS),
  day: z
    .number()
    .int()
    .min(0)
    .max(DAYS - 1),
  slot: z.enum(SLOTS).optional(),
});
type When = z.infer<typeof When>;
// A play happens "now" (the default) or on a later day; time actions are always now.
const when = z.union([z.literal("now"), When]).optional();
const oneOf = (o: Record<string, unknown>) => Object.values(o).filter((v) => v !== undefined).length >= 1;
const valueOrDelta = (o: { value?: number; delta?: number }) => (o.value === undefined) !== (o.delta === undefined);
const VOD = "Send a value or a delta.";
const RELATIONS = ["friend", "rival", "crush", "couple", "mentor", "enemy", "family", "secret_affair"] as const;
const Thread = z.object({ kind: z.literal("thread"), id: Id });
const Person = z.object({ kind: z.literal("person"), id: Id });

export const BoardAction = z.discriminatedUnion("verb", [
  z.object({
    verb: z.literal("meter.set"),
    target: z.object({ kind: z.literal("meter"), id: z.enum(METERS) }),
    input: z.object({ value: Num.optional(), delta: Num.optional() }).refine(valueOrDelta, VOD),
    when,
  }),
  z.object({
    verb: z.literal("person.feelings"),
    target: Person,
    input: z
      .object({
        trust: Num.optional(),
        stress: Num.optional(),
        trustBy: Num.optional(),
        stressBy: Num.optional(),
        mood: z.enum(["great", "fine", "low", "sick", "away"]).optional(),
      })
      .refine(oneOf, "Set trust, stress or mood."),
    when,
  }),
  z.object({
    verb: z.literal("card.add"),
    input: z.object({ asker: Id, need: z.enum(METERS), severity: Sev }),
    when,
  }),
  z.object({ verb: z.literal("card.remove"), target: z.object({ kind: z.literal("card"), id: Id }), when }),
  z.object({ verb: z.literal("time.skip"), input: z.object({ days: z.number().int().min(1).max(100) }), when }),
  z.object({ verb: z.literal("time.hours"), input: z.object({ hours: z.number().int().min(-100).max(100) }), when }),
  z.object({ verb: z.literal("time.rewind"), input: z.object({ days: z.number().int().min(1).max(100) }), when }),
  z.object({
    verb: z.literal("thread.open"),
    input: z.object({
      kind: z.enum(["wish", "crisis", "personal_arc", "mystery", "cover_up", "project"]),
      title: z.string().trim().min(1).max(80),
      people: z.array(Id).max(4),
      need: z.enum(METERS).optional(),
      severity: Sev.optional(),
      stakes: z.string().trim().max(200).optional(),
    }),
    when,
  }),
  z.object({
    verb: z.literal("thread.change"),
    target: Thread,
    input: z
      .object({
        severity: Sev.optional(),
        dueWeek: z.union([z.number().int().min(1).max(WEEKS), z.literal("open")]).optional(),
      })
      .refine(oneOf, "Change at least one value."),
    when,
  }),
  z.object({
    verb: z.literal("thread.close"),
    target: Thread,
    input: z.object({ state: z.enum(["won", "lost", "dropped"]) }),
    when,
  }),
  z.object({ verb: z.literal("thread.beat"), target: Thread, when }),
  z.object({
    verb: z.literal("thread.followup"),
    target: Thread,
    input: z.object({ weeks: z.number().int().min(1).max(3) }),
    when,
  }),
  z.object({
    verb: z.literal("relation.shift"),
    input: z
      .object({
        a: Id,
        b: Id,
        kind: z.enum(RELATIONS).optional(),
        value: Num.optional(),
        delta: Num.optional(),
      })
      .refine(valueOrDelta, VOD),
    when,
  }),
  z.object({
    verb: z.literal("secret.add"),
    input: z.object({
      about: Id,
      text: z.string().trim().min(3).max(200),
      knownBy: z.array(Id).max(6),
    }),
    when,
  }),
  z.object({
    verb: z.literal("ambition.set"),
    target: Person,
    input: z.object({ value: Num.optional(), delta: Num.optional() }).refine(valueOrDelta, VOD),
    when,
  }),
  z.object({
    verb: z.literal("room.condition"),
    target: z.object({ kind: z.literal("room"), id: Id }),
    input: z.object({ value: Num.optional(), delta: Num.optional() }).refine(valueOrDelta, VOD),
    when,
  }),
]);
export type BoardAction = z.infer<typeof BoardAction>;

const Actions = z
  .array(BoardAction)
  .min(1)
  // A Spin play is its thread plus up to 8 beats.
  .max(MAX_ACTIONS + 1)
  .refine((list) => list.length <= MAX_ACTIONS || list[0]?.verb === "thread.open", `At most ${MAX_ACTIONS} actions.`)
  .refine(
    (list) => !list.some((a) => a.verb === "time.rewind") || list.length === 1,
    "Rewind a day is a play of its own.",
  );

// ── Stored data (child document `board-snapshots`) ──
interface Snapshot {
  id: string;
  seq: number;
  at: { week: number; day: number };
  game: Game;
}
type WhenOrNow = "now" | When;
interface Fact {
  verb: string;
  target?: { kind: string; id: string };
  input?: unknown;
  when: WhenOrNow;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  revertible: boolean;
  state?: "done" | "scheduled" | "cancelled"; // a missing state is an old entry: done
}
interface Entry {
  id: string;
  seq: number;
  at: { week: number; day: number; revision: number };
  layer: "set" | "spin";
  text?: string;
  summary?: string;
  silent: boolean;
  actions: Fact[];
  state: "done" | "scheduled" | "rewound" | "reverted";
  snapshotId: string;
}
interface Data {
  n: number; // next sequence number; a snapshot or entry with a lower seq happened earlier
  snaps: Snapshot[];
  mornings: Snapshot[];
  journal: Entry[];
}
type Doc = Run & { id: string };

const obj = <T>() => z.custom<T>((v) => typeof v === "object" && v !== null);
const BoardData = z.object({
  n: z.number().int().min(0),
  snaps: z.array(obj<Snapshot>()),
  mornings: z.array(obj<Snapshot>()),
  journal: z.array(obj<Entry>()),
});

const live = (e: Entry) => e.state === "done" || e.state === "scheduled";
const factState = (f: Fact) => f.state ?? "done";
const entryState = (e: Entry): Entry["state"] =>
  e.actions.some((f) => factState(f) === "scheduled") ? "scheduled" : "done";

// ── Paths: a value the Board touches is named by a dotted path into the run state ──
const getPath = (g: unknown, path: string): unknown =>
  path
    .split(".")
    .reduce<unknown>(
      (o, k) =>
        typeof o === "object" && o !== null && Object.hasOwn(o, k) ? (o as Record<string, unknown>)[k] : undefined,
      g,
    );

function setPath(g: unknown, path: string, value: unknown) {
  const keys = path.split(".");
  const last = keys.pop()!;
  const parent = keys.length ? getPath(g, keys.join(".")) : g;
  // Ids reach a path only after `known`; a run field that was never written (deputyAmbition) may still be set.
  if (typeof parent !== "object" || parent === null) throw bad("That value no longer exists.");
  (parent as Record<string, unknown>)[last] = value;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// What a play left in each path (the last action wins) and what each path held before it (the first action wins).
const finals = (e: Entry): Record<string, unknown> => Object.assign({}, ...e.actions.map((a) => a.after));
const origins = (e: Entry): Record<string, unknown> =>
  Object.assign({}, ...[...e.actions].reverse().map((a) => a.before));
const changedSince = (e: Entry, game: Game) =>
  Object.entries(finals(e)).some(([path, v]) => !same(getPath(game, path), v));

// Never trust an id: only own keys count, so "__proto__" and "constructor" are refused.
const known = <T>(list: Record<string, T>, id: string, what: string) => {
  if (!Object.hasOwn(list, id)) throw bad(`No such ${what}.`);
};

const amount = (g: Game, path: string, a: { value?: number; delta?: number }) =>
  clamp(Math.round(a.value ?? (Number(getPath(g, path)) || 0) + a.delta!));

/** Checks one action against the state and returns the paths it will touch and the change itself. */
function prepare(g: Game, a: BoardAction, morning: (days: number) => Snapshot): { paths: string[]; go: () => void } {
  if (a.verb.startsWith("time.") && a.when && a.when !== "now") throw bad("Time actions happen now.");
  switch (a.verb) {
    case "meter.set": {
      const path = `meters.${a.target.id}`;
      return { paths: [path], go: () => setPath(g, path, amount(g, path, a.input)) };
    }
    case "person.feelings": {
      known(g.people, a.target.id, "person");
      const p = `people.${a.target.id}`;
      const { trust, stress, mood, trustBy, stressBy } = a.input;
      const paths = [
        ...(trust !== undefined || trustBy !== undefined ? [`${p}.trust`] : []),
        ...(stress !== undefined || stressBy !== undefined ? [`${p}.stress`] : []),
        ...(mood !== undefined ? [`${p}.mood`] : []),
      ];
      return {
        paths,
        go: () => {
          const now = g.people[a.target.id]!;
          if (trust !== undefined || trustBy !== undefined)
            setPath(g, `${p}.trust`, clamp(Math.round(trust ?? now.trust + trustBy!)));
          if (stress !== undefined || stressBy !== undefined)
            setPath(g, `${p}.stress`, clamp(Math.round(stress ?? now.stress + stressBy!)));
          if (mood !== undefined) setPath(g, `${p}.mood`, mood);
        },
      };
    }
    case "card.add": {
      known(g.people, a.input.asker, "person");
      return {
        paths: ["inbox", "threads", "nextid", "rng"],
        go: () => {
          const { asker, need, severity } = a.input;
          const t = openThread(g, {
            kind: "follow_up",
            title: `${need} request`,
            people: [asker],
            need,
            severity,
            origin: "board",
          });
          t.beats.push({ id: newId(g, "b"), type: "card", card: addCard(g, t, { need, severity }) });
        },
      };
    }
    case "card.remove": {
      const card = g.inbox.find((c) => c.id === a.target.id);
      if (!card) throw bad("No such card.");
      return {
        paths: ["inbox", "threads", "closed"],
        go: () => {
          g.inbox = g.inbox.filter((c) => c !== card);
          // A follow-up with no card left has nothing to wait for.
          if (g.threads[card.thread]?.kind === "follow_up") closeThread(g, card.thread, "dropped");
        },
      };
    }
    case "time.hours":
      return {
        paths: ["clock.hoursLeft"],
        go: () => setPath(g, "clock.hoursLeft", Math.min(HOURS, Math.max(0, a.input.hours))),
      };
    case "time.skip":
      return {
        paths: ["clock.week", "clock.day", "clock.hoursLeft"],
        go: () => {
          // The next morning waits for "Start the day", as in normal play.
          for (let i = 0; i < Math.min(DAYS, a.input.days) && g.status === "playing"; i++) draft.endDay(g);
        },
      };
    case "time.rewind": {
      const snap = morning(a.input.days);
      return {
        paths: ["clock.week", "clock.day", "clock.hoursLeft"],
        go: () => void Object.assign(g, structuredClone(snap.game)),
      };
    }
    case "thread.open": {
      a.input.people.forEach((p) => known(g.people, p, "person"));
      return {
        paths: ["threads", "nextid", "rng"],
        go: () => {
          const { kind, title, people, need, severity, stakes } = a.input;
          openStory(g, kind, { title, people, need: need ?? "standing", severity, stakes, origin: "board" });
        },
      };
    }
    case "thread.change": {
      known(g.threads, a.target.id, "thread");
      const path = `threads.${a.target.id}`;
      return {
        paths: [path],
        go: () => {
          const t = g.threads[a.target.id]!;
          if (a.input.severity !== undefined) t.severity = a.input.severity;
          if (a.input.dueWeek !== undefined) t.clock = { ...t.clock, dueWeek: a.input.dueWeek };
        },
      };
    }
    case "thread.close": {
      known(g.threads, a.target.id, "thread");
      return {
        paths: ["threads", "closed", "people", "meters"],
        go: () => {
          const t = g.threads[a.target.id]!;
          if (a.input.state === "lost" && t.need)
            g.meters = { ...g.meters, [t.need]: clamp(g.meters[t.need] - K[t.severity ?? 2]) };
          closeThread(g, t.id, a.input.state);
        },
      };
    }
    case "thread.beat": {
      known(g.threads, a.target.id, "thread");
      const waiting = g.threads[a.target.id]!.beats.find((b) => b.planned);
      if (!waiting) throw bad("No beat is waiting.");
      return {
        paths: ["threads", "inbox", "nextid"],
        go: () => {
          const t = g.threads[a.target.id]!;
          const b = t.beats.find((x) => x.planned)!;
          if (b.type === "card" && b.seed && !b.card) {
            b.card = addCard(g, t, b.seed);
            delete b.planned;
          } else b.planned = { week: g.clock.week, day: g.clock.day };
        },
      };
    }
    case "thread.followup": {
      known(g.threads, a.target.id, "thread");
      return {
        paths: ["threads", "nextid"],
        go: () => {
          const t = g.threads[a.target.id]!;
          planCardBeat(g, t, { need: t.need ?? "standing", severity: t.severity ?? 2 }, a.input.weeks);
        },
      };
    }
    case "relation.shift": {
      const { a: A, b: B, kind, value, delta } = a.input;
      known(g.people, A, "person");
      known(g.people, B, "person");
      if (A === B) throw bad("A relation needs two different people.");
      const find = (s: Game) => s.relations.find((x) => (x.a === A && x.b === B) || (x.a === B && x.b === A));
      if (!find(g) && !kind) throw bad("Name the kind of relation.");
      return {
        paths: ["relations"],
        go: () => {
          const r = find(g);
          if (!r) g.relations.push({ a: A, b: B, kind: kind!, level: clamp(Math.round(value ?? delta!)) });
          else {
            if (kind) r.kind = kind;
            if (value !== undefined) r.level = clamp(Math.round(value));
            else shiftRelation(g, A, B, delta!);
          }
        },
      };
    }
    case "secret.add": {
      const { about, text, knownBy } = a.input;
      known(g.people, about, "person");
      const others = knownBy.filter((p) => p !== "boss");
      others.forEach((p) => known(g.people, p, "person"));
      return {
        paths: ["threads", "nextid"],
        go: () => {
          // A secret is a cover-up thread; `secret` stays true until the boss knows it.
          const t = openThread(g, { kind: "cover_up", title: text, people: [about, ...others], origin: "board" });
          t.secret = !knownBy.includes("boss");
        },
      };
    }
    case "ambition.set": {
      known(g.people, a.target.id, "person");
      // The deputy's ambition is the run's own number (it triggers the board challenge).
      const path = a.target.id === g.deputy ? "deputyAmbition" : `people.${a.target.id}.ambition`;
      return { paths: [path], go: () => setPath(g, path, amount(g, path, a.input)) };
    }
    case "room.condition": {
      known(g.rooms, a.target.id, "room");
      const path = `rooms.${a.target.id}.condition`;
      return { paths: [path], go: () => setPath(g, path, amount(g, path, a.input)) };
    }
  }
}

const REVERTABLE = new Set([
  "meter.set",
  "person.feelings",
  "card.add",
  "card.remove",
  "time.hours",
  "thread.open",
  "thread.change",
  "thread.close",
  "thread.beat",
  "thread.followup",
  "relation.shift",
  "secret.add",
  "ambition.set",
  "room.condition",
]);

const snapshotPaths = (g: Game, paths: string[]) =>
  Object.fromEntries(paths.map((p) => [p, structuredClone(getPath(g, p))]));

/** Runs the actions on a copy of the game. Returns the new game and the facts for the journal. */
function simulate(game: Game, actions: BoardAction[], morning: (days: number) => Snapshot) {
  const g = structuredClone(game);
  const facts: Fact[] = [];
  for (const a of actions) {
    if (g.status !== "playing") throw wrongPhase("This run is over.");
    const { paths, go } = prepare(g, a, morning);
    const base = {
      verb: a.verb,
      ...("target" in a ? { target: a.target } : {}),
      ...("input" in a ? { input: a.input } : {}),
    };
    const w = a.when ?? "now";
    const ahead = w === "now" ? 0 : dayIndex(w) - dayIndex(g.clock);
    if (ahead < 0) throw bad("That time has passed.");
    // A later action is only checked now; it runs on its day (`runDue`).
    if (ahead > 0) {
      facts.push({ ...base, when: w, before: {}, after: {}, revertible: false, state: "scheduled" });
      continue;
    }
    const before = snapshotPaths(g, paths);
    go();
    const after = snapshotPaths(g, paths);
    facts.push({ ...base, when: "now", before, after, revertible: REVERTABLE.has(a.verb), state: "done" });
  }
  return { game: g, facts };
}

const noMorning = (): Snapshot => {
  throw bad("Time actions happen now.");
};

/** Runs one scheduled fact on the game. A fact that no longer fits (the person left) is cancelled. */
function runFact(g: Game, f: Fact) {
  try {
    const a = BoardAction.parse({ verb: f.verb, target: f.target, input: f.input });
    const { paths, go } = prepare(g, a, noMorning);
    f.before = snapshotPaths(g, paths);
    go();
    f.after = snapshotPaths(g, paths);
    f.revertible = REVERTABLE.has(f.verb);
    f.state = "done";
  } catch {
    f.state = "cancelled";
  }
}

// ── The fiction adapts (cheese-board.md §6) ──
const MOOD_LINE: Record<string, string> = {
  great: "{n} is in a great mood.",
  low: "{n} is in a low mood.",
  sick: "{n} is sick.",
  away: "{n} is away.",
};

/** One in-world reason line for each person a play changed. No model call: the next ambient batch reads `reasons`. */
function addReasons(g: Game, facts: Fact[]) {
  const kit = kitOf(g);
  const name = (id: string) => kit.people.find((p) => p.id === id)?.name ?? id;
  const add = (person: string, text: string) => {
    g.reasons = [...(g.reasons ?? []), { person, text }].slice(-8);
    if (!Object.hasOwn(g.people, person)) return;
    const mem = g.people[person]!.memories;
    mem.push({ week: g.clock.week, about: text, thread: "board", stance: "", weight: 1 });
    if (mem.length > 5) mem.shift();
  };
  for (const f of facts) {
    if (factState(f) !== "done") continue;
    for (const [path, after] of Object.entries(f.after)) {
      const [root, id, field] = path.split(".");
      if (root !== "people" || !id) continue;
      const before = f.before[path];
      if (
        field === "trust" &&
        typeof after === "number" &&
        typeof before === "number" &&
        Math.abs(after - before) >= 15
      )
        add(
          id,
          after > before
            ? `${name(id)} heard good things about the boss.`
            : `${name(id)} heard something that shook their trust in the boss.`,
        );
      else if (field === "mood" && typeof after === "string" && after !== before && MOOD_LINE[after])
        add(id, MOOD_LINE[after].replace("{n}", name(id)));
    }
    const i = (f.input ?? {}) as Record<string, unknown>;
    const len = (v: unknown) => (Array.isArray(v) ? v.length : 0);
    if (f.verb === "relation.shift" && typeof i.a === "string" && typeof i.b === "string") {
      if (len(f.after.relations) > len(f.before.relations))
        add(i.a, `People have noticed ${name(i.a)} and ${name(i.b)} together.`);
    } else if (f.verb === "secret.add" && typeof i.about === "string")
      add(i.about, `${name(i.about)} is keeping something quiet.`);
  }
}

// ── Spin: from the model's beats to actions the code can check ──
// The model never writes a number: it picks a size and the code turns it into a number (cheese-board.md §4).
const SIZE: Record<string, 1 | 2 | 3> = { small: 1, medium: 2, big: 3 };

const world = (g: Game): Record<string, unknown> => {
  const kit = kitOf(g);
  return {
    clock: { week: g.clock.week, day: g.clock.day },
    meters: g.meters,
    people: Object.entries(g.people).map(([id, p]) => {
      const k = kit.people.find((x) => x.id === id);
      return { id, name: k?.name ?? id, role: k?.role, traits: k?.traits, room: p.room, status: p.status };
    }),
    rooms: Object.keys(g.rooms),
    threads: Object.values(g.threads).map((t) => t.title),
  };
};

type Drop = { beat: string; code: string };

/** Turns the plan into actions. A beat that breaks a rule is dropped with a code the UI can show. */
function planToActions(g: Game, plan: BoardPlanOutput): { actions: BoardAction[]; dropped: Drop[] } {
  const actions: BoardAction[] = [];
  const dropped: Drop[] = [];
  const fail = (code: string): never => {
    throw new Error(code);
  };
  const person = (id: unknown) => (typeof id === "string" && Object.hasOwn(g.people, id) ? id : fail("unknown-person"));
  const o = (v: unknown): Record<string, unknown> => (typeof v === "object" && v !== null ? (v as never) : {});
  const size = (v: unknown) => {
    const s = o(v).size;
    return typeof s === "string" && Object.hasOwn(SIZE, s) ? SIZE[s]! : fail("bad-size");
  };
  // mult: how many points one size step is worth for this kind of value.
  const by = (v: unknown, mult: number) => (o(v).dir === "down" ? -1 : 1) * K[size(v)] * mult;
  for (const beat of plan.beats) {
    try {
      const t = beat.touches;
      let w: WhenOrNow = "now";
      if (beat.when) {
        const d = dayIndex(beat.when) - dayIndex(g.clock);
        if (d < 0 || d > TERM_WEEKS * DAYS) fail("bad-when");
        if (d > 0) w = { week: beat.when.week, day: beat.when.day, slot: beat.when.slot as Slot };
      }
      const who = beat.who;
      switch (beat.verb) {
        case "person.feelings": {
          const input: Record<string, unknown> = {};
          if (t.trust) input.trustBy = by(t.trust, 2);
          if (t.stress) input.stressBy = by(t.stress, 2);
          if (typeof t.mood === "string") input.mood = t.mood;
          actions.push({ verb: "person.feelings", target: { kind: "person", id: person(who[0]) }, input, when: w });
          break;
        }
        case "relation.shift":
          actions.push({
            verb: "relation.shift",
            input: {
              a: person(who[0]),
              b: person(who[1]),
              kind: o(t.relation).kind as (typeof RELATIONS)[number],
              delta: by(t.relation, 1),
            },
            when: w,
          });
          break;
        case "ambition.set":
          actions.push({
            verb: "ambition.set",
            target: { kind: "person", id: person(who[0]) },
            input: { delta: by(t.ambition, 2) },
            when: w,
          });
          break;
        case "secret.add":
          if (!beat.scene) fail("bad-touch");
          actions.push({
            verb: "secret.add",
            input: {
              about: person(who[0]),
              text: beat.scene,
              knownBy: who.slice(1).filter((p) => p === "boss" || Object.hasOwn(g.people, p)),
            },
            when: w,
          });
          break;
        case "room.condition": {
          const room = String(t.room);
          if (!Object.hasOwn(g.rooms, room)) fail("unknown-room");
          actions.push({
            verb: "room.condition",
            target: { kind: "room", id: room },
            input: { delta: by(t, 3) },
            when: w,
          });
          break;
        }
        case "card.add": {
          const need = (METERS as readonly unknown[]).includes(t.need) ? (t.need as (typeof METERS)[number]) : "people";
          actions.push({
            verb: "card.add",
            input: { asker: person(who[0]), need, severity: size(t) },
            when: w,
          });
          break;
        }
        case "meter.set": {
          const meter = t.meter;
          if (!(METERS as readonly unknown[]).includes(meter)) fail("bad-touch");
          actions.push({
            verb: "meter.set",
            target: { kind: "meter", id: meter as (typeof METERS)[number] },
            input: { delta: by(t, 3) },
            when: w,
          });
          break;
        }
        default:
          fail("unknown-verb");
      }
      // Model words such as a mood or a relation kind must fit the same schema a Set action does.
      if (!BoardAction.safeParse(actions[actions.length - 1]).success) {
        actions.pop();
        fail("bad-touch");
      }
    } catch (e) {
      dropped.push({ beat: beat.id, code: e instanceof Error ? e.message : "bad-touch" });
    }
  }
  if (!actions.length) return { actions, dropped };
  // Spins are wish threads with origin "board" (cheese-board.md §3).
  const mentioned = [...new Set(plan.beats.flatMap((b) => b.who))].filter((p) => Object.hasOwn(g.people, p));
  const people = (plan.thread?.people ?? mentioned).filter((p) => Object.hasOwn(g.people, p)).slice(0, 4);
  actions.unshift({
    verb: "thread.open",
    input: {
      kind: "wish",
      title: plan.thread?.title ?? plan.summary.slice(0, 80),
      people,
      need: plan.thread?.need ?? "standing",
      stakes: plan.thread?.stakes || undefined,
    },
    when: "now",
  });
  return { actions, dropped };
}

/** A beat the model wrote is checked in tasks.ts (verbs, count); this keeps the type for callers. */
export type { PlanBeat };
export { BOARD_PLAN_VERBS };

// ── Routes ──
const Base = z.object({ expectedRevision: z.number().int().min(0) });
const PreviewBody = z
  .object({
    actions: Actions.optional(),
    text: z.string().trim().min(1).max(600).optional(),
    target: Id.optional(),
  })
  .refine((b) => (b.actions === undefined) !== (b.text === undefined), "Send actions or text.");
const PlayBody = Base.extend({
  previewId: z.string().min(1).max(40),
  edits: Actions.optional(),
  silent: z.boolean().optional(),
});
const RewindBody = Base.extend({
  playId: z.string().min(1).max(40),
  mode: z.enum(["rewind", "revert"]),
  confirmLater: z.boolean().optional(),
});
const PatchBody = Base.extend({
  id: z.string().min(1).max(80),
  op: z.enum(["move", "cancel", "run"]),
  when: When.optional(),
}).refine((b) => b.op !== "move" || b.when, "Send the new time.");

const parse = <S extends z.ZodTypeAny>(schema: S, body: unknown): z.infer<S> => {
  const r = schema.safeParse(body ?? {});
  if (!r.success) throw bad(r.error.issues[0]?.message ?? "Invalid request.");
  return r.data;
};

const emptyData = (): Data => ({ n: 0, snaps: [], mornings: [], journal: [] });
const boardDocId = (key: string) => `${PACKAGE_ID}:board:${key}`;

export function createBoard(
  store: RunStore,
  documents: CapabilityDocumentStore,
  getModel: () => Promise<ModelCall | undefined> = async () => undefined,
) {
  // ponytail: previews live in memory (30 minutes, 100 at most); a restart drops them and the player previews again.
  const previews = new Map<
    string,
    { runId: string; revision: number; actions: BoardAction[]; at: number; spin?: { text: string; summary: string } }
  >();

  // Snapshots keep the game as it was; an upgrade after an Engine update keeps old plays readable.
  const upgradeData = (d: Data, kitid: string): Data => ({
    ...d,
    snaps: d.snaps.map((s) => ({ ...s, game: upgradeGame(s.game, kitid) })),
    mornings: d.mornings.map((s) => ({ ...s, game: upgradeGame(s.game, kitid) })),
  });

  const load = async (key: string, kitid: string) => {
    const record = await documents.getById(PACKAGE_ID, boardDocId(key));
    if (!record) return { record: null, data: emptyData() };
    const data = BoardData.safeParse(record.data);
    if (!data.success) throw new BigCheeseError(500, "This run's Cheese Board cannot be read.", "unreadable");
    return { record, data: upgradeData(data.data as Data, kitid) };
  };

  const save = async (key: string, record: CapabilityDocumentRecord | null, data: Data) => {
    const now = new Date().toISOString();
    if (!record) {
      // A run deleted meanwhile must not get a new board document.
      if (!(await documents.getById(PACKAGE_ID, `${PACKAGE_ID}:run:${key}`))) throw notFound("No such run.");
      return documents.create({
        id: boardDocId(key),
        packageId: PACKAGE_ID,
        kind: "board-snapshots",
        name: "Cheese Board",
        description: "",
        data,
        createdAt: now,
        updatedAt: now,
      });
    }
    const saved = await documents.update({
      id: record.id,
      packageId: PACKAGE_ID,
      expectedRevision: record.revision,
      name: record.name,
      description: record.description,
      data,
      updatedAt: now,
    });
    if (!saved) throw conflict();
    return saved;
  };

  /** Loads the run for a write: the revision must match and no scene may be open. */
  const open = async (id: unknown, expectedRevision?: number) => {
    const run = await store.get(id);
    if (expectedRevision !== undefined && expectedRevision !== run.revision) throw conflict();
    if (run.scene) throw wrongPhase("Finish the scene first.");
    if (run.game.meeting && !run.game.meeting.done) throw wrongPhase("Finish the meeting first.");
    if (run.game.status !== "playing") throw wrongPhase("This run is over.");
    return run;
  };

  const morningOf = (data: Data, game: Game) => (days: number) => {
    const target = dayIndex(game.clock) - Math.min(MAX_MORNINGS, days);
    const snap = data.mornings.find((m) => dayIndex(m.at) === target);
    if (!snap) throw notFound("No snapshot of that morning.");
    return snap;
  };

  /** Writes the board document, then the run. A failed run write puts the board document back. */
  const commit = async (run: Doc, record: CapabilityDocumentRecord | null, after: Data, game: Game) => {
    const saved = await save(run.id, record, after);
    try {
      return view(await store.update(run.id, run.revision, (r) => ({ ...r, game })));
    } catch (error) {
      await save(run.id, saved, record ? (record.data as Data) : emptyData()).catch(() => undefined);
      throw error;
    }
  };

  const snapshotOf = (data: Data, run: Doc): Snapshot => ({
    id: `s${data.n}`,
    seq: data.n,
    at: { week: run.game.clock.week, day: run.game.clock.day },
    game: structuredClone(run.game),
  });

  /** Plays whose snapshot left the window keep their words but drop stored arrays and objects (inbox, threads) and cap
   * what the run gets, so the board document stays small however long the run gets. */
  const small = (r: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(r).filter(([, v]) => v === null || typeof v !== "object"));
  const slim = (journal: Entry[], snaps: Snapshot[]) => {
    const kept = new Set(snaps.map((s) => s.id));
    return journal.map((e) =>
      kept.has(e.snapshotId)
        ? e
        : {
            ...e,
            actions: e.actions.map((a) => ({
              ...a,
              before: small(a.before),
              after: small(a.after),
              revertible: false,
            })),
          },
    );
  };

  /** Adds a play to the journal and a snapshot of the state before it. */
  const withPlay = (
    data: Data,
    run: Doc,
    facts: Fact[],
    silent: boolean,
    meta?: { layer: "spin"; text: string; summary: string },
  ): Data => {
    const snap = snapshotOf(data, run);
    const snaps = [...data.snaps, snap].slice(-MAX_SNAPSHOTS);
    const entry: Entry = {
      id: `p${data.n}`,
      seq: data.n,
      at: { ...snap.at, revision: run.revision },
      layer: meta?.layer ?? "set",
      ...(meta ? { text: meta.text, summary: meta.summary } : {}),
      silent,
      actions: facts,
      state: "done",
      snapshotId: snap.id,
    };
    entry.state = entryState(entry);
    return {
      ...data,
      n: data.n + 1,
      snaps,
      journal: slim([...data.journal, entry], snaps),
    };
  };

  /** Goes back to a snapshot: later entries turn grey, and snapshots after it are gone. */
  const rewindData = (data: Data, to: Snapshot): Data => ({
    ...data,
    snaps: data.snaps.filter((s) => s.seq < to.seq),
    mornings: data.mornings.filter((s) => s.seq <= to.seq),
    journal: data.journal.map((e) => (e.seq >= to.seq && live(e) ? { ...e, state: "rewound" as const } : rearm(e, to))),
  });

  /** A scheduled fact that ran after the snapshot's day is scheduled again, so the next morning runs it. */
  // ponytail: compares days, not plays; a fact that ran on the snapshot's own day counts as run once the day started.
  function rearm(e: Entry, to: Snapshot): Entry {
    const c = to.game.clock;
    const started = c.hoursLeft < HOURS || to.game.inbox.some((card) => card.age === 0);
    const after = (f: Fact) =>
      f.when !== "now" && (dayIndex(f.when) > dayIndex(c) || (dayIndex(f.when) === dayIndex(c) && !started));
    if (!e.actions.some((f) => factState(f) === "done" && after(f))) return e;
    const next = {
      ...e,
      actions: e.actions.map((f) => (factState(f) === "done" && after(f) ? { ...f, state: "scheduled" as const } : f)),
    };
    next.state = entryState(next);
    return next;
  }

  /** Runs the scheduled facts whose day has come. Returns the journal with their new state. */
  const runDue = (journal: Entry[], g: Game) => {
    const today = dayIndex(g.clock);
    return journal.map((e) => {
      if (e.state !== "scheduled") return e;
      const next = { ...e, actions: e.actions.map((f) => ({ ...f })) };
      for (const f of next.actions) {
        if (factState(f) !== "scheduled" || f.when === "now" || dayIndex(f.when) > today) continue;
        runFact(g, f);
        if (!next.silent) addReasons(g, [f]);
      }
      next.state = entryState(next);
      return next;
    });
  };

  const isDue = (journal: Entry[], g: Game) =>
    journal.some(
      (e) =>
        e.state === "scheduled" &&
        e.actions.some(
          (f) => factState(f) === "scheduled" && f.when !== "now" && dayIndex(f.when) <= dayIndex(g.clock),
        ),
    );

  const planOf = async (g: Game, text: string, target: string | null) => {
    const kit = kitOf(g);
    const rng = g.rng;
    const { output, source } = await runTask(
      "board.plan",
      { kit, rng, text, target, world: world(g) },
      // ponytail: one model call; the spec's fix-up retry with the error list is not built, a refused plan just says so.
      { model: await getModel() },
    );
    return { output, offline: source === "lite" };
  };

  return {
    /** Validates a play and returns it with the numbers it will write. A Set sends actions, a Spin sends text. */
    async preview(id: unknown, body: unknown) {
      const b = parse(PreviewBody, body);
      const run = await open(id);
      const { data } = await load(run.id, run.kitId);
      let actions = b.actions;
      let spin: { text: string; summary: string } | undefined;
      let extra: Record<string, unknown> = {};
      if (b.text !== undefined) {
        if (b.target) known(run.game.people, b.target, "person");
        const { output, offline } = await planOf(run.game, b.text, b.target ?? null);
        const planned = planToActions(run.game, output);
        actions = planned.actions.length ? planned.actions : undefined;
        spin = { text: b.text, summary: output.summary };
        extra = {
          summary: output.summary,
          question: output.question,
          cant: output.cant,
          dropped: planned.dropped,
          offline,
        };
      }
      const now = Date.now();
      for (const [key, p] of previews) if (now - p.at > PREVIEW_MS) previews.delete(key);
      while (previews.size >= 100) previews.delete(previews.keys().next().value!);
      if (!actions) return { id: "", revision: run.revision, expiresAt: "", actions: [], ...extra };
      const { facts } = simulate(run.game, actions, morningOf(data, run.game));
      const previewId = `v-${randomBytes(6).toString("hex")}`;
      previews.set(previewId, { runId: run.id, revision: run.revision, actions, at: now, ...(spin ? { spin } : {}) });
      return {
        id: previewId,
        revision: run.revision,
        expiresAt: new Date(now + PREVIEW_MS).toISOString(),
        actions: facts,
        ...extra,
      };
    },

    /** Plays a previewed play now: snapshot first, then the change, then the journal entry. */
    async play(id: unknown, body: unknown) {
      const b = parse(PlayBody, body);
      const run = await open(id, b.expectedRevision);
      const p = previews.get(b.previewId);
      if (!p || p.runId !== run.id) throw notFound("No such preview.");
      if (Date.now() - p.at > PREVIEW_MS || p.revision !== run.revision) {
        previews.delete(b.previewId);
        throw new BigCheeseError(409, "The place changed since the preview. Preview again.", "stale-preview");
      }
      const { record, data } = await load(run.id, run.kitId);
      const actions = b.edits ?? p.actions;
      const morning = morningOf(data, run.game);
      const { game, facts } = simulate(run.game, actions, morning);
      const first = actions[0]!;
      const silent = b.silent ?? false;
      if (!silent) addReasons(game, facts);
      const next = withPlay(
        first.verb === "time.rewind" ? rewindData(data, morning(first.input.days)) : data,
        run,
        facts,
        silent,
        p.spin ? { layer: "spin", ...p.spin } : undefined,
      );
      previews.delete(b.previewId);
      return commit(run, record, next, game);
    },

    /** Rewinds to before a play, or writes a play's old values back as a new play. */
    async rewind(id: unknown, body: unknown) {
      const b = parse(RewindBody, body);
      const run = await open(id, b.expectedRevision);
      const { record, data } = await load(run.id, run.kitId);
      const entry = data.journal.find((e) => e.id === b.playId);
      if (!entry) throw notFound("No such play.");
      if (!live(entry)) throw bad("That play is already rewound or reverted.");
      const later = data.journal.filter((e) => e.seq > entry.seq && live(e)).length;
      if (b.mode === "rewind") {
        const snap = data.snaps.find((s) => s.id === entry.snapshotId);
        if (!snap) throw notFound("That point is too old to rewind to.");
        if (later > 0 && !b.confirmLater)
          throw new BigCheeseError(409, "Rewinding also undoes later plays.", "confirm-later");
        return commit(run, record, rewindData(data, snap), structuredClone(snap.game));
      }
      if (entry.state !== "done" || !entry.actions.every((a) => a.revertible))
        throw bad("Only finished Set plays can be reverted.");
      const g = structuredClone(run.game);
      const old = origins(entry);
      const before: Record<string, unknown> = {};
      for (const [path, value] of Object.entries(old)) {
        before[path] = structuredClone(getPath(g, path));
        setPath(g, path, structuredClone(value));
      }
      if (changedSince(entry, run.game) && !b.confirmLater)
        throw new BigCheeseError(409, "Some values changed since this play.", "confirm-later");
      const fact: Fact = {
        verb: "revert",
        target: { kind: "play", id: entry.id },
        when: "now",
        before,
        after: old,
        revertible: true,
        state: "done",
      };
      const next = withPlay(data, run, [fact], false);
      next.journal = next.journal.map((e) => (e.id === entry.id ? { ...e, state: "reverted" as const } : e));
      return commit(run, record, next, g);
    },

    /** One page of the journal, newest first, with what the confirm sheet needs. */
    async journal(id: unknown, query: unknown) {
      const run = await store.get(id);
      const { data } = await load(run.id, run.kitId);
      const page = z
        .object({ page: z.coerce.number().int().min(0).max(10_000).catch(0) })
        .catch({ page: 0 })
        .parse(query ?? {}).page;
      const all = [...data.journal].reverse();
      const entries = all.slice(page * PAGE, (page + 1) * PAGE).map((e) => ({
        ...e,
        state: e.state,
        later: live(e) ? data.journal.filter((x) => x.seq > e.seq && live(x)).length : 0,
        days: Math.max(0, dayIndex(run.game.clock) - dayIndex(e.at)),
        canRewind: live(e) && data.snaps.some((s) => s.id === e.snapshotId),
        canRevert: e.state === "done" && e.actions.every((a) => a.revertible),
        changed: changedSince(e, run.game),
      }));
      return { entries, page, more: all.length > (page + 1) * PAGE };
    },

    /** Everything scheduled, soonest first: Spin and Set plays, thread beats and thread clocks (cheese-board.md §5). */
    async comingUp(id: unknown) {
      const run = await store.get(id);
      const { data } = await load(run.id, run.kitId);
      const rows: {
        id: string;
        type: string;
        when: { week: number; day: number; slot?: string };
        source: string;
        [k: string]: unknown;
      }[] = [];
      for (const e of data.journal) {
        if (e.state !== "scheduled") continue;
        e.actions.forEach((f, i) => {
          if (factState(f) === "scheduled" && f.when !== "now")
            rows.push({ id: `a:${e.id}:${i}`, type: "action", when: f.when, source: "player", fact: f, play: e.id });
        });
      }
      for (const t of Object.values(run.game.threads)) {
        const source = ["deck", "arc", "block"].includes(t.origin) ? "storyteller" : "player";
        const thread = { id: t.id, title: t.title, kind: t.kind };
        for (const b of t.beats)
          if (b.planned)
            rows.push({ id: `b:${t.id}:${b.id}`, type: "beat", when: b.planned, source, thread, beat: b.type });
        if (t.clock.dueWeek !== "open")
          rows.push({ id: `c:${t.id}`, type: "clock", when: { week: t.clock.dueWeek, day: DAYS - 1 }, source, thread });
      }
      return { rows: rows.sort((x, y) => dayIndex(x.when) - dayIndex(y.when)) };
    },

    /** Moves, cancels or forces one Coming up row. A thread change is a small play, so it can be rewound too. */
    async patch(id: unknown, body: unknown) {
      const b = parse(PatchBody, body);
      const run = await open(id, b.expectedRevision);
      const { record, data } = await load(run.id, run.kitId);
      const [kind, x = "", y = ""] = b.id.split(":");
      if (b.op === "move" && dayIndex(b.when!) <= dayIndex(run.game.clock)) throw bad("Pick a later day.");
      if (kind === "a") {
        const journal = data.journal.map((e) => (e.id === x && e.state === "scheduled" ? structuredClone(e) : e));
        const entry = journal.find((e) => e.id === x && e.state === "scheduled");
        const f = entry?.actions[Number(y)];
        if (!entry || !f || factState(f) !== "scheduled") throw notFound("Nothing is scheduled there.");
        const g = structuredClone(run.game);
        if (b.op === "move") f.when = b.when!;
        else if (b.op === "cancel") f.state = "cancelled";
        else {
          runFact(g, f);
          if (!entry.silent) addReasons(g, [f]);
        }
        entry.state = entryState(entry);
        // ponytail: a change to a Board action is not a play of its own; rewind the play that made it instead.
        if (b.op === "run") return commit(run, record, { ...data, journal }, g);
        await save(run.id, record, { ...data, journal });
        return view(run);
      }
      const g = structuredClone(run.game);
      const t = Object.hasOwn(g.threads, x) ? g.threads[x] : undefined;
      if (!t || (kind !== "b" && kind !== "c")) throw notFound("Nothing is scheduled there.");
      if (kind === "b") {
        const beat = t.beats.find((bt) => bt.id === y && bt.planned);
        if (!beat) throw notFound("Nothing is scheduled there.");
        // ponytail: big scenes keep their own day and budget rules, so Coming up does not move them.
        if (beat.type === "big_scene") throw bad("Start or decline a big scene from the week strip.");
        if (b.op === "move") beat.planned = { week: b.when!.week, day: b.when!.day };
        else if (b.op === "cancel") t.beats = t.beats.filter((bt) => bt !== beat);
        else if (beat.type === "card" && beat.seed && !beat.card) {
          beat.card = addCard(g, t, beat.seed);
          delete beat.planned;
        } else beat.planned = { week: g.clock.week, day: g.clock.day };
      } else {
        if (b.op === "run") throw bad("A clock cannot be forced.");
        t.clock = { ...t.clock, dueWeek: b.op === "move" ? b.when!.week : "open" };
      }
      const fact: Fact = {
        verb: `coming.${b.op}`,
        target: { kind: "thread", id: t.id },
        when: "now",
        before: {},
        after: {},
        revertible: false,
        state: "done",
      };
      return commit(run, record, withPlay(data, run, [fact], false), g);
    },

    /** Called after "Start the day": keeps one morning snapshot per day, the last 7, then runs what is due today. */
    async morning<V extends { run: Run }>(v: V): Promise<V> {
      try {
        const run = v.run as Doc; // the store adds the id; `view` types the run without it
        const { record, data } = await load(run.id, run.kitId);
        // The snapshot is taken after today's due facts ran, so a rewind to this morning keeps them (see rearm).
        const due = isDue(data.journal, run.game);
        const g = structuredClone(run.game);
        const journal = due ? runDue(data.journal, g) : data.journal;
        const snap = { ...snapshotOf(data, { ...run, game: g }), id: `m${data.n}` };
        const mornings = [...data.mornings.filter((m) => dayIndex(m.at) !== dayIndex(snap.at)), snap].slice(
          -MAX_MORNINGS,
        );
        const next = { ...data, mornings, journal };
        if (!due) {
          await save(run.id, record, next);
          return v;
        }
        return (await commit(run, record, next, g)) as unknown as V;
      } catch {
        // ponytail: a missed morning snapshot only means "Rewind a day" cannot reach that day; it never blocks play.
      }
      return v;
    },

    /** Deletes the child document with its run. */
    async remove(id: unknown) {
      const key = typeof id === "string" ? id : "";
      const record = await documents.getById(PACKAGE_ID, boardDocId(key));
      if (record) await documents.remove(PACKAGE_ID, record.id, record.revision);
    },
  };
}
