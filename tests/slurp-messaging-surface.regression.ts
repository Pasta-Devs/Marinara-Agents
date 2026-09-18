import assert from "node:assert/strict";
import { join } from "node:path";
import { slurp2BackstageSource } from "./slurp2-backstage-source";
import { slurp2Source } from "./slurp2-source";

const root = join(import.meta.dirname, "..");
const read = (path: string) => slurp2Source(join(root, "packages/slurp2/src/engine/packages", path));

const messages = read("client/src/components/slurp/SlurpMessages.tsx");
const settings = slurp2BackstageSource();
const home = read("client/src/components/slurp/SlurpHome.tsx");
const hooks = read("client/src/hooks/use-slurp.ts");
const messageRoutes = read("server/src/routes/slurp-messages.routes.ts");
const slurpRoutes = read("server/src/routes/slurp.routes.ts");
const messageStorage = read("server/src/services/storage/slurp-messages.storage.ts");
const replyScheduler = read("server/src/services/slurp/slurp-message-scheduler.service.ts");
const replyMethods = read("server/src/services/storage/slurp-reply-methods.ts");
const slurpStorage = read("server/src/services/storage/slurp.storage.ts");

assert.match(messages, /queued: "\{\{name\}\} is away"/u);
assert.match(messages, /CheckCheck/u, "seen messages must use the double-check receipt");
assert.match(messages, /defaultValue: message\.readAt \? "Seen" : "Delivered"/u);
assert.match(
  messages,
  /role="meter"\n\s+aria-label=\{localizeUi\("ui\.slurp\.messages\.relationshipLevel"/u,
  "the relationship symbol must open a relationship meter labelled by its translation key",
);
assert.match(
  messages,
  /role="menu"[^>]*bg-\[var\(--slurp-canvas,var\(--background\)\)\]/u,
  "the mobile menu must be opaque",
);
assert.match(messages, /defaultValue: "Get reply now"/u);
assert.doesNotMatch(
  messages,
  /has seen this/u,
  "a queued reply is not an immediate read receipt and must not claim the Creator has seen it",
);

// The creator-side messaging tools and the commission flow shipped as endpoints and hooks with no
// UI behind them. Every one of those hooks must be reachable from the Messages tab.
for (const hook of [
  "useSendSlurpCreatorPpv",
  "useBroadcastSlurpMessage",
  "useCreateSlurpCommission",
  "useQuoteSlurpCommission",
  "useAcceptSlurpCommission",
  "useDeliverSlurpCommission",
]) {
  assert.match(messages, new RegExp(hook, "u"), `Messages must use ${hook}`);
}

// A commission is only renderable if the thread carries it, which the thread reads did not do.
assert.match(messageStorage, /async listCommissionsForThread\(/u);
assert.match(
  messageRoutes,
  /commissions: withSuggestedQuotes\(\s*await messages\.listCommissionsForThread\(thread\.id\)/u,
);
assert.match(messageRoutes, /commissions: thread \? await messages\.listCommissionsForThread\(thread\.id\) : \[\]/u);
assert.match(hooks, /commissions: SlurpCommission\[\]/u);

// The ledger union had not caught up with the direct-message economy, so a PPV, commission, or
// request-fee line was typed as impossible while the server was already writing them.
for (const kind of ["messageRequest", "ppv", "commission"]) {
  assert.match(hooks, new RegExp(`\\| "${kind}"`, "u"), `the wallet ledger union must include ${kind}`);
}

// The wallet listed subscriptions by raw creator id, which named nothing to the player.
assert.match(
  home,
  /creatorById\.get\(creatorId\)\?\.displayName/u,
  "the wallet must resolve creator ids to display names",
);
assert.doesNotMatch(
  home,
  /<span className="min-w-0 truncate text-xs font-semibold">\{creatorId\}<\/span>/u,
  "the wallet must not render a bare creator id",
);

// Ambient profiles had no surface at all: the roster, the toggle, and the reroll are reachable.
assert.match(slurpRoutes, /app\.get\("\/ambient-profiles"/u);
assert.match(slurpRoutes, /app\.post\("\/ambient-profiles\/reroll"/u);
assert.match(slurpRoutes, /app\.post\("\/accounts\/:id\/post-draft"/u);
assert.match(settings, /AmbientProfilesPanel/u);
assert.match(settings, /useRerollAmbientProfiles/u);
assert.match(settings, /allowRandomUsers/u, "the ambient panel must expose the participation setting");

// The restored draft service imported a symbol its neighbour never re-exported, so it could not
// bundle. Nothing caught that while no route referenced it.
const draftService = read("server/src/services/slurp/slurp-invited-post-draft.service.ts");
assert.match(draftService, /import \{ noodlerSourceText \} from "\.\/slurp-prompt-safety\.js"/u);

// The inbox only ever listed threads the player opened. A fan writing to your Creator — or a
// commission the world opened on their behalf — created a thread nobody could reach, so the whole
// obligation layer produced obligations that were invisible.
assert.match(messageStorage, /async listThreadsForCreators\(/u);
assert.match(messageRoutes, /const inbound = await messages\.listThreadsForCreators\(operated\)/u);
assert.match(messageRoutes, /counterpartName:/u, "a Creator-side row must name the fan, not the Creator");
assert.match(messageRoutes, /counterpart,/u, "thread detail must return the inbound fan identity");
assert.match(messages, /ui\.slurp\.messages\.inbound/u, "the inbox must show Creator-side threads");
assert.match(messages, /const headerAccount = ownsCreator \? counterpart : creator/u);
assert.match(messages, /const headerProfileId = ownsCreator \? thread\?\.viewerAccountId : targetCreatorAccountId/u);
assert.match(messages, /const mine = ownsCreator \? message\.role === "creator" : message\.role === "viewer"/u);
// A thread the player opened with their own Creator must not appear on both sides.
assert.match(messageStorage, /if \(wanted\.has\(thread\.viewerAccountId\)\) continue;/u);

// ── Writing as the Creator ──────────────────────────────────────────────────
// The Creator's side of a conversation was generated and only generated. Once Creator-side threads
// became visible, the only composer on screen sent as the viewer — which would have opened a second
// conversation from the persona to their own Creator instead of answering the fan.
assert.match(messageRoutes, /app\.post\("\/messages\/creators\/:creatorAccountId\/reply"/u);
assert.match(messages, /if \(ownsCreator && thread\) \{/u, "a Creator-side send must go the other way");
// The model is the fallback, not the default.
assert.match(messageRoutes, /app\.post\("\/messages\/creators\/:creatorAccountId\/draft-reply"/u);
assert.match(messages, /useDraftSlurpCreatorReply/u);

// A fan the world sent must be answerable. Gating on personas alone left an obligation with no way
// to discharge it.
assert.match(messageStorage, /const counterpartExists =/u);
assert.match(messageStorage, /createSlurpPopulationStorage\(db\)\.get\(viewerAccountId\)/u);

// Delayed Creator bubbles must not erase a Viewer message that arrived after the batch started.
assert.match(messageStorage, /const currentRows = await tx\.select\(\)\.from\(slurpThreads\)/u);
assert.match(messageStorage, /newerViewerMessage/u);
assert.match(
  messageStorage,
  /creatorUnread:[\s\S]*?input\.role === "viewer"[\s\S]*?current\.creatorUnread[\s\S]*?: "0"/u,
);
assert.match(
  replyMethods,
  /for \(const thread of candidates\)/u,
  "blocked old threads must not starve later ready threads",
);
assert.doesNotMatch(replyMethods, /candidates\.slice\(/u);
assert.match(messageStorage, /generationEpoch:[\s\S]*?needsReply:/u);
assert.match(messageStorage, /nextCursor:/u);
assert.match(
  replyScheduler,
  /bubble\.senderAccountId !== thread\.creatorAccountId[\s\S]*?await replyQueue\.remove\(bubble\.id\)/u,
  "queued bubbles from a different Creator must be discarded",
);
assert.match(slurpStorage, /slurpMessages,[\s\S]*?slurpReplyBubbles,[\s\S]*?slurpCommissions/u);

// The composer connection switcher is the compact icon button on every viewport, not a desktop-only label pill.
assert.match(
  messages,
  /function SlurpConnectionSwitcher[\s\S]*?"flex h-10 w-10 items-center[\s\S]*?<Link size=\{15\}[^>]*\/>\s*<\/button>/u,
);

// Every sent message carries its own delivered/seen receipt, not only the newest one.
assert.doesNotMatch(messages, /showReceipt|lastOwnMessageId/u);
// An away Creator never shows typing dots before the away block, and the block is an animation.
assert.match(messages, /availability\?\.online !== false\) setTyping\(true\)/u);
// The away state is a real status card: animation, Away label, headline, and detail text.
assert.match(messages, /<SlurpAwayAnimation[\s\S]{0,900}?ui\.slurp\.messages\.awayTitle\./u);
assert.doesNotMatch(messages, /SLURP_AWAY_STATUSES\.has\(waitingNote\)\) && "sr-only"/u);
assert.match(
  messages,
  /aria-labelledby=\{[\s\S]{0,180}"slurp-away-title"[\s\S]{0,180}aria-describedby="slurp-away-detail"/u,
);
assert.match(messages, /<Avatar account=\{account\} size="lg" \/>/u);
assert.match(messages, /className="slurp-away-moon/u);
assert.match(messages, /@media \(prefers-reduced-motion: reduce\)/u);
// Creators stay online a while after a reply, and longer after delivering a commission.
const serverRoot = "server/src/services/";
assert.match(read(`${serverRoot}slurp/slurp-conversation-momentum.ts`), /SLURP_ONLINE_AFTER_REPLY_MINUTES = 5;/u);
assert.match(read(`${serverRoot}slurp/slurp-conversation-momentum.ts`), /SLURP_ONLINE_AFTER_DELIVERY_MINUTES = 10;/u);
assert.match(
  read(`${serverRoot}slurp/slurp-message.operation.ts`),
  /keepOnlineFor\(thread\.id, Math\.max\(SLURP_ONLINE_AFTER_REPLY_MINUTES/u,
);
assert.match(
  read(`${serverRoot}storage/slurp-messages.storage.ts`),
  /delivered\?\.state === "delivered"[\s\S]{0,120}keepOnlineFor\(delivered\.threadId, SLURP_ONLINE_AFTER_DELIVERY_MINUTES\)/u,
);
assert.doesNotMatch(read("client/src/localization/locales/en.json"), /estimated from recent activity/u);
// The tier scale shows every tier as an icon with its name, in the header popover and the details panel.
assert.equal(messages.match(/<SlurpTierLadder /gu)?.length, 2);
// Popovers portal into the package's scoped root, or the @scope-d stylesheet never reaches them.
assert.match(read("client/src/components/slurp/NoodleAnchoredPopover.tsx"), /portalContainer \?\? document\.body/u);
// Back from a chat opened elsewhere returns there instead of dropping into the list.
assert.match(messages, /openedDirectly\.current && onExit/u);
assert.match(
  read("client/src/components/slurp/SlurpHome.tsx"),
  /view: "messages", creatorAccountId, returnTo: navigation/u,
);

// The plus menu is one action surface. It must not introduce an inner tab or second window.
assert.doesNotMatch(messages, /Back to message actions/u);
assert.match(messages, /aria-label="Message actions"/u);
// A standalone tip becomes a platform-style chat card only after the tip mutation resolves.
assert.match(messages, /setStandaloneTip\(result\.message\)/u);
assert.match(messages, /<SlurpPlatformActionCard message=\{entry\.message\}/u);
assert.match(messages, /Relationship: \{\{tier\}\}/u);
// Photo actions share one upload/generate surface and require review before either mutation runs.
assert.match(messages, /const \[reviewing, setReviewing\] = useState\(false\)/u);
assert.match(messages, /onClick=\{\(\) => setReviewing\(true\)\}/u);
assert.match(messages, /A photo taken by the viewer persona/u);
// Requests offer guidance without requiring an existing reply obligation or promising an outcome.
assert.match(messages, /requestHintGuidance\(requestHint\)/u);
assert.match(messages, /disabled=\{busy \|\| requestReply\.isPending\}/u);
assert.match(messages, /Ask for a photo/u);
assert.match(messages, /Ask about paid content/u);
assert.match(messages, /Ask for a follow-up/u);
console.log("slurp messaging surface regression passed");
