import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilityDocumentRecord, CapabilityDocumentStore } from "@marinara-engine/shared";
import * as core from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/index.js";
import {
  bigBudget,
  bigToday,
  bookBigScene,
  bookClimaxes,
  dueBig,
  lapse,
  settleBig,
} from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/bigscenes.js";
import { openStory } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/threads.js";
import type {
  Run,
  Thread,
} from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/types.js";
import { createGame } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/game.js";
import { createRunStore } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/store.js";

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
      docs.set(record.id, record);
      return record;
    },
    remove: async (_p, id, expectedRevision) => docs.get(id)?.revision === expectedRevision && docs.delete(id),
  } as CapabilityDocumentStore;
}

const fresh = (storyteller: Run["storyteller"] = "classic") => {
  const s = core.newRun(core.HAFENKAI, 7);
  s.storyteller = storyteller;
  return s;
};
const story = (s: Run, kind: Thread["kind"] = "mystery", init: Partial<Thread> = {}) =>
  openStory(s, kind, {
    title: kind,
    need: "output",
    people: Object.keys(s.people).slice(0, 2),
    origin: "deck",
    ...init,
  });
const days = (s: Run) =>
  Object.values(s.threads).flatMap((t) =>
    t.beats.filter((b) => b.type === "big_scene").map((b) => core.dayIndex(b.planned!)),
  );

test("budget: Calm 1, Classic 2, Chaos 2 per week; a full week defers to the next", () => {
  assert.deepEqual(
    (["calm", "classic", "chaos"] as const).map((k) => bigBudget(fresh(k))),
    [1, 2, 2],
  );
  const s = fresh();
  const t = story(s);
  const planned = [1, 2, 3].map(() => bookBigScene(s, t, "accusation")!.planned!);
  assert.deepEqual(
    planned.map((p) => p.week),
    [1, 1, 2],
  );
  assert.equal(new Set(days(s)).size, 3, "never two on one day");
  assert.ok(Math.min(...days(s)) >= core.dayIndex(s.clock) + 2, "at least 2 days ahead");
});

test("deferral: a thread clock that runs out first gets no big scene", () => {
  const s = fresh("calm");
  story(s); // takes the one slot of week 1
  bookBigScene(s, Object.values(s.threads)[0]!, "accusation");
  const t = story(s, "crisis", { dueWeek: 1 });
  assert.equal(bookBigScene(s, t, "storm"), null);
  assert.equal(
    t.beats.some((b) => b.type === "big_scene"),
    false,
  );
});

test("climax: the storyteller books it on the last beat day and a booked day loses one card", () => {
  const s = fresh();
  const t = story(s);
  const last = Math.max(...t.beats.map((b) => core.dayIndex(b.planned!)));
  bookClimaxes(s);
  const beat = t.beats.find((b) => b.type === "big_scene")!;
  assert.equal(core.dayIndex(beat.planned!), last);
  bookClimaxes(s);
  assert.equal(t.beats.filter((b) => b.type === "big_scene").length, 1, "booked once");
  s.clock = { week: beat.planned!.week, day: beat.planned!.day, hoursLeft: core.HOURS };
  assert.equal(bigToday(s), 1);
});

test("decline and a missed day count against the week, and a missed scene is settled", () => {
  const s = fresh("calm");
  const t = story(s);
  const b = bookBigScene(s, t, "accusation")!;
  s.clock = { ...s.clock, day: 2 };
  assert.equal(dueBig(s)?.beat.id, b.id);
  settleBig(s, b, "declined");
  assert.equal(dueBig(s), null);
  assert.equal(bookBigScene(s, t, "storm")!.planned!.week, 2, "the declined scene used the Calm slot");
  s.clock = { week: 3, day: 0, hoursLeft: core.HOURS };
  const late = story(s, "crisis");
  const m = bookBigScene(s, late, "storm")!;
  s.clock = { ...s.clock, day: 4 };
  lapse(s);
  assert.equal(m.result, "missed");
});

test("start books 2 hours, skip keeps them and takes the middle answers, decline is free", async () => {
  const store = createRunStore(fakeDocuments());
  const game = createGame(store, async () => undefined);
  let v = await game.create("hafenkai", true);
  const id = v.run.id;
  const rev = () => ({ expectedRevision: v.run.revision });
  v = await game.choose(id, "arrival", { ...rev(), skip: true });
  v = await game.dayStart(id, rev());
  // Put a storm and then an accusation on today through the store, then play them.
  for (const [blueprint, kind] of [
    ["storm", "crisis"],
    ["accusation", "mystery"],
  ] as const) {
    const run = await store.get(id);
    const g = structuredClone(run.game);
    const t = story(g, kind);
    t.beats.push({ id: "bg", type: "card", result: "good" } as never);
    t.beats.push({
      id: `bs-${blueprint}`,
      type: "big_scene",
      planned: { week: g.clock.week, day: g.clock.day },
      blueprint,
    });
    await store.update(id, run.revision, (r) => ({ ...r, game: g }));
    const hoursBefore = (await store.get(id)).game.clock.hoursLeft;
    v = await game.bigStart(id, { expectedRevision: (await store.get(id)).revision });
    assert.equal(v.run.game.clock.hoursLeft, hoursBefore - 2);
    const sceneId = v.run.scene!;
    assert.equal(sceneId, `big-bs-${blueprint}`);
    v = await game.choose(id, sceneId, { expectedRevision: v.run.revision, skip: true });
    assert.equal(v.run.scene, null);
    assert.equal(v.run.game.clock.hoursLeft, hoursBefore - 2, "the skip does not touch the hours");
    const scene = v.run.text.scenes[sceneId]!;
    assert.equal(scene.parts.length, scene.total);
    assert.ok(scene.done && scene.outcome);
    if (blueprint === "storm") assert.equal(scene.parts.at(-1)!.chosen, "people", "skip takes the middle pick");
    else assert.equal(v.run.game.closed.at(-1)!.state, "won", "a check end settles the thread");
    assert.equal(v.run.game.bigScenes.used >= 1, true);
  }
  // Decline: no hours, no scene, beat settled.
  const run = await store.get(id);
  const g = structuredClone(run.game);
  const t = story(g, "crisis");
  t.beats.push({ id: "bd", type: "big_scene", planned: { week: g.clock.week, day: g.clock.day }, blueprint: "storm" });
  await store.update(id, run.revision, (r) => ({ ...r, game: g }));
  const hours = (await store.get(id)).game.clock.hoursLeft;
  v = await game.bigDecline(id, { expectedRevision: (await store.get(id)).revision });
  assert.equal(v.run.game.clock.hoursLeft, hours);
  assert.equal(v.run.scene, null);
  assert.equal(dueBig(v.run.game), null);
  await assert.rejects(game.bigDecline(id, { expectedRevision: v.run.revision }), /wrong-phase|booked/);
});
