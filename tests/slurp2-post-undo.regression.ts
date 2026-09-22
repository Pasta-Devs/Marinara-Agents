import assert from "node:assert/strict";
import { slurp2Source } from "./slurp2-source";

// Deleting a post is undoable for a grace window. Three things have to line up or Restore
// misbehaves: the server must not purge inside the window the client offers, the restore
// mutation must not hold the UI on a refetch, and the reopened dialog must not redraw the image.

const storage = slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/data/feed/slp-feed-post-storage-2.ts");
const sweep = storage.slice(storage.indexOf("listExpiredDeletedNoodlerPostIds"));
const grace = /Date\.parse\(deletedAt\) \+ (\d[\d_]*) <= at/u.exec(sweep);
assert.ok(grace, "the sweeper must purge on the recorded deletion time");
// The client offers Restore for 60s from when its delete call returned, and the sweeper itself
// only runs once a minute. Purging at 60s raced the user's own undo and answered it with a 409.
assert.ok(Number(grace[1].replaceAll("_", "")) >= 120_000, "the purge grace must outlast the offered undo window");

const hooks = slurp2Source("packages/slurp2/src/engine/packages/client/src/slp/features/feed/slp-feed-post-hooks.ts");
const restore = hooks.slice(hooks.indexOf("export function useRestoreCreatorPost"));
assert.doesNotMatch(
  restore,
  /onSuccess: \(_post, input\) =>\s*\n?\s*Promise\.all/u,
  "restore must not make the caller's onSuccess wait on a full viewer refetch",
);
assert.match(restore, /void qc\.invalidateQueries/u, "restore must refetch in the background");

const helpers = slurp2Source("packages/slurp2/src/engine/packages/client/src/slp/app/screens/SlpHomeHelpers.tsx");
// The dialog's side card must not draw the picture the dialog already owns — but it gets the whole
// post to do it with. Blanking `imageUrl` and `images` on the model hid the picture from everything
// else that reads them, and "Download post card" then built a card with no image in it.
assert.match(
  helpers,
  /<SlpPostCard post=\{post\} ctx=\{ctx\} surface="profile" hideImage \/>/u,
  "the post dialog's side card must hide the picture with the prop, not by blanking the post",
);
assert.doesNotMatch(helpers, /imageUrl: null, images: \[\]/u, "the side card must not strip the post's image fields");

const hub = slurp2Source("packages/slurp2/src/engine/packages/client/src/slp/app/screens/SlpScreenHub.tsx");
// The feed refetches on a timer and the server stops returning a deleted post, so the undo row has
// to be drawn from the remembered card once the feed no longer carries it.
assert.match(
  hub,
  /!feed\.some\(\(item\) => item\.post\.id === postId\)/u,
  "a post inside its undo window must keep its row after a refetch drops it",
);
assert.match(
  hub,
  /onRestore=\{\(\) => onRestorePost\(entry\.card\)\}/u,
  "the orphaned undo row must restore from the remembered card",
);

// setQueriesData takes filters, not a bare key. A bare key matches every cached query, so the
// viewer-scope updater ran against unrelated query data and threw on the first one without a
// `creators` array — taking the rest of the handler with it.
for (const file of [
  "packages/slurp2/src/engine/packages/client/src/slp/app/slp-home-post-actions.ts",
  "packages/slurp2/src/engine/packages/client/src/slp/features/feed/slp-feed-post-hooks.ts",
]) {
  assert.doesNotMatch(
    slurp2Source(file),
    /setQueriesData<[^>]*>\(\s*slpKeys\./u,
    `${file} must pass setQueriesData a filters object`,
  );
}

console.log("slurp2-post-undo regression passed");
