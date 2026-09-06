import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const home = readFileSync("packages/slurp/src/engine/packages/client/src/components/slurp/SlurpHome.tsx", "utf8");
const shell = readFileSync("packages/slurp/src/engine/packages/client/src/components/slurp/SlurpShell.tsx", "utf8");
const english = readFileSync("packages/slurp/src/engine/packages/client/src/localization/locales/en.json", "utf8");

assert.match(english, /"ui\.slurp\.navigation\.messages": "Inbox"/u);
assert.match(home, /ui\.slurp\.inbox\.chats/u);
assert.match(home, /ui\.slurp\.inbox\.activity/u);
assert.doesNotMatch(shell, /onOpenNotifications/u);
assert.match(home, /ui\.slurp\.wallet\.creatorEarnings/u);
assert.match(home, /ui\.slurp\.wallet\.fanWallet/u);
assert.match(home, /creatorAccountId: creator\.id, personaId, amount: creator\.payoutAllowance/u);
assert.match(home, /ui\.slurp\.wallet\.moveToWallet/u);
assert.match(home, /ledgerMode === "earnings" \? \(creator\?\.earnings\.ledger \?\? \[\]\)/u);
assert.match(home, /<Avatar[\s\S]*?creator\?\.avatarUrl/u);

console.log("slurp Inbox and Wallet regression passed");
