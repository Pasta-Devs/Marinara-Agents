import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { NoodleAccount } from "@marinara-engine/shared";
import {
  nextNoodlerFeedLimit,
  NOODLER_FEED_PAGE_SIZE,
} from "../packages/noodle/src/engine/packages/client/src/components/noodle/noodler-feed-window";
import {
  normalizeNoodlerSeenAt,
  noodlerUnseenCreatorAccountIds,
} from "../packages/noodle/src/engine/packages/server/src/services/noodle/noodler-viewer-unseen";

assert.equal(NOODLER_FEED_PAGE_SIZE, 20);
let visible = NOODLER_FEED_PAGE_SIZE;
const windows = [visible];
while (visible < 95) {
  const next = nextNoodlerFeedLimit(visible, 95);
  assert.ok(next > visible);
  assert.ok(next - visible <= NOODLER_FEED_PAGE_SIZE);
  visible = next;
  windows.push(visible);
}
assert.deepEqual(windows, [20, 40, 60, 80, 95]);
assert.equal(nextNoodlerFeedLimit(20, 7), 7);
assert.equal(nextNoodlerFeedLimit(40, 40), 40);

const account = (
  id: string,
  noodleAccountId: string | null,
  hiddenFromAccountIds: string[] = [],
) =>
  ({
    id,
    noodleAccountId,
    settings: { privacy: { access: { hiddenFromAccountIds } } },
  }) as NoodleAccount;
assert.deepEqual(
  noodlerUnseenCreatorAccountIds(
    [
      account("visible", "someone-else"),
      account("own", "viewer"),
      account("hidden", "someone-else", ["viewer"]),
    ],
    "viewer",
  ),
  ["visible"],
);
assert.equal(normalizeNoodlerSeenAt(undefined), null);
assert.equal(normalizeNoodlerSeenAt("not-a-date"), null);
assert.equal(
  normalizeNoodlerSeenAt("2026-08-14T10:00:00+02:00"),
  "2026-08-14T08:00:00.000Z",
);

const hooks = readFileSync(
  "packages/noodle/src/engine/packages/client/src/hooks/use-noodle.ts",
  "utf8",
);
const unseenHook = hooks.slice(
  hooks.indexOf("export function useNoodlerUnseenCount"),
  hooks.indexOf("export function useToggleNoodlerSubscription"),
);
assert.match(unseenHook, /noodler\/viewer\/unseen-count/u);
assert.match(unseenHook, /refetchInterval: enabled && personaId \? 30_000 : false/u);
assert.doesNotMatch(unseenHook, /useNoodlerViewer/u);
assert.doesNotMatch(unseenHook, /NoodlerViewerScope/u);

const bootstrapHook = hooks.slice(
  hooks.indexOf("export function useNoodle"),
  hooks.indexOf("export function useRerollAmbientNoodleProfiles"),
);
// The bootstrap request starts only after the first marker response. A failed marker still opens
// the bootstrap path because React Query settles pending requests on both success and error.
assert.match(bootstrapHook, /enabled: enabled && !refreshIndicator\.isPending/u);
assert.match(bootstrapHook, /qc\.invalidateQueries\(\{ queryKey: noodleKeys\.bootstrap\(\) \}\)/u);

const routes = readFileSync(
  "packages/noodle/src/engine/packages/server/src/routes/noodle.routes.ts",
  "utf8",
);
const unseenRoute = routes.slice(
  routes.indexOf('app.get("/noodler/viewer/unseen-count"'),
  routes.indexOf('app.get("/noodler/viewer"'),
);
assert.match(unseenRoute, /noodlerUnseenCreatorAccountIds/u);
assert.match(unseenRoute, /getNoodlerViewerSignal/u);
assert.doesNotMatch(unseenRoute, /buildViewerScope/u);
assert.doesNotMatch(unseenRoute, /listNoodlerInteractions/u);

const home = readFileSync(
  "packages/noodle/src/engine/packages/client/src/components/noodle/NoodlerHome.tsx",
  "utf8",
);
// The feed and a Creator's post list are server-paged: each "Load more" fetches the next keyset
// page rather than widening a client-side slice of everything already downloaded. That is the
// whole point of bounding feed loading, so a regression to slice-the-world must fail here.
assert.match(
  home,
  /data-component="NoodlerHome\.LoadMoreFeed"[\s\S]{0,200}onClick=\{onLoadMoreFeed\}/u,
);
assert.match(home, /onLoadMoreFeed=\{\(\) => void feedQuery\.fetchNextPage\(\)\}/u);
assert.match(
  home,
  /data-component="NoodlerProfile\.LoadMorePosts"[\s\S]{0,200}void postsQuery\.fetchNextPage\(\)/u,
);
// Neither list may go back to holding the entire history in component state.
assert.doesNotMatch(home, /setVisibleFeedLimit/u);

// The client-side window still governs the lists that are not server-paged — Creator profiles in
// settings and the source picker — and both reset to one page when their filter changes.
assert.match(
  home,
  /data-component="NoodlerHome\.LoadMoreStageProfiles"[\s\S]{0,220}nextNoodlerFeedLimit\(/u,
);
assert.match(home, /setStageProfileLimit\(NOODLER_FEED_PAGE_SIZE\);/u);
assert.match(home, /setVisibleSourceLimit\(NOODLER_FEED_PAGE_SIZE\);\s*\}, \[kind, search\]\);/u);

// The 30-second signal query must stay cheap: ids and timestamps only, never post bodies, media,
// prompts, or metadata.
const storage = readFileSync(
  "packages/noodle/src/engine/packages/server/src/services/storage/noodle.storage.ts",
  "utf8",
);
const signal = storage.slice(
  storage.indexOf("async getNoodlerViewerSignal("),
  storage.indexOf("async getNoodlerViewerSignal(") + 2600,
);
const projection = signal.slice(signal.indexOf(".select({"), signal.indexOf(".from(noodlePosts)"));
assert.match(projection, /id: noodlePosts\.id/u);
assert.match(projection, /accountId: noodlePosts\.authorAccountId/u);
assert.doesNotMatch(projection, /content|imageUrl|imagePrompt|metadata|title/u);

const fanInteraction = storage.slice(
  storage.indexOf("async createNoodlerFanInteraction("),
  storage.indexOf("async deleteNoodlerInteraction("),
);
assert.match(fanInteraction, /postRow\.access !== "public" && postRow\.access !== "locked"/u);

console.log("NoodleR bounded feed and lightweight unseen-count regressions passed.");
