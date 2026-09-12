import assert from "node:assert/strict";

import {
  planSlurpWorldPulse,
  slurpPulseBudget,
  SLURP_PULSE_MAX_PER_TICK,
  type SlurpPulseTarget,
} from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-world-pulse.js";
import {
  slurpAudienceReaction,
  SLURP_SHIPPED_REACTIONS,
} from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-world-copy.js";
import {
  mergeSlurpReactionBank,
  SLURP_REACTION_BANK_TARGET,
} from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-reaction-bank.js";

/** A creator with one fresh post, at the reach a brand new profile is born with. */
const NEW_CREATOR_REACH = 240;
const targets = (creators: number, postsEach = 1): SlurpPulseTarget[] =>
  Array.from({ length: creators }, (_, c) =>
    Array.from({ length: postsEach }, (_, p) => ({
      creatorAccountId: `c${c + 1}`,
      postId: `c${c + 1}-p${p + 1}`,
      ageHours: 1,
      creatorReach: NEW_CREATOR_REACH,
    })),
  ).flat();

const audience = Array.from({ length: 24 }, (_, i) => `fan${i + 1}`);
const pulse = (creators: number, minutes: number, postsEach = 1) =>
  planSlurpWorldPulse({
    elapsedMinutes: minutes,
    targets: targets(creators, postsEach),
    audience,
    seed: `seed-${creators}-${minutes}-${postsEach}`,
  });

// ── More creators means a busier world ──────────────────────────────────────
// The budget averaged reach over posts instead of summing it over creators, so six creators
// pulsed exactly as slowly as one. Adding creators is the main thing a player does to make Slurp
// feel alive, and it bought nothing.
assert.ok(
  slurpPulseBudget(30, NEW_CREATOR_REACH * 6) > slurpPulseBudget(30, NEW_CREATOR_REACH),
  "a larger combined audience must buy more reactions",
);
assert.ok(pulse(6, 30).length > pulse(1, 30).length, "six creators must out-pulse one");

// Posting more must not dilute it either: reach belongs to a creator, so a creator with eight
// fresh posts still counts once. This is what the mean got backwards.
assert.equal(
  pulse(3, 30, 1).length,
  pulse(3, 30, 8).length,
  "post count must not change the pulse budget, only where reactions land",
);

// ── A new install gets a readable trickle of free comments ──────────────────
// Target: roughly one free comment every 20-30 minutes across six new creators, at the shipped
// activity and scale. Measured over a day rather than asserted on the constants, so retuning
// MINUTES_PER_REACTION or the kind split cannot drift the felt rate without failing here.
//
// This reproduces the real caller's accumulating mark: `advanceSlurpWorld` only advances
// PULSE_KEY when a plan bought something, so time too short to afford a whole reaction is carried
// rather than rounded away. Stepping a fixed interval instead would floor to zero on every tick
// for a small install and report a dead world as working.
function dayOfPulses(creators: number, tickMinutes = 0.5) {
  let unspent = 0;
  let comments = 0;
  let reactions = 0;
  for (let tick = 0; tick < 1440 / tickMinutes; tick += 1) {
    unspent += tickMinutes;
    const actions = planSlurpWorldPulse({
      elapsedMinutes: unspent,
      targets: targets(creators),
      audience,
      seed: `tick-${creators}-${tick}`,
    });
    if (actions.length === 0) continue;
    unspent = 0;
    reactions += actions.length;
    comments += actions.filter((action) => action.kind === "comment").length;
  }
  return { comments, reactions, minutesPerComment: 1440 / comments };
}

const sixCreators = dayOfPulses(6);
assert.ok(
  sixCreators.minutesPerComment >= 20 && sixCreators.minutesPerComment <= 30,
  `expected a free comment every 20-30 minutes, got one every ${sixCreators.minutesPerComment.toFixed(0)}`,
);
assert.ok(sixCreators.comments < sixCreators.reactions / 2, "likes must stay the majority of what arrives");

// Every creator added must still buy something. The mean this replaced was flat in creator count,
// and a rate that saturates would be the same defect with a different curve.
const rates = [1, 3, 6, 12].map((n) => dayOfPulses(n).reactions);
for (let index = 1; index < rates.length; index += 1) {
  assert.ok(
    rates[index]! > rates[index - 1]!,
    `more creators must keep buying more reactions, got ${JSON.stringify(rates)}`,
  );
}

// A lone creator still has a heartbeat. Free comments are rarer there, which is correct — a small
// account should feel small — but "rarer" must not mean "never".
assert.ok(dayOfPulses(1).comments > 0, "one creator must still collect free comments");

// ── The per-tick ceiling still holds ────────────────────────────────────────
// A week away must not dump the backlog. This is the guard the retune must not have loosened.
assert.equal(slurpPulseBudget(60 * 24 * 7, NEW_CREATOR_REACH * 12), SLURP_PULSE_MAX_PER_TICK);
assert.equal(slurpPulseBudget(30, 0), 0, "no audience buys nothing");
assert.equal(pulse(6, 0).length, 0, "no elapsed time buys nothing");

// ── The stored bank widens the comments, and never breaks them ──────────────
const seed = "post-1:fan-1";
assert.equal(typeof slurpAudienceReaction(seed), "string");
assert.ok(slurpAudienceReaction(seed).length > 0, "an empty bank still writes a comment");
const withBank = new Set(
  Array.from({ length: 200 }, (_, i) => slurpAudienceReaction(`p${i}:f${i}`, ["a wholly invented line"])),
);
const withoutBank = new Set(Array.from({ length: 200 }, (_, i) => slurpAudienceReaction(`p${i}:f${i}`)));
assert.ok(withBank.size > withoutBank.size, "a stored bank must add variety, not replace it");

// ── Merging what the model returns ──────────────────────────────────────────
// The model is the one input here that cannot be trusted to return short, clean, distinct strings.
const merged = mergeSlurpReactionBank(
  ["already stored"],
  [
    "  a fresh line!!  ",
    "already stored",
    "Already Stored",
    SLURP_SHIPPED_REACTIONS[0],
    `${SLURP_SHIPPED_REACTIONS[0]!.toUpperCase()}!`,
    "",
    "   ",
    42,
    null,
    "x".repeat(500),
  ],
);
assert.deepEqual(merged, ["already stored", "a fresh line"], "normalise, drop junk, dedupe against both banks");
assert.equal(
  mergeSlurpReactionBank(
    [],
    Array.from({ length: 999 }, (_, i) => `line ${i}`),
  ).length,
  SLURP_REACTION_BANK_TARGET,
  "the bank is capped",
);
assert.deepEqual(mergeSlurpReactionBank(["kept"], []), ["kept"], "an empty answer leaves the bank alone");

console.log("slurp free comments regression: ok");
