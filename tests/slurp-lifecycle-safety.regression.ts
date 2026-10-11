import assert from "node:assert/strict";
import { join } from "node:path";
import { slurp2BackstageSource } from "./slurp2-backstage-source";
import { slurp2Source } from "./slurp2-source";

const root = join(import.meta.dirname, "..");
const read = (path: string) => slurp2Source(join(root, path));
const routes = read("packages/slurp2/src/engine/packages/server/src/routes/slurp.routes.ts");
const publicSupport = read("packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-public-support.ts");
const replyOperation = read(
  "packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-creator-reply.operation.ts",
);
const imageConnections = read(
  "packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-image-connections.ts",
);
const home = read("packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpHome.tsx");
const storage = read("packages/slurp2/src/engine/packages/server/src/services/storage/slurp.storage.ts");
const settings = slurp2BackstageSource();
const settingsControls = read(
  "packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpSettingsControls.tsx",
);
// Slice 9 split Backstage into a thin host plus feature-owned panels, so the shared Toggle no
// longer renders inside the SlurpSettings.tsx concatenation itself; any feature panel shows it is
// still wired up.
const creatorPublishingSection = read(
  "packages/slurp2/src/engine/packages/client/src/slp/features/creators/settings/SlpCreatorPublishingSection.tsx",
);
const profileSurface = read("packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpProfileSurface.tsx");
const englishLocale = read("packages/slurp2/src/engine/packages/client/src/slp/locales/en.json");
const creatorPostCard = read(
  "packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpCreatorPostCard.tsx",
);
const creatorProfileCard = read(
  "packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpCreatorProfileCard.tsx",
);
const mediaHook = read("packages/slurp2/src/engine/packages/client/src/hooks/use-slurp-media-src.ts");
const slurpMedia = read("packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-media.ts");
const artwork = read("packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-artwork.operation.ts");
const shell = read("packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpShell.tsx");
const serverEntry = read("packages/slurp2/src/engine/packages/server/src/services/slurp/server-entry.ts");
assert.match(
  settings,
  /const \{ section, target \} = host;[\s\S]*?useSlpAdsBackstageState\(target/u,
  "settings must define its section before dependent hooks run",
);

const multipartReader = routes.slice(
  routes.indexOf("export async function readCreatorMultipart"),
  routes.indexOf("async function importCreatorMedia"),
);
assert.match(
  multipartReader,
  /if \(!write\.acquired\) \{[\s\S]*?part\.file\.resume\(\);[\s\S]*?throw new SlpCreatorMediaRequestError\("Slurp data cleanup is in progress\.", 409\)/u,
);
assert.match(multipartReader, /return await part\.toBuffer\(\);/u);
assert.match(multipartReader, /const buffer = write\.value;[\s\S]*?isAllowedImageBuffer\(buffer, "\.avif"\)/u);
// An image saved straight from a post URL has no extension, so a filename gate rejected valid
// uploads with "Unsupported image file type". The header is the only evidence of the type.
assert.doesNotMatch(
  multipartReader,
  /extname\(part\.filename\)/u,
  "post media uploads must be validated by magic bytes, not by the uploaded filename",
);
assert.doesNotMatch(multipartReader, /return reply\./u, "the multipart helper must not return before validating media");
// This guarded slurp-public-generation.service.ts, which had no importers and has been deleted.
// The live Slurp equivalent is the image gate in the generation service: a run with no usable
// image prompt must not reach the provider.
assert.match(
  read("packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-generation.service.ts"),
  /if \(!prompt\) return \{ post: await persist\(await galleryFallback\(\)\)/u,
  "image generation must stay gated on the run actually producing a prompt",
);

const updateRoute = routes.slice(
  routes.indexOf('app.put("/slurp/accounts/:id/stage-profile"'),
  routes.indexOf('app.post("/slurp/accounts/:id/source/dismiss"'),
);
assert.ok(
  updateRoute.indexOf("source_revision_conflict") < updateRoute.indexOf("discardNoodlerPreparedPost"),
  "source revision conflicts must be checked before prepared posts are discarded",
);
assert.match(
  updateRoute,
  /preparedPostCount: preparedForCreator\.length/u,
  "disclosure review must report the real prepared-post count",
);
assert.doesNotMatch(
  publicSupport.slice(
    publicSupport.indexOf("for (const account of existingCharacterAccounts)"),
    publicSupport.indexOf("return filterExcludedNoodleAccounts"),
  ),
  /deleteAccountByEntity/u,
  "missing sources must not delete retained Slurp Creator state",
);
assert.match(
  replyOperation,
  /resolveSlurpTextConnection\(createConnectionsStorage\(db\), settings\.generationConnectionId\)/u,
  "Creator replies must use the Slurp connection with the shared fallback ladder",
);
assert.match(imageConnections, /LEGACY_KEY = "noodle\.noodler-image-connections"/u);
assert.match(imageConnections, /storage\.get\(KEY\)[\s\S]*?storage\.get\(LEGACY_KEY\)/u);
assert.doesNotMatch(home, /canQuieten|makeQuieter|quieterPending/u);
assert.match(home, /const viewingOwnCreator = profile\.sourceAccountId === viewerAccount\?\.entityId/u);
assert.match(home, /const managedCreator = true/u);
assert.match(home, /const personaBackedCreator = viewerAccounts\.some/u);
assert.match(home, /avatarUrl: persona\.avatarPath/u, "persona switcher accounts must retain persona avatars");
assert.match(
  home,
  /connectionCountsQuery\.data\?\.\[profile\.sourceAccountId\]/u,
  "persona counts must use source account ids",
);
assert.match(home, /useCreatorViewerWallets\(\)/u, "Slurp must load wallets for every persona");
assert.match(home, /personaWallets: viewerWalletsQuery\.data/u, "persona wallets must reach the switcher");
assert.doesNotMatch(
  home,
  /aria-label=\{localizeUi\("ui\.slurp\.wallet\.balance", \{ amount: activeWalletCoins \}\)\}/u,
  "ViewerHub must use its wallet prop",
);
assert.match(shell, /<SlurpCoinAmount amount=/u, "balances must use the shared coin component");
// Removed: per-Creator viewer access was dropped on purpose (commit 9a1b04771), so there is no filter to pin.
assert.match(
  home,
  /!personaBackedCreator && \([\s\S]*?openSlpCreatorSettings\(profile\.id, \{ tab: "automation" \}\)/u,
);
assert.match(storage, /withoutCreatorSelfHiddenAccountId\([\s\S]*?row\.sourceEntityId \?\? row\.entityId/u);
assert.match(shell, /CSS\.supports\?\.\("-webkit-touch-callout", "none"\)/u);
assert.match(shell, /"--slurp-bottom-safe-inset": BOTTOM_SAFE_INSET/u);
assert.match(shell, /pb-\[calc\(48px\+var\(--slurp-bottom-safe-inset\)\)\]/u);
assert.match(shell, /calc\(3\.5rem \+ 10px \+ 1rem \+ var\(--slurp-bottom-safe-inset\)\)/u);
assert.doesNotMatch(home, /SlurpMobileHeader/u, "Slurp must not render a duplicate mobile top header");
assert.match(
  shell,
  /data-component="NoodleView\.MobileBottomNav"[\s\S]*?onClick=\{onMobileHomeTap\}[\s\S]*?onClick=\{onOpenSearch\}[\s\S]*?onClick=\{onOpenMessages\}[\s\S]*?data-component="NoodleView\.MobileAccountSwitcher"/u,
  "the mobile persona switcher must be the trailing navigation item",
);
assert.match(
  shell,
  /<PersonaList[\s\S]*?accounts=\{visiblePersonaAccounts\.filter\(/u,
  "persona switching must keep readable named rows",
);
assert.doesNotMatch(
  shell,
  /function PersonaFacePile/u,
  "persona switching must not collapse accounts into avatar-only controls",
);
assert.match(home, /ref=\{setStickyHeader\}[\s\S]*?HIDE_ON_SCROLL_CLASS/u);
assert.match(shell, /--slurp-canvas/u, "Slurp must own a theme-safe canvas token");
// Step 1 of the shell redesign (40c582ffd) traded the centred logo for a left-aligned wordmark.
assert.match(
  home,
  /data-component="SlurpHome\.HeaderBar"[\s\S]*?<SlpWordmark/u,
  "the Home masthead must carry the Slurp brand mark",
);
assert.match(
  home,
  /data-component="SlurpHome\.HeaderBar"[\s\S]*?<SlpBalanceChip/u,
  "the Home masthead must carry the wallet balance",
);
assert.match(home, /slurp-rail-discover-heading/u, "the desktop discovery rail must name the creators it contains");
assert.match(home, /ui\.slurp\.discover\.topCreators/u, "Discover must show a top Creator leaderboard in its rail");
assert.match(
  home,
  /useState<"likes" \| "subscribers">\("likes"\)/u,
  "Discover ranking must expose the two requested modes",
);
assert.match(
  home,
  /label=\{localizeUi\("ui\.slurp\.discover\.rankBy"[\s\S]*?value=\{discoverRank\}/u,
  "Discover ranking toggle must bind its selected state",
);
assert.match(
  home,
  /connectionCountsQuery\.data\?\.\[creator\.profile\.id\]\?\.fans/u,
  "Subscriber ranking must use real Creator fan counts",
);
assert.match(
  home,
  /ownsSelectedProfile \? \(/u,
  "Owned profiles must receive Creator tools instead of related creators",
);
assert.match(home, /ui\.slurp\.profile\.similarCreators/u, "Other profiles may show related creators in the rail");
assert.doesNotMatch(
  home,
  /navigation\.view === "wallet"[\s\S]{0,180}<NoodleShell[^>]*rightRail=/u,
  "Wallet must not duplicate itself in a right rail",
);
assert.doesNotMatch(
  home,
  /navigation\.mode === "creator-settings"[\s\S]{0,700}rightRail=/u,
  "Settings must not add a duplicate summary rail",
);
const inboxRoute = home.slice(
  home.indexOf('if (navigation.mode === "creator" && navigation.view === "messages")'),
  home.indexOf('if (navigation.mode === "creator" && navigation.view === "profiles")'),
);
assert.match(inboxRoute, /<SlpShell \{\.\.\.shellProps\} contextualRail="spanning">\s*<SlurpInboxView/u);
assert.doesNotMatch(inboxRoute, /rightRail=/u, "The Inbox workspace must not reserve a second conversation rail");
assert.doesNotMatch(home, /ui\.slurp\.home\.tonight/u, "the rail must not carry a heading with no content under it");
// The 72-hour default is a setting now, and the shelf reads it with the same default.
assert.match(home, /storyLifetimeHours \?\? 72\) \* 60 \* 60 \* 1000/u);
assert.match(home, /data-component="SlurpHome\.Moments"/u, "Home must expose the real 24-hour Moments shelf");
assert.match(home, /ui\.slurp\.moments\.empty/u, "Home must keep Stories discoverable when the shelf is empty");
assert.doesNotMatch(home, /\{moments\.length > 0 && \(/u, "the Stories shelf must not disappear when it is empty");
assert.match(home, /isSlurpStory\(post\)[\s\S]*?momentCutoff/u, "Home must show only fresh Story posts in its shelf");
assert.match(home, /id: "stories"[\s\S]*?ui\.slurp\.stories\.archive/u, "Creator Rooms must retain a Story archive");
assert.match(home, /activeTab === "stories"[\s\S]*?return story/u, "the Story archive must not apply the Home cutoff");
assert.match(
  read("packages/slurp2/src/engine/packages/client/src/hooks/use-slurp.ts"),
  /for \(let cursor = first\.nextCursor; cursor;\)[\s\S]*?cursor = page\.nextCursor;/u,
  "Creator Room archives must follow every post cursor",
);
assert.match(home, /function SlurpMomentViewer/u);
assert.match(
  home,
  /useSlurpMediaSrc\(moment\.post\.imageUrl, \{ width: 1600 \}\)/u,
  "Moments must use full-size authenticated Slurp media",
);
assert.match(
  home,
  /moment\.post\.locked[\s\S]*?onUnlock\(moment\.post\.id\)[\s\S]*?onToggleSubscription/u,
  "locked Moments must retain both supported access paths",
);
assert.match(home, /mobileFullscreen/u, "Moments must fill the mobile viewport");
assert.match(home, /event\.key === "ArrowLeft"[\s\S]*?event\.key === "ArrowRight"/u);
// The "Latest Sauce" eyebrow above the feed tabs was removed by the masthead's "one row, one
// purpose" redesign (SlpScreenHub, data-slurp-home-masthead): the feed tab segment is the only
// row now, so `ui.slurp.home.latestDrops` is an unused locale key, not a feature loss.
// The hub's own function ends at its closing brace; the next file in the concatenation is not part of it.
const viewerHubStart = home.indexOf("export function ViewerHub(");
const viewerHub = home.slice(viewerHubStart, home.indexOf("\n}\n", viewerHubStart));
assert.doesNotMatch(viewerHub, /<NoodlerPostComposer/u, "the viewer-first Home lobby must not contain publishing");
assert.match(home, /<NoodlerPostComposer/u, "managed Creator Rooms must retain publishing");
assert.match(
  home,
  // The composer is a sheet opened from the action row now, so only the tools toggle sits in this bar.
  /data-slurp-creator-tools[\s\S]*?aria-expanded=\{creatorToolsOpen\}[\s\S]*?aria-controls="slurp-creator-tools-panel"/u,
  "Collapsed Profile controls must stay behind one toggle",
);
assert.match(englishLocale, /"ui\.slurp\.profile\.creatorTools": "Creator tools"/u);
// Edit profile now sits in the tools body, not in front of the chevron.
assert.match(
  home,
  /data-slurp-creator-tools[\s\S]*?onClick=\{onEdit\}[\s\S]*?ui\.slurp\.profile\.editProfile/u,
  "Edit profile must stay inside the Profile controls",
);
// The Edit row (group/edit) is gone; Edit profile is a plain quiet button in the tools body.
assert.doesNotMatch(
  home.slice(home.indexOf("data-slurp-creator-tools"), home.indexOf('id="slurp-creator-tools-panel"')),
  /border-s/u,
  "the compact Profile controls rail must not be split by segment dividers",
);
// Edit Profile belongs to the same profile rail, not inside the expandable operational panel.
assert.doesNotMatch(
  home.slice(home.indexOf('id="slurp-creator-tools-panel"'), home.indexOf("<NoodlerPostComposer")),
  /onClick=\{onEdit\}/u,
  "Profile controls must not duplicate the rail's Edit Profile action",
);
assert.match(home, /id="slurp-rail-discover-heading"/u, "Discover must keep its heading");
assert.match(home, /sm:grid-cols-2/u, "Discover must present creators as adaptive cards");
assert.match(
  creatorProfileCard,
  /function SlpCreatorCover[\s\S]*?useNearViewportSlurpMediaSrc\(coverUrl \?\? creator\.profile\.avatarUrl/u,
);
assert.match(home, /tabs=\{\[\{ id: "emoji"/u, "the main composer must expose only its functional emoji media tab");
assert.doesNotMatch(home, /tabs=\{\[[^\]]*id: "gif"/u, "the main composer must not expose its no-op GIF action");
assert.match(home, /motion-reduce:transition-none/u);
assert.match(creatorPostCard, /data-slurp-post-kind=\{postKind\}/u);
const lockedCard = creatorPostCard.slice(
  creatorPostCard.indexOf("export function LockedSlurpPostCard"),
  creatorPostCard.indexOf("function noodlerUnlockPriceOf"),
);
assert.match(lockedCard, /data-slurp-locked-preview/u);
// See slurp-media-surfaces: assert the treatment, not the exact Tailwind value.
assert.match(lockedCard, /saturate-\[[\d.]+\]/u);
assert.doesNotMatch(
  lockedCard,
  /(?:^|\s)blur-sm/u,
  "server-blurred locked previews must not be blurred again in the client",
);
// 3495e3362 unified the profile list's bordered rows into the same glossy raised card the feed
// uses; only the dialog surface still gets flat padding, since the dialog itself is the card.
assert.match(
  creatorPostCard,
  /surface === "dialog"\s*\n\s*\? "px-4 py-5"\s*\n\s*: \/\/ Glossy raised card \(feed and profile list/u,
);
assert.match(creatorPostCard, /motion-reduce:active:scale-100/u);
assert.match(home, /function DisclosureBadge[\s\S]*?HelpTooltip/u);
assert.match(home, /confirmProviderDisclosure/u);
assert.doesNotMatch(home, /findLastIndex/u, "Slurp hub must support the Engine ES2020 target");
assert.match(
  read("packages/slurp2/src/engine/packages/client/src/slp/features/creators/SlpStageProfileForm.tsx"),
  /function profileAccent\(_profileId: string\): string \{\s*return SLP_PINK;/u,
);
assert.doesNotMatch(home, /#7ED6A5/u, "Creator profiles must not override Slurp with a green accent");
assert.ok(
  home.indexOf("const [draftNoodleAccountId, setDraftNoodleAccountId]") < home.indexOf("useCreatorEligibleAccounts("),
  "profile source state must be declared before first-render query evaluation",
);
assert.match(
  storage,
  /cleanupRetiredViewer[\s\S]*?slpAccountSubscriptions[\s\S]*?slpPostUnlocks[\s\S]*?slurpViewerSettingsKey/u,
);
assert.match(settings, /ui\.slurp\.settings\.creators\.sourceChanged/u);
// Slice 9's "Desktop settings owns the nav column" redesign replaced the in-page `grid-cols` rail
// and mobile `<select>` destination picker with the shell's swappable desktopSidebar
// (SlpBackstageSidebar) and the horizontal-scrolling SlurpBackstageNavigation row; covered in
// tests/slurp-feed-layout.regression.ts (aria-current, overflow-x-auto, desktopSidebar).
assert.match(settings, /aria-live="polite"/u, "settings saves must announce their state");
assert.match(settings, /selectedCreatorId/u, "creator settings must keep an explicit master-detail selection");
assert.match(settings, /data-slurp-settings-layout/u, "settings must expose its responsive layout boundary");
assert.match(
  shell,
  /slurpActive\s*\?\s*"max-w-\[1680px\][\s\S]*?:\s*"max-w-\[1360px\]"/u,
  "every Slurp view must share one wide desktop frame",
);
assert.match(
  shell,
  /export type SlpShellContextualRail = "populated" \| "blank" \| "spanning"/u,
  "Slurp views must declare how they use the contextual rail",
);
assert.match(
  shell,
  /aria-hidden="true"[\s\S]*?data-slurp-contextual-rail="blank"/u,
  "The shell must keep a non-interactive blank-rail mode for callers that need stable alignment",
);
assert.match(
  home,
  /navigation\.view === "hub" \|\| navigation\.view === "search"\)[\s\S]*?\? \("populated" as const\)[\s\S]*?: \("spanning" as const\)/u,
  "Only Home and Discover reserve the contextual rail by default",
);
assert.doesNotMatch(settings, /max-w-\[1096px\]/u, "settings must fill the shared Slurp desktop frame");
assert.match(creatorPublishingSection, /import \{[^}]*Toggle \} from "[./]*modules\/settings\/SlpSettingsControls"/u);
assert.match(creatorPublishingSection, /<Toggle/u, "Settings panels must use the extracted shared toggle");
assert.match(settingsControls, /data-slurp-setting-toggle/u);
assert.match(settingsControls, /role="switch"/u, "polished settings toggles must retain native checkbox semantics");
// The Creators list's own fixed-height scroll box (0.0.17) is gone after "settings round 2: rows,
// one hub, phone settings list" (01a648ade): the list itself is a plain flow, and `xl:sticky
// xl:top-4` below is what keeps it browsable beside its detail on wide screens now.
// The inline side-by-side detail panel is gone: a Creator's detail is now one modal
// (SlpCreatorSettingsModal, role="dialog") opened from the list, so there is no longer a sticky
// list column to keep visible beside it.
assert.match(
  slurp2Source(
    "packages/slurp2/src/engine/packages/client/src/slp/features/creators/settings/SlpCreatorSettingsModal.tsx",
  ),
  /role="dialog"/u,
  "Creator detail must open as an accessible dialog now that it is a modal",
);
assert.match(settings, /ui\.slurp\.settings\.creators\.personaAutomationDetail/u);
assert.match(settings, /ui\.slurp\.settings\.creators\.moreActions/u);
// slurp2 runs no legacy migration: a legacy Slurp can be installed beside it, and reading or
// rewriting its rows is exactly what the split exists to prevent. Listing stage profiles must
// still be a pure read.
const profileList = storage.slice(
  storage.indexOf("async listNoodlerStageProfiles"),
  storage.indexOf("async createNoodlerAccount"),
);
assert.ok(profileList.length > 0, "listNoodlerStageProfiles must stay present");
assert.doesNotMatch(profileList, /updateNoodlerSourceSnapshot|patchAccountSettings/u);
assert.doesNotMatch(storage, /migrateLegacy/u, "slurp2 storage must not carry a legacy migration");
assert.doesNotMatch(serverEntry, /migrateLegacy/u, "slurp2 activation must not run a legacy migration");
const dismissStart = routes.indexOf('app.post("/slurp/accounts/:id/source/dismiss"');
const dismissEnd = routes.indexOf('app.post("/slurp/accounts/:id/source/adopt-identity"');
assert.ok(dismissStart >= 0 && dismissEnd > dismissStart, "the dismiss route must sit before adopt-identity");
const dismissRoute = routes.slice(dismissStart, dismissEnd);
assert.match(dismissRoute, /updateNoodlerSourceSnapshot/u);
assert.match(dismissRoute, /listNoodlerStageProfiles/u);
assert.match(settings, /sourceStatus\.\$\{creator\.sourceStatus\.state\}/u);
assert.match(settings, /ui\.slurp\.settings\.creators\.acceptChanges/u);
assert.match(settings, /onRedraft/u);
// Slice 12 renamed the borrowed Engine Noodle vocabulary to Slp: getNoodleAccentStyle/NOODLE_PINK
// became getSlpAccentStyle/SLP_PINK, and the shell chrome primitives moved to base/chrome/SlpChrome.
assert.match(
  settings,
  /import \{[\s\S]*?Avatar,[\s\S]*?getSlpAccentStyle,[\s\S]*?SLP_PINK,?[\s\S]*?\} from "[./]*base\/chrome\/SlpChrome"/u,
  "Settings must take its shell primitives from the shell chrome",
);
assert.match(routes, /app\.post\("\/slurp\/accounts\/:id\/banner"/u);
assert.match(routes, /postType: slurpPostTypeSchema\.default\("post"\)/u);
assert.match(routes, /decoded\.data\.postType === "story" && !decoded\.media/u, "Story creation must require media");
assert.match(
  routes,
  /story: post\.metadata\.noodlerPostType === "story"/u,
  "locked projections must expose a safe Story flag",
);
assert.match(home, /story \? "ui\.slurp\.stories\.captionPlaceholder"/u);
assert.match(routes, /app\.post\("\/slurp\/accounts\/:id\/artwork\/generate"/u);
assert.match(home, /useUploadCreatorBanner/u);
// The artwork-generation call site moved out of Home's view model into the creators feature and
// onboarding; the hook itself (still exported from use-slurp.ts) is what every caller needs.
assert.match(read("packages/slurp2/src/engine/packages/client/src/hooks/use-slurp.ts"), /useGenerateCreatorArtwork/u);
assert.match(profileSurface, /<Upload size=\{13\}/u);
assert.match(profileSurface, /<Upload size=\{12\}/u);
assert.match(profileSurface, /ui\.slurp\.artwork\.generateBanner/u);
assert.match(profileSurface, /ui\.slurp\.artwork\.generateAvatar/u);
// Banner action buttons moved down from top-3 to top-14 to clear the frame's back control.
assert.match(profileSurface, /end-\[4\.25rem\] top-14 flex h-11 w-11/u);
assert.doesNotMatch(
  profileSurface,
  /sm:opacity-0 group-hover:opacity-100/u,
  "profile artwork controls must stay visible on touch and keyboard surfaces",
);
assert.match(home, /ui\.slurp\.profile\.follow[\s\S]*?ui\.slurp\.profile\.subscribe/u);
assert.match(home, /management: true/u, "subscriber data must be marked as creator management");
// The one creatorToolsDetail line split into creatorToolsOwn/creatorToolsOthers so the copy can
// say "your page" vs. the Creator's name.
assert.match(home, /ui\.slurp\.profile\.creatorToolsOwn/u);
assert.match(home, /ui\.slurp\.profile\.creatorToolsOthers/u);
assert.match(
  profileSurface,
  /h-52 @min-\[540px\]:h-56 @min-\[760px\]:h-60/u,
  "Creator Rooms must scale the banner from mobile to desktop",
);
// The banner scale tops out at the 760px tier (h-60); no "1040px:28rem" cinematic fourth tier
// exists in the banner's history under packages/slurp2 — the three-tier scale above is the design.
// "step 3" (dc119a549) traded the responsive 3-tier overlap for one fixed -mt-16 the avatar rides
// over the banner at, dropping the compact variant too.
assert.match(
  profileSurface,
  /banner \? "-mt-16" : "pt-5"[\s\S]*?@min-\[680px\]:-mt-16/u,
  "Creator avatars must ride over the banner's pink fade",
);
// Step 3 (dc119a549) replaced the three breakpoint-tuned linear-gradient fades with one fixed pink
// accent fade (an inline style, not a responsive className) that still turns solid at the banner's
// canvas edge.
assert.match(
  profileSurface,
  /linear-gradient\(to top, var\(--slurp-canvas\) 0%/u,
  "the banner fade must still become solid at the canvas edge",
);
// This pinned a second old-design darkening overlay for readable controls; step 3 folded it into
// the one gradient above ("Readable controls on top, and a strong pink fade into the page at the
// bottom" per the source's own comment), already covered by the assertion above.
assert.match(
  profileSurface,
  /@min-\[680px\]:items-start/u,
  "wide Creator identity rows must not lower the avatar with end alignment",
);
assert.doesNotMatch(profileSurface, /@min-\[680px\]:items-end/u);
assert.doesNotMatch(
  profileSurface,
  /hasBanner \? \(spotlight \? "relative z-10 -mt-/u,
  "the avatar wrapper must not apply a second breakpoint-dependent overlap",
);
// The leading actions row moved into its own file and traded the fixed 4-col grid plus
// `[&>:nth-child]` col-span overrides for a `grid-cols-[...]` template that gives the primary
// action (Subscribed, or Message when it names a price) extra room directly.
assert.match(
  read("packages/slurp2/src/engine/packages/client/src/slp/app/screens/SlpProfileLeadingActions.tsx"),
  /renewing \|\| endingChip[\s\S]*?\? "grid-cols-\[minmax\(0,1\.4fr\)_minmax\(0,1fr\)_minmax\(0,1fr\)\]"/u,
  "narrow Creator actions must reserve room for the primary subscription action",
);
assert.doesNotMatch(
  profileSurface,
  /@min-\[860px\]:grid-cols-\[minmax\(0,1fr\)_auto\]/u,
  "profile actions must not move beside the identity content on wide screens",
);
// profileActions/hasProfileActions were renamed leadingActions when the actions row moved into
// its own SlpProfileLeadingActions component.
assert.match(profileSurface, /!editing && leadingActions \? <div className="mt-4 min-w-0">\{leadingActions\}<\/div>/u);
assert.match(profileSurface, /className="@container/u, "Creator Rooms must respond to their actual canvas width");
assert.match(
  shell,
  /size === "xl"[\s\S]*?h-24 w-24[\s\S]*?@min-\[1040px\]:h-36/u,
  "Creator avatars must scale from a compact mobile portrait to the wide-desktop hero",
);
// "step 3" dropped the fixed min-w-[6.25rem] tab width in favor of whitespace-nowrap + flex-none,
// which never shrinks a label below its content, and still distributes with flex-1 past 620px.
assert.match(
  profileSurface,
  /flex-none snap-start[\s\S]*?whitespace-nowrap[\s\S]*?@min-\[620px\]:flex-1/u,
  "profile tabs must scroll without crushing labels on narrow canvases and distribute on desktop",
);
assert.doesNotMatch(
  profileSurface,
  /max-w-\[calc\(100%-13rem\)\]/u,
  "Creator Room copy must not reserve a fixed action width",
);
assert.match(profileSurface, /data-slurp-creator-hero/u, "Creator Rooms must expose their unified identity hero");
// "step 3" (dc119a549) dropped the separate "spotlight" media-led identity variant: there is now
// one hero treatment for every Creator Room, so there is no second rounded-card identity to blend.
assert.match(
  profileSurface,
  /linear-gradient\(to top, var\(--slurp-canvas\)/u,
  "Creator banners must fade into the profile canvas",
);
assert.match(profileSurface, /--slurp-violet/u, "Creator Rooms must inherit Slurp's atmospheric gradient palette");
assert.match(profileSurface, /after:scale-x-100/u, "Creator profile tabs must use the flat accent-underline treatment");
// The pre-tabs rail (preTabsContent/editorActionInPreTabs) is gone: Edit profile is now one of the
// owner's leading-action buttons (New post / Edit profile / Dashboard), not a separate pill rail.
assert.match(
  read("packages/slurp2/src/engine/packages/client/src/slp/app/screens/SlpProfileLeadingActions.tsx"),
  /onEdit[\s\S]*?ui\.slurp\.profile\.editProfile/u,
  "Edit profile must remain reachable from the owner's action row",
);
assert.match(home, /data-slurp-home-masthead/u, "Home must expose one unified lobby masthead");
assert.doesNotMatch(
  home,
  /data-slurp-home-masthead[\s\S]*?personaAccount\.displayName/u,
  "the Home masthead must not repeat the active persona",
);
// The hand-rolled "text-lg font-black" became the shared "slp-display" typography class.
assert.match(shell, /slurpActive && <span className="slp-display text-lg">\{SLURP_NAME\}<\/span>/u);
assert.match(shell, /ui\.slurp\.navigation\.hub/u, "Slurp desktop navigation must name the home destination Hub");
assert.doesNotMatch(
  home,
  /data-slurp-home-masthead[\s\S]*?ui\.slurp\.navigation\.home/u,
  "The desktop masthead must not repeat the Slurp name",
);
assert.match(profileSurface, /<Avatar[\s\S]*?account=\{account\}[\s\S]*?size="xl"/u);
assert.match(home, /function SourceAccountAvatar[\s\S]*?useSlurpMediaSrc\(account\.avatarUrl, \{ width: 96 \}\)/u);
assert.match(home, /function SourceAccountAvatar[\s\S]*?<img src=\{source\}/u);
assert.match(
  home,
  /function SourceAccountAvatar[\s\S]*?ProfileInitial profile=\{\{ \.\.\.account, avatarUrl: null \}\}/u,
);
assert.match(home, /<SourceAccountAvatar account=\{account\} \/>/u);
assert.doesNotMatch(
  home,
  /accounts\.map\(\(account\) => \([\s\S]*?<img src=\{account\.avatarUrl\}/u,
  "source-account rows must authenticate managed avatar URLs before rendering them",
);
assert.match(artwork, /one continuous ultra-wide background scene only/u);
assert.match(artwork, /Do not include a profile picture, avatar, avatar bubble, headshot/u);
// The page paints its own avatar over the banner, so a banner carrying one shows two.
// The negative prompt grew more exhaustive but keeps banning a second portrait on the scene.
assert.match(artwork, /avatar bubble, headshot[\s\S]*?badge, medallion, sticker portrait, framed portrait/u);
assert.match(artwork, /negativePromptAdditions: artworkNegativePrompt\(/u);
assert.match(artwork, /width: kind === "banner" \? 1536 : 1024/u);
assert.match(artwork, /height: kind === "banner" \? 512 : 1024/u);
assert.match(settings, /ui\.slurp\.settings\.refresh\.title/u);
assert.match(settings, /title=\{t\("ui\.slurp\.settings\.refresh\.title"\)\}/u);
assert.match(settings, /open=\{refreshModalOpen\}[\s\S]*?panelStyle=\{getSlpAccentStyle\(SLP_PINK/u);
// Pulse + E made every long action a client task (startSlpTask); the direct mutate() call became
// a run: callback so the modal can close immediately while the refresh keeps going.
assert.match(settings, /run: \(\) => refreshCreators\.mutateAsync\(\{ accountIds, access: refreshAccess \}\)/u);
assert.match(mediaHook, /const mediaCache = new Map<string, CachedMedia>/u, "managed media requests must be shared");
assert.match(mediaHook, /cache: "force-cache"/u, "managed media must use the HTTP cache");
assert.match(
  mediaHook,
  /new IntersectionObserver[\s\S]*?rootMargin/u,
  "off-screen media fetches must wait for proximity",
);
assert.match(home, /useNearViewportSlurpMediaSrc\(post\.imageUrl, \{ width: 480 \}\)/u);
// This skeleton now lives in SlpLockedPostCard, part of the creatorPostCard concatenation.
assert.match(creatorPostCard, /animate-pulse bg-\[var\(--muted\)\] motion-reduce:animate-none/u);
// "V" replaced the fixed aspect-[4/3] + animate-pulse skeleton with SlpPostMediaFrame, which
// reserves the post's own stored ratio and shimmers via the slp-img-frame CSS sweep instead.
assert.match(creatorPostCard, /postImageLoading[\s\S]*?<SlpPostMediaFrame/u);
assert.match(
  read("packages/slurp2/src/engine/packages/client/src/slp/slp-client-entry.tsx"),
  /slp-img-frame-sweep/u,
  "post pictures must keep a loading shimmer while they reserve their own ratio",
);
assert.match(
  read("packages/slurp2/src/engine/packages/client/src/components/slurp/PostImageCropEditor.tsx"),
  /scale-110 object-cover opacity-25 blur-2xl/u,
  "Slurp post media must use a subdued image-derived stage background",
);
// The locked branch no longer renders its own crop-less frame: the server ships pre-blurred bytes
// for locked media, so one frame honouring the real crop covers both states.
// imageCrop was renamed activeCrop when the gallery index picked the crop per image.
assert.match(
  creatorPostCard,
  /<PostImageFrame[\s\S]*?crop=\{activeCrop\}/u,
  "Slurp feed images must use the shared media stage",
);
// Slice 12 renamed NOODLER_MEDIA_WIDTHS to SLP_CREATOR_MEDIA_WIDTHS and added a 160px tier.
assert.match(slurpMedia, /SLP_CREATOR_MEDIA_WIDTHS = \[96, 160, 320, 480, 640, 960, 1280, 1600\]/u);
assert.match(slurpMedia, /\.resize\(\{ width, withoutEnlargement: true \}\)[\s\S]*?\.webp/u);
assert.match(slurpMedia, /entry\.startsWith\(`\$\{fileName\}\.w`\)/u, "media deletion must remove every derivative");
assert.doesNotMatch(home, /refreshAllNow/u, "bulk refresh belongs in Creator settings");
assert.match(
  shell,
  /import \{[\s\S]*?useEffect,[\s\S]*?useState,[\s\S]*?\} from "react"/u,
  "hub scroll hooks must import every React hook they call",
);

console.log("Slurp lifecycle safety regressions passed.");
