// Edit or delete one DM (docs/FEEDBACK-2026-10.md R9). The rules live in shared/slp-message-edit.ts;
// the bubble only offers what they allow. Props in.
import { useEffect, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { getApiErrorMessage } from "../../../lib/api-client";
import { SlpAutoGrowTextarea } from "../../base/ui/SlpAutoGrowTextarea";
import { SlpButton, SlpPrimaryButton } from "../../modules/chrome/SlpButton";
import { SlpSheet } from "../../modules/chrome/SlpSheet";
import type { SlurpMessage } from "./slp-messages-contract";
import { useDeleteSlurpMessage, useEditSlurpMessage } from "./slp-message-action-hooks";

export function SlpMessageEditSheet({
  message,
  personaId,
  mode,
  onClose,
}: {
  message: SlurpMessage;
  personaId: string;
  mode: "edit" | "delete" | null;
  onClose: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const edit = useEditSlurpMessage();
  const remove = useDeleteSlurpMessage();
  const [draft, setDraft] = useState(message.content);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (mode) {
      setDraft(message.content);
      setError(null);
    }
  }, [mode, message.content]);
  const pending = edit.isPending || remove.isPending;
  const ids = { personaId, threadId: message.threadId, messageId: message.id };
  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
      onClose();
    } catch (cause) {
      setError(getApiErrorMessage(cause, localizeUi("ui.slurp.messages.editFailed")));
    }
  };
  const editing = mode === "edit";
  const trimmed = draft.trim();
  return (
    <SlpSheet
      open={mode !== null}
      onClose={onClose}
      closeDisabled={pending}
      title={localizeUi(editing ? "ui.slurp.messages.editTitle" : "ui.slurp.messages.deleteTitle")}
      footer={
        <div className="flex justify-end gap-2">
          <SlpButton variant="tertiary" onClick={onClose} disabled={pending}>
            {localizeUi("ui.slurp.messages.editCancel")}
          </SlpButton>
          {editing ? (
            <SlpPrimaryButton
              disabled={pending || !trimmed || trimmed === message.content.trim()}
              aria-busy={edit.isPending}
              onClick={() => void run(() => edit.mutateAsync({ ...ids, content: trimmed }))}
            >
              {localizeUi("ui.slurp.messages.editSave")}
            </SlpPrimaryButton>
          ) : (
            <SlpButton
              variant="danger"
              disabled={pending}
              aria-busy={remove.isPending}
              onClick={() => void run(() => remove.mutateAsync(ids))}
            >
              {localizeUi("ui.slurp.messages.deleteConfirm")}
            </SlpButton>
          )}
        </div>
      }
    >
      <div className="space-y-2 px-2 pb-2 pt-1">
        {editing ? (
          <SlpAutoGrowTextarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={2000}
            aria-label={localizeUi("ui.slurp.messages.editTitle")}
            className="min-h-20 w-full resize-none rounded-xl border-0 bg-[var(--slurp-surface-raised)] px-3 py-2 text-base leading-6 text-[var(--slurp-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] sm:text-[15px]"
          />
        ) : (
          <>
            <p className="line-clamp-4 whitespace-pre-line rounded-xl bg-[var(--slurp-surface-raised)] px-3 py-2 text-sm">
              {message.content}
            </p>
            <p className="text-xs leading-5 text-[var(--slurp-muted)]">
              {localizeUi("ui.slurp.messages.deleteDetail")}
            </p>
          </>
        )}
        {error && (
          <p role="alert" className="text-xs text-[var(--slurp-danger)]">
            {error}
          </p>
        )}
      </div>
    </SlpSheet>
  );
}
