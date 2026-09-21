import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Eye,
  Heart,
  Image as ImageIcon,
  Loader2,
  Lock,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Share2,
} from "lucide-react";
import { useState } from "react";
import type { SlpCreatorPostView, SlpCreatorStageProfile } from "../../../../../shared/src/slp/slp-social.types.js";
import { cn } from "../../../lib/utils";
import { useNearViewportSlurpMediaSrc } from "../../base/media/slp-media-src";
import { Modal } from "../../../components/ui/Modal";
import { ProfileInitial } from "../../base/chrome/SlpChrome";
import { formatTime } from "../../base/ui/slp-date-time";
import { useTranslation as useUiTranslation } from "react-i18next";
import { SlurpCelebrationRing, SlurpSparkleVeil } from "../../base/chrome/SlpSparkleVeil";
import { SlurpCoin, SlurpCoinBurst } from "../coin/SlpCoin";

const SLURP_FEED_MEDIA_RATIO_CLASS = "aspect-[4/3] sm:aspect-[16/10]";

export function LockedSlurpPostCard({
  post,
  profile,
  subscriptionPrice,
  controllerOnly = false,
  subscribed,
  unlockPending,
  subscriptionPending,
  onUnlock,
  onToggleSubscription,
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
  controllerOnly?: boolean;
  subscribed: boolean;
  unlockPending: boolean;
  subscriptionPending: boolean;
  onUnlock: (postId: string) => void | Promise<void>;
  onToggleSubscription: (creatorAccountId: string, subscribed: boolean) => void | Promise<void>;
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
  const { t: localizeUi, i18n } = useUiTranslation();
  const [unlockSheetOpen, setUnlockSheetOpen] = useState(false);
  const [transaction, setTransaction] = useState<"subscribe" | "unlock" | null>(null);
  const [postMenuOpen, setPostMenuOpen] = useState(false);
  const [demoUnlocked, setDemoUnlocked] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const likeCount = post.likeCount ?? 0;
  const replyCount = post.replyCount ?? 0;
  const openProfile = onOpenProfile ? () => onOpenProfile(profile.id) : undefined;
  const revealed = Boolean(demo && demoUnlocked);
  // A locked post's URL resolves to a server-blurred teaser, not the original bytes. Where no
  // teaser can be built the server sends nothing and only the frame renders.
  const postImages = post.images ?? [];
  const requestedMediaUrl =
    (revealed && demo?.unlockedImageUrl) || postImages[activeImageIndex]?.imageUrl || post.imageUrl || null;
  const { src: mediaSrc, observe: observeMedia } = useNearViewportSlurpMediaSrc(requestedMediaUrl, { width: 960 });
  // No teaser could be built (the route 404s), so drop the broken <img> and keep the frame.
  const [failedMediaSrc, setFailedMediaSrc] = useState<string | null>(null);
  const shownMediaSrc = mediaSrc && mediaSrc !== failedMediaSrc ? mediaSrc : null;
  const runTransaction = async (kind: "subscribe" | "unlock") => {
    if (transaction) return;
    setTransaction(kind);
    try {
      if (demo) {
        await new Promise((resolve) => window.setTimeout(resolve, 420));
        setDemoUnlocked(true);
        demo.onReveal?.();
        setUnlockSheetOpen(false);
        setTransaction(null);
        return;
      }
      if (kind === "unlock") await onUnlock(post.id);
      else await onToggleSubscription(profile.id, subscribed);
    } catch {
      // The parent owns the error message. Keep the sheet open so the viewer can try again.
      setTransaction(null);
    }
  };
  return (
    <article
      data-noodle-post-id={post.id}
      className="group/locked relative overflow-hidden rounded-xl bg-[linear-gradient(145deg,var(--slurp-surface-raised),var(--slurp-surface))] px-4 py-5 shadow-[0_1px_0_color-mix(in_srgb,var(--noodle-accent)_32%,transparent),0_22px_48px_-34px_rgba(0,0,0,0.95)] ring-1 ring-inset ring-[var(--noodle-accent)]/25"
    >
      <div
        className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[var(--noodle-accent)]/70 to-transparent"
        aria-hidden="true"
      />
      {/* Author row */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={openProfile}
          disabled={!openProfile}
          className="h-fit rounded-full text-left transition-opacity enabled:hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] disabled:cursor-default"
          title={
            openProfile
              ? localizeUi("ui.noodle.noodlehome.viewValue1", {
                  value1: profile.handle,
                })
              : undefined
          }
        >
          <span className="relative">
            <ProfileInitial profile={profile} />
            <SlurpCelebrationRing active={transaction !== null} />
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <button
              type="button"
              onClick={openProfile}
              disabled={!openProfile}
              className="rounded-lg font-semibold transition-colors enabled:hover:text-[var(--noodle-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] disabled:cursor-default"
            >
              {profile.displayName}
            </button>
            <span
              title={localizeUi("ui.noodle.postaccess.locked.hint")}
              className="inline-flex items-center gap-1 rounded-lg bg-[var(--noodle-accent)]/12 px-2 py-1 text-[0.68rem] font-bold text-[var(--noodle-accent)] ring-1 ring-inset ring-[var(--noodle-accent)]/20"
            >
              <Lock size={11} />
              {revealed && demo ? demo.unlockedLabel : localizeUi("ui.noodle.postaccess.locked")}
            </span>
          </div>
          <p className="text-xs font-medium !text-[var(--noodle-accent-foreground)]">
            @{profile.handle} · {formatTime(post.createdAt, i18n.language)}
          </p>
        </div>
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setPostMenuOpen((open) => !open)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--noodle-accent)] transition-colors hover:bg-[var(--noodle-accent)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
            title={localizeUi("ui.noodle.noodlepostcard.postActions")}
            aria-label={localizeUi("ui.noodle.noodlepostcard.postActions")}
            aria-expanded={postMenuOpen}
          >
            <MoreHorizontal size={18} />
          </button>
          {postMenuOpen && (
            <div className="absolute end-0 top-[calc(100%+0.25rem)] z-30 min-w-40 overflow-hidden rounded-lg border border-[var(--noodle-divider)] bg-[var(--background)] py-1 text-xs shadow-2xl shadow-black/30">
              {onManage && (
                <button
                  type="button"
                  onClick={() => {
                    setPostMenuOpen(false);
                    onManage();
                  }}
                  className="flex min-h-10 w-full items-center gap-2 px-3 text-start hover:bg-[var(--accent)]"
                >
                  <Pencil size={14} />
                  {localizeUi("ui.noodle.lockednoodlerpostcard.managePost")}
                </button>
              )}
              <button
                type="button"
                disabled
                className="flex min-h-10 w-full items-center gap-2 px-3 text-start text-[var(--muted-foreground)] opacity-60"
                title={localizeUi("ui.slurp.post.unlockToShare", { defaultValue: "Unlock this post to share it." })}
              >
                <Share2 size={14} />
                {localizeUi("ui.slurp.post.share", { defaultValue: "Share as image" })}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Full-width body */}
      <div>
        {/* Media frame with Locked badge — only when the post has an image */}
        {(mediaSrc || post.hasImage || (onGenerateImage && post.imagePrompt)) && (
          <div
            ref={observeMedia}
            data-slurp-locked-preview
            className={cn(
              "relative -mx-4 mt-4 w-[calc(100%+2rem)] overflow-hidden bg-[var(--muted)] ring-1 ring-inset ring-white/10 sm:mx-0 sm:w-full sm:rounded-xl",
              SLURP_FEED_MEDIA_RATIO_CLASS,
            )}
          >
            {shownMediaSrc ? (
              <img
                src={shownMediaSrc}
                loading="lazy"
                decoding="async"
                onError={() => setFailedMediaSrc(shownMediaSrc)}
                alt={
                  revealed
                    ? localizeUi("ui.noodle.post.imageBy", {
                        name: profile.displayName,
                      })
                    : localizeUi("ui.noodle.lockednoodlerpostcard.lockedImageFrom", { name: profile.displayName })
                }
                className={cn(
                  "h-full w-full object-cover",
                  // Locked images are reduced and lightly blurred on the server. Keep the client
                  // treatment limited to a small color adjustment so the silhouette stays clear.
                  revealed ? "scale-100" : "saturate-[0.88]",
                )}
              />
            ) : requestedMediaUrl ? (
              <div
                className="absolute inset-0 animate-pulse bg-[var(--muted)] motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_50%_35%,var(--noodle-accent)_0%,transparent_65%)] px-6 text-center">
                <span className="rounded-full bg-black/25 p-3 text-[var(--noodle-accent)] ring-1 ring-white/10">
                  <ImageIcon size={22} aria-hidden="true" />
                </span>
                <span className="text-xs font-semibold text-[var(--muted-foreground)]">
                  {localizeUi("ui.slurp.locked.previewUnavailable")}
                </span>
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
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(8,4,10,0.9)_0%,rgba(8,4,10,0.52)_38%,rgba(8,4,10,0.16)_76%)]"
                aria-hidden="true"
              />
            )}
            {!revealed && shownMediaSrc && <SlurpSparkleVeil className={transaction ? "opacity-100" : ""} />}
            {postImages.length > 1 && (
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
              <span className="pointer-events-none absolute inset-x-0 top-[36%] flex justify-center" aria-hidden="true">
                <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#24131f] text-[var(--noodle-accent)] shadow-[0_12px_28px_-14px_rgba(0,0,0,0.95),inset_0_0_0_1px_rgba(255,111,174,0.18)]">
                  <Lock size={27} strokeWidth={2.4} />
                </span>
              </span>
            )}
            {!revealed && !controllerOnly && (
              <div className="absolute inset-x-4 top-[calc(36%+4.75rem)] flex flex-col items-center gap-2">
                <button
                  type="button"
                  disabled={unlockPending || subscriptionPending}
                  onClick={() => setUnlockSheetOpen(true)}
                  className="pointer-events-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--noodle-accent)] px-7 text-sm font-black text-zinc-950 shadow-[0_14px_34px_-16px_var(--noodle-accent)] transition-[opacity,transform] hover:opacity-90 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black motion-reduce:transition-none motion-reduce:active:scale-100 disabled:opacity-50 [&_svg]:!text-zinc-950"
                >
                  <Eye size={16} strokeWidth={2.4} aria-hidden="true" />
                  {localizeUi("ui.noodle.lockednoodlerpostcard.unlock")}
                  <SlpCreatorFictionalPrice amount={slpCreatorUnlockPriceOf(post)} />
                </button>
                <span className="text-[0.68rem] font-semibold text-white/72 drop-shadow-sm">
                  {localizeUi("ui.slurp.locked.includedForSubscribers", {
                    defaultValue: "Included for subscribers",
                  })}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Title */}
        {(() => {
          // The demo's real title is a punchline; showing it while locked spoils the reveal.
          const title = demo && !revealed ? (demo.lockedTitle ?? post.title) : post.title;
          return title && <h3 className="mt-3 text-lg font-bold leading-snug">{title}</h3>;
        })()}

        {/* Body: a short teaser until unlocked; the private copy is never reconstructed client-side. */}
        {revealed && demo ? (
          <p className="mt-3 whitespace-pre-line text-sm leading-6">{demo.body}</p>
        ) : (
          !controllerOnly && (
            <p className="mt-3 text-sm text-[var(--muted-foreground)]">
              {localizeUi("ui.slurp.locked.teaser", { defaultValue: "A little something from tonight…" })}
            </p>
          )
        )}

        {/* CTA */}
        {controllerOnly ? (
          <p className="mt-3 text-xs text-[var(--muted-foreground)]">
            {localizeUi("ui.noodle.lockednoodlerpostcard.openTheControllerToolsToManageThisPost")}
          </p>
        ) : null}

        {/* Footer */}
        <div className="mt-5 flex items-center gap-4 border-t border-[var(--noodle-divider)] pt-4 text-sm tabular-nums text-[var(--muted-foreground)]">
          {/* The icons are decorative, so the counts carry their own labels for screen readers. */}
          <span className="flex items-center gap-1.5">
            <Heart size={18} aria-hidden="true" /> {likeCount}
            <span className="sr-only">{localizeUi("ui.noodle.noodlehome.likes")}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <MessageCircle size={18} aria-hidden="true" /> {replyCount}
            <span className="sr-only">{localizeUi("ui.noodle.noodlehome.replies")}</span>
          </span>
        </div>
      </div>
      <Modal
        open={unlockSheetOpen}
        onClose={() => !transaction && setUnlockSheetOpen(false)}
        title={localizeUi("ui.noodle.unlocksheet.title")}
        width="max-w-xl"
        closeDisabled={transaction !== null}
        panelStyle={{
          "--background": "var(--slurp-surface)",
          "--foreground": "var(--slurp-text)",
          "--muted-foreground": "var(--slurp-muted)",
          "--border": "color-mix(in srgb, var(--noodle-accent) 28%, transparent)",
          "--accent": "color-mix(in srgb, var(--noodle-accent) 14%, transparent)",
        }}
      >
        <div data-component="SlurpHome.UnlockSheet" className="relative isolate overflow-hidden px-1 pb-1">
          {transaction && <SlurpSparkleVeil className="z-20 opacity-80" />}
          <div className="mb-4 grid gap-3 rounded-2xl bg-[linear-gradient(115deg,color-mix(in_srgb,var(--noodle-accent)_10%,var(--slurp-surface-raised)),color-mix(in_srgb,var(--slurp-violet)_8%,var(--slurp-surface)))] p-3 ring-1 ring-inset ring-white/[0.07] sm:grid-cols-[minmax(0,1fr)_9rem]">
            <div className="flex min-w-0 items-center gap-3">
              <span className="relative">
                <ProfileInitial profile={profile} />
                <SlurpCelebrationRing active={transaction !== null} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-black">{profile.displayName}</span>
                <span className="block truncate text-xs text-[var(--muted-foreground)]">@{profile.handle}</span>
                <span className="mt-1 block text-xs leading-5 text-[var(--muted-foreground)]">
                  {localizeUi("ui.slurp.unlocksheet.fromCreator", {
                    defaultValue: "See the full post from {{name}}.",
                    name: profile.displayName,
                  })}
                </span>
              </span>
            </div>
            {shownMediaSrc && (
              <span className="relative hidden aspect-[16/10] overflow-hidden rounded-xl outline outline-1 -outline-offset-1 outline-white/10 sm:block">
                <img
                  src={shownMediaSrc}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover saturate-[0.82]"
                />
                <span className="absolute inset-0 bg-black/35" />
                <span className="absolute inset-0 flex items-center justify-center text-white">
                  <Lock size={19} strokeWidth={2.25} aria-hidden="true" />
                </span>
              </span>
            )}
          </div>
          <div className="grid gap-3">
            <button
              type="button"
              data-noodler-unlock-action="post"
              disabled={unlockPending || transaction !== null}
              onClick={() => void runTransaction("unlock")}
              className="relative flex min-h-[4.75rem] w-full items-center gap-3 overflow-visible rounded-2xl bg-[var(--slurp-surface-raised)] px-4 py-3 text-left shadow-[var(--slurp-shadow-raised)] ring-1 ring-inset ring-white/[0.07] transition-[background-color,transform,box-shadow] hover:bg-[color-mix(in_srgb,var(--noodle-accent)_7%,var(--slurp-surface-raised))] hover:shadow-[var(--slurp-shadow-floating)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100"
            >
              <SlurpCoinBurst active={transaction === "unlock"} />
              {transaction === "unlock" ? (
                <Loader2
                  size={20}
                  className="shrink-0 animate-spin text-[var(--noodle-accent)] motion-reduce:animate-none"
                />
              ) : (
                <Eye size={20} className="shrink-0 text-[var(--noodle-accent)]" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-black">
                  {localizeUi("ui.slurp.unlocksheet.unlockOnce", { defaultValue: "Unlock once" })}
                </span>
                <span className="block text-xs text-[var(--muted-foreground)]">
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
              onClick={() => void runTransaction("subscribe")}
              className="relative flex min-h-[5.25rem] w-full items-center gap-3 overflow-visible rounded-2xl bg-[linear-gradient(115deg,color-mix(in_srgb,var(--slurp-coral)_22%,var(--slurp-surface-raised)),color-mix(in_srgb,var(--slurp-violet)_20%,var(--slurp-surface-raised)))] px-4 py-3 text-left shadow-[0_18px_42px_-30px_var(--noodle-accent)] ring-1 ring-inset ring-[var(--noodle-accent)]/55 transition-[filter,transform,box-shadow] hover:brightness-110 hover:shadow-[0_22px_48px_-28px_var(--noodle-accent)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100"
            >
              <SlurpCoinBurst active={transaction === "subscribe"} />
              {transaction === "subscribe" ? (
                <Loader2
                  size={20}
                  className="shrink-0 animate-spin text-[var(--noodle-accent)] motion-reduce:animate-none"
                />
              ) : (
                <Bell size={20} className="shrink-0 text-[var(--noodle-accent)]" />
              )}
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-black">{localizeUi("ui.noodle.unlocksheet.subscribe")}</span>
                  <span className="rounded-full bg-black/20 px-2 py-0.5 text-[0.62rem] font-black uppercase tracking-[0.08em] text-amber-200 ring-1 ring-inset ring-amber-200/40">
                    {localizeUi("ui.slurp.unlocksheet.bestValue", { defaultValue: "Best value" })}
                  </span>
                </span>
                <span className="block text-xs text-[var(--muted-foreground)]">
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
          </div>
          <p className="mt-4 text-center text-[0.68rem] text-[var(--muted-foreground)]">
            {localizeUi("ui.slurp.unlocksheet.reassurance", {
              defaultValue: "Fictional SlurpCoins · Cancel anytime",
            })}
          </p>
        </div>
      </Modal>
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

function SlpCreatorFictionalPrice({ amount, suffix }: { amount?: number | null; suffix?: string }) {
  const { t: localizeUi } = useUiTranslation();
  if (typeof amount !== "number" || amount < 0) return null;
  return (
    <span
      title={localizeUi("ui.noodle.unlocksheet.priceHint")}
      className="inline-flex shrink-0 cursor-help items-center gap-1.5 rounded-full bg-[#24131f] px-2.5 py-1 text-sm font-black text-amber-200 shadow-[0_2px_10px_rgba(0,0,0,0.28)] ring-1 ring-inset ring-amber-200/35"
    >
      <span>{localizeUi("ui.noodle.unlocksheet.price", { amount })}</span>
      <SlurpCoin size={15} />
      {suffix && <span className="text-[0.65rem] font-bold text-[var(--muted-foreground)]">{suffix}</span>}
    </span>
  );
}
