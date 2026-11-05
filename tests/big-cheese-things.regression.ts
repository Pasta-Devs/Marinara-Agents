// M4 T2: the drawer, secrets as evidence, equipment wear and hidden rooms.
import assert from "node:assert/strict";
import { test } from "node:test";
import * as core from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/index.js";
import { addEvidence } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/hearing.js";
import { HAFENKAI_PLACE } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/hafenkai.js";

const kit = HAFENKAI_PLACE;
const fresh = () => core.newRun(core.HAFENKAI, 1, kit);

test("a secret becomes evidence at trust 60, once", () => {
  const s = fresh();
  s.people.henrike!.trust = 59;
  core.learnSecret(s, kit, "henrike");
  assert.equal(s.things.drawer.length, 0);
  s.people.henrike!.trust = 60;
  core.learnSecret(s, kit, "henrike");
  core.learnSecret(s, kit, "henrike");
  const [item] = s.things.drawer;
  assert.equal(s.things.drawer.length, 1);
  assert.equal(item!.kind, "evidence");
  assert.equal(s.threads[item!.thread!]!.kind, "cover_up");
});

test("a hearing takes drawer evidence, at most 2", () => {
  const s = fresh();
  for (const id of ["a", "b", "c"]) core.addThing(s, { id, kind: "evidence", name: id });
  core.addThing(s, { id: "k", kind: "key", name: "k" });
  s.hearing = { meter: "money", thread: "t", week: 2, day: 1, witnesses: [], evidence: [] };
  addEvidence(s, "a");
  assert.throws(() => addEvidence(s, "k"));
  assert.throws(() => addEvidence(s, "nope"));
  addEvidence(s, "b");
  assert.throws(() => addEvidence(s, "c"));
});

test("a hidden room needs its key, a force opens it", () => {
  const s = fresh();
  assert.ok(core.isLocked(s, kit, "archive"));
  assert.throws(() => core.openRoom(s, kit, "archive"));
  assert.throws(() => core.openRoom(s, kit, "dock-a")); // not hidden
  core.addThing(s, { id: "k", kind: "key", name: "Archive key", about: "archive" });
  core.openRoom(s, kit, "archive");
  assert.ok(!core.isLocked(s, kit, "archive"));
  assert.throws(() => core.openRoom(s, kit, "archive"));
  core.openRoom(s, kit, "roof", true);
  assert.deepEqual(s.openedRooms, ["archive", "roof"]);
});

test("equipment wears 2 a week and a failing machine opens a crisis once", () => {
  const s = fresh();
  s.things.equipment.push({ id: "e", name: "Crane", room: "dock-a", condition: 21 });
  core.weekThings(s, kit);
  assert.equal(s.things.equipment[0]!.condition, 19);
  assert.equal(Object.values(s.threads).filter((t) => t.title === "Crane is failing").length, 1);
  core.weekThings(s, kit);
  assert.equal(Object.values(s.threads).filter((t) => t.title === "Crane is failing").length, 1);
});
