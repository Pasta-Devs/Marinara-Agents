import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { selectNoodleImageProviderPrompt } from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-image-prompt";

const root = join(import.meta.dirname, "..");
const rawPrompt = "A person reading beside a window.";
const renderedTemplatePrompt =
  "Create a post. User image instructions: private instructions. Personality: private context.";
const internalContext = "User image instructions: preserve the personality notes. Personality: private context.";
const rewrittenPrompt = "A person reading beside a sunlit window, medium shot.";
const appearancePrompt = "Appearance: green eyes, short black hair, and a blue jacket.";
const styleGuidance = "Use a hand-painted editorial watercolor style.";

// Interpretation success sends the rewritten visual prompt only.
assert.equal(selectNoodleImageProviderPrompt({ rewrittenPrompt, rawPrompt }), rewrittenPrompt);
assert.equal(selectNoodleImageProviderPrompt({ rewrittenPrompt, rawPrompt }).includes(internalContext), false);
assert.equal(selectNoodleImageProviderPrompt({ rewrittenPrompt: appearancePrompt, rawPrompt }), appearancePrompt);

for (const leakedRewrite of [
  `A person reading beside a window.\n${internalContext}`,
  "A person reading beside a window.\n<character_context>private context</character_context>",
  "A person reading beside a window.\n<generation_guidance>private context</generation_guidance>",
  "A person reading beside a window.\n<user_image_instructions>private context</user_image_instructions>",
  "A person reading beside a window.\nCharacter image preferences: private context",
  "A person reading beside a window.\n<art_style_guidance>private style</art_style_guidance>",
]) {
  assert.equal(
    selectNoodleImageProviderPrompt({
      rewrittenPrompt: leakedRewrite,
      rawPrompt,
      privateContext: [internalContext],
    }),
    rawPrompt,
  );
}

// Applying the art style is the rewriter's job, so a prompt that carries the style through must
// survive. Treating style guidance as private context discarded every correctly rewritten prompt
// and sent the styleless draft to the provider instead.
const styledRewrite = `A person reading beside a sunlit window. ${styleGuidance}`;
assert.equal(
  selectNoodleImageProviderPrompt({ rewrittenPrompt: styledRewrite, rawPrompt, privateContext: [internalContext] }),
  styledRewrite,
);

// Short user guidance appears verbatim in any prompt that honours it, so it must not be treated as
// a leak. `anime style` in the image instructions used to reject every generation.
const shortInstructionRewrite = "A person reading beside a window, anime style, warm light.";
assert.equal(
  selectNoodleImageProviderPrompt({
    rewrittenPrompt: shortInstructionRewrite,
    rawPrompt,
    guidanceContext: ["anime style"],
  }),
  shortInstructionRewrite,
);

// Personality never belongs in a visual prompt, so it stays matched at any length. The block-length
// floor applies only to guidance the user wrote to steer the image.
assert.equal(
  selectNoodleImageProviderPrompt({
    rewrittenPrompt: "A person reading beside a window, sardonic and guarded.",
    rawPrompt,
    privateContext: ["sardonic and guarded"],
  }),
  rawPrompt,
);

// A copied prose block is still a leak.
const longPrivateBlock =
  "Mention build, clothing, appearance, pose, expression, setting, lighting, mood, and composition.";
assert.equal(
  selectNoodleImageProviderPrompt({
    rewrittenPrompt: `A person reading beside a window. ${longPrivateBlock}`,
    rawPrompt,
    guidanceContext: [longPrivateBlock],
  }),
  rawPrompt,
);

assert.equal(
  selectNoodleImageProviderPrompt({
    rewrittenPrompt: "A person reading beside a window with no text.",
    rawPrompt,
    privateContext: ["no text"],
  }),
  rawPrompt,
);
assert.equal(
  selectNoodleImageProviderPrompt({
    rewrittenPrompt,
    rawPrompt,
    privateContext: ["."],
  }),
  rewrittenPrompt,
);
for (const shortContext of ["a", "1"]) {
  const contextPrompt = `${rewrittenPrompt} ${shortContext}`;
  assert.equal(
    selectNoodleImageProviderPrompt({
      rewrittenPrompt: contextPrompt,
      rawPrompt,
      privateContext: [shortContext],
    }),
    contextPrompt,
  );
}

// Disabled interpretation and rewrite failure both use the raw visual prompt only.
for (const unavailablePrompt of [null, undefined, ""]) {
  const providerPrompt = selectNoodleImageProviderPrompt({
    rewrittenPrompt: unavailablePrompt,
    rawPrompt,
  });
  assert.equal(providerPrompt, rawPrompt);
  assert.equal(providerPrompt.includes(internalContext), false);
  assert.equal(providerPrompt.includes(renderedTemplatePrompt), false);
}

const images = readFileSync(
  join(root, "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-images.service.ts"),
  "utf8",
);
const publicImages = readFileSync(
  join(root, "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-public-images.service.ts"),
  "utf8",
);
for (const source of [images, publicImages]) {
  assert.match(source, /selectNoodleImageProviderPrompt/u);
  assert.doesNotMatch(source, /User image instructions:/u);
  assert.match(
    source,
    /privateContext: \[characterPersonality\],\s*guidanceContext: \[configuredImageInstructions, connectionImageInstructions\],/u,
    "art style and image preferences must reach the provider; personality is checked at any length",
  );
  // Both fallback paths — interpretation disabled, and a rejected rewrite — must still carry style.
  assert.match(source, /compiledDraft/u);
  // A reviewed prompt is recompiled so the style profile survives the review path.
  assert.match(source, /compiledOverride/u);
}

console.log("Slurp image instruction regressions passed");
