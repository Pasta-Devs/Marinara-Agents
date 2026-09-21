import assert from "node:assert/strict";
import {
  SLURP_CONTENT_DELIVERIES,
  SLURP_CONTENT_INTENTS,
  SLURP_CONTENT_WORKFLOWS,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-content-axes.ts";
import {
  slurpContentAxesInstruction,
  slurpDeliveryFits,
  slurpPostAxes,
  slurpWorkflowCanMove,
  slurpWorkflowPublishes,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-content-axes.ts";
import { slurpPromptDescriptions } from "../packages/slurp2/src/engine/packages/server/src/slp/base/prompting/slp-prompt-blocks.ts";
import { slurp2Source } from "./slurp2-source";

const draw = (creator: string, sequence: number, images = true) => slurpPostAxes(creator, sequence, { images });

// Story and teaser are decided by the format rotation and the access rotation. Choosing them again
// here would let the decisions disagree, so they are taken as given. A Story is a delivery now, so
// it no longer hides what the post is for.
assert.deepEqual(slurpPostAxes("creator-a", 0, { story: true, images: true }), {
  intent: "casual",
  delivery: "story",
});
assert.equal(slurpPostAxes("creator-a", 0, { teaser: true, images: true }).intent, "teaser");
assert.deepEqual(slurpPostAxes("creator-a", 0, { story: true, teaser: true, images: true }), {
  intent: "teaser",
  delivery: "story",
});
for (let sequence = 0; sequence < 200; sequence += 1) {
  const axes = draw("creator-a", sequence);
  assert.ok(SLURP_CONTENT_INTENTS.includes(axes.intent));
  assert.notEqual(axes.intent, "teaser", "the draw must not re-decide teaser");
  assert.ok(slurpDeliveryFits(axes.intent, axes.delivery), `${axes.intent} cannot go out as ${axes.delivery}`);
}

// Weighted draws. Consecutive posts may repeat, and the sequence is stable.
const weighted = Array.from({ length: 200 }, (_, sequence) => draw("creator-a", sequence));
assert.ok(
  weighted.some((axes, index) => axes.intent === weighted[index - 1]?.intent),
  "weighted draws may repeat naturally",
);
assert.deepEqual(
  weighted,
  Array.from({ length: 200 }, (_, sequence) => draw("creator-a", sequence)),
);

// Two Creators must not march through the jobs in lockstep.
assert.notDeepEqual(
  Array.from({ length: 12 }, (_, i) => draw("creator-a", i).intent),
  Array.from({ length: 12 }, (_, i) => draw("creator-b", i).intent),
);

// A bad post count must not index nothing and hand the caller an undefined intent.
for (const sequence of [Number.NaN, -3, 2.5, Number.POSITIVE_INFINITY]) {
  assert.ok(SLURP_CONTENT_INTENTS.includes(draw("creator-a", sequence).intent));
}

// Most of what a person posts is not a product, so ordinary life must be the most common job.
const casual = weighted.filter((axes) => axes.intent === "casual").length;
assert.ok(casual / weighted.length > 0.2, `casual posts were only ${casual} of ${weighted.length}`);
assert.ok(new Set(weighted.map((axes) => axes.intent)).size >= 6, "the draw must actually use its range");

// Text-only is a choice, not only a failure. With pictures available some posts still go out as
// words, a set never does, and business notes lean on text.
const textOnly = weighted.filter((axes) => axes.delivery === "text_only");
assert.ok(textOnly.length > 0, "some posts must be text-only by intent");
assert.ok(textOnly.length < weighted.length / 2, "text-only must not take over the feed");
assert.ok(!weighted.some((axes) => axes.intent === "set" && axes.delivery === "text_only"));
assert.ok(!weighted.some((axes) => axes.intent === "callback" && axes.delivery === "text_only"));
// Without pictures every post is text-only, and says so honestly.
for (let sequence = 0; sequence < 40; sequence += 1) {
  assert.equal(draw("creator-a", sequence, false).delivery, "text_only");
}
assert.equal(slurpPostAxes("creator-a", 0, { story: true, images: false }).delivery, "text_only");

// ponytail check: deliveries that need real media are contract-only until media selection exists.
for (const axes of weighted) {
  assert.ok(["text_only", "new_capture"].includes(axes.delivery), `${axes.delivery} must not be drawn yet`);
}

// Compatibility rules.
assert.ok(!slurpDeliveryFits("set", "text_only"), "a set is a shoot");
assert.ok(slurpDeliveryFits("set", "multi_image_set"));
assert.ok(slurpDeliveryFits("teaser", "cropped_preview"));
for (const intent of SLURP_CONTENT_INTENTS) {
  if (intent !== "teaser") assert.ok(!slurpDeliveryFits(intent, "cropped_preview"), `${intent} has nothing to sell`);
  assert.ok(
    SLURP_CONTENT_DELIVERIES.some((delivery) => slurpDeliveryFits(intent, delivery)),
    `${intent} has no delivery`,
  );
}
// Story is a delivery for casual, teaser, callback, appreciation, and request, not an intent.
for (const intent of ["casual", "teaser", "callback", "appreciation", "request"] as const) {
  assert.ok(slurpDeliveryFits(intent, "story"), `${intent} must allow a Story`);
}

// Workflow. Only `planned` is open, a delay reopens, and a skipped slot can never publish later.
for (const state of SLURP_CONTENT_WORKFLOWS) {
  if (state !== "planned") assert.ok(slurpWorkflowCanMove("planned", state) || state === "completed");
}
assert.ok(slurpWorkflowCanMove("delay", "planned"));
for (const state of ["skip", "decline", "ignore", "cancelled", "completed"] as const) {
  for (const next of SLURP_CONTENT_WORKFLOWS) assert.ok(!slurpWorkflowCanMove(state, next), `${state} is final`);
  assert.ok(!slurpWorkflowPublishes(state), `${state} must not publish`);
}
for (const state of ["publish", "text_only", "reuse_media", "fulfill", "tease"] as const) {
  assert.ok(slurpWorkflowPublishes(state));
  assert.ok(slurpWorkflowCanMove(state, "completed"));
}
assert.ok(!slurpWorkflowPublishes("delay") && !slurpWorkflowPublishes("planned"));

// The single most visible artificial signal in the shipped feed was every post ending with an
// invitation to the reader. Every job must carry the instruction that stops it.
for (const intent of SLURP_CONTENT_INTENTS) {
  for (const delivery of SLURP_CONTENT_DELIVERIES) {
    const text = slurpContentAxesInstruction({ intent, delivery });
    assert.match(text, /Do not end with an invitation out of habit/u);
    assert.match(text, /# What this post is for/u);
  }
}
assert.match(slurpContentAxesInstruction({ intent: "casual", delivery: "text_only" }), /no picture/u);
assert.match(slurpContentAxesInstruction({ intent: "casual", delivery: "story" }), /Story/u);

// Optional, so the Classic prompt preset can switch it off. See slurp-prompt-blocks.regression.ts.
const contentTypeBlock = slurpPromptDescriptions()
  .find((prompt) => prompt.id === "post")!
  .blocks.find((block) => block.id === "contentType");
assert.equal(contentTypeBlock?.optional, true);

// Text-only by intent must not be undone downstream: no brief, no image, no gallery stand-in on
// either the direct path or the scheduled path, and the decision is persisted on the post.
const generation = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/slp/features/feed/slp-generation-service.ts",
);
assert.match(generation, /const postImages = imagesEnabled && !textOnly && !reusedMedia;/u);
assert.match(generation, /const draftImagePrompt = postImages\n/u);
assert.match(generation, /if \(textOnly \|\| !settings\.allowGalleryImageAttachments/u);
assert.match(generation, /contentIntent: axes\.intent, contentDelivery: axes\.delivery/u);
assert.match(
  slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/features/feed/reserve/slp-reserve-operation.ts"),
  /payload\.metadata\.contentDelivery !== "text_only"/u,
);

console.log("slurp content axes regression checks passed");
