// ──────────────────────────────────────────────
// Big Cheese: the Cheese Board, M1 "Playable" (cheese-board.md)
// Set plays on meters, feelings, cards and time, a journal, and rewind and revert from snapshots.
// The code owns every number: each Set is validated by zod, then clamped by the core rules.
// ──────────────────────────────────────────────
import { randomBytes } from "node:crypto";
import type { CapabilityDocumentRecord, CapabilityDocumentStore } from "@marinara-engine/shared";
import { z } from "zod";
import { addCard } from "./core/cards.js";
import { DAYS, HOURS, METERS, clamp, dayIndex, draft, type Run as Game } from "./core/index.js";
import { newId } from "./core/run.js";
import { closeThread, openThread } from "./core/threads.js";
import { view } from "./game.js";
import { BigCheeseError, PACKAGE_ID, type Run, type RunStore } from "./store.js";

// ponytail: 20 play snapshots (cheese-board.md §8 says 50 plus a base snapshot); raise the cap and add the base once M4 needs it.
export const MAX_SNAPSHOTS = 20;
const MAX_MORNINGS = 7;
const MAX_ACTIONS = 8;
const PREVIEW_MS = 30 * 60 * 1000;
const PAGE = 20;

const bad = (message: string) => new BigCheeseError(400, message, "bad-request");
const conflict = () => new BigCheeseError(409, "The run changed. Reload it.", "conflict");
const wrongPhase = (message: string) => new BigCheeseError(409, message, "wrong-phase");

// ── Actions ──
const Id = z.string().min(1).max(40);
const Num = z.number().finite().min(-1e6).max(1e6);
const when = z.literal("now").optional();
const oneOf = (o: Record<string, unknown>) => Object.values(o).filter((v) => v !== undefined).length >= 1;

export const BoardAction = z.discriminatedUnion("verb", [
  z.object({
    verb: z.literal("meter.set"),
    target: z.object({ kind: z.literal("meter"), id: z.enum(METERS) }),
    input: z
      .object({ value: Num.optional(), delta: Num.optional() })
      .refine((o) => (o.value === undefined) !== (o.delta === undefined), "Send a value or a delta."),
    when,
  }),
  z.object({
    verb: z.literal("person.feelings"),
    target: z.object({ kind: z.literal("person"), id: Id }),
    input: z
      .object({
        trust: Num.optional(),
        stress: Num.optional(),
        mood: z.enum(["great", "fine", "low", "sick", "away"]).optional(),
      })
      .refine(oneOf, "Set trust, stress or mood."),
    when,
  }),
  z.object({
    verb: z.literal("card.add"),
    input: z.object({ asker: Id, need: z.enum(METERS), severity: z.union([z.literal(1), z.literal(2), z.literal(3)]) }),
    when,
  }),
  z.object({ verb: z.literal("card.remove"), target: z.object({ kind: z.literal("card"), id: Id }), when }),
  z.object({ verb: z.literal("time.skip"), input: z.object({ days: z.number().int().min(1).max(100) }), when }),
  z.object({ verb: z.literal("time.hours"), input: z.object({ hours: z.number().int().min(-100).max(100) }), when }),
  z.object({ verb: z.literal("time.rewind"), input: z.object({ days: z.number().int().min(1).max(100) }), when }),
]);
export type BoardAction = z.infer<typeof BoardAction>;

const Actions = z
  .array(BoardAction)
  .min(1)
  .max(MAX_ACTIONS)
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
interface Fact {
  verb: string;
  target?: { kind: string; id: string };
  input?: unknown;
  when: "now";
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  revertable: boolean;
}
interface Entry {
  id: string;
  seq: number;
  at: { week: number; day: number; revision: number };
  layer: "set";
  silent: boolean;
  actions: Fact[];
  state: "done" | "rewound" | "reverted";
  snapshotId: string;
}
type Doc = Run & { id: string };
interface Data {
  n: number; // next sequence number; a snapshot or entry with a lower seq happened earlier
  snaps: Snapshot[];
  mornings: Snapshot[];
  journal: Entry[];
}
const obj = <T>() => z.custom<T>((v) => typeof v === "object" && v !== null);
const BoardData = z.object({
  n: z.number().int().min(0),
  snaps: z.array(obj<Snapshot>()),
  mornings: z.array(obj<Snapshot>()),
  journal: z.array(obj<Entry>()),
});

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
  const parent = getPath(g, keys.join("."));
  if (typeof parent !== "object" || parent === null || !Object.hasOwn(parent, last))
    throw bad("That value no longer exists.");
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

/** Checks one action against the state and returns the paths it will touch and the change itself. */
function prepare(g: Game, a: BoardAction, morning: (days: number) => Snapshot): { paths: string[]; go: () => void } {
  switch (a.verb) {
    case "meter.set": {
      const path = `meters.${a.target.id}`;
      return {
        paths: [path],
        go: () => setPath(g, path, clamp(Math.round(a.input.value ?? g.meters[a.target.id] + a.input.delta!))),
      };
    }
    case "person.feelings": {
      known(g.people, a.target.id, "person");
      const p = `people.${a.target.id}`;
      const { trust, stress, mood } = a.input;
      const fields = { trust, stress, mood };
      return {
        paths: Object.entries(fields)
          .filter(([, v]) => v !== undefined)
          .map(([k]) => `${p}.${k}`),
        go: () => {
          if (trust !== undefined) setPath(g, `${p}.trust`, clamp(Math.round(trust)));
          if (stress !== undefined) setPath(g, `${p}.stress`, clamp(Math.round(stress)));
          if (mood !== undefined) setPath(g, `${p}.mood`, mood);
        },
      };
    }
    case "card.add": {
      known(g.people, a.input.asker, "person");
      return {
        paths: ["inbox", "threads", "nextId", "rng"],
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
  }
}

const REVERTABLE = new Set(["meter.set", "person.feelings", "time.hours", "card.add", "card.remove", "revert"]);

/** Runs the actions on a copy of the game. Returns the new game and the facts for the journal. */
function simulate(game: Game, actions: BoardAction[], morning: (days: number) => Snapshot) {
  const g = structuredClone(game);
  const facts: Fact[] = [];
  for (const a of actions) {
    if (g.status !== "playing") throw wrongPhase("This run is over.");
    const { paths, go } = prepare(g, a, morning);
    const before = Object.fromEntries(paths.map((p) => [p, structuredClone(getPath(g, p))]));
    go();
    const after = Object.fromEntries(paths.map((p) => [p, structuredClone(getPath(g, p))]));
    facts.push({
      verb: a.verb,
      ...("target" in a ? { target: a.target } : {}),
      ...("input" in a ? { input: a.input } : {}),
      when: "now",
      before,
      after,
      revertable: REVERTABLE.has(a.verb),
    });
  }
  return { game: g, facts };
}

const Base = z.object({ expectedRevision: z.number().int().min(0) });
const PreviewBody = z.object({ actions: Actions });
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

const parse = <S extends z.ZodTypeAny>(schema: S, body: unknown): z.infer<S> => {
  const r = schema.safeParse(body ?? {});
  if (!r.success) throw bad(r.error.issues[0]?.message ?? "Invalid request.");
  return r.data;
};

const emptyData = (): Data => ({ n: 0, snaps: [], mornings: [], journal: [] });
const boardDocId = (key: string) => `${PACKAGE_ID}:board:${key}`;

export function createBoard(store: RunStore, documents: CapabilityDocumentStore) {
  // ponytail: previews live in memory (30 minutes, 100 at most); a restart drops them and the player previews again.
  const previews = new Map<string, { runId: string; revision: number; actions: BoardAction[]; at: number }>();

  const load = async (key: string) => {
    const record = await documents.getById(PACKAGE_ID, boardDocId(key));
    if (!record) return { record: null, data: emptyData() };
    const data = BoardData.safeParse(record.data);
    if (!data.success) throw new BigCheeseError(500, "This run's Cheese Board cannot be read.", "unreadable");
    return { record, data: data.data as Data };
  };

  const save = async (key: string, record: CapabilityDocumentRecord | null, data: Data) => {
    const now = new Date().toISOString();
    if (!record) {
      // A run deleted meanwhile must not get a new board document.
      if (!(await documents.getById(PACKAGE_ID, `${PACKAGE_ID}:run:${key}`)))
        throw new BigCheeseError(404, "No such run.", "not-found");
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
    if (run.game.status !== "playing") throw wrongPhase("This run is over.");
    return run;
  };

  const morningOf = (data: Data, game: Game) => (days: number) => {
    const target = dayIndex(game.clock) - Math.min(7, days);
    const snap = data.mornings.find((m) => dayIndex(m.at) === target);
    if (!snap) throw new BigCheeseError(404, "No snapshot of that morning.", "not-found");
    return snap;
  };

  /** Writes the board document, then the run. A failed run write puts the board document back. */
  const commit = async (run: Doc, record: CapabilityDocumentRecord | null, before: Data, after: Data, game: Game) => {
    const saved = await save(run.id, record, after);
    try {
      return view(await store.update(run.id, run.revision, (r) => ({ ...r, game })));
    } catch (error) {
      await save(run.id, saved, before).catch(() => undefined);
      throw error;
    }
  };

  const snapshotOf = (data: Data, run: Doc): Snapshot => ({
    id: `s${data.n}`,
    seq: data.n,
    at: { week: run.game.clock.week, day: run.game.clock.day },
    game: structuredClone(run.game),
  });

  /** Plays whose snapshot left the window keep their words but drop stored arrays and objects (inbox, threads) and can
   * no longer be reverted, so the board document stays small however long the run gets. */
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
              revertable: false,
            })),
          },
    );
  };

  /** Adds a play to the journal and a snapshot of the state before it. */
  const withPlay = (data: Data, run: Doc, facts: Fact[], silent: boolean): Data => {
    const snap = snapshotOf(data, run);
    const snaps = [...data.snaps, snap].slice(-MAX_SNAPSHOTS);
    const entry: Entry = {
      id: `p${data.n}`,
      seq: data.n,
      at: { ...snap.at, revision: run.revision },
      layer: "set",
      silent,
      actions: facts,
      state: "done",
      snapshotId: snap.id,
    };
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
    journal: data.journal.map((e) => (e.seq >= to.seq && e.state === "done" ? { ...e, state: "rewound" as const } : e)),
  });

  return {
    /** Validates a Set play and returns it with the numbers it will write. */
    async preview(id: unknown, body: unknown) {
      const { actions } = parse(PreviewBody, body);
      const run = await open(id);
      const { data } = await load(run.id);
      const { facts } = simulate(run.game, actions, morningOf(data, run.game));
      const now = Date.now();
      for (const [key, p] of previews) if (now - p.at > PREVIEW_MS) previews.delete(key);
      while (previews.size >= 100) previews.delete(previews.keys().next().value!);
      const previewId = `v-${randomBytes(6).toString("hex")}`;
      previews.set(previewId, { runId: run.id, revision: run.revision, actions, at: now });
      return {
        id: previewId,
        revision: run.revision,
        expiresAt: new Date(now + PREVIEW_MS).toISOString(),
        actions: facts,
      };
    },

    /** Plays a previewed plan now: snapshot first, then the change, then the journal entry. */
    async play(id: unknown, body: unknown) {
      const b = parse(PlayBody, body);
      const run = await open(id, b.expectedRevision);
      const p = previews.get(b.previewId);
      if (!p || p.runId !== run.id) throw new BigCheeseError(404, "No such preview.", "not-found");
      if (Date.now() - p.at > PREVIEW_MS || p.revision !== run.revision) {
        previews.delete(b.previewId);
        throw new BigCheeseError(409, "The place changed since the preview. Preview again.", "stale-preview");
      }
      const { record, data } = await load(run.id);
      const actions = b.edits ?? p.actions;
      const morning = morningOf(data, run.game);
      const { game, facts } = simulate(run.game, actions, morning);
      const first = actions[0]!;
      const next = withPlay(
        first.verb === "time.rewind" ? rewindData(data, morning(first.input.days)) : data,
        run,
        facts,
        b.silent ?? false,
      );
      previews.delete(b.previewId);
      return commit(run, record, data, next, game);
    },

    /** Rewinds to before a play, or writes a play's old values back as a new play. */
    async rewind(id: unknown, body: unknown) {
      const b = parse(RewindBody, body);
      const run = await open(id, b.expectedRevision);
      const { record, data } = await load(run.id);
      const entry = data.journal.find((e) => e.id === b.playId);
      if (!entry) throw new BigCheeseError(404, "No such play.", "not-found");
      if (entry.state !== "done") throw bad("That play is already rewound or reverted.");
      const later = data.journal.filter((e) => e.seq > entry.seq && e.state === "done").length;

      if (b.mode === "rewind") {
        const snap = data.snaps.find((s) => s.id === entry.snapshotId);
        if (!snap) throw new BigCheeseError(404, "That point is too old to rewind to.", "not-found");
        if (later > 0 && !b.confirmLater)
          throw new BigCheeseError(409, "Rewinding also undoes later plays.", "confirm-later");
        return commit(run, record, data, rewindData(data, snap), structuredClone(snap.game));
      }

      if (!entry.actions.every((a) => a.revertable)) throw bad("Only Set plays can be reverted.");
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
        revertable: true,
      };
      const next = withPlay(data, run, [fact], false);
      next.journal = next.journal.map((e) => (e.id === entry.id ? { ...e, state: "reverted" as const } : e));
      return commit(run, record, data, next, g);
    },

    /** One page of the journal, newest first, with what the confirm sheet needs. */
    async journal(id: unknown, query: unknown) {
      const run = await store.get(id);
      const { data } = await load(run.id);
      const page = z
        .object({ page: z.coerce.number().int().min(0).max(10_000).catch(0) })
        .catch({ page: 0 })
        .parse(query ?? {}).page;
      const all = [...data.journal].reverse();
      const entries = all.slice(page * PAGE, (page + 1) * PAGE).map((e) => ({
        ...e,
        later: e.state === "done" ? data.journal.filter((x) => x.seq > e.seq && x.state === "done").length : 0,
        days: Math.max(0, dayIndex(run.game.clock) - dayIndex(e.at)),
        canRewind: e.state === "done" && data.snaps.some((s) => s.id === e.snapshotId),
        canRevert: e.state === "done" && e.actions.every((a) => a.revertable),
        changed: changedSince(e, run.game),
      }));
      return { entries, page, more: all.length > (page + 1) * PAGE };
    },

    /** Called after "Start the day": keeps one morning snapshot per day, the last 7. */
    async morning<V extends { run: Run }>(v: V): Promise<V> {
      try {
        const run = v.run as Doc; // the store adds the id; `view` types the run without it
        const { record, data } = await load(run.id);
        const snap = { ...snapshotOf(data, run), id: `m${data.n}` };
        const mornings = [...data.mornings.filter((m) => dayIndex(m.at) !== dayIndex(snap.at)), snap].slice(
          -MAX_MORNINGS,
        );
        await save(run.id, record, { ...data, mornings });
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
