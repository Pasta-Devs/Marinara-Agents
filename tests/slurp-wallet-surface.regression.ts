import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const home = readFileSync("packages/slurp/src/engine/packages/client/src/components/slurp/SlurpHome.tsx", "utf8");
const hooks = readFileSync("packages/slurp/src/engine/packages/client/src/hooks/use-slurp.ts", "utf8");
const routes = readFileSync("packages/slurp/src/engine/packages/server/src/routes/slurp.routes.ts", "utf8");

assert.match(home, /creatorEarningsHelp/u, "Creator earnings explain why they are not yet spendable");
assert.match(home, /fanWalletHelp/u, "the Fan wallet explains what its balance can buy");
assert.match(home, /refillCountdown/u, "daily refill renders its countdown state");
assert.match(home, /window\.setInterval\([^,]+, 1_000\)/u, "the visible countdown updates once per second");
assert.match(hooks, /nextRefillAt\?: string/u, "the client models the server-owned refill boundary");
assert.match(
  routes,
  /nextRefillAt: nextRefillAt\.toISOString\(\)/u,
  "the API returns the actual next Slurp-day boundary",
);

console.log("slurp wallet surface regression passed");
