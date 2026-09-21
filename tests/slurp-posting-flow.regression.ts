import assert from "node:assert/strict";
import { slurp2Source } from "./slurp2-source";

/**
 * The whole posting decision, end to end.
 *
 * Every slice proved its own part. This proves they are still joined in the right order: nothing
 * decides after the model writes, nothing private reaches a post, and every outcome is recorded.
 */

const plan = slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/features/feed/slp-post-plan-service.ts");
const generation = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/slp/features/feed/slp-generation-service.ts",
);
const reserve = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/slp/features/feed/reserve/slp-reserve-operation.ts",
);

const order = (source: string, steps: string[], label: string) => {
  const positions = steps.map((step) => {
    const index = source.indexOf(step);
    assert.notEqual(index, -1, `${label}: missing step ${step}`);
    return index;
  });
  for (let index = 1; index < positions.length; index += 1) {
    assert.ok(
      positions[index]! > positions[index - 1]!,
      `${label}: ${steps[index]} must come after ${steps[index - 1]}`,
    );
  }
};

// The scheduler decides whether to post at all before it spends anything: no connection use, no
// attempt claim, no model call behind a quiet slot.
order(
  reserve,
  ["const planned = await findSlurpOpportunityBySlot", 'return "skipped" as const;', "await generateCreatorPost(db, {"],
  "reserve",
);

// One post's decisions, in the order that makes them possible: why, then what continues it, then
// which real picture, then the durable record, then the campaign, then what may be remembered.
order(
  plan,
  [
    "await findDueSlurpPromise(",
    "listOpenSlurpCampaignStages(",
    "slurpPostAxes(",
    "await findReusableSlurpShoot(",
    "await findSlurpReuse(",
    "slurpReuseDelivery(",
    "await loadSlurpReuse(",
    "planSlurpOpportunity(",
    "moveSlurpCampaignStage(",
    "listSlurpContinuityFor(",
  ],
  "plan",
);

// Generation plans first and writes second. Nothing is decided after the model has spoken.
order(
  generation,
  ["await planSlurpPost(db, {", "buildNoodlerPostMessages({", "completeSlurpCreatorPost(", "recordSlurpPostOutcome(db, {"],
  "generation",
);

// The post prompt receives the planner's decisions and the Creator's own memory, and nothing else.
for (const field of [
  "contentTypeInstruction",
  "productionInstruction",
  "continuityInstruction",
  "variationInstruction",
]) {
  assert.match(generation, new RegExp(`${field}[:,]`, "u"), `the post prompt lost ${field}`);
}

// One post lands once: the picture, the plan, the campaign stage, the promise, and the event.
order(
  plan,
  [
    'eventType: "post_published"',
    "completeSlurpOpportunity(db, opportunity.id",
    "completeSlurpCampaignStageFor(db, opportunity.id",
    "recordSlurpPromiseKept(db, opportunity",
  ],
  "outcome",
);

// Privacy, stated once more at the seam: a post reads post scopes, a reply reads its own thread.
assert.doesNotMatch(plan, /"fan_thread"|"canon_only"/u);
assert.doesNotMatch(generation, /"fan_thread"|"canon_only"/u);
assert.match(
  slurp2Source(
    "packages/slurp2/src/engine/packages/server/src/slp/features/messages/slp-message-generation-service.ts",
  ),
  /"fan_thread"/u,
);

// Every automatic outcome the plan promises is reachable: publish, text-only, reuse, and skip.
for (const workflow of ['"text_only"', '"reuse_media"', '"publish"']) {
  assert.match(plan, new RegExp(`workflow[\\s\\S]{0,120}${workflow}`, "u"), `no path produces ${workflow}`);
}
assert.match(reserve, /workflow: "skip",/u);

// A quiet slot stays free: no post, no picture, no charge, no failure mark.
const skipBlock = reserve.slice(reserve.indexOf("if (decision.skip) {"), reserve.indexOf('return "skipped" as const;'));
for (const forbidden of [
  "generateCreatorPost",
  "generateCreatorPostImage",
  "claimNoodlerAutomaticAttempt",
  "imageGenerationFailed",
]) {
  assert.ok(!skipBlock.includes(forbidden), `a chosen skip must not ${forbidden}`);
}

console.log("slurp posting flow regression checks passed");
