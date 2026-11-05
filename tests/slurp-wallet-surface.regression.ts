import assert from "node:assert/strict";
import { slurp2Source } from "./slurp2-source";

const home = slurp2Source("packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpHome.tsx");
const hooks = slurp2Source("packages/slurp2/src/engine/packages/client/src/hooks/use-slurp.ts");
const routes = slurp2Source("packages/slurp2/src/engine/packages/server/src/routes/slurp.routes.ts");

assert.match(home, /creatorEarningsInfo/u, "Creator earnings explain why they are not yet spendable");
assert.match(home, /fanWalletHelp/u, "the Fan wallet explains what its balance can buy");
assert.match(home, /refillCountdown/u, "daily refill renders its countdown state");
// Step 6.5 (orchestrator decision 3): a calm clock time ("Next refill 5:48 AM") replaces the per-second
// countdown; one timer re-reads the wallet at the boundary so the refill button turns on by itself.
assert.match(
  home,
  /window\.setTimeout\(\(\) => void refetchWallet\(\), wait\)/u,
  "the wallet is re-read at the refill boundary",
);
assert.match(hooks, /nextRefillAt\?: string/u, "the client models the server-owned refill boundary");
assert.match(
  routes,
  // Fix phase 1 (R1-092): null while the Wallet or the refill is off, the boundary otherwise.
  /nextRefillAt:[^\n]*\? nextRefillAt\.toISOString\(\) : null/u,
  "the API returns the actual next Slurp-day boundary",
);

console.log("slurp wallet surface regression passed");
