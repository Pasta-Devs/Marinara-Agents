// Big Cheese M4 T4: Crime and Mystery layers
import assert from "node:assert/strict";
import { test } from "node:test";
import * as core from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/index.js";
import { closeThread } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/threads.js";
import { HAFENKAI_PLACE } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/hafenkai.js";
import type { Run } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/types.js";

const run = (layer: "crime" | "mystery", dial: number, seed = 1) => {
  const s = core.newRun(HAFENKAI_PLACE, seed);
  s.layers = { [layer]: dial };
  return s;
};
const threads = (s: Run, layer: string) =>
  Object.values(s.threads).filter((t) => t.layer === layer && t.kind === (layer === "crime" ? "cover_up" : "mystery"));
const open = (s: Run, layer: "crime" | "mystery") => {
  for (let i = 0; i < 80 && !threads(s, layer).length; i++) core.layerSeeds(s, 5);
  return threads(s, layer)[0]!;
};

test("dial 0 opens no crime and no case", () => {
  for (const layer of ["crime", "mystery"] as const) {
    const s = run(layer, 0);
    for (let i = 0; i < 60; i++) core.layerSeeds(s, 5);
    assert.equal(threads(s, layer).length, 0);
  }
});

test("a case opens once a term, with 3 suspects and a culprit among them", () => {
  const s = run("mystery", 100);
  const t = open(s, "mystery");
  assert.equal(t.people.length, 3);
  assert.ok(t.people.includes(t.stakes.slice(8)));
  closeThread(s, t.id, "dropped");
  for (let i = 0; i < 60; i++) core.mysterySeeds(s);
  assert.equal(threads(s, "mystery").length, 0);
});

test("a clue costs 1 hour and clears one suspect", () => {
  const s = run("mystery", 100);
  const t = open(s, "mystery");
  const hours = s.clock.hoursLeft;
  const r = core.investigate(s, HAFENKAI_PLACE, t.id);
  assert.equal(r.clock.hoursLeft, hours - 1);
  const culprit = t.stakes.slice(8);
  const cleared = t.people.filter((p) => core.isCleared(r, t.id, p));
  assert.equal(cleared.length, 1);
  assert.ok(!cleared.includes(culprit));
});

test("a right accusation wins the case and a wrong one loses it", () => {
  for (const right of [true, false]) {
    const s = run("mystery", 100);
    const t = open(s, "mystery");
    const culprit = t.stakes.slice(8);
    const who = right ? culprit : t.people.find((p) => p !== culprit)!;
    const hours = s.clock.hoursLeft;
    const r = core.investigate(s, HAFENKAI_PLACE, t.id, who);
    assert.equal(r.threads[t.id], undefined);
    assert.equal(r.closed.find((c) => c.id === t.id)!.state, right ? "won" : "lost");
    assert.equal(r.clock.hoursLeft, hours);
  }
});

test("a won crime leaves evidence, and investigating a crime does too", () => {
  const s = run("crime", 100);
  const t = open(s, "crime");
  assert.equal(t.kind, "cover_up");
  const r = core.investigate(s, HAFENKAI_PLACE, t.id);
  assert.ok(r.things.drawer.some((x) => x.kind === "evidence" && x.thread === t.id));
  const s2 = run("crime", 100, 2);
  const t2 = open(s2, "crime");
  closeThread(s2, t2.id, "won");
  core.crimeSeeds(s2);
  assert.ok(s2.things.drawer.some((x) => x.kind === "evidence" && x.thread === t2.id));
});
