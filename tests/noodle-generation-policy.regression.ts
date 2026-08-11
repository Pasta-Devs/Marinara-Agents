import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const prompt = readFileSync(
  "packages/noodle/src/engine/packages/server/src/services/noodle/noodle-prompt.ts",
  "utf8",
);
const responseFormat = readFileSync(
  "packages/noodle/src/engine/packages/server/src/services/noodle/noodle-response-format.ts",
  "utf8",
);

assert.match(prompt, /40-280 characters/u);
assert.match(prompt, /one or two short sentences/u);
assert.match(prompt, /casual updates/u);
assert.match(prompt, /not the default mood/u);
assert.match(prompt, /Do not copy its length, format, or emotional mood/u);
assert.match(prompt, /\.\.\.NOODLE_TONE_INSTRUCTIONS/u);

assert.match(responseFormat, /function noodlerPostSchema\(allowImagePrompt: boolean\)/u);
assert.match(responseFormat, /allowImagePrompt\s*\? \["title", "content", "imagePrompt"\]/u);
assert.match(responseFormat, /: \["title", "content"\]/u);
assert.match(responseFormat, /NOODLE_POST_HARD_MAX_LENGTH = 4000/u);
assert.match(responseFormat, /NOODLE_REPLY_HARD_MAX_LENGTH = 2000/u);

console.log("Noodle generation policy regressions passed.");
