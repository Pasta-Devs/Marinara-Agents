import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { slurpCommissionDeliveryDelayMs } from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-messaging.js";

const schema = readFileSync("packages/slurp/src/engine/packages/server/src/db/schema/slurp.ts", "utf8");

const storage = readFileSync(
  "packages/slurp/src/engine/packages/server/src/services/storage/slurp-messages.storage.ts",
  "utf8",
);
const maintainedStorage = readFileSync(
  "sources/engine/packages/server/src/services/storage/slurp-messages.storage.ts",
  "utf8",
);
const world = readFileSync(
  "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-world.operation.ts",
  "utf8",
);
const routes = readFileSync("packages/slurp/src/engine/packages/server/src/routes/slurp-messages.routes.ts", "utf8");

assert.match(storage, /async listAudienceBriefCommissions\(\)/u);
assert.match(storage, /population\.get\(viewerAccountId\)/u);
assert.match(storage, /async listAutomatedBriefCommissions\(\)/u);
assert.match(world, /listAutomatedBriefCommissions\(\)/u);
assert.match(world, /quoteCommission\(commission\.id, AUDIENCE_COMMISSION_PRICE\)/u);
assert.match(world, /const AUDIENCE_COMMISSION_PRICE = 40/u);
assert.match(world, /listQuotedCommissions\(\)/u);
assert.match(world, /settleAudienceCommission\(commission\.id/u);

// Character-controlled Creators quote from the world tick, not during request creation.
assert.doesNotMatch(routes, /messages\.quoteCommission\(commission\.id, automaticPrice\)/u);
assert.match(routes, /const accepted = await messages\.acceptCommission\(commission\.id\)/u);
assert.match(routes, /generateSlurpCommissionImage\(app\.db/u);
assert.match(routes, /messages\.deliverCommission\(/u);
assert.match(routes, /commissionAcceptRequests\.has\(commission\.id\)/u);
assert.match(routes, /commissionDeliveryRequests\.has\(commissionId\)/u);

// A fresh delivery lease belongs to the other worker. A stale lease can be conditionally reclaimed,
// while a persisted stable message completes without another send.
for (const copy of [storage, maintainedStorage]) {
  const deliverySection = copy.match(/const deliveryId = `commission:\$\{id\}:delivery`[\s\S]*?let message/u)?.[0];
  const claimRecovery = deliverySection?.match(/if \(!claimed\) \{[\s\S]*?(?=\n\s*let message)/u)?.[0];
  assert.ok(deliverySection, "commission delivery claim must exist");
  assert.ok(claimRecovery, "delivery claim recovery branch must exist");
  assert.match(deliverySection, /const persistedBeforeClaim = await storage\.getMessageById\(deliveryId\)/u);
  assert.match(deliverySection, /const deliveryClaimToken = newId\(\)/u);
  assert.match(
    deliverySection,
    /deliveryClaimedAt[\s\S]*?Date\.now\(\) - 5 \* 60 \* 1000[\s\S]*?return false/u,
    "a foreign delivery lease must remain exclusive for five minutes",
  );
  assert.match(
    deliverySection,
    /previousClaim[\s\S]*?deliveryClaimToken, deliveryClaimedAt: now\(\)[\s\S]*?previousClaim[\s\S]*?owned\?\.deliveryClaimToken === deliveryClaimToken/u,
    "a stale delivery lease must be reclaimed conditionally by one owner",
  );
  assert.match(claimRecovery, /return storage\.getCommission\(id\);/u);
  assert.match(claimRecovery, /return storage\.getCommission\(id\);[\s\S]*\n\s*\}/u);
  const deliveryStart = copy.indexOf("const deliveryId =");
  assert.ok(
    copy.indexOf("sendCreatorMessage(", deliveryStart) > deliveryStart + claimRecovery.length,
    "send must follow the claim guard",
  );
}

// Commission acceptance uses one durable payment intent and the same key for the wallet debit.
assert.match(
  storage,
  /async acceptCommissionUnlocked\(id: string\)[\s\S]{0,900}?const paymentId = `commission:\$\{id\}:accept`[\s\S]{0,1500}?spendCoins\([\s\S]{0,260}?paymentId/u,
  "commission acceptance must use the stable payment intent ID for spendCoins",
);
assert.doesNotMatch(
  storage,
  /async acceptCommissionUnlocked\(id: string\)[\s\S]{0,1200}?spendCoins\([\s\S]{0,220}?commission\.creatorAccountId,\s*\n\s*\)\)/u,
  "commission acceptance must not use an unkeyed spend",
);
assert.match(
  storage,
  /async acceptCommissionUnlocked\(id: string\)[\s\S]{0,2400}?\.set\(\{ state: "accepted", updatedAt: now\(\) \}\)[\s\S]{0,600}?\}\s*catch \(error\)[\s\S]{0,900}?\}\s*if \(settings\.walletEnabled\) await completeSlurpPaymentIntent\(/u,
  "payment completion must run after the compensation catch",
);

console.log("slurp commission funnel regression: ok");

// One open request per thread. A fan, or a world tick on a Creator nobody answers, could stack
// briefs in one conversation without limit.
assert.match(storage, /Promise<SlurpCommission \| "open_request" \| null>/u);
assert.match(storage, /return "open_request"/u);
assert.match(routes, /commission === "open_request"/u);
assert.match(world, /commission === "open_request"/u);

// The scans behind every world tick filter in the query and read each account once.
assert.match(storage, /from\(slurpCommissions\)\.where\(eq\(slurpCommissions\.state, "quoted"\)\)/u);
assert.match(storage, /const automated = new Map<string, boolean>\(\)/u);

// An automatic delivery is no longer one hardcoded English line, and it gets rewritten in the
// Creator's voice on the next read. Both trigger paths share one function so they cannot drift.
const delivery = readFileSync(
  "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-commission-delivery.service.ts",
  "utf8",
);
assert.match(delivery, /slurpCommissionDeliveryNote\(commission\.id\)/u);
assert.match(delivery, /kind: "delivery"/u);
assert.doesNotMatch(routes, /finished this for you/u);

// A refund is only claimed on the branch that actually refunds.
assert.match(routes, /outcome\.status === "refunded"[\s\S]{0,120}?Your payment was refunded/u);
assert.match(routes, /"This commission is no longer ready for delivery\."/u);

// The piece is drawn and paid for at accept time, then held. Delivering in the same request made
// a commission a vending machine, and the wait is the whole product.
assert.match(routes, /drawn\.promote\(\)/u);
assert.match(routes, /scheduleCommissionDelivery\(commission\.id, \{/u);
assert.match(
  routes,
  /slurpCommissionDeliveryDelayMs\(\{ price: accepted\.price, briefLength: commission\.brief\.length \}\)/u,
);
assert.match(storage, /async scheduleCommissionDelivery\(/u);
assert.match(storage, /async listDueCommissionDeliveries\(/u);
// The wait outlives a restart, so the finished file is kept on the row, not in memory.
assert.match(schema, /deliverAt: text\("deliver_at"\)/u);
assert.match(schema, /mediaPath: text\("media_path"\)/u);
// The host path must never reach the client, so it is returned beside the commission, not on it.
assert.doesNotMatch(storage, /mapCommission = \(row[\s\S]{0,600}?mediaPath:/u);

// The scheduler runs the clock down without the model, so a dead text connection cannot strand a
// finished commission the fan already paid for.
const scheduler = readFileSync(
  "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-message-scheduler.service.ts",
  "utf8",
);
assert.match(scheduler, /deliverDueSlurpCommissions\(app\.db\)/u);

// A failed delivery refunds and closes in one step. Left `accepted` with a due date in the past,
// the scheduler retried it — and refunded it — on every poll.
assert.match(storage, /failed commission delivery[\s\S]{0,500}?set\(\{ state: "declined", deliverAt: null/u);

// Never instant, never so long the player forgets they ordered it.
assert.equal(slurpCommissionDeliveryDelayMs({ price: 0, briefLength: 0 }), 5 * 60_000);
assert.equal(slurpCommissionDeliveryDelayMs({ price: 500, briefLength: 5_000 }), 45 * 60_000);
assert.ok(
  slurpCommissionDeliveryDelayMs({ price: 200, briefLength: 100 }) >
    slurpCommissionDeliveryDelayMs({ price: 20, briefLength: 100 }),
);
