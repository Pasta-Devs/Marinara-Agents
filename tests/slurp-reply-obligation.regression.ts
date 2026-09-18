// A creator answered the fan, and nothing recorded that the answer had happened. `creatorUnread`
// stayed above zero, so `listThreadsAwaitingReply` handed the same thread back to the queued-reply
// scheduler every minute and the creator re-answered the same message about a hundred times before
// the fan spoke again.
import assert from "node:assert/strict";
import { readSlurpDmReply } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-dm-response.js";
import { slurp2Source } from "./slurp2-source";

const storage = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/services/storage/slurp-messages.storage.ts",
);
const scheduler = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-message-scheduler.service.ts",
);
const replyMethods = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/services/storage/slurp-reply-methods.ts",
);

// The obligation is `needsReply` plus a fan message to answer. Requiring the fan to have spoken
// last stranded threads where a delayed bubble or follow-up was stored after the fan's message.
assert.match(replyMethods, /if \(await latestViewerMessageId\(thread\.id\)\) ready\.push\(thread\);/u);
assert.doesNotMatch(replyMethods, /newest\?\.role === "viewer"/u);
// A creator who has walked away is not answered once a minute either.
assert.match(replyMethods, /!thread\.coolUntil \|\| thread\.coolUntil <= nowIso/u);

// Storing the reply also discharges the obligation it answers, so the inbox badge and the fan's
// read receipt stop lying. A message that landed while the reply was being written is a fresh
// obligation and stays unread.
assert.match(storage, /creatorUnread:[\s\S]*?newerViewerMessage[\s\S]*?: "0"/u);
assert.match(storage, /needsReply: newerViewerMessage \? "true" : "false"/u);
assert.match(storage, /if \(!newerViewerMessage\) \{[\s\S]*?readAt: timestamp/u);
assert.match(storage, /generationEpoch:[\s\S]*?\+ 1/u);
assert.match(replyMethods, /status: "completed"[\s\S]*?messageId/u);

// The scheduler answers the fan's newest message, not any older unread one it can still find.
assert.match(scheduler, /const triggerMessageId = await storage\.latestViewerMessageId\(thread\.id\);/u);
assert.doesNotMatch(scheduler, /findLast/u);

const parsedFollowUp = readSlurpDmReply({
  content: "I will send that tonight.",
  followUp: { type: "promise_delivery", timing: "tonight", reason: "send the file" },
});
assert.equal(parsedFollowUp.followUp?.type, "promise_delivery");
assert.equal(parsedFollowUp.followUp?.reason, "send the file");

console.log("slurp reply obligation regression passed");
