import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  slurpCreatorReach,
  slurpPostImpressions,
  slurpPostLikeCount,
  slurpPostReplyCount,
  slurpPostUnlockCount,
} from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-reach.js";

const born = "2026-01-01T00:00:00.000Z";
const day = (n: number) => new Date(Date.parse(born) + n * 86_400_000);
const creator = { accountId: "creator-a", createdAt: born, realFollowers: 0 };

// ── Deterministic ───────────────────────────────────────────────────────────
// Every value derives from stable inputs, so the same read always produces the same number. A
// count that moved between two reads of the same page would read as broken, not as busy.
assert.equal(slurpCreatorReach(creator, day(30)), slurpCreatorReach(creator, day(30)));
assert.notEqual(
  slurpCreatorReach(creator, day(30)),
  slurpCreatorReach({ ...creator, accountId: "creator-b" }, day(30)),
  "two creators must not share one audience size",
);

// ── Stable under a fixed audience ───────────────────────────────────────────
// For a given real-follower count, the synthetic part never falls: growth depends on age through
// a saturating curve, and age only increases.
//
// The *total* may fall, and that is deliberate. An earlier version made monotonicity a rule, which
// was a design error stated as a principle — a number that cannot fall has no stakes, so raising
// it means nothing. What breaks the illusion is jitter between two reads of the same page, not
// decline the player earned. Real followers come from the funnel and people leave it.
let previous = 0;
for (const days of [0, 1, 7, 30, 120, 400, 5_000]) {
  const value = slurpCreatorReach(creator, day(days));
  assert.ok(value >= previous, `creator reach fell between reads at day ${days}`);
  previous = value;
}
let previousLikes = 0;
for (const days of [0, 0.5, 1, 3, 10, 90]) {
  const value = slurpPostLikeCount({ postId: "post-a", createdAt: born, creatorReach: 8_000, realLikes: 0 }, day(days));
  assert.ok(value >= previousLikes, `like count fell between reads at day ${days}`);
  previousLikes = value;
}

// Losing real followers lowers the total. This is the stake the first version removed.
assert.ok(
  slurpCreatorReach({ ...creator, realFollowers: 40 }, day(30)) >
    slurpCreatorReach({ ...creator, realFollowers: 10 }, day(30)),
  "shedding followers must cost reach",
);

// ── Bounded ─────────────────────────────────────────────────────────────────
// A brand-new creator still reads as a real account, and no creator runs away to absurdity.
assert.ok(slurpCreatorReach(creator, day(0)) >= 240, "a new creator must not look abandoned");
assert.ok(slurpCreatorReach(creator, day(100_000)) < 120_000, "synthetic reach must stay believable");

// The spread across ids has to be wide, or every creator looks identical.
const sizes = Array.from({ length: 200 }, (_, index) =>
  slurpCreatorReach({ accountId: `creator-${index}`, createdAt: born, realFollowers: 0 }, day(365)),
);
assert.ok(Math.max(...sizes) > Math.min(...sizes) * 8, "creator sizes must vary by an order of magnitude");

// ── Sequential ids must spread ──────────────────────────────────────────────
// Slurp mints ids sequentially, so a page of posts differs only in the last character or two.
// Plain FNV-1a barely avalanches its final byte, which made every post in a batch draw nearly the
// same share and land on the same like count. The hash carries a murmur3 finalizer to fix that,
// and this is the assertion that keeps it.
{
  const base = "01JQ8Z3K7";
  const counts = "ABCDEFGHJKMNPQRSTVWXYZ"
    .split("")
    .map((suffix) =>
      slurpPostLikeCount({ postId: `${base}${suffix}`, createdAt: born, creatorReach: 20_000, realLikes: 0 }, day(30)),
    );
  const low = Math.min(...counts);
  const high = Math.max(...counts);
  assert.ok(high > low * 3, `sequential post ids must not cluster: got ${low}..${high}`);
  assert.ok(new Set(counts).size > counts.length / 2, "sequential post ids must mostly differ");
}

// ── Real signal wins ────────────────────────────────────────────────────────
// A creator the player actually built an audience for must outgrow the synthetic floor.
assert.ok(
  slurpCreatorReach({ ...creator, realFollowers: 40 }, day(30)) > slurpCreatorReach(creator, day(30)) + 40,
  "real followers must count for more than synthetic ones",
);

// ── Real interactions are added, never replaced ─────────────────────────────
// Expanding a post still shows exactly the accounts that acted, so the count may never sit below
// the number of rows behind it.
const withReal = slurpPostLikeCount({ postId: "post-b", createdAt: born, creatorReach: 5_000, realLikes: 9 }, day(5));
const withoutReal = slurpPostLikeCount(
  { postId: "post-b", createdAt: born, creatorReach: 5_000, realLikes: 0 },
  day(5),
);
assert.equal(withReal - withoutReal, 9, "real likes must be added on top of the synthetic crowd");

// ── Proportions stay believable ─────────────────────────────────────────────
// A feed where every post has more comments than likes looks broken.
for (const postId of ["post-c", "post-d", "post-e", "post-f"]) {
  const input = { postId, createdAt: born, creatorReach: 12_000 };
  const impressions = slurpPostImpressions(input, day(30));
  const likes = slurpPostLikeCount({ ...input, realLikes: 0 }, day(30));
  const replies = slurpPostReplyCount({ ...input, realReplies: 0 }, day(30));
  const unlocks = slurpPostUnlockCount(input, day(30));
  assert.ok(likes < impressions, `${postId}: more likes than impressions`);
  assert.ok(replies < likes, `${postId}: more replies than likes`);
  assert.ok(unlocks < likes, `${postId}: more unlocks than likes`);
}

// ── Reach never reaches the economy ─────────────────────────────────────────
// Wallets, ledgers, payouts, and subscriber lists must stay exact. `fans` is a paying subscriber
// count, so it is read from real rows; only `followers` carries synthetic reach.
const routes = readFileSync(
  join(import.meta.dirname, "..", "packages/slurp/src/engine/packages/server/src/routes/slurp.routes.ts"),
  "utf8",
);
assert.match(routes, /fans: \(await noodle\.listSubscriptionsForCreator\(creator\.id\)\)\.length/u);
assert.match(routes, /followers: slurpCreatorReach\(/u);
// Real followers come from the funnel, so a Creator who loses subscribers loses reach.
assert.match(routes, /countFollowersForCreators/u, "reach must count from the audience funnel");
assert.doesNotMatch(
  routes,
  /realFollowers: 0/u,
  "no reach call may hardcode an empty audience now that the funnel exists",
);
const wallet = readFileSync(
  join(import.meta.dirname, "..", "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-wallet.ts"),
  "utf8",
);
assert.doesNotMatch(wallet, /slurp-reach|slurpCreatorReach|slurpPost/u, "the wallet must never read synthetic reach");

console.log("slurp reach regression passed");
