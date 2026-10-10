// #1293 client rules: what a breakup step sends, which nudges an ex offers, and which aftermath
// choices the breakup sheets show.
import assert from "node:assert/strict";
import {
  slpStirCoupleSteers,
  slpStirStepOf,
} from "../packages/slurp2/src/engine/packages/client/src/slp/features/stir/slp-stir-steps.ts";
import { slpAftermathChoices } from "../packages/slurp2/src/engine/packages/client/src/slp/modules/creator/slp-breakup-aftermath.ts";

// "keep" is today's breakup: it sends no aftermath, so older servers still accept the step.
assert.deepEqual(slpStirStepOf("steer-couple", { pick: "k1", steer: "breakUp", aftermath: "keep" }), {
  coupleId: "k1",
  steer: "breakUp",
});
assert.deepEqual(slpStirStepOf("steer-couple", { pick: "k1", steer: "breakUp", aftermath: "forget" }), {
  coupleId: "k1",
  steer: "breakUp",
  aftermath: "forget",
});
// An aftermath left over from another steer never travels.
assert.deepEqual(slpStirStepOf("steer-couple", { pick: "k1", steer: "date", aftermath: "moveOn" }), {
  coupleId: "k1",
  steer: "date",
});

// An ex gets back together, moves on or forgets, minus the way it is on now; a live couple never does.
assert.deepEqual(slpStirCoupleSteers({ stage: "split" }, false), ["reunite", "moveOn", "forget"]);
assert.deepEqual(slpStirCoupleSteers({ stage: "split", aftermath: "moveOn" }, false), ["reunite", "forget"]);
for (const stage of ["sparks", "dating", "together", "rocky"]) {
  const steers = slpStirCoupleSteers({ stage }, true);
  assert.ok(steers.includes("breakUp"), stage);
  assert.ok(!steers.some((steer) => steer === "moveOn" || steer === "forget" || steer === "reunite"), stage);
}

// The sheets: a breakup starts on the usual way; an ex only switches.
assert.deepEqual(slpAftermathChoices({ stage: "together" }), ["keep", "moveOn", "forget"]);
assert.deepEqual(slpAftermathChoices({ stage: "split", aftermath: null }), ["moveOn", "forget"]);
assert.deepEqual(slpAftermathChoices({ stage: "split", aftermath: "forget" }), ["moveOn"]);

console.log("slurp2 breakup aftermath client: ok");
