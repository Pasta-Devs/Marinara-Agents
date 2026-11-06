import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilityDocumentRecord, CapabilityDocumentStore } from "@marinara-engine/shared";
import { createGame } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/game.js";
import { createMinigames } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/minigames.js";
import { createRunStore } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/store.js";
import * as core from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/index.js";
import {
  MINIGAMES,
  STANDING,
} from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/minigames.js";
import { placeKitOf } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/index.js";
import { applyDelta } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/run.js";
import { DIFFICULTY_FACTOR } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/types.js";
import type { PlaceKit } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/types.js";

function fakeDocuments(): CapabilityDocumentStore {
  const docs = new Map<string, CapabilityDocumentRecord>();
  return {
    list: async (_p, kind) => [...docs.values()].filter((d) => d.kind === kind),
    getById: async (_p, id) => docs.get(id) ?? null,
    create: async (input) => {
      const record = { ...input, revision: 1 } as CapabilityDocumentRecord;
      docs.set(record.id, record);
      return record;
    },
    update: async (input) => {
      const current = docs.get(input.id);
      if (!current || current.revision !== input.expectedRevision) return null;
      const record = { ...current, ...input, revision: current.revision + 1 } as CapabilityDocumentRecord;
      docs.set(input.id, record);
      return record;
    },
    remove: async (_p, id, expectedRevision) => docs.get(id)?.revision === expectedRevision && docs.delete(id),
  } as unknown as CapabilityDocumentStore;
}

const kit = { people: ["a", "b", "c"].map((id) => ({ id, traits: [] })), rooms: [] } as unknown as PlaceKit;

/** Three people in a row, a party planned for Thursday of week 1. */
function party(day = 3) {
  const s = core.newRun(core.HAFENKAI, 1);
  const base = Object.values(s.people)[0]!;
  s.people = { a: { ...base }, b: { ...base }, c: { ...base } };
  s.relations = [
    { a: "a", b: "b", kind: "rival", level: 50 },
    { a: "b", b: "c", kind: "friend", level: 40 },
    { a: "a", b: "c", kind: "crush", level: 30 },
  ] as typeof s.relations;
  s.clock = { ...s.clock, week: 1, day, hoursLeft: 4 };
  s.threads.tp = {
    id: "tp",
    kind: "personal_arc",
    title: "A party",
    people: [],
    stakes: "",
    clock: { dueWeek: "open", pressure: "quiet" },
    beats: [{ id: "bp", type: "big_scene", blueprint: "party", planned: { week: 1, day: 3 } }],
    state: "open",
  } as never;
  s.layers = { drama: 50, romance: 0 };
  return s;
}
const lvl = (s: ReturnType<typeof party>, a: string, b: string) =>
  s.relations.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a))!.level;

test("a party night offers seating, with no rng, and an open game stays", () => {
  const s = party();
  const rng = s.rng;
  core.minigameOffer(s);
  assert.equal(s.minigame?.kind, "seating");
  assert.equal(s.minigame?.need, 3);
  assert.deepEqual(
    s.minigame?.options.map((o) => o.id),
    ["s1", "s2", "s3"],
  );
  assert.equal(s.rng, rng);
  const g = s.minigame;
  core.minigameOffer(s);
  assert.equal(s.minigame, g);
  const other = party(2);
  core.minigameOffer(other);
  assert.notEqual(other.minigame?.kind, "seating", "no party today, no seating");
});

test("priority: Monday speech, then a hire's interview, then seating", () => {
  const mon = party(0);
  mon.threads.tp!.beats[0]!.planned = { week: 1, day: 0 };
  core.minigameOffer(mon);
  assert.equal(mon.minigame?.kind, "speech");
  const hire = party();
  hire.people.h1 = { ...hire.people.a! };
  core.minigameOffer(hire);
  assert.equal(hire.minigame?.kind, "interview");
});

test("seating: rivals side by side lose the bond, friends gain, a crush needs the Romance layer", () => {
  const s = party();
  core.minigameOffer(s);
  const bad = core.playMinigame(s, kit, "seating", ["a@s1", "b@s2", "c@s3"]);
  assert.equal(lvl(bad, "a", "b"), 45);
  assert.equal(lvl(bad, "b", "c"), 43);
  assert.equal(lvl(bad, "a", "c"), 30, "no Romance layer, no crush effect");
  assert.equal(bad.minigame!.done!.outcome, "bad");
  assert.equal(bad.clock.hoursLeft, 3);
  assert.deepEqual(
    bad.minigame!.done!.steps.map((x) => x.value),
    [-5, 3],
  );
  assert.ok((bad.minigames ?? []).includes("seating:1"));
  const good = core.playMinigame(s, kit, "seating", ["a@s1", "c@s2", "b@s3"]);
  assert.equal(lvl(good, "a", "b"), 50);
  assert.equal(lvl(good, "a", "c"), 30);
  assert.equal(lvl(good, "b", "c"), 43);
  assert.equal(good.minigame!.done!.outcome, "good");
  s.layers = { drama: 50, romance: 80 };
  const love = core.playMinigame(s, kit, "seating", ["b@s1", "c@s2", "a@s3"]);
  assert.equal(lvl(love, "a", "c"), 35);
  assert.equal(lvl(love, "b", "c"), 43);
});

test("seating refuses bad picks", () => {
  const s = party();
  core.minigameOffer(s);
  for (const picks of [
    ["a@s1", "b@s2"],
    ["a@s1", "a@s2", "c@s3"],
    ["a@s1", "b@s1", "c@s3"],
    ["a@s1", "b@s2", "zed@s3"],
    ["a@s1", "b@s2", "c@s9"],
    ["a@s1@x", "b@s2", "c@s3"],
    ["a", "b", "c"],
    ["toString@s1", "b@s2", "c@s3"],
  ]) {
    assert.throws(() => core.playMinigame(s, kit, "seating", picks), /Pick 3/, picks.join());
  }
});

function inspect() {
  const s = party(1);
  s.kitId = "hafenkai";
  delete s.threads.tp;
  s.threads.ti = {
    id: "ti",
    kind: "crisis",
    title: "Pike comes to inspect the place",
    need: "standing",
    people: ["a"],
    stakes: "",
    clock: { dueWeek: 2, pressure: "quiet" },
    beats: [],
    state: "open",
  } as never;
  return s;
}

test("an inspector's visit offers the walk once per visit, with 0 to all rooms and no hidden rooms listed", () => {
  const s = inspect();
  const rng = s.rng;
  core.minigameOffer(s);
  const g = s.minigame!;
  assert.equal(g.kind, "inspection");
  assert.equal(s.rng, rng);
  assert.deepEqual(g.people, ["a"]);
  assert.equal(g.min, 0);
  assert.equal(g.need, g.options.length);
  assert.ok(g.options.length > 0 && !g.options.some((o) => o.id === "archive" || o.id === "roof"));
  const done = core.playMinigame(s, placeKitOf({ kitId: "hafenkai" }), "inspection", []);
  assert.equal(done.minigame!.done!.steps.length, 1, "with nothing shown the inspector opens one room");
  assert.ok(done.minigames!.includes("inspection:ti"));
  done.clock.day = 2;
  core.minigameOffer(done);
  assert.equal(done.minigame!.done!.picks.length, 0, "a played visit is not offered again");
});

test("a hidden room the inspector finds costs Standing; the same seed gives the same walk", () => {
  const s = inspect();
  const place = placeKitOf({ kitId: "hafenkai" });
  core.minigameOffer(s);
  const all = s.minigame!.options.map((o) => o.id);
  const one = core.playMinigame(s, place, "inspection", all);
  const two = core.playMinigame(s, place, "inspection", all);
  assert.deepEqual(one.minigame!.done, two.minigame!.done);
  const last = one.minigame!.done!.steps.at(-1)!;
  assert.equal(last.tag, "hidden");
  assert.equal(last.value, -1);
  const want = applyDelta(s.meters, { standing: STANDING[one.minigame!.done!.outcome] - 5 }, DIFFICULTY_FACTOR.normal);
  assert.equal(one.meters.standing, want.standing);
  assert.throws(() => core.playMinigame(s, place, "inspection", ["archive"]), /Pick up to/);
  assert.throws(() => core.playMinigame(s, place, "inspection", [all[0]!, all[0]!]), /Pick up to/);
  assert.throws(() => core.playMinigame(s, place, "inspection", ["toString"]), /Pick up to/);
});

test("each kind brings its own verdict sentence", () => {
  const step = { id: "x", tag: "t", text: "A sits next to B.", value: -5 };
  assert.match(MINIGAMES.seating!.verdict(step), /do not get on/);
  assert.match(MINIGAMES.inspection!.verdict({ ...step, tag: "hidden" }), /not meant to see/);
  assert.match(MINIGAMES.speech!.verdict(step), /^The crowd does not like/);
  assert.match(MINIGAMES.interview!.verdict({ ...step, trait: "loyal" }), /they are loyal/);
});

test("the route plays a seating plan in Lite and writes one line per step", async () => {
  const store = createRunStore(fakeDocuments());
  const { run } = await createGame(store, () => Promise.resolve(undefined)).create("hafenkai", true);
  const cur = await store.get(run.id);
  await store.update(run.id, cur.revision, (r) => {
    const g = structuredClone(r.game);
    const ids = Object.keys(g.people).slice(0, 3);
    g.relations = [{ a: ids[0]!, b: ids[1]!, kind: "rival", level: 50 }] as typeof g.relations;
    g.clock.week = 1;
    g.clock.day = 3;
    g.clock.hoursLeft = 4;
    g.minigames = [];
    g.threads.tp = {
      id: "tp",
      kind: "personal_arc",
      title: "A party",
      people: [],
      stakes: "",
      clock: { dueWeek: "open", pressure: "quiet" },
      beats: [{ id: "bp", type: "big_scene", blueprint: "party", planned: { week: 1, day: 3 } }],
      state: "open",
    } as never;
    core.minigameOffer(g);
    return { ...r, scene: null, game: g };
  });
  const now = await store.get(run.id);
  const g = now.game.minigame!;
  assert.equal(g.kind, "seating");
  const mini = createMinigames(store, () => Promise.resolve(undefined as never));
  const picks = g.people.map((p, i) => `${p}@${g.options[i]!.id}`);
  const out: any = await mini.play(run.id, { expectedRevision: now.revision, kind: "seating", picks });
  const done = out.run.game.minigame.done;
  assert.equal(done.lines.length, done.steps.length);
  assert.ok(done.steps.length > 0);
  assert.match(done.lines[0].text, /do not get on/);
});

test("a stored run knows its place, so the walk is offered without a hand-set kitId", async () => {
  const store = createRunStore(fakeDocuments());
  const { run } = await createGame(store, () => Promise.resolve(undefined)).create("hafenkai", true);
  const s = structuredClone((await store.get(run.id)).game);
  assert.equal(s.kitId, "hafenkai");
  s.clock.day = 1;
  s.minigame = null;
  s.threads.ti = {
    id: "ti",
    kind: "crisis",
    title: "A surprise inspection",
    need: "standing",
    people: Object.keys(s.people).slice(0, 1),
    stakes: "",
    clock: { dueWeek: 2, pressure: "quiet" },
    beats: [],
    state: "open",
  } as never;
  core.minigameOffer(s);
  assert.equal(s.minigame?.kind, "inspection");
  assert.ok(s.minigame!.options.length > 0);
});
