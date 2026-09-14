import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  slurpFanMemoryForPrompt,
  SLURP_FAN_MEMORY_MAX,
} from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-fan-types.js";
import {
  planSlurpWorldTick,
  slurpAudienceTipAmount,
  type SlurpWorldActorWeights,
} from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-world.js";
import { SLURP_REALISTIC_TUNING } from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-tuning.js";

const at = new Date("2026-09-14T12:00:00.000Z");
const since = new Date(at.getTime() - 86_400_000);
const creator = {
  id: "creator",
  followers: 100_000,
  recentPostIds: ["public"],
  lockedPosts: [{ id: "locked", price: 8 }],
  openRequests: 0,
};
const neutral: SlurpWorldActorWeights = {
  question: 1,
  dm: 1,
  commission: 1,
  tip: 1,
  unlock: 1,
  tipChance: 0,
  weeklyBudget: 20,
  tipAmount: 5,
};
const noCurve = { floor: 1, cap: 0, curve: 0 };
const certainCurve = { floor: 1, cap: 1, curve: 1 };
const plan = (weights: SlurpWorldActorWeights, world = SLURP_REALISTIC_TUNING.world) =>
  planSlurpWorldTick(
    {
      since,
      until: at,
      creators: [creator],
      audience: ["fan"],
      actorWeights: new Map([["fan", weights]]),
      stageOf: () => "follower",
    },
    world,
  );

assert.deepEqual(
  plan(
    { ...neutral, commission: 0 },
    {
      ...SLURP_REALISTIC_TUNING.world,
      commission: certainCurve,
      message: noCurve,
      question: noCurve,
      unlockChancePerDay: 0,
    },
  ),
  [],
  "a fan type with zero commission weight never commissions",
);
assert.equal(
  plan(neutral, {
    ...SLURP_REALISTIC_TUNING.world,
    commission: certainCurve,
    message: noCurve,
    question: noCurve,
    unlockChancePerDay: 0,
  })[0]?.kind,
  "commission",
);
assert.equal(
  plan(
    { ...neutral, tipChance: 1 },
    {
      ...SLURP_REALISTIC_TUNING.world,
      commission: noCurve,
      message: noCurve,
      question: noCurve,
      unlockChancePerDay: 0,
    },
  )[0]?.kind,
  "tip",
);
assert.equal(
  plan(neutral, {
    ...SLURP_REALISTIC_TUNING.world,
    commission: noCurve,
    message: noCurve,
    question: noCurve,
    unlockChancePerDay: 1,
  })[0]?.kind,
  "unlock",
);
assert.deepEqual(
  plan(
    { ...neutral, weeklyBudget: 4 },
    {
      ...SLURP_REALISTIC_TUNING.world,
      commission: noCurve,
      message: noCurve,
      question: noCurve,
      unlockChancePerDay: 1,
    },
  ),
  [],
  "a fan cannot unlock a post outside their configured budget",
);
assert.equal(slurpAudienceTipAmount(80, 0.25), 20);

const memory = slurpFanMemoryForPrompt(
  {
    stage: "subscriber",
    spent: 42,
    interactions: 12,
    followedAt: "2026-08-14T12:00:00.000Z",
    lastSeenAt: "2026-09-13T12:00:00.000Z",
    audienceArc: "rising",
  },
  at,
);
assert.match(memory ?? "", /followed for 31 days/u);
assert.match(memory ?? "", /Subscribes/u);
assert.ok((memory?.length ?? 0) <= SLURP_FAN_MEMORY_MAX);

const root = join(import.meta.dirname, "..", "packages", "slurp2", "src", "engine", "packages", "server", "src");
const operation = readFileSync(join(root, "services/slurp/slurp-world.operation.ts"), "utf8");
assert.match(operation, /actorWeights,/u);
assert.match(operation, /stageOf:/u);
assert.match(operation, /recordAudiencePostUnlock/u);
assert.match(operation, /notifyCreatorIncome\(action\.creatorAccountId, "tip"/u);

console.log("slurp2 fan world regression passed");
