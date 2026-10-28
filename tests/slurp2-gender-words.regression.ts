/**
 * Slurp text follows the page's gender (user, 2026-10-14): pronouns in drama packs and prompts,
 * a clothing style that decides whether a "lingerie" shoot is lingerie or briefs, and a sex word
 * on a look that does not say it. A page without gender is "they".
 */
import assert from "node:assert/strict";
import {
  slpAccountGender,
  slpGenderWords,
  slpPronouns,
  slpWear,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-gender.ts";
import {
  slpDramaRoleWords,
  slpDramaText,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/world/events/slp-drama-words.ts";
import {
  SLURP_BUILTIN_DRAMAS,
  SLURP_BUILTIN_SITUATIONS,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/world/events/slp-drama-packs.ts";
import { slurpSpiceAngle } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/creators/slp-spice.ts";
import { slurpImageSexWord } from "../packages/slurp2/src/engine/packages/server/src/slp/base/media/slp-image-prompt.ts";
import { slurpStageProfileInput } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/creators/improvement/slp-improvement.ts";
import { slurpPartnerWord } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-couple-lines.ts";

// --- Words -----------------------------------------------------------------------------------
assert.equal(slpPronouns("male"), "he/him");
assert.equal(slpPronouns("female"), "she/her");
assert.equal(slpPronouns(null), "they/them", "no gender is they");
assert.equal(slpPronouns("other"), "they/them");
assert.equal(slpGenderWords("female").his, "her");
assert.equal(slurpPartnerWord("male"), "boyfriend");
assert.equal(slurpPartnerWord(undefined), "partner");
assert.equal(slpAccountGender({ settings: { profile: { gender: "male" } } }), "male");
assert.equal(slpAccountGender({ settings: { profile: { gender: "robot" } } }), null);
assert.equal(slpAccountGender({}), null);

// --- Clothing style ---------------------------------------------------------------------------
assert.equal(slpWear("male", "auto"), "masculine");
assert.equal(slpWear("female", undefined), "feminine");
assert.equal(slpWear(null, "auto"), "neutral");
assert.equal(slpWear("male", "feminine"), "feminine", "the override wins: a man in lingerie");

// --- Drama packs ------------------------------------------------------------------------------
const names = { her: "Kai", ...slpDramaRoleWords("her", { gender: "male" }) };
assert.equal(
  slpDramaText("{her:He} posted. ask {her:him} about {her:his} set", names),
  "He posted. ask him about his set",
);
assert.equal(slpDramaText("{her:he} and {him:he}", { ...names }), "he and {him:he}", "an uncast role keeps its token");
assert.equal(slpDramaText("{her:he}", { her: "Mia", ...slpDramaRoleWords("her", { gender: null }) }), "they");
// No fixed "she" or "her" left in pack text: a man can play the lead. Strip only {role:word} tokens; a
// greedy {…} strip would also eat whole JSON objects and hide their text.
const packText = JSON.stringify([...SLURP_BUILTIN_DRAMAS, ...SLURP_BUILTIN_SITUATIONS]).replace(
  /\{[a-z][a-z0-9-]*(?::[A-Za-z]+)?\}/gu,
  "",
);
const keyFree = packText.replace(/"(?:id|key|role|on|to|next|between)":"[^"]*"|"between":\[[^\]]*\]/gu, "");
assert.doesNotMatch(keyFree, /\b(?:she|her|herself|she's)\b/iu, "pack text uses {role:he} tokens, not she/her");

// --- Spice: lingerie follows the clothing style ----------------------------------------------
const angle = (wear: "feminine" | "masculine" | "neutral" | undefined) =>
  slurpSpiceAngle({
    level: "suggestive",
    ceiling: "suggestive",
    access: "locked",
    teaser: false,
    creator: { accountId: "c", text: "", turnOns: ["lingerie"], hardNoes: [], wear },
    spice: { tastes: [], never: [] },
    recent: [{ kind: "tease" }],
    sequence: 1,
    teasedKind: "lingerie",
  });
assert.match(angle("feminine")!.moment, /lingerie/u);
assert.match(angle("masculine")!.moment, /underwear, briefs/u, "a masculine Creator's lingerie shoot is briefs");
assert.doesNotMatch(angle("masculine")!.line, /lingerie|bra|panties/u);
assert.equal(angle("masculine")!.kind, "lingerie", "the id stays, so learned tastes still count");
assert.match(angle("neutral")!.line, /lingerie or briefs/u);
assert.match(angle(undefined)!.moment, /lingerie/u, "no wear given: as before");

// --- Image sex word ---------------------------------------------------------------------------
assert.equal(slurpImageSexWord("Short black hair, green eyes.", "male"), "Male. Short black hair, green eyes.");
assert.equal(slurpImageSexWord("A tall woman with red hair.", "female"), "A tall woman with red hair.");
assert.equal(slurpImageSexWord("Femboy, pastel hair.", "male"), "Femboy, pastel hair.", "a look that says it stays");
assert.equal(slurpImageSexWord("Short black hair.", "other"), "Short black hair.");
assert.equal(slurpImageSexWord("", "male"), "", "no look: nothing to add to");
assert.equal(
  slurpImageSexWord("Translucent skin, transparent shirt.", "male"),
  "Male. Translucent skin, transparent shirt.",
  "trans- words that are not a sex keep the prefix",
);
assert.equal(slurpImageSexWord("Trans woman, red hair.", "female"), "Trans woman, red hair.");
assert.equal(slurpImageSexWord("Appearance: short hair.", "male"), "Male. short hair.", "the label is not left behind");

// --- Backstage improvement keeps the stage facts ------------------------------------------------
const input = slurpStageProfileInput({
  id: "c",
  displayName: "Kai",
  handle: "kai",
  bio: "",
  stagePersonality: "",
  gender: "male",
  tags: [],
  disclosureMode: "hinted",
  autoPosting: { enabled: true },
  appearance: "Short hair.",
  wardrobe: "Suits.",
  locations: "Berlin.",
  clothingStyle: "feminine",
});
assert.deepEqual(
  [input.appearance, input.wardrobe, input.locations, input.clothingStyle],
  ["Short hair.", "Suits.", "Berlin.", "feminine"],
  "an apply or rollback writes the stage facts back, not an empty stage",
);

console.log("slurp2 gender words: ok");
