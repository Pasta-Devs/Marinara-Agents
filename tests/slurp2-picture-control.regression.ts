import assert from "node:assert/strict";
import { slurp2Source } from "./slurp2-source";
import { slurpLeastRecentGalleryImage } from "../packages/slurp2/src/engine/packages/server/src/slp/base/media/slp-generated-media-policy.ts";

// --- gallery fallback rotates instead of always showing the first picture -----------------------
const gallery = [{ id: "a" }, { id: "b" }, { id: "c" }];
assert.equal(slurpLeastRecentGalleryImage(gallery, [])?.id, "a", "nothing used yet: the first picture");
assert.equal(slurpLeastRecentGalleryImage(gallery, ["a", undefined])?.id, "b", "a used picture is skipped");
assert.equal(slurpLeastRecentGalleryImage(gallery, ["b", "a", "c"])?.id, "c", "all used: the oldest use wins");
assert.equal(slurpLeastRecentGalleryImage(gallery, ["c", "a", "a", "b"])?.id, "b");
assert.equal(slurpLeastRecentGalleryImage([], ["a"]), null);

const read = (path: string) => slurp2Source(`packages/slurp2/src/engine/packages/${path}`);

// --- background avatars and banners have a switch (#82) ------------------------------------------
const artwork = read("server/src/slp/features/creators/slp-artwork-operation.ts");
const settings = read("server/src/slp/modules/settings/slp-settings.ts");
const wizard = read("client/src/slp/features/onboarding/slp-onboarding-wizard-model.ts");
// The gate sits after the Open branch: copying a card's pictures costs nothing and keeps working.
const openBranch = artwork.indexOf('if (disclosureMode === "open")');
const gate = artwork.indexOf('if (!settings.autoCreatorArtworkEnabled) return "idle" as const;');
assert.ok(openBranch > 0 && gate > openBranch, "only generation waits for the switch");
assert.ok(
  gate < artwork.indexOf("await generateCreatorPostImage(", openBranch),
  "the switch is checked before any picture is drawn",
);
assert.match(settings, /autoCreatorArtworkEnabled: z\.boolean\(\)/u);
assert.match(settings, /autoCreatorArtworkEnabled: false,/u, "a new install starts with it off");
assert.match(
  settings,
  /candidate\.autoCreatorArtworkEnabled = rawRecord\.autoCreatorArtworkEnabled \?\? Object\.keys\(rawRecord\)\.length > 0;/u,
  "settings saved before the switch keep their artwork",
);
// Only first-run setup writes it; Add Creators and a re-run leave the player's choice alone.
assert.match(
  wizard,
  /settingsQuery\.data\?\.onboarding === "completed" \? \{\} : \{ autoCreatorArtworkEnabled: imagesEnabled \}/u,
);

// --- Slurp asks for its own picture descriptions (#63) -------------------------------------------
const captioning = read("server/src/slp/base/media/slp-post-image-context.ts");
assert.match(
  captioning,
  /const instructions = prompt\.trim\(\) \|\| SLURP_IMAGE_CAPTION_PROMPT;/u,
  "blank uses the default",
);
// The vendored Engine hardcodes its system message, so the swap happens on the provider call itself.
assert.match(captioning, /message\.role === "system" \? \{ \.\.\.message, content: instructions \} : message/u);
assert.match(captioning, /Do not describe the art style/u, "the default leaves the drawing style out");
for (const path of [
  "server/src/slp/features/audience/slp-fan-activity-service.ts",
  "server/src/slp/features/messages/slp-message-image-context.ts",
  "server/src/slp/features/messages/slp-reply-generation-service.ts",
]) {
  assert.match(read(path), /settings\.imageCaptionPrompt/u, `${path} passes the caption instructions`);
}

// --- the player's own words open a Creator's picture prompt (#16) -------------------------------
const images = read("server/src/slp/features/media/slp-images-service.ts");
assert.match(images, /input\.settings\.creatorImagePrefixes\?\.\[input\.account\.id\]/u);
// A commission shows the player, a banner shows no one: the prefix stays out like the name does.
assert.match(
  images,
  /const ownWords =\s*!input\.suppressCreatorDetails &&\s*!input\.suppressCharacterContext &&\s*input\.disclosureMode === "open";/u,
);
assert.match(images, /\(ownWords && input\.settings\.creatorImagePrefixes/u);
// The prefix wins over the card name; the writer's copy of it moves to the front (0.3.47).
assert.match(images, /slurpWithoutImageSubject\(writtenBody, imagePrefix \|\| subjectName, promptFamily\)/u);
assert.match(images, /slurpApplyImageSubject\(finalPromptLook, subject, promptFamily\)/u);

// --- outfits are not rags unless the card says so (#41) ------------------------------------------
assert.match(read("server/src/slp/features/feed/slp-post-prompt.ts"), /never worn-out, faded or shabby/u);

// One batch can post twice for the same Creator before either post is saved.
const activity = read("server/src/slp/features/feed/slp-generated-activity-service.ts");
assert.match(activity, /\.\.\.\(input\.batchUsed \?\? \[\]\)/u);
assert.match(activity, /galleryUsed\.unshift\(attachment\.metadata\.galleryAttachmentId\)/u);

// The reserve can prepare two slots for one Creator before either is published.
const reserve = read("server/src/slp/features/feed/reserve/slp-reserve-operation.ts");
assert.match(
  reserve,
  /batchUsed: active\s*\.filter\(\(item\) => item\.creatorAccountId === selectedAccount\.id && item\.state === "prepared"\)/u,
);

console.log("slurp2-picture-control: ok");
