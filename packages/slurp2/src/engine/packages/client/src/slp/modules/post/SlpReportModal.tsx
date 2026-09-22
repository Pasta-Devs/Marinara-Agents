import { useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { Modal } from "../../../components/ui/Modal";
import { SLP_REPORT_REASONS, useReportSlpContent, type SlpReportReason } from "./slp-post-action-hooks";

/**
 * The wording each reason carries. The list is the one a real social network offers, plus the
 * three that only exist here: a Creator passing themselves off as a real person, paid content
 * reposted for free, and a Creator who reads as underage.
 */
const REASON_LABELS: Record<SlpReportReason, string> = {
  spam: "Spam or misleading",
  scam: "Scam or fraud",
  misinformation: "False information",
  harassment: "Harassment or bullying",
  hate: "Hate speech or symbols",
  violence: "Violence or dangerous behaviour",
  self_harm: "Suicide or self-harm",
  adult: "Adult content in the wrong place",
  underage: "Creator looks underage",
  privacy: "Privacy or personal details",
  intellectual_property: "Intellectual property",
  impersonation: "Pretending to be a real person",
  leaked_paid: "Leaked paid content",
  illegal: "Illegal content",
  other: "Something else",
};

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
  const [reason, setReason] = useState<SlpReportReason>("spam");
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
              {SLP_REPORT_REASONS.map((value) => (
                <option key={value} value={value}>
                  {localizeUi(`ui.slurp.post.reportReasons.${value}`, { defaultValue: REASON_LABELS[value] })}
                </option>
              ))}
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
