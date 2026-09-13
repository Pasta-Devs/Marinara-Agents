import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Slurp2 shipped leaked "Noodle"/"NoodleR" branding in error messages, prompts, and labels.
// Identifiers (noodleAccounts, /noodler routes, ui.noodle.* keys) stay; prose does not.
const engineRoot = "packages/slurp2/src/engine/packages";
const localeRoot = join(engineRoot, "client/src/localization/locales");

// Prose that legitimately names the separate Noodle app, plus legacy values compared against
// stored data. Everything else must say Slurp.
const allowedStrings = new Set([
  // Genuine Noodle-app records the Slurp side links to.
  '"Noodle account not found"',
  '"A Slurp creator already exists for this Noodle account."',
  '"The source character or persona no longer exists in Noodle."',
  '"Noodle source account not found."',
  '"Noodle character not found."',
  '"Noodle draft generation returned no content."',
  '"Could not allocate a unique Noodle handle"',
  '"Public Noodle digests cannot reference Slurp accounts."',
  '"Reviewed Noodle image claim was lost during finalization."',
  "`${input.account.displayName} Noodle image`",
  // Noodle-timeline prompt text, still owned by the open timeline surface.
  '"No recent Noodle posts."',
  '"Noodle only accepts confirmed adult accounts and personas. Every participant on Noodle is 18+; minors are not allowed on the platform. NSFW content is allowed, anything goes, and adult in-character drama, flirtation, gossip, and explicit references may appear when they fit the accounts involved."',
  // Storage keys and legacy comparison values.
  '"noodle.noodler-image-connections"',
]);

const proseLiteral = /(["`])((?:[^"`\\\n]|\\.)*?[Nn]oodle[Rr]?[ .,:!'][^"`\n]*?)\1/gu;

const files = (readdirSync(engineRoot, { recursive: true }) as string[]).filter(
  (file) => /\.tsx?$/u.test(file) && !file.includes("localization/locales"),
);
const offenders: string[] = [];
for (const file of files) {
  // Comments are not shipped text, so only code lines are scanned.
  const text = readFileSync(join(engineRoot, file), "utf8")
    .split("\n")
    .filter((line) => !/^\s*(?:\/\/|\/?\*)/u.test(line))
    .join("\n");
  for (const match of text.matchAll(proseLiteral)) {
    const literal = match[0];
    if (allowedStrings.has(literal)) continue;
    if (literal.includes("ui.noodle.")) continue;
    if (literal.includes("LEGACY") || literal.startsWith('"All NoodleR creators and viewers are adults')) continue;
    if (literal.includes("every Noodle argument like court gossip")) continue;
    offenders.push(`${file}: ${literal.slice(0, 120)}`);
  }
}
assert.deepEqual(offenders, [], "no user-visible or LLM-bound Noodle/NoodleR prose may remain in slurp2");

// Structured output schema names reach the model verbatim.
const responseFormat = readFileSync(join(engineRoot, "server/src/services/slurp/slurp-response-format.ts"), "utf8");
// The `kind === "noodler_post"` operands are internal; only the emitted `name:` values are sent.
const nameBlock = responseFormat.slice(responseFormat.indexOf("    name:"), responseFormat.indexOf("    schema,"));
const emittedNames = [...nameBlock.matchAll(/[?:]\s*"([a-z_]+)"/gu)].map((match) => match[1]);
assert.ok(emittedNames.length >= 7, "json_schema name branches not found");
assert.deepEqual(
  emittedNames.filter((name) => name.includes("noodle")),
  [],
  "json_schema names sent to the model must be slurp_*",
);

// Server log tags.
const taggedFiles = files.filter((file) => /\[(?:debug\/)?noodler?\]/u.test(readFileSync(join(engineRoot, file), "utf8")));
assert.deepEqual(taggedFiles, [], "server log tags must read [slurp] / [debug/slurp]");

// Locale values: only the strings that compare Slurp with the Noodle app may say Noodle.
const allowedLocaleKeys = new Set([
  "ui.noodle.noodlerwizard.intro.what.help",
  "ui.slurp.settings.advanced.deleteAllConfirmDetail",
  "ui.slurp.settings.advanced.deleteAllDetail",
  "ui.slurp.settings.advanced.backupDetail",
]);
for (const localeFile of readdirSync(localeRoot)) {
  const catalog = JSON.parse(readFileSync(join(localeRoot, localeFile), "utf8")) as Record<string, string>;
  const leaked = Object.entries(catalog)
    .filter(([key, value]) => /noodle/iu.test(value) && !allowedLocaleKeys.has(key))
    .map(([key]) => `${localeFile}: ${key}`);
  assert.deepEqual(leaked, [], "locale values must not show Noodle branding for Slurp surfaces");
}

console.log("slurp2 branding regression passed");
