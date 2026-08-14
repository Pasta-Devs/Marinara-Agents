import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { NoodleAccount } from "@marinara-engine/shared";
import {
  nextNoodlerFeedLimit,
  NOODLER_FEED_PAGE_SIZE,
} from "../packages/noodle/src/engine/packages/client/src/components/noodle/noodler-feed-window";
import {
  countBoundedNoodlerPostAuthors,
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
assert.equal(
  countBoundedNoodlerPostAuthors([
    ...Array.from({ length: 45 }, () => "creator-a"),
    ...Array.from({ length: 3 }, () => "creator-b"),
  ]),
  43,
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

const routes = readFileSync(
  "packages/noodle/src/engine/packages/server/src/routes/noodle.routes.ts",
  "utf8",
);
const unseenRoute = routes.slice(
  routes.indexOf('app.get("/noodler/viewer/unseen-count"'),
  routes.indexOf('app.get("/noodler/viewer"'),
);
assert.match(unseenRoute, /noodlerUnseenCreatorAccountIds/u);
assert.match(unseenRoute, /countNoodlerPostsByAccountsSince/u);
assert.doesNotMatch(unseenRoute, /buildViewerScope/u);
assert.doesNotMatch(unseenRoute, /listNoodlerInteractions/u);

const home = readFileSync(
  "packages/noodle/src/engine/packages/client/src/components/noodle/NoodlerHome.tsx",
  "utf8",
);
assert.match(
  home,
  /setVisibleFeedLimit\(NOODLER_FEED_PAGE_SIZE\);[\s\S]*\[discoveryOpen, scope\?\.viewer\.id, searchTerm, tab\]/u,
);
assert.match(home, /const pagedFeed = feed\.slice\(0, visibleFeedLimit\)/u);
assert.match(
  home,
  /data-component="NoodlerHome\.LoadMoreFeed"[\s\S]*nextNoodlerFeedLimit\(current, feed\.length\)/u,
);
assert.match(
  home,
  /data-component="NoodlerProfile\.LoadMorePosts"[\s\S]*nextNoodlerFeedLimit\(current, visiblePosts\.length\)/u,
);

console.log("NoodleR bounded feed and lightweight unseen-count regressions passed.");
