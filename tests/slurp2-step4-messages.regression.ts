import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { initials } from "../packages/slurp2/src/engine/packages/client/src/slp/base/chrome/slp-initials";
import {
  slurpBubbleGroup,
  slurpBubbleRadius,
} from "../packages/slurp2/src/engine/packages/client/src/slp/features/messages/slp-bubble-group";

// Redesign step 4 (Messages): grouped runs without tails, no per-bubble heart buttons, the PPV as the
// shared locked tile with a spend moment, one commission component, drawers as sheets / a docked
// column, Clear conversation in the ⋮ menu, per-filter empty states, fixed initials, and the phone
// thread as a full-screen layer. The old composer bar and the tier icon stay (user correction).
const root = join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages/client/src/slp");
const client = (path: string) => readFileSync(join(root, path), "utf8");

// ── B29: initials skip quotes and brackets ──
assert.equal(initials('Jonas "Jojo" Brandtner-Okonkwo'), "JB");
assert.equal(initials("Isa (your Creator)"), "IC");
assert.equal(initials("Mira Vale"), "MV");
assert.equal(initials("Fan_4821"), "F");
assert.equal(initials("  "), "N");
assert.equal(initials("éla"), "É");

// ── Grouped runs: one burst per sender within three minutes, broken by the unread line ──
const at = (minute: number) => new Date(Date.UTC(2026, 8, 26, 10, minute)).toISOString();
const msg = (id: string, role: "viewer" | "creator", minute: number, kind = "text") => ({
  kind: "message",
  at: at(minute),
  message: {
    id,
    role,
    kind,
    createdAt: at(minute),
    metadata: {},
  } as never,
});
const run = [
  msg("a", "creator", 0),
  msg("b", "creator", 1),
  msg("c", "creator", 2),
  msg("d", "viewer", 2),
  msg("e", "creator", 10),
  msg("f", "creator", 11, "ppv"),
  msg("g", "creator", 12),
  msg("h", "creator", 12),
];
assert.deepEqual(
  run.map((_, index) => slurpBubbleGroup(run, index, null)),
  ["first", "middle", "last", "single", "single", "single", "first", "last"],
);
assert.equal(slurpBubbleGroup(run, 0, "b"), "single", "the unread line ends the run above it");
assert.equal(slurpBubbleGroup(run, 1, "b"), "first", "and starts a new one");
assert.equal(slurpBubbleGroup(run, 2, "b"), "last");
// Smaller corners only on the sender's side, where the run continues; a single bubble is round.
assert.equal(slurpBubbleRadius("single", false), "1.25rem 1.25rem 1.25rem 1.25rem");
assert.equal(slurpBubbleRadius("first", false), "1.25rem 1.25rem 1.25rem 0.4rem");
assert.equal(slurpBubbleRadius("middle", true), "1.25rem 0.4rem 0.4rem 1.25rem");
assert.equal(slurpBubbleRadius("last", true), "1.25rem 0.4rem 1.25rem 1.25rem");

// ── Bubbles: no tail (B30), no heart button per bubble, one heart badge (B31), token colours ──
const bubble = client("features/messages/SlpMessageBubble.tsx");
assert.doesNotMatch(bubble, /SlurpBubbleTail|<svg/u, "no tail");
assert.doesNotMatch(bubble, /text-red-500|aria-pressed=\{hearted\}/u, "no raw red, no per-bubble heart button");
assert.equal(bubble.match(/<SlpHeartGlyph size=\{12\} filled/gu)?.length, 1, "one heart badge");
assert.match(bubble, /SLURP_DOUBLE_TAP_MS/u);
assert.match(bubble, /onContextMenu/u, "long press / right click opens the reaction sheet");
assert.match(bubble, /<SlpSheet[\s\S]*?kind="menu"[\s\S]*?anchorRef=\{bubbleRef\}/u);
assert.match(bubble, /playSlpPop\(badgeRef\.current\)/u, "a heart Pops");
// PPV: the shared locked tile, one tap, spend moment, veil dissolves; no confirm dialog.
assert.match(bubble, /<SlpLockedMediaTile/u);
assert.doesNotMatch(bubble, /showConfirmDialog/u, "no spend confirmation");
assert.match(bubble, /await unlock\.mutateAsync[\s\S]*?playSlpSpendMoment\(origin\);\s+setDissolving\(true\)/u);
assert.match(bubble, /slp-veil-dissolve/u);

// ── Thread: grouped runs wired, one centred column, a phone full-screen layer that takes taps ──
const view = client("features/messages/SlpThreadView.tsx");
assert.match(view, /group=\{slurpBubbleGroup\(visibleTimeline, index, firstUnreadMessageId\)\}/u);
assert.match(view, /pointer-events-auto fixed inset-0/u, "the portal root lets taps through, the layer takes them");
assert.match(view, /useSlpMediaQuery\("\(min-width: 768px\)"\)/u);
assert.match(
  client("features/messages/slp-thread-view-model.ts"),
  /SLP_THREAD_COLUMN_CLASS = "mx-auto w-full max-w-\[45rem\]"/u,
);
// A thread in a roleplay scene shows its lock bar in the composer's place (docs/SCENES.md).
assert.match(
  view,
  /\{!notLoaded &&\s*\(sceneChatId \? \([\s\S]{0,160}?<SlpSceneLockBar[\s\S]{0,160}?<SlpThreadComposer model=\{model\} \/>/u,
  "no composer before the chat loads",
);

// ── Composer: the old pill bar and link picker stay (user); fee on Send; tools in a sheet ──
const composer = client("features/messages/SlpThreadComposer.tsx");
assert.match(composer, /rounded-\[1\.4rem\] bg-\[var\(--slurp-surface\)\] p-1/u, "the old composer bar");
assert.match(client("features/messages/SlpThreadChrome.tsx"), /<Link size=\{15\}/u, "the old connection picker");
assert.match(composer, /sendFee > 0 && <SlurpCoinAmount amount=\{sendFee\}/u);
assert.match(composer, /<SlpSheet\s+open=\{toolsOpen\}/u);
assert.match(composer, /<SlpChip key=\{value\} selected=\{requestHint === value\}/u, "a hint is a chip, not a primary");
assert.doesNotMatch(composer, /left-1\/2 z-10 mb-2/u, "scroll-to-latest no longer sits in the middle (B32)");
assert.doesNotMatch(composer, /absolute bottom-full end-3/u, "and it does not float over the chat: it has its own row");
assert.match(
  composer,
  /\{awayFromBottom && \(\s+\/\/[^\n]*\n[^\n]*\n\s+<div className=\{cn\(SLP_THREAD_COLUMN_CLASS, "flex justify-end pb-2"\)\}>/u,
);

// ── Header: tier icon kept (user), no balance chip (user), ⋮ ends with Clear conversation ──
const header = client("features/messages/SlpThreadHeader.tsx");
assert.match(header, /<SlurpRapportBadge rapport=\{thread\.rapport\}/u);
assert.doesNotMatch(header, /SlpBalanceChip/u);
assert.match(header, /<SlpSheetItem tone="danger"[\s\S]*?ui\.slurp\.messages\.clearConversation[\s\S]*?<\/SlpSheet>/u);
assert.doesNotMatch(client("features/messages/SlpMessageInsights.tsx"), /Clear conversation|onReset/u);

// ── Drawers: sheet on phones / tablets, docked column on desktop ──
const drawer = client("features/messages/SlpThreadDrawer.tsx");
assert.match(drawer, /useSlpMediaQuery\("\(min-width: 1280px\)"\)/u);
assert.match(drawer, /<SlpSheet open=\{Boolean\(drawerMode\)\}/u);
assert.doesNotMatch(drawer, /<dialog/u);

// ── Commission: one component; the next step is the primary ──
const commission = client("features/messages/commissions/SlpCommissions.tsx");
assert.match(commission, /compact = false/u);
assert.match(header, /<CommissionRow[\s\S]*?compact=\{!commissionRibbonOpen\}/u);
assert.match(
  commission,
  /const acceptButton = !ownsCreator && commission\.state === "quoted" && \(\s+<SlpPrimaryButton/u,
);
assert.match(commission, /playSlpSpendMoment\(origin\)/u);
assert.match(commission, /open \? \(\s+<SlpButton onClick=\{onAskCommission\}/u, "Ask is secondary while one is open");

// ── Inbox: B20 empty filters, one row component, the group recipe ──
const list = client("features/messages/SlpMessages.tsx");
assert.match(list, /noneForFilter \? \(/u);
assert.match(list, /ui\.slurp\.messages\.showAll/u);
const hub = client("app/screens/SlpScreenMessages.tsx");
assert.match(hub, /<ThreadRow[\s\S]*?toCreator=\{thread\.inboxSide === "creator"\}/u);
assert.doesNotMatch(
  hub,
  /text-sky-300|text-amber-300|text-emerald-300|text-violet-300|text-fuchsia-300/u,
  "token tints only",
);
assert.match(client("base/chrome/SlpChrome.tsx"), /export const SLP_GROUP_CLASS =/u);

// ── Tier ladder: the icons stay (user), labels wrap instead of being cut off (B33) ──
const insights = client("features/messages/SlpMessageInsights.tsx");
assert.doesNotMatch(
  insights.slice(insights.indexOf("export function SlurpTierLadder")),
  /w-full truncate text-center/u,
);
assert.match(insights, /const Icon = SLURP_TIER_ICONS\[step\];/u);
assert.match(insights, /hyphens-auto break-words text-center text-\[11px\]/u);

// ── Ambient canvas on phones too ──
assert.doesNotMatch(client("modules/chrome/SlpCanvasAmbient.tsx"), /hidden overflow-hidden/u);

console.log("slurp2 step 4 messages regression passed");
