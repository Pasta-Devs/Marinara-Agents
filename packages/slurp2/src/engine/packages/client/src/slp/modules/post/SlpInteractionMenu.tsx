import { Copy, Heart, MessageCircle, MoreHorizontal, Pencil, Flag, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";

const ITEM_CLASS = "flex min-h-9 w-full items-center gap-2 px-3 text-start transition-colors hover:bg-[var(--accent)]";

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
  const close = () => setOpen(false);
  const run = (action: () => void) => {
    close();
    action();
  };

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-label={localizeUi("ui.noodle.noodlepostcard.commentActions", { defaultValue: "Comment actions" })}
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--noodle-accent-foreground)] transition-colors hover:bg-[var(--noodle-accent)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]/70 disabled:opacity-50"
      >
        <MoreHorizontal size={14} aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute end-0 top-[calc(100%+0.25rem)] z-40 min-w-44 overflow-hidden rounded-lg border border-[var(--noodle-divider)] bg-[var(--background)] py-1 text-xs shadow-2xl shadow-black/30"
        >
          <button type="button" role="menuitem" onClick={() => run(onReply)} className={ITEM_CLASS}>
            <MessageCircle size={14} /> {localizeUi("ui.noodle.noodlepostcard.reply")}
          </button>
          <button type="button" role="menuitem" onClick={() => run(onLike)} className={ITEM_CLASS}>
            <Heart size={14} fill={liked ? "currentColor" : "none"} />
            {localizeUi(liked ? "ui.noodle.noodlepostcard.unlikeComment" : "ui.noodle.noodlepostcard.likeComment")}
          </button>
          <button type="button" role="menuitem" onClick={() => run(onCopy)} className={ITEM_CLASS}>
            <Copy size={14} /> {localizeUi("ui.slurp.post.copyText", { defaultValue: "Copy text" })}
          </button>
          {onReport && (
            <button type="button" role="menuitem" onClick={() => run(onReport)} className={ITEM_CLASS}>
              <Flag size={14} /> {localizeUi("ui.slurp.post.reportReply", { defaultValue: "Report reply" })}
            </button>
          )}
          {canManage && (
            <>
              <div className="my-1 border-t border-[var(--noodle-divider)]" />
              <button type="button" role="menuitem" onClick={() => run(onEdit)} className={ITEM_CLASS}>
                <Pencil size={14} /> {localizeUi("ui.noodle.noodlepostcard.editComment")}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => run(onDelete)}
                className={`${ITEM_CLASS} text-[var(--slurp-danger)] [&_svg]:!text-[var(--slurp-danger)]`}
              >
                <Trash2 size={14} /> {localizeUi("ui.noodle.noodlepostcard.deleteComment")}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
