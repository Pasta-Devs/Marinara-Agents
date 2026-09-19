import { useState } from "react";
import { type NoodleAccount, type NoodleInteraction, type NoodleInteractionType } from "@marinara-engine/shared";
import { cn } from "../../../lib/utils";
import { NoodleTextContent } from "./SlpMarkdownRenderer";
import type { ConversationMediaPickerTab } from "../../../components/chat/ConversationMediaPickerPanel";
import type { ChatImage } from "../../../hooks/use-gallery";
import { Avatar } from "../../base/chrome/SlpChrome";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { ActiveComposerMention } from "./SlpPostTypes";

export type { NoodlePostCardModel, NoodlePostImageUpdate, NoodlePostCardCtx } from "./SlpPostTypes";
export type { NoodlePostCardControllerOptions } from "./SlpPostTypes";
export { NoodleToolButton, NoodleComposerToolRow, SlurpToolPopover } from "./SlpPostComposerTools";
export { useNoodlePostImageEditor, useNoodlePostCardController } from "./SlpPostHooks";
export { NoodleCustomEmojiText, NoodleTextContent } from "./SlpMarkdownRenderer";
export { NoodlePollCard } from "./SlpPollCard";
export { PostImageEditControls } from "./SlpPostImageEditControls";

export const fieldClass =
  "mari-chrome-field h-9 w-full min-w-0 rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] px-3 text-xs text-[var(--foreground)] outline-none transition-colors focus:border-[var(--noodle-accent)]";
export const textareaClass =
  "mari-chrome-field min-h-24 w-full min-w-0 resize-y rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] p-3 text-xs leading-relaxed text-[var(--foreground)] outline-none transition-colors focus:border-[var(--noodle-accent)]";
export const labelClass =
  "text-[0.68rem] font-semibold uppercase tracking-normal text-[var(--marinara-chat-chrome-panel-muted)]";
export const noodleIconButtonClass =
  "inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-lg px-3 text-xs font-semibold !text-[var(--noodle-accent)] transition-colors hover:bg-[var(--noodle-accent)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:!text-[var(--noodle-accent)]";
export const noodleCommentActionClass =
  "inline-flex h-7 items-center justify-center gap-1 rounded-full !text-[var(--noodle-accent-foreground)] transition-colors hover:bg-[var(--noodle-accent)]/10 active:bg-[var(--noodle-accent)]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]/70 disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:!text-[var(--noodle-accent-foreground)]";
/** Groups depth-first replies into top-level threads. Deeper replies stay flat inside their thread. */
export function slurpReplyThreads(orderedReplies: NoodleInteraction[], replyById: Map<string, NoodleInteraction>) {
  const threads: { root: NoodleInteraction; children: NoodleInteraction[] }[] = [];
  for (const reply of orderedReplies) {
    const parentId = reply.parentInteractionId;
    if (!parentId || !replyById.has(parentId) || threads.length === 0) threads.push({ root: reply, children: [] });
    else threads[threads.length - 1]!.children.push(reply);
  }
  return threads;
}

/** Post body that clamps long text behind a Show more toggle. */
export function SlurpClampedText(props: Parameters<typeof NoodleTextContent>[0] & { clampLength?: number }) {
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
        <NoodleTextContent {...props} />
      </div>
      {long && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="mt-1 rounded text-xs font-semibold text-[var(--noodle-accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
        >
          {expanded
            ? localizeUi("ui.noodle.noodlepostcard.showLess", { defaultValue: "Show less" })
            : localizeUi("ui.noodle.noodlepostcard.showMore", { defaultValue: "Show more" })}
        </button>
      )}
    </>
  );
}

export const NOODLE_MEDIA_PICKER_TABS: ConversationMediaPickerTab[] = [
  { id: "emoji", label: "Emoji" },
  { id: "gifs", label: "GIFs" },
  { id: "stickers", label: "Stickers" },
];
export const NOODLE_TEXT_MEDIA_PICKER_TABS: ConversationMediaPickerTab[] = [
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

export function NoodleMentionSuggestions({
  activeMention,
  activeIndex,
  accounts,
  listboxId,
  onSelect,
}: {
  activeMention: ActiveComposerMention | null;
  activeIndex: number;
  accounts: NoodleAccount[];
  listboxId: string;
  onSelect: (account: NoodleAccount) => void;
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
              <span className="block truncate text-[0.68rem] text-[var(--noodle-accent)]">@{account.handle}</span>
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

export function countInteractions(interactions: NoodleInteraction[], type: NoodleInteractionType) {
  return interactions.filter((interaction) => interaction.type === type).length;
}

export function createNoodleLightboxImage(id: string, url: string, prompt = ""): ChatImage {
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
