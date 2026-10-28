import { Check } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { SLP_TYPE } from "../../base/chrome/SlpChrome";
import { SlpButton } from "../chrome/SlpButton";
import { SlpRadioRow, SlpSheet } from "../chrome/SlpSheet";
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

type SlpReportModalProps = {
  open: boolean;
  onClose: () => void;
  personaId: string;
  postId: string;
  targetType: "post" | "reply";
  targetId: string;
};

/**
 * Every post card and reply carries one, and almost none are ever opened: rendering the closed sheet
 * on each was the biggest single Slurp cost when a feed or profile mounted (0.3.41). It stays away
 * until the first open, then stays mounted so the sheet can play its close.
 */
export function SlpReportModal(props: SlpReportModalProps) {
  const [opened, setOpened] = useState(props.open);
  if (props.open && !opened) setOpened(true);
  return opened ? <SlpReportSheet {...props} /> : null;
}

function SlpReportSheet({ open, onClose, personaId, postId, targetType, targetId }: SlpReportModalProps) {
  const { t: localizeUi } = useUiTranslation();
  const report = useReportSlpContent();
  const [reason, setReason] = useState<SlpReportReason | null>(null);
  const [details, setDetails] = useState("");
  // Each opening starts clean: no reason picked, no leftover confirmation.
  const { reset } = report;
  useEffect(() => {
    if (!open) return;
    reset();
    setReason(null);
    setDetails("");
  }, [open, reset]);
  const needsDetails = reason === "other" && details.trim().length === 0;
  const canSubmit = reason !== null && !needsDetails;
  const submit = () => {
    if (!canSubmit || reason === null) return;
    void report.mutateAsync({ personaId, postId, targetType, targetId, reason, details }).catch(() => undefined);
  };
  const name = useId();
  const blocked =
    reason === null
      ? localizeUi("ui.slurp.post.reportNeedsReason", { defaultValue: "Pick a reason to send the report." })
      : needsDetails
        ? localizeUi("ui.slurp.post.reportNeedsDetails", { defaultValue: "Say what is wrong to send the report." })
        : null;
  const done = report.isSuccess;
  return (
    <SlpSheet
      open={open}
      onClose={onClose}
      closeDisabled={report.isPending}
      title={
        targetType === "reply"
          ? localizeUi("ui.slurp.post.reportReply", { defaultValue: "Report reply" })
          : localizeUi("ui.slurp.post.report", { defaultValue: "Report post" })
      }
      footer={
        done ? (
          <SlpButton className="w-full" onClick={onClose}>
            {localizeUi("ui.slurp.post.reportDone", { defaultValue: "Done" })}
          </SlpButton>
        ) : (
          <>
            <div className="flex justify-end gap-2">
              <SlpButton variant="tertiary" onClick={onClose} disabled={report.isPending}>
                {localizeUi("chat.delete.dialog.cancel")}
              </SlpButton>
              <SlpButton onClick={submit} disabled={!canSubmit || report.isPending}>
                {localizeUi("ui.slurp.post.reportSubmit", { defaultValue: "Send report" })}
              </SlpButton>
            </div>
            {/* The reason under a disabled button, so it never just sits there greyed out. */}
            <p aria-live="polite" className={`${SLP_TYPE.meta} min-h-4 pt-2 text-end text-[var(--slurp-muted)]`}>
              {blocked}
            </p>
          </>
        )
      }
    >
      {done ? (
        <div role="status" className="px-4 pb-4 pt-2 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-[color-mix(in_srgb,var(--slurp-success)_14%,transparent)] text-[var(--slurp-success)]">
            <Check size={26} aria-hidden="true" className="!text-current" />
          </span>
          <p className={`${SLP_TYPE.title} mt-4`}>
            {report.data?.duplicate
              ? localizeUi("ui.slurp.post.reportDuplicate", { defaultValue: "You already reported this" })
              : localizeUi("ui.slurp.post.reportSubmitted", { defaultValue: "Thanks for telling us" })}
          </p>
          <p className={`${SLP_TYPE.body} mx-auto mt-1.5 max-w-xs text-[var(--slurp-muted)]`}>
            {localizeUi("ui.slurp.post.reportWhatNext", {
              defaultValue: "Slurp's team has it now. The creator gets a private heads-up, without your name.",
            })}
          </p>
        </div>
      ) : (
        <div className="space-y-4 px-1 pt-1">
          {report.isError && (
            <p role="alert" className="px-2 text-sm text-[var(--slurp-danger)]">
              {report.error instanceof Error
                ? report.error.message
                : localizeUi("ui.slurp.post.reportFailed", { defaultValue: "The report could not be sent." })}
            </p>
          )}
          <fieldset className="min-w-0">
            <legend className={`${SLP_TYPE.meta} px-2 pb-1 text-[var(--slurp-muted)]`}>
              {localizeUi("ui.slurp.post.reportReason", { defaultValue: "What is wrong with it?" })}
            </legend>
            {SLP_REPORT_REASONS.map((value) => (
              <SlpRadioRow key={value} name={name} checked={reason === value} onChange={() => setReason(value)}>
                {localizeUi(`ui.slurp.post.reportReasons.${value}`, { defaultValue: REASON_LABELS[value] })}
              </SlpRadioRow>
            ))}
          </fieldset>
          <label className="block space-y-1 px-2 pb-1">
            <span className={`${SLP_TYPE.meta} block text-[var(--slurp-muted)]`}>
              {reason === "other"
                ? localizeUi("ui.slurp.post.reportDetails", { defaultValue: "Details" })
                : localizeUi("ui.slurp.post.reportDetailsOptional", { defaultValue: "Details (optional)" })}
            </span>
            <textarea
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              rows={3}
              maxLength={2000}
              required={reason === "other"}
              className="w-full rounded-xl bg-[var(--slurp-surface-raised)] p-3 text-base ring-1 ring-inset ring-[var(--noodle-divider)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] sm:text-sm"
            />
          </label>
        </div>
      )}
    </SlpSheet>
  );
}
