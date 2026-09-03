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

/** The three spice levels, as the literal block both sides must agree on character for character. */
function guidancePresets(source: string): string {
  const match = source.match(/const SLURP_GUIDANCE_PRESETS = \{([\s\S]*?)\n\} as const;/u);
  assert.ok(match, "SLURP_GUIDANCE_PRESETS must be a single object of double-quoted literals");
  return match[1];
}

function level(presets: string, name: string): string {
  const match = presets.match(new RegExp(`\\n  ${name}:\\s+"((?:[^"\\\\]|\\\\.)*)",?`, "u"));
  assert.ok(match, `spice level ${name} must be a single double-quoted literal`);
  return match[1];
}

const serverPresets = guidancePresets(storage);
const serverDefault = level(serverPresets, "steamy");
assert.doesNotMatch(home, /NOODLER_DEFAULT_GENERATION_GUIDANCE/u);
assert.equal(
  guidancePresets(settings),
  serverPresets,
  "Slurp settings and server spice levels must match exactly, or the level picker cannot tell which one is active",
);

// The guidance ships as three spice levels, and the middle one is the default. Every level is
// adult-first and keeps each creator's personality intact; they differ only in how explicit they
// let the posts get, and none of them demote ordinary posts to filler.
assert.match(serverDefault, /adults \(18\+\)/u);
assert.match(serverDefault, /^All Slurp creators and viewers/u);

const levels = ["mild", "steamy", "explicit"] as const;
for (const level of levels)
  assert.match(serverPresets, new RegExp(`\\n  ${level}:\\s+"`, "u"), `missing level: ${level}`);
assert.match(
  storage,
  /export const NOODLER_DEFAULT_GENERATION_GUIDANCE: string = SLURP_GUIDANCE_PRESETS\.steamy;/u,
  "the middle level must be the shipped default",
);
// The levels must actually differ in explicitness, or the control does nothing.
assert.match(
  serverPresets,
  /\n  mild:\s+"[^"]*[Dd]o not write explicit/u,
  "the mild level must forbid explicit detail",
);
assert.match(serverPresets, /\n  explicit:\s+"[^"]*norm here rather than the exception/u);
assert.doesNotMatch(serverPresets, /\n  mild:\s+"[^"]*norm here rather than the exception/u);
for (const level of levels) assert.match(serverPresets, new RegExp(`\\n  ${level}:\\s+"[^"]*adults \\(18\\+\\)`, "u"));
// The typo'd build of the middle level must migrate forward rather than look like a user edit.
assert.doesNotMatch(serverPresets, /normallly/u);
assert.match(storage, /LEGACY_TYPO_SLURP_DEFAULT_GENERATION_GUIDANCE/u);

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
// The copy itself lives in the locale catalog; the surface only references the keys.
assert.match(enLocale, /"ui\.slurp\.settings\.prompts\.restoreDefault": "Restore default"/u);
assert.match(enLocale, /"ui\.slurp\.settings\.prompts\.edit": "Edit prompt"/u);
assert.match(enLocale, /"ui\.slurp\.settings\.prompts\.save": "Save prompt"/u);
assert.match(settings, /ui\.slurp\.settings\.images\.instructions/u);
assert.match(enLocale, /Edit image generation prompt/u);
// The spice picker must reach the surface, not just the catalog.
assert.match(settings, /SLURP_GUIDANCE_PRESETS\[level\]/u, "the spice picker must apply a shipped level");
assert.match(settings, /restoreDefaultImagePrompt/u);
assert.match(settings, /saveImagePrompt/u);
assert.match(storage, /NOODLER_DEFAULT_IMAGE_GENERATION_PROMPT/u);
assert.match(storage, /rawRecord\.imageGenerationPrompt === undefined \|\| rawRecord\.imageGenerationPrompt === ""/u);
assert.match(settings, /DEFAULT_SLURP_IMAGE_GENERATION_PROMPT/u);

console.log("NoodleR generation guidance default regressions passed.");
