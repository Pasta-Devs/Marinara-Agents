/**
 * 7b-q cropped previews: every cropped picture keeps its top centre, a post picture preview gets a
 * quiet "cropped" mark only when it is really cut, "Show whole pictures" fits instead of cropping,
 * and "Tap a preview to open the full post" decides what a tap on a post picture opens.
 */
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { slurp2Source } from "./slurp2-source.ts";

const root = "packages/slurp2/src/engine/packages/client/src/slp";
const client = (path: string) => slurp2Source(`${root}/${path}`);

// --- Every cropped picture is anchored at the top centre ----------------------------------------
// Not a crop that shows a face: round avatars, the crop editor, the blurred ambient copies behind a
// picture, and the Deep details run list (its pictures keep their own height).
const NOT_A_PREVIEW = [
  /rounded-full/u,
  /base\/media\/SlpPostImageCropEditor\.tsx/u,
  /base\/chrome\/SlpChrome\.tsx/u,
  /modules\/post\/SlpDeepDetailsImageRuns\.tsx/u,
  /SlpHomeHelpers\.tsx.*\{\.\.\.slpImgFade\} className="h-full w-full object-cover" \/>$/u,
  /SlpScreenMoments\.tsx.*\{\.\.\.slpImgFade\} className="h-full w-full object-cover" \/>$/u,
];
const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : entry.name.endsWith(".tsx") ? [join(dir, entry.name)] : [],
  );
const unanchored = walk(root).flatMap((file) =>
  slurp2Source(file)
    .split("\n")
    .map((line) => `${file}: ${line.trim()}`)
    .filter((line) => /\bobject-cover\b/u.test(line) && !/slp-crop/u.test(line))
    .filter((line) => !NOT_A_PREVIEW.some((pattern) => pattern.test(line))),
);
assert.deepEqual(unanchored, [], "a cropped picture without the top-centre anchor");

// Post picture previews get the full treatment (mark + whole pictures); their frame is positioned.
const PREVIEWS: Record<string, number> = {
  "modules/post/SlpPostCard.tsx": 1, // feed, profile posts, search
  "app/screens/SlpScreenProfile.tsx": 1, // media grid tiles
  "modules/story/SlpStoryTile.tsx": 1, // Story tiles
  "features/messages/SlpMessageBubble.tsx": 2, // bought PPV, picture message
  "features/messages/SlpSharedPostCard.tsx": 1, // shared post (moved out of the bubble in G6)
  "modules/post/SlpReplyRow.tsx": 1,
  "modules/post/SlpPostReplyRow.tsx": 1,
};
for (const [path, count] of Object.entries(PREVIEWS))
  assert.equal(client(path).match(/"slp-crop [^"]*object-cover/gu)?.length ?? 0, count, `${path}: post previews`);
assert.match(
  client("app/screens/SlpScreenProfile.tsx"),
  /"relative block h-full w-full text-left/u,
  "media tile frame",
);
assert.match(client("modules/story/SlpStoryTile.tsx"), /"relative block h-full w-full", SLP_IMG_FRAME_CLASS/u);
for (const path of ["modules/post/SlpReplyRow.tsx", "modules/post/SlpPostReplyRow.tsx"])
  assert.match(client(path), /className="relative mt-2 block w-full overflow-hidden/u, `${path}: frame`);
// Banners, covers and blurred teasers only anchor: no mark, and they keep filling their frame.
for (const path of [
  "modules/creator/SlpCreatorProfileCard.tsx",
  "features/creators/SlpProfileSurface.tsx",
  "modules/post/SlpLockedPostCard.tsx",
  "modules/post/SlpLockedMedia.tsx",
  "features/ads/SlpInlineAd.tsx",
])
  assert.match(client(path), /slp-crop-top /u, `${path}: anchored`);

// --- The CSS: anchor, whole pictures, the mark ------------------------------------------------------
const entry = client("slp-client-entry.tsx");
assert.match(entry, /\.slp-crop, \.slp-crop-top \{ object-position: top center; \}/u);
assert.match(entry, /\[data-slp-whole\] \.slp-crop \{ object-fit: contain; \}/u, "whole pictures fit");
assert.match(entry, /:has\(> img\.slp-crop\[data-slp-cut\]\)::after \{/u, "the mark sits on a really cut picture");
assert.match(entry, /\[data-slp-whole\] :has\(> img\.slp-crop\[data-slp-cut\]\)::after \{ content: none; \}/u);
assert.doesNotMatch(entry, /\[data-slp-whole\] \.slp-crop-top/u, "banners keep filling their frame");
const chrome = client("base/chrome/SlpChrome.tsx");
assert.match(
  chrome,
  // 0.3.6: measured in the once-per-frame flush (reads first, then the marks), still from real sizes.
  /classList\.contains\(SLP_CROP_CLASS\)\s*\?\s*slpPreviewIsCut\(image\.naturalWidth, image\.naturalHeight, image\.clientWidth, image\.clientHeight\)/u,
  "the mark follows the real picture and frame sizes",
);
assert.match(chrome, /Math\.abs\(Math\.log\(naturalWidth \/ naturalHeight \/ \(boxWidth \/ boxHeight\)\)\) > 0\.04/u);

// --- Settings ---------------------------------------------------------------------------------------
const serverSettings = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/slp/modules/settings/slp-settings.ts",
);
assert.match(serverSettings, /previewOpensPost: true,\s*previewWholePictures: false,/u, "defaults: open posts, crop");
const images = client("features/media/SlpImagesPanel.tsx");
assert.match(images, /settingKey="previewWholePictures"/u);
assert.match(images, /settingKey="previewOpensPost"/u);
assert.match(
  client("app/SlpHomeHost.tsx"),
  /document\.documentElement\.toggleAttribute\("data-slp-whole", wholePictures\)/u,
);

// --- "Blur pictures until tapped" (0.3.7): off by default, CSS blurs, the first tap shows ------------
assert.match(serverSettings, /blurPictures: false,/u);
assert.match(images, /settingKey="blurPictures"/u);
const hostSource = client("app/SlpHomeHost.tsx");
assert.match(hostSource, /root\.toggleAttribute\("data-slp-blur", blurPictures\)/u);
assert.match(hostSource, /document\.addEventListener\("click", reveal, true\)/u, "capture: the tap shows, not opens");
assert.match(hostSource, /media\.setAttribute\("data-slp-revealed", ""\)/u);
assert.match(
  slurp2Source("packages/slurp2/src/engine/packages/client/src/slp/slp-client-entry.tsx"),
  /\[data-slp-blur\][^{]*:is\(img:not\(\[src\^="data:image\/svg"\]\), video\):not\(\[data-slp-revealed\]\)/u,
  "inline SVG art (coin, G) stays sharp (#61)",
);
assert.match(
  hostSource,
  /const picture = 'img:not\(\[src\^="data:image\/svg"\]\)';/u,
  "a tap on the coin is not a reveal",
);

// --- A tap on a post picture -------------------------------------------------------------------------
const hub = client("app/screens/SlpScreenHub.tsx");
assert.match(hub, /openPost: previewOpensPost \? setOpenPostId : undefined/u, "feed and search");
assert.match(hub, /searchResults\.find\(\(item\) => item\.post\.id === openPostId\)/u, "a search result opens too");
const cards = client("app/screens/SlpProfilePostCards.tsx");
assert.match(cards, /const openPost = previewOpensPost \? showProfilePost : undefined;/u, "profile posts");
assert.equal(cards.match(/postManagement: managedCreator,?\s*openPost/gu)?.length, 2);
assert.match(
  cards,
  /previewOpensPost \|\| !postCardCtx\.setImageLightbox\s*\? setOpenImagePostId\(id\)/u,
  "media grid",
);
// Locked posts still open their unlock options, whatever the setting says.
assert.match(cards, /<SlpLockedMediaTile[\s\S]*?onOpen=\{\(\) => showProfilePost\(tile\.post\.id\)\}/u);
assert.match(
  client("modules/post/SlpPostCard.tsx"),
  /if \(ctx\.openPost\) ctx\.openPost\(post\.id\);\s*else\s*setImageLightbox/u,
  "no openPost: the picture alone",
);

console.log("slurp2 cropped previews regression: pass");
