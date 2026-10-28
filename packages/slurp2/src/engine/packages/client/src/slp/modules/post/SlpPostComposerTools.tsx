import { ImageIcon, ListChecks, Pencil, Smile, Trash2, X } from "lucide-react";
import type { RefObject } from "react";
import { cn } from "../../../lib/utils";
import { SlpAnchoredPopover } from "../../base/chrome/SlpAnchoredPopover";
import { SLP_TYPE } from "../../base/chrome/SlpChrome";
import { useTranslation as useUiTranslation } from "react-i18next";

export function SlpToolButton({
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
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full p-0 !text-[var(--noodle-accent-foreground)] transition-colors active:scale-95 [&_svg]:!text-[var(--noodle-accent-foreground)]",
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

type SlpComposerTool = {
  ref?: RefObject<HTMLDivElement | null>;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
};

// Shared composer icon row (image / poll / emoji) so every Noodle surface renders
// the identical toolbar. NoodleR passes a trailing coin control for monetization settings.
export function SlpComposerToolRow({
  image,
  poll,
  media,
  trailing,
}: {
  image: SlpComposerTool;
  poll: SlpComposerTool;
  media: SlpComposerTool;
  trailing?: React.ReactNode;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <>
      <div ref={image.ref} className="relative">
        <SlpToolButton
          title={localizeUi("ui.noodle.noodlehome.attachImage")}
          active={Boolean(image.active)}
          disabled={image.disabled}
          onClick={() => image.onClick?.()}
        >
          <ImageIcon size={18} />
        </SlpToolButton>
      </div>
      <div ref={poll.ref} className="relative">
        <SlpToolButton
          title={
            poll.active ? localizeUi("ui.noodle.noodlehome.editPoll") : localizeUi("ui.noodle.noodlehome.createPoll")
          }
          active={Boolean(poll.active)}
          disabled={poll.disabled}
          onClick={() => poll.onClick?.()}
        >
          <ListChecks size={18} />
        </SlpToolButton>
      </div>
      <div ref={media.ref} className="relative">
        <SlpToolButton
          title={localizeUi("ui.noodle.noodlehome.emojiGifsAndStickers")}
          active={Boolean(media.active)}
          disabled={media.disabled}
          onClick={() => media.onClick?.()}
        >
          <Smile size={18} />
        </SlpToolButton>
      </div>
      {trailing}
    </>
  );
}

export function SlurpToolPopover({
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
    <SlpAnchoredPopover anchorRef={anchorRef} wide={wide} modalOwned={modalOwned}>
      <div className="marinara-chat-popover flex h-[22rem] max-h-[60vh] flex-col overflow-hidden rounded-xl border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] text-[var(--foreground)] shadow-2xl shadow-black/35">
        <div className="flex shrink-0 items-center gap-1 border-b border-foreground/10 px-2 py-1.5">
          <span className="flex-1 rounded-lg bg-foreground/10 px-2 py-1 text-center text-xs font-medium text-foreground/80 ring-1 ring-foreground/15">
            {title}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--noodle-accent-foreground)] transition-colors hover:bg-foreground/10"
            title={localizeUi("capabilities.actions.close")}
          >
            <X size={14} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">{children}</div>
      </div>
    </SlpAnchoredPopover>
  );
}

/** The poll attached to a draft, as one row: its question and answers, with Edit and Remove. */
export function SlpComposerPollSummary({
  poll,
  disabled,
  onEdit,
  onRemove,
}: {
  poll: { question: string; options: string[] };
  disabled: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const iconButton =
    "grid size-10 place-items-center rounded-full hover:bg-[var(--accent)] disabled:opacity-50 [&_svg]:!text-current";
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl bg-[var(--slurp-surface-raised)] p-3 shadow-[var(--slurp-highlight)]">
      <div className="min-w-0 flex-1">
        <p className={cn(SLP_TYPE.body, "font-semibold")}>{poll.question}</p>
        <p className={cn(SLP_TYPE.meta, "mt-1 truncate text-[var(--slurp-muted)]")}>{poll.options.join(" · ")}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onEdit}
          disabled={disabled}
          className={cn(iconButton, "text-[var(--slurp-ink)]")}
          aria-label={localizeUi("ui.noodle.noodlehome.editDraftPoll")}
          title={localizeUi("ui.noodle.noodlehome.editPoll")}
        >
          <Pencil size={16} />
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className={cn(iconButton, "text-[var(--slurp-danger)]")}
          aria-label={localizeUi("ui.noodle.noodlehome.removeDraftPoll")}
          title={localizeUi("ui.noodle.noodlehome.removePoll")}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
