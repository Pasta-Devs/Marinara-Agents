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
    core.draft.endDay(s, HAFENKAI_PLACE);
  }
  return seen;
};

test("dial 0 opens no layer thread", () => {
  for (const seed of [1, 2, 3]) {
    const seen = year(fresh(seed, { drama: 0, romance: 0, press: 0, rivals: 0, family: 0 }));
    assert.equal([...seen.values()].filter(Boolean).length, 0);
  }
});

test("a missing dial is 50 for M1-M3 layers and 0 for the opt-in M4 layers", () => {
  const s = fresh(1, {});
  assert.equal(core.dial(s, "drama"), 50);
  for (const l of ["crime", "politics", "mystery", "horror", "legacy", "strange"] as const)
    assert.equal(core.dial(s, l), 0);
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
    core.draft.endDay(s, HAFENKAI_PLACE);
  }
  assert.ok(mid >= 1 && mid < 5);
  assert.equal(s.closed.find((c) => c.id === t.id)?.state, "won");
});

test("press, rivals and family: dial 0 opens nothing, dial 100 opens their threads", () => {
  const off = { drama: 0, romance: 0, press: 0, rivals: 0, family: 0 };
  for (const seed of [1, 2, 3]) {
    const seen = year(fresh(seed, off));
    assert.equal([...seen.values()].filter(Boolean).length, 0);
  }
  const tags = new Set(year(fresh(7, { ...off, press: 100, rivals: 100, family: 100 })).values());
  assert.ok(tags.has("press") && tags.has("rivals") && tags.has("family"));
});

test("a family event is an evening scene booked on the thread, not a card", () => {
  const s = fresh(5, { drama: 0, romance: 0, press: 0, rivals: 0, family: 100 } as never);
  for (let i = 0; i < 50; i++) core.layerSeeds(s, 3);
  const t = Object.values(s.threads).find((x) => x.layer === "family");
  assert.ok(t?.beats.some((b) => b.type === "big_scene" && b.blueprint === "family"));
});
