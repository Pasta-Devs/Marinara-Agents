import assert from "node:assert/strict";
import {
  canViewNoodlerPost,
  isNoodlerHiddenFromViewer,
  withoutNoodlerSelfHiddenAccountId,
} from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-access";

const publicPost = { id: "public", access: "public" as const };
const lockedPost = { id: "locked", access: "locked" as const };

assert.equal(canViewNoodlerPost({ post: publicPost, subscribed: false, unlockedPostIds: new Set() }), true);
assert.equal(canViewNoodlerPost({ post: lockedPost, subscribed: false, unlockedPostIds: new Set() }), false);
assert.equal(canViewNoodlerPost({ post: lockedPost, subscribed: true, unlockedPostIds: new Set() }), true);
assert.equal(canViewNoodlerPost({ post: lockedPost, subscribed: false, unlockedPostIds: new Set(["locked"]) }), true);

const creator = {
  sourceEntityId: "own-viewer",
  settings: { privacy: { access: { hiddenFromAccountIds: ["hidden-viewer"] } } },
};
assert.equal(isNoodlerHiddenFromViewer(creator as never, "hidden-viewer"), true);
assert.equal(isNoodlerHiddenFromViewer(creator as never, "visible-viewer"), false);
assert.equal(isNoodlerHiddenFromViewer(creator as never, "own-viewer"), false);
assert.deepEqual(withoutNoodlerSelfHiddenAccountId(["hidden-viewer", "own-viewer"], "own-viewer"), ["hidden-viewer"]);

console.log("NoodleR access matrix regressions passed.");
