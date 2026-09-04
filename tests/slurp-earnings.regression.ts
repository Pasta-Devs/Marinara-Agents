import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  earn,
  emptySlurpEarnings,
  payout,
  readSlurpEarnings,
  reverse,
  slurpEarningsKey,
} from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-earnings.js";

const at = new Date("2026-09-05T12:00:00.000Z");

// ── Earning raises both the balance and the score ───────────────────────────
const earned = earn(earn(emptySlurpEarnings(), "subscribe", 12, at, "@fan"), "tip", 50, at);
assert.equal(earned.coins, 62);
assert.equal(earned.lifetime, 62);
assert.equal(earned.ledger[0]?.kind, "tip");
assert.equal(earned.ledger[1]?.note, "@fan");

// Nothing is credited for a bad amount.
assert.equal(earn(earned, "tip", 0, at), earned);
assert.equal(earn(earned, "tip", -5, at), earned);
assert.equal(earn(earned, "tip", 1.5, at), earned);

// ── A payout moves money out but never lowers the score ─────────────────────
// Withdrawing what you earned does not mean you earned less. `lifetime` is what the Creator home
// shows as the score, so a payout must leave it alone.
const paid = payout(earned, 40, at);
assert.ok(paid);
assert.equal(paid.coins, 22);
assert.equal(paid.lifetime, 62, "a payout must not reduce lifetime earnings");
assert.equal(paid.ledger[0]?.amount, -40);

// A payout larger than the balance is refused, so callers must handle it.
assert.equal(payout(earned, 999, at), null);
assert.equal(payout(earned, 0, at), null);

// ── A reversal undoes money that was never really earned ────────────────────
// Unlike a payout, this does lower the score: the charge failed, so it was not income.
const reversed = reverse(earned, 12, at, "failed unlock");
assert.equal(reversed.coins, 50);
assert.equal(reversed.lifetime, 50, "a reversal must lower lifetime earnings");
assert.equal(reverse(earned, 999, at), earned, "a reversal beyond the balance does nothing");

// ── Reading back tolerates anything ─────────────────────────────────────────
assert.deepEqual(readSlurpEarnings(null), emptySlurpEarnings());
assert.deepEqual(readSlurpEarnings("not json"), emptySlurpEarnings());
assert.deepEqual(readSlurpEarnings("[]"), emptySlurpEarnings());
assert.equal(readSlurpEarnings('{"coins":-4}').coins, 0);
// Lifetime can never sit below the balance: every coin held was earned at some point.
assert.equal(readSlurpEarnings('{"coins":100,"lifetime":5}').lifetime, 100);
// Same ledger validation as the wallet, for the same reason: the UI reads kind, amount, and at
// unconditionally, so a hand-edited blob must not reach it.
{
  const ledger = readSlurpEarnings(
    JSON.stringify({
      coins: 10,
      lifetime: 10,
      ledger: [
        { kind: "tip", amount: 5, at: "2026-01-02T03:04:05.000Z", note: "@someone" },
        { kind: "not-a-kind", amount: 5, at: "2026-01-02T03:04:05.000Z" },
        { kind: "tip", amount: "five", at: "2026-01-02T03:04:05.000Z" },
        { kind: "tip", amount: 5, at: "whenever" },
        null,
        { kind: "payout", amount: -5, at: "2026-01-02T03:04:05.000Z" },
      ],
    }),
  ).ledger;
  assert.deepEqual(
    ledger.map((entry) => entry.kind),
    ["tip", "payout"],
    "only renderable ledger lines survive a corrupt blob",
  );
}

// ── Earnings are keyed by Creator, not by persona ───────────────────────────
// This is the whole point. Income used to land in the operating persona's spending wallet, which
// made scarcity impossible once an audience existed. A character-backed Creator has no operating
// persona at all, so the account id is the only correct key.
assert.equal(slurpEarningsKey("creator-1"), "slurp.creator.creator-1.earnings");

const storage = readFileSync(
  join(import.meta.dirname, "..", "packages/slurp/src/engine/packages/server/src/services/storage/slurp.storage.ts"),
  "utf8",
);
assert.match(storage, /await this\.creditEarnings\(creator\.id, reason, share/u);
assert.doesNotMatch(
  storage,
  /const recipientId = creator\.sourceKind === "persona" \? creator\.sourceEntityId : creator\.id;/u,
  "creator income must not be redirected into a persona spending wallet",
);

console.log("slurp earnings regression passed");
