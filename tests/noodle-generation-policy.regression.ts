import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { noodleSamplingOptions } from "../packages/noodle/src/engine/packages/server/src/services/noodle/noodle-sampling-options";

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

assert.match(responseFormat, /function noodlerPostSchema\(allowImagePrompt: boolean, contentMaxLength: number\)/u);
assert.match(responseFormat, /allowImagePrompt\s*\? \["title", "content", "imagePrompt"\]/u);
assert.match(responseFormat, /: \["title", "content"\]/u);
assert.match(responseFormat, /NOODLE_POST_HARD_MAX_LENGTH = 4000/u);
assert.match(responseFormat, /NOODLE_REPLY_HARD_MAX_LENGTH = 2000/u);


// Sampling precedence: a parameter the user set on the connection wins, and the
// package default fills only what the user left unset.
assert.deepEqual(
  noodleSamplingOptions({}, { temperature: 0.9, topP: 0.95 }),
  { temperature: 0.9, topP: 0.95 },
);
assert.deepEqual(
  noodleSamplingOptions({ temperature: 0.2 }, { temperature: 0.9, topP: 0.95 }),
  { temperature: 0.2, topP: 0.95 },
);
assert.deepEqual(
  noodleSamplingOptions(
    { temperature: 0.2, topP: 0.1, presencePenalty: 0.5 },
    { temperature: 0.9, topP: 0.95 },
  ),
  { temperature: 0.2, topP: 0.1, presencePenalty: 0.5 },
);
// resolveStoredChatOptions returns the keys with an undefined value when the user set
// nothing, which is how a plain spread lost the package default. Present-but-undefined
// has to resolve the same as absent.
assert.deepEqual(
  noodleSamplingOptions(
    { temperature: undefined, topP: undefined },
    { temperature: 0.9, topP: 0.95 },
  ),
  { temperature: 0.9, topP: 0.95 },
);
assert.deepEqual(
  noodleSamplingOptions(
    { temperature: undefined, topP: 0.4 },
    { temperature: 0.9, topP: 0.95 },
  ),
  { temperature: 0.9, topP: 0.4 },
);
console.log("Noodle generation policy regressions passed.");
