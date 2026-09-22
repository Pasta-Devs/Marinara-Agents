import type { SlpCreatorContentFormat } from "../../features/feed/slp-feed-contract";
import type { SlurpContentDelivery, SlurpContentIntent } from "../../../../../shared/src/slp/slp-content-axes.js";
import { AnimatePresence } from "framer-motion";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { DEFAULT_SLURP_SUBSCRIPTION_PRICE } from "../../modules/coin/SlpCoin";
import { HelpTooltip } from "../../../components/ui/HelpTooltip";
import { type SlpIdentityDisclosure } from "../../../../../shared/src/slp/slp-social.types.js";
import { PostImageFrame } from "../../base/media/SlpPostImageCropEditor";
import { useMemo } from "react";
import { useCreatorViewer } from "../../features/feed/slp-feed-viewer-hooks";
import type { SlpPollInput } from "../../../../../shared/src/slp/slp-social-generation.schema.js";
import type {
  SlpCreatorManagedPost,
  SlpCreatorPostView,
  SlpCreatorStageProfile,
  SlpPostAccess,
} from "../../../../../shared/src/slp/slp-social.types.js";
import type { SlpCreatorPostDraftImage } from "../../features/feed/slp-feed-contract";
import type { SlurpStageProfileInput } from "../../base/state/slp-state-types";
import type { SlpPostCardModel } from "../../modules/post/SlpPostTypes";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SlpCreatorPostSubmission {
  profileId: string;
  title: string;
  body: string;
  access: SlpPostAccess;
  image: SlpCreatorPostDraftImage | null;
  poll: { question: string; options: string[] } | null;
  format: SlpCreatorContentFormat;
  postType: "post" | "story";
  linkedPostId: string | null;
  unlockPrice: number | null;
  /** Ask the AI for an image: written by the model on a guided post, from the text on a manual one. */
  generateImage: boolean;
  /** One-shot purpose for a guided post. Null lets the Creator's strategy decide. */
  contentIntent: SlurpContentIntent | null;
  contentDelivery: SlurpContentDelivery | null;
}

export interface SlpCreatorPostDraft {
  title: string;
  body: string;
  access: SlpPostAccess;
  image: SlpCreatorPostDraftImage | null;
  poll: SlpPollInput | null;
  postType: "post" | "story";
  linkedPostId: string | null;
  /** Price for this locked post. Null uses the Creator's price. */
  unlockPrice: number | null;
  generateImage: boolean;
  contentIntent: SlurpContentIntent | null;
  contentDelivery: SlurpContentDelivery | null;
}

export interface PendingCreatorImage {
  source: File | string;
}

export type { SlpCreatorContentFormat, SlpCreatorPostDraftImage } from "../../features/feed/slp-feed-contract";
export type SlurpViewerCreator = NonNullable<ReturnType<typeof useCreatorViewer>["data"]>["creators"][number];

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SLP_CREATOR_FEED_WINDOW_SIZE = 20;
export const SLURP_PLACEHOLDER_BALANCE = 1111;
export const STAGE_PERSONALITY_MAX_LENGTH = 1000;

export const EMPTY_SLP_CREATOR_POST_DRAFT: SlpCreatorPostDraft = {
  title: "",
  body: "",
  access: "public",
  image: null,
  poll: null,
  postType: "post",
  linkedPostId: null,
  unlockPrice: null,
  generateImage: false,
  contentIntent: null,
  contentDelivery: null,
};

export const EMPTY_STAGE_PROFILE: SlurpStageProfileInput = {
  displayName: "",
  handle: "",
  bio: "",
  stagePersonality: "",
  appearance: "",
  wardrobe: "",
  locations: "",
  disclosureMode: "open",
  gender: null,
  tags: [],
};

export const fieldClass =
  "mari-chrome-field h-11 w-full rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--noodle-accent)]";
export const textareaClass =
  "mari-chrome-field min-h-24 w-full resize-y rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] p-3 text-sm leading-6 text-[var(--foreground)] outline-none transition-colors focus:border-[var(--noodle-accent)]";

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

export function isEmptyCreatorPostDraft(draft: SlpCreatorPostDraft): boolean {
  return (
    draft.title === EMPTY_SLP_CREATOR_POST_DRAFT.title &&
    draft.body === EMPTY_SLP_CREATOR_POST_DRAFT.body &&
    draft.access === EMPTY_SLP_CREATOR_POST_DRAFT.access &&
    !draft.image &&
    !draft.poll &&
    draft.postType === EMPTY_SLP_CREATOR_POST_DRAFT.postType &&
    draft.linkedPostId === EMPTY_SLP_CREATOR_POST_DRAFT.linkedPostId &&
    draft.generateImage === EMPTY_SLP_CREATOR_POST_DRAFT.generateImage
  );
}

export function isSlurpStory(post: SlpCreatorPostView | SlpCreatorManagedPost): boolean {
  return (
    (post as SlpCreatorPostView & { story?: boolean }).story === true || post.metadata?.noodlerPostType === "story"
  );
}

export function slurpSubscriptionPriceOf(profile: unknown): number {
  const price = (profile as { subscriptionPrice?: unknown } | null)?.subscriptionPrice;
  return typeof price === "number" && price >= 0 ? price : DEFAULT_SLURP_SUBSCRIPTION_PRICE;
}

export function linkedPostIdForStory(post: SlpCreatorPostView): string | null {
  const linkedPostId = (post as SlpCreatorPostView & { linkedPostId?: unknown }).linkedPostId;
  return typeof linkedPostId === "string" && linkedPostId.length > 0 ? linkedPostId : null;
}

export function parsePrice(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function toSlpPostCardModel(view: SlpCreatorPostView, profile: SlpCreatorStageProfile): SlpPostCardModel {
  return {
    id: view.id,
    authorAccountId: view.authorAccountId,
    access: view.access,
    title: view.title,
    content: view.content ?? "",
    imageUrl: view.imageUrl,
    imagePrompt: view.imagePrompt,
    images: view.images,
    metadata: view.metadata ?? {},
    authorSnapshot: {
      id: profile.id,
      handle: profile.handle,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      avatarCrop: profile.avatarCrop,
    },
    createdAt: view.createdAt,
    interactions: view.interactions,
    likeCount: view.likeCount ?? undefined,
  };
}

export function toManagedPostCardModel(post: SlpCreatorManagedPost, profile: SlpCreatorStageProfile): SlpPostCardModel {
  return {
    id: post.id,
    authorAccountId: post.authorAccountId,
    access: post.access,
    title: post.title,
    content: post.content,
    imageUrl: post.imageUrl,
    imagePrompt: post.imagePrompt,
    images: post.images,
    metadata: post.metadata,
    authorSnapshot: {
      id: profile.id,
      handle: profile.handle,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      avatarCrop: profile.avatarCrop,
    },
    createdAt: post.createdAt,
    interactions: [],
  };
}

export function serializeCreatorPostGuide(title: string, body: string) {
  const sections: string[] = [];
  if (title.trim()) sections.push(`Title:\n${title.trim()}`);
  if (body.trim()) sections.push(`Body:\n${body.trim()}`);
  return sections.join("\n\n");
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function slpCreatorGoalOf(
  scope: unknown,
): { label: string; raised: number; target: number; progress: number; met: boolean } | null {
  const goal = (scope as { goal?: unknown } | null)?.goal;
  if (!goal || typeof goal !== "object") return null;
  const value = goal as Record<string, unknown>;
  if (typeof value.label !== "string" || typeof value.target !== "number" || typeof value.raised !== "number") {
    return null;
  }
  return {
    label: value.label,
    raised: value.raised,
    target: value.target,
    progress: typeof value.progress === "number" ? value.progress : 0,
    met: value.met === true,
  };
}

// ---------------------------------------------------------------------------
// Shared small components
// ---------------------------------------------------------------------------

import { UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { SlurpSparkleVeil } from "../../base/chrome/SlpSparkleVeil";
import { cn } from "../../../lib/utils";
import { getSlpAccentStyle, SLP_PINK, ProfileInitial } from "../../base/chrome/SlpChrome";
import { useTranslation as useUiTranslation } from "react-i18next";
import { useSlurpMediaSrc } from "../../base/media/slp-media-src";
import { Modal } from "../../../components/ui/Modal";
import type { SlpPostCardCtx } from "../../modules/post/SlpPostTypes";
import { SlpPostCard } from "../../modules/post/SlpPostCard";

/** Keeps a feed slot mounted while its locked and revealed card shapes trade places. */
export function SlurpAccessTransition({
  postId,
  locked,
  children,
}: {
  postId: string;
  locked: boolean;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const previousLocked = useRef(locked);
  const [celebrating, setCelebrating] = useState(false);

  useEffect(() => {
    const revealed = previousLocked.current && !locked;
    previousLocked.current = locked;
    if (!revealed) return;
    setCelebrating(true);
    const timer = window.setTimeout(() => setCelebrating(false), reduceMotion ? 350 : 1_000);
    return () => window.clearTimeout(timer);
  }, [locked, reduceMotion]);

  return (
    <motion.div
      layout={reduceMotion ? false : "size"}
      transition={{ type: "spring", duration: 0.58, bounce: 0 }}
      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 720px" }}
      data-slurp-access-transition={postId}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.div
          key={locked ? "locked" : "revealed"}
          className="relative"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.985, filter: "blur(4px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.992, filter: "blur(4px)" }}
          transition={{ duration: reduceMotion ? 0.12 : 0.42, ease: "easeOut" }}
        >
          {children}
          {celebrating && !locked && <SlurpSparkleVeil className="z-20 rounded-xl opacity-80" />}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

export function SlpCreatorDraftImageFrame({ image }: { image: SlpCreatorPostDraftImage }) {
  const { t: localizeUi } = useUiTranslation();
  const sourceUrl = useMemo(
    () => (typeof image.source === "string" ? image.source : URL.createObjectURL(image.source)),
    [image.source],
  );
  useEffect(
    () => () => {
      if (image.source instanceof File) URL.revokeObjectURL(sourceUrl);
    },
    [image.source, sourceUrl],
  );
  return (
    <PostImageFrame
      src={sourceUrl}
      crop={image.crop}
      alt={localizeUi("ui.noodle.noodlehome.attachedPostImage")}
      maxHeight={240}
    />
  );
}

export function DisclosureBadge({ mode, detail }: { mode: SlpIdentityDisclosure | null; detail?: ReactNode }) {
  const { t: localizeUi } = useUiTranslation();
  const label = mode
    ? localizeUi(`ui.noodle.disclosure.${mode}.shortLabel`)
    : localizeUi("ui.noodle.disclosure.setupNeeded");
  const defaultDetail =
    mode === "open"
      ? localizeUi("ui.slurp.disclosure.openDetail")
      : mode === "hinted"
        ? localizeUi("ui.slurp.disclosure.hintedDetail")
        : localizeUi("ui.slurp.disclosure.setupDetail");
  return (
    <HelpTooltip
      label={label}
      side="bottom"
      buttonClassName="rounded-full border border-[var(--noodle-divider)] px-2 py-0.5 text-[0.68rem] font-bold capitalize text-[var(--muted-foreground)] opacity-100 [&_svg]:hidden"
      text={<span>{detail ?? defaultDetail}</span>}
    />
  );
}

export function EmptyState({
  title,
  detail,
  action,
  onAction,
  icon: Icon = UserRound,
}: {
  title: string;
  detail?: string;
  action?: string;
  onAction?: () => void;
  /** Defaults to a person, which is wrong for an empty search or an empty feed. */
  icon?: LucideIcon;
}) {
  return (
    <div className="px-8 py-8 text-center sm:py-16">
      <Icon size={36} className="mx-auto !text-[var(--noodle-accent)]" />
      <p className="mt-4 font-bold">{title}</p>
      {detail && <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted-foreground)]">{detail}</p>}
      {action && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 min-h-11 rounded-lg border border-[var(--noodle-divider)] px-4 text-sm font-bold transition-[background-color,transform] hover:bg-[var(--accent)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100"
        >
          {action}
        </button>
      )}
    </div>
  );
}

export function SlpCreatorFrame({
  children,
  onBack,
  title,
  hideBack = false,
  action,
  hideHeader = false,
  hideHeaderOnMobile = false,
}: {
  children: ReactNode;
  onBack: () => void;
  title: string;
  hideBack?: boolean;
  action?: ReactNode;
  /** Set when the view below draws its own title bar, so this one would only duplicate it. */
  hideHeader?: boolean;
  hideHeaderOnMobile?: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header
        className={cn(
          "flex h-14 shrink-0 items-center gap-2 border-b border-[var(--noodle-divider)] px-2",
          hideHeaderOnMobile && "hidden md:flex",
          hideHeader && "hidden md:hidden",
        )}
      >
        {!hideBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--noodle-accent)] hover:bg-[var(--noodle-accent)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
            aria-label={localizeUi("ui.noodle.noodlerframe.back")}
          >
            <ArrowLeft size={18} className="rtl:-scale-x-100" />
          </button>
        )}
        <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</h1>
        {action ?? (
          <span className="rounded-full bg-[var(--noodle-accent)]/10 px-2.5 py-1 text-[0.65rem] font-bold text-[var(--noodle-accent)]">
            {localizeUi("ui.noodle.noodlerframe.noodler")}
          </span>
        )}
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}

export function SlurpFeedSkeleton() {
  const { t: localizeUi } = useUiTranslation();
  return (
    <div className="space-y-4 bg-[var(--slurp-canvas)] px-3 pb-6 pt-4 sm:px-4" aria-busy="true">
      <span className="sr-only">{localizeUi("ui.slurp.feed.loading", { defaultValue: "Loading posts" })}</span>
      {[0, 1, 2].map((row) => (
        <div
          key={row}
          className="rounded-xl bg-[var(--slurp-surface)] p-4 shadow-[var(--slurp-shadow-raised)] ring-1 ring-inset ring-[var(--noodle-divider)]"
          aria-hidden="true"
        >
          <div className="flex items-center gap-3">
            <span className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-[var(--slurp-surface-raised)] motion-reduce:animate-none" />
            <span className="min-w-0 flex-1 space-y-2">
              <span className="block h-3 w-32 animate-pulse rounded-full bg-[var(--slurp-surface-raised)] motion-reduce:animate-none" />
              <span className="block h-2.5 w-20 animate-pulse rounded-full bg-[var(--slurp-surface-raised)] motion-reduce:animate-none" />
            </span>
          </div>
          <div className="mt-4 space-y-2">
            <span className="block h-3 w-full animate-pulse rounded-full bg-[var(--slurp-surface-raised)] motion-reduce:animate-none" />
            <span className="block h-3 w-4/5 animate-pulse rounded-full bg-[var(--slurp-surface-raised)] motion-reduce:animate-none" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared screen components
// ---------------------------------------------------------------------------

export function SourceAccountAvatar({
  account,
}: {
  account: {
    displayName: string;
    avatarUrl: string | null;
  };
}) {
  const source = useSlurpMediaSrc(account.avatarUrl, { width: 96 });
  return source ? (
    <img src={source} alt="" decoding="async" className="h-11 w-11 shrink-0 rounded-full object-cover" />
  ) : (
    <ProfileInitial profile={{ ...account, avatarUrl: null }} />
  );
}

export function LoadMoreFeedButton({
  visible,
  total,
  onLoadMore,
  loading = false,
}: {
  visible: number;
  total: number;
  onLoadMore: () => void;
  loading?: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <button
      data-component="SlurpHome.LoadMoreFeed"
      type="button"
      onClick={onLoadMore}
      disabled={loading}
      aria-busy={loading}
      className="min-h-11 w-full border-b border-[var(--noodle-divider)] px-4 py-3 text-sm font-bold text-[var(--noodle-accent)] hover:bg-[var(--noodle-accent)]/10"
    >
      {loading ? (
        <Loader2
          size={16}
          className="mx-auto animate-spin motion-reduce:animate-none"
          aria-label={localizeUi("ui.slurp.feed.loading", { defaultValue: "Loading" })}
        />
      ) : (
        localizeUi("ui.noodle.noodlehome.loadMore", { visible, total })
      )}
    </button>
  );
}

/**
 * One media dialog for the whole app: the picture takes the room, the words sit beside it.
 * The post version fills the side with the real post card, so replies, reactions, and the
 * composer are the ones the feed already uses.
 */
export function SlurpMediaDialog({
  title,
  onClose,
  media,
  side,
  variant = "post",
}: {
  title: string;
  onClose: () => void;
  media: ReactNode;
  side: ReactNode;
  variant?: "post" | "story";
}) {
  const story = variant === "story";
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      width={story ? "max-w-xl" : "max-w-6xl"}
      mobileFullscreen
      contentClassName="p-0 sm:p-0"
      panelClassName={cn(
        "noodle-icon-scope overflow-hidden",
        story &&
          // The Modal header is hidden: a Story draws its own close button over the picture, top right.
          "bg-black [&>div:first-child]:hidden",
      )}
      panelStyle={getSlpAccentStyle(SLP_PINK)}
    >
      <div
        className={cn(
          "flex h-full min-h-0 flex-col",
          story ? "relative sm:h-[min(90vh,56rem)]" : "sm:h-[min(84vh,48rem)] sm:flex-row",
        )}
      >
        <div
          className={cn(
            "relative flex flex-1 items-center justify-center overflow-hidden bg-black",
            story ? "min-h-0" : "min-h-[16rem] sm:min-h-0",
          )}
        >
          {media}
        </div>
        <aside
          className={cn(
            "flex min-h-0 w-full shrink-0 flex-col overflow-y-auto",
            story
              ? "absolute inset-x-0 bottom-0 z-20 max-h-[46%] bg-gradient-to-t from-black via-black/88 to-transparent px-1 pb-2 pt-16 text-white"
              : "border-t border-[var(--noodle-divider)] bg-[var(--slurp-surface)] sm:w-[24rem] sm:border-s sm:border-t-0 @min-[1280px]:w-[26rem]",
          )}
        >
          {side}
        </aside>
      </div>
    </Modal>
  );
}

export function SlurpPostDialog({
  post,
  ctx,
  onClose,
}: {
  post: SlpPostCardModel & { imageUrl: string };
  ctx: SlpPostCardCtx;
  onClose: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  // A post can carry a gallery. The dialog used to show `imageUrl` alone, so every image after
  // the first was unreachable once the post was opened.
  const gallery = post.images.length > 0 ? post.images.map((image) => image.imageUrl) : [post.imageUrl];
  const [index, setIndex] = useState(0);
  const active = gallery[Math.min(index, gallery.length - 1)] ?? post.imageUrl;
  const source = useSlurpMediaSrc(active, { width: 1600 });
  const authorName = post.authorSnapshot?.displayName ?? "";
  const step = (offset: 1 | -1) => setIndex((current) => (current + offset + gallery.length) % gallery.length);
  return (
    <SlurpMediaDialog
      title={localizeUi("ui.slurp.post.dialogTitle", { name: authorName })}
      onClose={onClose}
      media={
        source ? (
          <>
            <img
              src={source}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full scale-110 object-cover opacity-25 blur-3xl"
            />
            <img
              src={source}
              alt={localizeUi("ui.noodle.post.imageBy", { name: authorName })}
              decoding="async"
              className="relative z-10 max-h-full max-w-full object-contain outline outline-1 -outline-offset-1 outline-white/10"
            />
            {gallery.length > 1 && (
              <>
                <span className="pointer-events-none absolute inset-x-2 top-1/2 z-20 flex -translate-y-1/2 justify-between">
                  <button
                    type="button"
                    aria-label={localizeUi("ui.slurp.post.previousImage")}
                    onClick={() => step(-1)}
                    className="pointer-events-auto grid size-11 place-items-center rounded-full bg-black/65 text-white ring-1 ring-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <ChevronLeft size={22} className="rtl:rotate-180" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={localizeUi("ui.slurp.post.nextImage")}
                    onClick={() => step(1)}
                    className="pointer-events-auto grid size-11 place-items-center rounded-full bg-black/65 text-white ring-1 ring-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <ChevronRight size={22} className="rtl:rotate-180" aria-hidden="true" />
                  </button>
                </span>
                <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-2 bg-gradient-to-t from-black/80 to-transparent px-3 pb-3 pt-10">
                  <p className="text-xs font-bold tabular-nums text-white/80" aria-live="polite">
                    {localizeUi("ui.slurp.post.imageCounter", {
                      index: index + 1,
                      total: gallery.length,
                      defaultValue: "{{index}} of {{total}}",
                    })}
                  </p>
                  <ol className="flex max-w-full gap-2 overflow-x-auto pb-1">
                    {gallery.map((imageUrl, position) => (
                      <li key={`${imageUrl}-${position}`}>
                        <SlurpPostDialogThumb
                          imageUrl={imageUrl}
                          selected={position === index}
                          label={localizeUi("ui.slurp.post.showImage", {
                            index: position + 1,
                            defaultValue: "Show image {{index}}",
                          })}
                          onSelect={() => setIndex(position)}
                        />
                      </li>
                    ))}
                  </ol>
                </div>
              </>
            )}
          </>
        ) : (
          <div className="h-full w-full animate-pulse bg-[var(--slurp-surface-raised)] motion-reduce:animate-none" />
        )
      }
      // The dialog owns the picture, so the card must not draw it or offer its prompt again.
      // `images` has to go too: the card prefers that array over `imageUrl`, so blanking only
      // `imageUrl` left every gallery post showing its picture twice.
      side={<SlpPostCard post={{ ...post, imageUrl: null, images: [] }} ctx={ctx} surface="profile" />}
    />
  );
}

/** One mini preview in the dialog's gallery strip. Own component so each can resolve its own src. */
function SlurpPostDialogThumb({
  imageUrl,
  selected,
  label,
  onSelect,
}: {
  imageUrl: string;
  selected: boolean;
  label: string;
  onSelect: () => void;
}) {
  const source = useSlurpMediaSrc(imageUrl, { width: 160 });
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={selected ? "true" : undefined}
      onClick={onSelect}
      className={cn(
        "size-14 overflow-hidden rounded-lg bg-black/40 ring-1 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
        selected ? "ring-2 ring-white" : "opacity-60 ring-white/25 hover:opacity-100",
      )}
    >
      {source && <img src={source} alt="" decoding="async" className="h-full w-full object-cover" />}
    </button>
  );
}
