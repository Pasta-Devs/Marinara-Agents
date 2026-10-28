import assert from "node:assert/strict";
import { formatSlurpPostHistory } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-post-history.ts";
import type { SlpCreatorManagedPost } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-social.types.ts";

// Full captions taught the model its own filler words. Only the last post is quoted; older posts
// are subjects, and other Creators' recent titles steer the whole feed away from one topic.
const post = (id: string, title: string, content: string, createdAt: string) =>
  ({ id, title, content, createdAt, imagePrompt: null }) as unknown as SlpCreatorManagedPost;
const recentPosts = [
  post("p3", "Bar closed early", "newest caption nuja LATEST_BODY", "2026-09-25T10:00:00.000Z"),
  {
    ...post("p2", "Cocoa stain map", "older caption nuja OLDER_BODY_ONE", "2026-09-24T10:00:00.000Z"),
    imagePrompt: `older scene ${"x".repeat(120)} OLDER_SCENE_TAIL`,
  } as SlpCreatorManagedPost,
  post(
    "p1",
    "",
    "untitled OLDER_BODY_TWO that goes on long enough to be cut before this marker CUT_MARKER",
    "2026-09-23T10:00:00.000Z",
  ),
];
const user = formatSlurpPostHistory(recentPosts, (value) => value, ["Laundry day again"]);
assert.match(user, /LATEST_BODY/u, "the last post stays quoted for continuity");
assert.doesNotMatch(user, /OLDER_BODY_ONE/u, "an older caption must not be quoted");
assert.match(user, /Cocoa stain map/u, "an older post keeps its subject");
assert.match(user, /untitled OLDER_BODY_TWO/u, "an untitled post falls back to its opening");
assert.doesNotMatch(user, /CUT_MARKER/u, "an untitled post is cut to a subject, not quoted");
assert.equal((user.match(/nuja/gu) ?? []).length, 1, "only one caption's wording reaches the model");
assert.match(user, /Other Creators posted about these recently[^\n]*\n- Laundry day again/u);

// An older picture is cut to its opening; only a repeat has to be recognisable.
assert.match(user, /older scene x+/u);
assert.doesNotMatch(user, /OLDER_SCENE_TAIL/u);

// Beats mode quotes no caption: the last post is a continuity fact there.
const beats = formatSlurpPostHistory(recentPosts, (value) => value, [], false);
assert.doesNotMatch(beats, /LATEST_BODY|OLDER_BODY_ONE|Your last post/u);
assert.match(beats, /Bar closed early/u, "the last post still appears as a subject");

console.log("slurp2 editorial memory regression checks passed");
