import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const hooks = readFileSync("packages/slurp/src/engine/packages/client/src/hooks/use-slurp.ts", "utf8");
const unseenHook = hooks.slice(
  hooks.indexOf("export function useNoodlerUnseenCount"),
  hooks.indexOf("export function useToggleNoodlerSubscription"),
);
assert.match(unseenHook, /noodler\/viewer\/unseen-count/u);
assert.match(unseenHook, /refetchInterval: enabled && personaId \? 30_000 : false/u);
assert.doesNotMatch(unseenHook, /useNoodlerViewer/u);
assert.doesNotMatch(unseenHook, /NoodlerViewerScope/u);

assert.doesNotMatch(hooks, /useNoodle\(/u);
assert.match(hooks, /\/slurp\/noodler\/viewer\?personaId=/u);

const routes = readFileSync("packages/slurp/src/engine/packages/server/src/routes/slurp.routes.ts", "utf8");
const unseenRoute = routes.slice(
  routes.indexOf('app.get("/noodler/viewer/unseen-count"'),
  routes.indexOf('app.get("/noodler/viewer"'),
);
assert.match(unseenRoute, /noodlerUnseenCreatorAccountIds/u);
assert.match(unseenRoute, /getNoodlerViewerSignal/u);
assert.doesNotMatch(unseenRoute, /buildViewerScope/u);
assert.doesNotMatch(unseenRoute, /listNoodlerInteractions/u);
assert.match(routes, /listNoodlerPostPage/u);
assert.match(routes, /listSubscriptionsForCreatorPage/u);

const storage = readFileSync("packages/slurp/src/engine/packages/server/src/services/storage/slurp.storage.ts", "utf8");
assert.match(storage, /async listNoodlerPostPage/u);
assert.match(storage, /async listSubscriptionsForCreatorPage/u);
assert.match(storage, /async getNoodlerViewerSignal/u);

const postsHook = hooks.slice(
  hooks.indexOf("export function useNoodlerPosts"),
  hooks.indexOf("export function useCreateNoodlerStageProfile"),
);
assert.match(postsHook, /items: SlurpProfilePost\[\]/u);
assert.match(postsHook, /personaId: string \| null/u);
assert.match(postsHook, /page\.items/u);

const viewerHook = hooks.slice(
  hooks.indexOf("export function useNoodlerViewer"),
  hooks.indexOf("export function useNoodleUnseenCount"),
);
assert.match(viewerHook, /noodler\/viewer\/feed/u);
assert.match(viewerHook, /postsByCreator/u);
assert.match(viewerHook, /refetchOnMount: "always"/u);
assert.match(viewerHook, /while \(cursor\)[\s\S]*const scope = await api\.get<NoodlerViewerScope>/u);

const home = readFileSync("packages/slurp/src/engine/packages/client/src/components/slurp/SlurpHome.tsx", "utf8");
assert.match(home, /NOODLER_FEED_WINDOW_SIZE = 20/u);
assert.match(home, /feed\.slice\(0, visibleFeedCount\)/u);
assert.match(home, /searchResults\.slice\(0, visibleFeedCount\)/u);
assert.match(home, /count \+ NOODLER_FEED_WINDOW_SIZE/u);
assert.match(home, /data-component="SlurpHome\.LoadMoreFeed"/u);

const unseenHelper = readFileSync(
  "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-viewer-unseen.ts",
  "utf8",
);
assert.match(unseenHelper, /account\.kind === "persona" && account\.entityId === viewerAccountId/u);
assert.match(unseenHelper, /isNoodlerHiddenFromViewer\(account, viewerAccountId\)/u);

console.log("NoodleR bounded feed and lightweight unseen-count regressions passed.");
