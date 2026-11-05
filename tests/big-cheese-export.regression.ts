// T14: export to the Engine library. The builders are pure; adult scenes stay out unless ticked.
import assert from "node:assert/strict";
import { test } from "node:test";
import * as core from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/index.js";
import { HAFENKAI_PLACE } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/hafenkai.js";
import {
  memoryEntries,
  noteText,
  placeEntries,
  withNote,
} from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/export.js";
import { closeThread } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/threads.js";
import type { Run } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/store.js";

const makeRun = (): Run => {
  const game = core.newRun(HAFENKAI_PLACE, 1);
  const [pid] = Object.keys(game.people);
  const thread = (id: string, layer?: "adult") =>
    ({
      id,
      kind: "personal_arc",
      title: id === "t1" ? "The leaky roof" : "The private affair",
      people: [pid],
      stakes: "x",
      state: "won",
      layer,
    }) as never;
  game.threads = { t1: thread("t1"), t2: thread("t2", "adult") };
  game.people[pid].memories = [
    { week: 1, about: "c1", thread: "t1", stance: "invest", weight: 2 },
    { week: 2, about: "c2", thread: "t2", stance: "refuse", weight: 2 },
  ];
  // The threads are really closed, so only game.closed remembers them.
  closeThread(game, "t1", "won");
  closeThread(game, "t2", "won");
  return {
    saveVersion: 3,
    revision: 0,
    kitId: "hafenkai",
    createdAt: "",
    lite: true,
    text: { cards: {}, scenes: {}, feelings: {} },
    game,
  } as never;
};

test("adult scenes are left out unless the module is on and the player ticks them", () => {
  const run = makeRun();
  const text = (ticked?: boolean) =>
    memoryEntries(run, ticked)
      .map((e) => e.content)
      .join("\n");
  assert.match(text(), /leaky roof/);
  assert.doesNotMatch(text(), /private affair/);
  assert.doesNotMatch(text(true), /private affair/); // module off: the tick alone does nothing
  run.game.adult = { intensity: 1, themes: [] };
  assert.match(text(true), /private affair/);
  assert.doesNotMatch(text(false), /private affair/);
});

test("a closed adult thread stays out of memories and key events once the tick is off", () => {
  const run = makeRun();
  run.game.adult = { intensity: 1, themes: [] };
  const on = memoryEntries(run, true)
    .map((e) => e.content)
    .join("\n");
  assert.match(on, /private affair/);
  run.game.adult = undefined;
  const off = memoryEntries(run, true)
    .map((e) => e.content)
    .join("\n");
  assert.doesNotMatch(off, /private affair/);
  assert.doesNotMatch(noteText(run, true), /private affair/);
  assert.match(off, /leaky roof \(won\)/); // key event read from game.closed
  assert.match(noteText(run), /leaky roof \(won\)/);
  // an old save has no layer on its closed entries, so they count as adult
  for (const c of run.game.closed) delete c.layer;
  assert.doesNotMatch(
    memoryEntries(run, false)
      .map((e) => e.content)
      .join("\n"),
    /leaky roof/,
  );
});

test("the place lorebook has rooms and keeps private rooms for the adult tick", () => {
  const run = makeRun();
  const names = (t?: boolean) => placeEntries(run, t).map((e) => e.name);
  assert.ok(names().length > 3);
  run.game.adult = { intensity: 1, themes: [] };
  assert.ok(names(true).length >= names().length);
});

test("a repeated persona note replaces the old one between its markers", () => {
  const run = makeRun();
  const once = withNote("Likes tea.", "r-1", noteText(run));
  const twice = withNote(once, "r-1", "New note");
  assert.match(twice, /^Likes tea\./);
  assert.match(twice, /New note/);
  assert.doesNotMatch(twice, /What happened at/);
  assert.equal(twice.split("[big-cheese:note:r-1]").length, 2);
  assert.ok(noteText(run).split("\n").length <= 4);
});
