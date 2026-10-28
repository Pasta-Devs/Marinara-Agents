import { Heart, Send } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "../../../lib/api-client";
import { cn } from "../../../lib/utils";
import { slpKeys } from "../../base/state/slp-query-keys";
import { SlpButton } from "../../modules/chrome/SlpButton";
import type { SlurpEventItem } from "./slp-notifications-contract";

/**
 * A fan's note to the player's own page: fans write notes there, never a chat to keep up with. The
 * player can heart it and reply once; the reply stays under the note.
 */
export function SlpFanNoteActions({ event, personaId }: { event: SlurpEventItem; personaId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [writing, setWriting] = useState(false);
  const answer = event.answer ?? null;
  const send = useMutation({
    mutationFn: (body: { heart?: true; reply?: string }) =>
      api.post(`/slurp2/slurp/notifications/${encodeURIComponent(event.id)}/fan-note`, { personaId, ...body }),
    onSuccess: () => {
      setWriting(false);
      setDraft("");
      void qc.invalidateQueries({ queryKey: slpKeys.notifications(personaId) });
    },
    onError: () => void toast.error(t("ui.slurp.fanNote.failed")),
  });
  return (
    <div className="mt-1.5 space-y-1.5">
      {answer?.reply && (
        <p className="rounded-lg bg-[var(--slurp-surface)] px-2.5 py-1.5 text-[13px] text-[var(--slurp-text)]">
          <span className="font-semibold">{t("ui.slurp.fanNote.you")}</span> {answer.reply}
        </p>
      )}
      {writing ? (
        <form
          className="flex items-center gap-2"
          onSubmit={(submit) => {
            submit.preventDefault();
            if (draft.trim()) send.mutate({ reply: draft.trim() });
          }}
        >
          <input
            value={draft}
            onChange={(change) => setDraft(change.target.value)}
            maxLength={280}
            autoFocus
            aria-label={t("ui.slurp.fanNote.replyLabel")}
            placeholder={t("ui.slurp.fanNote.replyPlaceholder")}
            className="min-h-11 min-w-0 flex-1 rounded-lg bg-[var(--slurp-surface)] px-3 text-base ring-1 ring-inset ring-[var(--slurp-outline)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] sm:text-sm"
          />
          <SlpButton
            type="submit"
            variant="secondary"
            disabled={!draft.trim() || send.isPending}
            aria-label={t("ui.slurp.fanNote.send")}
            className="min-h-11 min-w-11 px-3"
          >
            <Send size={16} aria-hidden="true" />
          </SlpButton>
        </form>
      ) : (
        <div className="flex items-center gap-2">
          <SlpButton
            variant="tertiary"
            disabled={answer?.hearted || send.isPending}
            aria-pressed={Boolean(answer?.hearted)}
            onClick={() => send.mutate({ heart: true })}
            className="min-h-11 px-3 text-[13px]"
          >
            <Heart
              size={15}
              aria-hidden="true"
              className={cn(answer?.hearted && "fill-[var(--noodle-accent)] text-[var(--noodle-accent)]")}
            />
            {t(answer?.hearted ? "ui.slurp.fanNote.hearted" : "ui.slurp.fanNote.heart")}
          </SlpButton>
          {!answer?.reply && (
            <SlpButton variant="tertiary" onClick={() => setWriting(true)} className="min-h-11 px-3 text-[13px]">
              {t("ui.slurp.fanNote.reply")}
            </SlpButton>
          )}
        </div>
      )}
    </div>
  );
}
