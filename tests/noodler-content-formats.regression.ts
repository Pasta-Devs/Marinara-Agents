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
  "packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-generation.service.ts",
  "utf8",
);
const operations = readFileSync(
  "packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-post.operation.ts",
  "utf8",
);
const reserve = readFileSync(
  "packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-reserve.operation.ts",
  "utf8",
);
const responseFormat = readFileSync(
  "packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-response-format.ts",
  "utf8",
);
const composer = readFileSync("packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpHome.tsx", "utf8");

assert.match(generation, /NOODLER_FORMAT_PROMPTS\[format\]/u);
// Every generated NoodleR post carries a title, whatever the format.
assert.match(generation, /noodlerTitleFromContent\(protectedContent\)/u);
assert.match(generation, /Every post needs a title/u);
// Images: the model may not opt out of the image prompt when images are enabled.
assert.match(generation, /imagePrompt is required/u);
assert.match(responseFormat, /minLength: 1, maxLength: NOODLER_TITLE_HARD_MAX_LENGTH/u);
assert.match(responseFormat, /Math\.min\(contentMaxLength, NOODLE_POST_HARD_MAX_LENGTH\)/u);
assert.match(generation, /Hard limit 300 characters/u);
// The caps moved to a leaf module so the storage layer can hold an edit to the post's own format
// without importing the generation service (which imports storage back).
const contentFormat = readFileSync(
  "packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-content-format.ts",
  "utf8",
);
const storage = readFileSync("packages/slurp2/src/engine/packages/server/src/services/storage/slurp.storage.ts", "utf8");
assert.match(contentFormat, /caption: 300,/u);
assert.match(storage, /slice\(0, noodlerContentLimitFor\(nextMetadata\)\)/u, "edits honour the post's own cap");
assert.doesNotMatch(storage, /trim\(\)\.slice\(0, 4000\)/u, "no flat 4000-character truncation");
assert.match(generation, /NOODLER_FORMAT_MAX_LENGTH\[format\]/u);
assert.match(generation, /noodlerContentFormat: input\.request\.format \?\? "caption"/u);
assert.match(operations, /format: "caption",\s+access: "locked"/u);
// The reserve path deliberately passes no format: pinning `caption` there defeated the variation
// rotation, so an automatic post was always a caption.
assert.match(reserve, /access: "locked"/u);
assert.doesNotMatch(reserve, /format: "caption"/u, "automatic posts must not pin a format");
// The manual composer no longer makes the human pick a format or create locked
// follow-ups; it just derives the tag from title/length. `teaser` and locked follow-ups are gone
// entirely: the format told the model to leave a hook to a linked locked post that no route or UI
// could ever create, so every teaser promised content that did not exist.
assert.match(composer, /const derivedFormat = \(\): NoodlerContentFormat =>/u);
assert.doesNotMatch(composer, /teaser|followUp|lockedFollowUp/u);
for (const [label, source] of [
  ["generation service", generation],
  ["post operation", operations],
] as const) {
  assert.doesNotMatch(source, /lockedFollowUp/u, `${label} must not retain locked follow-up code`);
}
assert.doesNotMatch(generation, /"teaser"/u, "the teaser format is removed from the enum");

console.log("NoodleR content format regressions passed.");
