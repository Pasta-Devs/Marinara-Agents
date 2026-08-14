import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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
assert.match(home, /NOODLER_FEED_WINDOW_SIZE = 20/u);
assert.match(home, /feed\.slice\(0, visibleFeedCount\)/u);
assert.match(home, /searchResults\.slice\(0, visibleFeedCount\)/u);
assert.match(home, /count \+ NOODLER_FEED_WINDOW_SIZE/u);
assert.match(home, /data-component="NoodlerHome\.LoadMoreFeed"/u);

const unseenHelper = readFileSync(
  "packages/noodle/src/engine/packages/server/src/services/noodle/noodler-viewer-unseen.ts",
  "utf8",
);
assert.match(unseenHelper, /account\.noodleAccountId !== viewerAccountId/u);
assert.match(unseenHelper, /isNoodlerHiddenFromViewer\(account, viewerAccountId\)/u);

console.log("NoodleR bounded feed and lightweight unseen-count regressions passed.");
