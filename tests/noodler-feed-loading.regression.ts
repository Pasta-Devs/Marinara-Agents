import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const hooks = readFileSync(
  "packages/noodle/src/engine/packages/client/src/hooks/use-noodle.ts",
  "utf8",
);
const viewerHook = hooks.slice(
  hooks.indexOf("export function useNoodlerViewer"),
  hooks.indexOf("export function useNoodleUnseenCount"),
);
const unseenHook = hooks.slice(
  hooks.indexOf("export function useNoodlerUnseenCount"),
  hooks.indexOf("export function useToggleNoodlerSubscription"),
);
assert.doesNotMatch(viewerHook, /refetchInterval/u);
assert.match(unseenHook, /noodler\/viewer\/unseen-count/u);
assert.match(unseenHook, /refetchInterval: enabled && personaId \? 30_000 : false/u);
assert.doesNotMatch(unseenHook, /useNoodlerViewer|NoodlerViewerScope/u);

const routes = readFileSync(
  "packages/noodle/src/engine/packages/server/src/routes/noodle.routes.ts",
  "utf8",
);
const unseenRoute = routes.slice(
  routes.indexOf('app.get("/noodler/viewer/unseen-count"'),
  routes.indexOf('app.get("/noodler/viewer"'),
);
assert.match(unseenRoute, /account\.noodleAccountId !== viewer\.id/u);
assert.match(unseenRoute, /!isNoodlerHiddenFromViewer\(account, viewer\.id\)/u);
assert.match(unseenRoute, /countNoodlerPostsByAccountsSince/u);
assert.doesNotMatch(unseenRoute, /buildViewerScope|listNoodlerPosts|listNoodlerInteractions/u);

const storage = readFileSync(
  "packages/noodle/src/engine/packages/server/src/services/storage/noodle.storage.ts",
  "utf8",
);
const countMethod = storage.slice(
  storage.indexOf("countNoodlerPostsByAccountsSince"),
  storage.indexOf("async getNoodlerPostById"),
);
assert.match(countMethod, /db\.count\(/u);
assert.match(countMethod, /gt\(noodlePosts\.createdAt, since\)/u);
assert.doesNotMatch(countMethod, /select\(|map\(/u);

const home = readFileSync(
  "packages/noodle/src/engine/packages/client/src/components/noodle/NoodlerHome.tsx",
  "utf8",
);
assert.match(home, /NOODLER_FEED_WINDOW_SIZE = 20/u);
assert.match(home, /feed\.slice\(0, visibleFeedCount\)/u);
assert.match(home, /searchResults\.slice\(0, visibleFeedCount\)/u);
assert.match(home, /count \+ NOODLER_FEED_WINDOW_SIZE/u);
assert.match(
  home,
  /\[authorProfile\?\.id, profileKey, scope\?\.viewer\.id, search, tab\]/u,
);
assert.match(home, /data-component="NoodlerHome\.LoadMoreFeed"/u);

console.log("NoodleR bounded feed and count-only badge regressions passed.");
