// A creator answered the fan, and nothing recorded that the answer had happened. `creatorUnread`
// stayed above zero, so `listThreadsAwaitingReply` handed the same thread back to the queued-reply
// scheduler every minute and the creator re-answered the same message about a hundred times before
// the fan spoke again.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const storage = readFileSync(
  "packages/slurp/src/engine/packages/server/src/services/storage/slurp-messages.storage.ts",
  "utf8",
);
const scheduler = readFileSync(
  "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-message-scheduler.service.ts",
  "utf8",
);

// The obligation is "the fan spoke last", read off the messages themselves. A counter that only
// grows cannot state it, and that counter was the whole bug.
assert.match(storage, /const \[newest\] = await storage\.listMessages\(thread\.id, 1\);/u);
assert.match(storage, /newest\?\.role === "viewer" \? thread : null/u);
// A creator who has walked away is not answered once a minute either.
assert.match(storage, /!thread\.coolUntil \|\| thread\.coolUntil <= nowIso/u);

// Storing the reply also discharges the obligation it answers, so the inbox badge and the fan's
// read receipt stop lying. A message that landed while the reply was being written is a fresh
// obligation and stays unread.
assert.match(storage, /creatorUnread: newerViewerMessage \? current\.creatorUnread : "0"/u);
assert.match(storage, /if \(!newerViewerMessage\) \{[\s\S]*?readAt: timestamp/u);

// The scheduler answers the newest message, not any older unread one it can still find.
assert.match(scheduler, /const \[trigger\] = await storage\.listMessages\(thread\.id, 1\);/u);
assert.doesNotMatch(scheduler, /findLast/u);

console.log("slurp reply obligation regression passed");
