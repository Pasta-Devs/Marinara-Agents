import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The shipped NoodleR generation guidance is the whole tone contract: it is the only place the
// adult-first balance is stated, it is duplicated in the client so settings can show "Default",
// and normalizeSlurpSettings silently rewrites it for installs that never edited it. A drift
// between any of those three is invisible until a user's customized guidance is thrown away or
// the feature ships a tone the README and onboarding deny. noodle.storage.ts cannot be imported
// outside an Engine checkout (it resolves ../../db/file-query.js), so this reads the source.

const storage = readFileSync("packages/slurp/src/engine/packages/server/src/services/storage/slurp.storage.ts", "utf8");
const home = readFileSync("packages/slurp/src/engine/packages/client/src/components/slurp/SlurpHome.tsx", "utf8");
const settings = readFileSync(
  "packages/slurp/src/engine/packages/client/src/components/slurp/SlurpSettings.tsx",
  "utf8",
);
const readme = readFileSync("packages/slurp/README.md", "utf8");
const enLocale = readFileSync("packages/slurp/src/engine/packages/client/src/localization/locales/en.json", "utf8");
const generation = readFileSync(
  "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-generation.service.ts",
  "utf8",
);
const stageDraft = readFileSync(
  "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-stage-profile-draft.service.ts",
  "utf8",
);
const replyGeneration = readFileSync(
  "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-reply-generation.service.ts",
  "utf8",
);

function defaultGuidance(source: string): string {
  const match = source.match(
    /(?:^|\n)(?:export )?const NOODLER_DEFAULT_GENERATION_GUIDANCE\s*(?::\s*string\s*)?=\s*\n?\s*"((?:[^"\\]|\\.)*)";/u,
  );
  assert.ok(match, "NOODLER_DEFAULT_GENERATION_GUIDANCE must be a single double-quoted literal");
  return match[1];
}

const serverDefault = defaultGuidance(storage);
const clientDefault = defaultGuidance(
  settings.replace("DEFAULT_SLURP_GENERATION_GUIDANCE", "NOODLER_DEFAULT_GENERATION_GUIDANCE"),
);
assert.doesNotMatch(home, /NOODLER_DEFAULT_GENERATION_GUIDANCE/u);
assert.equal(clientDefault, serverDefault, "Slurp settings and server defaults must match exactly");

// Adult-first *variety*, not explicit dominance. The confirmed product decision is that explicit
// posts appear regularly but are neither mandatory nor necessarily the majority, and that
// ordinary posts stay important rather than being demoted to filler.
assert.match(serverDefault, /adults \(18\+\)/u);
assert.match(serverDefault, /^All Slurp creators and viewers/u);
assert.match(serverDefault, /not required and need not be the majority/u);
assert.doesNotMatch(serverDefault, /norm here, not the exception|most posts are lewd|the minority/u);

// The exact previously shipped prompt migrates, while any customized value remains untouched.
assert.match(storage, /LEGACY_NOODLER_DEFAULT_GENERATION_GUIDANCE/u);
assert.match(storage, /rawRecord\.generationGuidance === LEGACY_NOODLER_DEFAULT_GENERATION_GUIDANCE/u);
assert.doesNotMatch(generation, /"[^"\n]*NoodleR/u);
assert.doesNotMatch(stageDraft, /"[^"\n]*NoodleR/u);
assert.doesNotMatch(replyGeneration, /"[^"\n]*NoodleR/u);

// Creator settings must stay package-owned. The migration reads prior Slurp values once, but
// active normalization and writes must not use the public Noodle schema, defaults, or key.
assert.match(storage, /const SLURP_SETTINGS_KEY = "slurp\.settings";/u);
assert.match(storage, /export const slurpSettingsSchema = z\.object\(/u);
assert.match(storage, /export type SlurpSettings = z\.infer<typeof slurpSettingsSchema>;/u);
assert.doesNotMatch(storage, /DEFAULT_NOODLE_SETTINGS|noodleSettingsSchema|NoodleSettingsUpdateInput/u);
assert.doesNotMatch(storage, /"noodle\.settings"/u);

// Player-facing copy must not deny the shipped default.
assert.doesNotMatch(readme, /does not make content mature by default/u);
assert.doesNotMatch(enLocale, /does not make content mature by default/u);
assert.match(readme, /shipped default guidance is adult-first/u);
assert.match(settings, /Restore default/u);
assert.match(settings, /Edit prompt/u);
assert.match(settings, /Save prompt/u);
assert.match(settings, /ui\.slurp\.settings\.images\.instructions/u);
assert.match(settings, /Edit image generation prompt/u);
assert.match(settings, /restoreDefaultImagePrompt/u);
assert.match(settings, /saveImagePrompt/u);
assert.match(storage, /NOODLER_DEFAULT_IMAGE_GENERATION_PROMPT/u);
assert.match(storage, /rawRecord\.imageGenerationPrompt === undefined \|\| rawRecord\.imageGenerationPrompt === ""/u);
assert.match(settings, /DEFAULT_SLURP_IMAGE_GENERATION_PROMPT/u);

console.log("NoodleR generation guidance default regressions passed.");
