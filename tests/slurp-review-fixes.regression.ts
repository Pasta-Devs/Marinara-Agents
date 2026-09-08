import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const server = join(root, "packages/slurp/src/engine/packages/server/src");
const client = join(root, "packages/slurp/src/engine/packages/client/src");
const read = (path: string) => readFileSync(path, "utf8");

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
assert.match(messagesStorage, /const commissionAccepts = new Map</u);
assert.match(
  messagesStorage,
  /async acceptCommission\(id: string\)[\s\S]{0,600}?commissionAccepts\.set\(id, current\)/u,
  "commission accepts must be serialized per commission",
);
// A failure after the debit must give the coins back, like the PPV path does.
assert.match(
  messagesStorage,
  /async acceptCommissionUnlocked[\s\S]{0,1400}?refundCoins\([\s\S]{0,200}?reverseCreatorIncome\(/u,
  "a failed commission accept must be compensated",
);
// Re-quoting an accepted commission used to reset it to `quoted` and make it payable again.
assert.match(
  messagesStorage,
  /async quoteCommission[\s\S]{0,400}?existing\.state !== "brief" && existing\.state !== "quoted"/u,
);

// Missing-table fallbacks must return the declared shape. `[]` and `null` crashed the callers they
// were meant to protect.
assert.match(messagesStorage, /rapportFactsFor: \(\) => emptySlurpRapportFacts\(\)/u);
assert.match(messagesStorage, /claimReply: \(\) => \(\{ status: "busy" as const \}\)/u);

// ── Ownership ────────────────────────────────────────────

const routes = read(join(server, "routes/slurp.routes.ts"));
// The weekly price is what other personas pay, so only the operating persona may set it — the same
// gate `/goal` and `/payout` already carry.
assert.match(
  routes,
  /subscription-price"[\s\S]{0,900}?if \(!creatorBelongsToViewer\(creator, viewer\)\)/u,
  "the subscription price route must check Creator ownership",
);

// ── Schedulers ───────────────────────────────────────────

const messageScheduler = read(join(server, "services/slurp/slurp-message-scheduler.service.ts"));
// `replyToSlurpMessage` reports a provider failure instead of rejecting, so discarding its result
// left `consecutiveFailures` at zero and the backoff never engaged.
assert.match(messageScheduler, /const outcome = await replyToSlurpMessage\(/u);
assert.match(messageScheduler, /if \(outcome\.status === "failed"\) failed = true;/u);
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

const apiClient = read(join(client, "lib/api-client.ts"));
// A bare `null` or an array error body made `body.error` throw and hid the real HTTP status.
assert.match(apiClient, /const body = isRecord\(parsed\) \? parsed : \{ error: res\.statusText \}/u);

// ── Controls ─────────────────────────────────────────────

const onboarding = read(join(client, "components/slurp/SlurpOnboardingPanel.tsx"));
assert.match(
  onboarding,
  /completion === "settingsFailed" && \(\s*<button\s*type="button"\s*disabled=\{pending\}/u,
  "the settings retry button needs the same in-flight guard as its siblings",
);

const messagesView = read(join(client, "components/slurp/SlurpMessages.tsx"));
// A failed unlock used to re-enable the button and say nothing at all.
assert.match(messagesView, /\{unlock\.isError && \(/u);

const settings = read(join(client, "components/slurp/SlurpSettings.tsx"));
assert.match(settings, /\.download\("\/slurp\/noodler\/ads\/export"[\s\S]{0,120}?\.catch\(/u);

const shell = read(join(client, "components/slurp/SlurpShell.tsx"));
// The active persona was signalled by background colour alone.
assert.match(shell, /aria-current=\{selected \? "true" : undefined\}/u);

const profileSurface = read(join(client, "components/slurp/SlurpProfileSurface.tsx"));
assert.match(
  profileSurface,
  /aria-label=\{avatarUpload\.canEdit \? localizeUi\("editor\.avatar\.upload"\) : undefined\}/u,
);

// ── Stories ──────────────────────────────────────────────

const generation = read(join(server, "services/slurp/slurp-generation.service.ts"));
// Automatic posting only ever produced feed posts, so the Story shelf could only be filled by hand.
assert.match(generation, /const storyBeat = beat\?\.story === true && imagesEnabled;/u);
// A Story is a picture with a line under it, so only the path that commits an image may mark one.
assert.match(
  generation,
  /imageUrl: noodlerPostMediaUrl\(postId\),\s*metadata: \{ \.\.\.image\.metadata, \.\.\.\(storyBeat \? \{ noodlerPostType: "story" \} : \{\}\) \},/u,
);
// The scheduled path returns at prepareOnly, before the committed-image branch, so it carries the
// story intent in the prepared payload instead — otherwise every scheduled Story silently published
// as an ordinary post. publishDueNoodlerPreparedPosts drops the flag again when no image attached,
// which is what keeps "a Story is a picture with a line under it" true.
const storyMarks = [...generation.matchAll(/noodlerPostType: "story"/gu)];
assert.equal(storyMarks.length, 2, "the committed-image path and the prepared payload both mark a Story");
assert.match(
  generation,
  /metadata: \{ \.\.\.baseInput\.metadata, \.\.\.\(storyBeat \? \{ noodlerPostType: "story" \} : \{\}\) \},/u,
  "the prepareOnly return must carry the story flag",
);
const storage = read("packages/slurp/src/engine/packages/server/src/services/storage/slurp.storage.ts");
assert.match(
  storage,
  /if \(!hasMedia\) delete preparedMetadata\.noodlerPostType;/u,
  "publishing a prepared post without an image must drop the story flag",
);
assert.match(
  generation,
  /\.\.\.\(storyBeat \? \{ width: settings\.storyImageWidth, height: settings\.storyImageHeight \} : \{\}\)/u,
);

const cropEditor = read(join(client, "components/slurp/PostImageCropEditor.tsx"));
// An uploaded Story is cropped to the same ratio an automatic one is drawn at, whatever the player
// configured — a named aspect would drift from the setting the moment it is changed.
assert.match(cropEditor, /lockedRatio\?: number;/u);
assert.match(cropEditor, /lockedRatio && Number\.isFinite\(lockedRatio\) && lockedRatio > 0\s*\? lockedRatio/u);
const home = read(join(client, "components/slurp/SlurpHome.tsx"));
assert.match(home, /lockedRatio=\{postType === "story" \? storyAspectRatio : undefined\}/u);
assert.match(home, /composerSettings\.storyImageWidth \/ composerSettings\.storyImageHeight/u);

// ── Profile editor ───────────────────────────────────────

// Opening the wizard is not a change: the source step used to prompt "Discard profile changes?"
// with nothing picked, nothing typed, and nothing generated.
assert.match(
  home,
  /const hasNewDraft = Boolean\(\s*profileDraft \|\|\s*draftGuidance\.trim\(\) \|\|\s*generateProfileDraft\.isPending \|\|\s*\(creationStep === "source" && draftNoodleAccountId\),\s*\);/u,
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
  for (const path of sources) {
    const text = read(path);
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
    assert.deepEqual(duplicates, [], `${path} binds the same import name twice: ${duplicates.join(", ")}`);
  }
}

// ── Prices ───────────────────────────────────────────────

const postOperation = read(join(server, "services/slurp/slurp-post.operation.ts"));
// Settings → Wallet → "Unlock a post" is documented as the default a locked post is stamped with.
// Both creation paths called the helper with no argument, so every locked post cost the shipped 1.
assert.match(postOperation, /const unlockPrice = \(await noodle\.getSettings\(\)\)\.walletUnlockCost;/u);
assert.doesNotMatch(postOperation, /noodlerUnlockPriceMetadata\(\)/u, "a locked post must be stamped with the setting");
assert.doesNotMatch(generation, /noodlerUnlockPriceMetadata\(\)/u);
assert.match(generation, /noodlerUnlockPriceMetadata\(settings\.walletUnlockCost\)/u);

// ── Subscribe ────────────────────────────────────────────

const slurpStorage = read(join(server, "services/storage/slurp.storage.ts"));
// `now()` returns an ISO string; every use in `subscribe` wants a Date, so the first subscribe for
// a viewer threw "toISOString is not a function" and returned a 500.
assert.match(slurpStorage, /const at = new Date\(\);\s*const existingWallet = settings\.walletEnabled/u);
// The persona switcher read the Engine's own wallet field, which defaults to 999_999.
assert.match(slurpStorage, /listViewerWallets[\s\S]{0,700}?coins: \(await getWalletNow\(personaId\)\)\.coins/u);

// ── Viewer actors are not Creators ───────────────────────

// A persona's own Slurp identity is provisioned the first time it likes or replies. It was then
// listed in Creator profiles as "Setup Needed" and shown in every other viewer's Discover.
assert.match(slurpStorage, /export function isSlurpViewerActorAccount\(/u);
assert.match(
  slurpStorage,
  /listNoodlerStageProfiles[\s\S]{0,200}?\.filter\(\(account\) => !isSlurpViewerActorAccount\(account\)\)/u,
);
const viewerActorFilters = [...routes.matchAll(/!isSlurpViewerActorAccount\(account\) &&/gu)];
assert.equal(viewerActorFilters.length, 2, "both visible-account filters must exclude viewer actors");

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

const settingsUi = read(join(client, "components/slurp/SlurpSettings.tsx"));
for (const key of [
  "ui.slurp.settings.storyRate",
  "ui.slurp.settings.images.storyWidth",
  "ui.slurp.settings.images.storyHeight",
]) {
  assert.ok(settingsUi.includes(key), `${key} must be reachable in Settings`);
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
// Only an unpaid commission: after accept the coins have moved and it would need a refund path.
assert.match(
  messagesStorage,
  /async declineCommission[\s\S]{0,400}?commission\.state !== "brief" && commission\.state !== "quoted"/u,
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
assert.match(
  messageRoutes,
  /message\.kind === "ppv" && !message\.unlockedAt\s*\? \{ \.\.\.message, content: "", imageUrl: null \}/u,
);
assert.match(messagesStorage, /kind: "commission_delivery",\s*imageUrl,/u);
assert.match(messagesView2, /const messageImage = useSlurpMediaSrc\(message\.imageUrl\)/u);
assert.match(useSlurpSource, /generateImage\?: boolean/u);
assert.match(messagesView2, /ui\.slurp\.messages\.generateCommissionImage/u);
assert.match(messagesView2, /generateImage,/u);

const slurpRoutesSource = read(join(server, "routes/slurp.routes.ts"));
assert.match(
  slurpRoutesSource,
  /isFileUniqueConstraintError\(error, "slurp_interactions", \[[\s\S]*?"postId"[\s\S]*?"actorAccountId"[\s\S]*?"type"[\s\S]*?"parentInteractionId"[\s\S]*?\]\)/u,
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
assert.match(settingsUi, /personaCreator\(selectedCreator\) && selectedCreator\.sourceAccountId && \(/u);
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
