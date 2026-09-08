import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  containsIdentity,
  normalizedDisclosureWords,
  protectNoodlerGeneratedIdentity,
  protectedIdentityValues,
  stageProfileContainsPublicIdentity,
  stageProfileContainsSourceDetails,
} from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-identity-protection";

// The disclosure privacy core had no behavioural coverage: the existing disclosure test only
// grepped source text, which passes forever regardless of what the code does. These assertions
// execute the functions.

const identity = { displayName: "Mari Vale", handle: "marivale", sourceIdentifiers: ["char-1"] };

// --- protectNoodlerGeneratedIdentity ---------------------------------------------------------

// Open is a pass-through.
assert.equal(protectNoodlerGeneratedIdentity("Mari Vale was here", "open", identity), "Mari Vale was here");

// Hinted rewrites into something a creator would type; Secret uses the flatter word.
assert.equal(protectNoodlerGeneratedIdentity("Mari Vale was here", "hinted", identity), "you-know-who was here");
assert.equal(protectNoodlerGeneratedIdentity("Mari Vale was here", "secret", identity), "someone was here");

// A leading @ is consumed rather than left dangling.
assert.equal(protectNoodlerGeneratedIdentity("ask @marivale", "secret", identity), "ask someone");

// The longest identifier wins, so the name is not half-replaced from the inside.
assert.doesNotMatch(protectNoodlerGeneratedIdentity("Mari Vale", "secret", identity) ?? "", /Vale/u);

// A "Name (@handle)" pair collapses to one token instead of "someone (@someone)".
assert.equal(protectNoodlerGeneratedIdentity("Mari Vale (@marivale)", "secret", identity), "someone");

// Word boundaries are respected: a longer word that merely contains the handle is left alone.
assert.equal(
  protectNoodlerGeneratedIdentity("marivalentine posts daily", "secret", identity),
  "marivalentine posts daily",
);

// The source entity id never survives into generated text either.
assert.doesNotMatch(protectNoodlerGeneratedIdentity("see char-1", "hinted", identity) ?? "", /char-1/u);

// Empty input is null, not an empty string that would read as "no identity to protect".
assert.equal(protectNoodlerGeneratedIdentity("   ", "secret", identity), null);

// With no linked identity there is nothing to redact against, so the value passes through trimmed.
assert.equal(protectNoodlerGeneratedIdentity(" hello ", "secret", null), "hello");

// --- protectedIdentityValues / containsIdentity ------------------------------------------------

assert.deepEqual(protectedIdentityValues(identity), ["Mari Vale", "marivale", "char-1"]);
assert.ok(containsIdentity("posted by Mari Vale today", "Mari Vale"));
assert.ok(containsIdentity("ping @marivale", "marivale"));
assert.ok(!containsIdentity("marivalentine", "marivale"));
assert.ok(!containsIdentity("anything", "   "));

// --- stageProfileContainsPublicIdentity --------------------------------------------------------

const leakyProfile = {
  displayName: "Velvet Hours",
  handle: "velvet",
  bio: "Actually Mari Vale, but quieter.",
  stagePersonality: "Dry and teasing.",
  disclosureMode: "hinted" as const,
};
assert.ok(stageProfileContainsPublicIdentity(leakyProfile, identity), "a bio naming the source must be rejected");
assert.ok(
  !stageProfileContainsPublicIdentity({ ...leakyProfile, disclosureMode: "open" }, identity),
  "Open is allowed to name the source",
);
assert.ok(!stageProfileContainsPublicIdentity({ ...leakyProfile, bio: "Quieter than most." }, identity));

// --- normalizedDisclosureWords -----------------------------------------------------------------

// Words shorter than four characters are dropped. This is the whole reason the concealment brief
// says "distinctive words, ignoring short connecting words" and not "four consecutive words".
assert.deepEqual(normalizedDisclosureWords("Mari is a tall woman who works in a busy coffee shop near the river"), [
  "mari",
  "tall",
  "woman",
  "works",
  "busy",
  "coffee",
  "shop",
  "near",
  "river",
]);

// --- stageProfileContainsSourceDetails ---------------------------------------------------------

const source = {
  name: "Mari Vale",
  description: "A tall woman who works in a busy coffee shop near the river.",
  scenario: "",
  appearance: "",
  backstory: "",
  personality: "Dry, teasing, never explains the joke.",
};

const copiedProfile = {
  displayName: "Velvet Hours",
  handle: "velvet",
  bio: "She works in a busy coffee shop.",
  stagePersonality: "Warm.",
  disclosureMode: "hinted" as const,
};
assert.ok(stageProfileContainsSourceDetails(copiedProfile, source), "a copied run of content words is rejected");

// Open is never checked against the source.
assert.ok(!stageProfileContainsSourceDetails({ ...copiedProfile, disclosureMode: "open" }, source));

// Genuinely reworded content passes.
assert.ok(
  !stageProfileContainsSourceDetails({ ...copiedProfile, bio: "Pulls espresso by the water, mostly at dawn." }, source),
);

// Secret and Hinted are held to the same field set. Personality is deliberately part of the seed
// both concealed modes receive, so reusing it must not fail Secret while passing Hinted.
const personalityEcho = { ...copiedProfile, bio: "Dry, teasing, never explains the joke." };
assert.equal(
  stageProfileContainsSourceDetails({ ...personalityEcho, disclosureMode: "secret" }, source),
  stageProfileContainsSourceDetails({ ...personalityEcho, disclosureMode: "hinted" }, source),
  "Secret must not be held to a stricter field set than Hinted",
);

// --- the briefs must describe the rule the validator actually enforces -------------------------

const root = join(import.meta.dirname, "..");
const draft = readFileSync(
  join(root, "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-stage-profile-draft.service.ts"),
  "utf8",
);
const briefRule = /ignoring short connecting words/gu;
assert.equal(
  [...draft.matchAll(briefRule)].length,
  2,
  "both concealed briefs must state the rule in the validator's own terms",
);
// stagePersonality is generated here, so this is where it has to be defined.
assert.match(draft, /stagePersonality is the performance, not the person/u);

console.log("slurp identity protection regression passed");
