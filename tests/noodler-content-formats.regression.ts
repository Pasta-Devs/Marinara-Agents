import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The format rules live in the Engine's compiled shared schema, which imports zod,
// and in the generation service, which imports the Engine's storage and provider
// modules. Neither can be loaded from this repo — it pins no Engine dependencies —
// so these stay source-text assertions. The rules that live in package-owned pure
// modules are asserted by behaviour instead: see noodle-generation-policy and
// noodler-disclosure-contract.

const schemaPath = "sources/engine/packages/shared/dist/schemas/noodle.schema.js";
const schema = readFileSync(schemaPath, "utf8");
assert.match(schema, /noodlerContentFormatSchema = z\.enum\(\["caption", "teaser", "announcement", "long_form"\]\)/u);
assert.match(schema, /DEFAULT_NOODLER_CONTENT_FORMAT = "caption"/u);
assert.match(schema, /caption: \{ title: "optional", targetMin: 40, targetMax: 500 \}/u);
assert.match(schema, /teaser: \{ title: "optional", targetMin: 40, targetMax: 280 \}/u);
assert.match(schema, /announcement: \{ title: "required", targetMin: 80, targetMax: 1000 \}/u);
assert.match(schema, /long_form: \{ title: "required", targetMin: 500, targetMax: 4000 \}/u);
assert.match(schema, /Only long_form posts can exceed/u);
assert.match(schema, /Teaser posts must be public/u);
assert.match(schema, /Teaser posts require a locked follow-up/u);
assert.match(schema, /Only teaser posts can link a locked follow-up/u);

const generation = readFileSync(
  "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-generation.service.ts",
  "utf8",
);
const operations = readFileSync(
  "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-post.operation.ts",
  "utf8",
);
const reserve = readFileSync(
  "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-reserve.operation.ts",
  "utf8",
);
const responseFormat = readFileSync(
  "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-response-format.ts",
  "utf8",
);
const composer = readFileSync("packages/slurp/src/engine/packages/client/src/components/slurp/SlurpHome.tsx", "utf8");

assert.match(generation, /NOODLER_FORMAT_PROMPTS\[format\]/u);
// Every generated NoodleR post carries a title, whatever the format.
assert.match(generation, /noodlerTitleFromContent\(protectedContent\)/u);
assert.match(generation, /Every post needs a title/u);
// Images: the model may not opt out of the image prompt when images are enabled.
assert.match(generation, /imagePrompt is required/u);
assert.match(responseFormat, /minLength: 1, maxLength: NOODLER_TITLE_HARD_MAX_LENGTH/u);
assert.match(responseFormat, /Math\.min\(contentMaxLength, NOODLE_POST_HARD_MAX_LENGTH\)/u);
assert.match(generation, /Hard limit 300 characters/u);
assert.match(generation, /caption: 300,/u);
assert.match(generation, /NOODLER_FORMAT_MAX_LENGTH\[format\]/u);
assert.match(generation, /noodlerContentFormat: input\.request\.format \?\? "caption"/u);
assert.match(generation, /noodlerLockedFollowUpPostId/u);
assert.match(operations, /format: "caption",\s+access: "locked"/u);
assert.match(reserve, /format: "caption",\s+access: "locked"/u);
// The manual composer no longer makes the human pick a format or create locked
// follow-ups; it just derives the tag from title/length. Teaser/follow-up is not
// a user-facing NoodleR feature.
assert.match(composer, /const derivedFormat = \(\): NoodlerContentFormat =>/u);
assert.doesNotMatch(composer, /teaser|followUp|lockedFollowUp/u);

console.log("NoodleR content format regressions passed.");
