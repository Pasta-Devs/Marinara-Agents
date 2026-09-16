import assert from "node:assert/strict";

import {
  slurpCreatorReach,
  slurpPostImpressions,
  slurpPostWentViral,
  slurpReachWeek,
} from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-reach.js";

const WEEK = 7 * 86_400_000;
const counts = { normal: 0, featured: 0, buried: 0, viral: 0 };
for (let creator = 0; creator < 40; creator += 1) {
  for (let week = 0; week < 50; week += 1) {
    counts[slurpReachWeek(`creator-${creator}`, new Date(week * WEEK + 3_600_000))] += 1;
  }
}
const total = 40 * 50;
assert.ok(counts.viral / total > 0.01 && counts.viral / total < 0.06, JSON.stringify(counts));
assert.ok(counts.featured / total > 0.05 && counts.featured / total < 0.14, JSON.stringify(counts));
assert.ok(counts.buried / total > 0.06 && counts.buried / total < 0.15, JSON.stringify(counts));

// Deterministic, and the same week everywhere inside it.
assert.equal(slurpReachWeek("creator-1", "2026-03-02T01:00:00Z"), slurpReachWeek("creator-1", "2026-03-02T01:00:00Z"));

// Find a viral week and a post that blew up in it, then check the spike and the follower rush.
let found: { accountId: string; at: number } | null = null;
for (let creator = 0; creator < 200 && !found; creator += 1) {
  for (let week = 2900; week < 2960 && !found; week += 1) {
    if (slurpReachWeek(`c${creator}`, new Date(week * WEEK + 1000)) === "viral")
      found = { accountId: `c${creator}`, at: week * WEEK + 1000 };
  }
}
assert.ok(found, "some creator must have a viral week");
const createdAt = new Date(found.at).toISOString();
let viralPost = "";
for (let index = 0; index < 50 && !viralPost; index += 1) {
  if (slurpPostWentViral({ accountId: found.accountId, postId: `p${index}`, createdAt })) viralPost = `p${index}`;
}
assert.ok(viralPost, "a viral week must produce a viral post");
const later = new Date(found.at + 5 * 86_400_000);
const plain = slurpPostImpressions({ postId: viralPost, createdAt, creatorReach: 1000 }, later);
const spiked = slurpPostImpressions(
  { postId: viralPost, createdAt, creatorReach: 1000, accountId: found.accountId },
  later,
);
assert.ok(spiked >= plain * 6, `${spiked} vs ${plain}`);

// The rush arrives with the viral week and never falls afterwards.
const born = new Date(found.at - 30 * 86_400_000).toISOString();
const before = slurpCreatorReach(
  { accountId: found.accountId, createdAt: born, realFollowers: 0 },
  new Date(found.at - 1000),
);
const after = slurpCreatorReach(
  { accountId: found.accountId, createdAt: born, realFollowers: 0 },
  new Date(found.at + 4 * 86_400_000),
);
const much = slurpCreatorReach(
  { accountId: found.accountId, createdAt: born, realFollowers: 0 },
  new Date(found.at + 60 * 86_400_000),
);
assert.ok(after > before && much >= after, `${before} ${after} ${much}`);

console.log("slurp2 reach algorithm regression passed");
