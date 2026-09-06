import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const home = readFileSync("packages/slurp/src/engine/packages/client/src/components/slurp/SlurpHome.tsx", "utf8");
const shell = readFileSync("packages/slurp/src/engine/packages/client/src/components/slurp/SlurpShell.tsx", "utf8");
const english = readFileSync("packages/slurp/src/engine/packages/client/src/localization/locales/en.json", "utf8");
const store = readFileSync("packages/slurp/src/engine/packages/client/src/stores/slurp-package.store.ts", "utf8");
const hooks = readFileSync("packages/slurp/src/engine/packages/client/src/hooks/use-slurp.ts", "utf8");
const messages = readFileSync(
  "packages/slurp/src/engine/packages/client/src/components/slurp/SlurpMessages.tsx",
  "utf8",
);
const messageStorage = readFileSync(
  "packages/slurp/src/engine/packages/server/src/services/storage/slurp-messages.storage.ts",
  "utf8",
);
const routes = readFileSync("packages/slurp/src/engine/packages/server/src/routes/slurp.routes.ts", "utf8");

assert.match(english, /"ui\.slurp\.navigation\.messages": "Inbox"/u);
assert.match(home, /ui\.slurp\.inbox\.chats/u);
assert.match(home, /ui\.slurp\.inbox\.activity/u);
assert.doesNotMatch(shell, /onOpenNotifications/u);
assert.match(home, /role="tablist"/u);
assert.match(home, /role="tab"[\s\S]*?aria-selected=/u);
assert.match(home, /hidden=\{tab !== "chats"\}[\s\S]*?<SlurpMessagesView/u, "Chats must remain mounted across tabs");
assert.match(
  home,
  /if \(tab !== "activity" \|\| !personaId\) return;[\s\S]*?markSeen\(personaId\)/u,
  "opening Chats must not mark Activity seen",
);
assert.match(store, /state\.navigation\.view === "notifications"[\s\S]*?view: "notifications"/u);
assert.match(home, /initialTab="activity"/u, "legacy Notifications navigation must open Activity");
assert.match(home, /inboxThreadsQuery\.data\?\.unread[\s\S]*?notificationsQuery\.data\?\.unseenCount/u);
assert.match(messages, /<Avatar[\s\S]*?thread\.creatorDisplayName/u);
assert.match(messages, /active:scale-\[0\.96\]/u);
assert.match(home, /eventAppearance[\s\S]*?MessageCircle[\s\S]*?Coins[\s\S]*?Lock[\s\S]*?Crown/u);
assert.match(home, /group\.event\.kind === "message" \|\| group\.event\.kind === "commission_requested"/u);
assert.match(
  messageStorage,
  /recordCreatorEvent\(creatorAccountId, "commission_requested", \{[\s\S]*?subjectId: opened\.thread\.id/u,
);
assert.match(routes, /messages\.getCommission\(id\)[\s\S]*?commissionThreads\.set\(id, commission\.threadId\)/u);
assert.match(home, /items\.filter[\s\S]*?!unseenIds\.has/u, "Activity must not repeat unseen events");
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
assert.match(home, /aria-controls="slurp-wallet-history-panel"/u);
assert.match(home, /aria-labelledby=\{`slurp-wallet-history-\$\{ledgerMode\}-tab`\}/u);
assert.match(hooks, /invalidateQueries\(\{ queryKey: \[\.\.\.noodleKeys\.noodlerRoot\(\), "wallet"\] \}\)/u);
assert.doesNotMatch(home, /recipientPersonaId|withdrawalRecipient/u);

console.log("slurp Inbox and Wallet regression passed");
