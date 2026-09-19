import assert from "node:assert/strict";
import { join } from "node:path";
import { slurp2BackstageSource } from "./slurp2-backstage-source";
import { slurp2Source } from "./slurp2-source";

const root = join(import.meta.dirname, "..");
const componentsDir = join(root, "packages/slurp2/src/engine/packages/client/src/components/slurp");
const home = slurp2Source(join(componentsDir, "SlurpHome.tsx"));
const settings = slurp2BackstageSource();
const shell = slurp2Source(join(componentsDir, "SlurpShell.tsx"));
const coin = slurp2Source(join(componentsDir, "SlurpCoin.tsx"));
const creatorPostCard = slurp2Source(join(componentsDir, "SlurpCreatorPostCard.tsx"));
const sparkle = slurp2Source(join(componentsDir, "SlurpSparkleVeil.tsx"));
const hooks = slurp2Source(join(root, "packages/slurp2/src/engine/packages/client/src/hooks/use-slurp.ts"));
const mediaHook = slurp2Source(
  join(root, "packages/slurp2/src/engine/packages/client/src/hooks/use-slurp-media-src.ts"),
);
const ageGate = slurp2Source(join(componentsDir, "SlurpAgeGate.tsx"));
const artwork = slurp2Source(
  join(root, "packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-artwork.operation.ts"),
);
const images = slurp2Source(
  join(root, "packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-images.service.ts"),
);

// The feed row must offer both readings of the same feed.
assert.match(home, /useState<"list" \| "wall">\("list"\)/u, "The feed must default to the list layout");
assert.match(home, /feedLayout === "wall" \? \(\s*<SlurpMediaWall/u, "The wall layout must replace the post list");

// Small polish stays structural: icon-only mobile navigation, useful empty states, and no empty rail.
const mobileNavigation = shell.slice(
  shell.indexOf('data-component="NoodleView.MobileBottomNav"'),
  shell.indexOf("</nav>", shell.indexOf('data-component="NoodleView.MobileBottomNav"')),
);
for (const label of [
  "homeLabel",
  "ui.slurp.navigation.profile",
  "ui.slurp.navigation.messages",
  "ui.slurp.navigation.search",
  "ui.slurp.navigation.more",
]) {
  assert.match(mobileNavigation, new RegExp(`aria-label=\\{[\\s\\S]*${label.replaceAll(".", "\\.")}`, "u"));
}
// 48px: compact, and still above the 44px minimum touch target.
assert.match(shell, /h-12 grid-flow-col/u, "mobile navigation must keep its touch-target height");
assert.doesNotMatch(
  mobileNavigation,
  /<span className="max-w-full truncate px-1">/u,
  "mobile navigation must hide text labels",
);
assert.match(mobileNavigation, /!text-\[var\(--noodle-accent\)\]/u, "mobile navigation icons must stay pink");
assert.match(home, /ui\.slurp\.empty\.clearSearch/u, "empty search must offer a recovery action");
assert.match(home, /ui\.slurp\.empty\.browseAll/u, "an empty Following feed must offer all creators");
assert.match(
  home,
  /\? \("populated" as const\)\s*: \("spanning" as const\)/u,
  "routes without content must not reserve a blank rail",
);
assert.match(ageGate, /ui\.slurp\.ageGate\.leave/u, "the age gate must offer a direct exit");
assert.match(ageGate, /setConfetti\(true\)/u, "the age-gate confetti payoff must remain");
assert.match(ageGate, /onCelebrate\(\);\s*onComplete\(\);/u, "entry must begin while confetti continues");
assert.match(home, /gateCelebrating && <SlurpConfetti fixed/u, "confetti must survive the age gate closing");

// Only observed live balances animate. Static prices and history keep using the same quiet component.
assert.match(coin, /watchAmount\?: number/u, "coin amounts must accept an observed live balance");
assert.match(coin, /data-slurp-coin-spent=/u, "a balance decrease must render spend feedback");
assert.match(coin, /data-slurp-coin-earned=/u, "a balance increase must render earning feedback");
assert.match(coin, /export function SlurpCoinBurst/u, "transaction controls must share one coin-trail effect");
assert.match(coin, /if \(reduceMotion\) return null/u, "coin movement must respect reduced motion");
assert.match(
  home,
  /amount=\{coins\.toLocaleString\(\)\} watchAmount=\{coins\}/u,
  "the Wallet balance must animate spending and earning",
);
assert.match(home, /function SlurpAccessTransition/u, "locked and revealed post shapes need a persistent shell");
assert.match(home, /layout=\{reduceMotion \? false : "size"\}/u, "post height changes must animate instead of jumping");
assert.match(home, /mode="popLayout"/u, "the old post must remain while its revealed form enters");
assert.match(creatorPostCard, /runTransaction/u, "the unlock sheet must stay mounted through payment");
assert.match(creatorPostCard, /ui\.slurp\.unlocksheet\.bestValue/u, "the subscription offer must carry its value cue");
assert.match(sparkle, /data-slurp-celebration-ring/u, "creator identity must share the reveal celebration");
assert.match(sparkle, /new IntersectionObserver/u, "sparkles must observe their viewport visibility");
assert.match(sparkle, /\{inViewport && \(/u, "off-screen sparkle particles must not remain mounted");
assert.match(home, /contentVisibility: "auto"/u, "off-screen feed cards must skip unnecessary rendering work");
assert.match(
  home,
  /const \{ moments, feed, searchResults, discoveredCreators, suggestedCreators \} = useMemo/u,
  "feed projections must stay cached across unrelated renders",
);
assert.match(mediaHook, /MEDIA_CACHE_RETENTION_MS = 2 \* 60_000/u, "recent media must stay warm for back-scrolling");
const viewerQuery = hooks.slice(
  hooks.indexOf("export function useNoodlerViewer"),
  hooks.indexOf("export function useNoodlerUnseenCount"),
);
assert.match(viewerQuery, /queryFn: async \(\{ signal \}\)/u, "feed requests must support cancellation");
assert.match(viewerQuery, /staleTime: 30_000[\s\S]*?gcTime: 10 \* 60_000/u, "feed data must survive quick remounts");
assert.doesNotMatch(viewerQuery, /refetchOnMount: "always"/u, "fresh cached feeds must not refetch on every mount");
assert.match(
  hooks,
  /useUnlockNoodlerPost[\s\S]*?viewer-wallets/u,
  "unlocking must refresh the shared wallet balance that drives transaction feedback",
);

// A locked or text-only post has no tile to draw, so it must not reach the wall.
const wall = home.slice(home.indexOf("function SlurpMediaWall("), home.indexOf("function StageProfileView("));
assert.match(
  wall,
  /if \(post\.locked \|\| typeof post\.imageUrl !== "string"\) return \[\];/u,
  "The media wall must skip locked and image-less posts",
);
assert.match(wall, /LoadMoreFeedButton/u, "The media wall must keep paging through the feed");

// Desktop settings owns the nav column instead of nesting a second menu inside the page.
assert.match(shell, /\{desktopSidebar \?\? \(/u, "The shell must be able to swap its desktop nav");
assert.match(
  home,
  /desktopSidebar=\{\s*<SlurpSettingsSidebar navigation=\{navigation\} onNavigate=\{onNavigate\} onExit=\{exitToCreatorHub\}/u,
  "Settings must supply the desktop sidebar with a way out",
);
assert.match(home, /desktopSidebar/u, "The shell must own the desktop settings navigation");

// Mobile uses one compact destination picker instead of the quick tabs, and search gets its own row.
const row = settings.slice(
  settings.indexOf("function SlurpSettingsSectionRow("),
  settings.indexOf("function useSlurpBackstageController("),
);
assert.match(row, /<select/u, "The active destination must be exposed as a native picker");
assert.match(row, /<optgroup/u, "The picker must reach a page, not only its section");
assert.match(row, /md:hidden/u, "The destination picker is mobile only");
assert.match(settings, /<SlurpBackstageSubnav\s+className="hidden md:flex"/u, "Mobile must hide the quick tabs");
assert.match(
  settings,
  /className="max-w-none basis-full md:max-w-xl md:basis-auto"/u,
  "Mobile search must use a full row",
);

const card = slurp2Source(join(componentsDir, "SlurpCreatorProfileCard.tsx"));

// One creator card everywhere; only Discover opts into its horizontal layout and actions.
assert.match(card, /layout = "grid"/u, "the shared card must preserve the grid default");
assert.doesNotMatch(home, /variant="compact"/u, "No surface may fall back to the old row-shaped card");
const suggestions = home.slice(
  home.indexOf("function SlurpInlineSuggestedCreators("),
  home.indexOf("type SlurpMoment ="),
);
assert.match(suggestions, /<SlurpCreatorProfileCard/u, "Inline suggestions must use the full creator card");

// The strip belongs to the page, so the hide-on-scroll header cannot take it away.
const stickyHeader = home.slice(
  home.indexOf('data-component="SlurpHome.StickyHeader"'),
  home.indexOf("<SlurpMomentsShelf"),
);
assert.doesNotMatch(stickyHeader, /SlurpMomentsShelf/u, "The moments strip must sit outside the sticky header");
assert.match(stickyHeader, /h-11 w-11/u, "The mobile refresh control must keep a full touch target");
assert.match(stickyHeader, /absolute start-1\/2[\s\S]*?-translate-x-1\/2/u, "The logo must stay geometrically centred");
assert.match(stickyHeader, /<SlurpCoinAmount amount=\{walletCoins\}/u, "the sticky header shows the coin balance");

// Shared subpage headers are real page headings and retain visible keyboard focus.
const frame = home.slice(home.indexOf("function NoodlerFrame("), home.indexOf("function SlurpStudioView("));
assert.match(frame, /focus-visible:ring-2/u);
assert.match(frame, /<h1 className="min-w-0 flex-1 truncate/u);
assert.match(frame, /rtl:-scale-x-100/u);
assert.match(home, /absolute start-2 top-2[\s\S]*?rtl:-scale-x-100/u, "The profile back control must follow direction");

// One highlight, one row shape, for every destination in the app.
assert.match(shell, /export const SLURP_ROW_ACTIVE_CLASS/u, "The shell must own the active-row highlight");
assert.doesNotMatch(shell, /shadow-sm shadow-black\/10/u, "No nav row may keep a private highlight");
assert.match(settings, /cn\(SLURP_ROW_CLASS, active \? SLURP_ROW_ACTIVE_CLASS/u, "Settings must reuse it");
for (const [name, source] of [
  ["shell", shell],
  ["settings", settings],
  ["home", home],
] as const) {
  // An image-derived stage background (the `object-cover opacity-25 blur-*` pattern shared with
  // PostImageCropEditor) is a media surface, not a decorative panel glow. Only the latter is banned.
  const decorativeGlow = source.replace(/scale-110 object-cover opacity-25 blur-3xl/gu, "");
  assert.doesNotMatch(decorativeGlow, /blur-3xl/u, `${name} panels must not carry one-off decorative glows`);
}

// Creator studio was a second door into Settings.
assert.doesNotMatch(shell, /reatorStudio/u, "The shell must not offer a creator studio destination");
assert.doesNotMatch(home, /goToCreatorStudio/u, "Home must not route to a creator studio");

// Routes only reserve the contextual column when they have content for it.
assert.match(home, /profileRail \? "populated" : "spanning"/u);
assert.match(home, /view === "messages"[\s\S]*?contextualRail="spanning"/u);
assert.match(
  shell,
  /<motion\.div\s+key=\{activeView\}[\s\S]*?animate=\{prefersReducedMotion \? \{ opacity: 1 \} : \{ opacity: 1, y: 0 \}\}/u,
  "View changes must remount with the destination fade and reduced-motion alternative",
);
assert.doesNotMatch(
  shell,
  /<AnimatePresence\b[^>]*\bmode\s*=\s*["']wait["']/u,
  "An unfinished exit must not block the next page",
);

// The media wall opens the post, not a bare lightbox, and the dialog shows one copy of the image.
assert.match(home, /onOpenPost=\{setOpenPostId\}/u, "Wall tiles must open the post dialog");
assert.match(
  home,
  /side=\{<SlurpCreatorPostCard post=\{\{ \.\.\.post, imageUrl: null, imagePrompt: null \}\}/u,
  "The dialog must not draw the image or its prompt twice",
);
assert.match(home, /function SlurpMomentViewer\(/u);
const moment = home.slice(home.indexOf("function SlurpMomentViewer("), home.indexOf("function LoadMoreFeedButton("));
assert.match(moment, /<SlurpMediaDialog/u, "Stories must use the same dialog shape as posts");

// Settings owns the way out, loudly, under the app mark the shell keeps.
assert.match(settings, /bg-\[var\(--noodle-accent\)\]\/15[\s\S]*?ui\.slurp\.settings\.exit/u);
assert.match(shell, /<NoodleLogo[\s\S]*?\{desktopSidebar \?\? \(/u, "The mark must survive the sidebar swap");

const postCard = slurp2Source(join(componentsDir, "SlurpCreatorPostCard.tsx"));
const imageFrame = slurp2Source(join(componentsDir, "PostImageCropEditor.tsx"));

// Active state must be a fill, not a shadow that vanishes against the panel behind it.
assert.match(shell, /export const SLURP_TOGGLE_ACTIVE_CLASS/u, "Small toggles need a shared active fill");
assert.match(shell, /SLURP_ROW_ACTIVE_CLASS =\n {2}"bg-\[color-mix/u, "The active row must be coloured in");
assert.doesNotMatch(home, /feedLayout === option\.id && "bg-\[var\(--slurp-surface-raised\)\]/u);

// The coin reads as a coin. It is now a real minted asset rather than a CSS disc with a letter on
// it, so the check moved to the shared component and its source SVG.
assert.match(coin, /export const SLURP_COIN_SRC =\s*\n?\s*"data:image\/svg\+xml;base64,/u);
assert.match(coin, /export function SlurpCoinAmount\(/u);
assert.match(shell, /<SlurpCoinAmount amount=/u, "balances render through the shared coin component");

// Wide screens: the room and frame must not add a right-edge accent glow.
assert.match(shell, /"--slurp-outer"/u, "The outer background needs its own token");
assert.doesNotMatch(
  shell,
  /shadow-\[0_0_140px_-40px_color-mix/u,
  "The app frame must not glow into the outer background",
);
assert.doesNotMatch(
  shell,
  /@min\[1280px\]:shadow-\[18px_0_54px_-48px_var\(--noodle-accent\)\]/u,
  "The main body must not glow on its right edge",
);
assert.match(
  home,
  /const \[profileDraftDirty, setProfileDraftDirty\] = useState\(false\)/u,
  "profile editing must track real changes explicitly",
);
assert.match(
  home,
  /if \(!profileDraftDirty\) return true;/u,
  "unchanged creator edits must not trigger the discard dialog",
);

// Banners are environmental covers. They must not receive character avatar references or context.
assert.match(artwork, /suppressCharacterContext: input\.kind === "banner"/u);
assert.match(artwork, /suppressCharacterContext: kind === "banner"/u);
assert.match(
  images,
  /const referenceSubject =\s*!input\.suppressCharacterContext && input\.linkedPublicAccount \? input\.linkedPublicAccount : null/u,
  "Banner suppression must prevent linked character or persona references",
);
assert.match(
  images,
  /if \(!input\.suppressCharacterContext && sourceAppearance && input\.settings\.imageGenerationIncludeDescriptions\)/u,
  "Banner suppression must also prevent appearance text",
);

// Home order: header, then stories, then the tabs sitting on top of the posts.
const homeFeed = home.slice(home.indexOf('data-component="SlurpHome.StickyHeader"'), home.indexOf("SlurpFeedSkeleton"));
assert.ok(
  homeFeed.indexOf("<SlurpMomentsShelf") < homeFeed.indexOf("data-slurp-home-masthead"),
  "Stories must sit above the feed tabs",
);
assert.ok(
  homeFeed.indexOf("ui.slurp.home.latestDrops") < homeFeed.indexOf("data-slurp-home-masthead"),
  "The feed tabs must sit directly on top of the posts",
);

// Posts hold still, carry their three actions, and hand image clicks to the dialog.
assert.doesNotMatch(postCard, /hover:-translate-y/u, "Posts must not move under the pointer");
assert.match(postCard, /MoreHorizontal/u, "Creator posts must have the shared action menu");
assert.match(postCard, /Share as image/u, "Creator posts must expose share as image");
assert.match(postCard, /if \(ctx\.openPost\) ctx\.openPost\(post\.id\);/u, "Post images open the post dialog");

// Portrait images get their own shape instead of a stamp in a 4:3 box.
assert.match(imageFrame, /Math\.min\(16 \/ 9, Math\.max\(0\.8, naturalRatio\)\)/u, "The frame follows the image");

console.log("Slurp feed layout and settings navigation regressions passed");
