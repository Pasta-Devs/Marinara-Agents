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

console.log("slurp2 appearance clothes regression checks passed");
