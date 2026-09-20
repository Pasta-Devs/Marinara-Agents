import assert from "node:assert/strict";
import {
  SLURP_CONTENT_TYPES,
  slurpContentTypeInstruction,
  slurpPostContentType,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-content-type.ts";
import { slurpPromptDescriptions } from "../packages/slurp2/src/engine/packages/server/src/slp/base/prompting/slp-prompt-blocks.ts";

// Story and teaser are decided by the format rotation and the access rotation. Choosing them again
// here would let the three decisions disagree, so they are taken as given.
assert.equal(slurpPostContentType("creator-a", 0, { story: true }), "story");
assert.equal(slurpPostContentType("creator-a", 0, { teaser: true }), "teaser");
// A Story outranks a teaser, matching the order the generation service applies them.
assert.equal(slurpPostContentType("creator-a", 0, { story: true, teaser: true }), "story");
for (let sequence = 0; sequence < 60; sequence += 1) {
  const type = slurpPostContentType("creator-a", sequence, {});
  assert.ok(SLURP_CONTENT_TYPES.includes(type));
  assert.ok(type !== "story" && type !== "teaser", "the rotation must not re-decide story or teaser");
}

// Produce mode draws from weights. Consecutive posts may repeat, and the sequence is stable.
const weightedTypes = Array.from({ length: 200 }, (_, sequence) => slurpPostContentType("creator-a", sequence, {}));
assert.ok(
  weightedTypes.some((type, index) => type === weightedTypes[index - 1]),
  "weighted draws may repeat naturally",
);
assert.deepEqual(
  weightedTypes,
  Array.from({ length: 200 }, (_, sequence) => slurpPostContentType("creator-a", sequence, {})),
);

// Two Creators must not march through the jobs in lockstep.
const a = Array.from({ length: 12 }, (_, i) => slurpPostContentType("creator-a", i, {}));
const b = Array.from({ length: 12 }, (_, i) => slurpPostContentType("creator-b", i, {}));
assert.notDeepEqual(a, b);

// A bad post count must not index nothing and hand the caller an undefined type.
for (const sequence of [Number.NaN, -3, 2.5, Number.POSITIVE_INFINITY]) {
  assert.ok(SLURP_CONTENT_TYPES.includes(slurpPostContentType("creator-a", sequence, {})));
}

// Most of what a person posts is not a product. A feed where every entry is a sale reads as false
// as one where every entry is a confession, so ordinary life must be the most common job.
const spread = Array.from({ length: 200 }, (_, i) => slurpPostContentType("creator-a", i, {}));
const life = spread.filter((type) => type === "life").length;
assert.ok(life / spread.length > 0.2, `ordinary life posts were only ${life} of ${spread.length}`);
assert.ok(new Set(spread).size >= 6, "the rotation must actually use its range");

// The single most visible artificial signal in the shipped feed was every post ending with an
// invitation to the reader. Every job must carry the instruction that stops it.
for (const type of SLURP_CONTENT_TYPES) {
  assert.match(slurpContentTypeInstruction(type), /Do not end with an invitation out of habit/u);
  assert.match(slurpContentTypeInstruction(type), /# What this post is for/u);
}

// Optional, so the Classic prompt preset can switch it off. See slurp-prompt-blocks.regression.ts.
const contentTypeBlock = slurpPromptDescriptions()
  .find((prompt) => prompt.id === "post")!
  .blocks.find((block) => block.id === "contentType");
assert.equal(contentTypeBlock?.optional, true);

console.log("slurp content type regression checks passed");
