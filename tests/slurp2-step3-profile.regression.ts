import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { formatUpcomingDay } from "../packages/slurp2/src/engine/packages/client/src/slp/base/ui/slp-date-time";
import { slpProfileSubscriptionState } from "../packages/slurp2/src/engine/packages/client/src/slp/features/economy/slp-economy-subscription-state";

// Redesign step 3: Creator profile (hero / compact header, action row variants, tip sheet, paywall
// and subscription states, tabs, Creator tools card, storyline card, locked card), plus the step 2
// follow-ups (no "Latest Sauce" row, calmer seen Stories).
const slp = join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages/client/src/slp");
const src = (path: string) => readFileSync(join(slp, path), "utf8");
const surface = src("features/creators/SlpProfileSurface.tsx");
const actions = src("app/screens/SlpProfileLeadingActions.tsx");
const screen = src("app/screens/SlpScreenProfile.tsx");
const cards = src("app/screens/SlpProfilePostCards.tsx");
const model = src("app/screens/slp-profile-view-model.ts");
const arcs = src("features/projects/SlpArcTimelineCard.tsx");
const locked = src("modules/post/SlpLockedPostCard.tsx");
const hub = src("app/screens/SlpScreenHub.tsx");
const tile = src("modules/story/SlpStoryTile.tsx");
const en = JSON.parse(src("locales/en.json")) as Record<string, string>;

// Subscription state, run for real: renewing, cancelled but paid, ended (a past subscribe or renew
// to this Creator in the ledger), never.
const until = "2026-10-02T10:00:00.000Z";
const wallet = (sub?: { cancelled?: boolean }, ledger: { kind: string; creatorAccountId?: string }[] = []) => ({
  subscriptions: sub ? { c1: { paidThroughAt: until, price: 30, ...sub } } : {},
  ledger: ledger.map((entry) => ({
    kind: entry.kind as "subscribe",
    amount: -30,
    at: until,
    ...(entry.creatorAccountId ? { binding: { viewerAccountId: "v", creatorAccountId: entry.creatorAccountId } } : {}),
  })),
});
assert.deepEqual(slpProfileSubscriptionState({ creatorId: "c1", subscribed: true, wallet: wallet({}) }), {
  kind: "active",
  until,
  price: 30,
});
assert.equal(
  slpProfileSubscriptionState({
    creatorId: "c1",
    subscribed: true,
    wallet: wallet({ cancelled: true }),
    // Step 3.2: the state reads the clock (past `until` a cancelled one has ended), so pin "now".
    at: new Date("2026-09-28T10:00:00.000Z"),
  }).kind,
  "cancelled",
);
assert.equal(
  slpProfileSubscriptionState({
    creatorId: "c1",
    subscribed: false,
    wallet: wallet(undefined, [{ kind: "renew", creatorAccountId: "c1" }]),
  }).kind,
  "ended",
);
assert.equal(
  slpProfileSubscriptionState({
    creatorId: "c1",
    subscribed: false,
    wallet: wallet(undefined, [{ kind: "subscribe", creatorAccountId: "c2" }, { kind: "tip" }]),
  }).kind,
  "none",
  "another Creator's subscription (or a tip) is not an ended subscription here",
);
assert.equal(slpProfileSubscriptionState({ creatorId: "c1", subscribed: false, wallet: null }).kind, "none");

// "renews Fri" inside the next six days, a date after that, and never a weekday for the past.
const now = Date.parse("2026-09-26T12:00:00.000Z");
assert.equal(formatUpcomingDay("2026-09-30T12:00:00.000Z", "en-US", now), "Wed");
assert.equal(formatUpcomingDay("2026-10-20T12:00:00.000Z", "en-US", now), "Oct 20");
assert.equal(formatUpcomingDay("2027-01-05T12:00:00.000Z", "en-US", now), "Jan 5, 2027");
assert.equal(formatUpcomingDay("2026-09-20T12:00:00.000Z", "en-US", now), "Sep 20");
assert.equal(formatUpcomingDay("not a date", "en-US", now), "");

// Step 3.2: the user picked big hero + pills, so the switch and the losing variants are gone.
assert.doesNotMatch(surface + actions, /SLP_PROFILE_LAYOUT|compact \?|icons \?/u);

// B36: status is a dot on the avatar (word for screen readers), not a floating chip.
assert.match(surface, /STATUS_DOT\[status\]/u);
assert.match(surface, /<span className="sr-only">\{statusLabel\}<\/span>/u);
// B37: no "Bio" eyebrow at all; honest stats (dash while loading, zeros left out, "New on Slurp").
assert.doesNotMatch(surface, /ui\.slurp\.profile\.bioLabel/u);
assert.match(surface, /value === null \? "–"/u);
assert.match(surface, /filter\(\(key\) => stats\[key\] !== 0\)/u);
assert.match(model, /const followerTotal = connectionCounts \? /u);
assert.match(model, /const profileLikeTotal = props\.isLoading\s+\? null/u);
// Sticky tabs need a clipping (not scrolling) root; counts only once known.
assert.match(surface, /overflow-x-clip/u);
assert.match(surface, /sticky top-0 z-20/u);
assert.match(screen, /const tabCount = \(count: number\) => \(isLoading \? null : count\)/u);

// B13: a paid request names its price and gets the room it needs; B26: closed messaging is disabled.
assert.match(actions, /messaging === "paid"\s+\? "grid-cols-\[auto_minmax\(0,1fr\)_auto\]"/u);
assert.match(actions, /disabled=\{messaging === "closed"\}/u);
// Viewer-scope price (B3) on every subscribe button.
assert.match(actions, /amount=\{slurpSubscriptionPriceOf\(viewerCreator\)\}/u);
assert.match(cards, /amount=\{slurpSubscriptionPriceOf\(viewerCreator\)\}/u);
// Tip: 5 / 10 / 25 / 50 bubbles, one tap sends, the sheet closes only when the tip landed.
assert.match(actions, /const TIP_AMOUNTS = \[5, 10, 25, 50\]/u);
assert.match(actions, /onSuccess: \(\) => \{\s+setTipOpen\(false\);\s+playSlpSpendMoment\(origin\);/u);
assert.doesNotMatch(actions, /showConfirmDialog\(\{[^}]*tip/iu, "no confirmation before a tip");
// Cancel names the date. Step 6.5 (orchestrator decision 1): one tap + an Undo toast replaces the
// "Keep subscription" confirm, like the Wallet.
assert.match(actions, /showSlpSubscriptionCancelledToast\(\{\s+localizeUi,\s+endsDay: until \? day\(until\) : null,/u);

// Paywall card for non-subscribers; Media shows locked teasers and no ⋯; Stories play in the viewer.
assert.match(cards, /<SlpPaywallCard model=\{model\} \/>/u);
assert.match(cards, /withMenu=\{false\}/u);
assert.match(cards, /<SlpLockedMediaTile/u);
assert.match(cards, /<SlurpMomentViewer/u);
assert.match(cards, /shape=\{activeTab === "media" \? "grid" : "posts"\}/u, "skeletons, not a spinner");
assert.match(cards, /ui\.slurp\.profile\.emptyTitle/u);

// Operator bits live in one collapsible Creator tools card under the tabs; storyline effects too.
assert.match(
  screen,
  /afterTabsContent=\{\s+editing \? null : \([\s\S]*?\{managedCreator && <SlpCreatorToolsCard model=\{model\} \/>\}/u,
);
assert.doesNotMatch(screen, /DisclosureBadge|HelpTooltip/u, "the identity chip left the fan header");
assert.doesNotMatch(arcs.slice(0, arcs.indexOf("export function SlurpArcEffectsList")), /effectLine/u);
assert.match(arcs, /text-\[13px\] leading-\[19px\]/u, "storyline text is 13 px");
assert.equal(en["ui.slurp.profile.creatorTools"], "Creator tools");

// Locked card: hero frame with a glint, ambient shimmer, sparkle lock, what's inside, one-tap subscribe.
assert.match(locked, /<SlpRingGlint \/>/u);
assert.match(locked, /<SlpSparkleLock \/>/u);
assert.match(locked, /<SlpLockedContentsChip count=\{photoCount\} \/>/u);
assert.match(src("modules/post/SlpLockedMedia.tsx"), /ui\.slurp\.locked\.photos/u);
assert.match(locked, /data-slurp-locked-subscribe[\s\S]*?runTransaction\("subscribe"/u);

// Step 2 follow-ups.
assert.doesNotMatch(hub, /ui\.slurp\.home\.latestDrops/u);
assert.match(tile, /!isNew && "opacity-80 saturate-\[0\.8\]/u);

console.log("slurp2 step 3 profile regression: ok");
