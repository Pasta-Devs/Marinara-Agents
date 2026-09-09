import assert from "node:assert/strict";

import {
  addSlurpDeltas,
  applySlurpCreatorStateDelta,
  applySlurpThreadStateDelta,
  applySlurpThreadStateSignals,
  decaySlurpCreatorState,
  decaySlurpThreadState,
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
assert.equal(refusal.stance, "defensive");
assert.equal(creatorStateDeltaForSignal("fan_gave_welcome_adult_attention").intent, "tease");
assert.equal(slurpCreatorStateCanUseMedia({ ...creator, energy: 20, arousal: 100 }, thread), false);
assert.equal(slurpCreatorStateCanUseMedia({ ...creator, energy: 50, arousal: 40 }, thread), true);

const improved = applySlurpThreadStateSignals(
  thread,
  ["fan_gave_welcome_adult_attention", "fan_paid_for_content"],
  now,
);
assert.equal(improved.sexualComfort, 4);
assert.equal(improved.threadDesire, 3);
assert.equal(improved.commercialTrust, 4);
assert.equal(improved.adultLevel, "suggestive");

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

const recoveredThread = decaySlurpThreadState({ ...thread, interest: 80, threadDesire: 80, resentment: 80 }, 8, now);
assert.ok(recoveredThread.interest < 80);
assert.ok(recoveredThread.threadDesire < 80);
assert.ok(recoveredThread.resentment < 80);

assert.deepEqual(addSlurpDeltas({ interest: 2, resentment: 3 }, { interest: -1, stance: "guarded" }), {
  interest: 1,
  resentment: 3,
  stance: "guarded",
});

console.log("slurp creator state regression passed");
