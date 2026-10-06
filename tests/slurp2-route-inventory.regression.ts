import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Every Slurp2 HTTP route (method + path, relative to /api/slurp2), plus the one content-type
// parser. The route list below is the post-rename inventory. BASELINE is derived from it through
// the explicit mapping table, so a method change or a missing route cannot pass by rebaselining.
const EXPECTED = [
  // Roleplay scenes from a DM thread (docs/SCENES.md).
  "GET /messages/threads/:threadId/scene/origin",
  "POST /messages/threads/:threadId/scene/invite/:messageId/decline",
  "POST /messages/threads/:threadId/scene/plan",
  "POST /messages/threads/:threadId/scene/recap/:messageId/reach",
  // 0.3.5: the Slurp Support desk.
  "GET /slurp/desk",
  "POST /slurp/desk/note",
  "POST /slurp/desk/ticket/resolve",
  "POST /slurp/desk/offer/answer",
  "PATCH /messages/threads/:threadId/details",
  "GET /slurp/posts/:id/deep-details",
  "GET /continuity",
  "GET /continuity/:creatorAccountId",
  "GET /messages/threads/:threadId/requests",
  "GET /noodler/posts/:id/media/:position",
  "GET /slurp/tasks",
  "PATCH /continuity/facts/:id",
  "POST /continuity/:creatorAccountId/facts",
  "POST /continuity/from-chat",
  "GET /continuity/:creatorAccountId/signals",
  "GET /slurp/accounts/:id/canon-anchors",
  "PUT /slurp/accounts/:id/canon-anchors",
  "DELETE /slurp/accounts/:id/canon-anchors",
  // 7b0: the player's steering for a Creator (life, pace, ideas for the next posts).
  "GET /slurp/accounts/:id/steering",
  "PATCH /slurp/accounts/:id/steering",
  "POST /slurp/accounts/:id/steering/ideas",
  "DELETE /slurp/accounts/:id/steering/ideas/:ideaId",
  // 7b-1: the player's "Rewrite" answer after a steering change (prepared posts are written again).
  "POST /slurp/accounts/:id/steering/rewrite-prepared",
  // 7b-c: undo what a talk with Slurp Support changed, or keep it and hide the note.
  "POST /slurp/accounts/:id/steering/support-undo",
  "DELETE /slurp/accounts/:id/steering/support-note",
  // 3c: the action layer behind the AI assist (what Slurp can do for the player, and doing one thing).
  "GET /slurp/actions",
  "POST /slurp/actions/:name",
  // W: Stir (preview one action or a list, plain words → a plan, do a play, undo it, the Stir tab).
  "POST /slurp/actions/:name/preview",
  "POST /slurp/stir/preview",
  "POST /slurp/stir/plan",
  "POST /slurp/stir/play",
  "POST /slurp/stir/plays/:id/undo",
  // 0.3.1: "Not now" on a Stir suggestion.
  "POST /slurp/stir/suggestions/:id/dismiss",
  "GET /slurp/stir",
  // 7b-c: collabs, rivalries and brand deals in Studio.
  "GET /slurp/ties",
  "POST /slurp/ties/collabs",
  "POST /slurp/ties/collabs/:id/push",
  "POST /slurp/ties/collabs/:id/decline",
  "POST /slurp/ties/collabs/:id/block",
  "POST /slurp/ties/collabs/:id/drop",
  "POST /slurp/ties/collabs/:id/post-now",
  "POST /slurp/ties/unblock",
  "POST /slurp/ties/rivalries/:id/cool",
  "POST /slurp/ties/deals/:id/answer",
  // U: "Mark as posted" for a sponsored post the player's own page owes.
  "POST /slurp/ties/deals/:id/posted",
  // 7b-couples: set two Creators up, steer their story, open or close their shared page.
  "POST /slurp/ties/couples",
  "POST /slurp/ties/couples/:id/steer",
  "POST /slurp/ties/couples/:id/page",
  // 0.3.8 Drama: bonds on the People map; what runs, the player's answer, start and end (docs/DRAMA.md).
  "POST /slurp/ties/bonds",
  "POST /slurp/ties/bonds/:id/end",
  "GET /slurp/drama",
  "POST /slurp/drama/choice",
  "POST /slurp/drama/start",
  "POST /slurp/drama/runs/:id/end",
  // 0.3.2 Creator Pages: the player's edit, and "Let <Creator> design it".
  "PUT /slurp/accounts/:id/page",
  "POST /slurp/accounts/:id/page/compose",
  // 7b-spice: Backstage › Spice (the Slurp-wide limit, the player's taste, "Slurp noticed you like …").
  "GET /slurp/spice",
  "PATCH /slurp/spice",
  "POST /slurp/spice/noticed",
  "POST /continuity/:target/:id/retract",
  "POST /continuity/facts/:id/promote",
  "POST /continuity/proposals/:id/:decision",
  "POST /messages/threads/:threadId/requests/:requestId/action",
  "POST /messages/creators/:creatorAccountId/request-fan-reply",
  "POST /messages/share-post",
  "POST /slurp/posts/:id/report",
  "ADDCONTENTTYPEPARSER application/zip",
  "DELETE /data",
  "DELETE /data/activity",
  "DELETE /data/unused",
  "DELETE /slurp/accounts/:id",
  "DELETE /slurp/accounts/:id/avatar",
  "DELETE /slurp/accounts/:id/wardrobe/:lookId",
  "DELETE /slurp/accounts/:id/projects/:projectId",
  "DELETE /slurp/accounts/:id/subscribe",
  "DELETE /slurp/ads/pool/:id",
  "DELETE /slurp/posts/:id",
  "DELETE /slurp/posts/:id/interactions",
  "DELETE /slurp/posts/:postId/interactions/:interactionId",
  "DELETE /restore/inspections/:id",
  "GET /ambient-profiles",
  "GET /backstage/improvement-jobs",
  "GET /backstage/improvement-jobs/:id",
  "GET /backstage/readiness",
  "GET /backup/jobs/:id",
  "GET /backup/jobs/:id/download",
  "GET /discovery-tags/usage",
  "GET /fan-types/rebalance/preview",
  "GET /maintenance/summary",
  "GET /messages/:messageId/media",
  "GET /messages/compose",
  "GET /messages/compose-targets",
  "GET /messages/unread-count",
  "GET /messages/creators/:creatorAccountId/follow-up-analytics",
  "GET /messages/creators/:creatorAccountId/rapport",
  "GET /messages/creators/:creatorAccountId/settings",
  "GET /messages/threads",
  "GET /messages/threads/:threadId",
  "GET /messages/threads/:threadId/prompt",
  "GET /model-budget/usage",
  "POST /model-budget/rewrite-pending",
  "GET /slurp/account-connection-counts",
  "GET /slurp/accounts",
  "GET /slurp/accounts/:id/arc-config",
  "GET /slurp/accounts/:id/arcs",
  "GET /noodler/accounts/:id/avatar/:fileName",
  "GET /noodler/accounts/:id/banner/:fileName",
  "GET /slurp/accounts/:id/followers",
  "GET /slurp/accounts/:id/posts",
  "GET /slurp/accounts/:id/projects",
  "GET /slurp/accounts/:id/projects/:projectId/posts",
  "GET /slurp/accounts/:id/subscribers",
  "GET /slurp/accounts/:id/wardrobe",
  "GET /noodler/ads/:id/image/:fileName",
  "GET /slurp/ads/export",
  "GET /slurp/ads/lorebooks",
  "GET /slurp/ads/pool",
  "GET /slurp/audience/:memberId",
  "GET /slurp/auto-post/status",
  "GET /slurp/creator-metrics",
  "GET /slurp/eligible-accounts",
  "GET /slurp/fan-activity/status",
  "GET /slurp/first-posts/status",
  "GET /slurp/image-connections",
  "GET /slurp/image-style-profiles",
  "GET /slurp/notifications",
  "GET /slurp/notifications/unseen-count",
  "GET /slurp/post-guidance",
  "GET /noodler/posts/:id/media",
  "GET /slurp/stories/:id/views",
  "GET /slurp/studio",
  "GET /slurp/viewer",
  "GET /slurp/viewer-wallets",
  "GET /slurp/viewer/ads",
  "GET /slurp/viewer/ads/state",
  "GET /slurp/viewer/feed",
  "GET /slurp/viewer/unseen-count",
  "GET /slurp/viewer/wallet",
  "GET /slurp/wardrobe/lorebooks",
  "GET /settings",
  "GET /settings/audience-characters",
  "GET /settings/audience-characters/groups",
  "GET /settings/defaults",
  "GET /settings/prompt-blocks",
  "POST /settings/prompt-blocks/generate-preview",
  "POST /settings/prompt-blocks/preview",
  "PATCH /accounts/:id/profile",
  "PATCH /accounts/:id/settings",
  "PATCH /ambient-profiles/:id",
  "PATCH /messages/creators/:creatorAccountId/settings",
  "PATCH /slurp/accounts/:id/avatar/source",
  "PATCH /slurp/accounts/:id/follow",
  "PATCH /slurp/accounts/:id/wardrobe/:lookId",
  "PATCH /slurp/accounts/:id/projects/:projectId",
  "PATCH /slurp/ads/pool/:id",
  "PATCH /slurp/auto-post/schedule/:slotId",
  "PATCH /slurp/image-connections",
  "PATCH /slurp/post-guidance",
  "PATCH /slurp/posts/:id",
  "PATCH /slurp/posts/:postId/interactions/:interactionId",
  "PATCH /settings",
  "POST /accounts/:id/noodler",
  "POST /accounts/:id/post-draft",
  "POST /slurp/accounts/:id/wardrobe",
  "POST /slurp/accounts/:id/wardrobe/import",
  "POST /slurp/accounts/:id/wardrobe/import-preview",
  "POST /slurp/wardrobe/lorebook-entries",
  "POST /ambient-profiles/reroll",
  "POST /arc-library/:id/reset",
  "POST /autopurge/preview",
  "POST /autopurge/run",
  "POST /backstage/improvement-jobs",
  "POST /backstage/improvement-jobs/:id/apply",
  "POST /backstage/improvement-jobs/:id/cancel",
  "POST /backstage/improvement-jobs/:id/dismiss",
  "POST /backstage/improvement-jobs/:id/resume",
  "POST /backstage/improvement-jobs/:id/retry",
  "POST /backup/jobs",
  "POST /discovery-tags/delete",
  "POST /discovery-tags/rename",
  "POST /fan-types/rebalance",
  "POST /fan-types/voice-draft",
  "POST /messages/:messageId/reaction",
  "POST /messages/cheat",
  "POST /messages/commissions",
  "POST /messages/commissions/:commissionId/accept",
  "POST /messages/commissions/:commissionId/counter",
  "POST /messages/commissions/:commissionId/decline",
  "POST /messages/commissions/:commissionId/deliver",
  "POST /messages/commissions/:commissionId/quote",
  "POST /messages/compose",
  "POST /messages/creators/:creatorAccountId/broadcast",
  "POST /messages/creators/:creatorAccountId/draft-reply",
  "POST /messages/creators/:creatorAccountId/ppv",
  "POST /messages/creators/:creatorAccountId/reply",
  "POST /messages/ppv/unlock",
  "POST /messages/send",
  "POST /messages/threads/:threadId/cancel-follow-up",
  "POST /messages/threads/:threadId/force-reply",
  "POST /messages/threads/:threadId/image",
  "POST /messages/threads/:threadId/image-upload",
  "POST /messages/threads/:threadId/request",
  "POST /messages/threads/:threadId/request-reply",
  "POST /messages/threads/:threadId/reset",
  "POST /messages/threads/:threadId/viewer-image",
  "POST /messages/tip",
  "POST /slurp/accounts/:id/appearance",
  "POST /slurp/accounts/:id/arc-library/generate",
  "POST /slurp/accounts/:id/artwork/generate",
  "POST /slurp/accounts/:id/auto-post/run-now",
  "POST /slurp/accounts/:id/avatar",
  "POST /slurp/accounts/:id/banner",
  "POST /slurp/accounts/:id/conversation-schedule/refresh",
  "POST /slurp/accounts/:id/payout",
  "POST /slurp/accounts/:id/projects",
  "POST /slurp/accounts/:id/projects/:projectId/director",
  "POST /slurp/accounts/:id/projects/:projectId/library",
  "POST /slurp/accounts/:id/projects/:projectId/profile",
  "POST /slurp/accounts/:id/projects/generate",
  "POST /slurp/accounts/:id/source/adopt-identity",
  "POST /slurp/accounts/:id/source/dismiss",
  "POST /slurp/accounts/:id/subscribe",
  "POST /slurp/accounts/:id/tip",
  "POST /slurp/accounts/bulk",
  "GET /slurp/accounts/bulk/:executionId",
  "POST /slurp/accounts/bulk-update",
  "POST /slurp/ads/:id/image",
  "POST /slurp/ads/generate",
  "POST /slurp/ads/import",
  "POST /slurp/ads/lorebook/sync",
  "POST /slurp/ads/pool",
  "GET /slurp/ads/brands",
  "POST /slurp/ads/brands",
  "PATCH /slurp/ads/brands/:id",
  "DELETE /slurp/ads/brands/:id",
  "POST /slurp/ads/brands/:id/products",
  "POST /slurp/ads/pool/:id/picture",
  "POST /slurp/auto-post/refresh-now",
  "POST /slurp/auto-post/refresh-targeted",
  "POST /slurp/fan-activity/refresh-now",
  "POST /slurp/first-posts/enqueue",
  "POST /slurp/onboarding/scene/keep",
  "POST /slurp/onboarding/scene/turn",
  "POST /slurp/notifications/:id/fan-note",
  "POST /slurp/notifications/seen",
  "POST /slurp/post-guidance-draft",
  "POST /slurp/posts",
  "POST /slurp/posts/:id/image/generate",
  "POST /slurp/posts/:id/interactions",
  "POST /slurp/posts/:id/media",
  "POST /slurp/posts/:id/unlock",
  "POST /slurp/posts/:id/gamble-unlock",
  "POST /slurp/posts/:postId/interactions/:interactionId/creator-reply",
  "POST /slurp/refresh/images",
  "POST /slurp/refresh/images/cancel",
  "POST /slurp/stage-profile-draft",
  "POST /slurp/stories/:id/view",
  "POST /slurp/viewer/ads/:id/action",
  "POST /slurp/viewer/ads/:id/hide",
  "POST /slurp/viewer/ads/brand/hide",
  "POST /slurp/viewer/ads/brand/unhide",
  "POST /slurp/viewer/ads/reset",
  "POST /slurp/viewer/mark-seen",
  "POST /slurp/viewer/wallet/daily-refill",
  "POST /slurp/viewer/wallet/dev-set",
  "POST /refresh",
  "POST /restore/inspections",
  "POST /restore/inspections/:id/apply",
  "POST /restore/jobs",
  "PUT /messages/threads/:threadId/notes",
  "PUT /slurp/accounts/:id/arc-config",
  "PUT /slurp/accounts/:id/goal",
  "PUT /slurp/accounts/:id/stage-profile",
  "PUT /slurp/accounts/:id/subscription-price",
  "DELETE /story/facts/:id",
  "DELETE /story/opportunities/:id",
  "GET /story-packs/bundled",
  "GET /story/calendar",
  "GET /story/timeline",
  "POST /story-packs/bundled/:id/preview",
  "POST /story-packs/export",
  "POST /story-packs/preview",
  "POST /story-packs/previews/:id/apply",
  "POST /story/events/:id/start",
  "POST /story/occurrences/:id/status",
];

const RETAINED_OLD_PATHS = new Set([
  "GET /noodler/accounts/:id/avatar/:fileName",
  "GET /noodler/accounts/:id/banner/:fileName",
  "GET /noodler/ads/:id/image/:fileName",
  "GET /noodler/posts/:id/media",
  "GET /noodler/posts/:id/media/:position",
]);
const ADDED_ROUTES = new Set([
  // Roleplay scenes from a DM thread (docs/SCENES.md).
  "GET /messages/threads/:threadId/scene/origin",
  "POST /messages/threads/:threadId/scene/invite/:messageId/decline",
  "POST /messages/threads/:threadId/scene/plan",
  "POST /messages/threads/:threadId/scene/recap/:messageId/reach",
  // The recovery reset: clears activity, keeps Creators and settings.
  "DELETE /data/activity",
  "PATCH /messages/threads/:threadId/details",
  // Fix phase 1b (R1-107): "Draft voice" in the fan type editor.
  "POST /fan-types/voice-draft",
  // Overnight plan item 7: one exchange of the role-play Creator sign-up, and keeping its chat.
  "POST /slurp/onboarding/scene/turn",
  "POST /slurp/onboarding/scene/keep",
  // Fix phase 1 (R1-047): closing the picture review ends the wait.
  "POST /slurp/refresh/images/cancel",
  // 0.2.47: "Save to Slurp" from an Engine chat.
  "POST /continuity/from-chat",
  // 0.2.53: a Creator's recent signals.
  "GET /continuity/:creatorAccountId/signals",
  // 0.2.51: the canon anchor editor.
  "GET /slurp/accounts/:id/canon-anchors",
  "PUT /slurp/accounts/:id/canon-anchors",
  "DELETE /slurp/accounts/:id/canon-anchors",
  // 7b0: the player's steering for a Creator (life, pace, ideas for the next posts).
  "GET /slurp/accounts/:id/steering",
  "PATCH /slurp/accounts/:id/steering",
  "POST /slurp/accounts/:id/steering/ideas",
  "DELETE /slurp/accounts/:id/steering/ideas/:ideaId",
  // 7b-1: the player's "Rewrite" answer after a steering change (prepared posts are written again).
  "POST /slurp/accounts/:id/steering/rewrite-prepared",
  // 7b-c: undo what a talk with Slurp Support changed, or keep it and hide the note.
  "POST /slurp/accounts/:id/steering/support-undo",
  "DELETE /slurp/accounts/:id/steering/support-note",
  // 3c: the action layer behind the AI assist (what Slurp can do for the player, and doing one thing).
  "GET /slurp/actions",
  "POST /slurp/actions/:name",
  // W: Stir (preview one action or a list, plain words → a plan, do a play, undo it, the Stir tab).
  "POST /slurp/actions/:name/preview",
  "POST /slurp/stir/preview",
  "POST /slurp/stir/plan",
  "POST /slurp/stir/play",
  "POST /slurp/stir/plays/:id/undo",
  // 0.3.1: "Not now" on a Stir suggestion.
  "POST /slurp/stir/suggestions/:id/dismiss",
  "GET /slurp/stir",
  // 7b-c: collabs, rivalries and brand deals in Studio.
  "GET /slurp/ties",
  "POST /slurp/ties/collabs",
  "POST /slurp/ties/collabs/:id/push",
  "POST /slurp/ties/collabs/:id/decline",
  "POST /slurp/ties/collabs/:id/block",
  "POST /slurp/ties/collabs/:id/drop",
  "POST /slurp/ties/collabs/:id/post-now",
  "POST /slurp/ties/unblock",
  "POST /slurp/ties/rivalries/:id/cool",
  "POST /slurp/ties/deals/:id/answer",
  // U: "Mark as posted" for a sponsored post the player's own page owes.
  "POST /slurp/ties/deals/:id/posted",
  // 7b-couples: set two Creators up, steer their story, open or close their shared page.
  "POST /slurp/ties/couples",
  "POST /slurp/ties/couples/:id/steer",
  "POST /slurp/ties/couples/:id/page",
  // 0.3.8 Drama: bonds on the People map; what runs, the player's answer, start and end (docs/DRAMA.md).
  "POST /slurp/ties/bonds",
  "POST /slurp/ties/bonds/:id/end",
  "GET /slurp/drama",
  "POST /slurp/drama/choice",
  "POST /slurp/drama/start",
  "POST /slurp/drama/runs/:id/end",
  // 0.3.11: a heart or one reply to a fan's note on the player's own page (fans write notes there, not chats).
  "POST /slurp/notifications/:id/fan-note",
  // 0.3.11: a background sign-up's progress (big batches run as a server job).
  "GET /slurp/accounts/bulk/:executionId",
  // 0.3.2 Creator Pages: the player's edit, and "Let <Creator> design it".
  "PUT /slurp/accounts/:id/page",
  "POST /slurp/accounts/:id/page/compose",
  // 7b-spice: Backstage › Spice (the Slurp-wide limit, the player's taste, "Slurp noticed you like …").
  "GET /slurp/spice",
  "PATCH /slurp/spice",
  "POST /slurp/spice/noticed",
  "GET /messages/unread-count",
  "GET /slurp/notifications/unseen-count",
  "GET /slurp/posts/:id/deep-details",
  "POST /settings/prompt-blocks/generate-preview",
  "GET /continuity",
  "GET /continuity/:creatorAccountId",
  "GET /messages/threads/:threadId/requests",
  "GET /noodler/posts/:id/media/:position",
  "GET /slurp/tasks",
  "PATCH /continuity/facts/:id",
  "POST /continuity/:creatorAccountId/facts",
  "POST /continuity/:target/:id/retract",
  "POST /continuity/facts/:id/promote",
  "POST /continuity/proposals/:id/:decision",
  "POST /messages/threads/:threadId/requests/:requestId/action",
  "POST /messages/creators/:creatorAccountId/request-fan-reply",
  "POST /messages/share-post",
  "POST /slurp/wardrobe/lorebook-entries",
  "POST /slurp/posts/:id/report",
  "POST /slurp/posts/:id/gamble-unlock",
  "GET /slurp/image-style-profiles",
  "GET /story/calendar",
  "POST /slurp/accounts/:id/appearance",
  "DELETE /slurp/accounts/:id/wardrobe/:lookId",
  "GET /slurp/accounts/:id/wardrobe",
  "GET /slurp/wardrobe/lorebooks",
  "PATCH /slurp/accounts/:id/wardrobe/:lookId",
  "POST /slurp/accounts/:id/wardrobe",
  "POST /slurp/accounts/:id/wardrobe/import",
  "POST /slurp/accounts/:id/wardrobe/import-preview",
  "DELETE /story/facts/:id",
  "DELETE /story/opportunities/:id",
  "GET /story-packs/bundled",
  "GET /story/timeline",
  "POST /story-packs/bundled/:id/preview",
  "POST /story-packs/export",
  "POST /story-packs/preview",
  "POST /story-packs/previews/:id/apply",
  "POST /story/events/:id/start",
  "POST /story/occurrences/:id/status",
  // R: brands and their products in Backstage (a product picture by upload or the picture assist).
  "GET /slurp/ads/brands",
  "POST /slurp/ads/brands",
  "PATCH /slurp/ads/brands/:id",
  "DELETE /slurp/ads/brands/:id",
  "POST /slurp/ads/brands/:id/products",
  "POST /slurp/ads/pool/:id/picture",
  // 0.3.5: the Slurp Support desk (case files, notes, ticket resolve, answering an Offer as your Creator).
  "GET /slurp/desk",
  "POST /slurp/desk/note",
  "POST /slurp/desk/ticket/resolve",
  "POST /slurp/desk/offer/answer",
  // 0.3.7: "Rewrite all now" in AI budget settings.
  "POST /model-budget/rewrite-pending",
]);

// Routes staging had that Slurp2 no longer serves. The share card is now drawn on a canvas in
// the browser: the server render needed fonts installed on the host, which Engine hosts often
// lack, so the card came out as the bare post image with no name, title, or caption.
const REMOVED_ROUTES = new Set(["GET /noodler/posts/:id/share-card"]);

const stagingRoutes = readFileSync(join(import.meta.dirname, "fixtures/slurp2-route-inventory.staging.txt"), "utf8")
  .split("\n")
  .filter(Boolean)
  .sort();
const routeFromStaging = (route: string): string => {
  if (route.startsWith("ADDCONTENTTYPEPARSER ") || RETAINED_OLD_PATHS.has(route)) return route;
  return route.replace("/noodler/", "/slurp/");
};
const routeToStaging = (route: string): string => {
  if (route.startsWith("ADDCONTENTTYPEPARSER ") || RETAINED_OLD_PATHS.has(route)) return route;
  return route.replace("/slurp/", "/noodler/");
};
const mappedStagingRoutes = [
  ...stagingRoutes.filter((route) => !REMOVED_ROUTES.has(route)).map(routeFromStaging),
  ...ADDED_ROUTES,
].sort();
assert.deepEqual([...EXPECTED].sort(), mappedStagingRoutes, "the route mapping must match the staging fixture");

const EXPECTED_HANDLER_COUNTS = {
  "features/ads": 24,
  "features/assist": 9,
  "features/audience": 13,
  "features/creators": 49,
  "features/discovery": 4,
  "features/economy": 14,
  "features/feed": 39,
  "features/maintenance": 15,
  "features/media": 7,
  "features/messages": 49,
  "features/notifications": 4,
  "features/onboarding": 7,
  "features/projects": 31,
  "features/settings": 8,
  "features/world": 15,
} as const;
// W: +5 POST, +1 GET (Stir). R: +3 POST, +1 GET, +1 PATCH, +1 DELETE (brands).
// 0.3.4: +1 POST, +1 PUT (Creator Pages). 0.3.5: +1 GET, +3 POST (Support desk). 0.3.7: +1 POST (rewrite all).
// 0.3.8: +1 GET, +5 POST (Drama: bonds, drama view, choice, start, end). 0.3.11: +1 POST (fan notes).
const EXPECTED_METHOD_COUNTS = { DELETE: 19, GET: 84, PATCH: 20, POST: 158, PUT: 7 } as const;

const root = join(import.meta.dirname, "../packages/slurp2/src/engine/packages/server/src/slp");
const registration = /\bapp\.(get|post|put|patch|delete|addContentTypeParser)(?:<[^()]*?>)?\(\s*["'`]([^"'`]+)["'`]/gu;
const found = (readdirSync(root, { recursive: true }) as string[])
  .filter((file) => file.endsWith(".ts"))
  .flatMap((file) =>
    [...readFileSync(join(root, file), "utf8").matchAll(registration)].map((match) => ({
      route: `${match[1].toUpperCase()} ${match[2]}`,
      file,
    })),
  )
  .sort();
const foundRoutes = found.map(({ route }) => route).sort();
const handlerCounts = Object.fromEntries(
  found
    .filter(({ route }) => !route.startsWith("ADDCONTENTTYPEPARSER "))
    .reduce((counts, { file }) => {
      const parts = file.split("/");
      const feature = parts[0] === "features" ? `features/${parts[1]}` : parts[0];
      counts.set(feature, (counts.get(feature) ?? 0) + 1);
      return counts;
    }, new Map<string, number>()),
);

function assertRouteInventory(routes: string[]): void {
  assert.deepEqual(routes, [...EXPECTED].sort(), "the Slurp2 route multiset changed");
}

assert.throws(
  () => assertRouteInventory(foundRoutes.filter((route) => route !== "POST /slurp/posts/:id/media")),
  /the Slurp2 route multiset changed/u,
  "the inventory fixture must fail when a mapped route disappears",
);
assert.throws(
  () =>
    assertRouteInventory(
      foundRoutes
        .map((route) => (route === "POST /slurp/posts/:id/media" ? "PUT /slurp/posts/:id/media" : route))
        .sort(),
    ),
  /the Slurp2 route multiset changed/u,
  "the inventory fixture must fail when a mapped route changes method",
);
assert.deepEqual(foundRoutes, [...EXPECTED].sort(), "the Slurp2 route multiset changed");
const methodCounts = Object.fromEntries(
  foundRoutes
    .filter((route) => !route.startsWith("ADDCONTENTTYPEPARSER "))
    .reduce((counts, route) => {
      const method = route.split(" ", 1)[0]!;
      counts.set(method, (counts.get(method) ?? 0) + 1);
      return counts;
    }, new Map<string, number>()),
);
assert.deepEqual(methodCounts, EXPECTED_METHOD_COUNTS, "HTTP method multiset changed from staging");
// 0.3.5: +4 (the Support desk). 0.3.7: +1 (rewrite all). Roleplay scenes: +4. 0.3.17: +2 (collab drop, post now).
assert.equal(foundRoutes.filter((route) => !route.startsWith("ADDCONTENTTYPEPARSER ")).length, 288);
assert.deepEqual(handlerCounts, EXPECTED_HANDLER_COUNTS, "handler count changed in a feature");
assert.ok(foundRoutes.includes("POST /slurp/posts/:id/media"), "the renamed POST media route must remain registered");
assert.ok(
  !foundRoutes.includes("PUT /slurp/posts/:id/media"),
  "changing the media upload method must fail the fixture",
);
assert.deepEqual(
  foundRoutes
    .filter((route) => !ADDED_ROUTES.has(route))
    .map(routeToStaging)
    .sort(),
  stagingRoutes.filter((route) => !REMOVED_ROUTES.has(route)),
  "the route change must be limited to the explicit Slurp mapping",
);
assert.deepEqual(
  [...RETAINED_OLD_PATHS].sort(),
  foundRoutes.filter((route) => route.startsWith("GET /noodler/")).sort(),
  "only persisted-media GET routes may retain the old path",
);
const entry = readFileSync(join(root, "slp-server-entry.ts"), "utf8");
assert.match(entry, /mountSlpRoutes\(Object\.assign\(router, \{ db: app\.db, noodle \}\)/u);
assert.equal(existsSync(join(root, "features/maintenance/slp-backup-routes.ts")), true);
// A route that builds the messages storage from the facet module gets no core factory and throws
// "Slurp core storage factory is required" (0.3.1 Start over, 0.3.0 Stir); data/slp-storage.ts wires it.
for (const route of ["features/maintenance/slp-maintenance-routes.ts", "features/assist/slp-stir-routes.ts"]) {
  assert.doesNotMatch(
    readFileSync(join(root, route), "utf8"),
    /import \{[^}]*\bcreateSlurpMessagesStorage\b[^}]*\} from "\.\.\/\.\.\/data\/messages\/slp-messages-storage\.js"/u,
    `${route} must build the messages storage through data/slp-storage.ts`,
  );
}
