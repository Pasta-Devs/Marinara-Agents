import assert from "node:assert/strict";
import { slurp2Source } from "./slurp2-source";

const route = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/slp/features/feed/slp-feed-viewer-routes.ts",
);

assert.match(route, /storyLifetimeHours \* 60 \* 60 \* 1000/u);
assert.match(route, /listNoodlerPostsByAccounts\(accounts\.map\(\(account\) => account\.id\), 50/u);
assert.doesNotMatch(route, /maxRows: 200/u, "the story read must not drop older active Moments under feed load");
assert.match(route, /post\.metadata\.noodlerPostType === "story"/u);
assert.match(route, /storyItems\.filter\(\(story\) => !page\.items\.some\(\(post\) => post\.id === story\.id\)\)/u);

console.log("slurp2 Moments retention regression passed");
