import assert from "node:assert/strict";
import test from "node:test";
import * as core from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/index.js";
import {
  finishBig,
  lapse,
} from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/bigscenes.js";
import { PLACES } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/index.js";
import type { PlaceKit } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/types.js";

const kit: PlaceKit = {
  ...PLACES.hafenkai,
  systems: [
    { kind: "season", name: "The Regatta", text: "Rowing against Carrow College." },
    { kind: "event", name: "Founders' day", text: "The owner family visits." },
  ],
};

/** A run on the Monday before week `week`, with the blocks of the test kit opened. */
const monday = (week: number, standing = 50, people = 50) => {
  const s = core.newRun(core.HAFENKAI, 7, kit);
  s.clock = { week: week - 1, day: 0, hoursLeft: 5 };
  s.meters = { ...s.meters, standing, people };
  core.blocks(s);
  return s;
};
const night = (s: ReturnType<typeof monday>, id: string) => {
  const t = Object.values(s.threads).find((x) => x.system === id)!;
  return { t, beat: t.beats.find((b) => b.type === "big_scene")! };
};

test("a fixture thread opens the week before with prep beats and a booked match night", () => {
  const s = monday(3);
  const { t, beat } = night(s, "0");
  assert.equal(t.kind, "follow_up");
  assert.equal(t.origin, "block");
  assert.equal(beat.blueprint, "match_night");
  assert.deepEqual(beat.planned, { week: 3, day: 3 });
  assert.equal(t.beats.filter((b) => b.type === "check").length, 3);
  assert.equal(s.systems["0"]!.fixtures!.length, 6);
  core.blocks(s); // the same Monday again opens nothing new
  assert.equal(Object.values(s.threads).filter((x) => x.system === "0").length, 1);
});

test("a fixture can be won and lost, and the result moves the need meter", () => {
  const won = monday(3, 60);
  finishBig(won, night(won, "0").beat.id);
  assert.equal(won.systems["0"]!.fixtures![0]!.won, true);
  assert.equal(won.meters.standing, 63); // half k at severity 2
  assert.equal(won.closed.at(-1)!.state, "won");

  const lost = monday(3, 20);
  finishBig(lost, night(lost, "0").beat.id);
  assert.equal(lost.systems["0"]!.fixtures![0]!.won, false);
  assert.equal(lost.meters.standing, 14); // k at severity 2
  assert.equal(lost.closed.at(-1)!.state, "lost");
});

test("a declined or missed night counts as lost", () => {
  const s = monday(3, 80);
  const { beat } = night(s, "0");
  s.clock = { week: 3, day: 4, hoursLeft: 5 };
  lapse(s); // the booked day has passed
  assert.equal(beat.result, "missed");
  assert.equal(s.systems["0"]!.fixtures![0]!.won, false);
  assert.equal(s.meters.standing, 74);
});

test("the Big event night is a party that feeds People", () => {
  const s = monday(12, 50, 70);
  const { t, beat } = night(s, "1");
  assert.equal(beat.blueprint, "party");
  assert.equal(t.need, "people");
  finishBig(s, beat.id);
  assert.equal(s.systems["1"]!.fixtures![0]!.won, true);
  assert.equal(s.meters.people, 73);
});

test("a removed system keeps its state and opens nothing more", () => {
  const s = monday(3, 60);
  finishBig(s, night(s, "0").beat.id);
  core.setSystem(s, "0", false);
  assert.equal(s.systems["0"]!.on, false);
  assert.equal(s.systems["0"]!.fixtures![0]!.won, true);
  s.clock = { week: 6, day: 0, hoursLeft: 5 };
  core.blocks(s);
  assert.equal(Object.values(s.threads).filter((x) => x.system === "0").length, 0);
  core.setSystem(s, "0", true);
  core.blocks(s);
  assert.equal(Object.values(s.threads).filter((x) => x.system === "0").length, 1);
});
