import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");
const routes = read("packages/slurp/src/engine/packages/server/src/routes/slurp.routes.ts");
const publicSupport = read("packages/slurp/src/engine/packages/server/src/services/slurp/slurp-public-support.ts");
const replyOperation = read(
  "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-creator-reply.operation.ts",
);
const imageConnections = read(
  "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-image-connections.ts",
);
const home = read("packages/slurp/src/engine/packages/client/src/components/slurp/SlurpHome.tsx");
const storage = read("packages/slurp/src/engine/packages/server/src/services/storage/slurp.storage.ts");
const settings = read("packages/slurp/src/engine/packages/client/src/components/slurp/SlurpSettings.tsx");
const profileSurface = read("packages/slurp/src/engine/packages/client/src/components/slurp/SlurpProfileSurface.tsx");
const creatorPostCard = read("packages/slurp/src/engine/packages/client/src/components/slurp/SlurpCreatorPostCard.tsx");
const mediaHook = read("packages/slurp/src/engine/packages/client/src/hooks/use-slurp-media-src.ts");
const slurpMedia = read("packages/slurp/src/engine/packages/server/src/services/slurp/slurp-media.ts");
const artwork = read("packages/slurp/src/engine/packages/server/src/services/slurp/slurp-artwork.operation.ts");
const shell = read("packages/slurp/src/engine/packages/client/src/components/slurp/SlurpShell.tsx");
const serverEntry = read("packages/slurp/src/engine/packages/server/src/services/slurp/server-entry.ts");
const publicGeneration = read(
  "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-public-generation.service.ts",
);

const multipartReader = routes.slice(
  routes.indexOf("async function readNoodlerMultipart"),
  routes.indexOf("async function importNoodlerMedia"),
);
assert.match(
  multipartReader,
  /if \(!write\.acquired\) \{[\s\S]*?part\.file\.resume\(\);[\s\S]*?throw new NoodlerMediaRequestError\("Slurp data cleanup is in progress\.", 409\)/u,
);
assert.match(multipartReader, /return await part\.toBuffer\(\);/u);
assert.match(multipartReader, /const buffer = write\.value;[\s\S]*?isAllowedImageBuffer\(buffer, extension\)/u);
assert.doesNotMatch(multipartReader, /return reply\./u, "the multipart helper must not return before validating media");
assert.match(
  publicGeneration,
  /settings: generatedMediaSettings\(settings, parsedGenerated\.rejected\.length\)/u,
  "partially rejected timeline output must not reach image generation",
);

const updateRoute = routes.slice(
  routes.indexOf('app.put("/noodler/accounts/:id/stage-profile"'),
  routes.indexOf('app.post("/noodler/accounts/:id/source/dismiss"'),
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
  /settings\.generationConnectionId[\s\S]*?getWithKey\(settings\.generationConnectionId\)[\s\S]*?getDefaultForAgents/u,
  "Creator replies must use the Slurp connection with Engine default fallback",
);
assert.match(imageConnections, /LEGACY_KEY = "noodle\.noodler-image-connections"/u);
assert.match(imageConnections, /storage\.get\(KEY\)[\s\S]*?storage\.get\(LEGACY_KEY\)/u);
assert.doesNotMatch(home, /canQuieten|makeQuieter|quieterPending/u);
assert.match(home, /const viewingOwnCreator = profile\.sourceAccountId === viewerAccount\?\.entityId/u);
assert.match(home, /const managedCreator = true/u);
assert.match(home, /const personaBackedCreator = viewerAccounts\.some/u);
assert.match(home, /const accessViewerAccounts = viewerAccounts\.filter/u);
assert.match(home, /!personaBackedCreator && \([\s\S]*?setAutomationOpen\(true\)/u);
assert.match(storage, /withoutNoodlerSelfHiddenAccountId\([\s\S]*?row\.sourceEntityId \?\? row\.entityId/u);
assert.match(shell, /CSS\.supports\?\.\("-webkit-touch-callout", "none"\)/u);
assert.match(shell, /style=\{\{ paddingBottom: `max\(1rem, \$\{BOTTOM_SAFE_INSET\}\)` \}\}/u);
assert.match(shell, /pb-\[calc\(56px\+var\(--slurp-bottom-safe-inset\)\)\]/u);
assert.match(shell, /style=\{\{ paddingBottom: BOTTOM_SAFE_INSET \}\}/u);
assert.match(home, /<SlurpMobileHeader[\s\S]*?triggerRef=\{mobileDrawerTriggerRef\}/u);
assert.match(home, /ref=\{setStickyHeader\}[\s\S]*?HIDE_ON_SCROLL_CLASS/u);
assert.match(shell, /--slurp-canvas/u, "Slurp must own a theme-safe canvas token");
assert.match(home, /ui\.slurp\.home\.feedDetail/u, "the Home feed must explain its creator-network purpose");
assert.match(home, /ui\.slurp\.home\.tonight/u, "the desktop discovery rail must have a Slurp identity");
assert.match(home, /SLURP_MOMENT_WINDOW_MS = 24 \* 60 \* 60 \* 1000/u);
assert.match(home, /data-component="SlurpHome\.Moments"/u, "Home must expose the real 24-hour Moments shelf");
assert.match(home, /isSlurpStory\(post\)[\s\S]*?momentCutoff/u, "Home must show only fresh Story posts in its shelf");
assert.match(home, /id: "stories"[\s\S]*?ui\.slurp\.stories\.archive/u, "Creator Rooms must retain a Story archive");
assert.match(home, /activeTab === "stories"[\s\S]*?return story/u, "the Story archive must not apply the Home cutoff");
assert.match(
  read("packages/slurp/src/engine/packages/client/src/hooks/use-slurp.ts"),
  /export function useNoodlerPosts[\s\S]*?do \{[\s\S]*?cursor = page\.nextCursor;[\s\S]*?\} while \(cursor\)/u,
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
assert.match(home, /ui\.slurp\.home\.latestDrops/u, "Home must separate lobby content from the post stream");
const viewerHub = home.slice(home.indexOf("function ViewerHub"), home.indexOf("function SlurpDiscoverCreatorCard"));
assert.doesNotMatch(viewerHub, /<NoodlerPostComposer/u, "the viewer-first Home lobby must not contain publishing");
assert.match(
  home,
  /data-slurp-creator-tools[\s\S]*?<NoodlerPostComposer/u,
  "managed Creator Rooms must retain publishing",
);
assert.match(home, /ui\.slurp\.discover\.title/u);
assert.match(home, /sm:grid-cols-2/u, "Discover must present creators as adaptive cards");
assert.match(
  home,
  /function SlurpDiscoverCreatorCard[\s\S]*?useNearViewportSlurpMediaSrc\(creator\.profile\.bannerUrl/u,
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
assert.match(lockedCard, /scale-105 saturate-\[0\.82\]/u);
assert.doesNotMatch(
  lockedCard,
  /(?:^|\s)blur-sm/u,
  "server-blurred locked previews must not be blurred again in the client",
);
assert.match(creatorPostCard, /surface === "profile"[\s\S]*?rounded-xl border/u);
assert.match(creatorPostCard, /motion-reduce:active:scale-100/u);
assert.match(home, /function DisclosureBadge[\s\S]*?HelpTooltip/u);
assert.match(home, /confirmProviderDisclosure/u);
assert.doesNotMatch(home, /findLastIndex/u, "Slurp hub must support the Engine ES2020 target");
assert.match(home, /function profileAccent\(_profileId: string\): string \{\s*return NOODLE_PINK;/u);
assert.doesNotMatch(home, /#7ED6A5/u, "Creator profiles must not override Slurp with a green accent");
assert.ok(
  home.indexOf("const [draftNoodleAccountId, setDraftNoodleAccountId]") < home.indexOf("useNoodlerEligibleAccounts("),
  "profile source state must be declared before first-render query evaluation",
);
assert.match(
  storage,
  /cleanupRetiredViewer[\s\S]*?noodleAccountSubscriptions[\s\S]*?noodlePostUnlocks[\s\S]*?slurpViewerSettingsKey/u,
);
assert.match(settings, /ui\.slurp\.settings\.creators\.sourceChanged/u);
assert.match(
  settings,
  /md:grid-cols-\[12rem_minmax\(0,1fr\)\][\s\S]*?lg:grid-cols-\[13rem_minmax\(0,1fr\)\]/u,
  "settings must keep a responsive desktop section rail",
);
assert.match(settings, /<select[\s\S]*?settingsSections\.map/u, "narrow settings must expose one section selector");
assert.match(settings, /aria-live="polite"/u, "settings saves must announce their state");
assert.match(settings, /selectedCreatorId/u, "creator settings must keep an explicit master-detail selection");
assert.match(settings, /data-slurp-settings-layout/u, "settings must expose its responsive layout boundary");
assert.match(
  shell,
  /slurpSettingsActive[\s\S]*?@min-\[1024px\]:max-w-\[1096px\]/u,
  "settings must not inherit the narrow creator-feed measure",
);
assert.match(shell, /\{!slurpSettingsActive && rightRail\}/u, "settings must not reserve an empty discovery rail");
assert.match(settings, /data-slurp-setting-toggle/u);
assert.match(settings, /role="switch"/u, "polished settings toggles must retain native checkbox semantics");
assert.match(settings, /snap-x grid-flow-col/u, "creator settings must stay browsable before master-detail fits");
assert.match(settings, /xl:sticky xl:top-4/u, "the wide-screen Creator list must remain visible beside its detail");
assert.match(settings, /ui\.slurp\.settings\.creators\.personaAutomationDetail/u);
assert.match(settings, /ui\.slurp\.settings\.creators\.moreActions/u);
const profileList = storage.slice(
  storage.indexOf("async listNoodlerStageProfiles"),
  storage.indexOf("async migrateLegacyNoodlerSourceSnapshots"),
);
assert.ok(profileList.length > 0, "listNoodlerStageProfiles must precede migrateLegacyNoodlerSourceSnapshots");
assert.doesNotMatch(profileList, /updateNoodlerSourceSnapshot|patchAccountSettings/u);
assert.match(storage, /async migrateLegacyNoodlerSourceSnapshots/u);
assert.match(storage, /minimizeNoodlerSourceSnapshot\(baseline, disclosureMode\)/u);
assert.match(storage, /NOODLER_SOURCE_SNAPSHOT_MIGRATION_KEY/u);
assert.match(storage, /settingsStore\.set\(NOODLER_SOURCE_SNAPSHOT_MIGRATION_KEY, "1"\)/u);
assert.match(serverEntry, /await createSlurpStorage\(app\.db\)\.migrateLegacyNoodlerSourceSnapshots\(\)/u);
const dismissRoute = routes.slice(
  routes.indexOf('app.post("/noodler/accounts/:id/source/dismiss"'),
  routes.indexOf('app.post("/noodler/accounts/:id/source/adopt-identity"'),
);
assert.match(dismissRoute, /updateNoodlerSourceSnapshot/u);
assert.match(dismissRoute, /listNoodlerStageProfiles/u);
assert.match(settings, /sourceStatus\.\$\{creator\.sourceStatus\.state\}/u);
assert.match(settings, /ui\.slurp\.settings\.creators\.acceptChanges/u);
assert.match(settings, /onRedraftCreator/u);
assert.match(settings, /import \{ Avatar, getNoodleAccentStyle, NOODLE_PINK \} from "\.\/SlurpShell"/u);
assert.match(routes, /app\.post\("\/noodler\/accounts\/:id\/banner"/u);
assert.match(routes, /postType: slurpPostTypeSchema\.default\("post"\)/u);
assert.match(routes, /decoded\.data\.postType === "story" && !decoded\.media/u, "Story creation must require media");
assert.match(
  routes,
  /story: post\.metadata\.noodlerPostType === "story"/u,
  "locked projections must expose a safe Story flag",
);
assert.match(home, /postType === "story" \? "ui\.slurp\.stories\.captionPlaceholder"/u);
assert.match(routes, /app\.post\("\/noodler\/accounts\/:id\/artwork\/generate"/u);
assert.match(home, /useUploadNoodlerBanner/u);
assert.match(home, /useGenerateNoodlerArtwork/u);
assert.match(profileSurface, /<Upload size=\{13\}/u);
assert.match(profileSurface, /<Upload size=\{12\}/u);
assert.match(profileSurface, /ui\.slurp\.artwork\.generateBanner/u);
assert.match(profileSurface, /ui\.slurp\.artwork\.generateAvatar/u);
assert.match(profileSurface, /bottom-2 right-14 flex h-11 w-11/u);
assert.doesNotMatch(
  profileSurface,
  /sm:opacity-0 group-hover:opacity-100/u,
  "profile artwork controls must stay visible on touch and keyboard surfaces",
);
assert.match(home, /ui\.slurp\.profile\.follow[\s\S]*?ui\.slurp\.profile\.subscribe/u);
assert.match(home, /management: true/u, "subscriber data must be marked as creator management");
assert.match(home, /ui\.slurp\.profile\.creatorToolsDetail/u);
assert.match(home, /ui\.slurp\.profile\.creatorRoom/u);
assert.match(profileSurface, /sm:h-72/u, "Creator Rooms must keep an immersive desktop banner");
assert.match(
  profileSurface,
  /sm:grid-cols-\[minmax\(0,1fr\)_auto\]/u,
  "Creator Room identity and actions must use a responsive non-overlapping grid",
);
assert.doesNotMatch(
  profileSurface,
  /max-w-\[calc\(100%-13rem\)\]/u,
  "Creator Room copy must not reserve a fixed action width",
);
assert.match(profileSurface, /data-slurp-creator-hero/u, "Creator Rooms must expose their unified identity hero");
assert.match(profileSurface, /preTabsContent && \(/u, "Creator Tools must remain separate from public profile content");
assert.match(home, /data-slurp-home-masthead/u, "Home must expose one unified lobby masthead");
assert.match(shell, /slurpActive && <span className="text-lg font-black">\{SLURP_NAME\}<\/span>/u);
assert.match(shell, /ui\.slurp\.navigation\.hub/u, "Slurp desktop navigation must name the home destination Hub");
assert.doesNotMatch(
  home,
  /data-slurp-home-masthead[\s\S]*?ui\.slurp\.navigation\.home/u,
  "The desktop masthead must not repeat the Slurp name",
);
assert.match(profileSurface, /<Avatar account=\{account\} size="xl"/u);
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
assert.match(artwork, /Do not include a profile picture, avatar, headshot/u);
assert.match(artwork, /width: kind === "banner" \? 1536 : 1024/u);
assert.match(artwork, /height: kind === "banner" \? 512 : 1024/u);
assert.match(settings, /ui\.slurp\.settings\.refresh\.title/u);
assert.match(settings, /title=\{t\("ui\.slurp\.settings\.refresh\.title"\)\}/u);
assert.match(settings, /open=\{refreshModalOpen\}[\s\S]*?panelStyle=\{getNoodleAccentStyle\(NOODLE_PINK/u);
assert.match(
  settings,
  /refreshCreators\.mutate\(\s*\{ accountIds: \[\.\.\.refreshAccountIds\], access: refreshAccess \}/u,
);
assert.match(mediaHook, /const mediaCache = new Map<string, CachedMedia>/u, "managed media requests must be shared");
assert.match(mediaHook, /cache: "force-cache"/u, "managed media must use the HTTP cache");
assert.match(
  mediaHook,
  /new IntersectionObserver[\s\S]*?rootMargin/u,
  "off-screen media fetches must wait for proximity",
);
assert.match(home, /useNearViewportSlurpMediaSrc\(post\.imageUrl, \{ width: 480 \}\)/u);
assert.match(home, /animate-pulse bg-\[var\(--muted\)\] motion-reduce:animate-none/u);
assert.match(creatorPostCard, /postImageLoading[\s\S]*?aspect-\[4\/3\][\s\S]*?animate-pulse/u);
assert.match(
  read("packages/slurp/src/engine/packages/client/src/components/slurp/PostImageCropEditor.tsx"),
  /scale-110 object-cover opacity-25 blur-2xl/u,
  "Slurp post media must use a subdued image-derived stage background",
);
assert.match(
  creatorPostCard,
  /<PostImageFrame[\s\S]*?crop=\{null\}/u,
  "Slurp feed images must use the shared media stage",
);
assert.match(slurpMedia, /NOODLER_MEDIA_WIDTHS = \[96, 320, 480, 640, 960, 1280, 1600\]/u);
assert.match(slurpMedia, /\.resize\(\{ width, withoutEnlargement: true \}\)[\s\S]*?\.webp/u);
assert.match(slurpMedia, /entry\.startsWith\(`\$\{fileName\}\.w`\)/u, "media deletion must remove every derivative");
assert.doesNotMatch(home, /refreshAllNow/u, "bulk refresh belongs in Creator settings");
assert.match(
  shell,
  /import \{[\s\S]*?useEffect,[\s\S]*?useState,[\s\S]*?\} from "react"/u,
  "hub scroll hooks must import every React hook they call",
);

console.log("Slurp lifecycle safety regressions passed.");
