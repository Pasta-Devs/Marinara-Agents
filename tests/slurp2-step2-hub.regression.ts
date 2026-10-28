import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Redesign step 2: hub & feed (header follow-ups, Story shelf + viewer, post card, locked card, post
// dialog, feed tabs, image generation slot).
const root = join(import.meta.dirname, "..");
const slp = join(root, "packages/slurp2/src/engine/packages/client/src/slp");
const src = (path: string) => readFileSync(join(slp, path), "utf8");
const hub = src("app/screens/SlpScreenHub.tsx");
const shell = src("modules/chrome/SlpShell.tsx");
const helpers = src("app/screens/SlpHomeHelpers.tsx");
const moments = src("app/screens/SlpScreenMoments.tsx");
const tile = src("modules/story/SlpStoryTile.tsx");
const card = src("modules/post/SlpPostCard.tsx");
const postHelpers = src("modules/post/SlpPostHelpers.tsx");
const locked = src("modules/post/SlpLockedPostCard.tsx");
const hooks = src("features/feed/slp-feed-viewer-hooks.ts");
const sparkle = src("modules/sparkle/slp-sparkle-styles.ts");
const en = JSON.parse(src("locales/en.json")) as Record<string, string>;

// Root cause: the hero and nav-active tokens are gradients. `bg-[var(--token)]` compiles to
// background-color, which a gradient cannot be, so selected chips, the active nav tab and hero
// surfaces painted nothing. Every use needs the `image:` hint.
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : /\.tsx?$/u.test(name) ? [path] : [];
  });
for (const file of walk(slp)) {
  assert.doesNotMatch(
    readFileSync(file, "utf8"),
    /bg-\[var\(--slurp-(hero|nav-active)\)\]/u,
    `${file}: a gradient token needs bg-[image:var(...)]`,
  );
}

// Step 1 follow-ups: the hub bar is phones only; its ⋯ sits beside the feed tabs; one shared balance
// chip (the coin-fly target) in the hub, profile, thread and Discover phone headers.
assert.match(hub, /data-component="SlurpHome\.StickyHeader"/u);
assert.match(hub, /@min-\[1024px\]:hidden",\s*SLP_BAR_GLASS_CLASS/u, "no desktop hub header bar");
// Step 3.1 (user): the ⋯ next to the feed tabs held only refresh, so both are gone.
assert.doesNotMatch(hub, /ui\.slurp\.home\.moreActions|refreshTimeline/u);
assert.match(shell, /export function SlpBalanceChip/u);
assert.match(
  shell,
  /<SlpBalanceContext\.Provider value=\{\{ coins: walletBalance \?\? null, onOpen: onOpenWallet \}\}>/u,
);
assert.match(shell, /watchAmount=\{coins \?\? undefined\}/u, "the chip is a live balance, so coins land on it");
for (const path of [
  "app/screens/SlpScreenHub.tsx",
  "app/screens/SlpScreenProfile.tsx",
  "app/screens/SlpHubDiscover.tsx",
]) {
  assert.match(src(path), /<SlpBalanceChip/u, `${path} shows the shared chip`);
}
// Step 4 (user, 2026-09-26): no wallet coins in the thread header.
assert.doesNotMatch(src("features/messages/SlpThreadHeader.tsx"), /<SlpBalanceChip/u);
assert.doesNotMatch(hub, /SLP_BALANCE_CHIP_CLASS/u, "no copy of the chip in the hub");

// Story shelf: no "Nothing new yet" before the feed exists; tall tiles with the Creator's avatar;
// ring + glint only when unseen, dimmer when seen.
assert.match(hub, /isLoading=\{isLoading \|\| \(!scope && !isError\)\}/u);
assert.match(tile, /<Avatar account=\{creator\.profile\} size="sm" \/>/u);
assert.match(tile, /\{isNew && <SlpRingGlint \/>\}/u);
assert.match(tile, /!isNew && "opacity-80 saturate-\[0\.8\]/u);

// Story viewer: a text Story is big type on the hero gradient, the caption is not repeated, and the
// progress bar counts only this Creator's Stories.
assert.match(moments, /const textStory = !moment\.post\.imageUrl && !moment\.post\.locked/u);
assert.match(moments, /bg-\[image:var\(--slurp-hero\)\]/u);
assert.match(moments, /moment\.post\.content && !textStory/u);
assert.match(
  hub,
  /total=\{moments\.filter\(\(moment\) => moment\.creator\.profile\.id === activeMoment\.creator\.profile\.id\)\.length\}/u,
);
// Full-bleed: the Modal's own px-5 py-4 beat a plain p-0, which is what left Stories inset on phones.
assert.match(helpers, /contentClassName="!p-0"/u);

// Post card: glossy raised card, one-line header (B17), the 0c tag, one like count everywhere (B35).
assert.match(
  card,
  /rounded-2xl bg-\[var\(--slurp-surface-raised\)\] px-4 py-4 shadow-\[var\(--slurp-shadow-raised\),var\(--slurp-highlight\)\]/u,
);
assert.match(card, /className="min-w-0 truncate rounded-lg text-\[15px\] font-bold/u);
assert.doesNotMatch(card.slice(card.indexOf("One line whatever the name")), /^[^\n]*flex-wrap/u);
assert.match(card, /className=\{slpTagClass\(post\.access === "locked"\)\}/u);
assert.match(card, /const likeCount = slpPostLikeCount\(post, rootPostInteractions\);/u);
assert.match(card, /total=\{likeCount\}/u);
assert.doesNotMatch(card, /countInteractions\(rootPostInteractions, "like"\)/u);
assert.match(
  postHelpers,
  /typeof post\.likeCount === "number" \? post\.likeCount : countInteractions\(rootInteractions, "like"\)/u,
);
// The optimistic like moves the shown count too, or the heart fills and the number stays.
assert.match(hooks, /likeCount: input\.parentInteractionId \? post\.likeCount : post\.likeCount \+ 1/u);
assert.match(
  hooks,
  /likeCount: input\.parentInteractionId \? post\.likeCount : Math\.max\(0, post\.likeCount - removed\)/u,
);

// Locked card: blurred real picture under the veil, lock + glowing "Unlock · 25 ©" pill; the gamble
// row names its coin amount; unlock = veil dissolves (+ the spend moment's Burst).
assert.match(locked, /!revealed && "scale-110 blur-\[10px\]"/u);
assert.match(locked, /\{!revealed && <SlurpSparkleVeil/u);
assert.match(
  locked,
  /<SlpPrimaryButton[\s\S]{0,500}lockednoodlerpostcard\.unlock[\s\S]{0,200}<SlurpCoinAmount amount=\{unlockPrice\}/u,
);
assert.match(locked, /ui\.slurp\.unlocksheet\.freeOrAmount[\s\S]{0,120}amount: unlockPrice \* 3/u);
assert.match(locked, /if \(spent\) playSlpSpendMoment\(origin\);/u);
assert.match(helpers, /<SlurpSparkleVeil className="slp-veil-dissolve/u);
assert.match(sparkle, /@keyframes slp-veil-dissolve/u);
assert.match(sparkle, /prefers-reduced-motion: reduce\) \{ \.slp-veil-dissolve \{ display: none; \}/u);

// Image generation slot (04 §12): pending (this client, server-deferred, or waiting for review) is
// the same 4:5 frame for everyone; failure is the operator's card with labelled actions and the
// provider error behind Details.
assert.match(card, /slpPostImageSlotState\(post, imageGenerationPending, ctx\.postManagement\)/u);
assert.match(
  postHelpers,
  /generatingHere \|\| meta\.imageGenerationDeferred === true \|\| meta\.imagePendingReview === true\) return "pending"/u,
);
assert.match(postHelpers, /meta\.imageGenerationFailed === true && operator \? "failed" : null/u);
// V: the frame takes the picture's own ratio from an inline style (slpPostFrameStyle), so the class only
// sizes and centres it; the pending slot keeps the same frame (and the post's ratio when it is known).
assert.match(postHelpers, /export const SLP_FEED_MEDIA_FRAME_CLASS = "mx-auto w-full"/u);
assert.match(postHelpers, /data-slurp-image-slot="pending"[\s\S]{0,200}SLP_FEED_MEDIA_FRAME_CLASS/u);
assert.match(postHelpers, /<details[\s\S]{0,400}ui\.slurp\.image\.details/u);
for (const key of [
  "ui.slurp.image.drawing",
  "ui.slurp.image.elapsed",
  "ui.slurp.image.failedTitle",
  "ui.slurp.image.failedDetail",
  "ui.slurp.image.editPromptShort",
  "ui.slurp.image.details",
  "ui.slurp.unlocksheet.freeOrAmount",
  "ui.slurp.home.layout.label",
]) {
  assert.ok(en[key], `en has ${key}`);
}
assert.match(en["ui.slurp.unlocksheet.freeOrAmount"]!, /\{\{amount\}\} <coin\/>/u, "one coin rule");

console.log("slurp2 step 2 hub regression passed");
