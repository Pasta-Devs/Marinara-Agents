import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  emptySlurpWallet,
  renewSubscriptions,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/economy/slp-wallet";
import {
  SLURP_SETTINGS_NOT_RESET,
  SLURP_SETTINGS_SECTION_KEYS,
} from "../packages/slurp2/src/engine/packages/client/src/slp/features/settings/slp-settings-defaults";

// Fix phase 1, batch A (REVIEW-1 money and data loss): R1-064, R1-100, R1-101, R1-121, R1-125, R1-005,
// R1-006, R1-066. R1-100 and R1-125 are also covered in the restore and settings-reset regressions.
const pkg = join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages");
const read = (path: string) => readFileSync(join(pkg, path), "utf8");

// ── R1-064: a removed Creator bills nobody; its subscription ends on the next wallet read ──
const at = new Date(Date.UTC(2026, 8, 27, 12));
const due = new Date(at.getTime() - 60_000).toISOString();
const later = new Date(at.getTime() + 86_400_000).toISOString();
const wallet = {
  ...emptySlurpWallet(),
  coins: 500,
  subscriptions: {
    gone: { price: 30, paidThroughAt: due, cancelled: false },
    goneLater: { price: 30, paidThroughAt: later, cancelled: false },
    here: { price: 20, paidThroughAt: due, cancelled: false },
  },
} as never;
const renewal = renewSubscriptions(wallet, at, new Set(["gone", "goneLater"]));
assert.equal(renewal.wallet.coins, 480, "only the Creator that still exists is charged");
assert.deepEqual(Object.keys(renewal.wallet.subscriptions), ["here"]);
assert.deepEqual(
  renewal.renewed.map((entry) => entry.creatorAccountId),
  ["here"],
);
// Without the set nothing changes for existing Creators (old behaviour kept).
assert.equal(renewSubscriptions(wallet, at).wallet.coins, 450);
const economy2 = read("server/src/slp/data/economy/slp-economy-storage-2.ts");
assert.match(economy2, /getNoodlerAccountById\(creatorAccountId, \{ includeHidden: true \}\)\)\)\s*gone\.add/u);
assert.match(economy2, /renewSubscriptions\(stored, at, gone(?:, viewerAccountId)?\)/u);

// ── R1-101: a restore reloads everything and drops staged edits ──
const backup = read("client/src/slp/features/maintenance/SlpBackupPanel.tsx");
assert.match(
  backup,
  /followBackupJob\(job\);[\s\S]{0,200}page\.setDraftPatch\(\{\}\);\s*await queryClient\.invalidateQueries\(\{ queryKey: slpKeys\.all \}\)/u,
);

// ── R1-121: Reset on Prompts keeps saved presets and reusable instructions ──
for (const key of ["promptPresets", "promptInstructions"] as const) {
  assert.ok(!SLURP_SETTINGS_SECTION_KEYS.prompts.includes(key), key);
  assert.ok(SLURP_SETTINGS_NOT_RESET.includes(key), key);
}

// ── R1-005: the fee shows and plays only where the server charges it (no thread yet) ──
const composer = read("client/src/slp/features/messages/SlpThreadComposer.tsx");
const actions = read("client/src/slp/features/messages/slp-thread-actions.ts");
assert.match(composer, /const sendFee =\s*!ownsCreator &&\s*!thread &&/u);
assert.match(actions, /const feeDue = !thread;/u);
assert.doesNotMatch(composer + actions, /requestFeePaid <= 0/u);

// ── R1-006: tip and commission open the chat without the request fee; a share asks for a message first ──
const storageBase = read("server/src/slp/data/messages/slp-messages-storage-base.ts");
assert.match(storageBase, /requestFee: "charge" \| "waive" \| "refuse" = "charge"/u);
assert.match(storageBase, /requestFee === "refuse" && settings\.walletEnabled && admission\.fee > 0/u);
assert.match(storageBase, /admission\.fee > 0 && requestFee === "charge"\)/u);
assert.match(
  read("server/src/slp/data/messages/slp-messages-storage-actions.ts"),
  /async tipInThreadUnlocked[\s\S]{0,300}openThread\(viewerAccountId, creatorAccountId, "viewer", "waive"\)/u,
);
assert.match(
  read("server/src/slp/data/messages/slp-messages-storage-commissions.ts"),
  /openThread\(viewerAccountId, creatorAccountId, "viewer", "waive"\)/u,
);
const sendRoutes = read("server/src/slp/features/messages/slp-messages-send-routes.ts");
assert.match(sendRoutes, /openThread\(viewer\.id, creator\.id, "viewer", "refuse"\)/u);
assert.match(sendRoutes, /opened\.status === "fee_required"/u);

// ── R1-066: the shown price and the 402 check use the real charge (platform events included) ──
assert.match(economy2, /async getCreatorSubscriptionCharge\(creatorAccountId: string, at: Date = new Date\(\)\)/u);
// The feed prices every shown Creator in one batch with the same event-aware charge.
assert.match(
  read("server/src/slp/features/viewer/slp-viewer-context.ts"),
  /noodle\.getCreatorSubscriptionCharges\(visibleAccounts\)/u,
);
assert.match(
  economy2,
  /async getCreatorSubscriptionCharges\([\s\S]*?slurpSubscriptionCharge\([\s\S]*?slurpPlatformEventModifierSource\(settings\.platformEvents/u,
);
assert.match(
  read("server/src/slp/features/economy/slp-wallet-routes.ts"),
  /noodle\.getCreatorSubscriptionCharge\(creator\.id\),\s*\]\);\s*if \(wallet\.coins < price\)/u,
);

console.log("slurp2 fix1 money and data regression passed");
