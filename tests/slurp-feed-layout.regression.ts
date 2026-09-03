import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const componentsDir = join(root, "packages/slurp/src/engine/packages/client/src/components/slurp");
const home = readFileSync(join(componentsDir, "SlurpHome.tsx"), "utf8");
const settings = readFileSync(join(componentsDir, "SlurpSettings.tsx"), "utf8");
const shell = readFileSync(join(componentsDir, "SlurpShell.tsx"), "utf8");
const artwork = readFileSync(
  join(root, "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-artwork.operation.ts"),
  "utf8",
);
const images = readFileSync(
  join(root, "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-images.service.ts"),
  "utf8",
);

// The feed row must offer both readings of the same feed.
assert.match(home, /useState<"list" \| "wall">\("list"\)/u, "The feed must default to the list layout");
assert.match(home, /feedLayout === "wall" \? \(\s*<SlurpMediaWall/u, "The wall layout must replace the post list");

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
assert.match(
  settings,
  /md:flex md:flex-col @min-\[1024px\]:hidden/u,
  "The in-page desktop nav must yield to the shell",
);

// The mobile section row must show where you are and that there is more of it.
const row = settings.slice(
  settings.indexOf("function SlurpSettingsSectionRow("),
  settings.indexOf("export function SlurpSettings("),
);
assert.match(
  row,
  /scrollIntoView\(\{ block: "nearest", inline: "center" \}\)/u,
  "The active section must scroll into view",
);
assert.match(row, /edges\.start \? "transparent"/u, "A scrollable start edge must fade");
assert.match(row, /edges\.end \? "transparent"/u, "A scrollable end edge must fade");

const card = readFileSync(join(componentsDir, "SlurpCreatorProfileCard.tsx"), "utf8");

// One creator card everywhere: the rail, the inline suggestions, and the discover grid.
assert.doesNotMatch(card, /variant/u, "The creator card must have a single shape");
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

// One highlight, one row shape, for every destination in the app.
assert.match(shell, /export const SLURP_ROW_ACTIVE_CLASS/u, "The shell must own the active-row highlight");
assert.doesNotMatch(shell, /shadow-sm shadow-black\/10/u, "No nav row may keep a private highlight");
assert.match(settings, /cn\(SLURP_ROW_CLASS, active \? SLURP_ROW_ACTIVE_CLASS/u, "Settings must reuse it");
for (const [name, source] of [
  ["shell", shell],
  ["settings", settings],
  ["home", home],
] as const) {
  assert.doesNotMatch(source, /blur-3xl/u, `${name} panels must not carry one-off decorative glows`);
}

// Creator studio was a second door into Settings.
assert.doesNotMatch(shell, /reatorStudio/u, "The shell must not offer a creator studio destination");
assert.doesNotMatch(home, /goToCreatorStudio/u, "Home must not route to a creator studio");

// Same content width on every destination, and a visible change when you switch.
assert.doesNotMatch(home, /"spanning" as const/u, "No Slurp destination may span the rail column");
assert.match(
  shell,
  /<AnimatePresence mode="wait" initial=\{false\}>[\s\S]*?key=\{activeView\}/u,
  "View changes must animate",
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

const postCard = readFileSync(join(componentsDir, "SlurpCreatorPostCard.tsx"), "utf8");
const imageFrame = readFileSync(join(componentsDir, "PostImageCropEditor.tsx"), "utf8");

// Active state must be a fill, not a shadow that vanishes against the panel behind it.
assert.match(shell, /export const SLURP_TOGGLE_ACTIVE_CLASS/u, "Small toggles need a shared active fill");
assert.match(shell, /SLURP_ROW_ACTIVE_CLASS =\n {2}"bg-\[color-mix/u, "The active row must be coloured in");
assert.doesNotMatch(home, /feedLayout === option\.id && "bg-\[var\(--slurp-surface-raised\)\]/u);

// The coin reads as a coin: bright mark on the accent disc.
assert.match(shell, /rounded-full bg-\[var\(--noodle-accent\)\] font-black leading-none text-white/u);

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

// Banners are environmental covers. They must not receive character avatar references or context.
assert.match(artwork, /suppressCharacterContext: input\.kind === "banner"/u);
assert.match(artwork, /suppressCharacterContext: kind === "banner"/u);
assert.match(images, /!input\.suppressCharacterContext &&[\s\S]*?input\.disclosureMode/u);

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
assert.match(postCard, /ctx\.postManagement && \(\n\s*\/\* Three plain buttons/u, "Managed posts show their actions");
assert.doesNotMatch(postCard, /MoreHorizontal/u, "The post action menu is gone");
assert.match(postCard, /if \(ctx\.openPost\) ctx\.openPost\(post\.id\);/u, "Post images open the post dialog");

// Portrait images get their own shape instead of a stamp in a 4:3 box.
assert.match(imageFrame, /Math\.min\(16 \/ 9, Math\.max\(0\.8, naturalRatio\)\)/u, "The frame follows the image");

console.log("Slurp feed layout and settings navigation regressions passed");
