import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const storage = readFileSync(
  "packages/slurp/src/engine/packages/server/src/services/storage/slurp-messages.storage.ts",
  "utf8",
);
const world = readFileSync(
  "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-world.operation.ts",
  "utf8",
);
const routes = readFileSync("packages/slurp/src/engine/packages/server/src/routes/slurp-messages.routes.ts", "utf8");

assert.match(storage, /async listAudienceBriefCommissions\(\)/u);
assert.match(storage, /population\.get\(String\(row\.viewerAccountId\)\)/u);
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

console.log("slurp commission funnel regression: ok");
