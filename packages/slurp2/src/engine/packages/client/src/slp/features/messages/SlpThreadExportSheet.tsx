// Take a DM thread out of Slurp (docs/FEEDBACK-2026-10.md R10): copy the whole conversation, or a
// short summary for a lorebook or the Long-Term Memory agent. Props in.
import { useMutation } from "@tanstack/react-query";
import { Copy, Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { toast } from "sonner";
import { api, getApiErrorMessage } from "../../../lib/api-client";
import { SlpPrimaryButton } from "../../modules/chrome/SlpButton";
import { SlpSheet } from "../../modules/chrome/SlpSheet";
import { SlpUsesAiMark } from "../../modules/chrome/SlpAiMark";

type Localize = ReturnType<typeof useUiTranslation>["t"];

/** The whole conversation as text, onto the clipboard. */
export async function copySlpThread(personaId: string, threadId: string, localizeUi: Localize) {
  try {
    const { text } = await api.get<{ text: string }>(
      `/slurp2/messages/threads/${encodeURIComponent(threadId)}/export?personaId=${encodeURIComponent(personaId)}`,
    );
    await navigator.clipboard.writeText(text);
    toast.success(localizeUi("ui.slurp.messages.exportCopied"));
  } catch (cause) {
    toast.error(getApiErrorMessage(cause, localizeUi("ui.slurp.messages.exportFailed")));
  }
}

/** The summary: written when the sheet opens, then copied with one tap. */
export function SlpThreadSummarySheet({
  personaId,
  threadId,
  open,
  onClose,
}: {
  personaId: string;
  threadId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const summary = useMutation({
    mutationFn: () =>
      api.post<{ text: string }>(`/slurp2/messages/threads/${encodeURIComponent(threadId)}/summary`, { personaId }),
  });
  const { mutate, reset } = summary;
  useEffect(() => {
    if (open) mutate();
    else reset();
  }, [open, mutate, reset]);
  const text = summary.data?.text ?? "";
  return (
    <SlpSheet
      open={open}
      onClose={onClose}
      title={localizeUi("ui.slurp.messages.summaryTitle")}
      footer={
        <div className="flex justify-end">
          <SlpPrimaryButton
            disabled={!text}
            onClick={() =>
              void navigator.clipboard
                .writeText(text)
                .then(() => toast.success(localizeUi("ui.slurp.messages.exportCopied")))
            }
          >
            <Copy size={16} aria-hidden="true" />
            {localizeUi("ui.slurp.messages.summaryCopy")}
          </SlpPrimaryButton>
        </div>
      }
    >
      <div className="space-y-2 px-2 pb-2 pt-1" aria-live="polite">
        <p className="flex items-center gap-1 text-xs leading-5 text-[var(--slurp-muted)]">
          {localizeUi("ui.slurp.messages.summaryDetail")}
          <SlpUsesAiMark />
        </p>
        {summary.isPending ? (
          <p className="flex items-center gap-2 py-6 text-sm text-[var(--slurp-muted)]">
            <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
            {localizeUi("ui.slurp.messages.summaryWriting")}
          </p>
        ) : summary.isError ? (
          <p role="alert" className="text-sm text-[var(--slurp-danger)]">
            {getApiErrorMessage(summary.error, localizeUi("ui.slurp.messages.exportFailed"))}
          </p>
        ) : (
          <p className="whitespace-pre-line rounded-xl bg-[var(--slurp-surface-raised)] px-3 py-2 text-sm leading-6">
            {text}
          </p>
        )}
      </div>
    </SlpSheet>
  );
}
