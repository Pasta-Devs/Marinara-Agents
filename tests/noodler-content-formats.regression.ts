import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schemaPath = "sources/engine/packages/shared/dist/schemas/noodle.schema.js";
const schema = readFileSync(schemaPath, "utf8");
assert.match(
  schema,
  /noodlerContentFormatSchema = z\.enum\(\["caption", "teaser", "announcement", "long_form"\]\)/u,
);
assert.match(schema, /DEFAULT_NOODLER_CONTENT_FORMAT = "caption"/u);
assert.match(schema, /caption: \{ title: "forbidden", targetMin: 40, targetMax: 500 \}/u);
assert.match(schema, /teaser: \{ title: "forbidden", targetMin: 40, targetMax: 280 \}/u);
assert.match(schema, /announcement: \{ title: "required", targetMin: 80, targetMax: 1000 \}/u);
assert.match(schema, /long_form: \{ title: "required", targetMin: 500, targetMax: 4000 \}/u);
assert.match(schema, /Only long_form posts can exceed/u);
assert.match(schema, /Teaser posts must be public/u);
assert.match(schema, /Teaser posts require a locked follow-up/u);
assert.match(schema, /Only teaser posts can link a locked follow-up/u);

const generation = readFileSync(
  "packages/noodle/src/engine/packages/server/src/services/noodle/noodle-noodler-generation.service.ts",
  "utf8",
);
const operations = readFileSync(
  "packages/noodle/src/engine/packages/server/src/services/noodle/noodle-noodler-post.operation.ts",
  "utf8",
);
const reserve = readFileSync(
  "packages/noodle/src/engine/packages/server/src/services/noodle/noodle-noodler-reserve.operation.ts",
  "utf8",
);
const composer = readFileSync(
  "packages/noodle/src/engine/packages/client/src/components/noodle/NoodlerHome.tsx",
  "utf8",
);

assert.match(generation, /NOODLER_FORMAT_PROMPTS\[format\]/u);
assert.match(generation, /const formatUsesTitle = format === "announcement" \|\| format === "long_form"/u);
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
