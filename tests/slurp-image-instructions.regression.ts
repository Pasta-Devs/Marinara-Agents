import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const images = readFileSync(
  join(root, "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-images.service.ts"),
  "utf8",
);

// input.settings.imageGenerationPrompt reaches the model once, via loadPrompt()'s
// userInstructions — imagePromptInstructions must not duplicate it (review finding).
assert.match(images, /userInstructions: input\.settings\.imageGenerationPrompt/u);
assert.match(images, /imagePromptInstructions = input\.imageConnection\.imagePromptInstructions\?\.trim\(\) \?\? ""/u);
assert.doesNotMatch(images, /configuredImageInstructions/u);
assert.match(images, /instructions: imagePromptInstructions/u);
assert.match(images, /rewrittenPrompt \?\?[\s\S]*?instructionLine && !input\.promptOverride/u);

console.log("Slurp image instruction regressions passed");
