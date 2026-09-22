import assert from "node:assert/strict";
import { slurp2Source } from "./slurp2-source";
import {
  normalizeSlurpPromptBlockOverrides,
  resolveSlurpPromptBlocks,
} from "../packages/slurp2/src/engine/packages/server/src/slp/base/prompting/slp-prompt-blocks";

// Prompt Studio lets the player take a prompt apart: every block can be switched off, and every
// block that is instruction text — not runtime data — can be rewritten.

const blocks = [
  { id: "task", kind: "editable" as const, text: "shipped task" },
  { id: "safety", kind: "required" as const, text: "shipped safety" },
  { id: "character", kind: "context" as const, text: "runtime character sheet" },
];

const stored = normalizeSlurpPromptBlockOverrides({
  post: [
    { id: "task", text: "my task" },
    { id: "safety", text: "my safety", enabled: true },
    { id: "character", text: "my character", enabled: false },
  ],
});

// Expert overrides keep both instruction and runtime-context replacements. The latter intentionally
// freezes live context until reset, which the studio warns about before copying the live text.
assert.equal(stored.post?.find((entry) => entry.id === "safety")?.text, "my safety");
assert.equal(stored.post?.find((entry) => entry.id === "character")?.text, "my character");
// Disabling is allowed everywhere, including on blocks the inventory does not mark optional.
assert.equal(stored.post?.find((entry) => entry.id === "character")?.enabled, false);

const resolved = resolveSlurpPromptBlocks("post", blocks, stored, []);
assert.deepEqual(
  resolved.map((block) => [block.id, block.text]),
  [
    ["task", "my task"],
    ["safety", "my safety"],
  ],
  "overrides must reach the composed prompt, and a disabled block must be dropped",
);

// No stored layout means the shipped text, unchanged.
assert.deepEqual(
  resolveSlurpPromptBlocks("post", blocks, undefined, []).map((block) => block.text),
  ["shipped task", "shipped safety", "runtime character sheet"],
);

const pipeline = slurp2Source(
  "packages/slurp2/src/engine/packages/client/src/slp/features/settings/SlpPromptPipeline.tsx",
);
// A required block has no shipped default to seed an empty box with, so it is overridden from the
// text the preview Creator actually gets, behind an explicit control.
assert.match(pipeline, /overrideBlock/u, "required blocks must offer an explicit override control");
assert.match(pipeline, /onUpdate\(\{ \.\.\.entry, text: shownText \}\)/u, "the override must start from the live text");
assert.match(pipeline, /const overridable = true/u, "expert mode must permit overriding runtime context too");

const inspector = slurp2Source(
  "packages/slurp2/src/engine/packages/client/src/slp/features/settings/SlpPromptPreviewInspector.tsx",
);
// The reset used to key on the objects holding the draft. Those are rebuilt on every settings
// refetch, which threw away a finished preview — including one still being generated.
assert.match(inspector, /const draftKey = JSON\.stringify\(/u);
assert.doesNotMatch(inspector, /\}, \[draftBlocks, draftInstructions, access, format, direction\]\)/u);
// A preview control that answers a click with nothing reads as broken.
assert.match(inspector, /setRunBlocked\(/u, "every refused run must say why");

const helpers = slurp2Source("packages/slurp2/src/engine/packages/client/src/slp/app/screens/SlpHomeHelpers.tsx");
// The opened post used to show the first picture only, with no way to reach the rest.
assert.match(helpers, /SlurpPostDialogThumb/u, "the post dialog must offer per-image previews");
assert.match(helpers, /post\.images\.length > 0 \? post\.images\.map/u);

console.log("slurp2-prompt-block-editing regression passed");
