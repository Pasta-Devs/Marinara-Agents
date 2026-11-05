import assert from "node:assert/strict";
import { test } from "node:test";
import * as core from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/index.js";
import { horrorSeeds } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/horror.js";
import {
  isAiCrew,
  strangeSeeds,
} from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/strange.js";
import {
  closeThread,
  openThread,
} from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/threads.js";
import { HAFENKAI_PLACE } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/hafenkai.js";
import { BUNDLES } from "../packages/big-cheese/src/engine/packages/client/src/features/big-cheese/bundles.js";
import type { Run } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/types.js";

const run = (layer: "horror" | "strange", dial: number, seed = 1) => {
  const s = core.newRun(HAFENKAI_PLACE, seed) as Run & { kitId: string };
  s.kitId = "hafenkai";
  s.layers = { ...s.layers, [layer]: dial };
  return s;
};
const monday = (s: Run, week: number) => {
  s.clock.week = week;
  s.clock.day = 0;
};
const finals = (s: Run) =>
  Object.values(s.threads).flatMap((t) =>
    t.beats.filter((b) => b.type === "big_scene" && b.blueprint === "final_night"),
  );
const stakes = (s: Run, stakes: string) =>
  openThread(s, { kind: "personal_arc", title: "t", origin: "arc", people: [], need: "people", stakes });

test("dial 0 opens nothing and books no final night", () => {
  const s = run("horror", 0);
  const t = run("strange", 0);
  for (let w = 1; w <= 24; w++)
    for (const x of [s, t]) {
      monday(x, w);
      horrorSeeds(x);
      strangeSeeds(x);
    }
  for (const x of [s, t]) {
    assert.equal(Object.keys(x.threads).length, 0);
    assert.equal(x.things.drawer.length + x.things.equipment.length, 0);
  }
});

test("horror: a won thread brings the missing person back, a lost one loses them", () => {
  for (const [state, status] of [
    ["won", "active"],
    ["lost", "quit"],
  ] as const) {
    const s = run("horror", 100);
    const id = Object.keys(s.people)[1]!;
    s.people[id]!.status = "missing";
    closeThread(s, stakes(s, `horror:missing:${id}`).id, state);
    assert.equal(s.people[id]!.status, status);
  }
});

test("horror: a sealed room opens on a won thread", () => {
  const s = run("horror", 100);
  const room = HAFENKAI_PLACE.rooms.find((r) => r.kind === "hidden")!.id;
  closeThread(s, stakes(s, `horror:sealed:${room}`).id, "lost");
  assert.ok(!s.openedRooms.includes(room));
  closeThread(s, stakes(s, `horror:sealed:${room}`).id, "won");
  assert.ok(s.openedRooms.includes(room));
});

test("horror: seeds open one thread at a time and may hide a person", () => {
  const s = run("horror", 100, 7);
  for (let w = 1; w <= 12; w++) {
    monday(s, w);
    horrorSeeds(s);
  }
  assert.ok(Object.values(s.threads).filter((t) => t.layer === "horror").length <= 1);
});

test("horror: the final night books once, in week 24", () => {
  const s = run("horror", 100);
  for (const w of [22, 23, 24, 24]) {
    monday(s, w);
    horrorSeeds(s);
  }
  const f = finals(s);
  assert.equal(f.length, 1);
  assert.equal(f[0]!.planned!.week, 24);
});

test("strange: things appear, one AI crew member at most, a curse ends with the person's mood", () => {
  const s = run("strange", 100, 3);
  for (let w = 1; w <= 24; w++) {
    monday(s, w);
    strangeSeeds(s);
    for (const t of Object.values(s.threads)) closeThread(s, t.id, "won");
  }
  assert.ok(s.things.drawer.length + s.things.equipment.length > 0);
  assert.ok(Object.values(s.people).filter(isAiCrew).length <= 1);
  const id = Object.keys(s.people)[0]!;
  closeThread(s, stakes(s, `strange:curse:${id}`).id, "lost");
  assert.equal(s.people[id]!.mood, "sick");
});

test("bundles set exactly their layers", () => {
  const sets = Object.fromEntries(BUNDLES.map((b) => [b.id, Object.keys(b.layers).sort()]));
  assert.deepEqual(sets, {
    soap: ["drama", "press", "romance"],
    dark: ["crime", "horror", "mystery"],
    cosy: ["family", "romance"],
    power: ["legacy", "politics", "rivals"],
  });
  for (const b of BUNDLES) for (const v of Object.values(b.layers)) assert.ok(v >= 0 && v <= 100);
});
