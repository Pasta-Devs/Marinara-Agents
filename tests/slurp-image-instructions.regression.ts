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
  `A person reading beside a window.\n${styleGuidance}`,
  "A person reading beside a window.\n<art_style_guidance>private style</art_style_guidance>",
]) {
  assert.equal(
    selectNoodleImageProviderPrompt({
      rewrittenPrompt: leakedRewrite,
      rawPrompt,
      privateContext: [internalContext, styleGuidance],
    }),
    rawPrompt,
  );
}

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
}

console.log("Slurp image instruction regressions passed");
