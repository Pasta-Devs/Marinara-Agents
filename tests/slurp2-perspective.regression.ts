/**
 * P + Q (2026-09-28): viewpoint words per image-model family, the device filter, one copy of each
 * appearance trait, the "Enhance image prompts" budget row, and the two ad picture formats.
 * PERSPECTIVE-RESEARCH.md holds the research behind the phrase tables.
 */
import assert from "node:assert/strict";
import {
  SLURP_CAMERA_SOURCES,
  slurpCameraSourceNegative,
  slurpCameraSourcePhoto,
  slurpCameraSourceShot,
  slurpViewpointForFamily,
  slurpViewpointIn,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-camera-source.ts";
import {
  ensureSlpImageAppearance,
  slurpPictureSubject,
  slurpPromptFamily,
  slurpWithoutCameraDevice,
  type SlurpPromptFamily,
} from "../packages/slurp2/src/engine/packages/server/src/slp/base/media/slp-image-prompt.ts";
import { slurpImageNegativePrompt } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-image-brief.ts";
import {
  readSlurpModelBudgetLedger,
  slurpModelBudgetSchema,
  spendSlurpModelBudget,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-model-budget.ts";
import { GARNISH_AD_IMAGE_FORMATS } from "../packages/slurp2/src/engine/packages/server/src/services/garnish-ads/garnish-ads.types.ts";
import { slurp2Source } from "./slurp2-source";

const FAMILIES: readonly SlurpPromptFamily[] = ["tags", "e621", "natural"];
const DEVICE = /\b(?:phone|smartphone|iphone|camera|photographer|tripod|webcam|lens|shot on|taken with|self-timer)\b/iu;
const seeds = Array.from({ length: 40 }, (_, index) => `scene-${index}`);

// 1. No phrase names the device, except the mirror, where the phone is really in the picture.
for (const source of SLURP_CAMERA_SOURCES) {
  for (const family of FAMILIES) {
    for (const seed of seeds) {
      const shot = slurpCameraSourceShot(source, seed, family);
      if (source === "mirror") assert.match(shot, /holding phone|phone in hand/u, `mirror ${family} keeps the phone`);
      else assert.doesNotMatch(shot, DEVICE, `${source}/${family} names a device: ${shot}`);
      assert.doesNotMatch(shot, /\b(?:no|never|not|pov)\b/iu, `${source}/${family} must be positive: ${shot}`);
      if (family === "natural") assert.doesNotMatch(shot, /cowboy shot/u, "plain English cowboy shot draws a hat");
      else assert.doesNotMatch(shot, /\.\s/u, `${source}/${family} tags must not be sentences`);
    }
  }
}

// 2. A selfie shows the arm, the cue models learned without the phone, in every family.
for (const family of FAMILIES) {
  const photo = slurpCameraSourcePhoto("selfie", family);
  assert.match(photo, /\bselfie\b/u);
  assert.match(photo, /arm/u, `${family} selfie has no arm cue`);
}
assert.match(slurpCameraSourcePhoto("selfie", "e621"), /raised arm/u, "e621 spells the arm its own way");

// 3. Negatives: the selfie fights the phone, the mirror fights the doubled Creator instead.
assert.match(slurpCameraSourceNegative("selfie"), /holding phone/u);
assert.doesNotMatch(slurpCameraSourceNegative("mirror"), /phone/u);
assert.match(slurpCameraSourceNegative("mirror"), /multiple girls/u);
assert.doesNotMatch(slurpImageNegativePrompt("suggestive", false, "mirror"), /holding phone|smartphone/u);
assert.match(slurpImageNegativePrompt("suggestive", false, "mirror"), /duplicate person, .*multiple girls/u);
assert.match(slurpImageNegativePrompt("none", false, "tripod"), /tripod/u);
assert.equal(
  slurpImageNegativePrompt(),
  "second person, extra people, duplicate person, twins, extra limbs, disembodied hands, smartphone, holding phone, selfie stick, text, watermark",
  "a picture without a camera keeps the old terms, in the old order",
);

// 4. The device filter cuts only the device; the selfie and arm cues stay.
assert.equal(
  slurpWithoutCameraDevice("selfie, outstretched arm, close-up, holding her phone"),
  "selfie, outstretched arm, close-up.",
);
assert.equal(
  slurpWithoutCameraDevice("half undressed, teasing the camera, static shot from a tripod near the door, pink glow"),
  "half undressed, teasing the viewer, pink glow",
  "a gaze at the camera is a gaze at the viewer; the tripod goes",
);
assert.equal(slurpWithoutCameraDevice("a camera-shy smile, headphones on"), "a camera-shy smile, headphones on");
const mirror = slurpCameraSourceShot("mirror", "bathroom");
assert.ok(
  slurpWithoutCameraDevice(`Brushing hair.\n${mirror}.\nphone raised high.`, [mirror]).includes(mirror),
  "Slurp's own mirror phrase survives the filter",
);
assert.doesNotMatch(slurpWithoutCameraDevice(`${mirror}.`), /phone in hand/u, "without keep it is cut, as before");
// Post history says what was shown, not how: no selfie cues there.
assert.equal(
  slurpPictureSubject("on the balcony, selfie, arm extended toward the viewer, sunset"),
  "on the balcony, sunset",
);

// 5. The family comes from the style profile, then the service and model name.
assert.equal(slurpPromptFamily({ promptMode: "danbooru" }), "tags");
assert.equal(slurpPromptFamily({ promptMode: "tagged", furry: true }), "e621");
assert.equal(slurpPromptFamily({ promptMode: "natural", model: "ponyDiffusionV6XL" }), "natural", "the profile wins");
assert.equal(slurpPromptFamily({ promptMode: "hybrid", model: "ponyDiffusionV6XL" }), "tags");
assert.equal(slurpPromptFamily({ promptMode: "hybrid", model: "flux1-dev" }), "natural");
assert.equal(slurpPromptFamily({ promptMode: "hybrid", service: "novelai", model: "nai-diffusion-4" }), "tags");
assert.equal(slurpPromptFamily({}), "natural", "unknown models get plain words");

// 6. The brief carries the natural phrase; the image side swaps it for the model's own words.
for (const source of SLURP_CAMERA_SOURCES) {
  for (const seed of seeds) {
    const natural = slurpCameraSourceShot(source, seed);
    const prompt = `Laughing on the sofa.\n${natural}.\nThe only person in the photo.`;
    assert.equal(slurpViewpointIn(prompt)?.source, source, `${source} phrase not found back`);
    assert.equal(slurpViewpointIn(prompt)?.phrase, natural);
    assert.equal(slurpViewpointForFamily(prompt, "natural"), prompt);
    for (const family of ["tags", "e621"] as const) {
      const swapped = slurpViewpointForFamily(prompt, family);
      assert.ok(swapped.includes(slurpCameraSourceShot(source, seed, family)), `${source}/${family} not swapped`);
      assert.ok(!swapped.includes(natural), `${source}/${family} kept the natural phrase`);
    }
  }
}
assert.equal(
  slurpViewpointForFamily("A prompt without Slurp's viewpoint.", "tags"),
  "A prompt without Slurp's viewpoint.",
);

// 7. Each appearance trait once, on the prod prompt shapes of 2026-09-28 (88 of 102 had it twice).
// Invented Creators; the structure is the prod one.
const look =
  "Short curly auburn hair, tan skin, hazel eyes framed by long lashes. He's on the stockier side with broad shoulders he's grown proud of. Stands about 182 cm. Dresses in flannel and thinks his roommate's neon phase is funny. Freckled nose and a square jaw.";
const style = "digital painting, concept art, refined brushwork, high detail, designed lighting";
const count = (text: string, word: string) => text.split(word).length - 1;
// (a) Accepted rewrite that reworded the look and dropped one trait: only that trait is added.
const reworded = `${style}, short curly auburn hair, tan skin, hazel eyes framed by long lashes, on the stockier side with broad shoulders, freckled nose and a square jaw, wearing a grey sweater, leaning on a hallway wall, harsh afternoon light`;
const a = ensureSlpImageAppearance(reworded, look);
assert.equal(a, `Stands about 182 cm.\n${reworded}`);
// (b) Rewrite that kept the look word for word: nothing is added.
const verbatim = `${style}, 24-year-old woman, athletic and curvy, with long dyed-blue hair in a high ponytail, grey eyes, and a round face, wearing an oversized hoodie, standing in her kitchen`;
assert.equal(
  ensureSlpImageAppearance(
    verbatim,
    "24-year-old woman, athletic and curvy, with long dyed-blue hair in a high ponytail, grey eyes, and a round face.",
  ),
  verbatim,
);
// (c) Fallback: the template holds the whole Stage text with its clothes sentence, which the
// clothes-free look never matched verbatim, so the look went in front a second time.
const fallback = `${style}\n${look}\nSitting on the floor of a sunny kitchen.`;
assert.equal(ensureSlpImageAppearance(fallback, look), fallback);
for (const result of [a, ensureSlpImageAppearance(fallback, look)]) {
  for (const trait of ["auburn", "hazel", "stockier", "182", "square jaw"])
    assert.equal(count(result, trait), 1, trait);
}
// (d) A prompt with no appearance at all still gets the whole look.
assert.equal(
  ensureSlpImageAppearance("Walking a dog in the park.", look),
  `${look.replace(" Dresses in flannel and thinks his roommate's neon phase is funny.", "")}\nWalking a dog in the park.`,
);

// 8. The image service wires it: the viewpoint is kept, swapped per family, and the prompt model is
// the player's choice with the text connection as the default.
const images = slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/features/media/slp-images-service.ts");
assert.match(images, /slurpWithoutCameraDevice\(finalPromptBase, keep\)/u);
assert.match(images, /slurpViewpointForFamily\(finalPromptScene, promptFamily\)/u);
assert.match(images, /promptMode: compiledPrompt\.profile\.promptMode/u);
assert.match(
  images,
  /connectionId: input\.settings\.imagePromptConnectionId \|\| input\.settings\.generationConnectionId/u,
);
assert.match(images, /viewpoint: viewpoint\?\.phrase/u);
const rewrite = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/slp/base/media/slp-image-prompt-rewrite.ts",
);
assert.match(rewrite, /Keep this viewpoint phrase word for word, once/u);
assert.match(rewrite, /"Never"\} name a camera, phone, lens, tripod, timer, or photographer/u);
assert.match(rewrite, /claimSlurpModelBudget\(input\.db, input\.budget, "image_prompt"\)/u);

// 9. "Image prompt enhancing" is a budget row of its own: it counts and caps itself only.
const budget = slurpModelBudgetSchema.parse({ callsPerHour: 1, callsPerDay: 1 });
assert.equal(budget.jobs.image_prompt.maxPerDay, 60);
let ledger = readSlurpModelBudgetLedger(null);
for (let index = 0; index < 60; index += 1) {
  const next = spendSlurpModelBudget(budget, ledger, "image_prompt");
  assert.ok(next, `picture ${index + 1} refused under its own limit`);
  ledger = next;
}
assert.equal(spendSlurpModelBudget(budget, ledger, "image_prompt"), null, "the 61st is over the limit");
assert.equal(ledger.callsToday, 0, "pictures never take the replies' share");
assert.ok(spendSlurpModelBudget(budget, ledger, "dm_reply"), "a reply still goes out");
assert.equal(
  spendSlurpModelBudget(
    { ...budget, jobs: { ...budget.jobs, image_prompt: { ...budget.jobs.image_prompt, enabled: false } } },
    readSlurpModelBudgetLedger(null),
    "image_prompt",
  ),
  null,
  "switched off in the budget, no rewrite",
);
// V: the budget mode "Off" stops it too (it keeps its own limit, but it is still Slurp's AI).
assert.equal(
  spendSlurpModelBudget({ ...budget, mode: "off" }, readSlurpModelBudgetLedger(null), "image_prompt"),
  null,
  "AI budget Off, no rewrite",
);
assert.ok(
  spendSlurpModelBudget({ ...budget, mode: "background" }, readSlurpModelBudgetLedger(null), "image_prompt"),
  "Background still enhances",
);

// 10. Ads: a 4:5 feed picture like a post and a 1.91:1 banner, both drawn for their frame.
const [feed, wide] = GARNISH_AD_IMAGE_FORMATS;
assert.equal(feed.field, "imageUrl");
assert.equal(feed.width / feed.height, 4 / 5);
assert.equal(wide.field, "wideImageUrl");
assert.ok(Math.abs(wide.width / wide.height - 1.91) < 0.02, "the banner is the social-ad ratio");
for (const format of GARNISH_AD_IMAGE_FORMATS) {
  assert.equal(format.width % 64, 0);
  assert.equal(format.height % 64, 0);
}
assert.match(wide.framing, /left or right third/u, "the banner places the subject for a wide frame");
const card = slurp2Source("packages/slurp2/src/engine/packages/client/src/slp/features/ads/SlpInlineAd.tsx");
assert.match(
  card,
  /\(wide && promotion\.wideImageUrl\) \|\| promotion\.imageUrl/u,
  "old ads fall back to the feed picture",
);
assert.match(card, /aspectRatio: "1\.91 \/ 1"/u);
assert.match(card, /slp-crop-top h-full w-full object-cover/u, "the fallback crops from the top centre");
const service = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/slp/features/ads/slp-garnish-image-service.ts",
);
assert.match(service, /for \(const format of GARNISH_AD_IMAGE_FORMATS\)/u);
assert.match(
  service,
  /if \(format\.field === "imageUrl"\) throw error;/u,
  "a failed banner never costs the ad its picture",
);

console.log("slurp2-perspective regression: ok");
