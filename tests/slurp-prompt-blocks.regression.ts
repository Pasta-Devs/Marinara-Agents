import assert from "node:assert/strict";
import {
  composeSlurpPromptBlocks,
  normalizeSlurpPromptBlockOverrides,
  SLURP_PROMPT_DESCRIPTIONS,
  SLURP_PROMPT_IDS,
} from "../packages/slurp2/src/engine/packages/server/src/slp/base/prompting/slp-prompt-blocks.ts";
import { slurp2Source } from "./slurp2-source";

assert.equal(SLURP_PROMPT_DESCRIPTIONS.length, SLURP_PROMPT_IDS.length);

const normalized = normalizeSlurpPromptBlockOverrides({
  post: [
    { id: "continuity", text: "custom voice" },
    { id: "output", text: "must not replace this" },
    { id: "unknown", text: "discard" },
    { id: "continuity", text: "duplicate" },
  ],
  unknownPrompt: [{ id: "x", text: "discard" }],
});

assert.equal(normalized.post?.find((block) => block.id === "continuity")?.text, "custom voice");
assert.equal(
  normalized.post?.some((block) => block.id === "unknown"),
  false,
);
assert.equal(normalized.post?.filter((block) => block.id === "continuity").length, 1);
assert.equal(normalized.post?.find((block) => block.id === "output")?.text, undefined);

const output = composeSlurpPromptBlocks(
  "post",
  [
    { id: "task", kind: "editable", text: "default task" },
    { id: "safety", kind: "required", text: "required safety" },
    { id: "optional", kind: "context", text: "optional context", optional: true },
    { id: "output", kind: "required", text: "required output" },
  ],
  {
    post: [{ id: "output" }, { id: "task", text: "custom task" }, { id: "safety" }, { id: "optional", enabled: false }],
  },
);

assert.equal(output, "required output\ncustom task\nrequired safety");

const dmSource = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-message-generation.service.ts",
);
const commentSource = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-reply-generation.service.ts",
);
assert.match(dmSource, /id: "outputContract"/u);
assert.match(dmSource, /id: "relationshipState"/u);
assert.match(commentSource, /id: "outputContract"/u);

for (const prompt of SLURP_PROMPT_DESCRIPTIONS) {
  assert.ok(prompt.blocks.length > 0, `${prompt.id} must define blocks`);
  assert.equal(
    new Set(prompt.blocks.map((block) => block.id)).size,
    prompt.blocks.length,
    `${prompt.id} has duplicate block ids`,
  );
}

console.log("slurp prompt block regression checks passed");
