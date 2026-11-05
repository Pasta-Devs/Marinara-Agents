// T5: Drama and Romance layers, Project block.
import assert from "node:assert/strict";
import { test } from "node:test";
import * as core from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/index.js";
import { HAFENKAI_PLACE } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/hafenkai.js";
import type { Run } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/types.js";

const fresh = (seed = 1, layers = { drama: 100, romance: 100 }) => {
  const s = core.newRun(HAFENKAI_PLACE, seed);
  s.layers = layers;
  return s;
};

/** Plays a whole year, answering the first stance of every card. Returns every thread id ever open. */
const year = (s: Run, seen = new Map<string, string | undefined>()) => {
  while (s.status === "playing") {
    core.draft.seedDay(s);
    for (const t of Object.values(s.threads)) seen.set(t.id, t.layer);
    while (s.inbox.length && s.clock.hoursLeft > 0)
      core.draft.answerCard(s, s.inbox[0]!.id, s.inbox[0]!.answers[0]!.stance);
    core.draft.endDay(s);
  }
  return seen;
};

test("dial 0 opens no layer thread", () => {
  for (const seed of [1, 2, 3]) {
    const seen = year(fresh(seed, { drama: 0, romance: 0 }));
    assert.equal([...seen.values()].filter(Boolean).length, 0);
  }
});

test("dial 100 opens drama and romance threads between active people", () => {
  const seen = year(fresh(4));
  const tags = new Set(seen.values());
  assert.ok(tags.has("drama") && tags.has("romance"));
});

test("project wins on the reveal, with progress as a clock", () => {
  const s = fresh(6, { drama: 0, romance: 0 });
  const t = core.startProject(s);
  assert.equal(t.beats.length, 5);
  assert.equal(core.projectProgress(t), 0);
  let mid = -1;
  while (s.status === "playing" && s.threads[t.id]) {
    core.draft.seedDay(s);
    if (s.threads[t.id]) mid = Math.max(mid, core.projectProgress(s.threads[t.id]!));
    while (s.inbox.length && s.clock.hoursLeft > 0)
      core.draft.answerCard(
        s,
        s.inbox[0]!.id,
        (s.inbox[0]!.answers.find((a) => a.stance === "invest") ?? s.inbox[0]!.answers[0]!).stance,
      );
    core.draft.endDay(s);
  }
  assert.ok(mid >= 1 && mid < 5);
  assert.equal(s.closed.find((c) => c.id === t.id)?.state, "won");
});
