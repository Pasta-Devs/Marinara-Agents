import assert from "node:assert/strict";
import { join } from "node:path";
import { slurp2BackstageSource } from "./slurp2-backstage-source";
import { readFileSync } from "node:fs";
import { SLURP2_SOURCE_MODULES, slurp2Source } from "./slurp2-source";

const root = join(import.meta.dirname, "..");
const server = join(root, "packages/slurp2/src/engine/packages/server/src");
const client = join(root, "packages/slurp2/src/engine/packages/client/src");
const read = (path: string) => slurp2Source(path);

// ── Money ────────────────────────────────────────────────

const messagesStorage = read(join(server, "services/storage/slurp-messages.storage.ts"));

// A tip and a commission quote are both stored with a price and no `unlockedAt`, so an unlock that
// only checks `price > 0` charged for them a second time.
assert.match(
  messagesStorage,
  /async unlockMessageUnlocked[\s\S]{0,600}?if \(String\(row\.kind\) !== "ppv"\) return null;/u,
  "only a PPV message may be unlocked",
);

// Check-then-spend has to be one span. `enqueueFinancial` serializes each wallet write, not the
// decision that precedes it, so two concurrent accepts both read `quoted` and both paid.
assert.match(messagesStorage, /const commissionOperations = new Map</u);
assert.match(
  messagesStorage,
  /async acceptCommission\(id: string\)[\s\S]{0,300}?queueCommissionOperation\(id/u,
  "commission operations must be serialized per commission",
);
// A failure after the debit must give the coins back, like the PPV path does.
const acceptStart = messagesStorage.indexOf("async acceptCommissionUnlocked(id: string)");
const acceptEnd = messagesStorage.indexOf("\n    async ", acceptStart + 1);
const acceptCommissionUnlocked = messagesStorage.slice(acceptStart, acceptEnd === -1 ? undefined : acceptEnd);
assert.ok(acceptCommissionUnlocked, "acceptCommissionUnlocked must exist");
assert.match(
  acceptCommissionUnlocked,
  /await compensateSlurpPayment\(/u,
  "a failed commission accept must be compensated",
);
assert.match(
  messagesStorage,
  /if \(!current\.refundedAt\)[\s\S]{0,500}?refundCoins\([\s\S]{0,500}?current = \([\s\S]{0,2000}?if \(reversal > 0 && !current\?\.reversedAt\)[\s\S]{0,300}?reverseCreatorIncome/u,
  "compensation must persist the refund before it attempts creator-income reversal",
);
// Compensation reverses the amount that was actually credited, never a share recomputed from the
// current setting, which can have changed since the payment. It now re-reads the live ledger
// receipt first (self-healing if the persisted creditedAmount snapshot is missing), falling back
// to the snapshot — never to a settings-based recalculation.
assert.match(
  messagesStorage,
  /reversal =\s*\n\s*\(await slurp\.getCreatorIncomeOperationAmount\(payment\.creatorAccountId, payment\.creditOperationId\)\) \?\?\s*\n\s*Number\(current\.creditedAmount\)/u,
);
assert.doesNotMatch(messagesStorage, /slurpCreatorRevenueShare\(payment\.price/u);
assert.match(messagesStorage, /db\.transaction\(async \(tx\) => \{[\s\S]{0,500}?current\.state !== "accepted"/u);
assert.match(messagesStorage, /const paymentId = `commission:\$\{id\}:accept`/u);
assert.match(
  messagesStorage,
  /paymentId[\s\S]{0,900}?spendCoins\([\s\S]{0,260}?paymentId/u,
  "commission acceptance must pass its stable payment ID to spendCoins",
);
assert.doesNotMatch(
  messagesStorage,
  /acceptCommissionUnlocked[\s\S]{0,1200}?spendCoins\([\s\S]{0,220}?commission\.creatorAccountId,\s*\n\s*\)\)/u,
  "commission acceptance must not directly call unkeyed spendCoins",
);
// Re-quoting an accepted commission used to reset it to `quoted` and make it payable again.
assert.match(
  messagesStorage,
  /async quoteCommission[\s\S]{0,400}?existing\.state !== "brief" && existing\.state !== "quoted"/u,
);

// Missing-table fallbacks must return the declared shape. `[]` and `null` crashed the callers they
// were meant to protect.
// rapportFactsFor grew from a one-line arrow into a full function (whale-history, handle-prefix
// collision and double-counted-tip fixes), but still starts from the shared empty facts value.
assert.match(
  messagesStorage,
  /async rapportFactsFor\(viewerAccountId: string, creatorAccountId: string\): Promise<SlurpRapportFacts> \{\s*\n\s*const facts = emptySlurpRapportFacts\(\);/u,
);
assert.match(messagesStorage, /claimReply: \(\) => \(\{ status: "busy" as const \}\)/u);

const routes = read(join(server, "routes/slurp.routes.ts"));

// ── Schedulers ───────────────────────────────────────────

const messageScheduler = read(join(server, "services/slurp/slurp-message-scheduler.service.ts"));
// `replyToSlurpMessage` reports a provider failure instead of rejecting, so discarding its result
// left `consecutiveFailures` at zero and the backoff never engaged.
assert.match(messageScheduler, /const outcome = await replyToSlurpMessage\(/u);
assert.match(messageScheduler, /if \(outcome\.status === "failed"\) \{\s*failed = true;/u);
assert.match(messageScheduler, /if \(failed\) throw new Error\(/u);

// ── Client state ─────────────────────────────────────────

const entry = read(join(client, "slurp-package-entry.tsx"));
// The host re-dispatches `marinara-capability-props` when props change; redrawing alone left the
// store on its mount-time values.
assert.match(
  entry,
  /const update = \(\) => \{\s*configureSlurpPackageState\(element\.capabilityProps \?\? \{\}\);/u,
  "changed capability props must be pushed into the store",
);

const useSlurp = read(join(client, "hooks/use-slurp.ts"));
// Ad queries are keyed by creator and context tags too, so the bare key never matched a real one.
assert.match(useSlurp, /useResetSlurpAds[\s\S]{0,600}?predicate: \(query\) => query\.queryKey\.includes\("ads"\)/u);
// The unseen baseline belongs to one persona.
assert.match(useSlurp, /if \(previousPersonaId\.current !== personaId\) \{\s*previousPersonaId\.current = personaId;/u);
// Ownership is enforced server-side, so the caller has to send the persona.
assert.match(useSlurp, /subscription-price`, \{\s*personaId: input\.personaId,/u);

const mediaSrc = read(join(client, "hooks/use-slurp-media-src.ts"));
// React calls a ref callback with `null` on detach; returning early there leaked one observer per
// card that unmounted before it scrolled into view.
assert.match(mediaSrc, /observerRef\.current\?\.disconnect\(\);\s*observerRef\.current = null;\s*if \(!node/u);
// A fetch still in flight when the release timer fires used to leak its object URL.
assert.match(mediaSrc, /mediaCache\.delete\(imageUrl\);[\s\S]{0,200}?cached\.promise\.then\(\(objectUrl\) => \{/u);
assert.match(mediaSrc, /if \(!response\.ok\) \{\s*mediaCache\.delete\(imageUrl\);/u);

// Slurp's requests go through the Engine's API client (sources/host-client-overlay), so its error handling is the
// Engine's (#1487).

// ── Controls ─────────────────────────────────────────────

const onboarding = read(join(client, "components/slurp/SlurpOnboardingPanel.tsx"));
assert.match(
  onboarding,
  // The hand-rolled <button> became the shared SlpButton component.
  /completion === "settingsFailed" && \(\s*<SlpButton\s*className="mt-5"\s*disabled=\{pending\}/u,
  "the settings retry button needs the same in-flight guard as its siblings",
);

const messagesView = read(join(client, "components/slurp/SlurpMessages.tsx"));
// A failed unlock used to re-enable the button and say nothing at all.
assert.match(messagesView, /\{unlock\.isError && \(/u);

const settings = slurp2BackstageSource();
// Slice 12 moved this operation route from /noodler/* to /slurp/*.
assert.match(settings, /\.download\("\/slurp2\/slurp\/ads\/export"[\s\S]{0,120}?\.catch\(/u);

const shell = read(join(client, "components/slurp/SlurpShell.tsx"));
// The active persona was signalled by background colour alone.
assert.match(shell, /aria-current=\{selected \? "true" : undefined\}/u);

const profileSurface = read(join(client, "components/slurp/SlurpProfileSurface.tsx"));
// The upload button itself now only renders when avatarUpload.canEdit (step 3's hero redesign),
// so the aria-label on it no longer needs its own canEdit ternary.
assert.match(
  profileSurface,
  /avatarUpload\?\.canEdit \? \([\s\S]{0,600}?aria-label=\{localizeUi\("editor\.avatar\.upload"\)\}/u,
);

// ── Stories ──────────────────────────────────────────────

const generation = read(join(server, "services/slurp/slurp-generation.service.ts"));
// Automatic posting only ever produced feed posts, so the Story shelf could only be filled by
// hand. The condition grew a storyImagesEnabled gate, an explicit allowStory opt-out and a Stir
// nudge path, but still requires imagesEnabled either way.
assert.match(
  generation,
  /const storyVariation =\s*\n\s*\(\(input\.allowStory !== false && variation\?\.story === true && settings\.storyImagesEnabled\) \|\|\s*\n\s*input\.request\.postType === "story" \|\|\s*\n\s*nudge\?\.story === true\) &&\s*\n\s*imagesEnabled;/u,
);
// A Story is a picture with a line under it, so only the path that commits an image may mark one.
// This split across two functions (slp-post-media-operation.ts, part of this mapping): the caller
// builds the story-conditional metadata, and persistSlurpGeneratedImageSet commits the image URL
// together with that same metadata in one persist call — renamed noodlerPostMediaUrl ->
// slpCreatorPostMediaUrl (Slice 12).
assert.match(
  generation,
  /primary: \{ \.\.\.image, metadata: \{ \.\.\.image\.metadata, \.\.\.\(input\.story \? \{ noodlerPostType: "story" \} : \{\}\) \} \}/u,
);
assert.match(generation, /imageUrl: slpCreatorPostMediaUrl\(input\.postId\),\s*metadata: input\.primary\.metadata,/u);
// The scheduled path returns at prepareOnly, before the committed-image branch, so it carries the
// story intent in the prepared payload instead — otherwise every scheduled Story silently published
// as an ordinary post. publishDueNoodlerPreparedPosts drops the flag again when no image attached,
// which is what keeps "a Story is a picture with a line under it" true.
const storyMarks = [...generation.matchAll(/noodlerPostType: "story"/gu)];
assert.equal(storyMarks.length, 2, "the committed-image path and the prepared payload both mark a Story");
// The prepared-post builder (slp-prepared-post.ts) takes `story` as a plain input field, which the
// generation service passes storyVariation into at every call site.
assert.match(
  generation,
  /metadata: \{\s*\n\s*\.\.\.input\.metadata,\s*\n\s*\.\.\.\(stagedMedia \? \{ noodlerMediaPath: stagedMedia\.filePath \} : \{\}\),\s*\n\s*\.\.\.\(input\.story \? \{ noodlerPostType: "story" \} : \{\}\),/u,
  "the prepareOnly return must carry the story flag",
);
const storage = read("packages/slurp2/src/engine/packages/server/src/services/storage/slurp.storage.ts");
assert.match(
  storage,
  /if \(!hasMedia\) delete preparedMetadata\.noodlerPostType;/u,
  "publishing a prepared post without an image must drop the story flag",
);
// The Story size is chosen in the shared image run from this flag (R1-052), so every path uses it.
assert.match(generation, /negativePromptAdditions: negativePrompt,\s*story: storyVariation,/u);

const cropEditor = read(join(client, "components/slurp/PostImageCropEditor.tsx"));
// An uploaded Story is cropped to the same ratio an automatic one is drawn at, whatever the player
// configured — a named aspect would drift from the setting the moment it is changed.
assert.match(cropEditor, /lockedRatio\?: number;/u);
assert.match(cropEditor, /lockedRatio && Number\.isFinite\(lockedRatio\) && lockedRatio > 0\s*\? lockedRatio/u);
const home = read(join(client, "components/slurp/SlurpHome.tsx"));
assert.match(home, /lockedRatio=\{story \? storyAspectRatio : undefined\}/u);
assert.match(home, /composerSettings\.storyImageWidth \/ composerSettings\.storyImageHeight/u);

// ── Profile editor ───────────────────────────────────────

// Opening the wizard is not a change. Only a real edit, typed guidance, or pending generation may
// prompt "Discard profile changes?".
assert.match(
  home,
  /const hasNewDraft = Boolean\(profileDraftDirty \|\| draftGuidance\.trim\(\) \|\| generateProfileDraft\.isPending\);/u,
);

// ── Duplicate import bindings ────────────────────────────

// `earn` was imported from both slurp-wallet and slurp-earnings under one name. The last import
// won at runtime, so every ad and engagement reward called the creator-earnings function with
// wallet arguments and silently paid nothing. Nothing caught it: the package typecheck only looks
// for undefined names. Scan for the whole class rather than the one instance.
{
  const sources = [
    join(server, "services/storage/slurp.storage.ts"),
    join(server, "services/storage/slurp-messages.storage.ts"),
    join(server, "routes/slurp.routes.ts"),
    join(server, "routes/slurp-messages.routes.ts"),
    join(server, "services/slurp/slurp-generation.service.ts"),
  ];
  // Each module keeps its own import scope, so a logical source is scanned file by file.
  const engineRoot = join(root, "packages/slurp2/src/engine");
  for (const path of sources) {
    const key = path.slice(engineRoot.length + 1);
    for (const file of SLURP2_SOURCE_MODULES[key] ?? [key]) {
      const text = readFileSync(join(engineRoot, file), "utf8");
      const bound = new Map<string, number>();
      for (const match of text.matchAll(/^import\s*\{([^}]*)\}\s*from\s*"[^"]+";/gmu)) {
        for (const clause of match[1]!.split(",")) {
          const name = clause.trim().replace(/^type\s+/u, "");
          if (!name) continue;
          const local = name.includes(" as ") ? name.split(" as ")[1]!.trim() : name;
          bound.set(local, (bound.get(local) ?? 0) + 1);
        }
      }
      const duplicates = [...bound].filter(([, count]) => count > 1).map(([name]) => name);
      assert.deepEqual(duplicates, [], `${file} binds the same import name twice: ${duplicates.join(", ")}`);
    }
  }
}

// ── Prices ───────────────────────────────────────────────

const postOperation = read(join(server, "services/slurp/slurp-post.operation.ts"));
// Settings → Wallet → "Unlock a post" is documented as the default a locked post is stamped with.
// Both creation paths called the helper with no argument, so every locked post cost the shipped 1.
// The posts own price wins, then the Creators, then the Settings default.
assert.match(
  postOperation,
  /input\.unlockPrice \?\?[\s\S]{0,160}?\.unlockPrice \?\?\s*\(await noodle\.getSettings\(\)\)\.walletUnlockCost;/u,
);
// Renamed noodlerUnlockPriceMetadata -> slpCreatorUnlockPriceMetadata (Slice 12); the generation
// path also gained a Creator-messaging fallback tier before the global setting.
assert.doesNotMatch(
  postOperation,
  /slpCreatorUnlockPriceMetadata\(\)/u,
  "a locked post must be stamped with the setting",
);
assert.doesNotMatch(generation, /slpCreatorUnlockPriceMetadata\(\)/u);
assert.match(
  generation,
  /slpCreatorUnlockPriceMetadata\([\s\S]{0,260}?\.unlockPrice \?\?\s*settings\.walletUnlockCost/u,
);

// ── Subscribe ────────────────────────────────────────────

const slurpStorage = read(join(server, "services/storage/slurp.storage.ts"));
// `now()` returns an ISO string; every use in `subscribe` wants a Date, so the first subscribe for
// a viewer threw "toISOString is not a function" and returned a 500.
// The Creator's own subscription price is now read into `basePrice` between `at` and
// `existingWallet` (platform-event pricing), so the two declarations are no longer adjacent.
assert.match(slurpStorage, /const at = new Date\(\);[\s\S]*?const existingWallet = settings\.walletEnabled/u);
// The persona switcher read the Engine's own wallet field, which defaults to 999_999.
assert.match(slurpStorage, /listViewerWallets[\s\S]{0,700}?coins: \(await getWalletNow\(personaId\)\)\.coins/u);

// ── Viewer actors are not Creators ───────────────────────

// A persona's own Slurp identity is provisioned the first time it likes or replies. It was then
// listed in Creator profiles as "Setup Needed" and shown in every other viewer's Discover.
assert.match(slurpStorage, /export function isSlurpViewerActorAccount\(/u);
// listNoodlerStageProfiles grew a 15s cache (0.3.6) in front of the real builder, which also
// gained a fan-account exclusion (0.3.0 report B) alongside the original viewer-actor filter.
assert.match(
  slurpStorage,
  /buildNoodlerStageProfiles[\s\S]{0,300}?\.filter\(\s*\(account\) => !isSlurpViewerActorAccount\(account\) && !isSlurpCharacterFanAccount\(account\),/u,
);
// A third account-list surface (Studio, in addition to Discover/feed-viewer and the viewer
// context) has grown its own viewer-actor filter since; not all of them chain a second condition
// with "&&", so count the filter call itself rather than that one syntactic shape.
const viewerActorFilters = [...routes.matchAll(/!isSlurpViewerActorAccount\(account\)/gu)];
assert.equal(viewerActorFilters.length, 3, "every visible-account filter must exclude viewer actors");

// ── Repeated likes ───────────────────────────────────────

// The file store asserts uniqueness when the transaction settles, not at the insert, so the
// existing catch never saw a duplicate like and a repeated tap returned a 500.
assert.match(
  slurpStorage,
  /A toggle is idempotent by definition[\s\S]{0,900}?if \(already\) return mapInteraction\(already\);/u,
);

// ── Story settings ───────────────────────────────────────

// The Story rate and size are the player's, not constants baked into the rotation.
assert.match(slurpStorage, /storyRate: z\.enum\(SLURP_STORY_RATE\)/u);
assert.match(slurpStorage, /storyImageWidth: z\.number\(\)\.int\(\)\.min\(64\)\.max\(4096\)/u);
assert.match(slurpStorage, /storyImageHeight: z\.number\(\)\.int\(\)\.min\(64\)\.max\(4096\)/u);
assert.match(slurpStorage, /storyRate: SLURP_DEFAULT_STORY_RATE/u);
// The shipped default stays 4:5, so an install that never opens Settings is unchanged.
assert.match(slurpStorage, /storyImageWidth: 1024,\s*storyImageHeight: 1280,/u);

// Separate width/height raw fields became one shape-picker control, like the main post shape
// above it ("varied pretty controls, few raw inputs"); the reachable keys are storyShape and its
// detail line, anchored by the storyImageWidth/storyImageHeight settingKeys.
const settingsUi = slurp2BackstageSource();
for (const key of [
  "ui.slurp.settings.storyRate",
  "ui.slurp.settings.images.storyShape",
  "ui.slurp.settings.images.storyWidthDetail",
]) {
  assert.ok(settingsUi.includes(key), `${key} must be reachable in Settings`);
}
for (const settingKey of ["storyImageWidth", "storyImageHeight"]) {
  assert.ok(settingsUi.includes(`settingKey="${settingKey}"`), `${settingKey} must be reachable via search/deep link`);
}
const englishUi = JSON.parse(read(join(client, "localization/locales/en.json"))) as Record<string, string>;
for (const key of [
  "ui.slurp.settings.storyRate",
  "ui.slurp.settings.storyRateDetail",
  "ui.slurp.settings.storyRateOff",
  "ui.slurp.settings.storyRateRare",
  "ui.slurp.settings.storyRateRegular",
  "ui.slurp.settings.storyRateOften",
  "ui.slurp.settings.images.storyWidth",
  "ui.slurp.settings.images.storyWidthDetail",
  "ui.slurp.settings.images.storyHeight",
  "ui.slurp.settings.images.storyHeightDetail",
]) {
  assert.equal(typeof englishUi[key], "string", `${key} needs an English string`);
}

// ── Message requests ─────────────────────────────────────

const messageRoutes = read(join(server, "routes/slurp-messages.routes.ts"));
// `resolveRequest` silently no-ops on a thread that is not awaiting a decision, and the route then
// ran the accept branch and reported success anyway.
assert.match(
  messageRoutes,
  /if \(thread\.state !== "request"\) \{\s*return reply\.code\(409\)/u,
  "answering an already-answered request must not report success",
);

// ── Creator promotions removed ───────────────────────────

// A post the model knew nothing about was stamped "Paid partnership with Velvet Skin", the creator
// was never paid for it, and one hardcoded sponsor matched on a substring of the handle and bio.
// Removed rather than left lying until it is a real feature.
for (const path of [
  join(server, "services/slurp/slurp-generation.service.ts"),
  join(server, "services/slurp/slurp-post.operation.ts"),
  join(client, "components/slurp/SlurpCreatorPostCard.tsx"),
]) {
  const text = read(path);
  assert.doesNotMatch(text, /slurpSponsoredPromotion/u, `${path} still stamps a paid partnership`);
  assert.doesNotMatch(text, /creatorAdForProfile/u);
}
assert.doesNotMatch(read(join(server, "services/garnish-ads/garnish-ads.service.ts")), /creatorAdForProfile/u);
assert.doesNotMatch(read(join(server, "services/garnish-ads/garnish-ads.base.ts")), /kind: "creator"/u);

// ── Commissions can be called off ────────────────────────

// `declined` and its four localized labels shipped, but no route or button could reach it, so an
// unwanted brief sat in the thread forever.
assert.match(messagesStorage, /async declineCommission\(id: string, by: "creator" \| "viewer"\)/u);
// Briefs and quotes can end directly. Accepted commissions use the compensation path.
assert.match(
  messagesStorage,
  /async declineCommissionUnlocked[\s\S]{0,700}?commission\.state === "accepted"[\s\S]{0,500}?by === "viewer"/u,
);
assert.match(messageRoutes, /commissions\/:commissionId\/decline/u);
assert.match(messageRoutes, /if \(!isCreator && !isViewer\) return reply\.code\(403\)/u);
const messagesView2 = read(join(client, "components/slurp/SlurpMessages.tsx"));
const useSlurpSource = read(join(client, "hooks/use-slurp.ts"));
assert.match(messagesView2, /ui\.slurp\.messages\.commissionWithdraw/u);
assert.match(messagesView2, /ui\.slurp\.messages\.commissionDecline"/u);

// ── Paid messages can carry a picture ────────────────────

// The column, the mapper and the append signature all existed; nothing ever set or rendered it, so
// unlocking a PPV always revealed text and a commission could not deliver the artwork.
// Attachments are server-owned references. A caller must not select an arbitrary protected API path.
assert.match(messageRoutes, /imageUrl: z\.null\(\)\.optional\(\)/gu);
assert.doesNotMatch(messagesView2, /slurp-ppv-image|slurp-deliver-image|imageUrl:/u);
assert.doesNotMatch(useSlurpSource, /useSendSlurpCreatorPpv[\s\S]*imageUrl\?: string \| null/u);
assert.doesNotMatch(useSlurpSource, /useDeliverSlurpCommission[\s\S]*imageUrl\?: string \| null/u);
// The paywall has to cover the picture, or the thing being sold travels over the wire unpaid.
// maskForViewer (shared by visibleMessages and both paginated routes) also strips the image
// prompt/description from metadata now, so content/imageUrl is no longer the whole masked shape.
assert.match(
  messageRoutes,
  /message\?\.kind === "ppv" && !message\.unlockedAt\s*\?\s*\{\s*\.\.\.message,\s*content: "",\s*imageUrl: null,\s*metadata: \{\s*\.\.\.message\.metadata,\s*imagePrompt: undefined,\s*imageDescription: undefined,/u,
);
assert.match(messagesStorage, /kind: "commission_delivery",\s*imageUrl,/u);
assert.match(messagesView2, /const messageImage = useSlurpMediaSrc\(\s*message\.imageUrl\s*\?/u);
assert.match(messagesView2, /message\.metadata\.commissionId !== "string"/u);
assert.match(messagesView2, /deliveryMessage: commission\.deliveryMessageId/u);
assert.match(messagesView2, /const deliveryImage = useSlurpMediaSrc\(/u);
assert.match(messagesView2, /commission\.state === "delivered" && deliveryMessage/u);
assert.match(messagesView2, /const commissionTimeline = useMemo\(\s*\(\) =>\s*commissions\.map/u);
assert.match(messagesView2, /const at = latestMessage[\s\S]{0,180}?commission\.updatedAt/u);
assert.match(messagesView2, /const timeline = useMemo\(/u);
assert.match(messagesView2, /commissionTimelineKey/u);
// Gained a hiddenReplyIds dependency since.
assert.match(messagesView2, /\[commissionTimelineKey, messages\.length, typing, pending, hiddenReplyIds\]/u);
assert.doesNotMatch(messagesView2, /commissions\.map\(\(commission\) => \(\s*<CommissionRow/u);
assert.match(messagesView2, /commissionAcceptPending/u);
assert.match(messagesView2, /getApiErrorMessage\(raw, fallback\)/u);
assert.match(useSlurpSource, /metadata: Record<string, unknown>;/u);
assert.match(useSlurpSource, /generateImage\?: boolean/u);
assert.match(messagesView2, /ui\.slurp\.messages\.generateCommissionImage/u);
assert.match(messagesView2, /generateImage,/u);

const slurpRoutesSource = read(join(server, "routes/slurp.routes.ts"));
assert.match(
  slurpRoutesSource,
  /isSlurpFileUniqueConstraintError\(error, "slurp2_interactions", \[[\s\S]*?"postId"[\s\S]*?"actorAccountId"[\s\S]*?"type"[\s\S]*?"parentInteractionId"[\s\S]*?\]\)/u,
  "concurrent Story views must use the file-store uniqueness error",
);
assert.match(
  messageRoutes,
  /proceed without a generated image/u,
  "commission image failures must offer a text-only delivery path",
);

// ── Creator message policy and prices have a UI ──────────

// Every one of these endpoints worked and was ownership-gated, and nothing called them: each
// Creator was stuck on the shipped defaults and the paid DM policy could never be chosen.
assert.match(useSlurpSource, /export function useSlurpCreatorMessagingSettings\(/u);
assert.match(settingsUi, /function CreatorMessagingGroup\(/u);
// The persona-backed-only gate is gone: every Creator's policy and prices are the player's to
// set, world-run ones included (a dedicated settings tab calls CreatorMessagingGroup unconditionally).
assert.match(settingsUi, /export function SlpCreatorMessagesSection\([\s\S]{0,900}?<CreatorMessagingGroup/u);
for (const hook of ["useSetSlurpCreatorMessaging", "useSetSlurpCreatorPrice"]) {
  assert.ok(settingsUi.includes(hook), `${hook} must be reachable from Settings`);
}
for (const key of [
  "ui.slurp.settings.creators.dmPolicy",
  "ui.slurp.settings.creators.dmPolicyPaid",
  "ui.slurp.settings.creators.requestFee",
  "ui.slurp.settings.creators.ppvPrice",
  "ui.slurp.settings.creators.subscriptionPrice",
  "ui.slurp.messages.commissionDecline",
  "ui.slurp.messages.commissionWithdraw",
  "ui.slurp.messages.attachImage",
]) {
  assert.equal(typeof englishUi[key], "string", `${key} needs an English string`);
}

console.log("slurp review fixes regression passed");

// The send route generates the reply before it answers, so the fan's own words and the typing
// indicator have to appear at send time. Without this the chat sat empty for the whole wait.
// setPending gained a startedAt timestamp; the typing indicator now also checks the Creator isn't
// known offline before showing.
assert.match(messagesView2, /setPending\(\{ content, id: null, startedAt: optimisticStartedAt \}\)/u);
assert.match(messagesView2, /if \(!ownsCreator && availability\?\.online !== false\) setTyping\(true\)/u);
assert.match(messagesView2, /holdTyping\(result\.reply \? \(result\.typingMs \?\? 0\) : 0, result\.reply\?\.id\)/u);
// The echo-drop condition inverted to a positive match (setPending(null) once found) and gained a
// content+timestamp fallback match, so a real message landing under a different id still clears
// the optimistic echo instead of leaving it to blink.
assert.match(
  messagesView2,
  /pending &&\s*\n\s*messages\.some\(\s*\n\s*\(message\) =>\s*\n\s*\(pending\.id !== null && message\.id === pending\.id\) \|\|\s*\(message\.role === "viewer" &&\s*message\.content === pending\.content &&\s*Date\.parse\(message\.createdAt\) >= pending\.startedAt\)/u,
);

const slurpHooks = slurp2Source("packages/slurp2/src/engine/packages/client/src/hooks/use-slurp.ts");
// A chat opened from a profile polls like one opened from the inbox, or the queued off-hours
// reply never arrives on that screen.
// Gained a "peek" preview mode since, which must not poll like an opened chat.
assert.match(
  slurpHooks,
  /messages\/compose[\s\S]{0,500}?refetchInterval: creatorAccountId && personaId && !peek \? 30_000 : false/u,
);
// One DM used to invalidate the whole Slurp root, which re-paged the entire feed.
assert.match(slurpHooks, /const invalidateSlurpMessages =/u);
assert.doesNotMatch(
  slurpHooks.slice(
    slurpHooks.indexOf("export function useSendSlurpMessage()"),
    slurpHooks.indexOf("export function useRecordSlurpStoryView()"),
  ),
  /invalidateQueries\(\{ queryKey: noodleKeys\.noodlerRoot\(\) \}\)/u,
);
