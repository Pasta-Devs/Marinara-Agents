import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The shipped NoodleR generation guidance is the whole tone contract: it is the only place the
// adult-first balance is stated, it is duplicated in the client so settings can show "Default",
// and normalizeNoodleSettings silently rewrites it for installs that never edited it. A drift
// between any of those three is invisible until a user's customized guidance is thrown away or
// the feature ships a tone the README and onboarding deny. noodle.storage.ts cannot be imported
// outside an Engine checkout (it resolves ../../db/file-query.js), so this reads the source.

const storage = readFileSync(
  "packages/slurp/src/engine/packages/server/src/services/storage/slurp.storage.ts",
  "utf8",
);
const home = readFileSync(
  "packages/slurp/src/engine/packages/client/src/components/slurp/NoodleHome.tsx",
  "utf8",
);
const readme = readFileSync("packages/slurp/README.md", "utf8");
const enLocale = readFileSync(
  "packages/slurp/src/engine/packages/client/src/localization/locales/en.json",
  "utf8",
);

function defaultGuidance(source: string): string {
  const match = source.match(
    /NOODLER_DEFAULT_GENERATION_GUIDANCE\s*(?::\s*string\s*)?=\s*\n?\s*"((?:[^"\\]|\\.)*)";/u,
  );
  assert.ok(match, "NOODLER_DEFAULT_GENERATION_GUIDANCE must be a single double-quoted literal");
  return match[1];
}

const serverDefault = defaultGuidance(storage);
const clientDefault = defaultGuidance(home);

// The client compares stored guidance against its own copy to decide whether settings show
// "Default" and whether Reset is enabled. One stale character makes every install look edited.
assert.equal(serverDefault, clientDefault);

// Adult-first *variety*, not explicit dominance. The confirmed product decision is that explicit
// posts appear regularly but are neither mandatory nor necessarily the majority, and that
// ordinary posts stay important rather than being demoted to filler.
assert.match(serverDefault, /adults \(18\+\)/u);
assert.match(serverDefault, /not required and need not be the majority/u);
assert.doesNotMatch(serverDefault, /norm here, not the exception|most posts are lewd|the minority/u);

// Every previously shipped default must stay listed verbatim. Dropping one strands those installs
// on guidance they never chose; comparison must stay exact so an edited string is preserved.
const legacyBlock = storage.slice(
  storage.indexOf("NOODLER_LEGACY_GENERATION_GUIDANCE_DEFAULTS = ["),
  storage.indexOf("export function normalizeNoodleSettings"),
);
assert.match(legacyBlock, /norm here, not the exception/u, "pre-1.0.11 default must remain listed");
assert.match(legacyBlock, /NSFW and explicit content are allowed/u, "pre-1.0.7 default must remain listed");
assert.equal(legacyBlock.includes(serverDefault), false, "the current default is not a legacy value");
assert.match(
  storage,
  /NOODLER_LEGACY_GENERATION_GUIDANCE_DEFAULTS\.some\(\s*\(legacy\) => legacy === storedNoodlerGenerationGuidance,?\s*\)/u,
  "migration must compare stored guidance by exact equality",
);

// A stored value that matches nothing is the user's own and passes straight through.
assert.match(storage, /\?\s*NOODLER_DEFAULT_GENERATION_GUIDANCE\s*\n?\s*:\s*storedNoodlerGenerationGuidance;/u);

// Player-facing copy must not deny the shipped default.
assert.doesNotMatch(readme, /does not make content mature by default/u);
assert.doesNotMatch(enLocale, /does not make content mature by default/u);
assert.match(readme, /shipped default guidance is adult-first/u);

console.log("NoodleR generation guidance default regressions passed.");
