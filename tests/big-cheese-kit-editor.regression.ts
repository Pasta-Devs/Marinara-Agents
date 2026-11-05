// T2: what the Kit editor saves round-trips through the normalizer, and a scenario kit keeps its exact start meters.
import assert from "node:assert/strict";
import { test } from "node:test";
import * as core from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/index.js";
import { rulesOf } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/index.js";
import { HAFENKAI_PLACE } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/hafenkai.js";
import { normalizeKit } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/normalize.js";
import type { PlaceKit } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/types.js";

// What the editor sends: the built-in kit with a system, an extra meter, odd start values and a scenario.
const edited = (): PlaceKit => ({
  ...structuredClone(HAFENKAI_PLACE),
  id: "my-scenario",
  name: "Fire drill",
  systems: [{ kind: "season", name: "The Cup", text: "Teams play for the cup." }],
  extras: [{ id: "luck", label: "Luck", main: "money", value: 12 }],
  scenario: { goal: "Keep the dock open." },
  meters: {
    money: { label: "Cash", start: 5 },
    output: { label: "Out", start: 95 },
    people: { label: "Crew", start: 0 },
    standing: { label: "Name", start: 100 },
  },
});

test("a kit from the editor round-trips through the normalizer unchanged", () => {
  const r = normalizeKit(edited());
  assert.ok(r.ok);
  assert.deepEqual(r.fixes, []);
  assert.deepEqual(r.kit.systems, edited().systems);
  assert.deepEqual(r.kit.extras, edited().extras);
  assert.deepEqual(r.kit.scenario, { goal: "Keep the dock open." });
  assert.equal(
    normalizeKit({ ...edited(), extras: [1, 2, 3].map((n) => ({ id: `x${n}`, label: "X", main: "money", value: 50 })) })
      .kit?.extras?.length,
    2,
  );
});

test("a scenario kit starts a run on its exact start meters", () => {
  const r = normalizeKit(edited());
  assert.ok(r.ok);
  const s = core.newRun(rulesOf(r.kit), 7, r.kit);
  assert.deepEqual(s.meters, { money: 5, output: 95, people: 0, standing: 100 });
  assert.equal(s.extras.find((e) => e.id === "luck")?.value, 12);
});

test("extras drop reserved and repeated ids and cap the label", () => {
  const ex = (id: string, label = "X") => ({ id, label, main: "money", value: 50 });
  const r = normalizeKit({
    ...edited(),
    extras: [ex("legitimacy"), ex("money"), ex("luck", "L".repeat(99)), ex("luck")],
  });
  assert.deepEqual(
    r.kit?.extras?.map((e) => e.id),
    ["luck"],
  );
  assert.equal(r.kit?.extras?.[0]?.label.length, 40);
});
