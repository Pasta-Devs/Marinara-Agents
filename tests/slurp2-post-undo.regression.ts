import assert from "node:assert/strict";
import { slurp2Source } from "./slurp2-source";

const storage = slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/data/feed/slp-feed-post-storage-2.ts");
const sweep = storage.slice(storage.indexOf("listExpiredDeletedNoodlerPostIds"));
assert.match(sweep, /slurpDeletedAt/u, "legacy undo records must still be eligible for cleanup");

const hooks = slurp2Source("packages/slurp2/src/engine/packages/client/src/slp/features/feed/slp-feed-post-hooks.ts");
const remove = hooks.slice(hooks.indexOf("export function useDeleteCreatorPost"));
assert.doesNotMatch(remove, /setTimeout|expiresAt|restore/u, "post deletion must not create an undo countdown");
assert.match(remove, /posts: creator\.posts\.filter\(\(post\) => post\.id !== input\.id\)/u);

const routes = slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/features/feed/slp-feed-post-routes.ts");
assert.match(
  routes,
  /tryCreatorAccountOperation\(existing\.authorAccountId, async \(\) =>[\s\S]*?noodle\.deleteNoodlerPost\(id\)/u,
);
assert.doesNotMatch(routes, /softDeleteNoodlerPost|restoreNoodlerPost/u);
assert.match(routes, /mediaPaths: \[readCreatorMediaPath\(current\), \.\.\.attachments\.map/u);
assert.match(
  storage,
  /delete\(slpPostUnlocks\).*?delete\(slpInteractions\).*?delete\(slpPostMedia\).*?delete\(slpPosts\)/su,
);

const helpers = slurp2Source("packages/slurp2/src/engine/packages/client/src/slp/app/screens/SlpHomeHelpers.tsx");
assert.match(helpers, /<SlpPostCard post=\{post\} ctx=\{ctx\} surface="profile" hideImage \/>/u);
assert.doesNotMatch(helpers, /imageUrl: null, images: \[\]/u);
const hub = slurp2Source("packages/slurp2/src/engine/packages/client/src/slp/app/screens/SlpScreenHub.tsx");
assert.doesNotMatch(hub, /SlpDeletedPostSlot|deletedPostIds|onRestorePost/u);

for (const file of [
  "packages/slurp2/src/engine/packages/client/src/slp/app/slp-home-post-actions.ts",
  "packages/slurp2/src/engine/packages/client/src/slp/features/feed/slp-feed-post-hooks.ts",
]) {
  assert.doesNotMatch(slurp2Source(file), /setQueriesData<[^>]*>\(\s*slpKeys\./u);
}

console.log("slurp2 immediate post deletion regression passed");
