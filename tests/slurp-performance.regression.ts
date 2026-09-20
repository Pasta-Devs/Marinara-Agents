import assert from "node:assert/strict";
import { SLURP_PERFORMED_INTIMACY } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/creators/slp-performance.ts";
import {
  composeSlurpPromptBlocks,
  slurpPromptDescriptions,
} from "../packages/slurp2/src/engine/packages/server/src/slp/base/prompting/slp-prompt-blocks.ts";
import { slurp2Source } from "./slurp2-source";

const CONVERSATION_PROMPTS = ["dmReply", "commentReply", "invitedPost"] as const;
const ids = (mode: "classic" | "produce", prompt: string) =>
  slurpPromptDescriptions(mode)
    .find((entry) => entry.id === prompt)!
    .blocks.map((block) => block.id);

// A Creator answered a paying subscriber the way a character answers a friend: complete access,
// no schedule, no limits, no sense that any of this was a job. Produce mode says otherwise.
for (const prompt of CONVERSATION_PROMPTS) {
  assert.ok(ids("produce", prompt).includes("performance"), `${prompt} must carry the working block`);
  assert.ok(!ids("classic", prompt).includes("performance"), `${prompt} must not carry it in classic`);
}

// Forking the conversation prompts must not disturb any other prompt's blocks.
for (const prompt of slurpPromptDescriptions("classic")) {
  if (prompt.id === "post" || CONVERSATION_PROMPTS.includes(prompt.id as (typeof CONVERSATION_PROMPTS)[number]))
    continue;
  assert.deepEqual(ids("produce", prompt.id), ids("classic", prompt.id), `${prompt.id} must not have changed`);
}

// The block is optional, so a player who wants the old behaviour in one surface can switch it off
// without leaving produce mode entirely.
for (const prompt of CONVERSATION_PROMPTS) {
  const block = slurpPromptDescriptions("produce")
    .find((entry) => entry.id === prompt)!
    .blocks.find((entry) => entry.id === "performance")!;
  assert.equal(block.optional, true);
  assert.equal(block.kind, "context");
}

// Switching it off must actually remove the text, not merely hide it in the panel.
const composed = (enabled: boolean) =>
  composeSlurpPromptBlocks(
    "dmReply",
    [
      { id: "identity", kind: "required", text: "identity" },
      { id: "performance", kind: "context", text: SLURP_PERFORMED_INTIMACY, optional: true },
    ],
    { dmReply: [{ id: "identity" }, { id: "performance", enabled }] },
  );
assert.ok(composed(true).includes("You are working"));
assert.ok(!composed(false).includes("You are working"));

// The correction is that performed intimacy is performed, not that warmth or sexual content is
// wrong — both are correct for this product. A limit the Creator may state is the whole point.
assert.match(SLURP_PERFORMED_INTIMACY, /You may say no, say later/u);
assert.match(SLURP_PERFORMED_INTIMACY, /Do not invent a limit to be difficult/u);
assert.match(SLURP_PERFORMED_INTIMACY, /Leave some things unanswered/u);

// All three surfaces must gate the text on the mode, or classic would silently inherit it.
for (const file of [
  "packages/slurp2/src/engine/packages/server/src/slp/features/messages/slp-reply-generation-service.ts",
  "packages/slurp2/src/engine/packages/server/src/slp/features/messages/slp-message-generation-service.ts",
  "packages/slurp2/src/engine/packages/server/src/slp/features/feed/slp-invited-post-draft-service.ts",
]) {
  assert.match(slurp2Source(file), /text: produce \? SLURP_PERFORMED_INTIMACY : ""/u, `${file} must gate on the mode`);
}

console.log("slurp performance regression checks passed");
