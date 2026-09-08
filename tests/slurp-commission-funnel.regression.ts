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

assert.match(storage, /async listAudienceBriefCommissions\(\)/u);
assert.match(storage, /population\.get\(String\(row\.viewerAccountId\)\)/u);
assert.match(world, /listAudienceBriefCommissions\(\)/u);
assert.match(world, /quoteCommission\(commission\.id, AUDIENCE_COMMISSION_PRICE\)/u);
assert.match(world, /const AUDIENCE_COMMISSION_PRICE = 40/u);
assert.match(world, /listQuotedCommissions\(\)/u);
assert.match(world, /settleAudienceCommission\(commission\.id/u);

console.log("slurp commission funnel regression: ok");
