import assert from "node:assert/strict";
import {
  composeSlurpPromptBlocks,
  normalizeSlurpPromptBlockOverrides,
  resolveSlurpPromptBlocks,
  slurpPromptContext,
  slurpPromptDescriptions,
  SLURP_PROMPT_IDS,
} from "../packages/slurp2/src/engine/packages/server/src/slp/base/prompting/slp-prompt-blocks.ts";
import {
  SLURP_DEFAULT_PROMPT_MODE,
  SLURP_PROMPT_MODES,
} from "../packages/slurp2/src/engine/packages/server/src/slp/base/prompting/slp-prompt-modes.ts";
import { slurp2Source } from "./slurp2-source";

// Both modes declare every prompt, so the settings panel and the override store stay symmetric and
// a prompt can diverge later without a storage migration.
for (const mode of SLURP_PROMPT_MODES) {
  assert.equal(slurpPromptDescriptions(mode).length, SLURP_PROMPT_IDS.length, `${mode} must declare every prompt`);
}

// The nine fan-side and world-side prompts have nothing to do with posting intent. They must share
// one entry rather than being copied, or the two modes drift apart the first time one is edited.
const SHARED_PROMPT_IDS = [
  "pendingCommission",
  "pendingQuestion",
  "pendingOpener",
  "pendingDelivery",
  "fanActivity",
  "reactionBank",
  "ambientProfile",
  "conversationSchedule",
  "garnishAds",
] as const;
for (const id of SHARED_PROMPT_IDS) {
  const classic = slurpPromptDescriptions("classic").find((prompt) => prompt.id === id);
  const produce = slurpPromptDescriptions("produce").find((prompt) => prompt.id === id);
  assert.ok(classic && produce, `${id} must exist in both modes`);
  assert.equal(classic, produce, `${id} must be one shared entry, not a copy`);
}

// The shape that shipped before the posting-intent overhaul: keyed by prompt id, no mode. Those
// edits were written against classic's blocks and must land in classic untouched. Reinterpreting
// them against produce mode would apply careful wording to blocks the player never saw.
const migrated = normalizeSlurpPromptBlockOverrides({
  post: [{ id: "continuity", text: "tuned over months" }],
});
assert.equal(migrated.classic?.post?.find((block) => block.id === "continuity")?.text, "tuned over months");
assert.equal(migrated.produce, undefined);

// Each mode keeps its own layouts, so switching modes never discards the other side's tuning.
const perMode = normalizeSlurpPromptBlockOverrides({
  classic: { post: [{ id: "continuity", text: "classic wording" }] },
  produce: { post: [{ id: "continuity", text: "produce wording" }] },
});
assert.equal(perMode.classic?.post?.find((block) => block.id === "continuity")?.text, "classic wording");
assert.equal(perMode.produce?.post?.find((block) => block.id === "continuity")?.text, "produce wording");

// The active mode and its layouts resolve together, so a caller cannot pair one mode's text with
// another mode's block ids.
assert.equal(slurpPromptContext({ promptMode: "classic", promptBlocks: perMode }).mode, "classic");
assert.equal(
  slurpPromptContext({ promptMode: "classic", promptBlocks: perMode }).blocks.post?.find(
    (block) => block.id === "continuity",
  )?.text,
  "classic wording",
);
// An absent or unrecognised mode falls back to the shipped default rather than throwing.
assert.equal(slurpPromptContext({ promptBlocks: perMode }).mode, SLURP_DEFAULT_PROMPT_MODE);
assert.equal(slurpPromptContext({ promptMode: "nonsense", promptBlocks: perMode }).mode, SLURP_DEFAULT_PROMPT_MODE);
assert.deepEqual(slurpPromptContext({ promptMode: "classic" }).blocks, {});

const normalized = normalizeSlurpPromptBlockOverrides({
  classic: {
    post: [
      { id: "continuity", text: "custom voice" },
      { id: "output", text: "must not replace this" },
      { id: "unknown", text: "discard" },
      { id: "continuity", text: "duplicate" },
    ],
    unknownPrompt: [{ id: "x", text: "discard" }],
  },
}).classic!;

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
const resolved = resolveSlurpPromptBlocks(
  "post",
  [
    { id: "task", kind: "editable", text: "default task" },
    { id: "optional", kind: "context", text: "optional context", optional: true },
    { id: "output", kind: "required", text: "required output" },
  ],
  {
    post: [{ id: "output" }, { id: "task", instructionId: "shared" }, { id: "optional", enabled: false }],
  },
  [{ id: "shared", name: "Shared", text: "shared task" }],
);
assert.deepEqual(
  resolved.map((block) => [block.id, block.text]),
  [
    ["output", "required output"],
    ["task", "shared task"],
  ],
  "resolved blocks must apply order, reusable instructions, and optional state",
);

const dmSource = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-message-generation.service.ts",
);
const commentSource = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-reply-generation.service.ts",
);
const generationSource = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-generation.service.ts",
);
const settingsRoutes = slurp2Source("packages/slurp2/src/engine/packages/server/src/routes/slurp.routes.ts");
assert.match(dmSource, /id: "outputContract"/u);
assert.match(dmSource, /id: "relationshipState"/u);
assert.match(commentSource, /id: "outputContract"/u);
assert.match(generationSource, /if \(!input\.previewOnly\) \{[\s\S]*?openSlurpShoot/u);
assert.match(generationSource, /prepareOnly:[\s\S]*?compiledPrompt/u);
assert.match(settingsRoutes, /\/settings\/prompt-blocks\/generate-preview/u);
assert.match(settingsRoutes, /prepareOnly: true,[\s\S]*?previewOnly: true/u);

for (const mode of SLURP_PROMPT_MODES) {
  for (const prompt of slurpPromptDescriptions(mode)) {
    assert.ok(prompt.blocks.length > 0, `${mode}/${prompt.id} must define blocks`);
    assert.equal(
      new Set(prompt.blocks.map((block) => block.id)).size,
      prompt.blocks.length,
      `${mode}/${prompt.id} has duplicate block ids`,
    );
  }
}

console.log("slurp prompt block regression checks passed");
