import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  slurpAudiencePaidThrough,
  slurpAudienceSubscriptionDecision,
  SLURP_AUDIENCE_SUBSCRIPTION_DAYS,
  SLURP_AUDIENCE_WEEKLY_BUDGET,
} from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-audience-subscription.js";

const at = new Date("2026-09-08T12:00:00.000Z");
const subject = (overrides: Partial<Parameters<typeof slurpAudienceSubscriptionDecision>[0]> = {}) => ({
  memberId: "slurp-fan:seed-1",
  creatorAccountId: "creator-1",
  stage: "follower" as const,
  spendTier: "whale" as const,
  price: 12,
  paidThroughAt: null,
  ...overrides,
});

// ── Nobody who will not pay ever subscribes ─────────────────────────────────
// `none` is the majority of the population by design. A crowd where everybody pays is neither
// believable nor interesting, because then the few who do pay stop meaning anything.
assert.equal(SLURP_AUDIENCE_WEEKLY_BUDGET.none, 0);
for (let index = 0; index < 200; index += 1) {
  assert.equal(
    slurpAudienceSubscriptionDecision(subject({ memberId: `slurp-fan:s${index}`, spendTier: "none" }), at),
    "none",
    "a member who spends nothing must never subscribe",
  );
}

// ── A stage is never skipped ────────────────────────────────────────────────
// The funnel is the thing the player reads. Somebody who liked one post is not about to pay.
for (const stage of ["stranger", "viewer", "liker"] as const) {
  for (let index = 0; index < 100; index += 1) {
    assert.equal(
      slurpAudienceSubscriptionDecision(subject({ memberId: `slurp-fan:l${index}`, stage }), at),
      "none",
      `a ${stage} must not convert straight to a subscriber`,
    );
  }
}

// ── A follower who can afford it does convert, and rarely ───────────────────
const converted = Array.from({ length: 400 }, (_, index) =>
  slurpAudienceSubscriptionDecision(subject({ memberId: `slurp-fan:w${index}` }), at),
).filter((decision) => decision === "subscribe").length;
assert.ok(converted > 0, "a paying audience must produce subscribers");
assert.ok(converted < 400 * 0.3, "conversion must stay rare enough to read as a funnel");

// ── The same day always gives the same answer ───────────────────────────────
// The catch-up path advances the world on every notifications read. An undecided roll would bill
// the same person twice for one day, and money that appears on a refresh is the worst jitter there
// is.
const morning = new Date("2026-09-08T06:00:00.000Z");
const evening = new Date("2026-09-08T21:00:00.000Z");
const nextDay = new Date("2026-09-09T06:00:00.000Z");
for (let index = 0; index < 50; index += 1) {
  const person = subject({ memberId: `slurp-fan:d${index}` });
  assert.equal(
    slurpAudienceSubscriptionDecision(person, morning),
    slurpAudienceSubscriptionDecision(person, evening),
    "two reads of the same day must decide the same way",
  );
}
assert.ok(
  Array.from({ length: 60 }, (_, index) => {
    const person = subject({ memberId: `slurp-fan:r${index}` });
    return slurpAudienceSubscriptionDecision(person, morning) !== slurpAudienceSubscriptionDecision(person, nextDay);
  }).some(Boolean),
  "a new day must be able to decide differently, or nobody ever converts",
);

// ── A paid week is left alone, then renews ──────────────────────────────────
const paid = subject({ stage: "subscriber", paidThroughAt: new Date(at.getTime() + 86_400_000).toISOString() });
assert.equal(slurpAudienceSubscriptionDecision(paid, at), "none", "nothing is owed inside the paid week");

const expired = subject({ stage: "subscriber", paidThroughAt: new Date(at.getTime() - 1000).toISOString() });
assert.equal(slurpAudienceSubscriptionDecision(expired, at), "renew");

// ── Priced out is a readable reason to leave ────────────────────────────────
assert.equal(
  slurpAudienceSubscriptionDecision({ ...expired, spendTier: "light", price: 500 }, at),
  "lapse",
  "somebody who can no longer afford the price must lapse rather than renew for free",
);

// ── The paid week is a week ─────────────────────────────────────────────────
assert.equal(
  Math.round((Date.parse(slurpAudiencePaidThrough(at)) - at.getTime()) / 86_400_000),
  SLURP_AUDIENCE_SUBSCRIPTION_DAYS,
);

// ── Wired into the world tick, and paying real earnings ─────────────────────
const root = join(import.meta.dirname, "..");
const world = readFileSync(
  join(root, "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-world.operation.ts"),
  "utf8",
);
assert.ok(world.includes("slurpAudienceSubscriptionDecision("), "the world tick must run the subscription pass");
assert.ok(world.includes("creditCreatorIncome(account.id, price,"), "an audience subscription must pay the Creator");
assert.ok(world.includes('recordCreatorEvent(account.id, "subscribed"'), "a first subscribe must be notifiable");
assert.ok(world.includes("setTiePaidThrough("), "billing state must be recorded or every tick re-bills");

// Counts. Both halves are exact rows and neither is reach: the personas on this install pay
// through subscription rows, and the audience pays through the funnel because it holds no wallet.
const routes = readFileSync(join(root, "packages/slurp/src/engine/packages/server/src/routes/slurp.routes.ts"), "utf8");
assert.ok(routes.includes("countSubscribersForCreators"), "subscriber counts must include the audience");
assert.ok(
  routes.includes('app.get("/noodler/accounts/:id/followers"'),
  "followers must be listable, not only countable",
);
assert.ok(routes.includes('app.get("/noodler/audience/:memberId"'), "an audience name must open a fan card");

const storage = readFileSync(
  join(root, "packages/slurp/src/engine/packages/server/src/services/storage/slurp-population.storage.ts"),
  "utf8",
);
assert.ok(
  storage.includes('.set({ stage: "lapsed", paidThroughAt: null })'),
  "a lapse must clear the billing state, or a returning member reads as still paid up",
);

console.log("slurp-audience-subscription regression passed");
