import assert from "node:assert/strict";
import { slurpImageLook } from "../packages/slurp2/src/engine/packages/server/src/slp/base/media/slp-image-prompt.ts";
import { buildSlpSceneTurnMessages } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/onboarding/slp-scene-prompt.ts";
import { slurp2Source } from "./slurp2-source";

// A Stage look drafted from a card keeps the card's clothes. Those clothes reached nude pictures
// ("a sweater in a shower", "a fishing vest over a suit"). The look keeps the body and drops the clothes.
const stage =
  "Female. Tall and broad-shouldered, with short silver hair and grey eyes. She wears a cream cable-knit sweater and a fishing vest. A scar runs along her left jaw.";
const look = slurpImageLook(stage);
assert.match(look, /silver hair/u);
assert.match(look, /scar runs along her left jaw/u);
assert.doesNotMatch(look, /sweater|fishing vest/u);
// A long look keeps its last trait; the old 600-character cap cut it off.
const long = `${"Freckles across the nose and cheeks. ".repeat(30)}A tattoo of a koi on the left forearm.`;
assert.match(slurpImageLook(long), /koi on the left forearm/u);
// A hairstyle "worn" or "wears" is not clothing; the hoodie still goes.
assert.match(slurpImageLook("Long black hair worn in a high ponytail, green eyes."), /hair worn in a high ponytail/u);
const hairstyle = slurpImageLook(
  "She wears her hair in a ponytail and likes hoodies. Blonde pigtails and a denim jacket.",
);
assert.match(hairstyle, /wears her hair in a ponytail/u);
assert.match(hairstyle, /Blonde pigtails/u);
assert.doesNotMatch(hairstyle, /hoodies|jacket/u);

const images = slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/features/media/slp-images-service.ts");
// The filter runs for every source, not only when there is no Stage appearance.
assert.doesNotMatch(images, /if \(!stageAppearance\) characterDescription = slurpImageLook/u);
assert.match(images, /\n\s*characterDescription = slurpImageLook\(characterDescription\);/u);
// The final look comes from the filtered text, not the Stage text as written.
assert.doesNotMatch(images, /redactIdentity\(stageAppearance \|\| /u);
// A companion's Stage look is filtered too.
assert.match(images, /slurpImageLook\(account\.settings\.stage\?\.appearance\?\.trim\(\) \|\| appearance\)/u);
// The art style is still read from the Stage text as written ("drawn in anime style" has no body word).
assert.match(images, /const styleSource = `\$\{stageAppearance \|\| characterDescription\}/u);

// The stage draft asks for the body only; clothes belong in the wardrobe.
const messages = buildSlpSceneTurnMessages({
  request: {
    preset: "support",
    moment: "look",
    action: { kind: "continue" },
    transcript: [],
    draft: {},
    locked: [],
    direction: "",
    disclosureMode: "open",
  },
  newcomerCanon: "",
  allowedTags: [],
} as Parameters<typeof buildSlpSceneTurnMessages>[0]);
const prompt = JSON.stringify(messages);
assert.doesNotMatch(prompt, /style details/u);
assert.match(prompt, /appearance \(their look: body, face, hair and marks[^)]*no clothes/u);

// A hairstyle clause that also names the garment keeps its hairstyle, with or without a lead-in.
for (const card of [
  "Long black hair worn in a high ponytail under a black hoodie. Green eyes.",
  "Long black hair worn in a high ponytail with a black hoodie. Green eyes.",
]) {
  assert.match(slurpImageLook(card), /hair worn in a high ponytail/u);
  assert.doesNotMatch(slurpImageLook(card), /hoodie/u);
}

// A wear verb that carries a garment is not the hair's own verb, so that phrase is still dropped.
assert.doesNotMatch(slurpImageLook("Tall, with hair wearing a cap with a sweater. Green eyes."), /cap|sweater/u);

for (const card of ["Black hair worn long. Green eyes.", "Hair worn to one side. Green eyes."]) {
  assert.match(slurpImageLook(card), /hair worn/iu);
}

// A regenerate with no text connection must fail (the route answers 422), not return the old card text as a refresh.
assert.match(
  slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/features/media/slp-appearance-service.ts"),
  /if \(fallback && !input\.regenerate\) return fallback;/u,
);

console.log("slurp2 appearance clothes regression checks passed");
