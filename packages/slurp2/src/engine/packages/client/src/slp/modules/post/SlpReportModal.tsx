import { useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { Modal } from "../../../components/ui/Modal";
import { useReportSlpContent } from "./slp-post-action-hooks";

export function SlpReportModal({
  open,
  onClose,
  personaId,
  postId,
  targetType,
  targetId,
}: {
  open: boolean;
  onClose: () => void;
  personaId: string;
  postId: string;
  targetType: "post" | "reply";
  targetId: string;
}) {
  const { t: localizeUi } = useUiTranslation();
  const report = useReportSlpContent();
  const [reason, setReason] = useState<"spam" | "illegal" | "privacy" | "harassment" | "adult" | "other">("spam");
  const [details, setDetails] = useState("");
  const canSubmit = reason !== "other" || details.trim().length > 0;
  const submit = () => {
    if (!canSubmit) return;
    void report.mutateAsync({ personaId, postId, targetType, targetId, reason, details }).catch(() => undefined);
  };
  return (
    <Modal
      open={open}
      onClose={report.isPending ? () => undefined : onClose}
      title={localizeUi("ui.slurp.post.report", { defaultValue: "Report content" })}
    >
      {report.isSuccess ? (
        <p className="p-4 text-sm">
          {localizeUi("ui.slurp.post.reportSubmitted", { defaultValue: "Report submitted." })}
        </p>
      ) : (
        <div className="space-y-4 p-4">
          <label className="block space-y-1 text-sm font-semibold">
            <span>{localizeUi("ui.slurp.post.reportReason", { defaultValue: "Reason" })}</span>
            <select
              value={reason}
              onChange={(event) => setReason(event.target.value as typeof reason)}
              className="h-10 w-full rounded-lg border border-[var(--noodle-divider)] bg-[var(--background)] px-3"
            >
              <option value="spam">
                {localizeUi("ui.slurp.post.reportSpam", { defaultValue: "Spam or broken content" })}
              </option>
              <option value="illegal">
                {localizeUi("ui.slurp.post.reportIllegal", { defaultValue: "Illegal content" })}
              </option>
              <option value="privacy">
                {localizeUi("ui.slurp.post.reportPrivacy", { defaultValue: "Privacy issue" })}
              </option>
              <option value="harassment">
                {localizeUi("ui.slurp.post.reportHarassment", { defaultValue: "Harassment or abuse" })}
              </option>
              <option value="adult">
                {localizeUi("ui.slurp.post.reportAdult", { defaultValue: "Adult content issue" })}
              </option>
              <option value="other">{localizeUi("ui.slurp.post.reportOther", { defaultValue: "Other" })}</option>
            </select>
          </label>
          <label className="block space-y-1 text-sm font-semibold">
            <span>{localizeUi("ui.slurp.post.reportDetails", { defaultValue: "Details" })}</span>
            <textarea
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              rows={4}
              maxLength={2000}
              className="w-full rounded-lg border border-[var(--noodle-divider)] bg-[var(--background)] p-3 text-sm"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-10 rounded-lg px-4 font-semibold hover:bg-[var(--accent)]"
            >
              {localizeUi("chat.delete.dialog.cancel")}
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit || report.isPending}
              className="min-h-10 rounded-lg bg-[var(--noodle-accent)] px-4 font-bold text-zinc-950 disabled:opacity-50"
            >
              {localizeUi("ui.slurp.post.reportSubmit", { defaultValue: "Submit report" })}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
