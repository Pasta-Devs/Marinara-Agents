import assert from "node:assert/strict";
import { slurp2Source } from "./slurp2-source";
import {
  slurpIntentFormat,
  slurpOnlyIntent,
  slurpPostAxes,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-content-axes";

// A teaser, a callback, and an ordinary day never become an essay.
for (const intent of ["teaser", "casual", "callback"] as const) {
  assert.equal(slurpIntentFormat(intent, "long_form"), "caption");
  assert.equal(slurpIntentFormat(intent, "announcement"), "caption");
}
// A fitting rotated format is kept, so length still varies.
assert.equal(slurpIntentFormat("behind_the_scenes", "long_form"), "long_form");
assert.equal(slurpIntentFormat("set", "announcement"), "announcement");
// Housekeeping falls back to an announcement.
assert.equal(slurpIntentFormat("business", "long_form"), "announcement");
// No intent (a directed post) keeps the rotation.
assert.equal(slurpIntentFormat(undefined, "long_form"), "long_form");

// A Story is no longer always casual, and never a set or a callback.
const storyIntents = new Set<string>();
for (let sequence = 0; sequence < 400; sequence += 1) {
  const axes = slurpPostAxes("story-creator", sequence, { story: true, images: true });
  assert.equal(axes.delivery, "story");
  assert.ok(axes.intent !== "set" && axes.intent !== "callback", `story drew ${axes.intent}`);
  storyIntents.add(axes.intent);
}
assert.ok(storyIntents.size > 2, `stories drew only ${[...storyIntents].join(", ")}`);
// A Creator whose only weight is on set still gets a Story, as a casual one.
assert.equal(
  slurpPostAxes("story-creator", 1, { story: true, images: true, intentWeights: slurpOnlyIntent("set") }).intent,
  "casual",
);

console.log("slurp intent format regression passed");

// A drawn callback with no shoot to continue becomes an ordinary post instead of inventing one.
const plan = slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/features/feed/slp-post-plan-service.ts");
assert.match(plan, /orphanCallback = requestedAxes\?\.intent === "callback" && !callbackShoot && !chosen && !stage/u);
assert.match(plan, /orphanCallback && reusedAxesDrawn \? \{ \.\.\.reusedAxesDrawn, intent: "casual" as const \}/u);
