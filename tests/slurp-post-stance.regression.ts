import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  addSlurpModifier,
  SLURP_CREATOR_STATE_DEFAULT,
  SLURP_MODIFIERS,
  type SlurpCreatorState,
} from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-creator-state.js";
import {
  resolveSlurpPostStance,
  slurpPostStanceInstruction,
} from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-post-stance.js";
import type { SlurpGoalProgress } from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-goal.js";

const at = new Date("2026-09-09T12:00:00.000Z");
const now = at.toISOString();
const base: SlurpCreatorState = { ...SLURP_CREATOR_STATE_DEFAULT, updatedAt: now };
const resolve = (
  over: Partial<SlurpCreatorState>,
  dayVibe: string | null = null,
  goal: SlurpGoalProgress | null = null,
) => resolveSlurpPostStance({ state: { ...base, ...over }, dayVibe, goal, at });

const joined = (
  over: Partial<SlurpCreatorState>,
  dayVibe: string | null = null,
  goal: SlurpGoalProgress | null = null,
) => resolve(over, dayVibe, goal).instructions.join("\n");

// An unremarkable day adds nothing. A block that always fires is a block the model stops reading.
assert.deepEqual(resolve({}).instructions, []);
assert.equal(slurpPostStanceInstruction(resolve({})), null);

// Rule 1. Energy shapes effort in both directions, and never withholds the post.
assert.match(joined({ energy: 10 }), /running low/iu);
assert.match(joined({ energy: 90 }), /more involved/iu);
assert.doesNotMatch(joined({ energy: 0 }), /do not post|skip/iu);

// Rule 2. Last night outranks this morning.
assert.match(joined({ exposure: 80 }), /further than you usually go/iu);
assert.doesNotMatch(joined({ exposure: 10 }), /further than you usually go/iu);

// Rule 3. A feeling colours the writing; a mild one is not worth a line at all.
assert.match(joined({ emotion: "irritated", emotionIntensity: 80 }), /irritated/u);
assert.match(joined({ emotion: "irritated", emotionIntensity: 80 }), /how you write/iu);
assert.doesNotMatch(joined({ emotion: "irritated", emotionIntensity: 20 }), /irritated/u);
// The day colours the post and never announces itself, the same way slurp-stance.ts uses it.
assert.match(joined({}, "Today has been quiet."), /Let it show in how you write/u);

// Rule 4. A modifier speaks in its own words, and stops when it expires.
const posted = addSlurpModifier(base, "post_landed", "post 3f2a", at);
assert.ok(
  resolveSlurpPostStance({ state: posted, dayVibe: null, goal: null, at }).instructions.includes(
    SLURP_MODIFIERS.post_landed.line,
  ),
);
const afterwards = new Date(at.getTime() + SLURP_MODIFIERS.post_landed.hours * 3_600_000 + 1_000);
assert.deepEqual(resolveSlurpPostStance({ state: posted, dayVibe: null, goal: null, at: afterwards }).instructions, []);

// Rule 5. This is the platform strategy the deleted stored field never once expressed.
const goal = (over: Partial<SlurpGoalProgress>): SlurpGoalProgress => ({
  label: "new set on Friday",
  target: 100,
  raised: 10,
  progress: 0.1,
  remaining: 90,
  met: false,
  startedAt: now,
  ...over,
});
assert.match(joined({}, null, goal({})), /reason to help/iu);
assert.match(joined({}, null, goal({ progress: 0.8, remaining: 20 })), /how close/iu);
assert.match(joined({}, null, goal({ met: true, progress: 1, remaining: 0 })), /[Tt]hank them/u);

// Evidence names every layer that spoke, so a panel can say which one caused a post.
const loaded = resolveSlurpPostStance({
  state: { ...base, energy: 10, exposure: 80, emotion: "hurt", emotionIntensity: 90 },
  dayVibe: "Today has been quiet.",
  goal: goal({}),
  at,
});
assert.deepEqual(
  loaded.evidence.map((entry) => entry.layer),
  ["energy", "exposure", "emotion", "day", "goal"],
);
// Precedence is the documented order, not the order the fields happen to be declared in.
assert.ok(loaded.instructions[0]?.includes("running low"));
assert.ok(loaded.instructions[1]?.includes("further than you usually go"));

// The block is labelled, so it cannot blur into the schedule section beneath it.
assert.match(slurpPostStanceInstruction(loaded) ?? "", /^# How you are today\n/u);

// It never decides how adult a post is: buildNoodlerPostMessages takes that from the editable
// generation guidance on purpose, and a second opinion here would overrule a player's setting.
const stance = readFileSync(
  "packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-post-stance.ts",
  "utf8",
);
assert.doesNotMatch(stance, /adultLevel|SLURP_ADULT_LEVELS/u);

// The post prompt actually receives it, and the generation path actually builds it.
const generation = readFileSync(
  "packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-generation.service.ts",
  "utf8",
);
assert.match(generation, /conditionInstruction\?: string/u);
assert.match(generation, /const conditionInstruction = await describeSlurpPostCondition\(/u);
assert.match(generation, /conditionInstruction: conditionInstruction \?\? undefined/u);
assert.match(generation, /input\.conditionInstruction \? \[input\.conditionInstruction, ""\] : \[\]/u);

// A Creator whose state cannot be read is a Creator having an ordinary day.
const service = readFileSync(
  "packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-post-condition.service.ts",
  "utf8",
);
assert.match(service, /catch \{\s*return null;/u);

// --- The world writes back ---------------------------------------------------------------
// Every modifier the vocabulary defines is worth nothing until something real produces it.
const storage = readFileSync("packages/slurp2/src/engine/packages/server/src/services/storage/slurp.storage.ts", "utf8");
// Money in: felt once it is worth feeling, and never able to fail the payment that caused it.
assert.match(storage, /amount >= SLURP_PAID_WELL_COINS/u);
assert.match(storage, /addSlurpModifier\(state, "paid_well"/u);
// Only the crossing fires, so a met goal does not re-fire on every coin after it.
assert.match(
  storage,
  /!slurpGoalProgress\(goal, current\.lifetime\)\.met && slurpGoalProgress\(goal, next\.lifetime\)\.met/u,
);
assert.match(storage, /addSlurpModifier\(state, "goal_hit"/u);
// Publishing costs effort and buys exposure, with a locked post further out than a public one.
assert.match(
  storage,
  /post\.access === "locked" \? SLURP_EXPOSURE_PER_POST\.locked : SLURP_EXPOSURE_PER_POST\.public/u,
);
assert.match(storage, /addSlurpModifier\(state, "just_posted"/u);

// The audience reacting reaches the Creator instead of stopping at the counters.
const world = readFileSync(
  "packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-world.operation.ts",
  "utf8",
);
assert.match(world, /addCreatorModifier\(creatorAccountId, "post_landed"/u);
assert.match(world, /weight < SLURP_POST_LANDED_REACTIONS/u);
// A follow moves the funnel where a like does not, so it is not worth the same.
assert.match(world, /action\.kind === "follow" \? 3 : 1/u);

console.log("slurp post stance regression passed");
