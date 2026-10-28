import { Copy, MessageCircle, MoreHorizontal, Pencil, Flag, Trash2 } from "lucide-react";
import { SlpHeartGlyph } from "../../base/chrome/SlpGlyphs";
import { useRef, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { SlpSheet, SlpSheetGroup, SlpSheetItem } from "../chrome/SlpSheet";

export function SlpInteractionMenu({
  liked,
  canManage,
  onReply,
  onLike,
  onCopy,
  onReport,
  onEdit,
  onDelete,
  disabled = false,
}: {
  liked: boolean;
  canManage: boolean;
  onReply: () => void;
  onLike: () => void;
  onCopy: () => void;
  onReport?: () => void;
  onEdit: () => void;
  onDelete: () => void;
  disabled?: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const run = (action: () => void) => () => {
    setOpen(false);
    action();
  };
  const title = localizeUi("ui.noodle.noodlepostcard.commentActions", { defaultValue: "Comment actions" });

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-label={title}
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--noodle-accent-foreground)] transition-colors hover:bg-[var(--noodle-accent)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]/70 disabled:opacity-50"
      >
        <MoreHorizontal size={14} aria-hidden="true" />
      </button>
      <SlpSheet kind="menu" open={open} onClose={() => setOpen(false)} anchorRef={triggerRef} title={title}>
        <SlpSheetGroup>
          <SlpSheetItem onSelect={run(onReply)}>
            <MessageCircle size={14} />
            {localizeUi("ui.noodle.noodlepostcard.reply")}
          </SlpSheetItem>
          <SlpSheetItem onSelect={run(onLike)}>
            <SlpHeartGlyph size={14} filled={liked} />
            {localizeUi(liked ? "ui.noodle.noodlepostcard.unlikeComment" : "ui.noodle.noodlepostcard.likeComment")}
          </SlpSheetItem>
          <SlpSheetItem onSelect={run(onCopy)}>
            <Copy size={14} />
            {localizeUi("ui.slurp.post.copyText", { defaultValue: "Copy text" })}
          </SlpSheetItem>
          {onReport && (
            <SlpSheetItem onSelect={run(onReport)}>
              <Flag size={14} />
              {localizeUi("ui.slurp.post.reportReply", { defaultValue: "Report reply" })}
            </SlpSheetItem>
          )}
        </SlpSheetGroup>
        {canManage && (
          <SlpSheetGroup label={localizeUi("ui.slurp.post.creatorTools", { defaultValue: "Creator tools" })}>
            <SlpSheetItem tone="muted" onSelect={run(onEdit)}>
              <Pencil size={14} />
              {localizeUi("ui.noodle.noodlepostcard.editComment")}
            </SlpSheetItem>
            <SlpSheetItem tone="danger" onSelect={run(onDelete)}>
              <Trash2 size={14} />
              {localizeUi("ui.noodle.noodlepostcard.deleteComment")}
            </SlpSheetItem>
          </SlpSheetGroup>
        )}
      </SlpSheet>
    </div>
  );
}
