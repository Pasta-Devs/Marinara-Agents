import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { formatUpcomingClock } from "../packages/slurp2/src/engine/packages/client/src/slp/base/ui/slp-date-time";
import { slpComposerAudienceOf } from "../packages/slurp2/src/engine/packages/client/src/slp/modules/post/slp-composer-audience";
import {
  slurpViewerImageOnCooldown,
  slurpViewerImageReadyAt,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-messaging.js";
import { slurpLikesByWeek } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/economy/slp-studio-stats.js";

// Redesign step 7 (Studio, composer, Pulse, post edit, broadcast) + the step 6.5 follow-ups:
// "Draw again at 4:30 PM" in chat, "ends Thu" on Discover after a cancel.
const engine = join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages");
const client = (path: string) => readFileSync(join(engine, "client/src/slp", path), "utf8");
const server = (path: string) => readFileSync(join(engine, "server/src/slp", path), "utf8");
const en = JSON.parse(client("locales/en.json")) as Record<string, string>;

// ── 0a. Picture wait: the server says when the next picture can be drawn ──
const now = Date.parse("2026-09-27T12:00:00.000Z");
const drawn = (minutesAgo: number, role = "viewer", context: unknown = "viewer") => ({
  role,
  createdAt: new Date(now - minutesAgo * 60_000).toISOString(),
  metadata: { generatedContext: context },
});
assert.equal(slurpViewerImageReadyAt([drawn(10)], 0, now), null, "0 turns the wait off");
assert.equal(
  slurpViewerImageReadyAt([drawn(40), drawn(10)], 180, now),
  new Date(now + 170 * 60_000).toISOString(),
  "the newest drawn picture starts the wait",
);
assert.equal(slurpViewerImageReadyAt([drawn(180)], 180, now), null, "at N minutes the wait is over");
assert.equal(slurpViewerImageReadyAt([drawn(5, "creator")], 180, now), null, "a Creator's picture never counts");
assert.equal(slurpViewerImageReadyAt([drawn(5, "viewer", null)], 180, now), null, "an upload never counts");
assert.equal(slurpViewerImageOnCooldown([drawn(10)], 180, now), true, "the old yes/no helper agrees");
const mediaRoutes = server("features/messages/slp-messages-media-routes.ts");
assert.match(
  mediaRoutes,
  /slurpViewerImageReadyAt\(await messages\.listMessages\(thread\.id(?:, [\d_]+)?\), cooldownMinutes\)[\s\S]*?code\(429\)\.send\(\{ error: "You can generate another picture later\.", retryAt: readyAt \}\)/u,
  "the 429 carries the time the wait ends",
);
const tools = client("features/messages/SlpMessageTools.tsx");
assert.match(tools, /cause instanceof ApiError && cause\.status === 429[\s\S]*?retryAt/u);
assert.match(tools, /"ui\.slurp\.messages\.pictureWait"[\s\S]*?formatUpcomingClock\(retryAt, i18n\.language\)/u);
assert.equal(en["ui.slurp.messages.pictureWait"], "Draw again at {{time}}");
// Today: the clock time only; another day names the weekday first.
const localNoon = new Date(2026, 8, 27, 12, 0).getTime();
assert.equal(formatUpcomingClock(new Date(2026, 8, 27, 16, 30).toISOString(), "en", localNoon), "4:30 PM");
assert.equal(formatUpcomingClock(new Date(2026, 8, 28, 9, 5).toISOString(), "en", localNoon), "Mon 9:05 AM");

// ── 0b. Discover knows the paid period, so a cancelled card says "ends Thu" and offers Resume ──
const hub = client("app/screens/SlpScreenHub.tsx");
const discover = client("app/screens/SlpHubDiscover.tsx");
const card = client("modules/creator/SlpCreatorProfileCard.tsx");
assert.match(hub, /useSlurpWallet\(scope\?\.viewer\.entityId \?\? null\)\.data\?\.subscriptions/u);
assert.match(hub, /walletSubscriptions=\{walletSubscriptions\}/u);
assert.match(discover, /until: walletSubscriptions\[creator\.profile\.id\]\.paidThroughAt/u);
assert.match(
  card,
  /creator\.subscription\?\.cancelled && endsDay[\s\S]*?ui\.slurp\.discover\.resume[\s\S]*?ui\.slurp\.profile\.endsDay/u,
);
assert.match(
  card,
  /showSlpSubscriptionCancelledToast\(\{ localizeUi, endsDay, onUndo: resume \}\)/u,
  "the cancel toast names the day",
);

// ── 1. One composer: a full-screen sheet, media first, access chips, operator settings under Advanced ──
const composer = client("app/screens/SlpScreenComposer.tsx");
const sheet = client("modules/chrome/SlpSheet.tsx");
assert.match(sheet, /size\?: "auto" \| "full"/u);
assert.match(sheet, /mode === "sheet" && full && "top-\[max\(0\.5rem,env\(safe-area-inset-top\)\)\] max-h-none"/u);
assert.match(sheet, /\{footer && \(/u, "a sticky footer under the scrolling body");
assert.match(
  sheet,
  /event\.target\.closest\("button, a, input, select, textarea"\)\) return;/u,
  "a control in the sheet header keeps its tap (no pointer capture)",
);
assert.match(composer, /<SlpSheet[\s\S]*?size="full"[\s\S]*?headerAccessory=\{\s*<SlpSegment/u);
assert.match(
  composer,
  /footer=\{[\s\S]*?<SlpPrimaryButton onClick=\{\(\) => void publish\(\)\} disabled=\{!canPost\}/u,
);
// 0.3.31: the picture, who sees it, then one switch for the text: typed by hand or Guided.
const body = composer.slice(composer.indexOf('data-component="SlurpHome.NoodlerPostComposer"'));
assert.ok(body.indexOf("{media}") < body.indexOf("<SlpComposerAudience"), "the picture on top");
assert.ok(body.indexOf("<SlpComposerAudience") < body.indexOf("<SlpSegment"), "audience before the text switch");
assert.ok(body.indexOf("<SlpSegment") < body.indexOf("<SlpPostGuide"), "the switch before Guided");
assert.match(body, /<div hidden=\{by !== "guide"\}>\s*<SlpPostGuide/u);
assert.match(body, /<div hidden=\{by !== "me"\} aria-busy=\{drafting\}/u);
assert.match(composer, /useState<"me" \| "guide">\("me"\)/u, "a new post opens on Write it myself");
assert.ok(
  composer.indexOf("<SlpComposerAudience") < composer.indexOf('id="slurp-composer-advanced"'),
  "access chips before Advanced",
);
assert.ok(
  composer.indexOf('id="slurp-composer-advanced"') < composer.indexOf("<SlpComposerPurpose"),
  "Purpose and Delivery live under Advanced",
);
assert.doesNotMatch(composer, /collapsible|openSignal/u, "no inline, collapsible composer left");
const profile = client("app/screens/SlpScreenProfile.tsx");
assert.doesNotMatch(
  profile.slice(profile.indexOf("function SlpCreatorToolsCard")),
  /<NoodlerPostComposer/u,
  "the Creator tools card no longer holds a composer",
);
assert.match(profile, /<NoodlerPostComposer[\s\S]*?open=\{model\.composerOpen\}/u);
const actions = client("app/slp-home-actions.ts");
assert.match(
  actions,
  /postType: "story", poll: null, title: "" \}\);\s*setComposerOpenSignal/u,
  "hub Add Story opens the sheet",
);
// Access: the server has public and locked; Subscribers = locked at the usual price, Locked = own price.
assert.equal(slpComposerAudienceOf({ access: "public", unlockPrice: 40 }), "public");
assert.equal(slpComposerAudienceOf({ access: "locked", unlockPrice: null }), "subscribers");
assert.equal(slpComposerAudienceOf({ access: "locked" }), "subscribers");
assert.equal(
  slpComposerAudienceOf({ access: "locked", unlockPrice: 0 }),
  "locked",
  "a free unlock is still its own price",
);

// ── 2. Post edit: the same full-screen sheet; labelled Crop / Replace / Remove; Remove has Undo ──
const postCard = client("modules/post/SlpPostCard.tsx");
const editSheet = client("modules/post/SlpPostEditSheet.tsx");
const imageControls = client("modules/post/SlpPostImageEditControls.tsx");
const hooks = client("modules/post/SlpPostHooks.tsx");
assert.match(postCard, /\{ownsEditSheet && \(\s*<SlpPostEditSheet/u, "one card owns the edit sheet");
assert.match(editSheet, /<SlpSheet[\s\S]*?size="full"[\s\S]*?<SlpAutoGrowTextarea/u);
assert.match(imageControls, /editing\.remove\(\);\s*toast\([\s\S]*?onClick: \(\) => editing\.restore\(\)/u);
assert.match(
  imageControls,
  /ui\.slurp\.composer\.crop[\s\S]*?ui\.slurp\.composer\.replace[\s\S]*?ui\.slurp\.composer\.remove/u,
);
assert.match(
  hooks,
  /beforeRemoveRef\.current = update\?\.kind === "remove"/u,
  "Undo brings back a crop or replacement",
);
const crop = client("base/media/SlpPostImageCropEditor.tsx");
assert.match(
  crop,
  /ratio: "4:5"[\s\S]*?ratio: "1:1"[\s\S]*?ratio: "16:9"[\s\S]*?value: "original"/u,
  "shape chips, feed shape first",
);
assert.ok(
  crop.indexOf("aria-pressed={aspect === option.value}") < crop.indexOf('type="range"'),
  "chips before the zoom slider",
);
// Toasts (Undo) are the Engine's, which sit above the sheets: Slurp's portal stays on the Engine's Modal layer
// (Pasta-Devs/Marinara-Agents#1487).
assert.match(client("slp-client-entry.tsx"), /zIndex: "10000",/u, "the sheets' portal sits below the Engine's toasts");
assert.doesNotMatch(client("slp-client-entry.tsx"), /<Toaster\b/u, "Slurp renders no toaster of its own");

// ── 3. Studio: money, then fans, then goal, posts, and the storyline closed at the end ──
// W: Studio's own-page half is the Dashboard sheet; the storyline moved to Stir (chapter moves) and
// Creator settings (the rules), so the Dashboard ends on the recent posts.
const studio = client("app/screens/SlpDashboard.tsx");
const order = [
  "<SlpCollectCard",
  "<SlpStudioStat",
  "<SlurpGoalEditor",
  "ui.slurp.studio.topFans",
  "ui.slurp.studio.recentPosts",
];
for (let i = 1; i < order.length; i++) {
  assert.ok(studio.indexOf(order[i - 1]) < studio.indexOf(order[i]), `${order[i - 1]} before ${order[i]}`);
}
assert.doesNotMatch(studio, /uppercase tracking-\[0\.12em\]|text-\[0\.65rem\]/u, "no shouty stat labels (B18)");
assert.match(studio, /\[overflow-wrap:anywhere\]/u, "a long label wraps instead of spilling out of its tile");
assert.doesNotMatch(studio, /ui\.slurp\.studio\.storyline"/u, "W: no storyline group on the Dashboard");
assert.deepEqual(
  slurpLikesByWeek(
    [
      { createdAt: new Date(now - 1 * 86400e3).toISOString(), likeCount: 200 },
      { createdAt: new Date(now - 6 * 86400e3).toISOString(), likeCount: 10 },
      { createdAt: new Date(now - 8 * 86400e3).toISOString(), likeCount: 50 },
      { createdAt: new Date(now - 20 * 86400e3).toISOString(), likeCount: 999 },
      { createdAt: new Date(now + 3600e3).toISOString(), likeCount: 5 },
    ],
    new Date(now),
  ),
  { thisWeek: 210, lastWeek: 50 },
);
const studioRoutes = server("features/economy/slp-studio-routes.ts");
assert.match(
  studioRoutes,
  /subscribersDelta: typeof previous\?\.subscribers === "number" \? subscribers - previous\.subscribers : null/u,
);
assert.match(studioRoutes, /likes: slurpLikesByWeek\(posts, at\)/u);
assert.match(studioRoutes, /posts: posts\.slice\(0, 6\)/u, "the list still shows six");
assert.match(studioRoutes, /subscribers: creator\.subscribers,/u, "the mark remembers subscribers for next time");

// ── 4. Pulse + paid AI actions: one tap, a small "AI" mark, the cost note once; one overlay ──
const pulse = client("modules/chrome/SlpPulse.tsx");
const shell = client("modules/chrome/SlpShell.tsx");
const aiMark = client("modules/chrome/SlpAiMark.tsx");
const thread = client("features/messages/SlpThreadView.tsx");
assert.match(
  pulse,
  /<SlpSheet open=\{open\} onClose=\{onClose\}/u,
  "Pulse is a SlpSheet, so it closes the More sheet (B8)",
);
// W: "Run audience" left Pulse for the Stir card "Wake the fans", which keeps the ✦ AI mark and the
// once-only cost note (the deck marks every card that calls the AI; Do it notes it once).
assert.match(client("features/stir/SlpStirScreen.tsx"), /\{card\.ai && <SlpUsesAiMark \/>\}/u);
assert.match(
  client("features/stir/SlpStirCards.tsx"),
  /if \(cards\.some\(\(card\) => card\.cost === "ai"\)\) noteSlpAiUseOnce\(t\);/u,
);
assert.doesNotMatch(pulse, /repeat: Infinity|animate-ping/u, "no looping ping on the Pulse card");
assert.doesNotMatch(
  `${shell}\n${client("modules/chrome/slp-shell.types.ts")}\n${client("app/SlpHomeHost.tsx")}`,
  /onCompose/u,
  "dead onCompose gone (B42)",
);
assert.match(
  thread,
  /noteSlpAiUseOnce\(localizeUi\);[\s\S]*?forceReply\.mutateAsync[\s\S]*?ui\.slurp\.messages\.forceReply[\s\S]*?<SlpUsesAiMark \/>/u,
);
// 3c: the composer's Guide folded into the shared text assist, which notes the cost before it runs.
assert.match(composer, /<SlpTextAssist/u);
assert.match(client("features/assist/SlpTextAssist.tsx"), /noteSlpAiUseOnce\(t\);[\s\S]*?runSlpAction/u);
assert.match(aiMark, /if \(window\.localStorage\.getItem\(AI_NOTE_SEEN_KEY\)\) return;/u, "the note shows once");
assert.doesNotMatch(
  `${en["ui.slurp.ai.costNote"]} ${en["ui.slurp.ai.costNoteTitle"]}`,
  /simulat|fake|not real/iu,
  "in Slurp's voice, no fiction breaks",
);

// ── 5. Broadcast: a sheet titled with who gets it, a preview bubble, Send off until there is text ──
assert.match(tools, /ui\.slurp\.messages\.broadcastTo[\s\S]*?count: subscriberCount/u);
assert.match(tools, /disabled=\{!content \|\| subscriberCount === 0 \|\| broadcast\.isPending\}/u);
assert.match(tools, /ui\.slurp\.messages\.broadcastPreview/u);
assert.match(studio, /<BroadcastPanel[\s\S]*?subscriberCount=\{creator\.subscribers\}/u);
assert.equal(en["ui.slurp.messages.broadcastTo_other"], "To {{count}} subscribers");

for (const key of [
  "ui.slurp.composer.newPost",
  "ui.slurp.composer.audience.subscribers",
  "ui.slurp.composer.audienceHint.locked",
  "ui.slurp.post.editTitle",
  "ui.slurp.studio.likesThisWeek",
  "ui.slurp.pulse.runNow",
  "ui.slurp.ai.usesAi",
]) {
  assert.ok(en[key], `en has ${key}`);
}
