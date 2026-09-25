import assert from "node:assert/strict";
import { slurp2Source } from "./slurp2-source";

const route = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/slp/features/feed/slp-feed-viewer-routes.ts",
);
const storage = slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/data/feed/slp-feed-post-storage-1.ts");

assert.match(route, /listNoodlerStories\(\{/u);
assert.match(route, /storyLifetimeHours \* 60 \* 60 \* 1000/u);
assert.match(route, /creatorSearchAccountIds/u);
assert.match(route, /parsed\.data\.cursorAt\s*\?\s*\[\]/u);
assert.match(storage, /metadata\.noodlerPostType === "story"/u);
assert.match(storage, /gt\(slpPosts\.createdAt, options\.since\)/u);
assert.match(storage, /creatorMatches\.has\(post\.authorAccountId\)/u);
assert.match(storage, /\.limit\(batchSize\)/u);
assert.match(storage, /cursor\.createdAt/u);

console.log("slurp2 Moments retention regression passed");
