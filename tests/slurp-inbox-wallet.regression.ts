import assert from "node:assert/strict";
import { slurp2Source } from "./slurp2-source";

const home = slurp2Source("packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpHome.tsx");
const shell = slurp2Source("packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpShell.tsx");
const english = slurp2Source("packages/slurp2/src/engine/packages/client/src/slp/locales/en.json");
const store = slurp2Source("packages/slurp2/src/engine/packages/client/src/stores/slurp-package.store.ts");
const hooks = slurp2Source("packages/slurp2/src/engine/packages/client/src/hooks/use-slurp.ts");
const messages = slurp2Source("packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpMessages.tsx");
const messageStorage = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/services/storage/slurp-messages.storage.ts",
);
const routes = slurp2Source("packages/slurp2/src/engine/packages/server/src/routes/slurp.routes.ts");
const messageRoutes = slurp2Source("packages/slurp2/src/engine/packages/server/src/routes/slurp-messages.routes.ts");

assert.match(english, /"ui\.slurp\.navigation\.messages": "Inbox"/u);
assert.match(home, /function SlurpInboxHub/u);
assert.match(home, /slurp-inbox-messages/u);
assert.match(home, /slurp-inbox-activity/u);
assert.doesNotMatch(shell, /onOpenNotifications/u);
const inbox = home.slice(home.indexOf("function SlurpInboxHub("), home.indexOf("function SlurpPayoutRow("));
assert.doesNotMatch(inbox, /role="tablist"|role="tab"/u);
assert.doesNotMatch(inbox, /return \(\) => markSeen\(personaId\)/u, "opening Inbox must not mark Activity seen");
assert.match(inbox, /onClick=\{\(\) => markSeen\(personaId\)\}/u, "Activity keeps an explicit read action");
assert.match(store, /navigation\.view === "notifications"[\s\S]*?view: "notifications"/u);
assert.match(home, /initialActivity/u, "legacy Notifications navigation must focus Activity");
assert.match(home, /notificationsQuery\.data\?\.unseen/u);
assert.match(home, /threadsQuery\.data\?\.unread/u);
// Thread rows moved to the messages feature: the avatar and the counterpart name sit together there.
assert.match(
  slurp2Source("packages/slurp2/src/engine/packages/client/src/slp/features/messages/SlpMessages.tsx"),
  /<Avatar account=\{\{ displayName: thread\.creatorDisplayName[\s\S]*?\{thread\.creatorDisplayName\}/u,
);
// The per-avatar message-type badge was dropped from ThreadRow when it was extracted into the
// shared messages feature for the "calmer inbox" (1376912d7): Messages and Activity are now two
// separate sections, so a thread's avatar no longer needs a badge to say it is a message.
assert.match(messages, /active:scale-\[0\.96\]/u);
assert.match(home, /eventAppearance[\s\S]*?MessageCircle[\s\S]*?Coins[\s\S]*?Lock[\s\S]*?Crown/u);
assert.match(inbox, /event\.kind !== "message"/u, "message events must be removed from Activity");
assert.match(
  messageStorage,
  /recordCreatorEvent\(creatorAccountId, "commission_requested", \{[\s\S]*?subjectId: opened\.thread\.id/u,
);
assert.match(routes, /messages\.getCommission\(id\)[\s\S]*?commissionThreads\.set\(id, commission\.threadId\)/u);
assert.match(messageRoutes, /threads\.map\(\(thread\) => messages\.listCommissionsForThread\(thread\.id\)\)/u);
assert.match(messageRoutes, /listOpenCommissionsForCreator[\s\S]*?selectSlurpAttentionCommissions/u);
assert.match(inbox, /attentionCommissions/u);
assert.doesNotMatch(inbox, /render\(unseen[\s\S]*?render\(items/u, "Activity must render one deduplicated feed");
assert.match(messages, /workspace\?: boolean/u);
assert.match(home, /contextualRail="spanning"/u, "Inbox and Messages reclaim the contextual rail");
assert.doesNotMatch(messages.slice(0, messages.indexOf("export function BroadcastPanel")), /<BroadcastPanel/u);
assert.match(home, /<BroadcastPanel\s+creatorAccountId=\{creator\.id\}/u, "Broadcast belongs to each Studio Creator");
assert.doesNotMatch(messages, /\{infoOpen && relationship/u, "Details must not render inline");
// One sheet serves the prompt, memories and commissions drawers.
assert.match(
  slurp2Source("packages/slurp2/src/engine/packages/client/src/slp/features/messages/SlpThreadDrawer.tsx"),
  /<SlpSheet[\s\S]*?open=\{Boolean\(drawerMode\)\}/u,
  "Details and prompt diagnostics share a drawer",
);
assert.match(messages, /messageSearchMatches[\s\S]*?scrollIntoView/u, "conversation search must navigate to matches");
// Conversation search lives in the thread header now.
const threadHeader = slurp2Source(
  "packages/slurp2/src/engine/packages/client/src/slp/features/messages/SlpThreadHeader.tsx",
);
assert.match(threadHeader, /event\.key === "Escape"\) closeSearch\(\);/u);
assert.match(
  threadHeader,
  /closeSearch = \(\) => \{[\s\S]*?searchTriggerRef\.current\?\.offsetParent[\s\S]*?\.focus\(\);/u,
);
assert.match(messages, /id=\{entry\.kind === "message" \? `slurp-message-\$\{entry\.message\.id\}`/u);
assert.match(home, /ui\.slurp\.wallet\.creatorEarnings/u);
assert.match(home, /ui\.slurp\.wallet\.fanWallet/u);
assert.match(home, /creatorAccountId: creator\.id, personaId, amount: allowance/u);
assert.match(home, /ui\.slurp\.wallet\.collectAmount/u);
assert.match(home, /ledgerMode === "earnings" \? \(creator\?\.earnings\.ledger \?\? \[\]\)/u);
assert.match(home, /ledgerMode === "earnings"[\s\S]*?ui\.slurp\.earnings\.entry/u);
assert.match(home, /ui\.slurp\.wallet\.entry\.\$\{entry\.kind\}/u);
assert.match(home, /avatarCrop: profile\?\.avatarCrop/u, "each account keeps its own avatar crop");
assert.match(
  home,
  /const profile = creatorById\.get\(creatorId\)[\s\S]*?avatarUrl: profile\?\.avatarUrl/u,
  "subscriptions must remain avatar-led",
);
assert.match(home, /entryAppearance[\s\S]*?<EntryIcon/u, "transactions must remain icon-led");
assert.match(home, /wallet\?\.refillAvailable === true/u, "daily refill visibility must use server availability");
// The refill copy is driven by server availability alone; the old threshold string described a
// rule the client no longer applies, so pinning it kept a dead locale key alive.
assert.match(home, /const refillReady = wallet\?\.refillAvailable === true;/u);
assert.match(english, /"ui\.slurp\.wallet\.entry\.stipend": "Daily refill"/u);
assert.match(home, /creatorByHandle\.get\(normalized\)/u, "known Creator handles must render as names");
assert.match(home, /kind === "unlock" \|\| kind === "ppv"[\s\S]*?return null/u, "opaque post IDs must not render");
// The one-off tabs markup (aria-controls/aria-labelledby pointing at a tab/panel pair) was
// replaced by the shared, app-wide SlpSegment control, an accessible role="radiogroup" toggle.
assert.match(
  home,
  /<SlpSegment\s+label=\{localizeUi\("ui\.slurp\.wallet\.history"/u,
  "wallet history uses the shared accessible segmented control",
);
assert.match(hooks, /invalidateQueries\(\{ queryKey: \[\.\.\.slpKeys\.noodlerRoot\(\), "wallet"\] \}\)/u);
assert.doesNotMatch(home, /recipientPersonaId|withdrawalRecipient/u);

console.log("slurp Inbox and Wallet regression passed");
