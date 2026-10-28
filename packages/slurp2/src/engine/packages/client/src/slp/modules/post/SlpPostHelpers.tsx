import { useEffect, useState } from "react";
import { ChevronDown, ImageOff, Pencil, RefreshCw, Sparkle } from "lucide-react";
import {
  type SlpAccount,
  type SlpInteraction,
  type SlpInteractionType,
} from "../../../../../shared/src/slp/slp-social.types.js";
import { cn } from "../../../lib/utils";
import { slpPostFrameStyle, slpPostMediaRatio } from "./slp-post-ratio";
import { SlpTextContent } from "./SlpMarkdownRenderer";
import type { ConversationMediaPickerTab } from "../../../components/chat/ConversationMediaPickerPanel";
import type { ChatImage } from "../../../hooks/use-gallery";
import { Avatar } from "../../base/chrome/SlpChrome";
import { SlpButton } from "../chrome/SlpButton";
import { SlpTwinkle } from "../sparkle/SlpSparkle";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { ActiveComposerMention } from "./SlpPostTypes";

export type { SlpPostCardModel, SlpPostImageUpdate, SlpPostCardCtx } from "./SlpPostTypes";
export type { SlpPostCardControllerOptions } from "./SlpPostTypes";
export { SlpToolButton, SlpComposerToolRow, SlurpToolPopover } from "./SlpPostComposerTools";
export { useSlpPostImageEditor, useSlpPostCardController } from "./SlpPostHooks";
export { SlpCustomEmojiText, SlpTextContent } from "./SlpMarkdownRenderer";
export { SlpPollCard } from "./SlpPollCard";
export { PostImageEditControls } from "./SlpPostImageEditControls";

export const fieldClass =
  "mari-chrome-field h-9 w-full min-w-0 rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] px-3 text-xs text-[var(--foreground)] outline-none transition-colors focus:border-[var(--noodle-accent)]";
export const textareaClass =
  "mari-chrome-field min-h-24 w-full min-w-0 resize-y rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] p-3 text-xs leading-relaxed text-[var(--foreground)] outline-none transition-colors focus:border-[var(--noodle-accent)]";
export const slpIconButtonClass =
  "inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-lg px-3 text-xs font-semibold !text-[var(--noodle-accent-foreground)] transition-colors hover:bg-[var(--noodle-accent)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:!text-[var(--noodle-accent-foreground)]";
export const slpCommentActionClass =
  "inline-flex h-7 items-center justify-center gap-1 rounded-full !text-[var(--noodle-accent-foreground)] transition-colors hover:bg-[var(--noodle-accent)]/10 active:bg-[var(--noodle-accent)]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]/70 disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:!text-[var(--noodle-accent-foreground)]";
/** Groups depth-first replies into top-level threads. Deeper replies stay flat inside their thread. */
export function slurpReplyThreads(orderedReplies: SlpInteraction[], replyById: Map<string, SlpInteraction>) {
  const threads: { root: SlpInteraction; children: SlpInteraction[] }[] = [];
  for (const reply of orderedReplies) {
    const parentId = reply.parentInteractionId;
    if (!parentId || !replyById.has(parentId) || threads.length === 0) threads.push({ root: reply, children: [] });
    else threads[threads.length - 1]!.children.push(reply);
  }
  return threads;
}

/** Post body that clamps long text behind a Show more toggle. */
export function SlurpClampedText(props: Parameters<typeof SlpTextContent>[0] & { clampLength?: number }) {
  const { t: localizeUi } = useUiTranslation();
  const [expanded, setExpanded] = useState(false);
  const limit = props.clampLength ?? 300;
  // ponytail: length/line heuristic instead of measuring overflow; measure with a ref if short posts clamp oddly.
  // The collapsed view is a CSS clamp on the whole text, never a slice: handing the markdown parser
  // a cut string turned an unclosed fence or link into a grey code box for the rest of the post.
  const long = props.content.length > limit || props.content.split("\n").length > 7;
  return (
    <>
      <div className={cn(long && !expanded && "line-clamp-6")}>
        <SlpTextContent {...props} />
      </div>
      {long && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="mt-1 rounded text-xs font-semibold text-[var(--noodle-accent-foreground)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
        >
          {expanded
            ? localizeUi("ui.noodle.noodlepostcard.showLess", { defaultValue: "Show less" })
            : localizeUi("ui.noodle.noodlepostcard.showMore", { defaultValue: "Show more" })}
        </button>
      )}
    </>
  );
}

export const SLP_MEDIA_PICKER_TABS: ConversationMediaPickerTab[] = [
  { id: "emoji", label: "Emoji" },
  { id: "gifs", label: "GIFs" },
  { id: "stickers", label: "Stickers" },
];
export const SLP_TEXT_MEDIA_PICKER_TABS: ConversationMediaPickerTab[] = [
  { id: "emoji", label: "Emoji" },
  { id: "stickers", label: "Stickers" },
];

export function insertAtSelection(value: string, insertion: string, start: number, end: number) {
  const boundedStart = Math.max(0, Math.min(start, value.length));
  const boundedEnd = Math.max(boundedStart, Math.min(end, value.length));
  return {
    value: value.slice(0, boundedStart) + insertion + value.slice(boundedEnd),
    caret: boundedStart + insertion.length,
  };
}

export function SlpMentionSuggestions({
  activeMention,
  activeIndex,
  accounts,
  listboxId,
  onSelect,
}: {
  activeMention: ActiveComposerMention | null;
  activeIndex: number;
  accounts: SlpAccount[];
  listboxId: string;
  onSelect: (account: SlpAccount) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  if (!activeMention) return null;
  return (
    <div
      id={listboxId}
      role="listbox"
      aria-label={localizeUi("ui.noodle.noodlementionsuggestions.tagACharacter")}
      className="relative z-40 mt-1 max-h-56 overflow-y-auto rounded-xl border border-[var(--noodle-divider)] bg-[var(--background)] p-1 shadow-xl shadow-black/25"
    >
      {accounts.length > 0 ? (
        accounts.map((account, index) => (
          <button
            key={account.id}
            id={`${listboxId}-option-${index}`}
            type="button"
            role="option"
            aria-selected={index === activeIndex}
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => onSelect(account)}
            className={cn(
              "flex min-h-11 w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors",
              index === activeIndex ? "bg-[var(--noodle-accent)]/15" : "hover:bg-[var(--noodle-accent)]/10",
            )}
          >
            <Avatar account={account} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold">{account.displayName}</span>
              <span className="block truncate text-xs text-[var(--noodle-accent-foreground)]">@{account.handle}</span>
            </span>
          </button>
        ))
      ) : (
        <p className="px-3 py-2 text-xs text-[var(--muted-foreground)]">
          {localizeUi("ui.noodle.noodlementionsuggestions.noInvitedCharacterMatches")}
          {activeMention.query}.
        </p>
      )}
    </div>
  );
}

/**
 * The like count every surface shows (B35). The server's `likeCount` adds the silent crowd to the
 * real likes; a card without it (managed posts) counts the likes it has loaded.
 */
export function slpPostLikeCount(post: { likeCount?: number | null }, rootInteractions: SlpInteraction[]) {
  return typeof post.likeCount === "number" ? post.likeCount : countInteractions(rootInteractions, "like");
}

/**
 * Which reserved image slot a post shows: a picture still being drawn (by this client, deferred by
 * the server, or waiting for prompt review) shows to everyone; a failed one only to the operator.
 */
export function slpPostImageSlotState(
  post: { metadata?: Record<string, unknown> | null },
  generatingHere: boolean,
  operator = false,
): "pending" | "failed" | null {
  const meta = post.metadata ?? {};
  if (generatingHere || meta.imageGenerationDeferred === true || meta.imagePendingReview === true) return "pending";
  return meta.imageGenerationFailed === true && operator ? "failed" : null;
}

/**
 * Media frame of a post, with `slpPostFrameStyle` (V): the picture's own ratio between 4:5 and
 * 1.91:1, capped on wide screens. The picture, its loading state and the reserved image-generation
 * slot all use it, so nothing jumps when the picture lands.
 */
export const SLP_FEED_MEDIA_FRAME_CLASS = "mx-auto w-full";

/**
 * The one space between stacked cards: feed posts, ads, the suggested-creators row, profile posts and
 * search results. Cards in a list used to touch where an ad or a row sat inside a post's slot.
 */
export const SLP_CARD_STACK_CLASS = "flex flex-col gap-4";

/**
 * The reserved image slot (design 04 §12): a picture that is still being drawn, or one that
 * failed. Pending shows the same frame to everyone; failure is for the operator (Try again / Edit
 * prompt, the provider error behind Details).
 */
export function SlpPostImageSlot({
  state,
  countFromMount = false,
  error,
  onRetry,
  onEditPrompt,
  className,
  size,
}: {
  state: "pending" | "failed";
  /** The picture's size when known (a redraw): the slot keeps its ratio, else Slurp's default 4:5. */
  size?: { width?: number | null; height?: number | null } | null;
  /** Only a draw this client started has a known start; a server-deferred one shows no seconds. */
  countFromMount?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onEditPrompt?: () => void;
  className?: string;
}) {
  const { t: localizeUi } = useUiTranslation();
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (state !== "pending" || !countFromMount) return;
    const started = Date.now();
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [countFromMount, state]);
  if (state === "pending") {
    return (
      // Centred like the picture's own frame: a tall frame on a wide screen is narrower than the card.
      <div className={cn("flex justify-center overflow-hidden bg-black/20", className)}>
        <div
          role="status"
          data-slurp-image-slot="pending"
          className={cn(
            SLP_FEED_MEDIA_FRAME_CLASS,
            "relative isolate flex flex-col items-center justify-center gap-2 overflow-hidden bg-[var(--slurp-surface)] px-6 text-center",
          )}
          style={slpPostFrameStyle(slpPostMediaRatio(size))}
        >
          <span className="slp-image-shimmer -z-10" aria-hidden="true" />
          <SlpTwinkle />
          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--slurp-text)]">
            <Sparkle size={14} className="!text-[var(--noodle-accent)]" fill="currentColor" aria-hidden="true" />
            {localizeUi("ui.slurp.image.drawing", { defaultValue: "Drawing the picture…" })}
            {countFromMount && seconds > 0 && (
              <span className="ms-1.5 tabular-nums text-[var(--slurp-muted)]">
                {localizeUi("ui.slurp.image.elapsed", { defaultValue: "{{seconds}} s", seconds })}
              </span>
            )}
          </span>
        </div>
      </div>
    );
  }
  return (
    <div
      data-slurp-image-slot="failed"
      className={cn(
        "flex flex-col items-center gap-3 bg-[var(--slurp-surface)] px-5 py-6 text-center shadow-[inset_0_1px_0_var(--noodle-divider),inset_0_-1px_0_var(--noodle-divider)]",
        className,
      )}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--slurp-warning)_14%,transparent)] text-[var(--slurp-warning)] [&_svg]:!text-current">
        <ImageOff size={20} aria-hidden="true" />
      </span>
      <span className="space-y-1">
        <span className="block text-[15px] font-bold leading-5 text-[var(--slurp-text)]">
          {localizeUi("ui.slurp.image.failedTitle", { defaultValue: "Couldn't draw this picture" })}
        </span>
        <span className="block text-xs leading-4 text-[var(--slurp-muted)]">
          {localizeUi("ui.slurp.image.failedDetail", {
            defaultValue: "The post is safe. Only the picture is missing.",
          })}
        </span>
      </span>
      <span className="flex flex-wrap justify-center gap-2">
        {onRetry && (
          <SlpButton onClick={onRetry}>
            <RefreshCw size={16} aria-hidden="true" />
            {localizeUi("capabilities.actions.tryAgain")}
          </SlpButton>
        )}
        {onEditPrompt && (
          <SlpButton variant="tertiary" onClick={onEditPrompt}>
            <Pencil size={16} aria-hidden="true" />
            {localizeUi("ui.slurp.image.editPromptShort", { defaultValue: "Edit prompt" })}
          </SlpButton>
        )}
      </span>
      {error && (
        <details className="group w-full max-w-sm text-start">
          <summary className="mx-auto flex min-h-11 w-fit cursor-pointer list-none items-center gap-1 rounded-full px-3 text-xs font-semibold text-[var(--slurp-muted)] hover:text-[var(--slurp-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] [&::-webkit-details-marker]:hidden">
            {localizeUi("ui.slurp.image.details", { defaultValue: "Details" })}
            <ChevronDown size={14} className="transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <p className="mt-1 whitespace-pre-wrap break-words rounded-xl bg-[var(--slurp-canvas)] p-3 font-mono text-xs leading-5 text-[var(--slurp-muted)]">
            {error}
          </p>
        </details>
      )}
    </div>
  );
}

export function countInteractions(interactions: SlpInteraction[], type: SlpInteractionType) {
  return interactions.filter((interaction) => interaction.type === type).length;
}

export function createSlpLightboxImage(id: string, url: string, prompt = ""): ChatImage {
  const filename = url.split("?")[0]?.split("/").pop();
  const safeFilename = filename && /\.(?:avif|gif|jpe?g|png|webp)$/i.test(filename) ? filename : `noodle-${id}.png`;
  return {
    id,
    chatId: "noodle",
    filePath: safeFilename,
    prompt,
    provider: "",
    model: "",
    width: null,
    height: null,
    createdAt: "",
    url,
  };
}

/** The prompt the provider actually drew this post's picture from, else the draft it started as. */
export function slpPostImagePrompt(post: { imagePrompt?: string | null; metadata?: Record<string, unknown> | null }) {
  const sent = post.metadata?.imageProviderPrompt;
  return (typeof sent === "string" && sent.trim()) || post.imagePrompt || null;
}
