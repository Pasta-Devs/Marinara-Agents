/** October 2026 Discord bugs (packages/slurp2/docs/FEEDBACK-2026-10.md, B1-B3). */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readSlpSceneTurn } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/onboarding/slp-scene-prompt.ts";
import {
  SLURP_REPLY_BUBBLE_STALE_MS,
  slurpReplyBubbleStale,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-messaging.ts";

const server = join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages/server/src/slp");
const src = (path: string) => readFileSync(join(server, path), "utf8");

// ── B2: a DM stuck on "already writing back" ──
// A queued bubble long past its delivery time is stuck; it must not hold the thread busy.
const now = Date.parse("2026-10-06T12:00:00Z");
assert.equal(slurpReplyBubbleStale(new Date(now + 60_000).toISOString(), now), false, "still on its way");
assert.equal(slurpReplyBubbleStale(new Date(now - 30_000).toISOString(), now), false, "due a moment ago: next tick");
assert.equal(slurpReplyBubbleStale(new Date(now - SLURP_REPLY_BUBBLE_STALE_MS - 1).toISOString(), now), true);
assert.equal(slurpReplyBubbleStale("not a date", now), true, "a broken row cannot block either");
// One rule where every caller asks (Get reply now and the away-reply loop): stale bubbles are dropped.
const queue = src("data/messages/slp-reply-queue-storage.ts");
assert.match(
  queue,
  /async hasPending[\s\S]*?slurpReplyBubbleStale\(String\(row\.deliverAt\)\)[\s\S]*?delete\(slurpReplyBubbles\)/u,
);
// A bubble whose delivery keeps failing is dropped once it is stale, not retried forever.
assert.match(
  src("features/messages/slp-message-scheduler-service.ts"),
  /Failed to deliver bubble[\s\S]*?if \(slurpReplyBubbleStale\(bubble\.deliverAt\)\) await replyQueue\.remove\(bubble\.id\)/u,
);
// The reply claim is unique per thread, so stale claims of any Creator on the thread are cleared.
assert.match(
  src("data/messages/slp-reply-storage-methods.ts"),
  /const stale = await db\.select\(\)\.from\(slurpMessageClaims\)\.where\(eq\(slurpMessageClaims\.threadId, threadId\)\);/u,
);

// ── B3: Pulse stuck on "creating first post" after the posts exist ──
// The queue never writes a second first post: a Creator who posted since the job was queued is done.
const firstPosts = src("features/onboarding/slp-first-post-queue-service.ts");
assert.match(
  firstPosts,
  /const already = await slpLatestPostSince\(db, job\.creatorAccountId, job\.createdAt\);[\s\S]*?status: "generated", postId: already/u,
);
assert.ok(
  firstPosts.indexOf("slpLatestPostSince(db, job.creatorAccountId") <
    firstPosts.indexOf("generateAndApplyCreatorPost(db"),
  "checked before the model is called",
);
assert.match(
  firstPosts,
  /!row\.parentPostId && String\(row\.createdAt\) >= since/u,
  "top-level posts since the job only",
);
// Pulse shows a queued or running first-post job whose post exists as done, with that post to open.
const maintenance = src("features/maintenance/slp-maintenance-routes.ts");
assert.match(maintenance, /import \{ slpLatestPostSince \} from "\.\.\/onboarding\/slp-onboarding-contract\.js";/u);
assert.match(maintenance, /status: madeId \? "generated" : row\.status,[\s\S]*?postId: madeId \?\? row\.postId,/u);

// ── B1: a typed reply in the role-play sign-up was "lost" ──
// After the player's own line the turn is the newcomer's alone; a model that labels those lines with
// the newcomer's name, "Newcomer", or sends plain strings still answers.
const typed = { locked: [], allowedTags: [], disclosureMode: "open" as const, publicIdentity: null, writesHost: false };
const lines = (raw: unknown) => readSlpSceneTurn(raw, typed)?.lines ?? null;
assert.deepEqual(lines({ lines: [{ speaker: "Velvet", text: "Velvet it is." }] }), [
  { speaker: "newcomer", text: "Velvet it is." },
]);
assert.deepEqual(lines({ lines: [{ speaker: "Newcomer", text: "Sure!" }] }), [{ speaker: "newcomer", text: "Sure!" }]);
assert.deepEqual(lines({ lines: ["Okay, okay."] }), [{ speaker: "newcomer", text: "Okay, okay." }]);
assert.deepEqual(
  lines({
    lines: [
      { speaker: "narrator", text: "x" },
      { speaker: "host", text: "y" },
    ],
  }),
  null,
  "not a character",
);
// A turn that also writes the host keeps the labels strict.
assert.equal(readSlpSceneTurn({ lines: [{ speaker: "Velvet", text: "hi" }] }, { ...typed, writesHost: true }), null);
// One more try on an unusable answer before "The reply got lost".
assert.match(
  src("features/onboarding/slp-scene-turn-service.ts"),
  /const turn = \(await ask\(\)\) \?\? \(await ask\(\)\);\s*if \(!turn\) throw new Error\("The reply got lost\. Try again\."\);/u,
);

console.log("slurp2 feedback bugs regression passed");
