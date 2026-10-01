import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mapViewer } from "../packages/slurp2/src/engine/packages/server/src/slp/data/host/slp-storage-mappers";
import { garnishRotateInline } from "../packages/slurp2/src/engine/packages/server/src/services/garnish-ads/garnish-ads.rating";
import {
  canManageSlpReply,
  slpIsOwnActor,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-interactions";
import { slpStageProfileDraftRequestSchema } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-social.schema";

// Fix phase 1, batch B (REVIEW-1 features that did not work): R1-001, R1-002, R1-020, R1-028, R1-029,
// R1-046, R1-047, R1-063, R1-070, R1-083, R1-122, R1-135.
const pkg = join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages");
const read = (path: string) => readFileSync(join(pkg, path), "utf8");

// ── R1-001: the DM viewer carries the persona's About me (else its card description) ──
const settings = { social: {} } as never;
assert.equal(
  mapViewer("p1", settings, { name: "Gunter", aboutMe: "Night owl, loves ramen." }).bio,
  "Night owl, loves ramen.",
);
assert.equal(mapViewer("p1", settings, { name: "Gunter", aboutMe: "", description: "A tall guy." }).bio, "A tall guy.");
assert.equal(mapViewer("p1", settings, { name: "Gunter" }).bio, "");

// ── R1-002: the broadcast reaches the audience subscribers it counts ──
const creatorRoutes = read("server/src/slp/features/messages/slp-messages-creator-routes.ts");
assert.match(creatorRoutes, /population\.listTiesForCreator\(creatorAccountId\)/u);
assert.match(creatorRoutes, /SLURP_FUNNEL_STAGES\.indexOf\("subscriber"\)/u);
assert.match(creatorRoutes, /for \(const viewerAccountId of recipients\)/u);

// ── R1-020: likes, comments and votes under the persona's fan account are the player's own ──
const me = { id: "creator-of-persona", fanActorAccountId: "fan-row" };
assert.equal(slpIsOwnActor(me, "fan-row"), true);
assert.equal(slpIsOwnActor(me, "creator-of-persona"), true);
assert.equal(slpIsOwnActor(me, "someone-else"), false);
assert.equal(slpIsOwnActor({ id: "a" }, "fan-row"), false);
assert.equal(slpIsOwnActor(null, "a"), false);
assert.equal(
  canManageSlpReply({
    actorKind: "persona",
    actorAccountId: "fan-row",
    personaAccountId: "creator-of-persona",
    fanActorAccountId: "fan-row",
  }),
  true,
);
assert.equal(
  canManageSlpReply({ actorKind: "persona", actorAccountId: "fan-row", personaAccountId: "creator-of-persona" }),
  false,
);
assert.match(
  read("server/src/slp/features/viewer/slp-viewer-context.ts"),
  /viewerActorAccountId: context\.viewerActorAccountId/u,
);
assert.match(read("client/src/slp/app/slp-home-state.ts"), /fanActorAccountId: \(viewerQuery\.data as/u);
for (const file of [
  "client/src/slp/modules/post/SlpPostCard.tsx",
  "client/src/slp/modules/post/SlpPostReplyRow.tsx",
  "client/src/slp/modules/post/SlpReplyRow.tsx",
  "client/src/slp/app/screens/SlpScreenMoments.tsx",
]) {
  const source = read(file);
  assert.match(source, /slpIsOwnActor\(/u, file);
  assert.doesNotMatch(source, /interaction\.actorAccountId === (ctx\.)?personaAccount!?\.id/u, file);
}

// ── R1-028 / R1-135: share picker and G's thread mount once, for every screen (the age check is a
// card in the Support ticket now) ──
const host = read("client/src/slp/app/SlpHomeHost.tsx");
const overlays = host.slice(host.indexOf("    overlays: ("), host.indexOf("  } as const;"));
for (const piece of ["<SlpSharePostModal", "<SlurpSplash", "<ImagePromptReviewModal"])
  assert.ok(overlays.includes(piece), piece);
assert.equal(host.split("<SlpSharePostModal").length, 2, "mounted once");
assert.equal(host.split("<SlurpSplash").length, 2, "mounted once");

// ── R1-029: the post dialog keys its ⋯ menu and composer apart from the card behind it ──
const card = read("client/src/slp/modules/post/SlpPostCard.tsx");
assert.match(card, /const surfaceKey = hideImage \? `dialog:\$\{post\.id\}` : post\.id;/u);
assert.match(card, /const postMenuOpen = ctx\.postMenuId === surfaceKey;/u);
assert.match(card, /openReplyComposer\(post\.id, null, surfaceKey\)/u);
assert.match(read("client/src/slp/modules/post/SlpPostMenu.tsx"), /current === menuKey \? null : menuKey/u);

// ── R1-046: a deferred picture is retried and the flag clears on every final transition ──
assert.match(
  read("server/src/slp/data/feed/slp-feed-post-storage-1.ts"),
  /metadata\.imageGenerationFailed !== true && metadata\.imageGenerationDeferred !== true/u,
);
const postStorage2 = read("server/src/slp/data/feed/slp-feed-post-storage-2.ts");
assert.match(
  postStorage2,
  /delete mergedMetadata\.imagePendingReview;\s*delete mergedMetadata\.imageGenerationDeferred;/u,
);

// ── R1-047: closing the picture review ends the wait on the server ──
const reviewed = read("server/src/slp/features/media/slp-reviewed-images-service.ts");
assert.match(reviewed, /async cancelReviewedImages\(postIds: readonly string\[\]\)/u);
assert.match(reviewed, /imageRetryAttempts: SLP_CREATOR_POST_IMAGE_RETRY_LIMIT/u);
assert.match(
  read("server/src/slp/features/feed/slp-feed-publishing-routes.ts"),
  /app\.post\("\/slurp\/refresh\/images\/cancel"/u,
);
assert.match(host, /onCancel=\{cancelReviewedImagePrompts\}/u);

// ── R1-063: every Creator's storylines are managed in its own settings ──
const storylines = read("client/src/slp/features/creators/settings/SlpCreatorStorylinesSection.tsx");
assert.match(
  storylines,
  /<SlurpProjectsPanel personaId=\{personaId\} creatorAccountId=\{creator\.id\} otherCreators=\{others\} \/>/u,
);

// ── R1-070: the redraft request accepts the whole editor form ──
const draft = slpStageProfileDraftRequestSchema.safeParse({
  noodleAccountId: "c1",
  disclosureMode: "open",
  currentDraft: { displayName: "Mira", gender: "female", tags: ["cosplay"], location: "Lisbon" },
});
assert.equal(draft.success, true);

// ── R1-083: a small pool rotates instead of emptying ──
const pool = [{ id: "a" }, { id: "b" }, { id: "c" }];
assert.deepEqual(
  garnishRotateInline(pool, []).map((ad) => ad.id),
  ["a", "b"],
);
assert.deepEqual(
  garnishRotateInline(pool, ["b", "a"]).map((ad) => ad.id),
  ["c", "a"],
  "fresh first, then the oldest served",
);
assert.deepEqual(
  garnishRotateInline(pool, ["c", "a", "b"]).map((ad) => ad.id),
  ["b", "a"],
  "all served: oldest first",
);
assert.equal(garnishRotateInline(pool, ["a", "b", "c"]).length, 2, "never empty while ads exist");

// ── R1-122: a Creator's DM picture follows its own Images switch ──
const operation = read("server/src/slp/features/messages/slp-message-operation.ts");
assert.match(
  operation,
  /const imageAllowedBySettings = demanded \|\| creator\.settings\.scheduler\.autoPosting\?\.imagesEnabled === true;/u,
);
assert.doesNotMatch(operation, /settings\.enableImagePrompts === true/u);

console.log("slurp2 fix1 broken features regression passed");
