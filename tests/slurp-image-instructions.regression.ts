import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const images = readFileSync(
  join(root, "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-images.service.ts"),
  "utf8",
);

// The default template includes userInstructions, while a custom template may omit it. Preserve
// configured instructions in the latter case without duplicating them in the former.
assert.match(images, /userInstructions: input\.settings\.imageGenerationPrompt/u);
assert.match(images, /configuredImageInstructions = input\.settings\.imageGenerationPrompt\.trim\(\)/u);
assert.match(
  images,
  /configuredImageInstructions && !postPrompt\.includes\(configuredImageInstructions\) \? configuredImageInstructions : ""/u,
);
assert.match(images, /input\.imageConnection\.imagePromptInstructions\?\.trim\(\) \?\? ""/u);
assert.match(images, /instructions: imagePromptInstructions/u);
assert.match(images, /rewrittenPrompt \?\?[\s\S]*?rawFinalPrompt/u);
assert.doesNotMatch(images, /User image instructions:/u);

const publicImages = readFileSync(
  join(root, "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-public-images.service.ts"),
  "utf8",
);
assert.match(publicImages, /rewrittenPrompt \?\?[\s\S]*?rawFinalPrompt/u);
assert.doesNotMatch(publicImages, /User image instructions:/u);

console.log("Slurp image instruction regressions passed");
