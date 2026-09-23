import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { countSlurpUnreadThreads } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-unread-count.js";

const root = join(import.meta.dirname, "../packages/slurp2/src/engine/packages");
const read = (path: string) => readFileSync(join(root, path), "utf8");

// The lightweight inbox count must preserve both seats and the same self-Creator de-duplication
// as the full inbox, without needing hydrated thread views.
const rows = [
  { viewerAccountId: "viewer", creatorAccountId: "creator-a", viewerUnread: "2", creatorUnread: "9" },
  { viewerAccountId: "fan-a", creatorAccountId: "owned-creator", viewerUnread: "7", creatorUnread: "3" },
  { viewerAccountId: "owned-creator", creatorAccountId: "owned-creator", viewerUnread: "4", creatorUnread: "5" },
  { viewerAccountId: "fan-b", creatorAccountId: "other-creator", viewerUnread: "8", creatorUnread: "6" },
  { viewerAccountId: "viewer", creatorAccountId: "creator-b", viewerUnread: "invalid", creatorUnread: "1" },
  { viewerAccountId: "viewer", creatorAccountId: "creator-c", viewerUnread: "-5", creatorUnread: "1" },
  {
    viewerAccountId: "viewer",
    creatorAccountId: "declined-creator",
    state: "declined",
    viewerUnread: "7",
    creatorUnread: "0",
  },
  {
    viewerAccountId: "viewer",
    creatorAccountId: "missing-creator",
    creatorExists: false,
    viewerUnread: "11",
    creatorUnread: "0",
  },
];
assert.deepEqual(countSlurpUnreadThreads(rows, "viewer", ["owned-creator"]), {
  unread: 2,
  inboundUnread: 3,
});
assert.deepEqual(countSlurpUnreadThreads(rows, "another-viewer", []), { unread: 0, inboundUnread: 0 });

const homeState = read("client/src/slp/app/slp-home-state.ts");
assert.match(homeState, /useCreatorViewer\(viewerPersonaId, viewerSurfaceActive\)/u);
assert.match(homeState, /useCreatorConnectionCounts\(viewerSurfaceActive\)/u);
assert.match(
  homeState,
  /const profileWorkspaceActive =[\s\S]*?\["profiles", "create-profile"\]\.includes\(creatorView\)[\s\S]*?creationStep !== null[\s\S]*?editingProfileId !== null/u,
);
assert.match(homeState, /useCreatorEligibleAccounts\([\s\S]*?profileWorkspaceActive,/u);
assert.match(
  homeState,
  /useSlurpConnections\([\s\S]*?creatorView === "create-profile"[\s\S]*?creationStep === "draft"[\s\S]*?editingProfileId !== null/u,
);
assert.doesNotMatch(homeState, /useSlurpNotifications|useSlurpThreads/u);
assert.match(homeState, /useSlurpNotificationUnseenCount\(viewerPersonaId\)/u);
assert.match(homeState, /useSlurpUnreadCount\(viewerPersonaId\)/u);

const notificationHooks = read("client/src/slp/features/notifications/slp-notification-hooks.ts");
const messageHooks = read("client/src/slp/features/messages/slp-messages-hooks.ts");
for (const source of [notificationHooks, messageHooks]) {
  assert.match(source, /refetchInterval: personaId \? 30_000 : false/u);
  assert.match(source, /refetchIntervalInBackground: false/u);
}
assert.match(notificationHooks, /\/slurp2\/slurp\/notifications\/unseen-count/u);
assert.match(messageHooks, /\/slurp2\/messages\/unread-count/u);
assert.match(messageHooks, /invalidateQueries\(\{ queryKey: messageKeys\.unreadCount\(personaId\) \}\)/u);

const viewerHooks = read("client/src/slp/features/feed/slp-feed-viewer-hooks.ts");
const markSeen = viewerHooks.slice(
  viewerHooks.indexOf("export function useMarkCreatorFeedSeen"),
  viewerHooks.indexOf("export function useToggleCreatorSubscription"),
);
assert.match(markSeen, /setQueryData<SlpCreatorViewerScope/u);
assert.match(markSeen, /setQueryData\(slpKeys\.noodlerUnseenCount\(personaId\), \{ count: 0 \}\)/u);
assert.doesNotMatch(markSeen, /invalidateQueries|refetchQueries/u);
for (const hook of ["useToggleCreatorSubscription", "useToggleCreatorFollow", "useUnlockCreatorPost"]) {
  const start = viewerHooks.indexOf(`export function ${hook}`);
  const next = viewerHooks.indexOf("export function ", start + 1);
  const source = viewerHooks.slice(start, next < 0 ? undefined : next);
  assert.match(source, /mergeSlurpViewerShell/u, `${hook} must apply the returned scope`);
  assert.match(source, /void qc\.invalidateQueries/u, `${hook} reconciliation must stay in the background`);
}

const notificationRoutes = read("server/src/slp/features/notifications/slp-notifications-routes.ts");
const unseenHandler = notificationRoutes.slice(
  notificationRoutes.indexOf('app.get("/slurp/notifications/unseen-count"'),
  notificationRoutes.indexOf('app.get("/slurp/notifications"'),
);
assert.match(unseenHandler, /countUnseen\(viewer\.id\)/u);
assert.doesNotMatch(unseenHandler, /catchUpWorld|resolveActors|listRecent/u);
assert.match(unseenHandler, /reply\.code\(404\)/u);

const messageRoutes = read("server/src/slp/features/messages/slp-messages-thread-routes.ts");
const unreadHandler = messageRoutes.slice(
  messageRoutes.indexOf('app.get("/messages/unread-count"'),
  messageRoutes.indexOf('app.get("/messages/threads"'),
);
assert.match(unreadHandler, /messages\.countUnread\(\s*viewer\.id,\s*operatedCreatorAccountIds,\s*accounts\.map/u);
assert.match(unreadHandler, /sourceKind === "persona"[\s\S]*?sourceEntityId === viewer\.id/u);
assert.doesNotMatch(unreadHandler, /population|listCommissions|listThreadsFor/u);
assert.match(unreadHandler, /reply\.code\(404\)/u);

const storage = read("server/src/slp/data/messages/slp-messages-storage-base.ts");
assert.match(storage, /select\(\{[\s\S]*?viewerUnread:[\s\S]*?creatorUnread:[\s\S]*?\}\)[\s\S]*?from\(slurpThreads\)/u);
const fallback = read("server/src/slp/data/messages/slp-messages-storage-facet.ts");
assert.match(fallback, /countUnread: \(\) => \(\{ unread: 0, inboundUnread: 0 \}\)/u);

console.log("slurp2 everyday UI performance regression: ok");
