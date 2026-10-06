import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  pickSlurpFeaturedCreators,
  slurpDiscoverRowTags,
  slurpDiscoverSheetFilterCount,
  SLURP_DISCOVER_PRICE_BANDS,
  filterAndSortSlurpCreators,
} from "../packages/slurp2/src/engine/packages/client/src/slp/features/discovery/slp-discovery";
import { slurpCreatorCoverUrl } from "../packages/slurp2/src/engine/packages/client/src/slp/modules/creator/slp-creator-cover";

// Redesign step 5 (Discover & search): Featured carousel + 2-column Creator grid (no layout toggle),
// one chip row + a Filters sheet with a count, Creators-first search with one clear button (B11),
// honest loading/error, ads as native posts in the feed and Discover, one-tap Subscribe with the
// spend moment, and the rails in the same card language.
const root = join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages/client/src/slp");
const client = (path: string) => readFileSync(join(root, path), "utf8");

const creator = (id: string, tags: string[], likes: number[], extra: Record<string, unknown> = {}) => ({
  profile: { id, displayName: id, handle: id, tags, ...extra },
  subscribed: false,
  subscriptionPrice: 30,
  posts: likes.map((likeCount) => ({ likeCount })),
});

// ── Chip row tags: the most common first, ties by name, capped ──
const crowd = [
  creator("a", ["beach", "art"], []),
  creator("b", ["art", "city"], []),
  creator("c", ["art", "beach", "zen"], []),
];
assert.deepEqual(slurpDiscoverRowTags(crowd), ["art", "beach", "city", "zen"]);
assert.deepEqual(slurpDiscoverRowTags(crowd, 2), ["art", "beach"]);
assert.deepEqual(slurpDiscoverRowTags([]), []);

// ── The Filters chip counts only what the row cannot show ──
const none = {
  notSubscribed: false,
  genders: new Set<never>(),
  tags: new Set<string>(),
  minimumPrice: null,
  maximumPrice: null,
  sort: "recommended" as const,
};
assert.equal(slurpDiscoverSheetFilterCount(none, ["art"]), 0);
assert.equal(
  slurpDiscoverSheetFilterCount({ ...none, tags: new Set(["art"]) }, ["art"]),
  0,
  "a row tag shows in the row",
);
assert.equal(
  slurpDiscoverSheetFilterCount({ ...none, tags: new Set(["art", "zen"]) }, ["art"]),
  1,
  "a sheet-only tag counts",
);
assert.equal(
  slurpDiscoverSheetFilterCount(
    {
      ...none,
      notSubscribed: true,
      genders: new Set(["female", "male"] as never[]),
      maximumPrice: 25,
      sort: "subscribed",
    },
    [],
  ),
  5,
);
assert.equal(slurpDiscoverSheetFilterCount({ ...none, sort: "newest" }, []), 0, "New / Popular live in the row");

// ── Price bands line up with the inclusive filter and never overlap ──
const priced = [20, 25, 26, 40, 41, 90].map((price) => ({ ...creator(`p${price}`, [], []), subscriptionPrice: price }));
const band = (id: string) => {
  const b = SLURP_DISCOVER_PRICE_BANDS.find((entry) => entry.id === id)!;
  return filterAndSortSlurpCreators(
    priced,
    {
      search: "",
      notSubscribed: false,
      genders: new Set(),
      tags: new Set(),
      minimumPrice: b.minimum,
      maximumPrice: b.maximum,
      sort: "recommended",
    },
    {},
  ).map((entry) => entry.subscriptionPrice);
};
assert.deepEqual(band("low"), [20, 25]);
assert.deepEqual(band("mid"), [26, 40]);
assert.deepEqual(band("high"), [41, 90]);

// ── Featured: most liked first, stable on ties, capped ──
const liked = [creator("x", [], [1]), creator("y", [], [10, 5]), creator("z", [], [1]), creator("w", [], [])];
assert.deepEqual(
  pickSlurpFeaturedCreators(liked).map((entry) => entry.profile.id),
  ["y", "x", "z", "w"],
);
assert.deepEqual(
  pickSlurpFeaturedCreators(liked, 2).map((entry) => entry.profile.id),
  ["y", "x"],
);

// ── Card cover: banner, else the newest free picture, never a Story or a locked post ──
assert.equal(slurpCreatorCoverUrl({ profile: { bannerUrl: "/banner" }, posts: [{ imageUrl: "/p" }] }), "/banner");
assert.equal(
  slurpCreatorCoverUrl({
    profile: {},
    posts: [
      { imageUrl: "/old", createdAt: "2026-09-01T00:00:00Z" },
      { imageUrl: "/new", createdAt: "2026-09-20T00:00:00Z" },
      { imageUrl: "/locked", locked: true, createdAt: "2026-09-25T00:00:00Z" },
      { imageUrl: "/story", story: true, createdAt: "2026-09-26T00:00:00Z" },
      { imageUrl: "/story2", metadata: { noodlerPostType: "story" }, createdAt: "2026-09-26T00:00:00Z" },
    ],
  }),
  "/new",
);
assert.equal(slurpCreatorCoverUrl({ profile: { bannerUrl: null }, posts: [] }), null);

// ── Source pins ──
const discover = client("app/screens/SlpHubDiscover.tsx");
const hub = client("app/screens/SlpScreenHub.tsx");
const toolbar = client("features/discovery/SlpDiscoverToolbar.tsx");
const card = client("modules/creator/SlpCreatorProfileCard.tsx");
const ad = client("features/ads/SlpInlineAd.tsx");

// No layout toggle any more.
assert.doesNotMatch(hub, /discoverLayout|slurp2\.discover\.layout/u);
assert.doesNotMatch(toolbar, /SlpSegment|LayoutGrid/u);
assert.doesNotMatch(discover, /Find your next|ui\.slurp\.discover\.title/u, "the marketing hero is gone");
// Featured carousel (snap + dots) and the 2-column grid.
assert.match(discover, /aria-roledescription="carousel"/u);
assert.match(discover, /snap-x snap-mandatory/u);
assert.match(discover, /grid grid-cols-2/u);
assert.match(card, /layout === "featured"/u);
assert.match(card, /<SlpGlint \/>/u);
// Story ring on card avatars: every Creator with a Story inside the lifetime, on either feed tab.
// T: the ring comes from the shared Story-ring context (new / seen / none), see slurp2-t-polish.
assert.match(card, /<SlpStoryRingAvatar creatorId=\{profile\.id\}/u);
assert.match(
  client("app/screens/slp-hub-view.ts"),
  /isSlurpStory\(post\) && new Date\(post\.createdAt\)\.getTime\(\) >= cutoff/u,
);
assert.match(client("app/screens/slp-hub-view.ts"), /export function slurpLiveStories\(/u);
// One-tap Subscribe with the spend moment; step 6.5: cancel is one tap + an Undo toast.
assert.match(card, /playSlpSpendMoment\(origin\)/u);
assert.match(card, /showSlpSubscriptionCancelledToast/u);
assert.doesNotMatch(card, /showConfirmDialog/u);
// Filters: chip row + one sheet, count on the chip, selected = SlpChip (tint + ring).
assert.match(toolbar, /role="toolbar"/u);
assert.match(toolbar, /<SlpSheet open=\{sheetOpen\}/u);
assert.match(toolbar, /sheetFilterCount > 0/u);
assert.doesNotMatch(toolbar, /<details|<select|type="checkbox"/u, "no raw popovers, selects or checkboxes");
// Search: Creators first, then posts, one empty state only when both are empty; one clear button.
assert.ok(discover.indexOf("slurp-search-creators") < discover.indexOf("slurp-search-posts"));
assert.match(discover, /creators\.length === 0 && searchResults\.length === 0 \?/u);
assert.match(discover, /\[&::-webkit-search-cancel-button\]:hidden/u);
// Honest states.
assert.match(discover, /<SlpSkeleton\s+shape="creators"/u);
assert.match(discover, /<SlpErrorState/u);
assert.match(hub, /isLoading=\{isLoading && !scope\}/u);
// Ads: one native post card for feed and Discover; quiet sentence-case chip; hide in the ⋯ sheet.
assert.match(hub, /discoverAd=\{/u);
assert.match(hub, /return renderInlineAd\(ad\)/u);
assert.match(ad, /slpTagClass\(\)\}>\{labels\.sponsored\}/u);
assert.doesNotMatch(ad, /uppercase/u);
// R11 (0.3.18): the button opens the ad sheet, which records the tap.
assert.match(ad, /<SlpButton variant="secondary" onClick=\{show\}/u);
assert.match(ad, /kind="menu"/u);
// Rails and the suggested row use the same card.
assert.match(client("app/screens/SlpScreenSubscriptions.tsx"), /layout="row"/u);
assert.match(client("app/screens/SlpHomeFeedRail.tsx"), /SLP_RAIL_GROUP_CLASS/u);
assert.match(client("app/screens/SlpScreenSuggestedCreators.tsx"), /<SlurpCreatorProfileCard/u);

console.log("slurp2 step 5 discover: ok");
