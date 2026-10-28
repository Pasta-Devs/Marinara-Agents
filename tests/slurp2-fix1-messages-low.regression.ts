import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Fix phase 1, batch G (REVIEW-1 messages, low): R1-010, R1-011, R1-013, R1-014, R1-015, R1-016, R1-017,
// R1-018, R1-019. R1-016 follows the user's call (2026-09-27): no fixed wait between Creator pictures.
const pkg = join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages");
const read = (path: string) => readFileSync(join(pkg, path), "utf8");
const en = JSON.parse(read("client/src/slp/locales/en.json")) as Record<string, string>;
const operation = read("server/src/slp/features/messages/slp-message-operation.ts");

// R1-010: Requests shows requests only.
assert.match(
  read("client/src/slp/features/messages/SlpMessages.tsx"),
  /inbound\.filter\(\(thread\) => thread\.state === "request"\)/u,
);
// R1-011: Prompt details only where the route answers.
assert.match(
  read("client/src/slp/features/messages/SlpThreadDrawer.tsx"),
  /onOpenPrompt=\{threadId && ownsCreator \? \(\) => setDrawerMode\("prompt"\) : null\}/u,
);
// R1-013: AI off has its own status and copy.
assert.match(operation, /return \{ status: "ai_off" \};/u);
assert.ok(en["ui.slurp.messages.replyStatus.ai_off"]);
// R1-014: away replies off → owed, not a promised later reply.
assert.match(
  operation,
  /if \(!input\.background && !settingsForDelays\.messagesAwayRepliesEnabled\) return \{ status: "owed" \};/u,
);
// R1-015: the whole thread counts for the picture wait, and one draw at a time per thread.
const media = read("server/src/slp/features/messages/slp-messages-media-routes.ts");
assert.match(media, /listMessages\(thread\.id, 100_000\)/u);
assert.match(media, /drawingViewerPhotos\.has\(thread\.id\)/u);
// R1-016: no fixed gap between Creator pictures (user decision).
assert.doesNotMatch(operation, /recentGeneratedImage|3 \* 60 \* 60_000/u);
// R1-017: a PPV unlock short of coins says so.
assert.match(
  read("server/src/slp/features/messages/slp-messages-send-routes.ts"),
  /code\(402\)\.send\(\{ error: "Not enough coins\.", required: target\.price \}\)/u,
);
assert.match(read("client/src/slp/features/messages/SlpMessageBubble.tsx"), /slpErrorText\(\s*unlock\.error,/u);
// R1-018: Spent with them includes paid commissions.
assert.match(
  read("server/src/slp/data/messages/slp-messages-storage-actions.ts"),
  /facts\.tippedCoins \+ facts\.unlockedCoins \+ commissionCoins/u,
);
// R1-019: the photo tool speaks to the player.
const tools = read("client/src/slp/features/messages/SlpMessageTools.tsx");
assert.doesNotMatch(tools, /viewer persona/u);
assert.equal(en["ui.slurp.messages.photoDescribe"], "Describe the photo you took");

console.log("slurp2 fix1 messages low regression passed");
