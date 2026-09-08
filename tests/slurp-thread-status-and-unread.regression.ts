import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { slurpCreatorStatus } from "../packages/slurp/src/engine/packages/client/src/components/slurp/slurp-creator-status.js";

const read = (path: string) => readFileSync(path, "utf8");
const messagesStorage = read(
  "packages/slurp/src/engine/packages/server/src/services/storage/slurp-messages.storage.ts",
);
const messagesRoutes = read("packages/slurp/src/engine/packages/server/src/routes/slurp-messages.routes.ts");
const messagesUi = read("packages/slurp/src/engine/packages/client/src/components/slurp/SlurpMessages.tsx");
const homeUi = read("packages/slurp/src/engine/packages/client/src/components/slurp/SlurpHome.tsx");
const locale = JSON.parse(read("packages/slurp/src/engine/packages/client/src/localization/locales/en.json")) as Record<
  string,
  string
>;

// ── A creator reply clears the creator's own unread count ───────────────────
// Nothing else clears it server-side: `markRead` is only reached from routes the player's own UI
// calls. So a thread the creator had already answered stayed "awaiting reply" forever —
// `listThreadsAwaitingReply` returned it every minute, and the scheduler then skipped it because
// the newest message was the creator's own. A production thread sat at five unread with the
// creator's reply on top, and the badge never cleared.
assert.match(
  messagesStorage,
  /creatorUnread: input\.role === "viewer" \? String\(thread\.creatorUnread \+ 1\) : "0",/u,
  "a creator message must zero creatorUnread, not carry it forward",
);
// The other direction is deliberately untouched: a creator reply must not clear what the viewer
// has yet to read, which is a different count with a different owner.
assert.match(
  messagesStorage,
  /viewerUnread: input\.role === "creator" \? String\(thread\.viewerUnread \+ 1\) : String\(thread\.viewerUnread\),/u,
);
// The queue this feeds still only wants active threads with something unread.
assert.match(messagesStorage, /thread\.creatorUnread > 0 && \(!thread\.replyNotBeforeAt/u);

// ── Creator status reaches the message thread ───────────────────────────────
// The rule lived inline in the profile header, so the surface where a player most wants to know
// whether somebody is about to answer showed nothing at all.
assert.match(messagesRoutes, /creatorLastActiveAt: creatorLatestPost\?\.createdAt \?\? null,/u);
assert.match(messagesRoutes, /creatorAutoPosting: Boolean\(creator\?\.settings\.scheduler\.autoPosting\?\.enabled\),/u);
assert.match(messagesUi, /slurpCreatorStatus\(\{/u, "the thread header must derive a status");
assert.match(messagesUi, /ui\.slurp\.profile\.status\.\$\{creatorStatus\}/u);
// One rule, two callers. Two copies would drift.
assert.match(homeUi, /const creatorStatus = slurpCreatorStatus\(\{/u);
assert.doesNotMatch(homeUi, /activityAge <= 15 \* 60_000/u, "the inline copy of the rule must be gone");
for (const status of ["online", "away", "offline"]) {
  assert.ok(locale[`ui.slurp.profile.status.${status}`], `missing label for ${status}`);
}

// ── The rule itself ─────────────────────────────────────────────────────────
const now = Date.parse("2026-09-08T12:00:00.000Z");
const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();
assert.equal(slurpCreatorStatus({ lastActiveAt: ago(1), autoPostingEnabled: false }, now), "online");
assert.equal(slurpCreatorStatus({ lastActiveAt: ago(15), autoPostingEnabled: false }, now), "online");
assert.equal(slurpCreatorStatus({ lastActiveAt: ago(16), autoPostingEnabled: false }, now), "away");
assert.equal(slurpCreatorStatus({ lastActiveAt: ago(60 * 24), autoPostingEnabled: false }, now), "away");
assert.equal(slurpCreatorStatus({ lastActiveAt: ago(60 * 25), autoPostingEnabled: false }, now), "offline");
// Still scheduled to post is still around, however old the last one is.
assert.equal(slurpCreatorStatus({ lastActiveAt: ago(60 * 24 * 30), autoPostingEnabled: true }, now), "away");
// A Creator who has never posted is waiting to start, not abandoned — but only if something is
// actually going to make them post.
assert.equal(slurpCreatorStatus({ lastActiveAt: null, autoPostingEnabled: true }, now), "away");
assert.equal(slurpCreatorStatus({ lastActiveAt: null, autoPostingEnabled: false }, now), "offline");
// Unparseable input must not read as "posted at the epoch" or throw.
assert.equal(slurpCreatorStatus({ lastActiveAt: "not a date", autoPostingEnabled: false }, now), "offline");
assert.equal(slurpCreatorStatus({ lastActiveAt: 0, autoPostingEnabled: false }, now), "offline");

console.log("slurp thread status and unread regression: ok");
