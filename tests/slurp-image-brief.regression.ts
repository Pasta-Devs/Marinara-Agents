import assert from "node:assert/strict";
import {
  slurpImageBrief,
  slurpImageNegativePrompt,
  slurpShootContinuity,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-image-brief.ts";
import { slurpCameraSourcePhoto } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-camera-source.ts";
import { slurpPostVariation } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-post-variation.ts";
import {
  selectSlpImageProviderPrompt,
  slurpImageLook,
} from "../packages/slurp2/src/engine/packages/server/src/slp/base/media/slp-image-prompt.ts";
import { slurp2Source } from "./slurp2-source";

const variation = slurpPostVariation("creator-a", 2);
const scene = {
  wardrobeId: null,
  setting: "a park bench at night under an orange street lamp",
  action: "sitting with her knees pulled up",
  expression: "calm, looking past the lamp",
  visualDirection: "grainy warm light, tight crop",
  outfit: "pastel sweater slipping off one shoulder",
};
const brief = slurpImageBrief({
  cameraPhoto: slurpCameraSourcePhoto("screenshot"),
  variation,
  sexualLevel: "suggestive",
  scene,
});

// The scene the post model planned is the picture: every field reaches the draft, in order.
for (const value of Object.values(scene).filter(Boolean)) assert.ok(brief.includes(value as string), value as string);
assert.ok(brief.indexOf(scene.action) < brief.indexOf(scene.setting), "action leads the draft");
// A draft is for an image model: short, positive, and free of rule prose that becomes content.
assert.ok(brief.length < 700, `draft too long: ${brief.length}`);
assert.doesNotMatch(brief, /Describe the photograph|Never |no first-person|One photograph this person/u);
assert.match(brief, /still frame from a video/u);

// The level is a positive phrase; what it forbids goes to the negative prompt.
assert.match(slurpImageNegativePrompt("suggestive"), /nipples/u);
assert.match(slurpImageNegativePrompt("explicit"), /second person/u);
assert.doesNotMatch(slurpImageNegativePrompt("explicit"), /nudity/u);

// A callback keeps the shoot's place and clothes and never nests an earlier draft.
const continuity = slurpShootContinuity({ scene, outfit: scene.outfit });
assert.ok(continuity?.includes(scene.setting) && continuity.includes(scene.outfit));
const callback = slurpImageBrief({
  cameraPhoto: slurpCameraSourcePhoto("tripod"),
  variation,
  sexualLevel: "none",
  scene: { ...scene, setting: "a different place", outfit: "a different outfit" },
  shoot: { place: "bench", company: "alone", brief: continuity! },
});
assert.ok(callback.includes(scene.setting) && !callback.includes("a different place"));
assert.ok(!callback.includes("a different outfit"));
const legacy = slurpImageBrief({
  cameraPhoto: slurpCameraSourcePhoto("tripod"),
  variation,
  sexualLevel: "none",
  shoot: { place: "the kitchen", company: "alone", brief: "One photograph this person took and posted.\nRules" },
});
assert.doesNotMatch(legacy, /One photograph/u, "a legacy prose brief must not be nested");

// Card appearance loses its clothes and costumes; body and face stay.
const look = slurpImageLook(
  "Mara is petite with blonde hair. She favors pastel dresses. For cosplay, she wears a corset and carries a sword. Her face is round and cute.",
);
assert.match(look, /blonde hair/u);
assert.match(look, /petite/u);
assert.match(look, /Her face is/u);
assert.doesNotMatch(look, /sword|corset|pastel dresses/u);

// A failed rewrite falls back to the rendered template, not a card paragraph that pushes the scene out.
const raw = `${brief}\n\n${look}`;
assert.equal(selectSlpImageProviderPrompt({ rewrittenPrompt: null, rawPrompt: raw, rewriteAttempted: true }), raw);

// The rewrite runs on Slurp's own generation connection, with reasoning headroom.
const rewrite = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/slp/base/media/slp-image-prompt-rewrite.ts",
);
assert.match(rewrite, /resolveSlurpTextConnection\(connections, input\.connectionId\)/u);
assert.doesNotMatch(rewrite, /maxTokens: 2_048/u);

// A card without an Appearance field must not send its whole description to the image model.
const publicImages = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/slp/features/media/slp-public-images-service.ts",
);
assert.doesNotMatch(publicImages, /normalizeIllustratorAppearance\(data\.description\)/u);
// The "auto" style text is an instruction for a prompt writer, not words for the image model; a
// chosen Slurp style replaces the connection's prompt prefixes; the look leads the prompt.
const images = slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/features/media/slp-images-service.ts");
assert.match(
  images,
  /baseStyle === "auto"\s*\?\s*compileImagePrompt\(\{ \.\.\.input, omitProfileStyleText: true \}\)/u,
);
assert.match(images, /promptPrefix: "", negativePromptPrefix: ""/u);
assert.match(images, /draftPrompt: \[stripAppearanceLabel\(characterDescription\), input\.draftPrompt\]/u);
assert.match(images, /creatorStyleProfileId \?\? input\.settings\.imageStyleProfileId/u);
assert.match(
  slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/base/media/slp-image-connections.ts"),
  /creatorStyleProfileIds\[creatorId\] \?\? null/u,
);
// A model imagePrompt requested through post direction is honoured over the assembled draft.
const briefs = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/slp/features/feed/slp-post-picture-briefs.ts",
);
assert.match(briefs, /normalizeSlpImagePrompt\(input\.modelImagePrompt\) \?\?/u);

console.log("slurp image brief regression checks passed");
