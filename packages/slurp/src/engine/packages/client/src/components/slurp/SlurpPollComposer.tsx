import { Plus, Send, Smile, Trash2, X } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import { noodlePollInputSchema, type NoodlePollInput } from "@marinara-engine/shared";
import { ConversationMediaPickerPanel } from "../chat/ConversationMediaPickerPanel";
import { NoodleAnchoredPopover } from "./SlurpPostCard";
import { useTranslation as useUiTranslation } from "react-i18next";

const EMPTY_POLL: NoodlePollInput = { question: "", options: ["", ""] };
const EMOJI_GRAPHEME_PATTERN = /[\p{Extended_Pictographic}\p{Regional_Indicator}\u20e3]/u;
const graphemeSegmenter = new Intl.Segmenter(undefined, {
  granularity: "grapheme",
});

function splitLeadingEmoji(value: string): {
  emoji: string | null;
  answer: string;
} {
  const firstSegment = graphemeSegmenter.segment(value)[Symbol.iterator]().next().value?.segment ?? "";
  if (!firstSegment || value[firstSegment.length] !== " " || !EMOJI_GRAPHEME_PATTERN.test(firstSegment)) {
    return { emoji: null, answer: value };
  }
  return { emoji: firstSegment, answer: value.slice(firstSegment.length + 1) };
}

export function NoodlePollComposer({
  value,
  onChange,
  onClose,
  onSubmit,
  submitLabel,
  title,
  description,
  closeLabel,
  disabled = false,
  submitDisabled = false,
  modalOwned = false,
  action,
}: {
  value: NoodlePollInput | null;
  onChange: (poll: NoodlePollInput) => void;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel: string;
  title?: string;
  description?: string;
  closeLabel?: string;
  disabled?: boolean;
  submitDisabled?: boolean;
  modalOwned?: boolean;
  /** Replaces the built-in submit button when a parent owns the editor's shared actions. */
  action?: ReactNode;
}) {
  const { t: localizeUi } = useUiTranslation();
  const resolvedTitle = title ?? localizeUi("ui.noodle.noodlehome.createPoll");
  const resolvedCloseLabel = closeLabel ?? localizeUi("ui.noodle.poll.closeEditor");
  const poll = value ?? EMPTY_POLL;
  const [emojiOptionIndex, setEmojiOptionIndex] = useState<number | null>(null);
  const emojiAnchorRef = useRef<HTMLButtonElement | null>(null);

  const removeOption = (index: number) => {
    const nextOptions =
      poll.options.length > 2
        ? poll.options.filter((_, optionIndex) => optionIndex !== index)
        : poll.options.map((option, optionIndex) => (optionIndex === index ? "" : option));
    onChange({ question: poll.question, options: nextOptions });
    setEmojiOptionIndex((current) => {
      if (current === null || current < index) return current;
      if (current === index) return null;
      return poll.options.length > 2 ? current - 1 : current;
    });
  };

  const selectOptionEmoji = (index: number, emoji: string) => {
    const currentOption = poll.options[index] ?? "";
    const { answer } = splitLeadingEmoji(currentOption);
    const nextAnswer = `${emoji} ${answer}`.slice(0, 120);
    onChange({
      question: poll.question,
      options: poll.options.map((option, optionIndex) => (optionIndex === index ? nextAnswer : option)),
    });
    setEmojiOptionIndex(null);
  };

  return (
    <>
      <div className="marinara-chat-popover space-y-3 rounded-2xl border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] px-4 pb-4 pt-2 text-[var(--foreground)] shadow-2xl shadow-black/35">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold">{resolvedTitle}</h2>
            {description && <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{description}</p>}
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setEmojiOptionIndex(null);
              onClose();
            }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-50"
            aria-label={resolvedCloseLabel}
            title={resolvedCloseLabel}
          >
            <X size={20} />
          </button>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-bold">{localizeUi("ui.noodle.noodlehome.question")}</span>
          <input
            value={poll.question}
            maxLength={240}
            disabled={disabled}
            onChange={(event) => onChange({ question: event.target.value, options: poll.options })}
            placeholder={localizeUi("ui.noodle.noodlepollcomposer.whatQuestionDoYouWantToAsk")}
            className="mari-chrome-field h-14 w-full rounded-xl border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--noodle-accent)]/5 px-4 text-sm outline-none transition-colors placeholder:text-[var(--muted-foreground)] focus:border-[var(--noodle-accent)]"
          />
          <span className="block text-right text-xs tabular-nums text-[var(--noodle-accent)]">
            {poll.question.length} / 240
          </span>
        </label>

        <div className="space-y-2">
          {poll.options.map((option, index) => {
            const { emoji, answer } = splitLeadingEmoji(option);
            return (
              <div
                key={index}
                className="flex h-12 items-center gap-2 rounded-xl border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--noodle-accent)]/5 px-3 transition-colors focus-within:border-[var(--noodle-accent)]"
              >
                <button
                  type="button"
                  ref={emojiOptionIndex === index ? emojiAnchorRef : undefined}
                  disabled={disabled}
                  aria-expanded={emojiOptionIndex === index}
                  aria-label={localizeUi("ui.noodle.noodlepollcomposer.chooseEmojiForAnswerValue1", {
                    value1: index + 1,
                  })}
                  title={localizeUi("ui.noodle.noodlepollcomposer.chooseEmojiForAnswerValue1", { value1: index + 1 })}
                  onClick={(event) => {
                    emojiAnchorRef.current = event.currentTarget;
                    setEmojiOptionIndex((current) => (current === index ? null : index));
                  }}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--noodle-accent)]/10 hover:text-[var(--noodle-accent)]"
                >
                  {emoji ? <span className="text-base leading-none">{emoji}</span> : <Smile size={18} />}
                </button>
                <input
                  value={answer}
                  maxLength={120 - (emoji ? emoji.length + 1 : 0)}
                  disabled={disabled}
                  aria-label={localizeUi("ui.noodle.noodlepollcomposer.pollAnswerValue1", { value1: index + 1 })}
                  placeholder={localizeUi("ui.noodle.noodlepollcomposer.optionValue1", { value1: index + 1 })}
                  onChange={(event) =>
                    onChange({
                      question: poll.question,
                      options: poll.options.map((entry, entryIndex) =>
                        entryIndex === index ? `${emoji ? `${emoji} ` : ""}${event.target.value}` : entry,
                      ),
                    })
                  }
                  className="min-w-0 flex-1 border-0 bg-transparent text-sm text-[var(--noodle-accent)] outline-none placeholder:text-[var(--noodle-accent)]"
                />
                <button
                  type="button"
                  disabled={disabled || (!option && poll.options.length === 2)}
                  onClick={() => removeOption(index)}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)] disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label={localizeUi("ui.noodle.noodlepollcomposer.deleteAnswerValue1", { value1: index + 1 })}
                  title={localizeUi("ui.noodle.noodlepollcomposer.deleteAnswerValue1", { value1: index + 1 })}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            type="button"
            disabled={disabled || poll.options.length >= 4}
            onClick={() =>
              onChange({
                question: poll.question,
                options: [...poll.options, ""],
              })
            }
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--noodle-accent)]/15 px-3 text-xs font-bold text-[var(--noodle-accent)] transition-colors hover:bg-[var(--noodle-accent)]/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus size={15} />
            {localizeUi("ui.agents.agenteditor.addOption")}
          </button>
          {action ?? (
            <button
              type="button"
              onClick={onSubmit}
              disabled={disabled || submitDisabled || !noodlePollInputSchema.safeParse(value).success}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--noodle-accent)] px-5 text-xs font-bold text-zinc-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:!text-zinc-950"
            >
              <Send size={14} />
              {submitLabel}
            </button>
          )}
        </div>
      </div>

      {emojiOptionIndex !== null && !disabled && (
        <NoodleAnchoredPopover key={emojiOptionIndex} anchorRef={emojiAnchorRef} modalOwned={modalOwned} wide>
          <ConversationMediaPickerPanel
            tabs={[{ id: "emoji", label: localizeUi("ui.noodle.media.tabs.emoji") }]}
            activeTab="emoji"
            onActiveTabChange={() => {}}
            onClose={() => setEmojiOptionIndex(null)}
            onEmojiSelect={(emoji) => selectOptionEmoji(emojiOptionIndex, emoji)}
            onGifSelect={() => {}}
            onStickerSelect={() => {}}
            className="w-full !border-[var(--marinara-chat-chrome-panel-border)] !bg-[var(--background)] !text-[var(--foreground)] shadow-2xl shadow-black/35"
          />
        </NoodleAnchoredPopover>
      )}
    </>
  );
}
