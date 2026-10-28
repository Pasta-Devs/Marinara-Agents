import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  holdNewSlpFeedPosts,
  mergeSlpFeedFirstPage,
  newestSlpFeedTime,
} from "../packages/slurp2/src/engine/packages/client/src/slp/features/feed/slp-feed-refresh";

// Redesign step 3.1: shell polish after the user's real-phone test (see-through nav, content behind
// the nav, list ends clear it, slower bar motion, no refresh action, smooth images, no canvas motes).
const slp = join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages/client/src/slp");
const src = (path: string) => readFileSync(join(slp, path), "utf8");
const shell = src("modules/chrome/SlpShell.tsx");
const chrome = src("base/chrome/SlpChrome.tsx");
const motion = src("base/chrome/slp-motion.ts");
const hub = src("app/screens/SlpScreenHub.tsx");
const host = src("app/SlpHomeHost.tsx");
const entry = src("slp-client-entry.tsx");
const viewerHooks = src("features/feed/slp-feed-viewer-hooks.ts");
const sparkle = src("modules/sparkle/SlpSparkle.tsx");
const sparkleStyles = src("modules/sparkle/slp-sparkle-styles.ts");
const en = JSON.parse(src("locales/en.json")) as Record<string, string>;

// Refetch merge, run for real: page one comes from the server, the pages loaded with "Load more" stay.
const at = (minutes: number) => new Date(Date.UTC(2026, 8, 26, 12, 0) - minutes * 60_000).toISOString();
const scope = (posts: Record<string, [string, number][]>, nextCursor: unknown) => ({
  creators: Object.entries(posts).map(([id, list]) => ({
    profile: { id },
    posts: list.map(([postId, minutes]) => ({ id: postId, createdAt: at(minutes) })),
  })),
  nextCursor,
});
const cached = scope(
  {
    a: [
      ["a1", 10],
      ["a2", 20],
      ["a-old", 500],
    ],
    b: [
      ["b1", 15],
      ["b-old", 600],
    ],
  },
  "cursor-3",
);
// A new post arrived (a0), a2 left page one, and page one now reaches back to minute 30.
const fresh = scope(
  {
    a: [
      ["a0", 1],
      ["a1", 10],
    ],
    b: [
      ["b1", 15],
      ["b2", 30],
    ],
  },
  "cursor-1",
);
const merged = mergeSlpFeedFirstPage(cached, fresh);
assert.deepEqual(
  merged.creators.map((creator) => creator.posts.map((post) => post.id)),
  [
    ["a0", "a1", "a-old"],
    ["b1", "b2", "b-old"],
  ],
  "loaded older pages survive a poll; a post gone from page one disappears",
);
assert.equal(merged.nextCursor, "cursor-3", "the cursor after the loaded pages is kept");
assert.equal(mergeSlpFeedFirstPage(undefined, fresh), fresh, "first load is the fresh page");
const onlyPage = scope({ a: [["a0", 1]] }, null);
assert.equal(mergeSlpFeedFirstPage(cached, onlyPage), onlyPage, "no further page: the fresh page is the whole feed");
const noLoadedPages = scope({ a: [["a1", 10]] }, "c");
const freshSame = scope(
  {
    a: [
      ["a0", 1],
      ["a1", 10],
    ],
  },
  "c2",
);
assert.equal(mergeSlpFeedFirstPage(noLoadedPages, freshSame), freshSame, "nothing loaded beyond page one");

// New posts wait behind the pill until the reader takes them.
const feed = [
  { post: { createdAt: at(1) }, id: "new" },
  { post: { createdAt: at(10) }, id: "seen1" },
  { post: { createdAt: at(20) }, id: "seen2" },
];
assert.equal(newestSlpFeedTime(feed), new Date(at(1)).getTime());
assert.equal(newestSlpFeedTime([]), null);
const split = holdNewSlpFeedPosts(feed, new Date(at(10)).getTime());
assert.deepEqual(
  split.held.map((item) => item.id),
  ["new"],
);
assert.deepEqual(
  split.shown.map((item) => item.id),
  ["seen1", "seen2"],
);
assert.equal(holdNewSlpFeedPosts(feed, null).shown.length, 3, "no mark yet: everything shows");

// Point 5: no refresh action; new posts are checked every 30 s (not in the background) and use the pill.
// 0.3.6: the cheap unseen count polls at 30 s and refreshes the feed on a change; the full feed polls slowly.
assert.match(viewerHooks, /refetchInterval: enabled && personaId \? 180_000 : false,/u);
assert.doesNotMatch(hub, /onRefresh|isRefreshing|headerMenuRef|RefreshCw/u);
assert.doesNotMatch(host, /onRefresh=|isRefreshing=/u);
assert.match(
  viewerHooks,
  /refetchInterval: enabled && personaId \? 30_000 : false,\s*refetchIntervalInBackground: false/u,
);
// Fix phase 1 (R1-023): the cached feed is read once, and a post action asks for one deep reload.
assert.match(viewerHooks, /return deep \? fresh : mergeSlpFeedFirstPage\(cached/u);
assert.match(
  hub,
  /holdNewSlpFeedPosts\(\s*fullFeed,\s*!searchTerm && feedMark\?\.key === feedMarkKey \? feedMark\.at : null,/u,
);
assert.match(hub, /data-component="SlurpHome\.NewPosts"/u);
assert.match(hub, /sticky top-\[68px\] z-20 flex h-0/u, "the pill floats without moving the feed");
assert.match(hub, /aria-live="polite"/u);
assert.equal(en["ui.slurp.feed.newPosts_one"], "{{count}} new post");
assert.equal(en["ui.slurp.feed.newPosts_other"], "{{count}} new posts");

// Points 1–3: one bar glass; no reserved padding in the shell; list ends and bottom bars keep the room.
assert.match(
  chrome,
  /export const SLP_BAR_GLASS_CLASS =\s*"bg-\[color-mix\(in_srgb,var\(--noodle-accent\)_6%,var\(--slurp-glass\)\)\] backdrop-blur-xl";/u,
);
const nav = shell.slice(shell.indexOf("<nav\n          ref={setMobileNav}"));
assert.match(nav, /SLP_BAR_GLASS_CLASS/u);
assert.match(hub, /data-component="SlurpHome\.StickyHeader"/u);
assert.match(hub, /SLP_BAR_GLASS_CLASS,\s*HIDE_ON_SCROLL_CLASS/u);
assert.doesNotMatch(shell, /pb-\[calc\(66px/u, "no space reserved for the nav under every screen");
assert.match(shell, /\[--slp-nav-space:calc\(3\.5rem\+22px\+var\(--slurp-bottom-safe-inset\)\)\]/u);
assert.match(shell, /@min-\[1024px\]:\[--slp-nav-space:0px\]/u);
assert.match(
  entry,
  /\.slp-page-scroll:not\(:has\(\.slp-page-scroll\)\)::after \{[^}]*height: var\(--slp-nav-space, 0px\)/u,
);
for (const [file, count] of [
  ["app/screens/SlpScreenHub.tsx", 1],
  ["app/screens/SlpHubDiscover.tsx", 1],
  ["app/screens/SlpHomeCreatorFlow.tsx", 1],
  ["app/screens/SlpHomeHelpers.tsx", 1],
  ["app/screens/SlpHomeDestinations.tsx", 1],
  ["app/screens/SlpScreenMessages.tsx", 1],
  ["features/messages/SlpMessages.tsx", 1],
  ["app/backstage/SlpBackstageShell.tsx", 1],
  ["app/SlpHomeHost.tsx", 1],
] as const) {
  assert.equal(
    (src(file).match(/overflow-y-auto[^"]*", SLP_PAGE_SCROLL_CLASS|SLP_PAGE_SCROLL_CLASS,\s*\)/gu) ?? []).length,
    count,
    file,
  );
}
assert.match(src("features/messages/SlpThreadComposer.tsx"), /mb-\[var\(--slp-nav-live,0px\)\]/u);
assert.match(src("features/creators/SlpStageProfileForm.tsx"), /sticky bottom-\[var\(--slp-nav-live,0px\)\]/u);

// Point 4: slower, softer bars (design easing); reduced motion keeps them still. Fix phase 1b (user on a
// phone): 360 ms still felt abrupt, the glide is now 450–550 ms.
const bar = Number(motion.match(/bar: (\d+),/u)?.[1]);
assert.ok(bar >= 450 && bar <= 550, `bar motion ${bar} ms`);
// Onboarding pass 2 (user): the bars glide on their own even ease-in-out, not the front-loaded design ease.
assert.match(chrome, /bar\.style\.transition = `transform \$\{SLP_MOTION\.bar\}ms \$\{SLP_MOTION\.barEase\}`/u);
assert.match(motion, /barEase: "cubic-bezier\(0\.37, 0, 0\.63, 1\)"/u);
assert.match(chrome, /if \(!scroller \|\| !bar \|\| reduceMotion\) return;/u);

// Point 6: pictures wait in a shimmering frame, then fade in and un-blur; the image rules stay at zero
// specificity so a picture's own opacity/blur wins.
assert.match(
  chrome,
  /export const slpImgFade = \{ "data-slp-fade": "", onLoad: markSlpImgLoaded, onError: markSlpImgLoaded \}/u,
);
assert.match(entry, /:where\(img\[data-slp-fade\]\) \{\s*opacity: 0; filter: blur\(12px\);/u);
assert.match(entry, /:where\(img\[data-slp-fade\]\[data-slp-loaded\]\) \{ opacity: 1; filter: none; \}/u);
assert.match(entry, /\.slp-img-frame:not\(:has\(> img\[data-slp-loaded\]\)\) \{/u);
assert.match(entry, /prefers-reduced-motion: reduce\) \{\s*:where\(img\[data-slp-fade\]\) \{ filter: none;/u);
for (const file of [
  // V: the post card's picture moved into its adaptive frame component.
  "modules/post/SlpPostMediaFrame.tsx",
  "app/screens/SlpHomeHelpers.tsx",
  "app/screens/SlpScreenMoments.tsx",
  "modules/story/SlpStoryTile.tsx",
  "app/screens/SlpScreenProfile.tsx",
  "modules/post/SlpLockedMedia.tsx",
  "base/media/SlpPostImageCropEditor.tsx",
]) {
  assert.match(src(file), /\{\.\.\.slpImgFade\}/u, file);
}
// Avatars: initials hold the frame until the picture arrives (and stay if it fails).
assert.match(
  chrome,
  /if \(account\.avatarUrl\) \{[\s\S]*?SLP_IMG_FRAME_CLASS[\s\S]*?data-slp-img-placeholder[\s\S]*?\{\.\.\.slpImgFade\}/u,
);
assert.match(
  chrome,
  /<img key=\{resolved\} src=\{resolved\} \{\.\.\.slpImgFade\} \{\.\.\.props\} \/>/u,
  "SlurpMediaImg fades by default",
);

// Point 7: no canvas motes anywhere; sparkle stays on signature surfaces, rewards and story rings.
assert.doesNotMatch(shell, /SlpCanvasMotes/u);
assert.doesNotMatch(sparkle, /SlpCanvasMotes|slp-motes/u);
assert.doesNotMatch(sparkleStyles, /slp-motes|MOTES_|slp-drift/u);
assert.match(sparkle, /export function SlpShimmer/u);
assert.match(sparkle, /export function SlpRingGlint/u);

console.log("slurp2 step 3.1 shell polish: ok");
