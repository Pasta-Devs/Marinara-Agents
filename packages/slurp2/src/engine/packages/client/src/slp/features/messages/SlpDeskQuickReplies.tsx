// Saved answers for Slurp Support's desk (docs/FEEDBACK-2026-10.md R2): one tap puts one into the
// composer, "+" keeps the current draft for next time. Stored in the desk settings, so every
// persona's desk shares them.
import { Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  SLP_DESK_QUICK_REPLY_KEYS,
  SLP_DESK_QUICK_REPLY_LIMIT,
  SLP_DESK_QUICK_REPLY_MAX,
} from "../../../../../shared/src/slp/slp-support-desk.js";
import { errorMessage } from "../../modules/settings/slp-backstage-format";
import type { SlurpThreadViewModel } from "./slp-thread-actions";

const CHIP =
  "flex min-h-11 shrink-0 items-center gap-1 rounded-full bg-[var(--slurp-surface-raised)] px-3 text-xs font-semibold text-[var(--slurp-text)] ring-1 ring-inset ring-[var(--noodle-divider)] transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 motion-reduce:transition-none";

export function SlpDeskQuickReplies({ model }: { model: SlurpThreadViewModel }) {
  const { t } = useTranslation();
  const { settingsQuery, updateSlurpSettings, draft, setDraft, composerRef } = model;
  const desk = settingsQuery.data?.supportDesk;
  if (!desk) return null;
  const saved = desk.quickReplies ?? [];
  const replies = saved.length ? saved : SLP_DESK_QUICK_REPLY_KEYS.map((key) => t(key));
  const next = draft.trim();
  const save = (quickReplies: string[]) =>
    updateSlurpSettings.mutate(
      { supportDesk: { ...desk, quickReplies } },
      { onError: (error) => toast.error(errorMessage(error)) },
    );
  return (
    <div
      role="group"
      aria-label={t("ui.slurp.desk.quickReplies")}
      className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]"
    >
      {next && next.length <= SLP_DESK_QUICK_REPLY_MAX && !replies.includes(next) && (
        <button
          type="button"
          className={CHIP}
          disabled={updateSlurpSettings.isPending || replies.length >= SLP_DESK_QUICK_REPLY_LIMIT}
          onClick={() => save([...replies, next])}
        >
          <Plus size={14} aria-hidden="true" />
          {t("ui.slurp.desk.quickReplySave")}
        </button>
      )}
      {replies.map((reply) => (
        <span key={reply} className={CHIP + " pe-1"}>
          <button
            type="button"
            title={reply}
            className="max-w-56 truncate rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
            onClick={() => {
              setDraft(reply);
              composerRef.current?.focus();
            }}
          >
            {reply}
          </button>
          <button
            type="button"
            aria-label={t("ui.slurp.desk.quickReplyRemove", { reply })}
            disabled={updateSlurpSettings.isPending}
            onClick={() => save(replies.filter((entry) => entry !== reply))}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-[var(--slurp-muted)] hover:bg-[var(--accent)] hover:text-[var(--slurp-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
          >
            <X size={12} aria-hidden="true" />
          </button>
        </span>
      ))}
    </div>
  );
}
