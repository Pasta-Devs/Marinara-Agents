import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const home = readFileSync("packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpHome.tsx", "utf8");
const shell = readFileSync("packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpShell.tsx", "utf8");
const english = readFileSync("packages/slurp2/src/engine/packages/client/src/localization/locales/en.json", "utf8");
const store = readFileSync("packages/slurp2/src/engine/packages/client/src/stores/slurp-package.store.ts", "utf8");
const hooks = readFileSync("packages/slurp2/src/engine/packages/client/src/hooks/use-slurp.ts", "utf8");
const messages = readFileSync(
  "packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpMessages.tsx",
  "utf8",
);
const messageStorage = readFileSync(
  "packages/slurp2/src/engine/packages/server/src/services/storage/slurp-messages.storage.ts",
  "utf8",
);
const routes = readFileSync("packages/slurp2/src/engine/packages/server/src/routes/slurp.routes.ts", "utf8");
const messageRoutes = readFileSync(
  "packages/slurp2/src/engine/packages/server/src/routes/slurp-messages.routes.ts",
  "utf8",
);

assert.match(english, /"ui\.slurp\.navigation\.messages": "Inbox"/u);
assert.match(home, /function SlurpInboxHub/u);
assert.match(home, /slurp-inbox-messages/u);
assert.match(home, /slurp-inbox-activity/u);
assert.doesNotMatch(shell, /onOpenNotifications/u);
const inbox = home.slice(home.indexOf("function SlurpInboxHub("), home.indexOf("function SlurpPayoutRow("));
assert.doesNotMatch(inbox, /role="tablist"|role="tab"/u);
assert.doesNotMatch(inbox, /return \(\) => markSeen\(personaId\)/u, "opening Inbox must not mark Activity seen");
assert.match(inbox, /onClick=\{\(\) => markSeen\(personaId\)\}/u, "Activity keeps an explicit read action");
assert.match(store, /state\.navigation\.view === "notifications"[\s\S]*?view: "notifications"/u);
assert.match(home, /initialActivity/u, "legacy Notifications navigation must focus Activity");
assert.match(home, /notificationsQuery\.data\?\.unseenCount[\s\S]*?inboxThreadsQuery\.data\?\.unread/u);
assert.match(inbox, /<MessageCircle[\s\S]*?<Avatar[\s\S]*?thread\.creatorDisplayName/u);
assert.match(inbox, /absolute -bottom-1 -end-1[\s\S]*?<MessageCircle/u, "every hub avatar needs a message badge");
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
assert.match(home, /<BroadcastPanel creatorAccountId=\{creator\.id\}/u, "Broadcast belongs to each Studio Creator");
assert.doesNotMatch(messages, /\{infoOpen && relationship/u, "Details must not render inline");
assert.match(messages, /<dialog[\s\S]*?drawerMode === "prompt"/u, "Details and prompt diagnostics share a drawer");
assert.match(messages, /messageSearchMatches[\s\S]*?scrollIntoView/u, "conversation search must navigate to matches");
assert.match(messages, /event\.key !== "Escape"[\s\S]*?searchTriggerRef\.current\?\.focus/u);
assert.match(messages, /id=\{entry\.kind === "message" \? `slurp-message-\$\{entry\.message\.id\}`/u);
assert.match(home, /ui\.slurp\.wallet\.creatorEarnings/u);
assert.match(home, /ui\.slurp\.wallet\.fanWallet/u);
assert.match(home, /creatorAccountId: creator\.id, personaId, amount: creator\.payoutAllowance/u);
assert.match(home, /ui\.slurp\.wallet\.moveToWallet/u);
assert.match(home, /ledgerMode === "earnings" \? \(creator\?\.earnings\.ledger \?\? \[\]\)/u);
assert.match(home, /ledgerMode === "earnings"[\s\S]*?ui\.slurp\.earnings\.entry/u);
assert.match(home, /ui\.slurp\.wallet\.entry\.\$\{kind\}/u);
assert.match(home, /creator \? creatorAvatarCrop : personaAvatarCrop/u);
assert.match(home, /creatorById\.get\(creatorId\)\?\.avatarUrl/u, "subscriptions must remain avatar-led");
assert.match(home, /entryAppearance[\s\S]*?<EntryIcon/u, "transactions must remain icon-led");
assert.match(home, /wallet\?\.refillAvailable === true/u, "daily refill visibility must use server availability");
// The refill copy is driven by server availability alone; the old threshold string described a
// rule the client no longer applies, so pinning it kept a dead locale key alive.
assert.match(home, /const refillReady = wallet\?\.refillAvailable === true;/u);
assert.match(english, /"ui\.slurp\.wallet\.entry\.stipend": "Daily refill"/u);
assert.match(home, /creatorByHandle\.get\(normalized\)/u, "known Creator handles must render as names");
assert.match(home, /kind === "unlock" \|\| kind === "ppv"[\s\S]*?return null/u, "opaque post IDs must not render");
assert.match(home, /aria-controls="slurp-wallet-history-panel"/u);
assert.match(home, /aria-labelledby=\{`slurp-wallet-history-\$\{ledgerMode\}-tab`\}/u);
assert.match(hooks, /invalidateQueries\(\{ queryKey: \[\.\.\.noodleKeys\.noodlerRoot\(\), "wallet"\] \}\)/u);
assert.doesNotMatch(home, /recipientPersonaId|withdrawalRecipient/u);

console.log("slurp Inbox and Wallet regression passed");
