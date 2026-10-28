import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  emptySlurpWallet,
  renewSubscriptions,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/economy/slp-wallet";

// Fix phase 1, batch K (REVIEW-1 economy low + polish): R1-087, R1-088, R1-089, R1-090, R1-092, R1-094,
// R1-096, R1-099.
const pkg = join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages");
const read = (path: string) => readFileSync(join(pkg, path), "utf8");
const wallet = read("client/src/slp/app/screens/SlpScreenWallet.tsx");

// R1-090: a renewal line names its Creator, so the Wallet can offer Resubscribe.
const at = new Date(Date.UTC(2026, 8, 27, 12));
const due = {
  ...emptySlurpWallet(),
  coins: 100,
  subscriptions: { c1: { price: 20, paidThroughAt: new Date(at.getTime() - 1).toISOString(), cancelled: false } },
} as never;
const renewed = renewSubscriptions(due, at, new Set(), "v1");
assert.deepEqual(renewed.wallet.ledger[0]?.binding, { viewerAccountId: "v1", creatorAccountId: "c1" });
assert.equal(
  (
    read("server/src/slp/data/economy/slp-economy-storage-1.ts").match(
      /"subscribe",\s*(?:basePrice|price),\s*at,\s*creatorAccountId,\s*undefined,\s*\{\s*viewerAccountId,\s*creatorAccountId,?\s*\}/gu,
    ) ?? []
  ).length,
  2,
);

// R1-087: the Collect day is the Slurp day; nothing earned is not "all collected".
assert.match(
  read("server/src/slp/modules/economy/slp-earnings.ts"),
  /const dayKey = \(at: Date\) => slurpDayKey\(at\);/u,
);
assert.match(read("client/src/slp/app/screens/SlpCollectCard.tsx"), /ui\.slurp\.wallet\.nothingToCollect/u);
// R1-088 / R1-089: refunds and ended subscriptions have their own words.
assert.match(wallet, /entry\.kind === "income" && entry\.note\?\.startsWith\("refund:"\)/u);
assert.match(wallet, /ui\.slurp\.wallet\.entry\.subscriptionEnded/u);
// R1-092: no next refill when there is none.
assert.match(
  read("server/src/slp/features/economy/slp-wallet-routes.ts"),
  /settings\.walletEnabled && settings\.walletStipendFloor > 0 \? nextRefillAt\.toISOString\(\) : null/u,
);
// R1-094: a failed ad sync backs off per revision.
assert.match(
  read("server/src/slp/features/ads/slp-garnish-sync-service.ts"),
  /failed\?\.revision === context\.revision && Date\.now\(\) < failed\.retryAt/u,
);
// R1-096: a renewal says "renewed".
assert.match(read("server/src/slp/data/economy/slp-economy-storage-3.ts"), /reason === "renew" \? "renewed"/u);
// R1-099: no coin rain on a persona switch.
assert.match(wallet, /shownCoins\.current\.personaId === personaId/u);

console.log("slurp2 fix1 economy low regression passed");
