import assert from "node:assert/strict";
import { slurp2Source } from "./slurp2-source";
import { normalizeSlpAccountSettings } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/records/slp-storage-model";
import { slurpStageFacts } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/creators/slp-stage-profile-repair";
import { slurpImageBrief } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-image-brief";
import { slurpCameraSourcePhoto } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-camera-source";
import { slurpPostVariation } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-post-variation";

// A Creator owns her own look. Borrowed from the linked card it needed three things to be true at
// once — linked, card has an Appearance, "include descriptions" on — and when any was false the
// image model was handed a scene with nobody in it and invented a different somebody every post.

const settings = normalizeSlpAccountSettings({
  stage: { appearance: "  tall, freckles  ", wardrobe: "oversized shirts", locations: "her flat" },
});
assert.deepEqual(settings.stage, {
  appearance: "tall, freckles",
  wardrobe: "oversized shirts",
  locations: "her flat",
});
// Nothing stored means no group at all, so an untouched Creator does not grow empty strings.
assert.equal(normalizeSlpAccountSettings({}).stage, undefined);
assert.equal(normalizeSlpAccountSettings({ stage: { appearance: "   " } }).stage, undefined);

// The source card seeds an empty appearance on create. Asking the user to retype a face that is
// already written down is exactly how this field stayed empty.
assert.equal(slurpStageFacts({ appearance: "" }, "red hair, short")?.appearance, "red hair, short");
assert.equal(slurpStageFacts({ appearance: "her own" }, "red hair, short")?.appearance, "her own");
assert.equal(slurpStageFacts({}), undefined, "a profile with no facts stores no facts");

// Her clothes reach the picture brief when the scene names none.
const variation = slurpPostVariation("creator-a", 2);
const brief = slurpImageBrief({
  cameraPhoto: slurpCameraSourcePhoto("selfie"),
  variation,
  sexualLevel: "none",
  stageFacts: { wardrobe: "oversized shirts", locations: "her flat" },
});
assert.match(brief, /Wearing oversized shirts/u);
// A continuing shoot already fixed the clothes, so the wardrobe must not argue with it.
assert.doesNotMatch(
  slurpImageBrief({
    cameraPhoto: slurpCameraSourcePhoto("selfie"),
    variation,
    sexualLevel: "none",
    stageFacts: { wardrobe: "oversized shirts" },
    shoot: { place: "a hotel", company: "alone and glad of it", brief: "black dress, window light" },
  }),
  /oversized shirts/u,
);

// The Creator's own appearance is applied whatever the description toggle says: that toggle
// governs extra source context, not whether the picture knows who it is of.
for (const path of [
  "packages/slurp2/src/engine/packages/server/src/slp/features/media/slp-images-service.ts",
  "packages/slurp2/src/engine/packages/server/src/slp/features/media/slp-public-images-service.ts",
]) {
  const source = slurp2Source(path);
  assert.match(source, /let characterDescription = stageAppearance;/u, `${path} must start from her own appearance`);
  assert.doesNotMatch(
    source,
    /sourceAppearance &&\s*\n?\s*input\.settings\.imageGenerationIncludeDescriptions/u,
    `${path} must not gate linked appearance on the description setting`,
  );
}

const publicImages = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/slp/features/media/slp-public-images-service.ts",
);
assert.match(
  publicImages,
  /if \(!stageAppearance\) characterDescription = characterAppearanceFromRow\(character\);/u,
  "public image prompts must keep a linked character's appearance when the stage field is empty",
);

// Both the caption and the picture get the facts.
const prompt = slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/features/feed/slp-post-prompt.ts");
for (const line of ["Appearance:", "Usual wardrobe:", "Where her life happens:"]) {
  assert.ok(prompt.includes(line), `the post prompt must carry "${line}"`);
}

// And they are editable, or they are not facts, they are a schema.
// The logical key, so the fields are found wherever the form has been split to.
const form = slurp2Source("packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpStageProfileForm.tsx");
for (const field of ["appearance", "wardrobe", "locations"]) {
  assert.match(
    form,
    new RegExp(`onChange\\(\\{ ${field}: event\\.target\\.value \\}\\)`, "u"),
    `${field} must be editable`,
  );
}

console.log("slurp2-creator-stage-facts regression passed");
