import assert from "node:assert/strict";
import { slurp2Source } from "./slurp2-source";

const home = slurp2Source("packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpHome.tsx");
const hooks = slurp2Source("packages/slurp2/src/engine/packages/client/src/hooks/use-slurp.ts");
const routes = slurp2Source("packages/slurp2/src/engine/packages/server/src/routes/slurp.routes.ts");

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
