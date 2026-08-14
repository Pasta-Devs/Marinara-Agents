import {
  AtSign,
  Check,
  Crop,
  Heart,
  Image as ImageIcon,
  ImagePlus,
  ListChecks,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Repeat2,
  RotateCcw,
  Smile,
  Trash2,
  X,
} from "lucide-react";
import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import {
  canManageNoodleReply,
  findNoodleTextMentions,
  noodlePollInputSchema,
  readNoodlePostImageCrop,
  readNoodlePollFromMetadata,
  type NoodleAccount,
  type NoodleAuthorSnapshot,
  type NoodleInteraction,
  type NoodleInteractionType,
  type NoodlePoll,
  type NoodlePollInput,
  type NoodlePost,
  type NoodlePostImageCrop,
  type NoodleTextMention,
} from "@marinara-engine/shared";
import { cn } from "../../lib/utils";
import { renderInlineWithCustomEmojis } from "../../lib/custom-emoji-render";
import {
  ConversationMediaPickerPanel,
  type ConversationMediaPickerTab,
  type ConversationMediaPickerTabId,
} from "../chat/ConversationMediaPickerPanel";
import type { ChatImage } from "../../hooks/use-gallery";
import {
  Avatar,
  getNoodleAccentStyle,
  NOODLE_ICON_SCOPE_CLASS,
  useNoodleAccent,
} from "./NoodleShell";
import { formatTime } from "./NoodleDateTime";
import { NoodleImageComposer } from "./NoodleImageComposer";
import { NoodlePollComposer } from "./NoodlePollComposer";
import { PostImageCropEditor, PostImageFrame } from "./PostImageCropEditor";
import { useTranslation as useUiTranslation } from "react-i18next";

export const fieldClass =
  "mari-chrome-field h-9 w-full min-w-0 rounded-md border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] px-3 text-xs text-[var(--foreground)] outline-none transition-colors focus:border-[var(--noodle-accent)]";
export const textareaClass =
  "mari-chrome-field min-h-24 w-full min-w-0 resize-y rounded-md border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] p-3 text-xs leading-relaxed text-[var(--foreground)] outline-none transition-colors focus:border-[var(--noodle-accent)]";
export const labelClass =
  "text-[0.68rem] font-semibold uppercase tracking-normal text-[var(--marinara-chat-chrome-panel-muted)]";
export const noodleIconButtonClass =
  "inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-md px-2 text-xs font-medium !text-[var(--noodle-accent)] transition-colors hover:bg-[var(--noodle-accent)]/10 disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:!text-[var(--noodle-accent)]";
export const noodleCommentActionClass =
  "inline-flex h-7 items-center justify-center gap-1 rounded-full !text-[var(--noodle-accent-foreground)] transition-colors hover:bg-[var(--noodle-accent)]/10 active:bg-[var(--noodle-accent)]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]/70 disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:!text-[var(--noodle-accent-foreground)]";
export const NOODLE_MEDIA_PICKER_TABS: ConversationMediaPickerTab[] = [
  { id: "emoji", label: "Emoji" },
  { id: "gifs", label: "GIFs" },
  { id: "stickers", label: "Stickers" },
];
export const NOODLE_TEXT_MEDIA_PICKER_TABS: ConversationMediaPickerTab[] = [
  { id: "emoji", label: "Emoji" },
  { id: "stickers", label: "Stickers" },
];
type ReplyComposerTool = "image" | "media";
type ActiveComposerMention = NoodleTextMention & { query: string };

export function NoodleCustomEmojiText({
  text,
  emojiMap,
  keyPrefix,
}: {
  text: string;
  emojiMap: Map<string, string>;
  keyPrefix: string;
}) {
  return (
    <>
      {renderInlineWithCustomEmojis(
        text,
        keyPrefix,
        emojiMap,
        (segment, key) => [<Fragment key={key}>{segment}</Fragment>],
      )}
    </>
  );
}
export function insertAtSelection(
  value: string,
  insertion: string,
  start: number,
  end: number,
) {
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
      aria-label={localizeUi(
        "ui.noodle.noodlementionsuggestions.tagACharacter",
      )}
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
              index === activeIndex
                ? "bg-[var(--noodle-accent)]/15"
                : "hover:bg-[var(--noodle-accent)]/10",
            )}
          >
            <Avatar account={account} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold">
                {account.displayName}
              </span>
              <span className="block truncate text-[0.68rem] text-[var(--noodle-accent)]">
                @{account.handle}
              </span>
            </span>
          </button>
        ))
      ) : (
        <p className="px-3 py-2 text-xs text-[var(--muted-foreground)]">
          {localizeUi(
            "ui.noodle.noodlementionsuggestions.noInvitedCharacterMatches",
          )}
          {activeMention.query}.
        </p>
      )}
    </div>
  );
}

export function NoodleTextContent({
  content,
  accountByHandle,
  onOpenProfile,
  className,
}: {
  content: string;
  accountByHandle: Map<string, NoodleAccount>;
  onOpenProfile: (account: NoodleAccount) => void;
  className?: string;
}) {
  const { t: localizeUi, i18n } = useUiTranslation();
  // The public timeline renders 150+ of these, and the parse ran on every render of
  // every card — the reason returning to Noodle from NoodleR felt slow while the trip
  // out did not. The parse output embeds these callbacks, so memoizing on them
  // directly would either miss every time (they are fresh each render) or freeze a
  // stale handler into the tree. Hold them in a ref and hand the parser a stable
  // wrapper instead; then the only real inputs are the text and the handle map.
  const handlers = useRef({ onOpenProfile, localizeUi });
  handlers.current = { onOpenProfile, localizeUi };
  const rendered = useMemo(
    () =>
      renderNoodleMarkdown(content, {
        accountByHandle,
        onOpenProfile: (account) => handlers.current.onOpenProfile(account),
        mentionLabel: (handle) =>
          handlers.current.localizeUi(
            "ui.noodle.noodletextcontent.viewValue1Profile",
            { value1: handle },
          ),
      }),
    // The label text is baked in at parse time, so a language change has to reparse.
    [content, accountByHandle, i18n.language],
  );
  return <div className={cn("text-sm [&>*+*]:mt-2", className)}>{rendered}</div>;
}

type NoodleMarkdownContext = {
  accountByHandle: Map<string, NoodleAccount>;
  onOpenProfile: (account: NoodleAccount) => void;
  mentionLabel: (handle: string) => string;
};

function renderNoodleMarkdown(
  content: string,
  context: NoodleMarkdownContext,
): React.ReactNode[] {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const parts: React.ReactNode[] = [];
  let lineIndex = 0;

  while (lineIndex < lines.length) {
    const line = lines[lineIndex] ?? "";
    if (!line.trim()) {
      lineIndex += 1;
      continue;
    }

    const fence = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      const marker = fence[1]![0]!;
      const minimumLength = fence[1]!.length;
      const closingFence = new RegExp(`^ {0,3}${marker}{${minimumLength},}\\s*$`);
      const codeLines: string[] = [];
      lineIndex += 1;
      while (
        lineIndex < lines.length &&
        !closingFence.test(lines[lineIndex] ?? "")
      ) {
        codeLines.push(lines[lineIndex] ?? "");
        lineIndex += 1;
      }
      if (lineIndex < lines.length) lineIndex += 1;
      parts.push(
        <pre
          key={`code:${lineIndex}`}
          className="overflow-x-auto whitespace-pre rounded-md bg-foreground/10 p-3 text-xs leading-5"
        >
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    const heading = line.match(/^ {0,3}(#{1,6})\s+(.+?)\s*#*$/);
    if (heading) {
      const level = heading[1]!.length;
      const headingContent = renderNoodleInlineMarkdown(
        heading[2]!,
        context,
        `heading:${lineIndex}`,
      );
      const headingClass = cn(
        "break-words font-bold",
        level === 1 && "text-xl leading-7",
        level === 2 && "text-lg leading-7",
        level >= 3 && "text-base leading-6",
      );
      parts.push(
        level === 1 ? (
          <h1 key={`heading:${lineIndex}`} className={headingClass}>
            {headingContent}
          </h1>
        ) : level === 2 ? (
          <h2 key={`heading:${lineIndex}`} className={headingClass}>
            {headingContent}
          </h2>
        ) : level === 3 ? (
          <h3 key={`heading:${lineIndex}`} className={headingClass}>
            {headingContent}
          </h3>
        ) : level === 4 ? (
          <h4 key={`heading:${lineIndex}`} className={headingClass}>
            {headingContent}
          </h4>
        ) : level === 5 ? (
          <h5 key={`heading:${lineIndex}`} className={headingClass}>
            {headingContent}
          </h5>
        ) : (
          <h6 key={`heading:${lineIndex}`} className={headingClass}>
            {headingContent}
          </h6>
        ),
      );
      lineIndex += 1;
      continue;
    }

    if (/^ {0,3}>/.test(line)) {
      const quoteLines: string[] = [];
      while (
        lineIndex < lines.length &&
        /^ {0,3}>/.test(lines[lineIndex] ?? "")
      ) {
        quoteLines.push((lines[lineIndex] ?? "").replace(/^ {0,3}> ?/, ""));
        lineIndex += 1;
      }
      parts.push(
        <blockquote
          key={`quote:${lineIndex}`}
          className="border-l-2 border-[var(--noodle-divider)] pl-3 text-[var(--muted-foreground)]"
        >
          {renderNoodleMarkdown(quoteLines.join("\n"), context)}
        </blockquote>,
      );
      continue;
    }

    const listMatch = line.match(/^ {0,3}(?:(\d+)[.)]|([-+*]))\s+(.+)$/);
    if (listMatch) {
      const ordered = Boolean(listMatch[1]);
      const start = ordered ? Number(listMatch[1]) : undefined;
      const items: React.ReactNode[] = [];
      while (lineIndex < lines.length) {
        const item = (lines[lineIndex] ?? "").match(
          /^ {0,3}(?:(\d+)[.)]|([-+*]))\s+(.+)$/,
        );
        if (!item || Boolean(item[1]) !== ordered) break;
        items.push(
          <li key={`item:${lineIndex}`} className="pl-1">
            {renderNoodleInlineMarkdown(item[3]!, context, `item:${lineIndex}`)}
          </li>,
        );
        lineIndex += 1;
      }
      parts.push(
        ordered ? (
          <ol
            key={`list:${lineIndex}`}
            start={start}
            className="list-decimal space-y-1 pl-6"
          >
            {items}
          </ol>
        ) : (
          <ul key={`list:${lineIndex}`} className="list-disc space-y-1 pl-6">
            {items}
          </ul>
        ),
      );
      continue;
    }

    const paragraphLines = [line];
    lineIndex += 1;
    while (
      lineIndex < lines.length &&
      (lines[lineIndex] ?? "").trim() &&
      !isNoodleMarkdownBlockStart(lines[lineIndex] ?? "")
    ) {
      paragraphLines.push(lines[lineIndex] ?? "");
      lineIndex += 1;
    }
    parts.push(
      <p
        key={`paragraph:${lineIndex}`}
        className="whitespace-pre-wrap break-words"
      >
        {renderNoodleInlineMarkdown(
          paragraphLines.join("\n"),
          context,
          `paragraph:${lineIndex}`,
        )}
      </p>,
    );
  }

  return parts;
}

function isNoodleMarkdownBlockStart(line: string) {
  return /^(?: {0,3}(?:#{1,6}\s+|>|`{3,}|~{3,}|(?:(?:\d+)[.)]|[-+*])\s+))/.test(
    line,
  );
}

function renderNoodleInlineMarkdown(
  text: string,
  context: NoodleMarkdownContext,
  keyPrefix: string,
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let plain = "";
  let index = 0;

  const flushPlain = () => {
    if (!plain) return;
    parts.push(
      ...renderNoodleMentionText(
        plain,
        context,
        `${keyPrefix}:text:${index - plain.length}`,
      ),
    );
    plain = "";
  };

  while (index < text.length) {
    if (text[index] === "\\" && index + 1 < text.length) {
      plain += text[index + 1];
      index += 2;
      continue;
    }

    if (text[index] === "`") {
      const markerLength = text.slice(index).match(/^`+/)?.[0].length ?? 1;
      const marker = "`".repeat(markerLength);
      const end = text.indexOf(marker, index + markerLength);
      if (end >= 0) {
        flushPlain();
        parts.push(
          <code
            key={`${keyPrefix}:code:${index}`}
            className="whitespace-pre-wrap rounded bg-foreground/10 px-1 py-0.5 font-mono text-[0.9em]"
          >
            {text.slice(index + markerLength, end).replace(/\n/g, " ")}
          </code>,
        );
        index = end + markerLength;
        continue;
      }
    }

    const image = readNoodleMarkdownLabel(text, index, true);
    if (image) {
      flushPlain();
      parts.push(
        <Fragment key={`${keyPrefix}:image:${index}`}>
          {renderNoodleInlineMarkdown(
            image.label,
            context,
            `${keyPrefix}:image-label:${index}`,
          )}
        </Fragment>,
      );
      index = image.end;
      continue;
    }

    const link = readNoodleMarkdownLabel(text, index, false);
    if (link) {
      flushPlain();
      parts.push(
        <Fragment key={`${keyPrefix}:link:${index}`}>
          {renderNoodleInlineMarkdown(
            link.label,
            context,
            `${keyPrefix}:link-label:${index}`,
          )}
        </Fragment>,
      );
      index = link.end;
      continue;
    }

    const delimiter = text.startsWith("**", index)
      ? "**"
      : text.startsWith("__", index)
        ? "__"
        : text.startsWith("~~", index)
          ? "~~"
          : text[index] === "*" || text[index] === "_"
            ? text[index]!
            : null;
    if (delimiter) {
      // CommonMark forbids intraword `_`/`__` emphasis (but allows `*`), so
      // text like `noodle_post_id` must stay literal.
      const isUnderscore = delimiter === "_" || delimiter === "__";
      const openerOk =
        !isUnderscore || index === 0 || !isMarkdownWordChar(text[index - 1]!);
      const end = openerOk
        ? text.indexOf(delimiter, index + delimiter.length)
        : -1;
      const closerOk =
        !isUnderscore ||
        end + delimiter.length >= text.length ||
        !isMarkdownWordChar(text[end + delimiter.length]!);
      if (end > index + delimiter.length && closerOk) {
        flushPlain();
        const children = renderNoodleInlineMarkdown(
          text.slice(index + delimiter.length, end),
          context,
          `${keyPrefix}:format:${index}`,
        );
        parts.push(
          delimiter === "**" || delimiter === "__" ? (
            <strong key={`${keyPrefix}:strong:${index}`}>{children}</strong>
          ) : delimiter === "~~" ? (
            <del key={`${keyPrefix}:del:${index}`}>{children}</del>
          ) : (
            <em key={`${keyPrefix}:em:${index}`}>{children}</em>
          ),
        );
        index = end + delimiter.length;
        continue;
      }
    }

    plain += text[index];
    index += 1;
  }

  flushPlain();
  return parts;
}

function isMarkdownWordChar(ch: string): boolean {
  return /[\p{L}\p{N}]/u.test(ch);
}

function readNoodleMarkdownLabel(
  text: string,
  start: number,
  image: boolean,
): { label: string; end: number } | null {
  const labelStart = start + (image ? 2 : 1);
  if (image ? !text.startsWith("![", start) : text[start] !== "[") return null;
  let labelEnd = labelStart;
  while (labelEnd < text.length && text[labelEnd] !== "]") labelEnd += 1;
  if (labelEnd >= text.length || text[labelEnd + 1] !== "(") return null;

  let destinationEnd = labelEnd + 2;
  let depth = 1;
  while (destinationEnd < text.length && depth > 0) {
    if (text[destinationEnd] === "\\") destinationEnd += 1;
    else if (text[destinationEnd] === "(") depth += 1;
    else if (text[destinationEnd] === ")") depth -= 1;
    destinationEnd += 1;
  }
  if (depth !== 0) return null;
  return { label: text.slice(labelStart, labelEnd), end: destinationEnd };
}

function renderNoodleMentionText(
  text: string,
  context: NoodleMarkdownContext,
  keyPrefix: string,
): React.ReactNode[] {
  const mentions = findNoodleTextMentions(text);
  if (mentions.length === 0) return [text];

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const mention of mentions) {
    if (mention.start > cursor) parts.push(text.slice(cursor, mention.start));
    const label = text.slice(mention.start, mention.end);
    const account = context.accountByHandle.get(mention.handle);
    parts.push(
      account ? (
        <button
          key={`${keyPrefix}:${mention.start}:${mention.handle}`}
          type="button"
          onClick={() => context.onOpenProfile(account)}
          className="inline font-semibold text-[var(--noodle-accent)] hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]/70"
          aria-label={context.mentionLabel(account.handle)}
        >
          {label}
        </button>
      ) : (
        label
      ),
    );
    cursor = mention.end;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

export function NoodlePollCard({
  poll,
  votes,
  accountById,
  selectedOptionId,
  disabled,
  pending,
  onVote,
  onOpenProfile,
}: {
  poll: NoodlePoll;
  votes: NoodleInteraction[];
  accountById: Map<string, NoodleAccount>;
  selectedOptionId: string | null;
  disabled: boolean;
  pending: boolean;
  onVote: (optionId: string) => void;
  onOpenProfile: (account: NoodleAccount) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const totalVotes = votes.length;
  const [showVoters, setShowVoters] = useState(false);
  return (
    <section
      className="mt-3"
      aria-label={localizeUi("ui.noodle.noodlepollcard.pollValue1", {
        value1: poll.question,
      })}
      data-noodle-poll
    >
      <h3 className="text-sm font-bold leading-5">{poll.question}</h3>
      <div className="mt-2 space-y-2">
        {poll.options.map((option) => {
          const matchingVotes = votes.filter(
            (vote) => vote.content === option.id,
          );
          const optionVotes = matchingVotes.length;
          const percentage =
            totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;
          const selected = selectedOptionId === option.id;
          return (
            <div key={option.id} className="space-y-1.5">
              <button
                type="button"
                onClick={() => onVote(option.id)}
                disabled={disabled || pending}
                aria-pressed={selected}
                aria-label={localizeUi(
                  "ui.noodle.noodlepollcard.value1Value2Value3Value4",
                  {
                    value1: option.label,
                    value2: optionVotes,
                    value3:
                      optionVotes === 1
                        ? localizeUi("ui.noodle.noodlepollcard.vote")
                        : localizeUi("ui.noodle.noodlepollcard.votes"),
                    value4: percentage,
                  },
                )}
                className={cn(
                  "relative flex min-h-10 w-full items-center overflow-hidden rounded-lg border px-3 text-left text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:cursor-not-allowed",
                  selected
                    ? "border-[var(--noodle-accent)] bg-[var(--noodle-accent)]/10"
                    : "border-[var(--noodle-divider)] hover:border-[var(--noodle-accent)]/55 hover:bg-[var(--noodle-accent)]/5",
                )}
                data-noodle-poll-option={option.id}
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-0 origin-left bg-[var(--noodle-accent)]/15 transition-transform duration-300 ease-out"
                  style={{ transform: `scaleX(${percentage / 100})` }}
                />
                <span className="relative flex min-w-0 flex-1 items-center gap-2">
                  {selected && (
                    <Check
                      size={14}
                      className="shrink-0 text-[var(--noodle-accent)]"
                    />
                  )}
                  <span className="min-w-0 flex-1 break-words">
                    {option.label}
                  </span>
                  <span className="shrink-0 text-[var(--muted-foreground)]">
                    {percentage}%
                  </span>
                </span>
              </button>
              {showVoters && optionVotes > 0 && (
                <div
                  className="flex flex-wrap gap-1 px-2"
                  aria-label={localizeUi(
                    "ui.noodle.noodlepollcard.votersForValue1",
                    { value1: option.label },
                  )}
                >
                  {matchingVotes.map((vote) => {
                    const voterAccount =
                      accountById.get(vote.actorAccountId) ?? null;
                    const voter = voterAccount ?? vote.actorSnapshot;
                    return voter ? (
                      <button
                        key={vote.id}
                        type="button"
                        onClick={() => {
                          if (voterAccount) onOpenProfile(voterAccount);
                        }}
                        disabled={!voterAccount}
                        className="inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full bg-[var(--noodle-accent)]/8 pr-2 text-[0.6875rem] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--noodle-accent)]/15 hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]/70 disabled:cursor-default"
                      >
                        <Avatar account={voter} size="sm" />
                        <span className="max-w-32 truncate">
                          @{voter.handle}
                        </span>
                      </button>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => setShowVoters((visible) => !visible)}
        aria-expanded={showVoters}
        className="mt-2 rounded-sm text-[0.68rem] text-[var(--muted-foreground)] transition-colors hover:text-[var(--noodle-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]/70"
      >
        {totalVotes}{" "}
        {totalVotes === 1
          ? localizeUi("ui.noodle.noodlepollcard.vote")
          : localizeUi("ui.noodle.noodlepollcard.votes")}
        {selectedOptionId
          ? localizeUi("ui.noodle.noodlepollcard.youVoted_80cf257")
          : ""}
        {pending ? localizeUi("ui.noodle.poll.savingSuffix") : ""}
        {totalVotes > 0
          ? showVoters
            ? localizeUi("ui.noodle.poll.hideVotersSuffix")
            : localizeUi("ui.noodle.poll.viewVotersSuffix")
          : ""}
      </button>
    </section>
  );
}

export function countInteractions(
  interactions: NoodleInteraction[],
  type: NoodleInteractionType,
) {
  return interactions.filter((interaction) => interaction.type === type).length;
}

export function createNoodleLightboxImage(
  id: string,
  url: string,
  prompt = "",
): ChatImage {
  const filename = url.split("?")[0]?.split("/").pop();
  const safeFilename =
    filename && /\.(?:avif|gif|jpe?g|png|webp)$/i.test(filename)
      ? filename
      : `noodle-${id}.png`;
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

export function NoodleToolButton({
  active,
  title,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={disabled}
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full p-0 !text-[var(--noodle-accent)] transition-colors active:scale-95 [&_svg]:!text-[var(--noodle-accent)]",
        disabled
          ? "cursor-not-allowed opacity-40"
          : active
            ? "bg-[var(--noodle-accent)]/15 ring-1 ring-[var(--noodle-accent)]/25"
            : "hover:bg-[var(--noodle-accent)]/10",
      )}
    >
      {children}
    </button>
  );
}

type NoodleComposerTool = {
  ref?: RefObject<HTMLDivElement | null>;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
};

// Shared composer icon row (image / poll / emoji) so every Noodle surface renders
// the identical toolbar. NoodleR passes a trailing coin control for monetization settings.
export function NoodleComposerToolRow({
  image,
  poll,
  media,
  trailing,
}: {
  image: NoodleComposerTool;
  poll: NoodleComposerTool;
  media: NoodleComposerTool;
  trailing?: React.ReactNode;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <>
      <div ref={image.ref} className="relative">
        <NoodleToolButton
          title={localizeUi("ui.noodle.noodlehome.attachImage")}
          active={Boolean(image.active)}
          disabled={image.disabled}
          onClick={() => image.onClick?.()}
        >
          <ImageIcon size={18} />
        </NoodleToolButton>
      </div>
      <div ref={poll.ref} className="relative">
        <NoodleToolButton
          title={
            poll.active
              ? localizeUi("ui.noodle.noodlehome.editPoll")
              : localizeUi("ui.noodle.noodlehome.createPoll")
          }
          active={Boolean(poll.active)}
          disabled={poll.disabled}
          onClick={() => poll.onClick?.()}
        >
          <ListChecks size={18} />
        </NoodleToolButton>
      </div>
      <div ref={media.ref} className="relative">
        <NoodleToolButton
          title={localizeUi("ui.noodle.noodlehome.emojiGifsAndStickers")}
          active={Boolean(media.active)}
          disabled={media.disabled}
          onClick={() => media.onClick?.()}
        >
          <Smile size={18} />
        </NoodleToolButton>
      </div>
      {trailing}
    </>
  );
}

export function NoodleAnchoredPopover({
  anchorRef,
  children,
  wide,
  modalOwned = false,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
  wide?: boolean;
  modalOwned?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const accent = useNoodleAccent();

  useLayoutEffect(() => {
    const updatePosition = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const anchorRect = anchor.getBoundingClientRect();
      const panelWidth = panelRef.current?.offsetWidth ?? (wide ? 384 : 304);
      const panelHeight = panelRef.current?.offsetHeight ?? 0;
      const padding = 16;
      const maxLeft = Math.max(
        padding,
        window.innerWidth - panelWidth - padding,
      );
      const centeredLeft =
        anchorRect.left + anchorRect.width / 2 - panelWidth / 2;
      const belowTop = anchorRect.bottom + 12;
      const aboveTop = anchorRect.top - panelHeight - 12;
      setPosition({
        left: Math.min(Math.max(centeredLeft, padding), maxLeft),
        top:
          panelHeight > 0 &&
          belowTop + panelHeight + padding > window.innerHeight
            ? Math.max(padding, aboveTop)
            : belowTop,
      });
    };

    updatePosition();
    const frame = window.requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchorRef, wide]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={panelRef}
      data-noodle-compose-focus-portal={modalOwned ? "true" : undefined}
      className={cn(
        "fixed max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto",
        modalOwned ? "z-[10001]" : "z-[80]",
        NOODLE_ICON_SCOPE_CLASS,
        wide ? "w-[18rem] sm:w-[24rem]" : "w-[19rem]",
      )}
      style={getNoodleAccentStyle(accent, {
        left: position?.left ?? -9999,
        top: position?.top ?? -9999,
        opacity: position ? 1 : 0,
      })}
    >
      {children}
    </div>,
    document.body,
  );
}

export function NoodlerToolPopover({
  title,
  onClose,
  children,
  wide,
  anchorRef,
  modalOwned,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  modalOwned?: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <NoodleAnchoredPopover
      anchorRef={anchorRef}
      wide={wide}
      modalOwned={modalOwned}
    >
      <div className="marinara-chat-popover flex h-[22rem] max-h-[60vh] flex-col overflow-hidden rounded-xl border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] text-[var(--foreground)] shadow-2xl shadow-black/35">
        <div className="flex shrink-0 items-center gap-1 border-b border-foreground/10 px-2 py-1.5">
          <span className="flex-1 rounded-md bg-foreground/10 px-2 py-1 text-center text-xs font-medium text-foreground/80 ring-1 ring-foreground/15">
            {title}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--noodle-accent)] transition-colors hover:bg-foreground/10"
            title={localizeUi("capabilities.actions.close")}
          >
            <X size={14} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">{children}</div>
      </div>
    </NoodleAnchoredPopover>
  );
}

/**
 * Reply image attach/upload/lightbox. Hosts that persist reply images pass this; hosts that
 * don't (NoodleR) omit it — the card then hides the attach-image tool, upload, GIF tab, and
 * lightbox instead of the host having to pass discarded setters and dangling refs.
 */
interface NoodlePostCardMediaCap {
  setImageLightbox: React.Dispatch<React.SetStateAction<ChatImage | null>>;
  replyImageUrl: string;
  setReplyImageUrl: React.Dispatch<React.SetStateAction<string>>;
  replyImageUrlDraft: string;
  setReplyImageUrlDraft: React.Dispatch<React.SetStateAction<string>>;
  replyImageToolRef: RefObject<HTMLDivElement | null>;
  replyImageFileRef: RefObject<HTMLInputElement | null>;
  applyReplyImageUrl: () => void;
  uploadGlobalImages: { isPending: boolean };
}

/** Editing/deleting replies. Omit on hosts without a reply-management path (NoodleR). */
interface NoodlePostCardReplyManagementCap {
  editingReplyId: string | null;
  editingReplyContent: string;
  setEditingReplyContent: React.Dispatch<React.SetStateAction<string>>;
  startEditingReply: (reply: NoodleInteraction) => void;
  cancelEditingReply: () => void;
  saveEditedReply: (
    post: NoodlePostCardModel,
    reply: NoodleInteraction,
  ) => void;
  deleteNoodleReply: (
    post: NoodlePostCardModel,
    reply: NoodleInteraction,
  ) => void;
  updateInteraction: { isPending: boolean };
  deleteInteraction: { isPending: boolean };
  /** Gate reply Edit/Delete. Omit for the default author-based check. */
  canManageReply?: (reply: NoodleInteraction) => boolean;
}

/** @mention autocomplete in the reply composer. Omit on hosts without mentions (NoodleR). */
interface NoodlePostCardMentionsCap {
  activeReplyMention: ActiveComposerMention | null;
  activeReplyMentionIndex: number;
  replyMentionSuggestions: NoodleAccount[];
  selectReplyMention: (account: NoodleAccount) => void;
}

type NoodlePostCardAuthor = Pick<
  NoodleAuthorSnapshot,
  "id" | "handle" | "displayName" | "avatarUrl" | "avatarCrop"
>;
export type NoodlePostCardModel = Pick<
  NoodlePost,
  | "id"
  | "authorAccountId"
  | "content"
  | "imageUrl"
  | "imagePrompt"
  | "metadata"
  | "createdAt"
  | "access"
> & {
  title: string | null;
  authorSnapshot: NoodlePostCardAuthor | null;
  interactions: NoodleInteraction[];
};

interface NoodlePostCardTitleEditingCap {
  editingPostTitle: string;
  setEditingPostTitle: React.Dispatch<React.SetStateAction<string>>;
  maxLength: number;
}

export type NoodlePostImageUpdate =
  | { kind: "replace"; file: File; crop: NoodlePostImageCrop }
  | { kind: "crop"; crop: NoodlePostImageCrop }
  | { kind: "remove" };

type NoodlePostImageCropSource =
  | {
      source: File | string;
      crop: NoodlePostImageCrop | null;
      mode: "existing";
    }
  | { source: File; crop: NoodlePostImageCrop | null; mode: "replace" };

interface NoodlePostCardImageEditingCap {
  update: NoodlePostImageUpdate | null;
  cropSource: NoodlePostImageCropSource | null;
  loading: boolean;
  error: string | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  beginCrop: (post: NoodlePostCardModel) => void;
  selectReplacement: (event: ChangeEvent<HTMLInputElement>) => void;
  applyCrop: (crop: NoodlePostImageCrop) => Promise<void>;
  cancelCrop: () => void;
  remove: () => void;
  restore: () => void;
}

export function PostImageEditControls({
  post,
  editing,
  disabled,
  footer,
}: {
  post: NoodlePostCardModel;
  editing: NoodlePostCardImageEditingCap;
  disabled: boolean;
  footer: React.ReactNode;
}) {
  const { t: localizeUi } = useUiTranslation();
  const replacement =
    editing.update?.kind === "replace" ? editing.update : null;
  const removed = editing.update?.kind === "remove";
  const hasImage = Boolean(replacement || (!removed && post.imageUrl));

  if (editing.cropSource) {
    return (
      <PostImageCropEditor
        source={editing.cropSource.source}
        crop={editing.cropSource.crop}
        disabled={disabled}
        onCancel={editing.cancelCrop}
        onApply={editing.applyCrop}
      />
    );
  }

  const imageActions =
    hasImage && !removed ? (
      <div className="absolute right-2 top-2 z-10 flex items-center gap-0.5 rounded-full bg-[var(--background)] p-1 shadow-lg ring-1 ring-[var(--noodle-divider)]">
        <button
          type="button"
          onClick={() => editing.beginCrop(post)}
          disabled={disabled || editing.loading}
          title={
            editing.loading
              ? localizeUi("ui.noodle.postimageeditcontrols.loadingImage")
              : localizeUi("ui.noodle.noodlehome.adjustCrop")
          }
          aria-label={
            editing.loading
              ? localizeUi("ui.noodle.postimageeditcontrols.loadingImage")
              : localizeUi("ui.noodle.noodlehome.adjustCrop")
          }
          aria-busy={editing.loading}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--noodle-accent)] transition-colors hover:bg-[var(--noodle-accent)]/10 disabled:opacity-50"
        >
          {editing.loading ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Crop size={15} />
          )}
        </button>
        <button
          type="button"
          onClick={editing.remove}
          disabled={disabled || editing.loading}
          title={localizeUi("ui.noodle.noodlehome.removeImage")}
          aria-label={localizeUi("ui.noodle.noodlehome.removeImage")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/10 disabled:opacity-50"
        >
          <Trash2 size={15} />
        </button>
      </div>
    ) : null;

  return (
    <section className="space-y-2 rounded-xl border border-[var(--noodle-divider)] bg-[var(--noodle-accent)]/5 p-3">
      <input
        ref={editing.fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={editing.selectReplacement}
      />
      <div className="flex items-center justify-between gap-3">
        <span className={labelClass}>
          {localizeUi("ui.noodle.postimageeditcontrols.postImage")}
        </span>
        <div className="flex items-center gap-1">
          {removed ? (
            <>
              <span className="mr-1 text-xs font-semibold text-[var(--muted-foreground)]">
                {localizeUi("ui.noodle.postimageeditcontrols.removedWhenSaved")}
              </span>
              <button
                type="button"
                onClick={() => editing.fileInputRef.current?.click()}
                disabled={disabled || editing.loading}
                title={localizeUi(
                  "ui.noodle.postimageeditcontrols.attachReplacementImage",
                )}
                aria-label={localizeUi(
                  "ui.noodle.postimageeditcontrols.attachReplacementImage",
                )}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--noodle-divider)] text-[var(--noodle-accent)] transition-colors hover:bg-[var(--noodle-accent)]/10 disabled:opacity-50"
              >
                <ImagePlus size={15} />
              </button>
              <button
                type="button"
                onClick={editing.restore}
                disabled={disabled}
                title={localizeUi(
                  "ui.noodle.postimageeditcontrols.undoImageRemoval",
                )}
                aria-label={localizeUi(
                  "ui.noodle.postimageeditcontrols.undoImageRemoval",
                )}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--noodle-divider)] text-[var(--noodle-accent)] transition-colors hover:bg-[var(--noodle-accent)]/10 disabled:opacity-50"
              >
                <RotateCcw size={15} />
              </button>
            </>
          ) : (
            <>
              {!hasImage && (
                <button
                  type="button"
                  onClick={() => editing.fileInputRef.current?.click()}
                  disabled={disabled || editing.loading}
                  title={localizeUi("ui.noodle.postimageeditcontrols.addImage")}
                  aria-label={localizeUi(
                    "ui.noodle.postimageeditcontrols.addImage",
                  )}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--noodle-divider)] text-[var(--noodle-accent)] transition-colors hover:bg-[var(--noodle-accent)]/10 disabled:opacity-50"
                >
                  <ImagePlus size={15} />
                </button>
              )}
            </>
          )}
        </div>
      </div>
      {replacement ? (
        <div className="relative overflow-hidden rounded-lg">
          <FileImagePreview file={replacement.file} crop={replacement.crop} />
          {imageActions}
        </div>
      ) : !removed && post.imageUrl ? (
        <div className="relative overflow-hidden rounded-lg">
          <PostImageFrame
            src={post.imageUrl}
            crop={
              editing.update?.kind === "crop"
                ? editing.update.crop
                : readNoodlePostImageCrop(post.metadata)
            }
            alt={localizeUi("ui.noodle.postimageeditcontrols.currentPost")}
            maxHeight={240}
          />
          {imageActions}
        </div>
      ) : (
        <div className="grid min-h-24 place-items-center rounded-lg border border-dashed border-[var(--noodle-divider)] text-xs text-[var(--muted-foreground)]">
          {localizeUi("ui.noodle.postimageeditcontrols.noImageAttached")}
        </div>
      )}
      {editing.error && (
        <p role="alert" className="text-xs text-[var(--destructive)]">
          {editing.error}
        </p>
      )}
      <div className="-mx-3 -mb-3 flex flex-wrap justify-end gap-2 px-3 pb-3 pt-1">
        {footer}
      </div>
    </section>
  );
}

function FileImagePreview({
  file,
  crop,
}: {
  file: File;
  crop: NoodlePostImageCrop;
}) {
  const { t: localizeUi } = useUiTranslation();
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    <PostImageFrame
      src={url}
      crop={crop}
      alt={localizeUi("ui.noodle.fileimagepreview.replacementPostPreview")}
      maxHeight={240}
    />
  );
}

export interface NoodlePostCardCtx {
  accountById?: Map<string, NoodleAccount>;
  accountByHandle?: Map<string, NoodleAccount>;
  personaAccount: NoodleAccount | null;
  postMenuId: string | null;
  setPostMenuId: React.Dispatch<React.SetStateAction<string | null>>;
  editingPostId: string | null;
  editingPostContent: string;
  setEditingPostContent: React.Dispatch<React.SetStateAction<string>>;
  replyPostId: string | null;
  replyParentInteractionId: string | null;
  replyText: string;
  replyHasText: boolean;
  setReplyText: React.Dispatch<React.SetStateAction<string>>;
  activeReplyComposerTool: ReplyComposerTool | null;
  setActiveReplyComposerTool: React.Dispatch<
    React.SetStateAction<ReplyComposerTool | null>
  >;
  highlightedInteractionId: string | null;
  mediaPickerTab: ConversationMediaPickerTabId;
  setMediaPickerTab: React.Dispatch<
    React.SetStateAction<ConversationMediaPickerTabId>
  >;
  replyComposerRef: RefObject<HTMLTextAreaElement | null>;
  replyValueRef: RefObject<string>;
  replyMediaToolRef: RefObject<HTMLDivElement | null>;
  startEditingPost: (post: NoodlePostCardModel) => void;
  deleteNoodlePost: (post: NoodlePostCardModel) => void;
  cancelEditingPost: () => void;
  saveEditedPost: (post: NoodlePostCardModel) => void;
  reactToPost: (
    post: NoodlePostCardModel,
    type: "like" | "repost",
    active?: boolean,
  ) => void;
  reactToReply: (
    post: NoodlePostCardModel,
    target: NoodleInteraction,
    active: boolean,
  ) => void;
  openReplyComposer: (
    postId: string,
    parentInteractionId?: string | null,
  ) => void;
  handleReplyChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  /** Reply composer keydown (mention nav / submit shortcuts). Omit on hosts without them. */
  handleReplyKeyDown?: (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => void;
  clearReplyComposer: () => void;
  submitReply: (post: NoodlePostCardModel) => void;
  appendToReply: (text: string) => void;
  reactionPendingFor: (
    postId: string,
    type: "like" | "repost",
    parentInteractionId?: string | null,
  ) => boolean;
  createInteractionPendingFor: (
    postId: string,
    type: NoodleInteractionType,
    parentInteractionId?: string | null,
  ) => boolean;
  updatePostPending: boolean;
  /** Human controller edit/delete capability. Viewer-only projections set this false. */
  postManagement: boolean;
  /** NoodleR title editing. Noodle posts omit this capability and remain titleless. */
  titleEditing?: NoodlePostCardTitleEditingCap;
  /** Existing-poll editing. Poll-less posts do not expose an add-poll path here. */
  pollEditing?: {
    value: NoodlePollInput | null;
    setValue: React.Dispatch<React.SetStateAction<NoodlePollInput | null>>;
  };
  /** Allow an empty edited body when the existing post has a poll. */
  allowPollOnlyEdits?: boolean;
  /** Navigate to an author/mention profile. Omit on hosts without profile navigation (NoodleR). */
  openProfile?: (account: NoodleAccount | null) => void;
  /** Navigate by NoodleR author ID when no Noodle account object exists. */
  openAuthorProfile?: (accountId: string) => void;
  /** Vote in a post's poll. Pollless posts never call it. */
  voteInPoll?: (
    post: NoodlePostCardModel,
    optionId: string,
    selectedOptionId: string | null,
  ) => void;
  /** Preserve the public timeline's legacy body/poll duplicate suppression. */
  deduplicatePollBody?: boolean;
  /** Keep a deliberately framed upload fully visible instead of applying the public feed's center crop. */
  imageFit?: "cover" | "contain";
  /** Post image crop, replacement, and removal capability. */
  imageEditing?: NoodlePostCardImageEditingCap;
  /** Reply image/upload capability. Absent → the card hides all reply-image affordances. */
  media?: NoodlePostCardMediaCap;
  /**
   * Opening an image fullscreen is not the same capability as attaching one to a reply, so
   * hosts without the reply-image cap (NoodleR) still get a lightbox by passing this.
   */
  setImageLightbox?: React.Dispatch<React.SetStateAction<ChatImage | null>>;
  /** Reply edit/delete capability. Absent → reply management UI stays hidden. */
  replyManagement?: NoodlePostCardReplyManagementCap;
  /** @mention autocomplete capability. Absent → no mention suggestions. */
  mentions?: NoodlePostCardMentionsCap;
}

interface NoodlePostCardControllerOptions {
  postManagement: boolean;
  personaAccount: NoodleAccount | null;
  savePost: (
    post: NoodlePostCardModel,
    input: {
      title: string | null;
      content: string;
      image: NoodlePostImageUpdate | null;
      poll?: NoodlePollInput | null;
    },
  ) => Promise<void>;
  deletePost: (post: NoodlePostCardModel) => void;
  reactToPost: (
    post: NoodlePostCardModel,
    type: "like" | "repost",
    active?: boolean,
  ) => void;
  reactToReply: (
    post: NoodlePostCardModel,
    target: NoodleInteraction,
    active: boolean,
  ) => void;
  submitReply: (
    post: NoodlePostCardModel,
    input: { content: string; parentInteractionId: string | null },
  ) => Promise<void>;
  reactionPendingFor: (
    postId: string,
    type: "like" | "repost",
    parentInteractionId?: string | null,
  ) => boolean;
  createInteractionPendingFor: (
    postId: string,
    type: NoodleInteractionType,
    parentInteractionId?: string | null,
  ) => boolean;
  updatePostPending: boolean;
  titleMaxLength?: number;
  allowPollOnlyEdits?: boolean;
  openAuthorProfile?: (accountId: string) => void;
  voteInPoll?: (
    post: NoodlePostCardModel,
    optionId: string,
    selectedOptionId: string | null,
  ) => void;
  deduplicatePollBody?: boolean;
  imageFit?: "cover" | "contain";
  imageEditing?: {
    loadPostImage: (post: NoodlePostCardModel) => Promise<File | string>;
  };
}

export function useNoodlePostImageEditor(
  loadPostImage?: (post: NoodlePostCardModel) => Promise<File | string>,
) {
  const [update, setUpdate] = useState<NoodlePostImageUpdate | null>(null);
  const [cropSource, setCropSource] =
    useState<NoodlePostImageCropSource | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const revisionRef = useRef(0);

  const reset = () => {
    revisionRef.current += 1;
    setUpdate(null);
    setCropSource(null);
    setLoading(false);
    setError(null);
  };
  const beginCrop = (post: NoodlePostCardModel) => {
    if (!loadPostImage || loading) return;
    if (update?.kind === "replace") {
      setCropSource({
        source: update.file,
        crop: update.crop,
        mode: "replace",
      });
      setError(null);
      return;
    }
    if (!post.imageUrl) return;
    const revision = ++revisionRef.current;
    setLoading(true);
    setError(null);
    void loadPostImage(post)
      .then((source) => {
        if (revisionRef.current === revision) {
          setCropSource({
            source,
            crop:
              update?.kind === "crop"
                ? update.crop
                : readNoodlePostImageCrop(post.metadata),
            mode: "existing",
          });
        }
      })
      .catch((caught) => {
        if (revisionRef.current === revision) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Could not load this image.",
          );
        }
      })
      .finally(() => {
        if (revisionRef.current === revision) setLoading(false);
      });
  };
  const selectReplacement = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file.");
      return;
    }
    setCropSource({ source: file, crop: null, mode: "replace" });
    setError(null);
  };
  const applyCrop = async (crop: NoodlePostImageCrop) => {
    if (!cropSource) return;
    setUpdate(
      cropSource.mode === "replace"
        ? { kind: "replace", file: cropSource.source, crop }
        : { kind: "crop", crop },
    );
    setCropSource(null);
    setError(null);
  };

  return {
    update,
    reset,
    cap: loadPostImage
      ? {
          update,
          cropSource,
          loading,
          error,
          fileInputRef,
          beginCrop,
          selectReplacement,
          applyCrop,
          cancelCrop: () => setCropSource(null),
          remove: () => {
            setUpdate({ kind: "remove" });
            setCropSource(null);
            setError(null);
          },
          restore: () => {
            setUpdate(null);
            setCropSource(null);
            setError(null);
          },
        }
      : undefined,
  };
}

export function useNoodlePostCardController(
  options: NoodlePostCardControllerOptions,
) {
  const [postMenuId, setPostMenuId] = useState<string | null>(null);
  const [imageLightbox, setImageLightbox] = useState<ChatImage | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingPostContent, setEditingPostContent] = useState("");
  const [editingPostTitle, setEditingPostTitle] = useState("");
  const [editingPostPoll, setEditingPostPoll] =
    useState<NoodlePollInput | null>(null);
  const [replyPostId, setReplyPostId] = useState<string | null>(null);
  const [replyParentInteractionId, setReplyParentInteractionId] = useState<
    string | null
  >(null);
  const [replyText, setReplyText] = useState("");
  const [replyHasText, setReplyHasText] = useState(false);
  const [activeReplyComposerTool, setActiveReplyComposerTool] =
    useState<ReplyComposerTool | null>(null);
  const [mediaPickerTab, setMediaPickerTab] =
    useState<ConversationMediaPickerTabId>("emoji");
  const replyComposerRef = useRef<HTMLTextAreaElement | null>(null);
  const replyValueRef = useRef("");
  const replyMediaToolRef = useRef<HTMLDivElement | null>(null);
  const imageEditor = useNoodlePostImageEditor(
    options.imageEditing?.loadPostImage,
  );

  const clearReplyComposer = () => {
    setReplyPostId(null);
    setReplyParentInteractionId(null);
    setReplyText("");
    replyValueRef.current = "";
    setReplyHasText(false);
    setActiveReplyComposerTool(null);
    if (replyComposerRef.current) replyComposerRef.current.value = "";
  };
  const cancelEditingPost = () => {
    setEditingPostId(null);
    setEditingPostContent("");
    setEditingPostTitle("");
    setEditingPostPoll(null);
    imageEditor.reset();
  };
  const reset = () => {
    clearReplyComposer();
    setPostMenuId(null);
    cancelEditingPost();
  };
  const openReplyComposer = (
    postId: string,
    parentInteractionId: string | null = null,
  ) => {
    clearReplyComposer();
    setReplyPostId(postId);
    setReplyParentInteractionId(parentInteractionId);
  };
  const handleReplyChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    replyValueRef.current = event.target.value;
    setReplyHasText(event.target.value.trim().length > 0);
  };
  const appendToReply = (text: string) => {
    const next = replyValueRef.current + text;
    replyValueRef.current = next;
    setReplyText(next);
    setReplyHasText(next.trim().length > 0);
    if (replyComposerRef.current) replyComposerRef.current.value = next;
  };
  const startEditingPost = (post: NoodlePostCardModel) => {
    setPostMenuId(null);
    setEditingPostId(post.id);
    setEditingPostTitle(post.title ?? "");
    setEditingPostContent(post.content);
    const poll = readNoodlePollFromMetadata(post.metadata);
    setEditingPostPoll(
      poll
        ? {
            question: poll.question,
            options: poll.options.map((option) => option.label),
          }
        : null,
    );
    imageEditor.reset();
  };
  const saveEditedPost = (post: NoodlePostCardModel) => {
    const content = editingPostContent.trim();
    const existingPoll = readNoodlePollFromMetadata(post.metadata);
    const validPoll = existingPoll
      ? noodlePollInputSchema.safeParse(editingPostPoll).success
      : false;
    if (!content && !(options.allowPollOnlyEdits && validPoll)) return;
    void options
      .savePost(post, {
        title: editingPostTitle.trim() || null,
        content,
        image: imageEditor.update,
        ...(existingPoll && { poll: editingPostPoll }),
      })
      .then(cancelEditingPost)
      .catch(() => {});
  };
  const submitReply = (post: NoodlePostCardModel) => {
    const content = replyValueRef.current.trim();
    if (!content) return;
    void options
      .submitReply(post, {
        content,
        parentInteractionId: replyParentInteractionId,
      })
      .then(clearReplyComposer)
      .catch(() => {});
  };
  const deletePost = (post: NoodlePostCardModel) => {
    setPostMenuId(null);
    options.deletePost(post);
  };

  const ctx: NoodlePostCardCtx = {
    setImageLightbox,
    personaAccount: options.personaAccount,
    postManagement: options.postManagement,
    postMenuId,
    setPostMenuId,
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
    highlightedInteractionId: null,
    mediaPickerTab,
    setMediaPickerTab,
    replyComposerRef,
    replyValueRef,
    replyMediaToolRef,
    startEditingPost,
    deleteNoodlePost: deletePost,
    cancelEditingPost,
    saveEditedPost,
    reactToPost: options.reactToPost,
    reactToReply: options.reactToReply,
    openReplyComposer,
    handleReplyChange,
    clearReplyComposer,
    submitReply,
    appendToReply,
    reactionPendingFor: options.reactionPendingFor,
    createInteractionPendingFor: options.createInteractionPendingFor,
    updatePostPending: options.updatePostPending,
    openAuthorProfile: options.openAuthorProfile,
    voteInPoll: options.voteInPoll,
    deduplicatePollBody: options.deduplicatePollBody ?? true,
    imageFit: options.imageFit ?? "cover",
    imageEditing: imageEditor.cap,
    titleEditing: options.titleMaxLength
      ? {
          editingPostTitle,
          setEditingPostTitle,
          maxLength: options.titleMaxLength,
        }
      : undefined,
    pollEditing: {
      value: editingPostPoll,
      setValue: setEditingPostPoll,
    },
    allowPollOnlyEdits: options.allowPollOnlyEdits,
  };
  return { ctx, reset, imageLightbox, setImageLightbox };
}

export function NoodlePostCard({
  post,
  ctx,
}: {
  post: NoodlePostCardModel;
  ctx: NoodlePostCardCtx;
}) {
  const { t: localizeUi, i18n } = useUiTranslation();
  const {
    personaAccount,
    postMenuId,
    setPostMenuId,
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
    pollEditing,
    imageEditing,
    media,
    replyManagement,
    mentions,
  } = ctx;
  const accountById = ctx.accountById ?? new Map<string, NoodleAccount>();
  const accountByHandle =
    ctx.accountByHandle ?? new Map<string, NoodleAccount>();
  const authorAccount = accountById.get(post.authorAccountId) ?? null;
  const author = authorAccount ?? post.authorSnapshot;
  const containImage = ctx.imageFit === "contain";
  const imageCrop = readNoodlePostImageCrop(post.metadata);

  // Card-owned defaults for absent capability groups. Hosts pass only the capabilities they
  // support; the card fills the
  // rest with no-ops and empty state, and gates the corresponding UI on group presence — so
  // no host has to hand over discarded setters, dangling refs, or fake mutations. Annotations
  // keep the () => {} fallbacks callable with their real signatures.
  const fallbackDivRef = useRef<HTMLDivElement | null>(null);
  const fallbackFileRef = useRef<HTMLInputElement | null>(null);
  const openProfile: (account: NoodleAccount | null) => void =
    ctx.openProfile ?? (() => {});
  const canOpenAuthorProfile = Boolean(authorAccount || ctx.openAuthorProfile);
  const openPostAuthor = () => {
    if (authorAccount) openProfile(authorAccount);
    else ctx.openAuthorProfile?.(post.authorAccountId);
  };
  const handleReplyKeyDown: (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => void = ctx.handleReplyKeyDown ?? (() => {});
  const voteInPoll: (
    post: NoodlePostCardModel,
    optionId: string,
    selectedOptionId: string | null,
  ) => void = ctx.voteInPoll ?? (() => {});
  const disableReplyImage = !media;
  const setImageLightbox: React.Dispatch<
    React.SetStateAction<ChatImage | null>
  > = ctx.setImageLightbox ?? media?.setImageLightbox ?? (() => {});
  const replyImageUrl = media?.replyImageUrl ?? "";
  const setReplyImageUrl: React.Dispatch<React.SetStateAction<string>> =
    media?.setReplyImageUrl ?? (() => {});
  const replyImageUrlDraft = media?.replyImageUrlDraft ?? "";
  const setReplyImageUrlDraft: React.Dispatch<React.SetStateAction<string>> =
    media?.setReplyImageUrlDraft ?? (() => {});
  const replyImageToolRef = media?.replyImageToolRef ?? fallbackDivRef;
  const replyImageFileRef = media?.replyImageFileRef ?? fallbackFileRef;
  const applyReplyImageUrl: () => void =
    media?.applyReplyImageUrl ?? (() => {});
  const uploadGlobalImages = media?.uploadGlobalImages ?? { isPending: false };
  const editingReplyId = replyManagement?.editingReplyId ?? null;
  const editingReplyContent = replyManagement?.editingReplyContent ?? "";
  const setEditingReplyContent: React.Dispatch<React.SetStateAction<string>> =
    replyManagement?.setEditingReplyContent ?? (() => {});
  const startEditingReply: (reply: NoodleInteraction) => void =
    replyManagement?.startEditingReply ?? (() => {});
  const cancelEditingReply: () => void =
    replyManagement?.cancelEditingReply ?? (() => {});
  const saveEditedReply: (
    post: NoodlePostCardModel,
    reply: NoodleInteraction,
  ) => void = replyManagement?.saveEditedReply ?? (() => {});
  const deleteNoodleReply: (
    post: NoodlePostCardModel,
    reply: NoodleInteraction,
  ) => void = replyManagement?.deleteNoodleReply ?? (() => {});
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
  const selectReplyMention: (account: NoodleAccount) => void =
    mentions?.selectReplyMention ?? (() => {});

  const postInteractions = post.interactions;
  const rootPostInteractions = postInteractions.filter(
    (interaction) => !interaction.parentInteractionId,
  );
  const poll = readNoodlePollFromMetadata(post.metadata);
  const pollVotes = poll
    ? rootPostInteractions.filter(
        (interaction) =>
          interaction.type === "vote" &&
          poll.options.some((option) => option.id === interaction.content),
      )
    : [];
  const personaPollVote = personaAccount
    ? (pollVotes.find(
        (interaction) => interaction.actorAccountId === personaAccount.id,
      )?.content ?? null)
    : null;
  const likedByPersona = personaAccount
    ? rootPostInteractions.some(
        (interaction) =>
          interaction.type === "like" &&
          interaction.actorAccountId === personaAccount.id,
      )
    : false;
  const repostedByPersona = personaAccount
    ? rootPostInteractions.some(
        (interaction) =>
          interaction.type === "repost" &&
          interaction.actorAccountId === personaAccount.id,
      )
    : false;
  const replies = postInteractions.filter(
    (interaction) => interaction.type === "reply",
  );
  const replyById = new Map(replies.map((reply) => [reply.id, reply]));
  const orderedReplies: NoodleInteraction[] = [];
  const visitedReplyIds = new Set<string>();
  const appendReplyBranch = (reply: NoodleInteraction) => {
    if (visitedReplyIds.has(reply.id)) return;
    visitedReplyIds.add(reply.id);
    orderedReplies.push(reply);
    for (const child of replies) {
      if (child.parentInteractionId === reply.id) appendReplyBranch(child);
    }
  };
  for (const reply of replies) {
    if (!reply.parentInteractionId || !replyById.has(reply.parentInteractionId))
      appendReplyBranch(reply);
  }
  for (const reply of replies) appendReplyBranch(reply);
  const replyTarget = replyParentInteractionId
    ? (replyById.get(replyParentInteractionId) ?? null)
    : null;
  const replyTargetActor = replyTarget
    ? (accountById.get(replyTarget.actorAccountId) ?? replyTarget.actorSnapshot)
    : author;
  const postLikePending = reactionPendingFor(post.id, "like");
  const postRepostPending = reactionPendingFor(post.id, "repost");
  const postReplyPending = createInteractionPendingFor(
    post.id,
    "reply",
    replyParentInteractionId,
  );
  const pollVotePending = createInteractionPendingFor(post.id, "vote");
  const renderReplyComposer = (nested: boolean) => (
    <div
      data-component="NoodleView.ReplyComposer"
      data-noodle-reply-parent-id={replyParentInteractionId ?? ""}
      className={cn(
        "border-[var(--noodle-divider)] py-3",
        nested ? "ml-10 border-b" : "mt-3 border-y",
      )}
    >
      {replyParentInteractionId && replyTargetActor && (
        <p className="mb-2 text-xs text-[var(--muted-foreground)]">
          {localizeUi("ui.noodle.noodlepostcard.replyingTo")}{" "}
          <span className="font-semibold text-[var(--noodle-accent)]">
            @{replyTargetActor.handle}
          </span>
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
        aria-controls={
          activeReplyMention ? "noodle-reply-mention-list" : undefined
        }
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
            onClick={() =>
              setImageLightbox(
                createNoodleLightboxImage(
                  `reply-draft-${post.id}`,
                  replyImageUrl,
                ),
              )
            }
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
                onClick={() =>
                  setActiveReplyComposerTool((current) =>
                    current === "image" ? null : "image",
                  )
                }
              >
                <ImageIcon size={17} />
              </NoodleToolButton>
            </div>
          )}
          <div ref={replyMediaToolRef} className="relative">
            <NoodleToolButton
              title={localizeUi("ui.noodle.noodlehome.emojiGifsAndStickers")}
              active={activeReplyComposerTool === "media"}
              onClick={() =>
                setActiveReplyComposerTool((current) =>
                  current === "media" ? null : "media",
                )
              }
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
            disabled={!replyHasText || postReplyPending}
            onClick={() => submitReply(post)}
          >
            {postReplyPending
              ? localizeUi("ui.noodle.noodlepostcard.replying")
              : localizeUi("ui.noodle.noodlepostcard.reply")}
          </button>
        </div>
      </div>
      {!disableReplyImage && activeReplyComposerTool === "image" && (
        <NoodleAnchoredPopover anchorRef={replyImageToolRef} wide>
          <NoodleImageComposer
            imageUrl={replyImageUrlDraft}
            onImageUrlChange={setReplyImageUrlDraft}
            onChooseFile={() => replyImageFileRef.current?.click()}
            onUseImageUrl={applyReplyImageUrl}
            onClose={() => setActiveReplyComposerTool(null)}
            disabled={uploadGlobalImages.isPending}
            hasImage={Boolean(replyImageUrl)}
            fileActionLabel={
              uploadGlobalImages.isPending
                ? localizeUi("ui.noodle.noodleprofilesurface.uploading")
                : undefined
            }
          />
        </NoodleAnchoredPopover>
      )}
      {activeReplyComposerTool === "media" && (
        <NoodleAnchoredPopover anchorRef={replyMediaToolRef} wide>
          <ConversationMediaPickerPanel
            tabs={
              disableReplyImage
                ? NOODLE_TEXT_MEDIA_PICKER_TABS
                : NOODLE_MEDIA_PICKER_TABS
            }
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
  const editingExistingPoll = Boolean(poll && pollEditing);
  const editingPollIsValid =
    !editingExistingPoll ||
    noodlePollInputSchema.safeParse(pollEditing?.value).success;
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
        disabled={
          (!editingPostContent.trim() &&
            !(
              ctx.allowPollOnlyEdits &&
              editingPollIsValid &&
              editingExistingPoll
            )) ||
          !editingPollIsValid ||
          updatePostPending ||
          imageEditing?.loading ||
          Boolean(imageEditing?.cropSource)
        }
        className="h-8 rounded-full bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {updatePostPending
          ? localizeUi("ui.noodle.noodlehome.saving")
          : localizeUi("ui.noodle.noodlehome.save")}
      </button>
    </>
  );
  return (
    <article
      key={post.id}
      data-noodle-post-id={post.id}
      tabIndex={-1}
      className="border-b border-[var(--noodle-divider)] px-4 py-4 transition-colors hover:bg-[var(--accent)]/35"
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
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
              <button
                type="button"
                onClick={openPostAuthor}
                disabled={!canOpenAuthorProfile}
                className="font-semibold transition-colors enabled:hover:text-[var(--noodle-accent)] disabled:cursor-default"
              >
                {author?.displayName ??
                  localizeUi("ui.noodle.noodlepostcard.noodleUser")}
              </button>
              <span className="text-xs text-[var(--muted-foreground)]">
                @{author?.handle ?? "noodle"}
              </span>
              <span className="text-xs text-[var(--muted-foreground)]">
                {formatTime(post.createdAt, i18n.language)}
              </span>
            </div>
            {ctx.postManagement && (
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    setPostMenuId((current) =>
                      current === post.id ? null : post.id,
                    )
                  }
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--noodle-accent)] transition-colors hover:bg-[var(--noodle-accent)]/10"
                  title={localizeUi("ui.noodle.noodlepostcard.postActions")}
                  aria-label={localizeUi(
                    "ui.noodle.noodlepostcard.postActions",
                  )}
                >
                  <MoreHorizontal size={18} />
                </button>
                {postMenuId === post.id && (
                  <div className="absolute right-0 top-[calc(100%+0.25rem)] z-30 min-w-32 overflow-hidden rounded-lg border border-[var(--noodle-divider)] bg-[var(--background)] py-1 text-xs shadow-2xl shadow-black/30">
                    <button
                      type="button"
                      onClick={() => startEditingPost(post)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--accent)]"
                    >
                      <Pencil
                        size={14}
                        className="text-[var(--noodle-accent)]"
                      />
                      {localizeUi("ui.noodle.noodlepostcard.edit")}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteNoodlePost(post)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--accent)]"
                    >
                      <Trash2
                        size={14}
                        className="text-[var(--noodle-accent)]"
                      />
                      {localizeUi("lorebook.editor.batch.delete")}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          {ctx.postManagement && editingPostId === post.id ? (
            <div className="mt-2 space-y-2">
              {titleEditing && (
                <label className="block">
                  <span className="sr-only">
                    {localizeUi("ui.noodle.noodlepostcard.titleOptional")}
                  </span>
                  <input
                    value={titleEditing.editingPostTitle}
                    onChange={(event) =>
                      titleEditing.setEditingPostTitle(event.target.value)
                    }
                    maxLength={titleEditing.maxLength}
                    className="h-9 w-full rounded-lg border-0 bg-[var(--noodle-accent)]/5 px-3 text-base font-bold text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)] focus:bg-[var(--noodle-accent)]/10"
                    placeholder={localizeUi(
                      "ui.noodle.noodlepostcard.titleOptional",
                    )}
                  />
                </label>
              )}
              <textarea
                value={editingPostContent}
                onChange={(event) => setEditingPostContent(event.target.value)}
                className="min-h-20 w-full resize-none rounded-lg border-0 bg-[var(--noodle-accent)]/5 px-3 py-2 text-[1rem] leading-6 text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)] focus:bg-[var(--noodle-accent)]/10"
                placeholder={localizeUi(
                  "ui.noodle.noodlerpostcomposer.whatSSimmering",
                )}
              />
              {imageEditing && (
                <PostImageEditControls
                  post={post}
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
                  submitDisabled={
                    !editingPollIsValid ||
                    (!editingPostContent.trim() && !pollEditing.value) ||
                    updatePostPending ||
                    Boolean(imageEditing?.loading) ||
                    Boolean(imageEditing?.cropSource)
                  }
                  disabled={updatePostPending}
                  title={localizeUi("ui.noodle.noodlehome.editPoll")}
                  closeLabel={localizeUi(
                    "ui.noodle.noodlepostcard.cancelPostEditing",
                  )}
                  action={postEditActions}
                />
              )}
              {!imageEditing && !editingExistingPoll && (
                <div className="flex flex-wrap justify-end gap-2">
                  {postEditActions}
                </div>
              )}
            </div>
          ) : (
            <>
              {post.title && (
                <h3 className="mt-2 break-words text-base font-bold leading-6">
                  {post.title}
                </h3>
              )}
              {post.content.trim() &&
                (!poll ||
                  ctx.deduplicatePollBody === false ||
                  post.content.trim() !== poll.question) && (
                  <NoodleTextContent
                    content={post.content}
                    accountByHandle={accountByHandle}
                    onOpenProfile={openProfile}
                    className={cn("leading-6", post.title ? "mt-1" : "mt-2")}
                  />
                )}
            </>
          )}
          {poll && editingPostId !== post.id && (
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
          {ctx.postManagement &&
          editingPostId === post.id &&
          imageEditing ? null : post.imageUrl ? (
            media ? (
              <button
                type="button"
                onClick={() =>
                  setImageLightbox(
                    createNoodleLightboxImage(
                      post.id,
                      post.imageUrl!,
                      post.imagePrompt ?? "",
                    ),
                  )
                }
                className="mt-3 block w-full overflow-hidden rounded-xl text-left ring-offset-[var(--background)] transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] focus-visible:ring-offset-2"
                title={localizeUi("ui.noodle.noodlepostcard.openImage")}
                aria-label={localizeUi(
                  "ui.noodle.noodlepostcard.openPostImage",
                )}
              >
                {containImage || imageCrop ? (
                  <PostImageFrame
                    src={post.imageUrl}
                    crop={imageCrop}
                    alt={localizeUi(
                      "ui.noodle.noodlepostcard.imagePostedByValue1",
                      {
                        value1:
                          author?.displayName ??
                          localizeUi("ui.noodle.noodlepostcard.noodleUser"),
                      },
                    )}
                  />
                ) : (
                  <img
                    src={post.imageUrl}
                    alt={localizeUi(
                      "ui.noodle.noodlepostcard.imagePostedByValue1",
                      {
                        value1:
                          author?.displayName ??
                          localizeUi("ui.noodle.noodlepostcard.noodleUser"),
                      },
                    )}
                    className="max-h-96 w-full object-cover"
                  />
                )}
              </button>
            ) : (
              <div className="mt-3 overflow-hidden rounded-xl">
                {containImage || imageCrop ? (
                  <PostImageFrame
                    src={post.imageUrl}
                    crop={imageCrop}
                    alt={localizeUi(
                      "ui.noodle.noodlepostcard.imagePostedByValue1",
                      {
                        value1:
                          author?.displayName ??
                          localizeUi("ui.noodle.noodlepostcard.noodleUser"),
                      },
                    )}
                  />
                ) : (
                  <img
                    src={post.imageUrl}
                    alt={localizeUi(
                      "ui.noodle.noodlepostcard.imagePostedByValue1",
                      {
                        value1:
                          author?.displayName ??
                          localizeUi("ui.noodle.noodlepostcard.noodleUser"),
                      },
                    )}
                    className="max-h-96 w-full object-cover"
                  />
                )}
              </div>
            )
          ) : post.imagePrompt ? (
            <div className="mt-3 rounded-xl border border-[var(--noodle-accent)]/35 bg-[var(--noodle-accent)]/10 p-3 text-xs leading-5">
              <span className="mb-1 flex items-center gap-1.5 font-semibold text-[var(--noodle-accent)]">
                <ImageIcon size={13} />
                {localizeUi("ui.noodle.noodlepostcard.imagePrompt")}
              </span>
              {post.imagePrompt}
            </div>
          ) : null}

          <div className="mt-3 flex max-w-md items-center justify-between gap-1">
            <button
              type="button"
              className={cn(
                noodleIconButtonClass,
                "rounded-full",
                likedByPersona && "bg-[var(--noodle-accent)]/10",
              )}
              disabled={!personaAccount || postLikePending}
              onClick={() => reactToPost(post, "like", likedByPersona)}
              title={
                likedByPersona
                  ? localizeUi("ui.noodle.noodlepostcard.unlike")
                  : localizeUi("ui.noodle.noodlepostcard.like")
              }
              aria-label={localizeUi("ui.noodle.noodlepostcard.value1Post", {
                value1: likedByPersona
                  ? localizeUi("ui.noodle.noodlepostcard.unlike")
                  : localizeUi("ui.noodle.noodlepostcard.like"),
              })}
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
              className={cn(
                noodleIconButtonClass,
                "rounded-full",
                repostedByPersona && "bg-[var(--noodle-accent)]/10",
              )}
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
              className={cn(
                noodleIconButtonClass,
                "rounded-full hover:text-[var(--noodle-accent)]",
              )}
              disabled={!personaAccount}
              onClick={() => openReplyComposer(post.id)}
              title={localizeUi("ui.noodle.noodlepostcard.reply")}
            >
              <MessageCircle size={18} />
              {replies.length}
            </button>
          </div>

          {replyPostId === post.id &&
            !replyParentInteractionId &&
            renderReplyComposer(false)}

          {replies.length > 0 && (
            <div className="mt-3 border-t border-[var(--noodle-divider)]">
              {orderedReplies.map((reply) => {
                const actorAccount =
                  accountById.get(reply.actorAccountId) ?? null;
                const actor = actorAccount ?? reply.actorSnapshot;
                const parentReply = reply.parentInteractionId
                  ? (replyById.get(reply.parentInteractionId) ?? null)
                  : null;
                const parentActorAccount = parentReply
                  ? (accountById.get(parentReply.actorAccountId) ?? null)
                  : null;
                const parentActor =
                  parentActorAccount ?? parentReply?.actorSnapshot ?? null;
                const replyLikes = postInteractions.filter(
                  (interaction) =>
                    interaction.type === "like" &&
                    interaction.parentInteractionId === reply.id,
                );
                const likedReplyByPersona = personaAccount
                  ? replyLikes.some(
                      (interaction) =>
                        interaction.actorAccountId === personaAccount.id,
                    )
                  : false;
                const canManageReply = canManageReplyOverride
                  ? canManageReplyOverride(reply)
                  : Boolean(
                      personaAccount &&
                        canManageNoodleReply({
                          actorKind:
                            actorAccount?.kind ?? reply.actorSnapshot?.kind,
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
                              displayName: localizeUi(
                                "ui.noodle.noodlepostcard.noodleUser",
                              ),
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
                            {actor?.displayName ??
                              localizeUi("ui.noodle.noodlepostcard.noodleUser")}
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
                                className="font-medium text-[var(--noodle-accent)] hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]/70"
                                aria-label={localizeUi(
                                  "ui.noodle.noodletextcontent.viewValue1Profile",
                                  { value1: parentActorAccount.handle },
                                )}
                              >
                                @{parentActorAccount.handle}
                              </button>
                            ) : (
                              <span className="text-[var(--noodle-accent)]">
                                @{parentActor.handle}
                              </span>
                            )}
                          </p>
                        )}
                        {editingReplyId === reply.id ? (
                          <div
                            className="mt-2 space-y-2"
                            data-component="NoodleView.CommentEditor"
                          >
                            <textarea
                              value={editingReplyContent}
                              onChange={(event) =>
                                setEditingReplyContent(event.target.value)
                              }
                              className={cn(textareaClass, "min-h-20 resize-y")}
                              placeholder={localizeUi(
                                "ui.noodle.noodlepostcard.editComment",
                              )}
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
                                disabled={
                                  (!editingReplyContent.trim() &&
                                    !reply.imageUrl) ||
                                  updateInteraction.isPending
                                }
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
                              setImageLightbox(
                                createNoodleLightboxImage(
                                  reply.id,
                                  reply.imageUrl!,
                                  reply.content ?? "",
                                ),
                              )
                            }
                            className="mt-2 block w-full overflow-hidden rounded-xl text-left ring-offset-[var(--background)] transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] focus-visible:ring-offset-2"
                            title={localizeUi(
                              "ui.noodle.noodlepostcard.openImage",
                            )}
                            aria-label={localizeUi(
                              "ui.noodle.noodlepostcard.openCommentImage",
                            )}
                          >
                            <img
                              src={reply.imageUrl}
                              alt={localizeUi(
                                "ui.noodle.noodlepostcard.imageInValue1SComment",
                                {
                                  value1:
                                    actor?.displayName ??
                                    localizeUi(
                                      "ui.noodle.noodlepostcard.noodleUser",
                                    ),
                                },
                              )}
                              className="max-h-72 w-full object-cover"
                            />
                          </button>
                        )}
                        <div className="mt-1.5 flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              reactToReply(post, reply, likedReplyByPersona)
                            }
                            disabled={
                              !personaAccount ||
                              reactionPendingFor(post.id, "like", reply.id)
                            }
                            className={cn(
                              noodleCommentActionClass,
                              "px-2 font-medium",
                              likedReplyByPersona &&
                                "bg-[var(--noodle-accent)]/10",
                            )}
                            title={
                              likedReplyByPersona
                                ? localizeUi(
                                    "ui.noodle.noodlepostcard.unlikeComment",
                                  )
                                : localizeUi(
                                    "ui.noodle.noodlepostcard.likeComment",
                                  )
                            }
                            aria-busy={reactionPendingFor(
                              post.id,
                              "like",
                              reply.id,
                            )}
                          >
                            <Heart
                              size={14}
                              fill={
                                likedReplyByPersona ? "currentColor" : "none"
                              }
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
                            aria-label={localizeUi(
                              "ui.noodle.noodlepostcard.reply",
                            )}
                          >
                            <MessageCircle size={14} />
                          </button>
                          {canManageReply && editingReplyId !== reply.id && (
                            <>
                              <button
                                type="button"
                                onClick={() => startEditingReply(reply)}
                                disabled={
                                  updateInteraction.isPending ||
                                  deleteInteraction.isPending
                                }
                                className={cn(noodleCommentActionClass, "w-7")}
                                title={localizeUi(
                                  "ui.noodle.noodlepostcard.editComment",
                                )}
                                aria-label={localizeUi(
                                  "ui.noodle.noodlepostcard.editComment",
                                )}
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteNoodleReply(post, reply)}
                                disabled={
                                  updateInteraction.isPending ||
                                  deleteInteraction.isPending
                                }
                                className={cn(noodleCommentActionClass, "w-7")}
                                title={localizeUi(
                                  "ui.noodle.noodlepostcard.deleteComment",
                                )}
                                aria-label={localizeUi(
                                  "ui.noodle.noodlepostcard.deleteComment",
                                )}
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    {replyPostId === post.id &&
                      replyParentInteractionId === reply.id &&
                      renderReplyComposer(true)}
                  </Fragment>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

// Shared composer chrome: avatar gutter, borderless body, divider, and the
// tools-left / action-right toolbar row. Noodle fills it with its post composer;
// NoodleR fills it with the guided-generation composer. Keeps both pixel-aligned.
export function NoodleComposerShell({
  header,
  avatar,
  children,
  tools,
  action,
  popovers,
  footer,
  dataComponent,
}: {
  header?: React.ReactNode;
  avatar: React.ReactNode;
  children: React.ReactNode;
  tools?: React.ReactNode;
  action: React.ReactNode;
  popovers?: React.ReactNode;
  footer?: React.ReactNode;
  dataComponent?: string;
}) {
  return (
    <div
      className="border-b border-[var(--noodle-divider)] px-4 py-3"
      data-component={dataComponent}
    >
      {header && <div className="mb-2">{header}</div>}
      <div className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-3">
        {avatar}
        <div className="min-w-0">{children}</div>
      </div>
      <div className="mt-1 h-px w-full bg-[var(--noodle-divider)]" />
      {/* Tools and actions are two wrapping groups, not seven buttons in one row: on a
          phone the old single row broke them apart mid-group. The avatar-width indent
          is a wide-layout nicety and costs 3.5rem the narrow layout cannot spare. */}
      <div className="relative mt-3 flex flex-wrap items-center gap-2 @min-[480px]:pl-14">
        <div className="flex min-w-0 flex-wrap items-center gap-1">{tools}</div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {action}
        </div>
        {popovers}
      </div>
      {footer}
    </div>
  );
}
