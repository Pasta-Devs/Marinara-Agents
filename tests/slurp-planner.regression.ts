import assert from "node:assert/strict";
import {
  SLURP_SKIP_REASONS,
  slurpPlanSlot,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-planner.ts";
import { slurp2Source } from "./slurp2-source";

// Every scheduled slot used to produce a post, so a Creator posted through every quiet afternoon
// they ever had. Some slots are now simply not used.
const decisions = Array.from({ length: 400 }, (_, sequence) => slurpPlanSlot("creator-a", sequence));
const skips = decisions.filter((decision) => decision.skip);
assert.ok(skips.length > 0, "a Creator must sometimes not post");
assert.ok(skips.length < decisions.length / 4, "a page that mostly goes quiet reads as broken");
for (const decision of skips) {
  assert.ok(SLURP_SKIP_REASONS.includes(decision.reason), "a skip must say why");
}

// Deterministic, so a retry repeats the decision instead of reconsidering it.
assert.deepEqual(
  decisions,
  Array.from({ length: 400 }, (_, sequence) => slurpPlanSlot("creator-a", sequence)),
);
// Two Creators must not go quiet on the same afternoons.
assert.notDeepEqual(
  decisions.slice(0, 40),
  Array.from({ length: 40 }, (_, sequence) => slurpPlanSlot("creator-b", sequence)),
);

// One quiet slot is human. Two in a row is a page that looks broken, so the second is refused.
for (let sequence = 0; sequence < 80; sequence += 1) {
  assert.equal(slurpPlanSlot("creator-a", sequence, { skippedLast: true }).skip, false);
}

// The decision must not depend on what the post would have been: the Creator is not skipping
// because the draw was dull. A skip is drawn from its own seed, so it moves independently of the
// intent draw for the same slot.
const skipSequences = decisions.flatMap((decision, sequence) => (decision.skip ? [sequence] : []));
assert.ok(skipSequences.length >= 2, "not enough skips to compare");
assert.ok(
  skipSequences.some((sequence, index) => sequence - (skipSequences[index - 1] ?? 0) > 1),
  "skips must vary",
);

// A quiet slot costs nothing: it is stored, the slot is spent, and nothing downstream reads it as
// a failure. The reserve decides before the connection is used and before any attempt is claimed.
const reserve = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/slp/features/feed/reserve/slp-reserve-operation.ts",
);
assert.match(reserve, /const decision =\s*planned\?\.workflow === "skip"/u);
assert.match(reserve, /workflow: "skip",[\s\S]*?skipReason: decision\.reason,/u);
assert.match(
  reserve,
  /await noodle\.skipNoodlerScheduledPost\(selectedSlotId, selectedPublishAt, at\);[\s\S]*?return "skipped" as const;/u,
);
// The skip branch must come before the generation call, or a quiet slot would still cost a post.
assert.ok(
  reserve.indexOf('return "skipped" as const;') < reserve.indexOf("await generateCreatorPost(db, {"),
  "the skip must be decided before generation",
);
// A stored plan is reused rather than redrawn, so a retry cannot turn a quiet slot into a post.
assert.match(reserve, /const planned = await findSlurpOpportunityBySlot\(db, selectedSlotId\);/u);

// The slot is discarded, not failed: no payload, no image, no error metadata.
const reserveStorage = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/slp/data/feed/reserve/slp-reserve-storage-1.ts",
);
assert.match(reserveStorage, /async skipNoodlerScheduledPost\(/u);
assert.match(reserveStorage, /skipNoodlerScheduledPost[\s\S]*?state: "discarded"/u);
assert.doesNotMatch(
  reserveStorage.slice(
    reserveStorage.indexOf("async skipNoodlerScheduledPost"),
    reserveStorage.indexOf("async rescheduleNoodlerPost"),
  ),
  /imageGenerationFailed|payload:/u,
  "a chosen skip must not look like a failed run",
);

// A quiet slot is spent, so the poll moves to the next one instead of stopping for the day.
const poll = slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-autopost-poll.ts");
assert.match(poll, /\| "skipped"/u);
assert.match(poll, /if \(reserve === "skipped"\) reserve = await operations\.prepare\(\);/u);

// The plan is durable before the model is called, and closed by what it produced. Planning lives in
// its own service and runs before the generator builds the prompt.
const generation = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/slp/features/feed/slp-generation-service.ts",
);
const planService = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/slp/features/feed/slp-post-plan-service.ts",
);
assert.match(planService, /await planSlurpOpportunity\(db, \{/u);
assert.ok(
  generation.indexOf("await planSlurpPost(db, {") < generation.indexOf("const messages = buildNoodlerPostMessages"),
  "the plan must be stored before the prompt is built",
);
assert.match(generation, /await recordSlurpPostOutcome\(db, \{/u);
assert.match(planService, /completeSlurpOpportunity\(db, opportunity\.id, \{ postId: post\.id, at \}\)/u);
// A settings preview decides nothing and must leave no plan behind.
assert.match(planService, /axes && !previewOnly/u);

// A plan and its slot are one record, so a retry finds the decision it already made.
const storage = slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/data/feed/slp-opportunity-storage.ts");
assert.match(
  storage,
  /if \(input\.slotId\) \{\s*const existing = await findSlurpOpportunityBySlot\(db, input\.slotId\);\s*if \(existing\) return existing;/u,
);
// A skip is over when it is made; everything else stays open until something closes it.
assert.match(storage, /completedAt: input\.workflow === "skip" \? input\.at\.toISOString\(\) : null,/u);

console.log("slurp planner regression checks passed");
