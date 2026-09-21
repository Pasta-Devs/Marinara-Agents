import assert from "node:assert/strict";
import {
  SLURP_ARCHIVE_MIN_AGE_MS,
  SLURP_PREVIEW_MAX_AGE_MS,
  slurpPickReuse,
  slurpPreviewCrop,
  slurpReuseCandidates,
  type SlurpReusablePost,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-media-reuse.ts";
import {
  slurpDeliveryFits,
  slurpReuseDelivery,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-content-axes.ts";
import { slurpImageBrief } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-image-brief.ts";
import { slurpPostVariation } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-post-variation.ts";
import { slurp2Source } from "./slurp2-source";

const at = new Date("2026-09-21T12:00:00.000Z");
const ago = (ms: number) => new Date(at.getTime() - ms).toISOString();
const DAY = 24 * 60 * 60_000;
const post = (id: string, access: string, age: number, extra: Record<string, unknown> = {}): SlurpReusablePost => ({
  id,
  access,
  createdAt: ago(age),
  metadata: { noodlerMediaPath: `slurp2-media/c/${id}.png`, ...extra },
});
const posts = [
  post("old-public", "public", 10 * DAY),
  post("old-locked", "locked", 10 * DAY),
  post("fresh-public", "public", DAY),
  post("fresh-locked", "locked", DAY),
  post("stale-locked", "locked", 10 * DAY),
  post("shoot-public", "public", DAY, { shootId: "shoot-1" }),
  post("shoot-locked", "locked", DAY, { shootId: "shoot-1" }),
  post("old-story", "public", 10 * DAY, { noodlerPostType: "story" }),
  { id: "no-media", access: "public", createdAt: ago(10 * DAY), metadata: {} },
];
const ids = (list: SlurpReusablePost[]) => list.map((entry) => entry.id).sort();

// Paid content: a locked picture never reaches a public post as a whole picture.
for (const kind of ["archive", "shoot"] as const) {
  const reused = slurpReuseCandidates(posts, { kind, access: "public", at, shootId: "shoot-1" });
  assert.ok(!reused.some((entry) => entry.access === "locked"), `${kind} leaked a locked picture into a public post`);
}
// A locked post may reuse either.
assert.deepEqual(ids(slurpReuseCandidates(posts, { kind: "archive", access: "locked", at })), [
  "old-locked",
  "old-public",
  "stale-locked",
]);
// An archive picture is actually old, never a Story, and always has a file.
assert.deepEqual(ids(slurpReuseCandidates(posts, { kind: "archive", access: "public", at })), ["old-public"]);
assert.ok(SLURP_ARCHIVE_MIN_AGE_MS >= 2 * DAY);
// A callback only shows its own shoot.
assert.deepEqual(ids(slurpReuseCandidates(posts, { kind: "shoot", access: "public", at, shootId: "shoot-1" })), [
  "shoot-public",
]);
assert.deepEqual(slurpReuseCandidates(posts, { kind: "shoot", access: "locked", at, shootId: null }), []);
// A preview is only ever a recent locked picture going into a public teaser.
assert.deepEqual(ids(slurpReuseCandidates(posts, { kind: "preview", access: "public", at })), [
  "fresh-locked",
  "shoot-locked",
]);
assert.deepEqual(slurpReuseCandidates(posts, { kind: "preview", access: "locked", at }), []);
assert.ok(SLURP_PREVIEW_MAX_AGE_MS <= 7 * DAY);
// Future-dated or unparseable rows are ignored rather than trusted.
assert.deepEqual(
  slurpReuseCandidates([{ ...post("future", "public", 0), createdAt: "not a date" }], {
    kind: "archive",
    access: "public",
    at,
  }),
  [],
);

// Deterministic pick, so a retry reuses the same picture.
const archive = slurpReuseCandidates(posts, { kind: "archive", access: "locked", at });
assert.equal(slurpPickReuse(archive, "creator-a", 4)?.id, slurpPickReuse(archive, "creator-a", 4)?.id);
assert.equal(slurpPickReuse([], "creator-a", 4), null);

// The crop keeps well under the whole picture and stays inside it.
for (const [width, height] of [
  [1024, 1536],
  [3, 3],
  [1, 1],
] as const) {
  const crop = slurpPreviewCrop(width, height);
  assert.ok(crop.width * crop.height <= Math.max(1, width * height * 0.25));
  assert.ok(crop.left + crop.width <= width && crop.top + crop.height <= height);
}

// Delivery: reuse only replaces a new picture, only when a real picture exists, and never
// touches a set, a Story, or a text post.
const none = { shoot: false, archive: false, preview: false };
const all = { shoot: true, archive: true, preview: true };
for (let sequence = 0; sequence < 200; sequence += 1) {
  for (const intent of ["casual", "teaser", "set", "callback", "business", "appreciation"] as const) {
    assert.deepEqual(slurpReuseDelivery({ intent, delivery: "new_capture" }, none, "creator-a", sequence), {
      intent,
      delivery: "new_capture",
    });
    const reused = slurpReuseDelivery({ intent, delivery: "new_capture" }, all, "creator-a", sequence);
    assert.ok(slurpDeliveryFits(reused.intent, reused.delivery), `${intent} cannot go out as ${reused.delivery}`);
    if (intent === "set") assert.equal(reused.delivery, "new_capture", "a set is new work");
    if (reused.delivery === "cropped_preview") assert.equal(intent, "teaser");
  }
  for (const delivery of ["text_only", "story"] as const) {
    assert.equal(slurpReuseDelivery({ intent: "casual", delivery }, all, "creator-a", sequence).delivery, delivery);
  }
}
const callbacks = Array.from({ length: 200 }, (_, sequence) =>
  slurpReuseDelivery({ intent: "callback", delivery: "new_capture" }, { ...none, shoot: true }, "creator-a", sequence),
);
assert.ok(
  callbacks.filter((axes) => axes.delivery === "existing_media").length > 80,
  "callbacks mostly show the shoot",
);
const casual = Array.from({ length: 400 }, (_, sequence) =>
  slurpReuseDelivery({ intent: "casual", delivery: "new_capture" }, { ...none, archive: true }, "creator-a", sequence),
).filter((axes) => axes.delivery === "existing_media").length;
assert.ok(casual > 0 && casual < 100, `archive reposts should be occasional, got ${casual}/400`);

// A callback's new picture keeps the drop's clothes and light when the brief is known.
const brief = slurpImageBrief({
  cameraInstruction: "Camera: tripod.",
  variation: slurpPostVariation("creator-a", 1),
  shoot: { place: "the kitchen", company: "alone", brief: "red dress, window light" },
});
assert.match(brief, /same clothes and light as this earlier picture: red dress, window light/u);
assert.doesNotMatch(
  slurpImageBrief({
    cameraInstruction: "Camera: tripod.",
    variation: slurpPostVariation("creator-a", 1),
    shoot: { place: "the kitchen", company: "alone" },
  }),
  /same clothes/u,
  "an unknown brief stays unknown",
);

// Wiring. Reused bytes are copied into the new post, never shared; a preview is cut on the server;
// a missing file falls back to a new picture; and the scheduled path stages the copy.
const service = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/slp/features/media/slp-media-reuse-service.ts",
);
assert.match(service, /preview: \(await getSharp\(\)\) \? pick\("preview"\) : null,/u, "no sharp, no preview");
assert.match(service, /if \(!sharp\) return null;/u);
assert.match(service, /\.extract\(slurpPreviewCrop\(meta\.width, meta\.height\)\)/u);
assert.match(service, /if \(!isAllowedImageBuffer\(original\)\) return null;/u);
const plan = slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/features/feed/slp-post-plan-service.ts");
assert.match(plan, /const axes = reuseKind && !reusedMedia \? drawnAxes : reusedAxes;/u);
assert.match(plan, /reusedMedia \? "reuse_media" : "publish"/u);
const generation = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/slp/features/feed/slp-generation-service.ts",
);
assert.match(generation, /const media = input\.media \?\? reusedMedia;/u);
assert.match(generation, /persistCreatorPostWithUploadedMedia\(account\.id, postId, media,/u);
assert.match(generation, /const postImages = imagesEnabled && !textOnly && !reusedMedia;/u);
assert.match(generation, /\.\.\.\(shootId \? \{ shootId \} : \{\}\),/u);
assert.match(generation, /brief: draftImagePrompt,/u);
assert.match(generation, /noodlerMediaPath: stagedReuse\.filePath/u);
const reserve = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/slp/features/feed/reserve/slp-reserve-operation.ts",
);
assert.match(reserve, /const \{ stagedMedia: reusedMedia, \.\.\.prepared \} = payload;/u);
assert.match(
  reserve,
  /let stagedMedia: \{ promote: \(\) => void; compensate: \(\) => void \} \| null = reusedMedia \?\? null;/u,
);

console.log("slurp media reuse regression checks passed");
