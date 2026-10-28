/**
 * V (user + orchestrator decisions, 2026-09-28): the P+Q, S and U follow-ups. Adaptive post frames, the
 * AI budget "Off" for image prompt enhancing (in `slurp2-perspective`), old ads redrawn once in the wide
 * banner, the card clothing filter keeping body traits, collab drops holding their exact hour, and the
 * first 1,000 subscribers moving to Seasons of life (in `slurp2-content-packs`).
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { slurp2Source } from "./slurp2-source";
import {
  slurpAgreeCollabInDm,
  SLURP_NO_TIES,
  type SlurpTieCreator,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-creator-ties.ts";
import {
  slurpAnnounceCollab,
  slurpCollabDropAt,
  slurpCollabStep,
  slurpHoldsCollabDrop,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-collab-work.ts";
import { slurpTieBeat } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-tie-beats.ts";
import { slurpImageLook } from "../packages/slurp2/src/engine/packages/server/src/slp/base/media/slp-image-prompt.ts";
import {
  GARNISH_BANNER_REDRAWS_PER_DAY,
  nextGarnishBannerRedraw,
  readGarnishBannerRedrawState,
} from "../packages/slurp2/src/engine/packages/server/src/slp/features/ads/slp-garnish-banner-redraw.ts";
import type { GarnishAd } from "../packages/slurp2/src/engine/packages/server/src/services/garnish-ads/garnish-ads.types.ts";
import {
  readSlpImageSize,
  slpImageSizeOfFile,
} from "../packages/slurp2/src/engine/packages/server/src/slp/base/media/slp-image-size.ts";
import {
  slpPostFrameStyle,
  slpPostLoadedRatio,
  slpPostMediaRatio,
} from "../packages/slurp2/src/engine/packages/client/src/slp/modules/post/slp-post-ratio.ts";
import { slurpDropClock } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-post-purpose.ts";

const server = (path: string) => slurp2Source(`packages/slurp2/src/engine/packages/server/src/slp/${path}`);
const HOUR = 60 * 60 * 1000;
const T0 = new Date(2026, 9, 1, 11, 0, 0, 0); // local, like the drop hours

const creator = (id: string, text: string): SlurpTieCreator => ({
  id,
  name: id[0]!.toUpperCase() + id.slice(1),
  text,
  tags: ["fitness"],
  automatic: true,
  followers: 1000,
  gender: null,
  cardPartners: [],
});
const mira = creator("mira", "Climbing coach, lives for bouldering and gym training.");
const kai = creator("kai", "Personal trainer, runs every morning and lifts at night.");
const names = new Map([
  ["mira", "Mira"],
  ["kai", "Kai"],
]);

// --- 5. A collab drop holds its exact hour, like a teased drop ---------------------------------------
{
  const agreed = slurpAgreeCollabInDm(SLURP_NO_TIES, mira, kai, {
    at: T0,
    id: "c1",
    idea: "a climbing day",
    hostShare: 60,
  });
  const rolled = new Date(slurpCollabDropAt("c1", T0));
  // The host already posts at the rolled hour: the drop takes another evening hour clear of it.
  const spacingMs = 2 * HOUR;
  const moved = new Date(slurpCollabDropAt("c1", T0, { busy: [rolled.getTime()], spacingMs }));
  assert.notEqual(moved.getTime(), rolled.getTime(), "a busy hour is not held twice");
  assert.equal(moved.toDateString(), rolled.toDateString(), "same drop day");
  assert.ok(moved.getHours() >= 17 && moved.getHours() <= 21 && moved.getMinutes() === 0, "an evening hour");
  assert.ok(Math.abs(moved.getTime() - rolled.getTime()) >= spacingMs, "clear by the host's own spacing");
  // Every evening hour busy: the rolled hour still (the announcement always names one).
  const allBusy = [17, 18, 19, 20, 21].map((hour) => new Date(rolled).setHours(hour, 0, 0, 0));
  assert.equal(slurpCollabDropAt("c1", T0, { busy: allBusy, spacingMs }), rolled.toISOString());
  assert.equal(slurpCollabDropAt("c1", T0, null), rolled.toISOString(), "no slots known: the rolled hour");

  // The announcement names that exact hour and hands it to the service to store and hold.
  const planned = slurpTieBeat({
    creatorId: "mira",
    creatorText: "",
    sequence: 1,
    ties: agreed,
    deals: [],
    names,
    intents: ["casual"],
    at: T0,
    slots: { busy: [rolled.getTime()], spacingMs },
  })!;
  assert.equal(planned.beat.tie.announce, true);
  assert.equal(planned.dropAt, moved.toISOString());
  assert.ok(planned.beat.line.includes(`It drops ${slurpDropClock(moved.toISOString(), T0)} on both`));
  assert.match(planned.beat.line, / at [5-9] pm on both your pages\. Name that time/u);
  const announced = slurpAnnounceCollab(agreed, "c1", T0, planned.dropAt);
  const drop = new Date(announced.collabs[0]!.dropAt!);
  assert.equal(drop.getTime(), moved.getTime(), "the stored hour is the one the line named");

  // The reserve prepares slots ahead: the slot held at the drop hour takes the drop even when it is
  // prepared hours before, an earlier slot does not, a later one does when something else had it.
  const collab = announced.collabs[0]!;
  const early = new Date(drop.getTime() - 3 * HOUR);
  assert.equal(slurpCollabStep(collab, early, drop), "post", "the held slot, prepared early");
  assert.equal(slurpCollabStep(collab, early, new Date(drop.getTime() - HOUR)), "wait", "a slot before the hour");
  assert.equal(slurpCollabStep(collab, early, new Date(drop.getTime() + 2 * HOUR)), "post", "the next slot after it");
  assert.equal(slurpCollabStep(collab, early), "wait", "without a slot time the clock decides (old behaviour)");
  const dropBeat = (dueAt: Date) =>
    slurpTieBeat({
      creatorId: "mira",
      creatorText: "",
      sequence: 2,
      ties: announced,
      deals: [],
      names,
      intents: ["casual"],
      at: early,
      dueAt,
    });
  assert.match(dropBeat(drop)!.beat.line, /drops today, the one you announced/u);
  assert.equal(dropBeat(new Date(drop.getTime() - HOUR)), null, "an ordinary slot before the drop");

  // Only the host's slot at that minute is the held one; not the partner's, not an hour off, not once posted.
  assert.ok(slurpHoldsCollabDrop(announced, "mira", drop));
  assert.ok(slurpHoldsCollabDrop(announced, "mira", new Date(drop.getTime() + 20_000)));
  assert.ok(!slurpHoldsCollabDrop(announced, "mira", new Date(drop.getTime() + HOUR)));
  assert.ok(!slurpHoldsCollabDrop(announced, "kai", drop));
  assert.ok(!slurpHoldsCollabDrop(agreed, "mira", drop), "not announced yet");
  assert.ok(
    !slurpHoldsCollabDrop(
      { ...announced, collabs: announced.collabs.map((entry) => ({ ...entry, status: "posted" as const })) },
      "mira",
      drop,
    ),
  );

  // Wiring: the service reads the host's slots, stores the named hour and books that slot; the reserve
  // keeps ideas and Stories off the held slot but not its access; the slot time reaches the tie beat.
  const service = server("features/projects/slp-creator-ties-service.ts");
  assert.match(service, /readSlurpSlotTimes\(db, input\.creatorId, input\.at\)/u);
  assert.match(service, /slurpAnnounceCollab\(document\.ties, tie\.id, input\.at, planned\.dropAt\)/u);
  assert.match(
    service,
    /if \(planned\.dropAt && slots\)\s*await bookSlurpHeldSlot\(db, input\.creatorId, new Date\(planned\.dropAt\)/u,
  );
  assert.ok(
    service.indexOf("bookSlurpHeldSlot(db") >
      service.indexOf("await mutateSlurpCreatorTies(db, (document) => ({\n      document: {\n        // A couple"),
    "booked after the announcement is stored",
  );
  const reserve = server("features/feed/reserve/slp-reserve-operation.ts");
  assert.match(reserve, /slurpHeldCollabDrop\(db, selectedAccount\.id, new Date\(selectedPublishAt\)\)/u);
  assert.match(reserve, /\.\.\.\(heldCollab \? \{ allowStory: false, heldDrop: true \} : \{\}\)/u);
  assert.match(reserve, /access: heldDrop \? "locked"/u, "only a teased drop is locked");
  assert.match(server("features/feed/slp-post-plan-service.ts"), /at,\s*dueAt,\s*previewOnly,/u);
  assert.match(server("features/feed/slp-post-beat-service.ts"), /at: input\.at,\s*dueAt: input\.dueAt,/u);
  const purpose = server("features/feed/slp-post-purpose-service.ts");
  assert.match(
    purpose,
    /const times = await readSlurpSlotTimes\(db, creatorAccountId, at, \[teaseAt\.getTime\(\)\]\)/u,
  );
}

// --- 4. The card look keeps body traits from a sentence that also mentions clothes ------------------
{
  const look = (text: string) => slurpImageLook(text);
  assert.equal(look("Her curvy figure looks great in tight clothing."), "Her curvy figure looks great.");
  assert.equal(look("She has red hair, green eyes and a black hoodie."), "She has red hair, green eyes.");
  assert.equal(
    look("Wearing a hoodie, she has freckles and a gap-toothed smile."),
    "She has freckles and a gap-toothed smile.",
  );
  assert.equal(look("Tall and lean — usually in ripped jeans."), "Tall and lean.");
  assert.equal(look("She has long legs and loves wearing short skirts!"), "She has long legs!");
  // A kept clause must be a body trait: a habit or a mood from a clothing sentence goes with the clothes.
  assert.equal(
    look("Dresses in flannel and thinks his roommate's neon phase is funny."),
    "Dresses in flannel and thinks his roommate's neon phase is funny.",
    "nothing but clothes and a mood: the old fallback",
  );
  assert.equal(
    look("Freckled nose. Dresses in flannel and thinks his roommate's neon phase is funny."),
    "Freckled nose.",
  );
  // Only clothes in the sentence: it drops whole, like before; body-only sentences stay as written.
  assert.equal(
    look(
      "Mara is petite with blonde hair. She favors pastel dresses. For cosplay, she wears a corset and carries a sword. Her face is round and cute.",
    ),
    "Mara is petite with blonde hair. Her face is round and cute.",
  );
  assert.equal(look("Tall, broad shoulders, a scar over one eye."), "Tall, broad shoulders, a scar over one eye.");
  // A card that is nothing but clothes keeps its text (the old fallback), never an empty look.
  assert.equal(look("She wears a red dress."), "She wears a red dress.");
  assert.doesNotMatch(look("Soft brown eyes, and she is always in a school uniform."), /uniform/u);
}

// --- 3. Old ads get their wide banner once --------------------------------------------------------
{
  const drawn = (id: string) => `/api/slurp2/noodler/ads/${id}/image/feed-${id}.png`;
  const ad = (id: string, over: Partial<GarnishAd> = {}) => ({ id, imageUrl: drawn(id), ...over }) as GarnishAd;
  // The service's own test: a file in the ad's folder (`readGarnishAdMediaPath`); pinned below.
  const bySlurp = (entry: GarnishAd) =>
    Boolean(entry.imageUrl?.startsWith(`/api/slurp2/noodler/ads/${entry.id}/image/`));
  const at = new Date("2026-10-01T12:00:00Z");
  const fresh = readGarnishBannerRedrawState(null, at);
  assert.deepEqual(fresh, { tried: [], day: "2026-10-01", count: 0 });
  const ads = [
    ad("has-banner", { wideImageUrl: drawn("has-banner").replace("feed", "wide") }),
    ad("uploaded", { imageUrl: "https://example.com/my-picture.png" }),
    ad("no-picture", { imageUrl: null }),
    ad("old-1"),
    ad("old-2"),
  ];
  // Only an ad whose feed picture Slurp drew, with no banner yet: never a player's own picture link.
  assert.equal((nextGarnishBannerRedraw(ads, fresh, bySlurp) as GarnishAd).id, "old-1");
  // Once tried (drawn or failed), never again: the next one comes, then none is left.
  const afterOne = { ...fresh, tried: ["old-1"], count: 1 };
  assert.equal((nextGarnishBannerRedraw(ads, afterOne, bySlurp) as GarnishAd).id, "old-2");
  assert.equal(nextGarnishBannerRedraw(ads, { ...afterOne, tried: ["old-1", "old-2"] }, bySlurp), null);
  // An ad that got its banner (redrawn, or a new ad) is done without being on the list.
  assert.equal(nextGarnishBannerRedraw([ad("new", { wideImageUrl: drawn("new") })], fresh, bySlurp), null);
  // Paced over the day inside the ad pictures budget; a new day opens it again, the tried list stays.
  const full = { tried: ["old-1"], day: "2026-10-01", count: GARNISH_BANNER_REDRAWS_PER_DAY };
  assert.equal(nextGarnishBannerRedraw(ads, full, bySlurp), "paced");
  const tomorrow = readGarnishBannerRedrawState(JSON.stringify(full), new Date("2026-10-02T00:30:00Z"));
  assert.deepEqual(tomorrow, { tried: ["old-1"], day: "2026-10-02", count: 0 });
  assert.equal((nextGarnishBannerRedraw(ads, tomorrow, bySlurp) as GarnishAd).id, "old-2");
  assert.deepEqual(readGarnishBannerRedrawState("{broken", at), fresh, "a corrupt record reads as fresh");
  assert.deepEqual(readGarnishBannerRedrawState('{"tried":[1,"a"],"day":"2026-10-01","count":"9"}', at), {
    tried: ["a"],
    day: "2026-10-01",
    count: 0,
  });

  // Wiring: only the banner is drawn (the feed picture stays), its failure counts as tried, the
  // scheduler runs one step per poll only with ads and ad pictures on.
  const images = server("features/ads/slp-garnish-image-service.ts");
  assert.match(
    images,
    /for \(const format of GARNISH_AD_IMAGE_FORMATS\) \{\s*if \(only && format\.field !== only\) continue;/u,
  );
  assert.match(images, /if \(only\) throw error;/u);
  assert.match(images, /\[settings\.inlineAdsImageConnectionId\],\s*"wideImageUrl",?\s*\)/u);
  assert.match(images, /\(ad\) =>\s*Boolean\(readGarnishAdMediaPath\(ad\.id, ad\.imageUrl\)\)/u);
  assert.match(
    server("features/ads/slp-garnish-image.ts"),
    /const NOODLER_AD_IMAGE_URL_PREFIX = "\/api\/slurp2\/noodler\/ads\/";/u,
  );
  assert.match(images, /if \(outcome !== "unavailable"\)\s*await store\.set\(/u);
  assert.match(images, /if \(!slpInlineAdsOn\(settings\) \|\| !settings\.inlineAdsImagesEnabled\) return "off";/u);
  const scheduler = server("features/feed/slp-refresh-scheduler-service.ts");
  assert.match(
    scheduler,
    /if \(slpInlineAdsOn\(settings\) && settings\.inlineAdsImagesEnabled\) \{\s*await redrawOldGarnishAdBanner\(app\.db, createGarnishAds\(app\.db\)\.pool, now\)/u,
  );
}

// --- 1. Adaptive post frames ------------------------------------------------------------------------
{
  // The server reads the size from real file headers: a whole PNG, a JPEG with a big EXIF block first,
  // WebP (lossy, lossless, extended) and GIF.
  const u32 = (value: number) => {
    const bytes = Buffer.alloc(4);
    bytes.writeUInt32BE(value);
    return bytes;
  };
  const chunk = (type: string, data: Buffer) =>
    Buffer.concat([u32(data.length), Buffer.from(type, "ascii"), data, u32(0)]);
  const png = (width: number, height: number) =>
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", Buffer.concat([u32(width), u32(height), Buffer.from([8, 2, 0, 0, 0])])),
      chunk("IDAT", deflateSync(Buffer.alloc(height * (1 + width * 3)))),
      chunk("IEND", Buffer.alloc(0)),
    ]);
  const segment = (marker: number, body: Buffer) => {
    const head = Buffer.from([0xff, marker, 0, 0]);
    head.writeUInt16BE(body.length + 2, 2);
    return Buffer.concat([head, body]);
  };
  const sof = Buffer.alloc(15);
  sof.writeUInt8(8, 0);
  sof.writeUInt16BE(1280, 1); // height
  sof.writeUInt16BE(1024, 3); // width
  const jpeg = Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    segment(0xe0, Buffer.from("JFIF\0\x01\x01\0\0\x01\0\x01\0\0", "binary")),
    segment(0xe1, Buffer.alloc(60_000, 7)), // EXIF before the frame header
    segment(0xc4, Buffer.alloc(30, 1)), // a Huffman table is not a frame header
    segment(0xc2, sof), // progressive frame
    Buffer.from([0xff, 0xda]),
  ]);
  const riff = (body: Buffer) =>
    Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP"), body, Buffer.alloc(8)]);
  const vp8x = Buffer.alloc(18);
  vp8x.write("VP8X", 0);
  vp8x.writeUIntLE(1216 - 1, 12, 3);
  vp8x.writeUIntLE(640 - 1, 15, 3);
  const vp8l = Buffer.alloc(13);
  vp8l.write("VP8L", 0);
  vp8l[8] = 0x2f;
  vp8l.writeUInt32LE((1080 - 1) | ((1350 - 1) << 14), 9);
  const vp8 = Buffer.alloc(18);
  vp8.write("VP8 ", 0);
  vp8.set([0x9d, 0x01, 0x2a], 11);
  vp8.writeUInt16LE(1536, 14);
  vp8.writeUInt16LE(1024, 16);
  const gif = Buffer.from("GIF89a\x40\x01\xf0\x00", "binary");
  assert.deepEqual(readSlpImageSize(png(832, 1216)), { width: 832, height: 1216 });
  assert.deepEqual(readSlpImageSize(jpeg), { width: 1024, height: 1280 });
  assert.deepEqual(readSlpImageSize(riff(vp8x)), { width: 1216, height: 640 });
  assert.deepEqual(readSlpImageSize(riff(vp8l)), { width: 1080, height: 1350 });
  assert.deepEqual(readSlpImageSize(riff(vp8)), { width: 1536, height: 1024 });
  assert.deepEqual(readSlpImageSize(gif), { width: 320, height: 240 });
  assert.equal(readSlpImageSize(Buffer.from("not a picture at all, just text")), null);
  assert.equal(readSlpImageSize(jpeg.subarray(0, 2_000)), null, "a cut-off JPEG is unknown, not a guess");
  const dir = mkdtempSync(join(tmpdir(), "slp-v-size-"));
  try {
    writeFileSync(join(dir, "a.png"), png(1024, 1280));
    writeFileSync(join(dir, "b.jpg"), jpeg);
    assert.deepEqual(slpImageSizeOfFile(join(dir, "a.png")), { width: 1024, height: 1280 });
    assert.deepEqual(slpImageSizeOfFile(join(dir, "b.jpg")), { width: 1024, height: 1280 });
    assert.equal(slpImageSizeOfFile(join(dir, "missing.png")), null);
    writeFileSync(join(dir, "missing.png"), png(640, 640));
    assert.deepEqual(slpImageSizeOfFile(join(dir, "missing.png")), { width: 640, height: 640 }, "read once it lands");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  // The client clamps the ratio between 4:5 and 1.91:1; no size is Slurp's 4:5.
  assert.equal(slpPostMediaRatio({ width: 1024, height: 1280 }), 0.8);
  assert.equal(slpPostMediaRatio({ width: 1080, height: 1080 }), 1);
  assert.equal(slpPostMediaRatio({ width: 1216, height: 832 }), 1216 / 832, "3:2-ish stays as it is");
  assert.equal(slpPostMediaRatio({ width: 768, height: 1365 }), 0.8, "9:16 fills the 4:5 end");
  assert.equal(slpPostMediaRatio({ width: 3000, height: 1000 }), 1.91, "a panorama fills the wide end");
  assert.equal(slpPostMediaRatio(null), 0.8);
  assert.equal(slpPostMediaRatio({ width: 0, height: 100 }), 0.8);
  const tall = slpPostFrameStyle(0.8);
  assert.equal(tall.aspectRatio, 0.8);
  assert.equal(tall.width, "100%");
  assert.equal(tall.maxWidth, "calc(min(36rem, 72dvh) * 0.8000)", "never taller than the cap: narrower instead");
  // Only a real difference moves an unknown frame; the same shape (rounding) does not.
  assert.equal(slpPostLoadedRatio(0.8, { width: 1024, height: 1279 }), null);
  assert.equal(slpPostLoadedRatio(0.8, { width: 1600, height: 900 }), 1600 / 900);
  assert.equal(slpPostLoadedRatio(0.8, { width: 0, height: 0 }), null);

  // Wiring: the viewer projection sends the primary picture's stored size, a carousel's extra
  // pictures keep theirs from the post media record, shares carry it, and every post frame uses it.
  const viewer = server("features/viewer/slp-viewer-context.ts");
  assert.match(viewer, /slpStoredMediaSize\(post\.metadata\.noodlerMediaPath\)/u);
  assert.match(viewer, /\.\.\.image,\s*\.\.\.size,/u);
  assert.match(server("data/feed/slp-post-media-storage.ts"), /\.\.\.slpStoredMediaSize\(mediaPath\)/u);
  assert.match(server("features/messages/slp-message-operation.ts"), /imageWidth: sharedSize\.width/u);
  assert.match(server("features/messages/slp-messages-send-routes.ts"), /imageWidth: size\.width/u);
  const client = (path: string) => slurp2Source(`packages/slurp2/src/engine/packages/client/src/slp/${path}`);
  const card = client("modules/post/SlpPostCard.tsx");
  assert.match(card, /<SlpPostMediaFrame\s+src=\{displayedImageUrl\}\s+size=\{post\.images\[0\]\}/u);
  assert.match(card, /countFromMount=\{imageGenerationPending\}\s+size=\{post\.images\[0\]\}/u, "the pending slot too");
  assert.doesNotMatch(card, /aspect-\[4\/3\] sm:aspect-\[16\/10\]/u, "profile and dialog no longer crop to 4:3");
  assert.doesNotMatch(card, /flex max-h-\[32rem\] justify-center/u, "the container no longer cuts a tall frame");
  const frame = client("modules/post/SlpPostMediaFrame.tsx");
  assert.match(frame, /slpImgFade\.onLoad\(event\);/u, "the fade still runs");
  assert.match(frame, /toggleAttribute\(\s*"data-slp-cut",/u, "an adapted frame drops a cut mark it no longer has");
  assert.match(frame, /SLP_IMG_FRAME_CLASS/u, "the shimmer still runs");
  assert.match(frame, /if \(!src\) return <span/u, "the frame is there before the picture");
  assert.match(
    client("modules/post/SlpPostHelpers.tsx"),
    /data-slurp-image-slot="pending"[\s\S]{0,300}style=\{slpPostFrameStyle\(slpPostMediaRatio\(size\)\)\}/u,
  );
  assert.match(
    client("modules/post/SlpLockedPostCard.tsx"),
    /style=\{\{ \.\.\.slpPostFrameStyle\(slpPostMediaRatio\(postImages\[0\]\)\), minHeight: "20rem" \}\}/u,
  );
  const shared = client("features/messages/SlpSharedPostCard.tsx");
  assert.match(shared, /typeof meta\.imageWidth === "number"/u);
  assert.equal((shared.match(/style=\{\{ aspectRatio: frameRatio \}\}/gu) ?? []).length, 2, "locked and open cards");
}

console.log("slurp2 V follow-ups regression passed");
