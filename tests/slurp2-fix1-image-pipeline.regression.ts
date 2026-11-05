// Phase 1 batch C: the image pipeline (REVIEW-1 §3, R1-048 … R1-062).
// Pure rules are called directly. Files that load Engine paths cannot run here, so their wiring is
// pinned by source text, like the other slurp2 regressions.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  slurpImageNegativePrompt,
  slurpImageNegativeTerms,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-image-brief.ts";
import { slurpPostAxes } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-content-axes.ts";
import {
  slurpUploadedMessageMediaPaths,
  slurpViewerPhotoPrompt,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-messaging.ts";
import { slurpArtworkGaps } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/creators/slp-artwork-gaps.ts";

const root = "packages/slurp2/src/engine/packages";
const read = (path: string) => readFileSync(`${root}/${path}`, "utf8");
const images = read("server/src/slp/features/media/slp-images-service.ts");
const reviewed = read("server/src/slp/features/media/slp-reviewed-images-service.ts");
const routes = read("server/src/slp/features/feed/slp-feed-post-routes.ts");
const postStorage = read("server/src/slp/data/feed/slp-feed-post-storage-2.ts");

// --- R1-048: no image connection is its own answer, and a busy connection has its own text ----------
assert.match(
  reviewed,
  /missingConnection > 0 && missingConnection === input\.prompts\.length\)[\s\S]{0,80}?error: "missing_connection"/u,
);
assert.match(routes, /if \(result\.busy > 0\) return reply\.code\(409\)/u);

// --- R1-049: a successful redraw unlinks the old picture (the unlink also takes teaser and widths) ---
assert.match(
  routes,
  /if \(previousMediaPath && previousMediaPath !== readCreatorMediaPath\(updated\)\)\s*unlinkCreatorMedia\(previousMediaPath\);/u,
);

// --- R1-050: every path strips the phone and gets the shared negatives, in the one shared run -------
assert.equal(
  slurpImageNegativeTerms("text, watermark", "smartphone, text", undefined, ""),
  "text, watermark, smartphone",
  "negative parts are merged once",
);
assert.equal(slurpImageNegativeTerms(undefined, ""), undefined);
assert.match(slurpImageNegativePrompt(), /smartphone, holding phone/u, "no level still names the phone");
assert.doesNotMatch(slurpImageNegativePrompt(), /nudity/u, "no level adds no level terms");
assert.match(slurpImageNegativePrompt("none"), /^nudity/u);
// P: the final filter also keeps Slurp's own viewpoint phrase (`keep`), see slurp2-perspective.
assert.match(images, /slurpWithoutCameraDevice\(finalPromptBase, keep\) \|\| finalPromptBase/u);
assert.match(
  images,
  // P: the camera source is passed too, so a mirror shot does not fight its own phone.
  /input\.negativePromptAdditions \?\?\s*slurpImageNegativePrompt\(input\.visualBrief\?\.sexualLevel(?:, (?:false|companionNamed), viewpoint\?\.source)?\)/u,
);

// --- R1-051: removing a set's picture removes the set --------------------------------------------
const update = postStorage.slice(postStorage.indexOf("async updateNoodlerPost"));
assert.match(
  update,
  /if \(input\.removeImage\) \{\s*delete nextMetadata\.postMedia;\s*await tx\.delete\(slpPostMedia\)/u,
);
assert.match(routes, /\[locked\.value\.staleMedia, \.\.\.locked\.value\.staleAttachments\]/u);

// --- R1-052: the Story size is chosen in the shared run, from every caller's flag -------------------
assert.match(
  images,
  /input\.width \?\? \(input\.story \? input\.settings\.storyImageWidth : input\.settings\.imageWidth\)/u,
);
assert.match(
  read("server/src/slp/features/feed/reserve/slp-reserve-operation.ts"),
  /story: payload\.metadata\.noodlerPostType === "story"/u,
);
assert.match(
  reviewed,
  /claimed\.metadata\.noodlerPostType === "story" \|\| claimed\.metadata\.noodlerStoryPending === true/u,
);

// --- R1-053: the reserve draws one picture, so it never picks a photo set -------------------------
let sets = 0;
for (let sequence = 0; sequence < 400; sequence += 1) {
  const decided = { images: true, intentWeights: { set: 100 } };
  if (slurpPostAxes("creator-set", sequence, decided).delivery === "multi_image_set") sets += 1;
  assert.notEqual(
    slurpPostAxes("creator-set", sequence, { ...decided, singlePicture: true }).delivery,
    "multi_image_set",
  );
}
assert.ok(sets > 0, "without the limit a set-heavy Creator still posts sets");
assert.match(
  read("server/src/slp/features/feed/slp-generation-service.ts"),
  /singlePicture: input\.prepareOnly === true/u,
);

// --- R1-054: the player's chat photo is the persona's, and costs the Creator nothing ---------------
const photo = slurpViewerPhotoPrompt("my ramen", "short red hair, freckles");
assert.match(photo, /The photo shows: my ramen/u);
assert.match(photo, /short red hair, freckles/u);
assert.doesNotMatch(slurpViewerPhotoPrompt("my ramen", ""), /look like/u);
const commission = read("server/src/slp/features/messages/commissions/slp-commission-image-operation.ts");
const viewerPhoto = commission.slice(commission.indexOf("export async function generateSlurpViewerPhoto"));
assert.match(viewerPhoto, /linkedPublicAccount: null/u);
assert.match(viewerPhoto, /suppressStageAppearance: true/u);
assert.match(viewerPhoto, /suppressCreatorDetails: true/u);
assert.match(viewerPhoto, /chargeEnergy: false/u);
assert.match(images, /if \(input\.chargeEnergy !== false\) \{/u);
const mediaRoutes = read("server/src/slp/features/messages/slp-messages-media-routes.ts");
const viewerImageRoute = mediaRoutes.slice(mediaRoutes.indexOf('"/messages/threads/:threadId/viewer-image"'));
assert.match(viewerImageRoute, /generateSlurpViewerPhoto\(app\.db, \{/u);

// --- R1-055: the redraw box says "as written", and Try again keeps it -----------------------------
assert.match(routes, /asWritten: z\.boolean\(\)\.optional\(\)/u);
assert.match(routes, /retryStoredPrompt: !asWritten,/u);
assert.match(
  reviewed,
  /retryStoredPrompt: input\.retryStoredPrompt && claimed\.metadata\.imagePromptAsWritten !== true/u,
);
assert.match(
  read("client/src/slp/modules/post/SlpPostCard.tsx"),
  /ctx\.generatePostImage\?\.\(post, promptDraft\.trim\(\), true\)/u,
);

// --- R1-056: one Creator that cannot be filled no longer stalls the backfill ------------------------
const profiles = [
  { id: "stuck", avatarUrl: "a.png", bannerUrl: null },
  { id: "new", avatarUrl: null, bannerUrl: null },
  { id: "done", avatarUrl: "b.png", bannerUrl: "c.png" },
];
assert.deepEqual(
  slurpArtworkGaps(profiles).map(({ target, kind }) => `${target.id}:${kind}`),
  ["stuck:banner", "new:avatar", "new:banner"],
);
assert.match(
  read("server/src/slp/features/creators/slp-artwork-operation.ts"),
  /for \(const \{ target, kind \} of slurpArtworkGaps\(profiles\)\) \{[\s\S]{0,160}?if \(outcome !== "idle"\) return outcome;/u,
);

// --- R1-057: a new picture drops the old crop and description; a failed one is restored cleanly -----
assert.match(routes, /imageCrop: undefined, imageDescription: undefined, imageDescriptionSource: undefined/u);
const restore = postStorage.slice(postStorage.indexOf("async restorePostImageIfUnclaimed"));
assert.match(
  restore,
  /"imageGenerationFailed",\s*"imageGenerationRetryable",\s*"imageGenerationError",\s*"imageRetryAttempts"/u,
);
assert.match(restore, /imagePrompt !== undefined && \{ imagePrompt \}/u);

// --- R1-058: ready only when a connection resolves ---------------------------------------------------
const backstage = read("client/src/slp/features/media/slp-media-backstage-contract.ts");
assert.match(
  backstage,
  /Boolean\(selectedImageConnection \|\| engineDefaultImageConnection\) && imageEnabledCreators\.length > 0/u,
);

// --- R1-059: each draw keeps its own "Drawing" state ---------------------------------------------------
// Pulse + E: the post-picture draw moved into the post actions hook (a Pulse task; slp-home-state.ts
// sits at the 800-line cap). Same per-post "Drawing" state.
const homeState = read("client/src/slp/app/slp-home-post-actions.ts");
assert.match(homeState, /setGeneratingPostImageIds\(\(current\) => \[\.\.\.current, post\.id\]\)/u);
assert.match(homeState, /current\.filter\(\(id\) => id !== post\.id\)/u);

// --- R1-060: a failed fetch is not "loading" -----------------------------------------------------------
const mediaSrc = read("client/src/slp/base/media/slp-media-src.ts");
assert.match(mediaSrc, /if \(!cancelled\) setResolved\(\{ objectUrl \}\);/u);
assert.match(mediaSrc, /loading: Boolean\(imageUrl && !src && !failed\)/u);

// --- R1-061: a deleted Creator's chat uploads leave the disk ---------------------------------------
const folder = "slurp2-media/messages/";
assert.deepEqual(
  slurpUploadedMessageMediaPaths(
    [
      { noodlerMediaPath: "slurp2-media/messages/a.png" },
      { noodlerMediaPath: "slurp2-media/creator-2/offer.png" },
      { noodlerMediaPath: "slurp2-media/messages/../creator-2/x.png" },
      { uploaded: true },
    ],
    folder,
  ),
  ["slurp2-media/messages/a.png"],
  "only the shared uploads folder, never another Creator's files",
);
assert.match(
  read("server/src/slp/data/creators/slp-creators-storage-3.ts"),
  /for \(const mediaPath of uploadedMessageMedia\) unlinkCreatorMedia\(mediaPath\);/u,
);

// --- R1-062: the default post size is exact 4:5 --------------------------------------------------------
assert.match(read("server/src/slp/modules/settings/slp-settings.ts"), /imageWidth: 1024,\s*imageHeight: 1280,/u);

console.log("slurp2 fix1 image pipeline regression passed");
