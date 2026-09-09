import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  activeSlurpModifiers,
  addSlurpModifier,
  applySlurpCreatorStateDelta,
  SLURP_ENERGY_COST,
  SLURP_MODIFIERS,
  SLURP_MODIFIER_LIMIT,
  slurpModifierLines,
  applySlurpThreadStateDelta,
  applySlurpThreadStateSignals,
  decaySlurpCreatorState,
  decaySlurpThreadState,
  readSlurpCreatorState,
  lowerSlurpAdultLevel,
  nextSlurpAdultLevel,
  slurpAdultLevelIndex,
  slurpIntensityBand,
  SLURP_CREATOR_STATE_DEFAULT,
  SLURP_THREAD_STATE_DEFAULT,
  stateDeltaForSignal,
  creatorStateDeltaForSignal,
  slurpCreatorStateCanUseMedia,
  type SlurpCreatorState,
  type SlurpThreadState,
} from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-creator-state.js";

const now = "2026-09-09T12:00:00.000Z";
const creator: SlurpCreatorState = { ...SLURP_CREATOR_STATE_DEFAULT, updatedAt: now };
const thread: SlurpThreadState = { ...SLURP_THREAD_STATE_DEFAULT, updatedAt: now };

assert.equal(slurpIntensityBand(0), "low");
assert.equal(slurpIntensityBand(60), "medium");
assert.equal(slurpIntensityBand(80), "high");
assert.equal(slurpIntensityBand(81), "urgent");
assert.equal(slurpAdultLevelIndex("ordinary"), 0);
assert.equal(slurpAdultLevelIndex("explicit"), 4);

const refusal = stateDeltaForSignal("fan_pushed_after_refusal");
assert.equal(refusal.resentment, 18);
assert.equal(refusal.adultLevel, "ordinary");
assert.equal(refusal.posture, "defensive");
assert.equal(creatorStateDeltaForSignal("fan_gave_welcome_adult_attention").intent, "tease");
assert.equal(slurpCreatorStateCanUseMedia({ ...creator, energy: 20, arousal: 100 }, thread), false);
assert.equal(slurpCreatorStateCanUseMedia({ ...creator, energy: 50, arousal: 25 }, thread), true);
assert.equal(
  slurpCreatorStateCanUseMedia(
    { ...creator, energy: 50, arousal: 40 },
    { ...thread, sexualComfort: 40, respect: 50, adultLevel: "suggestive" },
  ),
  true,
);
assert.equal(
  slurpCreatorStateCanUseMedia(
    { ...creator, energy: 50, arousal: 100 },
    { ...thread, sexualComfort: 0, adultLevel: "intimate" },
  ),
  false,
);

const improved = applySlurpThreadStateSignals(
  thread,
  ["fan_gave_welcome_adult_attention", "fan_paid_for_content"],
  now,
);
assert.equal(improved.sexualComfort, 6);
assert.equal(improved.threadDesire, 5);
// One welcome signal no longer grants a ceiling. It is earned below, or it is not held.
assert.equal(improved.adultLevel, "ordinary");

// The ceiling rises one step at a time and never skips, however far past the bar the state is.
const earned = (over: Partial<SlurpThreadState>): SlurpThreadState => ({ ...thread, ...over });
assert.equal(nextSlurpAdultLevel(earned({ sexualComfort: 100, threadDesire: 100 })), "suggestive");
assert.equal(
  nextSlurpAdultLevel(earned({ adultLevel: "suggestive", sexualComfort: 100, threadDesire: 100 })),
  "provocative",
);
assert.equal(
  nextSlurpAdultLevel(earned({ adultLevel: "intimate", sexualComfort: 100, threadDesire: 100 })),
  "explicit",
);
// Every level is reachable. This is the regression: `explicit` used to be unreachable by any path.
let climbed: SlurpThreadState = earned({ sexualComfort: 100, threadDesire: 100 });
for (let step = 0; step < 8; step += 1) climbed = { ...climbed, adultLevel: nextSlurpAdultLevel(climbed) };
assert.equal(climbed.adultLevel, "explicit");

// Comfort alone never buys the top of the range: desire is required and it decays.
assert.equal(
  nextSlurpAdultLevel(earned({ adultLevel: "suggestive", sexualComfort: 100, threadDesire: 0 })),
  "suggestive",
);
// Wanting her is not enough. Respect, resentment and a defensive stance each veto a rise alone.
const wanted = { adultLevel: "suggestive", sexualComfort: 100, threadDesire: 100 } as const;
assert.equal(nextSlurpAdultLevel(earned({ ...wanted, respect: 10 })), "suggestive");
assert.equal(nextSlurpAdultLevel(earned({ ...wanted, resentment: 90 })), "suggestive");
assert.equal(nextSlurpAdultLevel(earned({ ...wanted, posture: "defensive" })), "suggestive");
// A level the thread stopped holding is lost, one step, whatever earned it.
assert.equal(nextSlurpAdultLevel(earned({ adultLevel: "explicit", sexualComfort: 0, threadDesire: 0 })), "intimate");

// A refusal caps the ceiling whichever order the model reported the signals in.
const bothOrders = ["fan_gave_welcome_adult_attention", "fan_pushed_after_refusal"] as const;
const forwards = applySlurpThreadStateSignals(earned({ sexualComfort: 90, threadDesire: 90 }), [...bothOrders], now);
const backwards = applySlurpThreadStateSignals(
  earned({ sexualComfort: 90, threadDesire: 90 }),
  [...bothOrders].reverse(),
  now,
);
assert.equal(forwards.adultLevel, "ordinary");
assert.equal(backwards.adultLevel, "ordinary");
assert.equal(lowerSlurpAdultLevel("explicit", "ordinary"), "ordinary");
assert.equal(lowerSlurpAdultLevel("suggestive", "intimate"), "suggestive");

const harmed = applySlurpThreadStateDelta({ ...thread, sexualComfort: 5, respect: 5, emotionalTrust: 5 }, refusal, now);
assert.equal(harmed.sexualComfort, 0);
assert.equal(harmed.respect, 0);
assert.equal(harmed.emotionalTrust, 0);
assert.equal(harmed.resentment, 18);

const creatorShifted = applySlurpCreatorStateDelta({ ...creator, energy: 20 }, { energy: -10, arousal: 12 }, now);
assert.equal(creatorShifted.energy, 10);
assert.equal(creatorShifted.arousal, 37);

const recoveredCreator = decaySlurpCreatorState({ ...creator, energy: 10, arousal: 90, emotionIntensity: 90 }, 2, now);
assert.ok(recoveredCreator.energy > 10 && recoveredCreator.energy < 60);
assert.ok(recoveredCreator.arousal < 90 && recoveredCreator.arousal > 25);
assert.ok(recoveredCreator.emotionIntensity < 90 && recoveredCreator.emotionIntensity > 35);
// A strong feeling still reads as itself while it lasts.
assert.equal(recoveredCreator.emotion, creator.emotion);

// A feeling that has settled hands the Creator back to herself. Before this the intensity decayed
// and the emotion never did, so one jealous afternoon lasted the rest of the save.
const settled = decaySlurpCreatorState(
  { ...creator, emotion: "jealous", intent: "tease", emotionIntensity: 90 },
  200,
  now,
);
assert.ok(settled.emotionIntensity <= 38);
assert.equal(settled.emotion, "content");
assert.equal(settled.intent, "none");

// Deleted dials stay deleted: nothing writes them, so nothing may quietly read them back.
assert.equal("needs" in SLURP_CREATOR_STATE_DEFAULT, false);
assert.equal("strategy" in SLURP_CREATOR_STATE_DEFAULT, false);
assert.equal("interest" in SLURP_THREAD_STATE_DEFAULT, false);
assert.equal("commercialTrust" in SLURP_THREAD_STATE_DEFAULT, false);

const recoveredThread = decaySlurpThreadState({ ...thread, threadDesire: 80, resentment: 80 }, 8, now);
assert.ok(recoveredThread.threadDesire < 80);
assert.ok(recoveredThread.resentment < 80);

const fadedCeiling = decaySlurpThreadState(
  { ...thread, adultLevel: "explicit", sexualComfort: 100, threadDesire: 62, updatedAt: now },
  20,
  now,
);
assert.equal(fadedCeiling.threadDesire, 0);
assert.equal(fadedCeiling.adultLevel, "intimate");

// Energy is the only dial here with a mechanical effect, and nothing used to spend it.
const worked = applySlurpCreatorStateDelta({ ...creator, energy: 60 }, { energy: -SLURP_ENERGY_COST.post }, now);
assert.equal(worked.energy, 60 - SLURP_ENERGY_COST.post);
// A commission is the most work done in one go, and a picture is more than nothing.
assert.ok(SLURP_ENERGY_COST.commission > SLURP_ENERGY_COST.post);
assert.ok(SLURP_ENERGY_COST.post > SLURP_ENERGY_COST.image);
assert.ok(SLURP_ENERGY_COST.image > 0);
// Spending never runs past the floor, however much work lands at once.
assert.equal(applySlurpCreatorStateDelta({ ...creator, energy: 2 }, { energy: -80 }, now).energy, 0);

// Every path that does work charges for it. Posting is charged at the one storage choke point
// both the manual and the generated post route through, so neither can skip it.
const slurpStorage = readFileSync(
  "packages/slurp/src/engine/packages/server/src/services/storage/slurp.storage.ts",
  "utf8",
);
assert.match(slurpStorage, /async adjustCreatorState\(/u);
assert.match(slurpStorage, /adjustCreatorState\(post\.authorAccountId, \{ energy: -SLURP_ENERGY_COST\.post \}\)/u);
// Charged after the transaction resolves: a stored post must never fail over a settings write.
assert.match(slurpStorage, /const created = await db\.transaction\(/u);

const images = readFileSync(
  "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-images.service.ts",
  "utf8",
);
assert.match(images, /adjustCreatorState\(input\.account\.id, \{ energy: -SLURP_ENERGY_COST\.image \}\)/u);

const commissions = readFileSync(
  "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-commission-delivery.service.ts",
  "utf8",
);
assert.match(commissions, /energy: -SLURP_ENERGY_COST\.commission/u);

// Modifiers expire by clock, so nothing has to sweep them.
const at = new Date("2026-09-09T12:00:00.000Z");
const posted = addSlurpModifier(creator, "just_posted", "post 3f2a", at);
assert.equal(posted.modifiers.length, 1);
assert.equal(posted.modifiers[0]?.kind, "just_posted");
assert.deepEqual(slurpModifierLines(posted, at), [SLURP_MODIFIERS.just_posted.line]);
// One hour later the same modifier is over and says nothing.
const later = new Date(at.getTime() + SLURP_MODIFIERS.just_posted.hours * 3_600_000 + 1_000);
assert.deepEqual(activeSlurpModifiers(posted, later), []);
assert.deepEqual(slurpModifierLines(posted, later), []);

// The numeric part lands once. Posting four times in an hour is one feeling, not four charges.
const oneCharge = addSlurpModifier(posted, "just_posted", "post 9c11", at);
assert.equal(oneCharge.modifiers.length, 1);
assert.equal(oneCharge.arousal, posted.arousal);
// A different feeling does charge, and does stack.
const alsoTired = addSlurpModifier(posted, "tired", "long day", at);
assert.equal(alsoTired.modifiers.length, 2);
assert.equal(alsoTired.energy, creator.energy + SLURP_MODIFIERS.tired.delta.energy!);

// A person is not ten things at once.
let crowded = creator;
for (const kind of ["just_posted", "tired", "rattled", "tipsy", "paid_well", "goal_hit"] as const) {
  crowded = addSlurpModifier(crowded, kind, "x", at);
}
assert.equal(crowded.modifiers.length, SLURP_MODIFIER_LIMIT);

// Stored modifiers are untrusted: an unknown kind, a bad date and an expired entry are all dropped.
const parsed = readSlurpCreatorState(
  JSON.stringify({
    exposure: 70,
    modifiers: [
      { kind: "not_a_feeling", until: "2999-01-01T00:00:00.000Z", source: "x" },
      { kind: "tired", until: "not a date", source: "x" },
      { kind: "rattled", until: "2000-01-01T00:00:00.000Z", source: "x" },
      { kind: "tipsy", until: "2999-01-01T00:00:00.000Z", source: "x" },
    ],
  }),
  now,
);
assert.equal(parsed.exposure, 70);
assert.deepEqual(
  parsed.modifiers.map((modifier) => modifier.kind),
  ["tipsy"],
);

// Exposure is a feeling about last night, so it is mostly gone by morning.
const morning = decaySlurpCreatorState({ ...creator, exposure: 90 }, 8, now);
assert.ok(morning.exposure < 10);

const messageOperation = readFileSync(
  "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-message.operation.ts",
  "utf8",
);
assert.match(messageOperation, /creatorState\.energy >= 35/u);
assert.match(messageOperation, /slurpCreatorStateCanUseMedia\(creatorState, thread\.threadState\)/u);

const generation = readFileSync(
  "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-message-generation.service.ts",
  "utf8",
);
assert.match(generation, /creatorState\?: SlurpCreatorState/u);
assert.match(generation, /Arousal is not permission/u);
assert.match(generation, /A sales intent is not personal intimacy/u);
assert.match(generation, /stateSignals: generated\.stateSignals/u);
assert.match(generation, /happeningNow: slurpModifierLines\(input\.creatorState\)/u);
assert.match(generation, /exposure: slurpIntensityBand\(input\.creatorState\.exposure\)/u);
const storage = readFileSync("packages/slurp/src/engine/packages/server/src/services/storage/slurp.storage.ts", "utf8");
assert.match(storage, /for \(const accountId of accountIds\)[\s\S]{0,160}?SLURP_CREATOR_STATE_KEY/u);

const routes = readFileSync("packages/slurp/src/engine/packages/server/src/routes/slurp-messages.routes.ts", "utf8");
assert.match(
  routes,
  /app\.get\("\/messages\/threads\/:threadId\/prompt"[\s\S]{0,700}?ownsCreator\(viewer\.id, thread\.creatorAccountId\)/u,
);

console.log("slurp creator state regression passed");
