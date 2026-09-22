import assert from "node:assert/strict";
import {
  composeSlurpPromptBlocks,
  normalizeSlurpPromptBlockOverrides,
  resolveSlurpPromptBlocks,
  slurpClassicPromptPreset,
  slurpLegacyClassicPromptBlocks,
  slurpPromptContext,
  slurpPromptDescriptions,
  SLURP_PROMPT_IDS,
} from "../packages/slurp2/src/engine/packages/server/src/slp/base/prompting/slp-prompt-blocks.ts";
import { slurp2Source } from "./slurp2-source";

assert.equal(slurpPromptDescriptions().length, SLURP_PROMPT_IDS.length, "the inventory must declare every prompt");

// `normalizeSlurpSettings` imports Engine host modules, so the test runs the same two calls it makes.
// The source assertion below pins that wiring.
type StoredPrompts = { promptBlocks?: unknown; classicPromptBlocks?: unknown; promptMode?: unknown };
const normalizeSlurpSettings = (raw: StoredPrompts | undefined) => ({
  promptBlocks: normalizeSlurpPromptBlockOverrides(raw?.promptBlocks),
  classicPromptBlocks: normalizeSlurpPromptBlockOverrides(
    raw?.classicPromptBlocks ?? slurpLegacyClassicPromptBlocks(raw?.promptBlocks),
  ),
});
assert.match(
  slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/modules/settings/slp-settings.ts"),
  /candidate\.classicPromptBlocks =\s*rawRecord\.classicPromptBlocks \?\? slurpLegacyClassicPromptBlocks\(rawRecord\.promptBlocks\);/u,
);
assert.doesNotMatch(
  slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/modules/settings/slp-settings.ts"),
  /promptMode/u,
  "the runtime mode setting is gone",
);

const block = (layout: { id: string; text?: string; enabled?: boolean }[] | undefined, id: string) =>
  layout?.find((row) => row.id === id);
const ids = (layout: { id: string }[] | undefined) => layout?.map((row) => row.id);

// 0.1.3 stored flat layouts written against the Classic inventory. They become the live layouts
// and the Classic preset source, and the blocks added since land where the inventory puts them.
const fromFlat = normalizeSlurpSettings({ promptBlocks: { post: [{ id: "continuity", text: "tuned over months" }] } });
assert.equal(block(fromFlat.promptBlocks.post, "continuity")?.text, "tuned over months");
assert.equal(block(fromFlat.classicPromptBlocks.post, "continuity")?.text, "tuned over months");
assert.deepEqual(
  ids(fromFlat.promptBlocks.post),
  slurpPromptDescriptions()
    .find((prompt) => prompt.id === "post")!
    .blocks.map((row) => row.id),
  "a migrated layout must keep the live inventory order, not append new blocks at the end",
);

// Integration builds stored layouts per runtime mode. Produce layouts win; Classic edits are kept
// for the preset and fill in only when Produce has none.
const fromModes = normalizeSlurpSettings({
  promptMode: "classic",
  promptBlocks: {
    classic: { post: [{ id: "continuity", text: "classic wording" }] },
    produce: { dmReply: [{ id: "task", text: "produce wording" }] },
  },
});
assert.equal(block(fromModes.promptBlocks.dmReply, "task")?.text, "produce wording");
assert.equal(fromModes.promptBlocks.post, undefined, "produce layouts must not be overwritten by classic ones");
assert.equal(block(fromModes.classicPromptBlocks.post, "continuity")?.text, "classic wording");
const classicOnly = normalizeSlurpSettings({ promptBlocks: { classic: { post: [{ id: "task", text: "mine" }] } } });
assert.equal(block(classicOnly.promptBlocks.post, "task")?.text, "mine", "classic-only edits must not be lost");

// A second migration is idempotent, and a later save cannot turn new edits into the Classic preset.
assert.deepEqual(normalizeSlurpSettings(JSON.parse(JSON.stringify(fromModes))), fromModes);
// `updateSettings` normalizes `{ ...current, ...input }`, so the stored preset always rides along.
const edited = normalizeSlurpSettings({ ...fromFlat, promptBlocks: { post: [{ id: "task", text: "new" }] } });
assert.equal(block(edited.classicPromptBlocks.post, "continuity")?.text, "tuned over months");
assert.equal(block(edited.classicPromptBlocks.post, "task")?.text, undefined);
assert.deepEqual(normalizeSlurpSettings(undefined).classicPromptBlocks, {});

// The preset restores Classic wording and turns off only the blocks the overhaul added. It is a
// layout, so it cannot switch any runtime behaviour back on.
const preset = slurpClassicPromptPreset(fromFlat.classicPromptBlocks);
assert.equal(block(preset.post, "continuity")?.text, "tuned over months");
for (const [promptId, id] of [
  ["post", "contentType"],
  ["post", "production"],
  ["dmReply", "performance"],
  ["commentReply", "performance"],
  ["invitedPost", "performance"],
] as const) {
  assert.equal(block(preset[promptId], id)?.enabled, false, `${promptId}/${id} must be off in the preset`);
}
assert.equal(block(preset.post, "imageDirection")?.enabled, undefined, "shared blocks keep their state");
assert.deepEqual(normalizeSlurpPromptBlockOverrides(preset), preset, "the preset must survive a save");

assert.deepEqual(slurpPromptContext({}).blocks, {});

const normalized = normalizeSlurpPromptBlockOverrides({
  post: [
    { id: "continuity", text: "custom voice" },
    { id: "output", text: "a required block is the player's to rewrite" },
    { id: "character", text: "must not replace runtime data" },
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
// Expert overrides can deliberately replace required instructions or freeze a runtime-context
// block. Prompt Studio warns about the latter and reset restores live assembly.
assert.equal(
  normalized.post?.find((block) => block.id === "output")?.text,
  "a required block is the player's to rewrite",
);
assert.equal(normalized.post?.find((block) => block.id === "character")?.text, "must not replace runtime data");

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
const promptStudioSource = slurp2Source(
  "packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpPromptBlockBuilder.tsx",
);
const backstageKitSource = slurp2Source(
  "packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpBackstageWorkflow.tsx",
);
assert.match(dmSource, /id: "outputContract"/u);
assert.match(dmSource, /id: "relationshipState"/u);
assert.match(commentSource, /id: "outputContract"/u);
assert.match(generationSource, /if \(!input\.previewOnly\) \{[\s\S]*?openSlurpShoot/u);
assert.match(generationSource, /prepareOnly:[\s\S]*?compiledPrompt/u);
assert.match(settingsRoutes, /\/settings\/prompt-blocks\/generate-preview/u);
assert.match(settingsRoutes, /prepareOnly: true,[\s\S]*?previewOnly: true/u);
assert.match(settingsRoutes, /access: body\.data\.access/u);
assert.match(settingsRoutes, /format: body\.data\.format/u);
assert.match(settingsRoutes, /noodlerPostGuide: body\.data\.direction \|\| undefined/u);
assert.match(promptStudioSource, /SlpPromptPipeline/u);
assert.match(promptStudioSource, /SlpPromptPreviewInspector/u);
assert.match(promptStudioSource, /Compare with current/u);
// Edits land in the draft as they are typed; the draft bar is the one apply step.
assert.doesNotMatch(promptStudioSource, /Apply to draft/u);
assert.match(promptStudioSource, /overviewContent/u);
// Every block is readable and editable in place: no clamp, no open-then-apply step, and runtime
// blocks show what the preview Creator actually gets, kept current without a button.
assert.match(promptStudioSource, /const shownText = liveText \?\? sharedInstruction\?\.text \?\? text;/u);
assert.match(promptStudioSource, /const overridable = true/u);
assert.doesNotMatch(promptStudioSource, /line-clamp-3 whitespace-pre-wrap/u);
assert.match(promptStudioSource, /useSlurpLivePromptBlocks\(liveInput\)/u);
assert.match(promptStudioSource, /liveCompiled=\{live\.data\?\.supported \? live\.data\.compiledText : undefined\}/u);
assert.match(backstageKitSource, /whitespace-pre-wrap break-words[\s\S]*?\{value\}/u);
assert.doesNotMatch(backstageKitSource, /line-clamp-3 whitespace-pre-line/u);

for (const prompt of slurpPromptDescriptions()) {
  assert.ok(prompt.blocks.length > 0, `${prompt.id} must define blocks`);
  assert.equal(
    new Set(prompt.blocks.map((row) => row.id)).size,
    prompt.blocks.length,
    `${prompt.id} has duplicate block ids`,
  );
}

console.log("slurp prompt block regression checks passed");
