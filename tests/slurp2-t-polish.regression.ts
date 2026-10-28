/**
 * Item T: one gap between stacked cards, the glass top bar on every framed page, a locked post's own
 * teaser line (generated, else backfilled from its caption, the fixed line last), and the Story ring
 * meaning "has a live Story" only (new / seen / none) with a tap that opens the Stories.
 */
import assert from "node:assert/strict";
import { slpGeneratedCreatorPostSchema } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-social-generation.schema.ts";
import { slurpLockedPostTeaser } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-post-purpose.ts";
import {
  slpStoryRings,
  slpStoryStartId,
  type SlpLiveStory,
} from "../packages/slurp2/src/engine/packages/client/src/slp/modules/story/slp-story-rings.ts";
import { slurp2Source } from "./slurp2-source";

const client = (path: string) => slurp2Source(`packages/slurp2/src/engine/packages/client/src/slp/${path}`);
const server = (path: string) => slurp2Source(`packages/slurp2/src/engine/packages/server/src/slp/${path}`);

// --- Locked teaser: the post's own line wins -------------------------------------------------------
const post = (
  content: string | null,
  metadata: Record<string, unknown> | null = null,
  title: string | null = null,
) => ({
  title,
  content,
  metadata,
});
assert.equal(
  slurpLockedPostTeaser(
    post("Full set inside.", { lockedTeaser: "  You asked, I delivered. Friday's drop is here.  " }),
  ),
  "You asked, I delivered. Friday's drop is here.",
  "the generated teaser is used as written (trimmed)",
);
// Backfill: an old locked post gets the opening of its own caption, trailing off.
assert.equal(
  slurpLockedPostTeaser(post("Cold water, warm tea after. The rest is for you.")),
  "Cold water, warm tea after…",
);
assert.equal(slurpLockedPostTeaser(post("finally did the thing!! more below")), "finally did the thing…");
const long = slurpLockedPostTeaser(post(`${"so this took all afternoon and three outfit changes ".repeat(4)}. Rest.`))!;
assert.ok(long.length <= 90 && long.endsWith("…"), `a long opening is cut at a word: ${long}`);
assert.doesNotMatch(long, /\s…$/u);
// Two different old posts no longer share one line.
assert.notEqual(
  slurpLockedPostTeaser(post("Beach set, part two.")),
  slurpLockedPostTeaser(post("Knight cat sketches.")),
);
// The fixed line (null) only when there is nothing of the post's own to use.
assert.equal(slurpLockedPostTeaser(post(null)), null);
assert.equal(slurpLockedPostTeaser(post("   ")), null);
assert.equal(
  slurpLockedPostTeaser(
    post("Behind the scenes: the cold water shoot!", null, "Behind the scenes — the cold water shoot"),
  ),
  null,
  "an opening that only repeats the title shown above it falls back",
);
assert.equal(slurpLockedPostTeaser(post("Hi.", { lockedTeaser: "" })), "Hi…", "an empty generated teaser backfills");

// --- The model's teaser: optional, a bad one never fails the post ----------------------------------
const parsed = (extra: Record<string, unknown>) =>
  slpGeneratedCreatorPostSchema.parse({ title: "Drop", content: "The set.", ...extra }).teaser;
assert.equal(parsed({ teaser: "  The one you voted for.  " }), "The one you voted for.");
assert.equal(parsed({}), null);
assert.equal(parsed({ teaser: "x".repeat(400) }), null, "too long: dropped, the backfill takes over");
assert.equal(parsed({ teaser: 42 }), null);

// Wiring: locked posts ask for it, generation stores it as `lockedTeaser`, the viewer sends it only
// for locked posts, and the card shows it before the fixed line.
const prompt = server("features/feed/slp-post-prompt.ts");
const generation = server("features/feed/slp-generation-service.ts");
assert.match(prompt, /input\.askTeaser \? `\\n\$\{SLURP_LOCKED_TEASER_INSTRUCTION\}`/u);
assert.match(prompt, /reveals nothing the lock hides/u);
assert.match(prompt, /if \(access !== "locked" \|\| !teaser\) return \{\};/u);
assert.match(prompt, /protectBoundedCreatorGeneratedText\(teaser, \.\.\.protect, SLP_LOCKED_TEASER_MAX_LENGTH\)/u);
assert.match(generation, /askTeaser: input\.request\.access === "locked"/u);
assert.match(
  generation,
  /slurpLockedTeaserMetadata\(input\.request\.access, generated\.teaser, disclosureMode, publicIdentity\)/u,
);
assert.match(
  server("features/viewer/slp-viewer-context.ts"),
  /teaser: locked \? slurpLockedPostTeaser\(post\) : null/u,
);
assert.match(
  client("modules/post/SlpLockedPostCard.tsx"),
  /\{lockedTeaser \?\?\s+localizeUi\("ui\.slurp\.locked\.teaser"/u,
);

// --- Story ring: live Story only; new until every live one is watched --------------------------------
const story = (creatorId: string, postId: string, hoursAgo: number, watched: boolean): SlpLiveStory => ({
  creatorId,
  postId,
  createdAt: new Date(Date.UTC(2026, 8, 28, 12) - hoursAgo * 3600e3).toISOString(),
  watched,
});
const live = [
  story("mira", "m1", 5, true),
  story("mira", "m2", 2, false),
  story("jonas", "j1", 3, true),
  story("lena", "l2", 1, false),
  story("lena", "l1", 6, false),
];
const rings = slpStoryRings(live);
assert.equal(rings.get("mira"), "new", "one unwatched live Story keeps the glint");
assert.equal(rings.get("jonas"), "seen", "all watched: the muted ring");
assert.equal(rings.get("noor"), undefined, "no live Story, no ring");
assert.equal(slpStoryRings([story("mira", "m2", 2, false), story("mira", "m1", 5, true)]).get("mira"), "new");
// A tap starts on the oldest unwatched live Story, else the oldest.
assert.equal(slpStoryStartId(live, "mira"), "m2");
assert.equal(slpStoryStartId(live, "lena"), "l1");
assert.equal(slpStoryStartId(live, "jonas"), "j1");
assert.equal(slpStoryStartId(live, "noor"), null);

// Wiring: the host computes the rings from the live Stories (lifetime setting), the shell provides
// them, avatars everywhere read them, and the hub / profile play the asked-for Stories.
const host = client("app/SlpHomeHost.tsx");
assert.match(host, /slpStoryRings\(live\)/u);
assert.match(host, /storyLifetimeHours \?\? 72/u);
assert.match(host, /onNavigate\(\{ mode: "creator", view: "profile", accountId: creatorId \}\)/u);
assert.match(client("modules/chrome/SlpShell.tsx"), /<SlpStoryRingProvider value=\{storyRings\}>\{children\}/u);
assert.match(
  client("app/screens/slp-hub-view.ts"),
  /isSlurpStory\(post\) && new Date\(post\.createdAt\)\.getTime\(\) >= cutoff/u,
);
const ringed = [
  "modules/creator/SlpCreatorProfileCard.tsx", // Discover cards, rails, suggested row, subscriptions
  "modules/post/SlpPostCard.tsx", // post headers
  "modules/post/SlpLockedPostCard.tsx",
  "features/messages/SlpMessages.tsx", // inbox rows
  "features/messages/SlpThreadHeader.tsx",
  "features/messages/SlpThreadDrawer.tsx",
];
for (const path of ringed) assert.match(client(path), /<SlpStoryRingAvatar creatorId=/u, path);
assert.match(
  client("features/messages/SlpMessages.tsx"),
  /creatorId=\{toCreator \? null : thread\.creatorAccountId\}/u,
);
const surface = client("features/creators/SlpProfileSurface.tsx");
assert.match(surface, /\{!editing && heroRing && <SlpRingGlint seen=\{heroRing === "seen"\} \/>\}/u);
assert.doesNotMatch(surface, /\{!editing && <SlpRingGlint \/>\}/u, "the hero no longer rings without a Story");
assert.match(client("app/screens/SlpScreenHub.tsx"), /setActiveMomentId\(start\);\s+storiesTaken\?\.\(\);/u);
assert.match(client("app/screens/SlpProfilePostCards.tsx"), /pendingStories !== profile\.id/u);
assert.match(client("modules/sparkle/slp-sparkle-styles.ts"), /\.slp-ring-seen::before \{ display: none; \}/u);
const ringAvatar = client("modules/story/SlpStoryRing.tsx");
assert.match(ringAvatar, /if \(!ring \|\| !creatorId\) return <>\{children\}<\/>;/u);
assert.match(ringAvatar, /onClickCapture=\{openStories\}/u);

// --- One gap between stacked cards -------------------------------------------------------------------
assert.match(client("modules/post/SlpPostHelpers.tsx"), /export const SLP_CARD_STACK_CLASS = "flex flex-col gap-4";/u);
const hub = client("app/screens/SlpScreenHub.tsx");
assert.match(hub, /cn\(SLP_CARD_STACK_CLASS, "px-3 pb-6/u, "the feed list");
assert.match(hub, /<div className=\{SLP_CARD_STACK_CLASS\}>\s+\{index === dividerIndex/u, "a post, its ad and the row");
assert.doesNotMatch(client("app/screens/SlpScreenSuggestedCreators.tsx"), /className="py-1"/u);
assert.match(
  client("app/screens/SlpHubDiscover.tsx"),
  /<div className=\{SLP_CARD_STACK_CLASS\}>\s+\{visibleSearchResults/u,
);
assert.match(client("app/screens/SlpProfilePostCards.tsx"), /cn\(SLP_CARD_STACK_CLASS, "px-3 pt-4/u);
assert.match(client("app/screens/SlpScreenProfile.tsx"), /cn\(SLP_CARD_STACK_CLASS, "mx-3 mt-4/u);
assert.doesNotMatch(client("app/screens/SlpProfilePostCards.tsx"), /"p-3 @min-\[680px\]:px-0"/u);

// --- The glass top bar -------------------------------------------------------------------------------
assert.match(client("base/chrome/SlpChrome.tsx"), /export const SLP_TOP_BAR_CLASS = cn\([\s\S]*?SLP_BAR_GLASS_CLASS,/u);
assert.match(
  client("app/screens/SlpHomeHelpers.tsx"),
  /"flex h-14 shrink-0 items-center gap-2 px-2",\s+SLP_TOP_BAR_CLASS,/u,
);
assert.match(
  client("features/messages/SlpMessages.tsx"),
  /<header className=\{cn\("flex min-h-14[^"]*", SLP_TOP_BAR_CLASS\)\}>/u,
);
assert.match(hub, /@min-\[1024px\]:hidden",\s*SLP_BAR_GLASS_CLASS/u, "the hub header keeps the same glass");

// Merge T × U: the Studio's Business and Relationships cards stack with the shared gap, the owed-#ad
// note and the brand offers are two cards with that gap, and a pair's avatars wear the Story ring.
{
  const studio = client("app/screens/SlpScreenStudio.tsx");
  assert.match(
    studio,
    // W: the two cards moved into the Stir tab; 0.3.11: their rows are "Now showing", one card stack.
    /data-slp-stir-now[\s\S]*?<ul className=\{SLP_CARD_STACK_CLASS\}>/u,
  );
  const ties = client("features/projects/SlpCollabsPanel.tsx");
  assert.match(ties, /<div className=\{SLP_CARD_STACK_CLASS\}>\s*\{owed\.length > 0/u);
  assert.match(ties, /function Pair[\s\S]*?<SlpStoryRingAvatar[\s\S]*?creatorId=\{creator\.id\}[\s\S]*?<Avatar/u);
}

console.log("slurp2 T polish: ok");
