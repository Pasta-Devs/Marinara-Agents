import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  readSlurpWallet,
  renewSubscriptions,
  resumeSubscription,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/economy/slp-wallet.js";
import { slpProfileSubscriptionState } from "../packages/slurp2/src/engine/packages/client/src/slp/features/economy/slp-economy-subscription-state";
import { holdNewSlpFeedPosts } from "../packages/slurp2/src/engine/packages/client/src/slp/features/feed/slp-feed-refresh";

// Redesign step 3.2: hero + pills only, fan cards on the Posts tab, Edit profile once, resume a
// cancelled subscription, no carousel arrows on locked media, own posts skip the "new posts" pill.
const root = join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages");
const src = (path: string) => readFileSync(join(root, path), "utf8");
const client = (path: string) => src(`client/src/slp/${path}`);

// ── Resume, run for real: no charge, no ledger line, same end date and price, renews again ──
const at = new Date("2026-09-26T12:00:00.000Z");
const paidThroughAt = "2026-10-01T12:00:00.000Z";
const cancelled = readSlurpWallet(
  JSON.stringify({
    coins: 500,
    ledger: [{ id: "s1", kind: "subscribe", amount: -30, at: "2026-09-24T12:00:00.000Z" }],
    subscriptions: { c1: { paidThroughAt, price: 30, cancelled: true }, c2: { paidThroughAt, price: 10 } },
  }),
);
const resumed = resumeSubscription(cancelled, "c1", at);
assert.deepEqual(resumed.subscriptions.c1, { paidThroughAt, price: 30 }, "the flag goes, the end date and price stay");
assert.equal(resumed.coins, cancelled.coins, "resuming inside the paid period charges nothing");
assert.deepEqual(resumed.ledger, cancelled.ledger, "and writes no ledger line");
assert.deepEqual(resumed.subscriptions.c2, cancelled.subscriptions.c2, "other subscriptions are untouched");
// Not cancelled, unknown, or already ended: nothing to resume (the same wallet object comes back).
assert.equal(resumeSubscription(resumed, "c1", at), resumed);
assert.equal(resumeSubscription(cancelled, "nobody", at), cancelled);
assert.equal(
  resumeSubscription(cancelled, "c1", new Date(paidThroughAt)),
  cancelled,
  "an ended period is a new charge",
);
// At the end date the resumed one renews (one charge, at the locked price); left cancelled, it lapses.
const later = new Date("2026-10-01T12:00:01.000Z");
const renewed = renewSubscriptions(resumed, later);
assert.deepEqual(
  renewed.renewed.find((entry) => entry.creatorAccountId === "c1"),
  { creatorAccountId: "c1", price: 30 },
);
assert.equal(renewed.wallet.coins, 500 - 30 - 10);
assert.deepEqual(renewSubscriptions(cancelled, later).lapsed, ["c1"]);

// The storage path: an existing, still-paid subscription resumes instead of returning early; the
// resume write happens before the idempotent return and never calls `spend`.
const storage = src("server/src/slp/data/economy/slp-economy-storage-1.ts");
const paidBranch = storage.slice(
  storage.indexOf("if (existing[0] && existingPaymentIsValid) {"),
  storage.indexOf("// Renewing an existing subscription whose paid period has run out."),
);
assert.match(
  paidBranch,
  /const resumed = resumeSubscription\(existingWallet, creatorAccountId, at\);\s+if \(resumed !== existingWallet\) await writeWallet\(viewerAccountId, resumed\);/u,
);
assert.doesNotMatch(paidBranch, /spend\(|creditEarningsNow/u, "no charge and no creator income for a resume");

// ── Client state: Resume until the end date, then the normal (paid) button ──
const wallet = (cancelledFlag: boolean) => ({
  subscriptions: { c1: { paidThroughAt, price: 30, ...(cancelledFlag ? { cancelled: true } : {}) } },
  ledger: [],
});
assert.deepEqual(slpProfileSubscriptionState({ creatorId: "c1", subscribed: true, wallet: wallet(true), at }), {
  kind: "cancelled",
  until: paidThroughAt,
  price: 30,
});
assert.equal(
  slpProfileSubscriptionState({ creatorId: "c1", subscribed: true, wallet: wallet(true), at: later }).kind,
  "ended",
  "past the end date a stale cancelled entry must not offer a free Resume",
);
assert.equal(
  slpProfileSubscriptionState({ creatorId: "c1", subscribed: true, wallet: wallet(false), at: later }).kind,
  "active",
  "a renewing subscription is not ended by the clock (the server renews it on read)",
);
const actions = client("app/screens/SlpProfileLeadingActions.tsx");
assert.match(actions, /const resumable = subscriptionState\.kind === "cancelled";/u);
assert.match(actions, /const subscribeButton = resumable \? \([\s\S]*?ui\.slurp\.profile\.resumeSubscription/u);
assert.match(actions, /\{renewing \? null : subscribeButton\}/u);
assert.equal(JSON.parse(client("locales/en.json"))["ui.slurp.profile.resumeSubscription"], "Resume subscription");

// ── Layout: hero + pills only; fan cards open the Posts tab; Edit profile once on the own page ──
const surface = client("features/creators/SlpProfileSurface.tsx");
const screen = client("app/screens/SlpScreenProfile.tsx");
assert.doesNotMatch(surface + actions, /SLP_PROFILE_LAYOUT|preTabsContent|HandCoins|UserPlus/u);
assert.match(screen, /\{activeTab === "posts" && \(goalForViewer \|\| arcsQuery\.data\?\.arcs\.length\) \? \(/u);
const tools = screen.slice(screen.indexOf("function SlpCreatorToolsCard"));
assert.match(
  tools,
  // Step 7: a world Creator's tools start with "New post" (the composer sheet), then Edit profile.
  /\{!viewingOwnCreator && \(\s*<div className="flex flex-wrap gap-2">\s*<SlpButton variant="quiet" onClick=\{\(\) => openComposer\(\)\}[\s\S]*?<\/SlpButton>\s*<SlpButton variant="quiet" onClick=\{onEdit\}/u,
);
assert.match(actions, /if \(viewingOwnCreator\) \{[\s\S]*?onClick=\{onEdit\}/u, "the own row keeps Edit profile");

// ── Locked media: no carousel arrows over the veil (hub and profile share the card) ──
assert.match(client("modules/post/SlpLockedPostCard.tsx"), /\{revealed && postImages\.length > 1 && \(/u);

// ── Feed: the reader's own new posts are never held behind the pill ──
const item = (id: string, minute: number, own = false) => ({
  id,
  own,
  post: { createdAt: `2026-09-26T12:${String(minute).padStart(2, "0")}:00.000Z` },
});
const feed = [item("mine", 12, true), item("theirs", 11), item("old", 5)];
const mark = Date.parse("2026-09-26T12:10:00.000Z");
const split = holdNewSlpFeedPosts(feed, mark, (entry) => entry.own);
assert.deepEqual(
  split.shown.map((entry) => entry.id),
  ["mine", "old"],
);
assert.deepEqual(
  split.held.map((entry) => entry.id),
  ["theirs"],
);
assert.equal(holdNewSlpFeedPosts(feed, mark).held.length, 2, "without the predicate nothing changes");
const hub = client("app/screens/SlpScreenHub.tsx");
// Fix phase 1 (R1-021): the server flags the persona's own Creator (the source id never reached the feed).
assert.match(hub, /\(\{ creator \}\) => \(creator as \{ ownedByViewer\?: boolean \}\)\.ownedByViewer === true,/u);
// The pill shows up to three posters' faces and pops two stars once (static under reduced motion).
assert.match(
  hub,
  /new Map\(heldPosts\.map\(\(\{ creator \}\) => \[creator\.profile\.id, creator\.profile\]\)\)[\s\S]*?\.slice\(\s*0,\s*3,?\s*\)/u,
);
assert.match(hub, /data-component="SlurpHome\.NewPosts"[\s\S]*?heldPosters\.map[\s\S]*?<SlpTwinkle/u);

console.log("slurp2 step 3.2 profile regression: ok");
