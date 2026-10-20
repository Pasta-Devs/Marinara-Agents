import assert from "node:assert/strict";
import {
  slurpImageBrief,
  slurpImageNegativePrompt,
  slurpImageNegativeWithCompany,
  slurpShootContinuity,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-image-brief.ts";
import { slurpWithoutCameraDevice } from "../packages/slurp2/src/engine/packages/server/src/slp/base/media/slp-image-prompt.ts";
import { slurpCameraSourcePhoto } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-camera-source.ts";
import { slurpPostVariation } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-post-variation.ts";
import {
  selectSlpImageProviderPrompt,
  slurpImageLook,
} from "../packages/slurp2/src/engine/packages/server/src/slp/base/media/slp-image-prompt.ts";
import { slurpVisualBriefPromptViolatesPolicy } from "../packages/slurp2/src/engine/packages/server/src/slp/base/media/slp-visual-brief.ts";
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
// P (2026-09-28): the screenshot phrase is now "caught mid-motion …" ("still frame from a video" drew
// REC and player overlays, PERSPECTIVE-RESEARCH.md F7). What holds is that the camera phrase is in the draft.
assert.ok(brief.includes(slurpCameraSourcePhoto("screenshot")), "the camera phrase reaches the draft");

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

// A fallback that overflows the cap keeps the scene: a long look must not push it out.
const longLook = "Appearance: tall, silver hair, freckles. ".repeat(60);
const sceneText = "She sits on a park bench at night under an orange street lamp.";
const capped = selectSlpImageProviderPrompt({
  rewrittenPrompt: null,
  rawPrompt: sceneText,
  fallbackPrefix: longLook,
  rewriteAttempted: true,
});
assert.match(capped, /park bench at night/u);
// The Creator path: the scene survives an over-cap template that leads with a long look.
const creator = selectSlpImageProviderPrompt({
  rewrittenPrompt: null,
  rawPrompt: `${longLook}\n${sceneText}`,
  fallbackPrefix: longLook,
  fallbackScene: sceneText,
  rewriteAttempted: true,
});
assert.match(creator, /park bench at night/u);
assert.ok(creator.length <= 1_500);
// A short brief after a long look in the prefix keeps its level line.
const briefAfterLook = selectSlpImageProviderPrompt({
  rewrittenPrompt: null,
  rawPrompt: sceneText,
  fallbackPrefix: `${longLook.slice(0, 500)}\nSexual level: none.`,
  rewriteAttempted: true,
});
assert.match(briefAfterLook, /Sexual level: none/u);
assert.ok(capped.length <= 1_500);

// A word the rewrite was handed (card look, content policy) is carried over, not an escalation.
const clothed = { sexualLevel: "none" } as Parameters<typeof slurpVisualBriefPromptViolatesPolicy>[0];
const rewritten = "A woman with large breasts on a park bench, explicit content allowed by policy.";
assert.equal(slurpVisualBriefPromptViolatesPolicy(clothed, rewritten), true);
assert.equal(
  slurpVisualBriefPromptViolatesPolicy(
    clothed,
    rewritten,
    "Appearance: large breasts. Policy: explicit content allowed.",
  ),
  false,
);
assert.equal(slurpVisualBriefPromptViolatesPolicy(clothed, "She is naked on a bench", "large breasts"), true);
assert.equal(slurpVisualBriefPromptViolatesPolicy(clothed, "A nude portrait", "She wants not a nude portrait"), true);
// Limits are not permissions: "not nude" in the handed text does not allow "nude" in the rewrite.
assert.equal(
  slurpVisualBriefPromptViolatesPolicy(clothed, "A sexual pose, nude", "Keep it non-sexual, not nude"),
  true,
);

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

// The picture never shows the device (0.2.75: a phone was in 37 of 46 prod pictures). Only the
// parts that name it go; the rest of the scene stays word for word.
assert.equal(
  slurpWithoutCameraDevice(
    "sitting sideways at desk, phone held at arm's length, headphones on.\nHolding her phone up toward the mirror for a selfie.\nwarm light, smartphone in hand; cozy room.",
  ),
  "sitting sideways at desk, headphones on.\nwarm light, cozy room.",
);
assert.equal(
  slurpWithoutCameraDevice("a microphone on a stand, iPhone case on the table."),
  "a microphone on a stand.",
);
// P: the call also passes Slurp's own viewpoint phrase, which the filter keeps whole (mirror phone).
assert.match(briefs, /slurpWithoutCameraDevice\(rawImageDraft, \[cameraShot\]\)/u, "the post draft drops the device");
assert.match(
  slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/features/media/slp-public-images-service.ts"),
  /slurpWithoutCameraDevice\(finalPromptBase\)/u,
  "the rewritten prompt drops the device too",
);
assert.match(slurpImageNegativePrompt("none"), /smartphone/u, "the negative prompt names the phone");
assert.match(slurpImageNegativePrompt("explicit"), /duplicate person/u, "and a doubled Creator");

// ── A post about somebody else (0.3.7): they may be in it, nobody is forced in ───────────────
// A couple or collab post used to say "The only person in the photo." and ban a second person, so the
// partner the post was about could never appear.
const withKai = slurpImageBrief({
  cameraPhoto: slurpCameraSourcePhoto("tripod"),
  variation,
  sexualLevel: "none",
  company: "Kai",
});
assert.match(withKai, /Kai may be in the photo too, if the moment calls for it\./u);
assert.doesNotMatch(withKai, /The only person in the photo/u);
assert.match(
  slurpImageBrief({ cameraPhoto: slurpCameraSourcePhoto("tripod"), variation, sexualLevel: "none" }),
  /The only person in the photo/u,
  "alone stays alone",
);
assert.doesNotMatch(slurpImageNegativePrompt("none", true) ?? "", /second person|extra people/u);
// The writer gets their looks with the choice; a reference picture only for somebody the final prompt names.
assert.match(images, /Put one in the picture only when the post or the scene calls for them/u);
assert.match(images, /slurpCompanionReferenceImages\([^)]*finalPrompt,/u);
assert.match(
  slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/features/media/slp-image-companions.ts"),
  /promptText: prompt,/u,
);
// Two people only when the writer named a companion; left out, the one-person rule stands.
assert.match(
  images,
  /slurpImageNegativePrompt\(input\.visualBrief\?\.sexualLevel, companionNamed, viewpoint\?\.source\)/u,
);
// The brief keeps the one-person rule; the service lifts it only when the final prompt names somebody.
assert.equal(slurpImageNegativeWithCompany("second person, extra people, duplicate person"), "duplicate person");
assert.match(
  images,
  /companionNamed && input\.negativePromptAdditions\s*\? slurpImageNegativeWithCompany\(input\.negativePromptAdditions\)/u,
);
assert.match(images, /look: includeAppearance/u, "descriptions off keeps the companions' looks out too");
// Nobody else joins a nude or explicit picture unless the spice consent gate chose them as the partner.
const pictureBriefs = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/slp/features/feed/slp-post-picture-briefs.ts",
);
assert.match(pictureBriefs, /const clothed = sexualLevel === "none" \|\| sexualLevel === "suggestive";/u);
assert.match(pictureBriefs, /const company = !input\.partner && clothed && input\.cast\?\.length/u);
assert.match(
  pictureBriefs,
  /const pictureCast = clothed \|\| \(Boolean\(input\.partner\) && input\.cast\?\.length === 1\);/u,
);
// The cast reaches the picture on the first draw and on every later one (reserve, review, retry).
const generation = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/slp/features/feed/slp-generation-service.ts",
);
assert.match(generation, /companionIds: pictureCast \? beat\?\.castIds : undefined,/u);
assert.match(generation, /pictureCast && beat\?\.castIds\?\.length \? \{ slurpPictureCast: beat\.castIds \}/u);
for (const path of ["feed/reserve/slp-reserve-operation.ts", "media/slp-reviewed-images-service.ts"]) {
  assert.match(
    slurp2Source(`packages/slurp2/src/engine/packages/server/src/slp/features/${path}`),
    /companionIds: \w+\.metadata\.slurpPictureCast,/u,
    path,
  );
}

console.log("slurp image brief regression checks passed");
