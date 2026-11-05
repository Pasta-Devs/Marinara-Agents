// T1: the storyteller and the thread kinds (design.md 3.2, 5): each kind opens, ends in the right state, and the year has a surprise every week.
import assert from "node:assert/strict";
import { test } from "node:test";
import * as core from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/index.js";
import { openStory } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/threads.js";
import { openStoryRole } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/storyteller.js";
import type {
  Run,
  Thread,
} from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/types.js";

const fresh = (seed = 1) => core.newRun(core.HAFENKAI, seed);
const who = (s: Run) => Object.keys(s.people).slice(0, 1);

/** Plays days until thread `id` closes. Cards of that thread get answer `idx` (0 strong, 2 weak), all others the strong one. */
function play(s: Run, id: string, idx: number) {
  for (let i = 0; i < 200 && s.status === "playing" && s.threads[id]; i++) {
    core.draft.seedDay(s);
    while (s.inbox.length && s.clock.hoursLeft > 0) {
      const c = s.inbox[0]!;
      core.draft.answerCard(s, c.id, c.answers[c.thread === id ? idx : 0]!.stance);
    }
    core.draft.endDay(s);
  }
  return s.closed.find((c) => c.id === id)?.state;
}
const open = (kind: Thread["kind"], init: Partial<Thread> = {}, seed = 1) => {
  const s = fresh(seed);
  const t = openStory(s, kind, { title: kind, need: "output", people: who(s), origin: "deck", ...init });
  return { s, t };
};

test("plans: crisis has 3 card beats on 3 days in a row at severity 3", () => {
  const { t } = open("crisis");
  assert.deepEqual(
    t.beats.map((b) => [b.type, b.planned?.day, b.seed?.severity]),
    [
      ["card", 1, 3],
      ["card", 2, 3],
      ["card", 3, 3],
    ],
  );
});

test("crisis: 2 strong answers win, 2 weak answers lose", () => {
  for (const [idx, want] of [
    [0, "won"],
    [2, "lost"],
  ] as const) {
    const { s, t } = open("crisis");
    assert.equal(play(s, t.id, idx), want);
  }
});

test("cover_up: its card decides", () => {
  for (const [idx, want] of [
    [0, "won"],
    [2, "lost"],
  ] as const) {
    const { s, t } = open("cover_up", { need: "standing" });
    assert.equal(play(s, t.id, idx), want);
  }
});

test("wish is won when its last beat lands; mystery runs out as dropped", () => {
  const w = open("wish", { need: "people" });
  assert.equal(play(w.s, w.t.id, 0), "won");
  const m = open("mystery", { need: "standing" });
  assert.equal(play(m.s, m.t.id, 0), "dropped");
});

test("personal_arc: won when the person reached the ambition, else dropped", () => {
  const a = open("personal_arc");
  a.s.people[a.t.people[0]!]!.ambition = 100;
  assert.equal(play(a.s, a.t.id, 0), "won");
  const b = open("personal_arc");
  assert.equal(play(b.s, b.t.id, 0), "dropped");
});

test("project: 2 bad answers lose it", () => {
  const { s, t } = open("project");
  assert.equal(t.beats.length, 5);
  assert.equal(play(s, t.id, 2), "lost");
});

test("follow_up: invest wins it, an ignored card loses it", () => {
  const w = fresh();
  core.draft.seedDay(w);
  const c = w.inbox[0]!;
  core.draft.answerCard(w, c.id, "invest");
  assert.equal(w.closed.find((x) => x.id === c.thread)?.state, "won");
  const l = fresh();
  core.draft.seedDay(l);
  const id = l.inbox[0]!.thread;
  for (let i = 0; i < 5; i++) core.draft.endDay(l);
  assert.equal(l.closed.find((x) => x.id === id)?.state, "lost");
});

test("revolt: Legitimacy 0 opens it, 25 wins it, a missed due week ends the reign", () => {
  const run = (legitimacy: number, after: number) => {
    const s = fresh();
    s.extras = [{ id: "legitimacy", main: "standing", value: 0 }];
    while (s.clock.day !== 4) core.draft.endDay(s);
    core.draft.endDay(s); // Friday settle opens the revolt
    const r = Object.values(s.threads).find((t) => t.kind === "revolt")!;
    assert.ok(r);
    s.extras[0]!.value = legitimacy;
    for (let i = 0; i < after && s.status === "playing"; i++) core.draft.endDay(s);
    return { s, r };
  };
  const won = run(30, 5);
  assert.equal(won.s.closed.find((c) => c.id === won.r.id)?.state, "won");
  const lost = run(10, 20);
  assert.equal(lost.s.closed.find((c) => c.id === lost.r.id)?.state, "lost");
  assert.equal(lost.s.ending, "Overthrown");
});

test("a year has a surprise every week", () => {
  const s = fresh(3);
  const weeks = new Set<number>();
  while (s.status === "playing") {
    core.draft.seedDay(s);
    while (s.inbox.length && s.clock.hoursLeft > 0)
      core.draft.answerCard(s, s.inbox[0]!.id, s.inbox[0]!.answers[0]!.stance);
    if (s.story.lastSurprise) weeks.add(s.story.lastSurprise.week);
    core.draft.endDay(s);
  }
  for (let w = 1; w < s.clock.week; w++) assert.ok(weeks.has(w), `week ${w} had no surprise`);
});

test("every story role opens a thread with beats, so it can end", () => {
  for (const role of ["old_flame", "rival_boss", "inspector"] as const) {
    const s = fresh();
    const t = openStoryRole(s, who(s)[0]!, role);
    assert.ok(t.beats.length > 0, `${role} has beats`);
  }
});
