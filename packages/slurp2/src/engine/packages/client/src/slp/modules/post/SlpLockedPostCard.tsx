import { SlpTimestamp } from "../../base/ui/SlpTimestamp";
import { SlpStoryRingAvatar } from "../story/SlpStoryRing";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Eye,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Share2,
  Download,
  Dices,
  ScanSearch,
} from "lucide-react";
import { SlpHeartGlyph, SlpLockGlyph } from "../../base/chrome/SlpGlyphs";
import { useRef, useState } from "react";
import type { SlpCreatorPostView, SlpCreatorStageProfile } from "../../../../../shared/src/slp/slp-social.types.js";
import { cn } from "../../../lib/utils";
import { useNearViewportSlurpMediaSrc } from "../../base/media/slp-media-src";
import { ProfileInitial, slpImgFade } from "../../base/chrome/SlpChrome";
import { useTranslation as useUiTranslation } from "react-i18next";
import { SlurpCelebrationRing, SlurpSparkleVeil } from "../../base/chrome/SlpSparkleVeil";
import { SlurpCoinAmount, SlurpCoinBurst, SlpCoinText } from "../coin/SlpCoin";
import { SlpPrimaryButton, slpTagClass } from "../chrome/SlpButton";
import { SLP_FEED_MEDIA_FRAME_CLASS } from "./SlpPostHelpers";
import { slpPostFrameStyle, slpPostMediaRatio } from "./slp-post-ratio";
import { SlpSheet, SlpSheetGroup, SlpSheetItem } from "../chrome/SlpSheet";
import { playSlpBurst, playSlpSpendMoment, SlpRingGlint, SlpShimmer, SlpTwinkle } from "../sparkle/SlpSparkle";
import { SLP_PILL_TWINKLES, SlpLockedContentsChip, SlpSparkleLock } from "./SlpLockedMedia";
import { api } from "../../../lib/api-client";
import { toast } from "sonner";
import { slpCanAffordGamble, slpHasGambleOffer } from "../../../../../shared/src/slp/slp-post-offers.js";
import { useSlpBalance } from "../chrome/SlpShell";
import type { SlpPostSubscriptionOffer, SlpPostUnlockOffer } from "./SlpPostTypes";
import { SlpDeepDetailsModal } from "./SlpDeepDetailsModal";
import { SlpCreatorFictionalPrice, SlpDiscountOfferButton } from "./SlpUnlockOfferRows";

export function LockedSlurpPostCard({
  post,
  profile,
  subscriptionPrice,
  postMenuOpen: postMenuOpenProp,
  setPostMenuOpen: setPostMenuOpenProp,
  controllerOnly = false,
  subscribed,
  unlockPending,
  subscriptionPending,
  onUnlock,
  onGambleUnlock,
  onToggleSubscription,
  unlockOffer,
  subscriptionOffer,
  onManage,
  onGenerateImage,
  imageGenerationPending = false,
  onOpenProfile,
  demo,
}: {
  post: Pick<SlpCreatorPostView, "id" | "access" | "createdAt" | "title" | "imageUrl"> &
    Partial<Pick<SlpCreatorPostView, "likeCount" | "replyCount" | "hasImage" | "imagePrompt">>; // controller-locked managed posts carry no counts
  profile: SlpCreatorStageProfile;
  subscriptionPrice?: number | null;
  postMenuOpen?: boolean;
  setPostMenuOpen?: (open: boolean) => void;
  controllerOnly?: boolean;
  subscribed: boolean;
  unlockPending: boolean;
  subscriptionPending: boolean;
  onUnlock: (postId: string) => void | Promise<void>;
  onGambleUnlock?: (postId: string) => Promise<{
    outcome: "free" | "triple-price" | "already-unlocked";
    amount: number;
  }>;
  onToggleSubscription: (creatorAccountId: string, subscribed: boolean) => void | Promise<void>;
  unlockOffer?: SlpPostUnlockOffer;
  subscriptionOffer?: SlpPostSubscriptionOffer;
  onManage?: () => void;
  onGenerateImage?: () => void;
  imageGenerationPending?: boolean;
  onOpenProfile?: (accountId: string) => void;
  /** Onboarding only: unlocking reveals this text locally instead of calling the server. */
  /** `unlockedImageUrl` lets the demo pay off with a different image than the locked teaser. */
  demo?: {
    body: string;
    unlockedLabel: string;
    unlockedImageUrl?: string;
    lockedTitle?: string;
    onReveal?: () => void;
  };
}) {
  const { t: localizeUi } = useUiTranslation();
  const [unlockSheetOpen, setUnlockSheetOpen] = useState(false);
  const [transaction, setTransaction] = useState<
    "subscribe" | "unlock" | "gamble" | "unlock-offer" | "subscription-offer" | null
  >(null);
  const [localPostMenuOpen, setLocalPostMenuOpen] = useState(false);
  const postMenuOpen = postMenuOpenProp ?? localPostMenuOpen;
  const setPostMenuOpen = setPostMenuOpenProp ?? setLocalPostMenuOpen;
  const [demoUnlocked, setDemoUnlocked] = useState(false);
  const [deepDetailsOpen, setDeepDetailsOpen] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const unlockTriggerRef = useRef<HTMLButtonElement | null>(null);
  const likeCount = post.likeCount ?? 0;
  const replyCount = post.replyCount ?? 0;
  const openProfile = onOpenProfile ? () => onOpenProfile(profile.id) : undefined;
  const revealed = Boolean(demo && demoUnlocked);
  // The demo's real title is a punchline; showing it while locked spoils the reveal, on the card
  // and in the unlock sheet alike.
  const shownTitle = demo && !revealed ? (demo.lockedTitle ?? post.title) : post.title;
  // The post's own line under the lock; the fixed line is only for a post that has none.
  const ownTeaser = (post as { teaser?: unknown }).teaser;
  const lockedTeaser = typeof ownTeaser === "string" && ownTeaser.trim() ? ownTeaser : null;
  // A locked post's URL resolves to a server-blurred teaser, not the original bytes. Where no
  // teaser can be built the server sends nothing and only the frame renders.
  const postImages = post.images ?? [];
  const requestedMediaUrl =
    (revealed && demo?.unlockedImageUrl) || postImages[activeImageIndex]?.imageUrl || post.imageUrl || null;
  const { src: mediaSrc, observe: observeMedia } = useNearViewportSlurpMediaSrc(requestedMediaUrl, { width: 960 });
  // No teaser could be built (the route 404s), so drop the broken <img> and keep the frame.
  const [failedMediaSrc, setFailedMediaSrc] = useState<string | null>(null);
  const shownMediaSrc = mediaSrc && mediaSrc !== failedMediaSrc ? mediaSrc : null;
  const hasMediaPreview = Boolean(requestedMediaUrl || post.hasImage || (onGenerateImage && post.imagePrompt));
  const runTransaction = async (
    kind: "subscribe" | "unlock" | "gamble" | "unlock-offer" | "subscription-offer",
    button: Element,
  ) => {
    if (transaction) return;
    // The sheet closes on success, so the spend moment starts from the post's own Unlock button (a
    // stable point in the feed), measured now; the tapped sheet row is the fallback.
    const trigger = unlockTriggerRef.current?.getBoundingClientRect();
    const origin = trigger && trigger.width > 0 ? trigger : button.getBoundingClientRect();
    setTransaction(kind);
    try {
      if (demo) {
        await new Promise((resolve) => window.setTimeout(resolve, 420));
        setDemoUnlocked(true);
        setUnlockSheetOpen(false);
        playSlpSpendMoment(origin);
        demo.onReveal?.();
        setTransaction(null);
        return;
      }
      let spent = true;
      if (kind === "unlock") await onUnlock(post.id);
      else if (kind === "gamble" && onGambleUnlock) {
        const result = await onGambleUnlock(post.id);
        spent = result.outcome !== "free" && result.outcome !== "already-unlocked";
        toast.success(
          result.outcome === "already-unlocked" ? (
            localizeUi("ui.slurp.unlocksheet.alreadyUnlocked", { defaultValue: "You already unlocked this post." })
          ) : result.outcome === "free" ? (
            localizeUi("ui.slurp.unlocksheet.gambleFreeResult", { defaultValue: "Unlocked this post for free." })
          ) : (
            <SlpCoinText>
              {localizeUi("ui.slurp.unlocksheet.gamblePaidResult", {
                defaultValue: "Unlocked this post for {{amount}} <coin/>.",
                amount: result.amount,
              })}
            </SlpCoinText>
          ),
        );
      } else if (kind === "subscribe") await onToggleSubscription(profile.id, subscribed);
      else if (kind === "unlock-offer" && unlockOffer) await unlockOffer.onUnlock(post.id, unlockOffer.newPrice);
      else if (kind === "subscription-offer" && subscriptionOffer)
        await subscriptionOffer.onSubscribe(profile.id, subscribed, subscriptionOffer.newPrice);
      setUnlockSheetOpen(false);
      if (spent) playSlpSpendMoment(origin);
      else playSlpBurst(origin);
      setTransaction(null);
    } catch {
      // The parent owns the error message. Keep the sheet open so the viewer can try again.
      setTransaction(null);
    }
  };
  const unlockPrice = slpCreatorUnlockPriceOf(post);
  // The bet needs the losing side covered (user, fix phase 1b): no free win for a short balance.
  const coins = useSlpBalance();
  const gambleBlocked = unlockPrice !== null && !slpCanAffordGamble(coins, unlockPrice);
  const gambleDetail = gambleBlocked
    ? localizeUi("ui.slurp.unlocksheet.gambleNeedsCoins", {
        defaultValue: "You need {{amount}} <coin/> to take the bet.",
        amount: (unlockPrice ?? 0) * 3,
      })
    : localizeUi("ui.slurp.unlocksheet.gambleDetail", {
        defaultValue: "50% free, 50% at 3x price. Either way, this post unlocks.",
      });
  const onMedia = hasMediaPreview;
  const unlockPrompt = !revealed && !controllerOnly && (
    <div
      className={
        onMedia ? "pointer-events-auto flex flex-col items-center gap-2.5" : "mt-4 flex flex-col items-start gap-2"
      }
    >
      {/* The glowing price pill: the price is on the button before the tap (design language §7).
          Mixed-candy twinkles land round it once, as it appears. */}
      <span className="relative isolate inline-flex">
        <SlpTwinkle points={SLP_PILL_TWINKLES} />
        <SlpPrimaryButton
          ref={unlockTriggerRef}
          disabled={unlockPending || subscriptionPending}
          onClick={() => setUnlockSheetOpen(true)}
          className="shadow-[0_0_0_1px_color-mix(in_srgb,white_30%,transparent),0_10px_34px_-6px_var(--noodle-accent),var(--slurp-highlight)]"
        >
          {localizeUi("ui.noodle.lockednoodlerpostcard.unlock")}
          {unlockPrice !== null && (
            <>
              <span aria-hidden="true">·</span>
              <SlurpCoinAmount amount={unlockPrice} className="font-extrabold" />
            </>
          )}
        </SlpPrimaryButton>
      </span>
      {/* The comparison that sells the subscription, one tap away (same spend as the sheet's row). */}
      {typeof subscriptionPrice === "number" && subscriptionPrice >= 0 && !subscribed ? (
        <button
          type="button"
          data-slurp-locked-subscribe
          disabled={subscriptionPending || transaction !== null}
          onClick={(event) => void runTransaction("subscribe", event.currentTarget)}
          className={cn(
            "min-h-8 rounded-full px-2 text-xs font-semibold underline-offset-2 transition-opacity hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-60",
            onMedia ? "text-white/90 [text-shadow:0_1px_6px_rgb(0_0_0/0.65)]" : "-ms-2 text-[var(--slurp-ink)]",
          )}
        >
          <SlpCoinText>
            {localizeUi("ui.slurp.locked.orSubscribe", {
              defaultValue: "or included with Subscribe · {{price}} <coin/> / week",
              price: subscriptionPrice,
            })}
          </SlpCoinText>
        </button>
      ) : (
        <span
          className={
            onMedia
              ? "text-xs font-semibold text-white/85 [text-shadow:0_1px_6px_rgb(0_0_0/0.6)]"
              : "text-xs font-medium text-[var(--slurp-muted)]"
          }
        >
          {localizeUi("ui.slurp.locked.includedForSubscribers", { defaultValue: "Included for subscribers" })}
        </span>
      )}
    </div>
  );
  // What is behind the veil, said plainly: "4 photos", "1 photo".
  const photoCount = Math.max(postImages.length, requestedMediaUrl || post.hasImage ? 1 : 0);
  return (
    <article
      data-noodle-post-id={post.id}
      // Same glossy raised card as an open post; the veiled picture carries the "locked" feeling.
      className="group/locked relative z-0 rounded-2xl bg-[var(--slurp-surface-raised)] px-4 py-4 shadow-[var(--slurp-shadow-raised),var(--slurp-highlight)]"
    >
      {/* Author row */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={openProfile}
          disabled={!openProfile}
          className="h-fit shrink-0 rounded-full text-left transition-opacity enabled:hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] disabled:cursor-default"
          title={
            openProfile
              ? localizeUi("ui.noodle.noodlehome.viewValue1", {
                  value1: profile.handle,
                })
              : undefined
          }
        >
          <SlpStoryRingAvatar creatorId={profile.id} name={profile.displayName}>
            <span className="relative">
              <ProfileInitial profile={profile} />
              <SlurpCelebrationRing active={transaction !== null} />
            </span>
          </SlpStoryRingAvatar>
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={openProfile}
              disabled={!openProfile}
              className="min-w-0 truncate rounded-lg text-[15px] font-bold leading-5 transition-colors enabled:hover:text-[var(--noodle-accent-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] disabled:cursor-default"
            >
              {profile.displayName}
            </button>
            <span title={localizeUi("ui.noodle.postaccess.locked.hint")} className={slpTagClass(true)}>
              <SlpLockGlyph size={12} aria-hidden="true" />
              {revealed && demo ? demo.unlockedLabel : localizeUi("ui.noodle.postaccess.locked")}
            </span>
          </div>
          <p className="mt-0.5 flex min-w-0 items-center text-xs font-medium leading-4 text-[var(--slurp-muted)]">
            <span className="min-w-0 truncate">@{profile.handle}</span>
            <span className="shrink-0 whitespace-pre"> · </span>
            <span className="shrink-0">
              <SlpTimestamp value={post.createdAt} tappable />
            </span>
          </p>
        </div>
        <div className="relative shrink-0">
          <button
            ref={menuTriggerRef}
            type="button"
            onClick={() => setPostMenuOpen(!postMenuOpen)}
            className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--slurp-muted)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--slurp-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] [&_svg]:!text-current"
            title={localizeUi("ui.noodle.noodlepostcard.postActions")}
            aria-label={localizeUi("ui.noodle.noodlepostcard.postActions")}
            aria-haspopup="menu"
            aria-expanded={postMenuOpen}
          >
            <MoreHorizontal size={18} />
          </button>
          {!demo && (
            <SlpDeepDetailsModal postId={post.id} open={deepDetailsOpen} onClose={() => setDeepDetailsOpen(false)} />
          )}
          <SlpSheet
            kind="menu"
            open={postMenuOpen}
            onClose={() => setPostMenuOpen(false)}
            anchorRef={menuTriggerRef}
            title={localizeUi("ui.noodle.noodlepostcard.postActions")}
          >
            <SlpSheetGroup>
              {shownMediaSrc && (
                <SlpSheetItem
                  onSelect={() => {
                    setPostMenuOpen(false);
                    void api
                      .download(`/slurp2/noodler/posts/${encodeURIComponent(post.id)}/media`, `slurp-${post.id}-teaser`)
                      .catch(() => undefined);
                  }}
                >
                  <Download size={14} />
                  {localizeUi("ui.slurp.post.downloadImage", { defaultValue: "Download image" })}
                </SlpSheetItem>
              )}
              {/* Sharing a locked post is not built yet; the row says so instead of doing nothing. */}
              <SlpSheetItem disabled onSelect={() => setPostMenuOpen(false)}>
                <Share2 size={14} />
                {localizeUi("ui.slurp.post.share", { defaultValue: "Share post" })}
              </SlpSheetItem>
            </SlpSheetGroup>
            {(!demo || onManage) && (
              <SlpSheetGroup label={localizeUi("ui.slurp.post.creatorTools", { defaultValue: "Creator tools" })}>
                {onManage && (
                  <SlpSheetItem
                    tone="muted"
                    onSelect={() => {
                      setPostMenuOpen(false);
                      onManage();
                    }}
                  >
                    <Pencil size={14} />
                    {localizeUi("ui.noodle.lockednoodlerpostcard.managePost")}
                  </SlpSheetItem>
                )}
                {/* Every Creator is the player's to manage, so a locked post opens its record like any other. */}
                {!demo && (
                  <SlpSheetItem
                    tone="muted"
                    onSelect={() => {
                      setPostMenuOpen(false);
                      setDeepDetailsOpen(true);
                    }}
                  >
                    <ScanSearch size={14} />
                    {localizeUi("ui.slurp.deepDetails.title", { defaultValue: "Deep details" })}
                  </SlpSheetItem>
                )}
              </SlpSheetGroup>
            )}
          </SlpSheet>
        </div>
      </div>

      {/* Full-width body */}
      <div>
        {/* Media frame with Locked badge — only when the post has an image */}
        {hasMediaPreview && (
          // V: the frame takes the picture's own ratio (the teaser has the original's shape), centred.
          <div className="-mx-4 mt-3 flex w-[calc(100%+2rem)] justify-center bg-black/20">
            <div
              ref={observeMedia}
              data-slurp-locked-preview
              className={cn(
                "relative overflow-hidden bg-[var(--slurp-media-stage,#17131a)]",
                SLP_FEED_MEDIA_FRAME_CLASS,
              )}
              // The veil's lock, price and chips need room: a wide teaser (it is blurred) grows to fit them.
              style={{ ...slpPostFrameStyle(slpPostMediaRatio(postImages[0])), minHeight: "20rem" }}
            >
              {shownMediaSrc ? (
                <img
                  src={shownMediaSrc}
                  loading="lazy"
                  decoding="async"
                  // Fades in once; the unlock keeps this element, so the full picture replaces the teaser under the veil.
                  {...slpImgFade}
                  onError={() => setFailedMediaSrc(shownMediaSrc)}
                  alt={
                    revealed
                      ? localizeUi("ui.noodle.post.imageBy", {
                          name: profile.displayName,
                        })
                      : localizeUi("ui.noodle.lockednoodlerpostcard.lockedImageFrom", { name: profile.displayName })
                  }
                  className={cn(
                    "slp-crop-top h-full w-full object-cover",
                    // The server sends a reduced, lightly blurred teaser; the veil blurs it more so the
                    // colours and the shape read, the details do not (design step 2).
                    revealed ? "scale-100" : "saturate-[0.95]",
                    !revealed && "scale-110 blur-[10px]",
                  )}
                />
              ) : requestedMediaUrl ? (
                <div
                  className="absolute inset-0 animate-pulse bg-[var(--muted)] motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_50%_35%,var(--noodle-accent)_0%,transparent_65%)] px-6 text-center">
                  {/* While locked, the lock and price stand in the middle instead. */}
                  {!unlockPrompt && (
                    <>
                      <span className="rounded-full bg-black/25 p-3 text-[var(--noodle-accent)] ring-1 ring-white/10">
                        <ImageIcon size={22} aria-hidden="true" />
                      </span>
                      <span className="text-xs font-semibold text-[var(--muted-foreground)]">
                        {localizeUi("ui.slurp.locked.previewUnavailable")}
                      </span>
                    </>
                  )}
                  {onGenerateImage && (
                    <button
                      type="button"
                      onClick={onGenerateImage}
                      disabled={imageGenerationPending}
                      className="pointer-events-auto absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/65 text-white shadow-lg ring-1 ring-white/20 transition-[opacity,transform] hover:bg-black/80 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] disabled:opacity-60 motion-reduce:transition-none motion-reduce:active:scale-100"
                      title={localizeUi("ui.slurp.image.generate")}
                      aria-label={localizeUi("ui.slurp.image.generate")}
                      aria-busy={imageGenerationPending}
                    >
                      <RefreshCw
                        size={17}
                        className={imageGenerationPending ? "animate-spin motion-reduce:animate-none" : ""}
                      />
                    </button>
                  )}
                </div>
              )}
              {!revealed && (
                <div
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_55%,rgba(8,4,10,0.12),rgba(8,4,10,0.55)_80%)]"
                  aria-hidden="true"
                />
              )}
              {!revealed && <SlurpSparkleVeil className={transaction ? "opacity-100" : ""} />}
              {!revealed && (
                // Signature surface (design language §2/§3): slow ambient sparkle over the veil and a
                // hero-gradient frame whose glint travels round the picture.
                <>
                  <span
                    className="pointer-events-none absolute inset-0 isolate z-[5] opacity-80 mix-blend-screen"
                    aria-hidden="true"
                  >
                    <SlpShimmer />
                  </span>
                  <SlpRingGlint />
                  <span
                    className="pointer-events-none absolute inset-0 z-[1] shadow-[inset_0_0_48px_-12px_var(--noodle-accent)]"
                    aria-hidden="true"
                  />
                </>
              )}
              {!revealed && photoCount > 0 && <SlpLockedContentsChip count={photoCount} />}
              {revealed && postImages.length > 1 && (
                <div className="pointer-events-none absolute inset-x-2 top-1/2 z-20 flex -translate-y-1/2 justify-between">
                  <button
                    type="button"
                    aria-label={localizeUi("ui.slurp.post.previousImage")}
                    onClick={() => setActiveImageIndex((activeImageIndex - 1 + postImages.length) % postImages.length)}
                    className="pointer-events-auto grid size-10 place-items-center rounded-full bg-black/65 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    type="button"
                    aria-label={localizeUi("ui.slurp.post.nextImage")}
                    onClick={() => setActiveImageIndex((activeImageIndex + 1) % postImages.length)}
                    className="pointer-events-auto grid size-10 place-items-center rounded-full bg-black/65 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              )}
              {/* The lock is a state cue; the accessible image text already describes the preview. */}
              {!revealed && (
                // SlpLockGlyph and price sit together in the middle of the veil.
                <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-4">
                  <SlpSparkleLock />
                  {unlockPrompt}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Title */}
        {shownTitle && <h3 className="mt-3 text-[15px] font-bold leading-5">{shownTitle}</h3>}

        {/* Body: a short teaser until unlocked; the private copy is never reconstructed client-side. */}
        {revealed && demo ? (
          <p className="mt-3 whitespace-pre-line text-sm leading-6">{demo.body}</p>
        ) : (
          !controllerOnly && (
            <p className="mt-1.5 text-[13px] leading-[19px] text-[var(--slurp-muted)]">
              {lockedTeaser ??
                localizeUi("ui.slurp.locked.teaser", { defaultValue: "A little something from tonight…" })}
            </p>
          )
        )}

        {!hasMediaPreview && unlockPrompt}

        {/* CTA */}
        {controllerOnly ? (
          <p className="mt-3 text-xs text-[var(--muted-foreground)]">
            {localizeUi("ui.noodle.lockednoodlerpostcard.openTheControllerToolsToManageThisPost")}
          </p>
        ) : null}

        {/* Footer */}
        <div className="mt-3 flex min-h-11 items-center gap-5 text-[13px] font-semibold tabular-nums text-[var(--slurp-muted)] [&_svg]:!text-current">
          {/* The icons are decorative, so the counts carry their own labels for screen readers. */}
          <span className="flex items-center gap-1.5">
            <SlpHeartGlyph size={18} aria-hidden="true" /> {likeCount}
            <span className="sr-only">{localizeUi("ui.noodle.noodlehome.likes")}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <MessageCircle size={18} aria-hidden="true" /> {replyCount}
            <span className="sr-only">{localizeUi("ui.noodle.noodlehome.replies")}</span>
          </span>
        </div>
      </div>
      <SlpSheet
        open={unlockSheetOpen}
        onClose={() => setUnlockSheetOpen(false)}
        title={localizeUi("ui.noodle.unlocksheet.title")}
        width="max-w-xl"
        closeDisabled={transaction !== null}
      >
        <div data-component="SlurpHome.UnlockSheet" className="relative isolate overflow-hidden px-1 pb-1">
          {transaction && <SlurpSparkleVeil className="z-20 opacity-80" />}
          {/* Who and what, in one calm row: the options below are the decision. */}
          <div className="mb-3 flex items-center gap-3 rounded-2xl bg-[var(--slurp-tint)] p-3 shadow-[var(--slurp-highlight)]">
            <span className="relative shrink-0">
              <ProfileInitial profile={profile} />
              <SlurpCelebrationRing active={transaction !== null} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-bold leading-5">{profile.displayName}</span>
              <span className="block truncate text-xs leading-4 text-[color-mix(in_srgb,var(--slurp-text)_74%,transparent)]">
                {shownTitle ??
                  localizeUi("ui.slurp.unlocksheet.fromCreator", {
                    defaultValue: "See the full post from {{name}}.",
                    name: profile.displayName,
                  })}
              </span>
            </span>
            {shownMediaSrc && (
              <span className="relative size-14 shrink-0 overflow-hidden rounded-xl">
                <img
                  src={shownMediaSrc}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  {...slpImgFade}
                  className="slp-crop-top h-full w-full scale-110 object-cover blur-[4px]"
                />
                <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-white [&_svg]:!text-white">
                  <SlpLockGlyph size={16} strokeWidth={2.25} aria-hidden="true" />
                </span>
              </span>
            )}
          </div>
          <div className="grid gap-3">
            <button
              type="button"
              data-noodler-unlock-action="post"
              disabled={unlockPending || transaction !== null}
              onClick={(event) => void runTransaction("unlock", event.currentTarget)}
              className="relative flex min-h-16 w-full items-center gap-3 overflow-visible rounded-2xl px-4 py-3 text-left shadow-[var(--slurp-shadow-raised),var(--slurp-highlight)] transition-[background-color,transform,filter] duration-[var(--slurp-motion-fast)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100 border border-[var(--noodle-accent)]/45 bg-[var(--slurp-surface-raised)] hover:bg-[color-mix(in_srgb,var(--noodle-accent)_8%,var(--slurp-surface-raised))]"
            >
              <SlurpCoinBurst active={transaction === "unlock"} />
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--slurp-tint)] [&_svg]:!text-[var(--slurp-ink)]">
                {transaction === "unlock" ? (
                  <Loader2 size={20} className="animate-spin motion-reduce:animate-none" />
                ) : (
                  <Eye size={20} />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold leading-5 text-[var(--slurp-text)]">
                  {localizeUi("ui.slurp.unlocksheet.unlockOnce", { defaultValue: "Unlock once" })}
                </span>
                <span className="block text-[13px] leading-[18px] text-[color-mix(in_srgb,var(--slurp-text)_74%,transparent)]">
                  {slpCreatorUnlockCountOf(post) === 1
                    ? localizeUi("ui.slurp.unlocksheet.unlockedByOne", { defaultValue: "Unlocked by 1 fan" })
                    : slpCreatorUnlockCountOf(post) > 1
                      ? localizeUi("ui.slurp.unlocksheet.unlockedBy", {
                          defaultValue: "Unlocked by {{count}} fans",
                          count: slpCreatorUnlockCountOf(post),
                        })
                      : localizeUi("ui.noodle.unlocksheet.unlockThisPostDetail")}
                </span>
              </span>
              <SlpCreatorFictionalPrice amount={slpCreatorUnlockPriceOf(post)} />
            </button>
            <button
              type="button"
              data-noodler-unlock-action="subscribe"
              disabled={subscriptionPending || transaction !== null}
              onClick={(event) => void runTransaction("subscribe", event.currentTarget)}
              className="relative flex min-h-16 w-full items-center gap-3 overflow-visible rounded-2xl px-4 py-3 text-left shadow-[var(--slurp-shadow-raised),var(--slurp-highlight)] transition-[background-color,transform,filter] duration-[var(--slurp-motion-fast)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100 bg-[image:var(--slurp-nav-active)] ring-1 ring-inset ring-[var(--noodle-accent)]/45 hover:brightness-110"
            >
              <SlurpCoinBurst active={transaction === "subscribe"} />
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--slurp-tint)] [&_svg]:!text-[var(--slurp-ink)]">
                {transaction === "subscribe" ? (
                  <Loader2 size={20} className="animate-spin motion-reduce:animate-none" />
                ) : (
                  <Bell size={20} />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-[15px] font-bold leading-5 text-[var(--slurp-text)]">
                    {localizeUi("ui.noodle.unlocksheet.subscribe")}
                  </span>
                  <span className={slpTagClass(true)}>
                    {localizeUi("ui.slurp.unlocksheet.bestValue", { defaultValue: "Best value" })}
                  </span>
                </span>
                <span className="block text-[13px] leading-[18px] text-[color-mix(in_srgb,var(--slurp-text)_74%,transparent)]">
                  {localizeUi("ui.slurp.unlocksheet.subscribeCreatorDetail", {
                    defaultValue: "Unlock every post from {{name}} and follow them.",
                    name: profile.displayName,
                  })}
                </span>
              </span>
              <SlpCreatorFictionalPrice
                amount={subscriptionPrice}
                suffix={localizeUi("ui.slurp.unlocksheet.perWeek", { defaultValue: "/ week" })}
              />
            </button>
            {onGambleUnlock && slpHasGambleOffer(post.id) && (
              <button
                type="button"
                data-slurp-gamble-unlock
                disabled={unlockPending || transaction !== null || gambleBlocked}
                onClick={(event) => void runTransaction("gamble", event.currentTarget)}
                className="relative flex min-h-16 w-full items-center gap-3 overflow-visible rounded-2xl px-4 py-3 text-left shadow-[var(--slurp-shadow-raised),var(--slurp-highlight)] transition-[background-color,transform,filter] duration-[var(--slurp-motion-fast)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100 bg-[var(--slurp-surface-raised)] hover:bg-[color-mix(in_srgb,var(--slurp-warm)_8%,var(--slurp-surface-raised))]"
              >
                <SlurpCoinBurst active={transaction === "gamble"} />
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--slurp-warm)_16%,transparent)] [&_svg]:!text-[var(--slurp-warm)]">
                  {transaction === "gamble" ? (
                    <Loader2 size={20} className="animate-spin motion-reduce:animate-none" />
                  ) : (
                    <Dices size={20} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-bold leading-5 text-[var(--slurp-text)]">
                      {localizeUi("ui.slurp.unlocksheet.gamble", { defaultValue: "Gamble" })}
                    </span>
                    <span className={slpTagClass()}>
                      {localizeUi("ui.slurp.unlocksheet.gambleAvailability", { defaultValue: "1 in 3 posts" })}
                    </span>
                  </span>
                  <span className="block text-[13px] leading-[18px] text-[color-mix(in_srgb,var(--slurp-text)_74%,transparent)]">
                    <SlpCoinText>{gambleDetail}</SlpCoinText>
                  </span>
                </span>
                {/* The real numbers, not "3x" (one coin rule): free, or three times the unlock price. */}
                <span className="shrink-0 text-right text-[15px] font-extrabold tabular-nums text-[var(--slurp-text)]">
                  {unlockPrice !== null ? (
                    <SlpCoinText>
                      {localizeUi("ui.slurp.unlocksheet.freeOrAmount", {
                        defaultValue: "Free or {{amount}} <coin/>",
                        amount: unlockPrice * 3,
                      })}
                    </SlpCoinText>
                  ) : (
                    localizeUi("ui.slurp.unlocksheet.freeOrTriple", { defaultValue: "Free or 3x" })
                  )}
                </span>
              </button>
            )}
            {unlockOffer && (
              <SlpDiscountOfferButton
                label={unlockOffer.label}
                actionLabel={localizeUi("ui.slurp.unlocksheet.unlockOnce", { defaultValue: "Unlock once" })}
                oldPrice={unlockOffer.oldPrice}
                newPrice={unlockOffer.newPrice}
                busy={transaction === "unlock-offer"}
                disabled={unlockPending || transaction !== null}
                onClick={(event) => void runTransaction("unlock-offer", event.currentTarget)}
                icon={<Eye size={20} className="shrink-0 text-[var(--noodle-accent-foreground)]" />}
                localizeUi={localizeUi}
              />
            )}
            {subscriptionOffer && (
              <SlpDiscountOfferButton
                label={subscriptionOffer.label}
                actionLabel={localizeUi("ui.noodle.unlocksheet.subscribe", { defaultValue: "Subscribe" })}
                oldPrice={subscriptionOffer.oldPrice}
                newPrice={subscriptionOffer.newPrice}
                suffix={localizeUi("ui.slurp.unlocksheet.perWeek", { defaultValue: "/ week" })}
                busy={transaction === "subscription-offer"}
                disabled={subscriptionPending || transaction !== null}
                onClick={(event) => void runTransaction("subscription-offer", event.currentTarget)}
                icon={<Bell size={20} className="shrink-0 text-[var(--noodle-accent-foreground)]" />}
                localizeUi={localizeUi}
              />
            )}
          </div>
        </div>
      </SlpSheet>
    </article>
  );
}

/** Fictional SlurpCoin prices only; the tooltip makes clear that no real money is involved. */
/** The server sends these alongside the shared view types, which have no price fields. */
function slpCreatorUnlockPriceOf(post: unknown): number | null {
  const price = (post as { unlockPrice?: unknown } | null)?.unlockPrice;
  return typeof price === "number" && price >= 0 ? price : null;
}

/** Social proof on the paywall. Absent or zero on a post nobody has paid for yet. */
function slpCreatorUnlockCountOf(post: unknown): number {
  const count = (post as { unlockCount?: unknown } | null)?.unlockCount;
  return typeof count === "number" && count > 0 ? count : 0;
}
