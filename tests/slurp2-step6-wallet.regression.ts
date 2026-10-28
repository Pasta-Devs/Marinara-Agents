import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  formatDayHeading,
  groupSlpByDay,
  slpDayKey,
} from "../packages/slurp2/src/engine/packages/client/src/slp/base/ui/slp-date-time";
import {
  emptySlurpWallet,
  spend,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/economy/slp-wallet.js";

// Redesign step 6 (Wallet & spends): hero Wallet card with coin rain, one "Collect" card shared by
// Wallet and Studio, subscriptions as rows with one-tap Cancel + Undo, the ledger grouped by day,
// no spend confirmations left (chat tip, paid first message), and gamble outcomes that land in the
// ledger with the real amount.
const engine = join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages");
const client = (path: string) => readFileSync(join(engine, "client/src/slp", path), "utf8");
const server = (path: string) => readFileSync(join(engine, "server/src/slp", path), "utf8");
const en = JSON.parse(client("locales/en.json")) as Record<string, string>;

// ── Day headings: Today / Yesterday from Intl, then a short date; the year only for another year ──
const now = new Date(2026, 8, 27, 0, 30).getTime(); // Sun Sep 27 2026, 00:30 local
const at = (day: number, hour: number) => new Date(2026, 8, day, hour, 0).toISOString();
assert.equal(formatDayHeading(at(27, 0), "en", now), "Today");
assert.equal(formatDayHeading(at(26, 23), "en", now), "Yesterday", "an hour ago can be yesterday");
assert.equal(formatDayHeading(at(25, 12), "en", now), "Fri, Sep 25");
assert.equal(formatDayHeading(new Date(2025, 11, 31, 12).toISOString(), "en", now), "Wed, Dec 31, 2025");
assert.equal(formatDayHeading(at(27, 0), "de", now), "Heute", "every locale gets its own word");
assert.equal(formatDayHeading("nope", "en", now), "");
assert.equal(slpDayKey(new Date(2026, 0, 5, 23, 59)), "2026-01-05");

// ── Grouping keeps runs of one local day, in the given (newest first) order ──
const entries = [at(27, 0), at(26, 23), at(26, 8), at(24, 9)].map((iso, index) => ({ at: iso, index }));
assert.deepEqual(
  groupSlpByDay(entries).map((group) => [group.day, group.items.map((item) => item.index)]),
  [
    ["2026-09-27", [0]],
    ["2026-09-26", [1, 2]],
    ["2026-09-24", [3]],
  ],
);
assert.deepEqual(groupSlpByDay([]), []);

// ── Unlock charge: a spend without a receipt id leaves no receipt, so the charge is the coin difference ──
const wallet = { ...emptySlurpWallet(), coins: 100 };
const charged = spend(wallet, "unlock", 75, new Date(), "gamble: p3");
assert.ok(charged);
assert.equal(charged.receipts["p3"], undefined, "no receipt is keyed by the post id");
assert.equal(wallet.coins - charged.coins, 75);
assert.equal(charged.ledger[0]?.note, "gamble: p3");
const unlockStorage = server("data/economy/slp-economy-storage-2.ts");
assert.match(unlockStorage, /chargedAmount = wallet\.coins - charged\.coins;/u);
assert.doesNotMatch(unlockStorage, /chargedAmount = Math\.abs\(charged\.receipts\[postId\]/u);
assert.match(unlockStorage, /freeOnUnaffordable \? `gamble: \$\{postId\}` : postId/u);

// ── Wallet: hero card, coin rain on a rising balance, never a made-up balance ──
const walletView = client("app/screens/SlpScreenWallet.tsx");
assert.match(walletView, /bg-\[image:var\(--slurp-hero\)\][\s\S]*?<SlpShimmer \/>/u, "hero gradient + shimmer");
assert.match(walletView, /slp-display[^"]*text-\[40px\]/u, "Fraunces balance");
assert.match(walletView, /liveCoins > previous && balanceRef\.current\)\s*playSlpCoinRain\(balanceRef\.current\)/u);
assert.match(walletView, /if \(!wallet\) \{[\s\S]*?<SlpErrorState[\s\S]*?<SlpSkeleton/u);
assert.match(client("modules/sparkle/SlpSparkle.tsx"), /export function playSlpCoinRain\(target: Element/u);

// ── One Collect card in Wallet and Studio; the old names are gone from en ──
assert.match(walletView, /<SlpCollectCard creator=\{creator\} personaId=\{personaId\} \/>/u);
// W: Studio's own-page half (with Collect) is the own profile's Dashboard sheet.
const studio = client("app/screens/SlpDashboard.tsx");
assert.match(studio, /<SlpCollectCard creator=\{creator\} personaId=\{personaId\} burst \/>/u);
assert.doesNotMatch(studio, /function SlurpPayoutRow|useSlurpPayout/u, "no second payout UI");
const collect = client("app/screens/SlpCollectCard.tsx");
assert.match(collect, /<SlpPrimaryButton[\s\S]*?ui\.slurp\.wallet\.collectAmount/u, "price on the button");
assert.equal(en["ui.slurp.wallet.collectAmount"], "Collect {{amount}} <coin/>");
for (const key of ["ui.slurp.studio.payout", "ui.slurp.wallet.moveToWallet"]) assert.equal(en[key], "Collect");
for (const [key, value] of Object.entries(en))
  if (/^ui\.slurp\.(wallet|studio|earnings)\./u.test(key))
    assert.doesNotMatch(value, /withdraw|move to wallet|moved (from|to)|top up/iu, `${key}: ${value}`);

// ── Subscriptions: rows, one-tap Cancel with Undo (resumes, no charge), Resume while cancelled ──
assert.match(
  walletView,
  // Step 6.5: the toast moved into the shared helper (profile + Discover use it too).
  /showSlpSubscriptionCancelledToast\(\{[\s\S]*?endsDay: day\(paidThroughAt\),\s+onUndo: \(\) => resume\(creatorAccountId\)/u,
);
assert.match(walletView, /subscription\.cancelled \? \([\s\S]*?ui\.slurp\.wallet\.resume/u);
assert.doesNotMatch(walletView, /showConfirmDialog/u, "no confirm sheet");
assert.equal(en["ui.slurp.wallet.cancelled"], "Subscription cancelled · ends {{day}}");

// ── Ledger: day groups, + in success, gamble rows with "Free" ──
assert.match(walletView, /groupSlpByDay\(activityEntries\)/u);
assert.match(
  walletView,
  /entry\.amount > 0 \|\| \(gamble && entry\.amount === 0\)\s*\? "text-\[var\(--slurp-success\)\]"/u,
);
assert.match(walletView, /entry\.note\?\.startsWith\("gamble:"\)/u);
assert.doesNotMatch(walletView, /(emerald|violet|fuchsia|sky|rose|amber)-(300|500)\/14/u, "token tints only");

// ── No spend confirmations left: chat tip and paid first message are one tap + spend moment ──
const threadActions = client("features/messages/slp-thread-actions.ts");
assert.doesNotMatch(threadActions, /showConfirmDialog/u);
assert.match(threadActions, /if \(sendOrigin\) playSlpSpendMoment\(sendOrigin\);/u);
assert.match(threadActions, /setToolsOpen\(false\);\s*if \(origin\) playSlpSpendMoment\(origin\);/u);
assert.equal(en["ui.slurp.messages.tipSendNow"], "Send {{amount}} <coin/>", "price on the chat tip button");

// ── Step 5 follow-ups: Discover ad wide (Q, 2026-09-28: 1.91:1 banner, was 16:9), search placeholder ──
assert.match(client("features/ads/SlpInlineAd.tsx"), /wide \? "" : "aspect-\[4\/5\] max-h-\[32rem\]"/u);
assert.match(client("features/ads/SlpInlineAd.tsx"), /style=\{wide \? \{ aspectRatio: "1\.91 \/ 1" \} : undefined\}/u);
assert.match(client("app/screens/SlpScreenHub.tsx"), /renderInlineAd\(inlineAdsQuery\.data\.items\[0\], true\)/u);
assert.equal(en["ui.noodle.noodlerhome.searchPostsOrCreators"], "Search Slurp");

console.log("slurp2 step 6 wallet regression passed");
