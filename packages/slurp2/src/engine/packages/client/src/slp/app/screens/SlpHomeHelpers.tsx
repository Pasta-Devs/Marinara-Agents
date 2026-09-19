import type {
  NoodlePostAccess,
  NoodlerPostView,
  NoodleManagedPost,
  NoodlePollInput,
  NoodlePostImageCrop,
  NoodlerStageProfile,
  NoodlerPostDraftImage,
  NoodleContentFormat,
  NoodlerManagedPost,
} from "@marinara-engine/shared";
import type { SlurpStageProfileInput } from "../../base/state/slp-state-types";
import type { NoodlePostCardModel } from "../../modules/post/SlpPostCard";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NoodlerPostSubmission {
  profileId: string;
  title: string;
  body: string;
  access: NoodlePostAccess;
  image: NoodlerPostDraftImage | null;
  poll: { question: string; options: string[] } | null;
  format: NoodleContentFormat;
  postType: "post" | "story";
  linkedPostId: string | null;
  unlockPrice: number | null;
  generateImage: boolean;
}

export interface NoodlerPostDraft {
  title: string;
  body: string;
  access: NoodlePostAccess;
  image: NoodlerPostDraftImage | null;
  poll: NoodlePollInput | null;
  postType: "post" | "story";
  linkedPostId: string | null;
  unlockPrice: number | null;
  generateImage: boolean;
}

export interface PendingNoodlerImage {
  source: File | string;
}

export type { NoodlerContentFormat, NoodlerPostDraftImage } from "../../features/feed/slp-feed-contract";
export type SlurpViewerCreator = import("@marinara-engine/shared").NoodlerViewerScope;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const NOODLER_FEED_WINDOW_SIZE = 20;
export const SLURP_PLACEHOLDER_BALANCE = 1111;
export const STAGE_PERSONALITY_MAX_LENGTH = 1000;

export const EMPTY_NOODLER_POST_DRAFT: NoodlerPostDraft = {
  title: "",
  body: "",
  access: "public",
  image: null,
  poll: null,
  postType: "post",
  linkedPostId: null,
  unlockPrice: null,
  generateImage: false,
};

export const EMPTY_STAGE_PROFILE: SlurpStageProfileInput = {
  displayName: "",
  handle: "",
  bio: "",
  stagePersonality: "",
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

export function isEmptyNoodlerPostDraft(draft: NoodlerPostDraft): boolean {
  return (
    draft.title === EMPTY_NOODLER_POST_DRAFT.title &&
    draft.body === EMPTY_NOODLER_POST_DRAFT.body &&
    draft.access === EMPTY_NOODLER_POST_DRAFT.access &&
    !draft.image &&
    !draft.poll &&
    draft.postType === EMPTY_NOODLER_POST_DRAFT.postType &&
    draft.linkedPostId === EMPTY_NOODLER_POST_DRAFT.linkedPostId &&
    draft.unlockPrice === EMPTY_NOODLER_POST_DRAFT.unlockPrice
  );
}

export function isSlurpStory(post: NoodlerPostView | NoodlerManagedPost): boolean {
  return (post as NoodlerPostView & { story?: boolean }).story === true || post.metadata?.noodlerPostType === "story";
}

export function slurpSubscriptionPriceOf(profile: unknown): number {
  const price =
    typeof profile === "object" && profile !== null && "subscriptionPrice" in profile
      ? (profile as { subscriptionPrice: unknown }).subscriptionPrice
      : undefined;
  return typeof price === "number" && price >= 0 ? price : 100;
}

export function linkedPostIdForStory(post: NoodlerPostView): string | null {
  const linkedPostId = "linkedPostId" in post ? (post as { linkedPostId: unknown }).linkedPostId : undefined;
  return typeof linkedPostId === "string" && linkedPostId.length > 0 ? linkedPostId : null;
}

export function parsePrice(value: string): number | null {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function toNoodlePostCardModel(view: NoodlerPostView, profile: NoodlerStageProfile): NoodlePostCardModel {
  return {
    id: view.id,
    authorAccountId: profile.id,
    authorDisplayName: profile.displayName,
    authorHandle: profile.handle,
    authorAvatarUrl: profile.avatarUrl,
    title: view.title ?? null,
    content: view.content ?? "",
    imageUrl: view.imageUrl ?? null,
    imageCrop: (view as NoodlerPostView & { imageCrop?: NoodlePostImageCrop }).imageCrop ?? null,
    createdAt: view.createdAt,
    updatedAt: view.updatedAt,
    liked: view.viewerInteraction?.type === "like",
    likeCount: view.stats?.likes ?? 0,
    replyCount: view.stats?.replies ?? 0,
    viewCount: view.stats?.views ?? 0,
    access: view.access ?? "public",
    poll: view.poll ?? null,
    postType: (view as NoodlerPostView & { noodlerPostType?: string }).noodlerPostType ?? "post",
    story: (view as NoodlerPostView & { story?: boolean }).story ?? false,
  };
}

export function toManagedPostCardModel(post: NoodlerManagedPost, profile: NoodlerStageProfile): NoodlePostCardModel {
  return {
    id: post.id,
    authorAccountId: profile.id,
    authorDisplayName: profile.displayName,
    authorHandle: profile.handle,
    authorAvatarUrl: profile.avatarUrl,
    title: post.title ?? null,
    content: post.content ?? "",
    imageUrl: post.imageUrl ?? null,
    imageCrop: post.imageCrop ?? null,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    liked: false,
    likeCount: post.stats?.likes ?? 0,
    replyCount: post.stats?.replies ?? 0,
    viewCount: post.stats?.views ?? 0,
    access: post.access ?? "public",
    poll: post.poll ?? null,
    postType: post.noodlerPostType ?? "post",
    story: post.story ?? false,
  };
}

export function serializeNoodlerPostGuide(title: string, body: string): string {
  const sections: string[] = [];
  if (title.trim()) sections.push(`Title:\n${title.trim()}`);
  if (body.trim()) sections.push(`Body:\n${body.trim()}`);
  return sections.join("\n\n");
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function noodlerGoalOf(viewer: unknown): { label: string; target: number; raised: number; progress: number } | null {
  if (!viewer || typeof viewer !== "object") return null;
  const goal = (viewer as Record<string, unknown>).goal;
  if (!goal || typeof goal !== "object") return null;
  const value = goal as Record<string, unknown>;
  if (typeof value.label !== "string" || typeof value.target !== "number" || typeof value.raised !== "number") {
    return null;
  }
  return {
    label: value.label,
    target: value.target,
    raised: value.raised,
    progress: typeof value.progress === "number" ? value.progress : 0,
  };
}

// ---------------------------------------------------------------------------
// Shared small components
// ---------------------------------------------------------------------------

import {
  ChevronRight,
  Loader2,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { SlurpSparkleVeil } from "../../base/chrome/SlpSparkleVeil";
import { cn } from "../../../lib/utils";
import {
  getNoodleAccentStyle,
  NOODLE_PINK,
  ProfileInitial,
} from "../../base/chrome/SlpChrome";
import { useTranslation as useUiTranslation } from "react-i18next";
import { useSlurpMediaSrc } from "../../base/media/slp-media-src";
import { Modal } from "../../../components/ui/Modal";
import type { NoodlePostCardCtx } from "../../modules/post/SlpPostCard";
import { SlurpCreatorPostCard } from "../../modules/post/SlpCreatorPostCard";

/** Keeps a feed slot mounted while its locked and revealed card shapes trade places. */
export function SlurpAccessTransition({ postId, locked, children }: { postId: string; locked: boolean; children: ReactNode }) {
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
    </motion.div>
  );
}

export function NoodlerDraftImageFrame({ image }: { image: NoodlerPostDraftImage }) {
  const url =
    typeof image.source === "string" ? image.source : URL.createObjectURL(image.source);
  return (
    <div className="relative mt-3 overflow-hidden rounded-xl border border-[var(--noodle-divider)]">
      <img src={url} alt="" className="max-h-48 w-full object-cover" />
    </div>
  );
}

export function DisclosureBadge({ mode, detail }: { mode: import("@marinara-engine/shared").NoodleIdentityDisclosure | null; detail?: ReactNode }) {
  const { t: localizeUi } = useUiTranslation();
  const label = mode
    ? localizeUi(`ui.noodle.disclosure.${mode}.shortLabel`)
    : localizeUi("ui.noodle.disclosure.setupNeeded");
  return (
    <span
      title={detail ?? label}
      className="rounded-full border border-[var(--noodle-divider)] px-2 py-0.5 text-[0.68rem] font-bold capitalize text-[var(--muted-foreground)]"
    >
      {label}
    </span>
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

export function NoodlerFrame({
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
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--noodle-accent)] hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
            aria-label={localizeUi("ui.noodle.noodlehome.back")}
          >
            <ChevronRight size={18} className="rotate-180 rtl:rotate-0" />
          </button>
        )}
        <h1 className="min-w-0 flex-1 truncate text-sm font-black">{title}</h1>
        {action && <div className="flex shrink-0 items-center">{action}</div>}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
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
}: {
  visible: number;
  total: number;
  onLoadMore: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <button
      data-component="SlurpHome.LoadMoreFeed"
      type="button"
      onClick={onLoadMore}
      className="min-h-11 w-full border-b border-[var(--noodle-divider)] px-4 py-3 text-sm font-bold text-[var(--noodle-accent)] hover:bg-[var(--noodle-accent)]/10"
    >
      {localizeUi("ui.noodle.noodlehome.loadMore", { visible, total })}
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
          "bg-black [&>div:first-child]:hidden",
      )}
      panelStyle={getNoodleAccentStyle(NOODLE_PINK)}
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
  post: NoodlePostCardModel & { imageUrl: string };
  ctx: NoodlePostCardCtx;
  onClose: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const source = useSlurpMediaSrc(post.imageUrl, { width: 1600 });
  const authorName = post.authorSnapshot?.displayName ?? "";
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
          </>
        ) : (
          <div className="h-full w-full animate-pulse bg-[var(--slurp-surface-raised)] motion-reduce:animate-none" />
        )
      }
      side={<SlurpCreatorPostCard post={{ ...post, imageUrl: null }} ctx={ctx} surface="profile" />}
    />
  );
}
