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
// The card prefers `images[0]` over `imageUrl`, so blanking one without the other showed the
// picture a second time in the dialog's sidebar.
assert.match(
  helpers,
  /post=\{\{ \.\.\.post, imageUrl: null, images: \[\] \}\}/u,
  "the post dialog's side card must not draw the picture the dialog already owns",
);

console.log("slurp2-post-undo regression passed");
