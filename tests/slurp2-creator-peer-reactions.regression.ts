/**
 * #1: Creators never reacted to each other's posts; only the audience did, so a persona Creator
 * heard from nobody but the crowd. The world tick now plans a few peer likes and comments.
 */
import assert from "node:assert/strict";
import { planSlurpCreatorPeerReactions } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-world";
import { slurp2Source } from "./slurp2-source";

const actorAccountIds = ["ava", "bea", "cleo"];
const posts = [
  { postId: "ava-1", creatorAccountId: "ava" },
  { postId: "bea-1", creatorAccountId: "bea" },
  { postId: "cleo-1", creatorAccountId: "cleo" },
  { postId: "persona-1", creatorAccountId: "persona-creator" },
];

// Over a month of hours, every Creator reacts sometimes, never to its own post, and about twice a day.
let total = 0;
const kinds = new Set<string>();
const actors = new Set<string>();
const targets = new Set<string>();
for (let hour = 0; hour < 24 * 30; hour += 1) {
  const hourSeed = new Date(Date.UTC(2026, 9, 1) + hour * 3_600_000).toISOString().slice(0, 13);
  const plan = planSlurpCreatorPeerReactions({ actorAccountIds, posts, reacted: new Set(), hourSeed });
  assert.ok(plan.length <= actorAccountIds.length, "at most one reaction per Creator per hour");
  for (const reaction of plan) {
    assert.notEqual(reaction.actorAccountId, reaction.creatorAccountId, "a Creator never reacts to herself");
    kinds.add(reaction.kind);
    actors.add(reaction.actorAccountId);
    targets.add(reaction.creatorAccountId);
  }
  total += plan.length;
}
const perCreatorPerDay = total / actorAccountIds.length / 30;
assert.ok(perCreatorPerDay > 1 && perCreatorPerDay < 3.5, `about two a day, got ${perCreatorPerDay.toFixed(2)}`);
assert.deepEqual([...kinds].sort(), ["comment", "like"]);
assert.equal(actors.size, 3, "every Creator reacts sometimes");
assert.ok(targets.has("persona-creator"), "a persona Creator's posts get peer reactions too");

// The same hour plans the same thing, and a reaction that already landed is not repeated.
const busyHour = Array.from({ length: 24 * 30 }, (_, hour) =>
  new Date(Date.UTC(2026, 9, 1) + hour * 3_600_000).toISOString().slice(0, 13),
).find((hourSeed) => planSlurpCreatorPeerReactions({ actorAccountIds, posts, reacted: new Set(), hourSeed }).length)!;
const first = planSlurpCreatorPeerReactions({ actorAccountIds, posts, reacted: new Set(), hourSeed: busyHour });
assert.deepEqual(
  first,
  planSlurpCreatorPeerReactions({ actorAccountIds, posts, reacted: new Set(), hourSeed: busyHour }),
);
const reacted = new Set(first.map((reaction) => `${reaction.actorAccountId}:${reaction.postId}`));
assert.deepEqual(planSlurpCreatorPeerReactions({ actorAccountIds, posts, reacted, hourSeed: busyHour }), []);

// The world tick runs the plan for character Creators over public posts, with free canned copy.
const tick = slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/features/world/slp-world-operation.ts");
assert.match(
  tick,
  /applySlurpCreatorPeerReactions\(db, \{ accounts, automaticCreators, postsByAccount, cutoff, until \}\)/u,
);
const world = slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/features/world/slp-world-actions.ts");
assert.match(world, /actorAccountIds: input\.automaticCreators\.map\(\(account\) => account\.id\)/u);
assert.match(world, /post\.access === "public" && post\.createdAt >= input\.cutoff/u);
assert.match(world, /slurpCreatorPeerComment\(/u);

console.log("slurp2 creator peer reactions regression passed");
