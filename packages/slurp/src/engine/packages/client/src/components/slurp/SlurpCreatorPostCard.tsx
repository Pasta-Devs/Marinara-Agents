// ──────────────────────────────────────────────
// Slurp post card — the membership-style, media-forward variant of the post card
// used by the Slurp creator feed. Shares all leaf helpers, the ctx contract,
// and the reply/edit/poll machinery's building blocks with NoodlePostCard; only the
// layout (two-line header, filled access pill, full-width body, image-on-top) differs.
// The public Noodle feed keeps the original NoodlePostCard.
// ──────────────────────────────────────────────
import {
  AtSign,
  Bell,
  Eye,
  Heart,
  Image as ImageIcon,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Repeat2,
  RefreshCw,
  Share2,
  Smile,
  Trash2,
  Lock,
  Loader2,
  X,
} from "lucide-react";
import { Fragment, useMemo, useRef, useState } from "react";
import {
  canManageNoodleReply,
  noodlePollInputSchema,
  readNoodlePollFromMetadata,
  readNoodlePostImageCrop,
  type NoodleAccount,
  type NoodleInteraction,
  type NoodlerPostView,
  type NoodlerStageProfile,
} from "@marinara-engine/shared";
import { cn } from "../../lib/utils";
import { api } from "../../lib/api-client";
import { toast } from "sonner";
import { ConversationMediaPickerPanel } from "../chat/ConversationMediaPickerPanel";
import type { ChatImage } from "../../hooks/use-gallery";
import { useNearViewportSlurpMediaSrc } from "../../hooks/use-slurp-media-src";
import { Modal } from "../ui/Modal";
import { Avatar, ProfileInitial } from "./SlurpShell";
import { formatTime } from "./SlurpDateTime";
import { useTranslation as useUiTranslation } from "react-i18next";
import {
  countInteractions,
  createNoodleLightboxImage,
  fieldClass,
  labelClass,
  noodleCommentActionClass,
  noodleIconButtonClass,
  NOODLE_MEDIA_PICKER_TABS,
  NOODLE_TEXT_MEDIA_PICKER_TABS,
  NoodleMentionSuggestions,
  NoodlePollCard,
  NoodleTextContent,
  NoodleToolButton,
  SlurpToolPopover,
  PostImageEditControls,
  textareaClass,
  type NoodlePostCardCtx,
  type NoodlePostCardModel,
} from "./SlurpPostCard";
import { NoodleAnchoredPopover } from "./NoodleAnchoredPopover";
import { SlurpLikedBy } from "./SlurpFanCard";
import { NoodlePollComposer } from "./SlurpPollComposer";
import { PostImageFrame } from "./PostImageCropEditor";
import { SlurpCelebrationRing, SlurpSparkleVeil } from "./SlurpSparkleVeil";
import { SlurpCoin, SlurpCoinBurst } from "./SlurpCoin";

const SLURP_FEED_MEDIA_RATIO_CLASS = "aspect-[4/3] sm:aspect-[16/10]";

export function LockedSlurpPostCard({
  post,
  profile,
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
  post: Pick<NoodlerPostView, "id" | "access" | "createdAt" | "title" | "imageUrl"> &
    Partial<Pick<NoodlerPostView, "likeCount" | "replyCount" | "hasImage" | "imagePrompt">>; // controller-locked managed posts carry no counts
  profile: NoodlerStageProfile;
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
  const likeCount = post.likeCount ?? 0;
  const replyCount = post.replyCount ?? 0;
  const openProfile = onOpenProfile ? () => onOpenProfile(profile.id) : undefined;
  const revealed = Boolean(demo && demoUnlocked);
  // A locked post's URL resolves to a server-blurred teaser, not the original bytes. Where no
  // teaser can be built the server sends nothing and only the frame renders.
  const requestedMediaUrl = (revealed && demo?.unlockedImageUrl) || post.imageUrl || null;
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
                  <NoodlerFictionalPrice amount={noodlerUnlockPriceOf(post)} />
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
                  {noodlerUnlockCountOf(post) === 1
                    ? localizeUi("ui.slurp.unlocksheet.unlockedByOne", { defaultValue: "Unlocked by 1 fan" })
                    : noodlerUnlockCountOf(post) > 1
                      ? localizeUi("ui.slurp.unlocksheet.unlockedBy", {
                          defaultValue: "Unlocked by {{count}} fans",
                          count: noodlerUnlockCountOf(post),
                        })
                      : localizeUi("ui.noodle.unlocksheet.unlockThisPostDetail")}
                </span>
              </span>
              <NoodlerFictionalPrice amount={noodlerUnlockPriceOf(post)} />
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
              <NoodlerFictionalPrice
                amount={noodlerSubscriptionPriceOf(profile)}
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
const NOODLER_DEFAULT_UNLOCK_PRICE = 1;
const NOODLER_DEFAULT_SUBSCRIPTION_PRICE = 5;

/** The server sends these alongside the shared view types, which have no price fields. */
function noodlerUnlockPriceOf(post: unknown): number {
  const price = (post as { unlockPrice?: unknown } | null)?.unlockPrice;
  return typeof price === "number" && price >= 0 ? price : NOODLER_DEFAULT_UNLOCK_PRICE;
}

/** Social proof on the paywall. Absent or zero on a post nobody has paid for yet. */
function noodlerUnlockCountOf(post: unknown): number {
  const count = (post as { unlockCount?: unknown } | null)?.unlockCount;
  return typeof count === "number" && count > 0 ? count : 0;
}

function noodlerSubscriptionPriceOf(profile: unknown): number {
  const price = (profile as { subscriptionPrice?: unknown } | null)?.subscriptionPrice;
  return typeof price === "number" && price >= 0 ? price : NOODLER_DEFAULT_SUBSCRIPTION_PRICE;
}

function NoodlerFictionalPrice({ amount, suffix }: { amount: number; suffix?: string }) {
  const { t: localizeUi } = useUiTranslation();
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

export function SlurpCreatorPostCard({
  post,
  ctx,
  surface = "feed",
}: {
  post: NoodlePostCardModel;
  ctx: NoodlePostCardCtx;
  surface?: "feed" | "profile";
}) {
  const { t: localizeUi, i18n } = useUiTranslation();
  const {
    personaAccount,
    editingPostId,
    editingPostContent,
    setEditingPostContent,
    replyPostId,
    replyParentInteractionId,
    replyText,
    replyHasText,
    setReplyText,
    activeReplyComposerTool,
    setActiveReplyComposerTool,
    highlightedInteractionId,
    mediaPickerTab,
    setMediaPickerTab,
    replyComposerRef,
    replyValueRef,
    replyMediaToolRef,
    startEditingPost,
    deleteNoodlePost,
    cancelEditingPost,
    saveEditedPost,
    reactToPost,
    reactToReply,
    openReplyComposer,
    handleReplyChange,
    clearReplyComposer,
    submitReply,
    appendToReply,
    reactionPendingFor,
    createInteractionPendingFor,
    updatePostPending,
    titleEditing,
    media,
    replyManagement,
    mentions,
  } = ctx;
  const accountById = ctx.accountById ?? new Map<string, NoodleAccount>();
  const accountByHandle = ctx.accountByHandle ?? new Map<string, NoodleAccount>();
  const authorAccount = accountById.get(post.authorAccountId) ?? null;
  const author = authorAccount ?? post.authorSnapshot;
  // Card-owned defaults for absent capability groups. Hosts pass only the capabilities they
  // support (NoodleR omits media/replyManagement/mentions/poll/profile); the card fills the
  // rest with no-ops and empty state, and gates the corresponding UI on group presence — so
  // no host has to hand over discarded setters, dangling refs, or fake mutations. Annotations
  // keep the () => {} fallbacks callable with their real signatures.
  const fallbackDivRef = useRef<HTMLDivElement | null>(null);
  const fallbackFileRef = useRef<HTMLInputElement | null>(null);
  const openProfile: (account: NoodleAccount | null) => void = ctx.openProfile ?? (() => {});
  const canOpenAuthorProfile = Boolean(authorAccount || ctx.openAuthorProfile);
  const openPostAuthor = () => {
    if (authorAccount) openProfile(authorAccount);
    else ctx.openAuthorProfile?.(post.authorAccountId);
  };
  const handleReplyKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void =
    ctx.handleReplyKeyDown ?? (() => {});
  const voteInPoll: (post: NoodlePostCardModel, optionId: string, selectedOptionId: string | null) => void =
    ctx.voteInPoll ?? (() => {});
  const disableReplyImage = !media;
  const setImageLightbox: React.Dispatch<React.SetStateAction<ChatImage | null>> =
    ctx.setImageLightbox ?? media?.setImageLightbox ?? (() => {});
  const replyImageUrl = media?.replyImageUrl ?? "";
  const setReplyImageUrl: React.Dispatch<React.SetStateAction<string>> = media?.setReplyImageUrl ?? (() => {});
  const replyImageUrlDraft = media?.replyImageUrlDraft ?? "";
  const setReplyImageUrlDraft: React.Dispatch<React.SetStateAction<string>> =
    media?.setReplyImageUrlDraft ?? (() => {});
  const replyImageToolRef = media?.replyImageToolRef ?? fallbackDivRef;
  const replyImageFileRef = media?.replyImageFileRef ?? fallbackFileRef;
  const applyReplyImageUrl: () => void = media?.applyReplyImageUrl ?? (() => {});
  const uploadGlobalImages = media?.uploadGlobalImages ?? { isPending: false };
  const editingReplyId = replyManagement?.editingReplyId ?? null;
  const editingReplyContent = replyManagement?.editingReplyContent ?? "";
  const setEditingReplyContent: React.Dispatch<React.SetStateAction<string>> =
    replyManagement?.setEditingReplyContent ?? (() => {});
  const startEditingReply: (reply: NoodleInteraction) => void = replyManagement?.startEditingReply ?? (() => {});
  const cancelEditingReply: () => void = replyManagement?.cancelEditingReply ?? (() => {});
  const saveEditedReply: (post: NoodlePostCardModel, reply: NoodleInteraction) => void =
    replyManagement?.saveEditedReply ?? (() => {});
  const deleteNoodleReply: (post: NoodlePostCardModel, reply: NoodleInteraction) => void =
    replyManagement?.deleteNoodleReply ?? (() => {});
  const updateInteraction = replyManagement?.updateInteraction ?? {
    isPending: false,
  };
  const deleteInteraction = replyManagement?.deleteInteraction ?? {
    isPending: false,
  };
  const canManageReplyOverride = replyManagement?.canManageReply;
  const activeReplyMention = mentions?.activeReplyMention ?? null;
  const activeReplyMentionIndex = mentions?.activeReplyMentionIndex ?? 0;
  const replyMentionSuggestions = mentions?.replyMentionSuggestions ?? [];
  const selectReplyMention: (account: NoodleAccount) => void = mentions?.selectReplyMention ?? (() => {});

  const { imageEditing, pollEditing } = ctx;
  const isEditingPost = Boolean(ctx.postManagement) && editingPostId === post.id;
  const imageCrop = readNoodlePostImageCrop(post.metadata);
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const {
    src: postImageSrc,
    observe: observePostImage,
    loading: postImageLoading,
  } = useNearViewportSlurpMediaSrc(post.imageUrl, { width: 960 });
  const displayedImageUrl = postImageSrc && postImageSrc !== failedImageUrl ? postImageSrc : null;
  const imageGenerationPending = ctx.generatingPostImageId === post.id;
  const postMenuOpen = ctx.postMenuId === post.id;
  // Distinct from displayedImageUrl: while postImageSrc is still resolving (the authenticated
  // fetch hasn't returned yet) there is no evidence the image is broken, so editing must not
  // drop it. Only a confirmed <img> render failure (postImageSrc resolved and then errored,
  // recorded in failedImageUrl) strips the image from what gets edited/saved.
  const editablePost =
    post.imageUrl && (postImageSrc === null || postImageSrc !== failedImageUrl) ? post : { ...post, imageUrl: null };
  const postInteractions = post.interactions;
  const rootPostInteractions = postInteractions.filter((interaction) => !interaction.parentInteractionId);
  const poll = readNoodlePollFromMetadata(post.metadata);
  const postKind = post.imageUrl ? "media" : poll ? "poll" : "text";
  const pollVotes = poll
    ? rootPostInteractions.filter(
        (interaction) =>
          interaction.type === "vote" && poll.options.some((option) => option.id === interaction.content),
      )
    : [];
  const personaPollVote = personaAccount
    ? (pollVotes.find((interaction) => interaction.actorAccountId === personaAccount.id)?.content ?? null)
    : null;
  const likedByPersona = personaAccount
    ? rootPostInteractions.some(
        (interaction) => interaction.type === "like" && interaction.actorAccountId === personaAccount.id,
      )
    : false;
  const repostedByPersona = personaAccount
    ? rootPostInteractions.some(
        (interaction) => interaction.type === "repost" && interaction.actorAccountId === personaAccount.id,
      )
    : false;
  const { replies, replyById, orderedReplies, replyLikesByParentId } = useMemo(() => {
    const nextReplies = postInteractions.filter((interaction) => interaction.type === "reply");
    const nextReplyById = new Map(nextReplies.map((reply) => [reply.id, reply]));
    const childrenByParentId = new Map<string, NoodleInteraction[]>();
    const nextReplyLikesByParentId = new Map<string, NoodleInteraction[]>();
    for (const interaction of postInteractions) {
      if (interaction.type === "reply" && interaction.parentInteractionId) {
        const children = childrenByParentId.get(interaction.parentInteractionId) ?? [];
        children.push(interaction);
        childrenByParentId.set(interaction.parentInteractionId, children);
      }
      if (interaction.type === "like" && interaction.parentInteractionId) {
        const likes = nextReplyLikesByParentId.get(interaction.parentInteractionId) ?? [];
        likes.push(interaction);
        nextReplyLikesByParentId.set(interaction.parentInteractionId, likes);
      }
    }
    const nextOrderedReplies: NoodleInteraction[] = [];
    const visitedReplyIds = new Set<string>();
    const appendReplyBranch = (reply: NoodleInteraction) => {
      if (visitedReplyIds.has(reply.id)) return;
      visitedReplyIds.add(reply.id);
      nextOrderedReplies.push(reply);
      for (const child of childrenByParentId.get(reply.id) ?? []) appendReplyBranch(child);
    };
    for (const reply of nextReplies) {
      if (!reply.parentInteractionId || !nextReplyById.has(reply.parentInteractionId)) appendReplyBranch(reply);
    }
    for (const reply of nextReplies) appendReplyBranch(reply);
    return {
      replies: nextReplies,
      replyById: nextReplyById,
      orderedReplies: nextOrderedReplies,
      replyLikesByParentId: nextReplyLikesByParentId,
    };
  }, [postInteractions]);
  const replyTarget = replyParentInteractionId ? (replyById.get(replyParentInteractionId) ?? null) : null;
  const replyTargetActor = replyTarget
    ? (accountById.get(replyTarget.actorAccountId) ?? replyTarget.actorSnapshot)
    : author;
  const postLikePending = reactionPendingFor(post.id, "like");
  const postRepostPending = reactionPendingFor(post.id, "repost");
  const postReplyPending = createInteractionPendingFor(post.id, "reply", replyParentInteractionId);
  const pollVotePending = createInteractionPendingFor(post.id, "vote");
  const editingExistingPoll = Boolean(poll && pollEditing);
  const editingPollIsValid = !editingExistingPoll || noodlePollInputSchema.safeParse(pollEditing?.value).success;
  const saveEditDisabled =
    (!editingPostContent.trim() && !(ctx.allowPollOnlyEdits && editingPollIsValid && editingExistingPoll)) ||
    !editingPollIsValid ||
    updatePostPending ||
    Boolean(imageEditing?.loading) ||
    Boolean(imageEditing?.cropSource);
  const postEditActions = (
    <>
      <button
        type="button"
        onClick={cancelEditingPost}
        className="h-8 rounded-full border border-[var(--noodle-divider)] px-4 text-xs font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--accent)]"
      >
        {localizeUi("chat.delete.dialog.cancel")}
      </button>
      <button
        type="button"
        onClick={() => saveEditedPost(post)}
        disabled={saveEditDisabled}
        className="h-8 rounded-full bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {updatePostPending ? localizeUi("ui.noodle.noodlehome.saving") : localizeUi("ui.noodle.noodlehome.save")}
      </button>
    </>
  );
  const renderReplyComposer = (nested: boolean) => (
    <div
      data-component="NoodleView.ReplyComposer"
      data-noodle-reply-parent-id={replyParentInteractionId ?? ""}
      className={cn("border-[var(--noodle-divider)] py-3", nested ? "ml-10 border-b" : "mt-3 border-y")}
    >
      {replyParentInteractionId && replyTargetActor && (
        <p className="mb-2 text-xs text-[var(--muted-foreground)]">
          {localizeUi("ui.noodle.noodlepostcard.replyingTo")}{" "}
          <span className="font-semibold text-[var(--noodle-accent)]">@{replyTargetActor.handle}</span>
        </p>
      )}
      <textarea
        ref={replyComposerRef}
        defaultValue={replyText}
        onChange={handleReplyChange}
        onBlur={() => setReplyText(replyValueRef.current)}
        onKeyDown={handleReplyKeyDown}
        className={cn(textareaClass, "min-h-16 resize-none bg-transparent")}
        placeholder={localizeUi("ui.noodle.noodlepostcard.leaveAComment")}
        aria-autocomplete="list"
        aria-controls={activeReplyMention ? "noodle-reply-mention-list" : undefined}
        aria-expanded={Boolean(activeReplyMention)}
        aria-activedescendant={
          activeReplyMention && replyMentionSuggestions.length > 0
            ? `noodle-reply-mention-list-option-${Math.min(
                activeReplyMentionIndex,
                replyMentionSuggestions.length - 1,
              )}`
            : undefined
        }
      />
      <NoodleMentionSuggestions
        activeMention={activeReplyMention}
        activeIndex={activeReplyMentionIndex}
        accounts={replyMentionSuggestions}
        listboxId="noodle-reply-mention-list"
        onSelect={selectReplyMention}
      />
      {replyImageUrl && (
        <div className="relative mt-2 overflow-hidden rounded-xl border border-[var(--noodle-divider)]">
          <button
            type="button"
            onClick={() => setImageLightbox(createNoodleLightboxImage(`reply-draft-${post.id}`, replyImageUrl))}
            className="block w-full"
            title={localizeUi("ui.noodle.noodlepostcard.openAttachedImage")}
          >
            <img
              src={replyImageUrl}
              alt={localizeUi("ui.noodle.noodlepostcard.attachedReplyPreview")}
              className="max-h-52 w-full object-cover"
            />
          </button>
          <button
            type="button"
            onClick={() => setReplyImageUrl("")}
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-white [&_svg]:!text-white transition-colors hover:bg-black/80"
            title={localizeUi("ui.noodle.noodlehome.removeImage")}
            aria-label={localizeUi("ui.noodle.noodlepostcard.removeReplyImage")}
          >
            <X size={14} />
          </button>
        </div>
      )}
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {!disableReplyImage && (
            <div ref={replyImageToolRef} className="relative">
              <NoodleToolButton
                title={localizeUi("ui.noodle.noodlehome.attachImage")}
                active={activeReplyComposerTool === "image"}
                onClick={() => setActiveReplyComposerTool((current) => (current === "image" ? null : "image"))}
              >
                <ImageIcon size={17} />
              </NoodleToolButton>
            </div>
          )}
          <div ref={replyMediaToolRef} className="relative">
            <NoodleToolButton
              title={localizeUi("ui.noodle.noodlehome.emojiGifsAndStickers")}
              active={activeReplyComposerTool === "media"}
              onClick={() => setActiveReplyComposerTool((current) => (current === "media" ? null : "media"))}
            >
              <Smile size={17} />
            </NoodleToolButton>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={clearReplyComposer}
            className="h-8 rounded-full px-3 text-xs font-semibold text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
          >
            {localizeUi("chat.delete.dialog.cancel")}
          </button>
          <button
            type="button"
            className="h-8 rounded-full bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={(!replyHasText && !replyImageUrl.trim()) || postReplyPending}
            onClick={() => submitReply(post)}
          >
            {postReplyPending
              ? localizeUi("ui.noodle.noodlepostcard.replying")
              : localizeUi("ui.noodle.noodlepostcard.reply")}
          </button>
        </div>
      </div>
      {!disableReplyImage && activeReplyComposerTool === "image" && (
        <SlurpToolPopover
          title={localizeUi("ui.noodle.noodlehome.attachImage")}
          anchorRef={replyImageToolRef}
          onClose={() => setActiveReplyComposerTool(null)}
          wide
        >
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => replyImageFileRef.current?.click()}
              disabled={uploadGlobalImages.isPending}
              className="h-9 w-full rounded-full bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploadGlobalImages.isPending
                ? localizeUi("ui.noodle.noodleprofilesurface.uploading")
                : localizeUi("ui.noodle.noodlehome.uploadFromDevice")}
            </button>
            <div
              data-component="NoodleView.ReplyImageDivider"
              className="flex items-center gap-2 text-[0.625rem] font-semibold uppercase tracking-normal text-[var(--noodle-accent)]"
            >
              <span className="h-px flex-1 bg-[var(--noodle-divider)]" />
              {localizeUi("ui.noodle.noodlehome.or")}
              <span className="h-px flex-1 bg-[var(--noodle-divider)]" />
            </div>
            <label className="block space-y-1.5">
              <span className={labelClass}>{localizeUi("ui.noodle.noodlehome.imageUrl")}</span>
              <input
                value={replyImageUrlDraft}
                onChange={(event) => setReplyImageUrlDraft(event.target.value)}
                placeholder={localizeUi("ui.noodle.noodlehome.https")}
                className={fieldClass}
              />
            </label>
            <button
              type="button"
              onClick={applyReplyImageUrl}
              className="h-9 w-full rounded-full border border-[var(--noodle-divider)] px-4 text-xs font-bold text-[var(--noodle-accent)] transition-colors hover:bg-[var(--noodle-accent)]/10"
            >
              {localizeUi("ui.noodle.noodlehome.attachUrl")}
            </button>
          </div>
        </SlurpToolPopover>
      )}
      {activeReplyComposerTool === "media" && (
        <NoodleAnchoredPopover anchorRef={replyMediaToolRef} wide>
          <ConversationMediaPickerPanel
            tabs={disableReplyImage ? NOODLE_TEXT_MEDIA_PICKER_TABS : NOODLE_MEDIA_PICKER_TABS}
            activeTab={mediaPickerTab}
            onActiveTabChange={setMediaPickerTab}
            onClose={() => setActiveReplyComposerTool(null)}
            onEmojiSelect={appendToReply}
            onGifSelect={(gifUrl) => {
              setReplyImageUrl(gifUrl);
              setActiveReplyComposerTool(null);
            }}
            onStickerSelect={(name) => {
              appendToReply(`sticker:${name}:`);
              setActiveReplyComposerTool(null);
            }}
            className="w-full !border-[var(--marinara-chat-chrome-panel-border)] !bg-[var(--background)] !text-[var(--foreground)] shadow-2xl shadow-black/35"
          />
        </NoodleAnchoredPopover>
      )}
    </div>
  );
  return (
    <article
      key={post.id}
      data-noodle-post-id={post.id}
      data-slurp-post-kind={postKind}
      tabIndex={-1}
      className={cn(
        surface === "profile"
          ? "border-b border-[var(--noodle-divider)] px-4 py-5 transition-colors last:border-b-0 hover:bg-[var(--accent)]/20"
          : "rounded-xl bg-[var(--slurp-surface)] px-4 py-5 shadow-[0_1px_0_var(--noodle-divider),0_20px_42px_-36px_rgba(0,0,0,0.95)] ring-1 ring-inset ring-[var(--noodle-divider)] transition-[background-color,box-shadow] hover:bg-[var(--slurp-surface-raised)] hover:shadow-[0_1px_0_color-mix(in_srgb,var(--noodle-accent)_30%,transparent),0_24px_46px_-32px_rgba(0,0,0,0.95)] motion-reduce:transition-none",
        surface !== "profile" &&
          postKind === "poll" &&
          "bg-[linear-gradient(145deg,var(--slurp-surface),color-mix(in_srgb,var(--noodle-accent)_5%,var(--slurp-surface)))]",
      )}
    >
      <div className="flex gap-3">
        {author ? (
          <button
            type="button"
            onClick={openPostAuthor}
            disabled={!canOpenAuthorProfile}
            className="h-fit rounded-full text-left transition-opacity enabled:hover:opacity-80 disabled:cursor-default"
            title={
              canOpenAuthorProfile
                ? localizeUi("ui.noodle.noodlehome.viewValue1", {
                    value1: author.handle,
                  })
                : undefined
            }
          >
            <Avatar account={author} />
          </button>
        ) : (
          <AtSign size={28} className="text-[var(--noodle-accent)]" />
        )}
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <button
                type="button"
                onClick={openPostAuthor}
                disabled={!canOpenAuthorProfile}
                className="rounded-lg font-semibold transition-colors enabled:hover:text-[var(--noodle-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] disabled:cursor-default"
              >
                {author?.displayName ?? localizeUi("ui.slurp.profile.fallbackUser")}
              </button>
              {/* Locked cards reach this component only after access is granted; pre-unlock teasers use LockedSlurpPostCard. */}
              <span
                title={localizeUi(
                  post.access === "locked" ? "ui.noodle.postaccess.unlocked.hint" : "ui.noodle.postaccess.public.hint",
                )}
                className={cn(
                  "rounded-lg px-2 py-1 text-[0.68rem] font-bold ring-1 ring-inset",
                  post.access === "locked"
                    ? "bg-[var(--noodle-accent)]/15 text-[var(--noodle-accent)] ring-[var(--noodle-accent)]/25"
                    : "bg-[var(--accent)] text-[var(--muted-foreground)] ring-[var(--noodle-divider)]",
                )}
              >
                {localizeUi(post.access === "locked" ? "ui.noodle.postaccess.unlocked" : "ui.noodle.postaccess.public")}
              </span>
            </div>
            <p className="text-xs font-medium !text-[var(--noodle-accent-foreground)]">
              @{author?.handle ?? localizeUi("ui.slurp.profile.fallbackHandle")} ·{" "}
              {formatTime(post.createdAt, i18n.language)}
            </p>
          </div>
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => ctx.setPostMenuId((current) => (current === post.id ? null : post.id))}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--noodle-accent)] transition-colors hover:bg-[var(--noodle-accent)]/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
              title={localizeUi("ui.noodle.noodlepostcard.postActions")}
              aria-label={localizeUi("ui.noodle.noodlepostcard.postActions")}
              aria-expanded={postMenuOpen}
            >
              <MoreHorizontal size={18} />
            </button>
            {postMenuOpen && (
              <div className="absolute end-0 top-[calc(100%+0.25rem)] z-30 min-w-40 overflow-hidden rounded-lg border border-[var(--noodle-divider)] bg-[var(--background)] py-1 text-xs shadow-2xl shadow-black/30">
                {ctx.postManagement && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        ctx.setPostMenuId(null);
                        startEditingPost(editablePost);
                      }}
                      className="flex min-h-10 w-full items-center gap-2 px-3 text-start transition-colors hover:bg-[var(--accent)]"
                    >
                      <Pencil size={14} />
                      {localizeUi("ui.noodle.noodlepostcard.edit")}
                    </button>
                    {ctx.generatePostImage && (post.imagePrompt || post.imageUrl) && (
                      <button
                        type="button"
                        onClick={() => {
                          ctx.setPostMenuId(null);
                          ctx.generatePostImage?.(post);
                        }}
                        disabled={imageGenerationPending}
                        className="flex min-h-10 w-full items-center gap-2 px-3 text-start transition-colors hover:bg-[var(--accent)] disabled:opacity-50"
                      >
                        <RefreshCw
                          size={14}
                          className={imageGenerationPending ? "animate-spin motion-reduce:animate-none" : ""}
                        />
                        {localizeUi("ui.slurp.image.generate")}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        ctx.setPostMenuId(null);
                        deleteNoodlePost(post);
                      }}
                      className="flex min-h-10 w-full items-center gap-2 px-3 text-start text-[var(--slurp-danger)] transition-colors hover:bg-[var(--slurp-danger)]/10 [&_svg]:!text-[var(--slurp-danger)]"
                    >
                      <Trash2 size={14} />
                      {localizeUi("lorebook.editor.batch.delete")}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => {
                    ctx.setPostMenuId(null);
                    const persona = ctx.personaAccount?.entityId;
                    void api
                      .download(
                        `/slurp/noodler/posts/${encodeURIComponent(post.id)}/share-card${persona ? `?personaId=${encodeURIComponent(persona)}` : ""}`,
                        `slurp-${post.id}.png`,
                      )
                      .catch((error: unknown) =>
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : localizeUi("ui.slurp.post.shareFailed", {
                                defaultValue: "Could not build the share image.",
                              }),
                        ),
                      );
                  }}
                  className="flex min-h-10 w-full items-center gap-2 px-3 text-start transition-colors hover:bg-[var(--accent)]"
                >
                  <Share2 size={14} />
                  {localizeUi("ui.slurp.post.share", { defaultValue: "Share as image" })}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div>
        {/* The image editor renders its own preview while editing, so hide the read-only one. */}
        {isEditingPost && imageEditing ? null : displayedImageUrl || postImageLoading ? (
          <button
            ref={observePostImage}
            type="button"
            onClick={() => {
              if (!displayedImageUrl) return;
              if (ctx.openPost) ctx.openPost(post.id);
              else setImageLightbox(createNoodleLightboxImage(post.id, displayedImageUrl, post.imagePrompt ?? ""));
            }}
            disabled={!displayedImageUrl}
            className={cn(
              "mt-4 flex max-h-[32rem] justify-center overflow-hidden bg-black/20 text-left ring-1 ring-inset ring-white/10 ring-offset-[var(--background)] transition-[opacity,transform] hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] focus-visible:ring-offset-2 motion-reduce:transition-none",
              surface === "profile"
                ? "w-full rounded-xl"
                : "-mx-4 w-[calc(100%+2rem)] rounded-none sm:mx-0 sm:w-full sm:rounded-xl",
            )}
            title={localizeUi("ui.noodle.noodlepostcard.openImage")}
            aria-label={localizeUi("ui.noodle.noodlepostcard.openPostImage")}
          >
            {!displayedImageUrl ? (
              <span
                className="block aspect-[4/3] w-full animate-pulse bg-[var(--muted)] motion-reduce:animate-none sm:aspect-[16/10]"
                aria-hidden="true"
              />
            ) : imageCrop ? (
              <PostImageFrame
                src={displayedImageUrl}
                onError={() => setFailedImageUrl(displayedImageUrl)}
                crop={imageCrop}
                alt={localizeUi("ui.noodle.post.imageBy", {
                  name: author?.displayName ?? localizeUi("ui.slurp.profile.fallbackUser"),
                })}
              />
            ) : (
              <div
                className={cn(
                  "relative w-full overflow-hidden rounded-xl bg-[var(--slurp-media-stage,#17131a)]",
                  SLURP_FEED_MEDIA_RATIO_CLASS,
                )}
              >
                <img
                  src={displayedImageUrl}
                  onError={() => setFailedImageUrl(displayedImageUrl)}
                  alt={localizeUi("ui.noodle.post.imageBy", {
                    name: author?.displayName ?? localizeUi("ui.slurp.profile.fallbackUser"),
                  })}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </div>
            )}
          </button>
        ) : post.imagePrompt ? (
          <div className="relative mt-3 rounded-xl border border-[var(--noodle-accent)]/35 bg-[var(--noodle-accent)]/10 p-3 pr-14 text-xs leading-5">
            <span className="mb-1 flex items-center gap-1.5 font-semibold text-[var(--noodle-accent)]">
              <ImageIcon size={13} aria-hidden="true" />
              {localizeUi("ui.noodle.noodlepostcard.imagePrompt")}
            </span>
            {post.imagePrompt}
            {ctx.postManagement && ctx.generatePostImage && (
              <button
                type="button"
                onClick={() => ctx.generatePostImage?.(post)}
                disabled={imageGenerationPending}
                className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full text-[var(--noodle-accent)] transition-[background-color,transform] hover:bg-[var(--noodle-accent)]/15 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100"
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
        ) : null}
        {isEditingPost ? (
          <div className="mt-2 space-y-2">
            {titleEditing && (
              <label className="block space-y-1">
                <span className={labelClass}>{localizeUi("ui.noodle.noodlepostcard.titleOptional")}</span>
                <input
                  value={titleEditing.editingPostTitle}
                  onChange={(event) => titleEditing.setEditingPostTitle(event.target.value)}
                  maxLength={titleEditing.maxLength}
                  className={fieldClass}
                  placeholder={localizeUi("ui.noodle.noodlepostcard.postTitle")}
                />
              </label>
            )}
            <textarea
              value={editingPostContent}
              onChange={(event) => setEditingPostContent(event.target.value)}
              className={cn(textareaClass, "min-h-28")}
              placeholder={localizeUi("ui.noodle.noodlepostcard.editPost")}
            />
            {imageEditing && (
              <PostImageEditControls
                post={editablePost}
                editing={imageEditing}
                disabled={updatePostPending}
                footer={editingExistingPoll ? null : postEditActions}
              />
            )}
            {editingExistingPoll && pollEditing && (
              <NoodlePollComposer
                value={pollEditing.value}
                onChange={pollEditing.setValue}
                onClose={cancelEditingPost}
                onSubmit={() => saveEditedPost(post)}
                submitLabel={
                  updatePostPending
                    ? localizeUi("ui.noodle.noodlehome.saving")
                    : localizeUi("ui.noodle.noodlehome.save")
                }
                submitDisabled={saveEditDisabled}
                disabled={updatePostPending}
                title={localizeUi("ui.noodle.noodlehome.editPoll")}
                closeLabel={localizeUi("ui.noodle.noodlepostcard.cancelPostEditing")}
                action={postEditActions}
              />
            )}
            {!imageEditing && !editingExistingPoll && (
              <div className="flex flex-wrap justify-end gap-2">{postEditActions}</div>
            )}
          </div>
        ) : (
          <>
            {post.title && <h3 className="mt-2 break-words text-lg font-bold leading-snug">{post.title}</h3>}
            {!poll || ctx.deduplicatePollBody === false || post.content.trim() !== poll.question ? (
              <NoodleTextContent
                content={post.content}
                accountByHandle={accountByHandle}
                onOpenProfile={openProfile}
                className={cn("leading-6", post.title ? "mt-1" : "mt-2")}
              />
            ) : null}
          </>
        )}
        {poll && !isEditingPost && (
          <NoodlePollCard
            poll={poll}
            votes={pollVotes}
            accountById={accountById}
            selectedOptionId={personaPollVote}
            disabled={!personaAccount}
            pending={pollVotePending}
            onVote={(optionId) => voteInPoll(post, optionId, personaPollVote)}
            onOpenProfile={openProfile}
          />
        )}
        <div className="mt-5 flex items-center gap-2 border-t border-[var(--noodle-divider)] pt-3 tabular-nums">
          <button
            type="button"
            className={cn(noodleIconButtonClass, "rounded-lg", likedByPersona && "bg-[var(--noodle-accent)]/10")}
            disabled={!personaAccount || postLikePending}
            onClick={() => reactToPost(post, "like", likedByPersona)}
            title={
              likedByPersona
                ? localizeUi("ui.noodle.noodlepostcard.unlike")
                : localizeUi("ui.noodle.noodlepostcard.like")
            }
            aria-label={localizeUi(likedByPersona ? "ui.noodle.post.unlikeLabel" : "ui.noodle.post.likeLabel")}
            aria-busy={postLikePending}
            data-noodle-reaction="like"
          >
            <Heart
              size={18}
              fill={likedByPersona ? "currentColor" : "none"}
              strokeWidth={likedByPersona ? 2.4 : 2}
              className={cn(
                "transition-[fill,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
                likedByPersona && "scale-110",
              )}
            />
            {countInteractions(rootPostInteractions, "like")}
          </button>
          <button
            type="button"
            className={cn(noodleIconButtonClass, "rounded-lg", repostedByPersona && "bg-[var(--noodle-accent)]/10")}
            disabled={!personaAccount || postRepostPending}
            onClick={() => reactToPost(post, "repost", repostedByPersona)}
            title={
              repostedByPersona
                ? localizeUi("ui.noodle.noodlepostcard.undoRepost")
                : localizeUi("ui.noodle.noodlepostcard.repost")
            }
            aria-busy={postRepostPending}
            data-noodle-reaction="repost"
          >
            <Repeat2 size={24} strokeWidth={1.55} className="-my-1" />
            {countInteractions(rootPostInteractions, "repost")}
          </button>
          <button
            type="button"
            className={cn(noodleIconButtonClass, "rounded-lg hover:text-[var(--noodle-accent)]")}
            disabled={!personaAccount}
            onClick={() => openReplyComposer(post.id)}
            title={localizeUi("ui.noodle.noodlepostcard.reply")}
          >
            <MessageCircle size={18} />
            {replies.length}
          </button>
        </div>

        <SlurpLikedBy
          likes={rootPostInteractions.filter((interaction) => interaction.type === "like")}
          total={countInteractions(rootPostInteractions, "like")}
          creatorAccountId={post.authorAccountId}
        />

        {replyPostId === post.id && !replyParentInteractionId && renderReplyComposer(false)}

        {replies.length > 0 && (
          <div className="mt-3 border-t border-[var(--noodle-divider)]">
            {orderedReplies.map((reply) => {
              const actorAccount = accountById.get(reply.actorAccountId) ?? null;
              const actor = actorAccount ?? reply.actorSnapshot;
              const parentReply = reply.parentInteractionId ? (replyById.get(reply.parentInteractionId) ?? null) : null;
              const parentActorAccount = parentReply ? (accountById.get(parentReply.actorAccountId) ?? null) : null;
              const parentActor = parentActorAccount ?? parentReply?.actorSnapshot ?? null;
              const replyLikes = replyLikesByParentId.get(reply.id) ?? [];
              const likedReplyByPersona = personaAccount
                ? replyLikes.some((interaction) => interaction.actorAccountId === personaAccount.id)
                : false;
              const canManageReply = canManageReplyOverride
                ? canManageReplyOverride(reply)
                : Boolean(
                    personaAccount &&
                    canManageNoodleReply({
                      actorKind: actorAccount?.kind ?? reply.actorSnapshot?.kind,
                      actorAccountId: reply.actorAccountId,
                      personaAccountId: personaAccount.id,
                    }),
                  );
              return (
                <Fragment key={reply.id}>
                  <div
                    data-noodle-interaction-id={reply.id}
                    tabIndex={-1}
                    className={cn(
                      "grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-2 border-b border-[var(--noodle-divider)] bg-transparent py-3 text-xs outline-none transition-shadow duration-300 last:border-b-0",
                      highlightedInteractionId === reply.id &&
                        "rounded-lg ring-1 ring-inset ring-[var(--noodle-accent)]/70",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => openProfile(actorAccount)}
                      disabled={!actorAccount}
                      className="h-8 w-8 shrink-0 rounded-full text-left transition-opacity enabled:hover:opacity-80 disabled:cursor-default"
                      title={
                        actorAccount
                          ? localizeUi("ui.noodle.noodlehome.viewValue1", {
                              value1: actorAccount.handle,
                            })
                          : undefined
                      }
                    >
                      <Avatar
                        account={
                          actor ?? {
                            displayName: localizeUi("ui.slurp.profile.fallbackUser"),
                            avatarUrl: null,
                          }
                        }
                        size="sm"
                      />
                    </button>
                    <div className="min-w-0 bg-transparent">
                      <div
                        data-noodle-comment-metadata
                        className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[var(--noodle-accent-foreground)]"
                      >
                        <button
                          type="button"
                          onClick={() => openProfile(actorAccount)}
                          disabled={!actorAccount}
                          className="max-w-full truncate font-semibold !text-[var(--foreground)] transition-colors enabled:hover:!text-[var(--noodle-accent)] disabled:cursor-default"
                        >
                          {actor?.displayName ?? localizeUi("ui.slurp.profile.fallbackUser")}
                        </button>
                        <span className="truncate !text-[var(--noodle-accent-foreground)]">
                          @{actor?.handle ?? "noodle"}
                        </span>
                        <span className="!text-[var(--noodle-accent-foreground)] opacity-75">
                          · {formatTime(reply.createdAt, i18n.language)}
                        </span>
                      </div>
                      {parentActor && (
                        <p className="mt-0.5 text-[var(--muted-foreground)]">
                          {localizeUi("ui.noodle.noodlepostcard.replyingTo")}{" "}
                          {parentActorAccount ? (
                            <button
                              type="button"
                              onClick={() => openProfile(parentActorAccount)}
                              className="font-medium text-[var(--noodle-accent)] hover:underline focus-visible:rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]/70"
                              aria-label={localizeUi("ui.noodle.profile.viewHandleProfile", {
                                handle: parentActorAccount.handle,
                              })}
                            >
                              @{parentActorAccount.handle}
                            </button>
                          ) : (
                            <span className="text-[var(--noodle-accent)]">@{parentActor.handle}</span>
                          )}
                        </p>
                      )}
                      {editingReplyId === reply.id ? (
                        <div className="mt-2 space-y-2" data-component="NoodleView.CommentEditor">
                          <textarea
                            value={editingReplyContent}
                            onChange={(event) => setEditingReplyContent(event.target.value)}
                            className={cn(textareaClass, "min-h-20 resize-y")}
                            placeholder={localizeUi("ui.noodle.noodlepostcard.editComment")}
                            autoFocus
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={cancelEditingReply}
                              disabled={updateInteraction.isPending}
                              className="h-8 rounded-full px-3 text-xs font-semibold text-[var(--muted-foreground)] transition-colors hover:bg-[var(--noodle-accent)]/10 hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]/70 disabled:opacity-50"
                            >
                              {localizeUi("chat.delete.dialog.cancel")}
                            </button>
                            <button
                              type="button"
                              onClick={() => saveEditedReply(post, reply)}
                              disabled={(!editingReplyContent.trim() && !reply.imageUrl) || updateInteraction.isPending}
                              className="h-8 rounded-full bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {updateInteraction.isPending
                                ? localizeUi("ui.noodle.noodlehome.saving")
                                : localizeUi("ui.noodle.noodlehome.save")}
                            </button>
                          </div>
                        </div>
                      ) : reply.content ? (
                        <NoodleTextContent
                          content={reply.content}
                          accountByHandle={accountByHandle}
                          onOpenProfile={openProfile}
                          className="mt-1 leading-5"
                        />
                      ) : null}
                      {reply.imageUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            setImageLightbox(createNoodleLightboxImage(reply.id, reply.imageUrl!, reply.content ?? ""))
                          }
                          className="mt-2 block w-full overflow-hidden rounded-xl text-left ring-offset-[var(--background)] transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] focus-visible:ring-offset-2"
                          title={localizeUi("ui.noodle.noodlepostcard.openImage")}
                          aria-label={localizeUi("ui.noodle.noodlepostcard.openCommentImage")}
                        >
                          <img
                            src={reply.imageUrl}
                            alt={localizeUi("ui.noodle.noodlepostcard.commentImageAlt", {
                              name: actor?.displayName ?? localizeUi("ui.slurp.profile.fallbackUser"),
                            })}
                            className="max-h-72 w-full object-cover"
                          />
                        </button>
                      )}
                      <div className="mt-1.5 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => reactToReply(post, reply, likedReplyByPersona)}
                          disabled={!personaAccount || reactionPendingFor(post.id, "like", reply.id)}
                          className={cn(
                            noodleCommentActionClass,
                            "px-2 font-medium",
                            likedReplyByPersona && "bg-[var(--noodle-accent)]/10",
                          )}
                          title={
                            likedReplyByPersona
                              ? localizeUi("ui.noodle.noodlepostcard.unlikeComment")
                              : localizeUi("ui.noodle.noodlepostcard.likeComment")
                          }
                          aria-busy={reactionPendingFor(post.id, "like", reply.id)}
                        >
                          <Heart
                            size={14}
                            fill={likedReplyByPersona ? "currentColor" : "none"}
                            strokeWidth={likedReplyByPersona ? 2.4 : 2}
                            className={cn(
                              "transition-[fill,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
                              likedReplyByPersona && "scale-110",
                            )}
                          />
                          {replyLikes.length > 0 && replyLikes.length}
                        </button>
                        <button
                          type="button"
                          onClick={() => openReplyComposer(post.id, reply.id)}
                          disabled={!personaAccount}
                          className={cn(noodleCommentActionClass, "w-7")}
                          title={localizeUi("ui.noodle.noodlepostcard.reply")}
                          aria-label={localizeUi("ui.noodle.noodlepostcard.reply")}
                        >
                          <MessageCircle size={14} />
                        </button>
                        {canManageReply && editingReplyId !== reply.id && (
                          <>
                            <button
                              type="button"
                              onClick={() => startEditingReply(reply)}
                              disabled={updateInteraction.isPending || deleteInteraction.isPending}
                              className={cn(noodleCommentActionClass, "w-7")}
                              title={localizeUi("ui.noodle.noodlepostcard.editComment")}
                              aria-label={localizeUi("ui.noodle.noodlepostcard.editComment")}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteNoodleReply(post, reply)}
                              disabled={updateInteraction.isPending || deleteInteraction.isPending}
                              className={cn(noodleCommentActionClass, "w-7")}
                              title={localizeUi("ui.noodle.noodlepostcard.deleteComment")}
                              aria-label={localizeUi("ui.noodle.noodlepostcard.deleteComment")}
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  {replyPostId === post.id && replyParentInteractionId === reply.id && renderReplyComposer(true)}
                </Fragment>
              );
            })}
          </div>
        )}
      </div>
    </article>
  );
}
