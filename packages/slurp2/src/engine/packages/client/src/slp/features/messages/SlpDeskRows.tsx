import { useTranslation } from "react-i18next";
import { Headset, NotebookPen } from "lucide-react";
import { toast } from "sonner";
import { cn } from "../../../lib/utils";
import { SLP_TYPE } from "../../base/chrome/SlpChrome";
import { SlpButton, SlpPrimaryButton } from "../../modules/chrome/SlpButton";
import { errorMessage } from "../../modules/settings/slp-backstage-format";
import type { SlurpMessage } from "./slp-messages-contract";
import { useAnswerSlurpDeskOffer } from "./slp-message-action-hooks";

/**
 * The Support desk's rows in a thread (docs/SUPPORT-DESK.md). One look with the sign-up scene: the
 * staff label, Slurp's notices, the approval stamp.
 */

type Offer = { action: string; summary?: string; status: string; counter?: string; error?: string };

export const readSlpDeskOffer = (message: SlurpMessage): Offer | null => {
  const value = message.metadata?.deskOffer as Offer | undefined;
  return value && typeof value.action === "string" ? value : null;
};

/** The stamp the sign-up ends with, reused for a yes: accepted, won, granted. */
export function SlpDeskStamp({ label, tone = "ok" }: { label: string; tone?: "ok" | "no" | "wait" }) {
  return (
    <span
      className={cn(
        "inline-flex -rotate-3 items-center rounded-md border-2 px-1.5 py-0.5 text-[11px] font-extrabold uppercase leading-4 tracking-[0.08em]",
        tone === "ok" && "border-[var(--slurp-success)] text-[var(--slurp-success)]",
        tone === "no" &&
          "border-[var(--slurp-danger,var(--destructive))] text-[var(--slurp-danger,var(--destructive))]",
        tone === "wait" && "border-[var(--slurp-muted)] text-[var(--slurp-muted)]",
      )}
    >
      {label}
    </span>
  );
}

/** The name over a Support line: a headset, so it never reads as the persona. */
export function SlpDeskStaffLabel({ name }: { name: string }) {
  return (
    <p className="flex items-center gap-1.5 px-2 text-xs font-semibold text-[var(--slurp-muted)]">
      <Headset size={12} aria-hidden="true" />
      {name}
    </p>
  );
}

/** Slurp's own notice: a centred system row, no bubble. */
export function SlpDeskNoticeRow({ message }: { message: SlurpMessage }) {
  const perk = Boolean(message.metadata?.deskPerk);
  return (
    <p
      className={cn(
        SLP_TYPE.meta,
        "flex max-w-[88%] flex-wrap items-center justify-center gap-2 self-center rounded-full bg-[var(--slurp-surface)] px-3 py-1.5 text-center text-[var(--slurp-text)]",
      )}
    >
      {message.content.replace(/^Slurp:\s*/u, "")}
      {perk && <SlpDeskStamp label="Slurp" />}
    </p>
  );
}

/** An internal note: the player's own line, marked so it never looks sent. */
export function SlpDeskNoteRow({ message }: { message: SlurpMessage }) {
  const { t } = useTranslation();
  return (
    <div className="flex max-w-[82%] flex-col gap-1 self-end rounded-2xl border border-dashed border-[var(--slurp-outline)] px-3 py-2 sm:max-w-[72%]">
      <p className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--slurp-muted)]">
        <NotebookPen size={12} aria-hidden="true" />
        {t("ui.slurp.desk.noteOnlyYou", { defaultValue: "Note · only you see this" })}
      </p>
      <p className={cn(SLP_TYPE.body, "whitespace-pre-wrap break-words")}>{message.content}</p>
    </div>
  );
}

/**
 * An Offer under the Support line that made it: what it is and how it stands. On a Creator the
 * player runs, the player answers it here.
 */
export function SlpDeskOfferCard({
  message,
  ownsCreator,
  personaId,
}: {
  message: SlurpMessage;
  ownsCreator: boolean;
  personaId: string | null;
}) {
  const { t } = useTranslation();
  const offer = readSlpDeskOffer(message);
  const answer = useAnswerSlurpDeskOffer();
  if (!offer) return null;
  const status = offer.status as "pending" | "accepted" | "countered" | "declined" | "failed";
  const stamp = {
    pending: { label: t("ui.slurp.desk.offer.pending", { defaultValue: "Waiting" }), tone: "wait" as const },
    accepted: { label: t("ui.slurp.desk.offer.accepted", { defaultValue: "Accepted" }), tone: "ok" as const },
    countered: { label: t("ui.slurp.desk.offer.countered", { defaultValue: "Counter" }), tone: "wait" as const },
    declined: { label: t("ui.slurp.desk.offer.declined", { defaultValue: "Declined" }), tone: "no" as const },
    failed: { label: t("ui.slurp.desk.offer.failed", { defaultValue: "Could not run" }), tone: "no" as const },
  }[status] ?? { label: status, tone: "wait" as const };
  const mine = !ownsCreator;
  return (
    <div
      data-slp-desk-offer={status}
      className={cn(
        "flex w-[min(20rem,78vw)] flex-col gap-2 rounded-2xl bg-[var(--slurp-surface-raised)] p-3 shadow-[var(--slurp-shadow-raised),var(--slurp-highlight)]",
        mine ? "self-end" : "self-start",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={cn(SLP_TYPE.caption, "text-[var(--slurp-muted)]")}>
            {t("ui.slurp.desk.offer.label", { defaultValue: "Offer from Slurp" })}
          </p>
          <p className={cn(SLP_TYPE.body, "font-bold")}>
            {t(`ui.slurp.stir.card.${offer.action}.title`, { defaultValue: offer.action })}
          </p>
        </div>
        <SlpDeskStamp label={stamp.label} tone={stamp.tone} />
      </div>
      {status === "countered" && offer.counter && (
        <p className={cn(SLP_TYPE.meta, "text-[var(--slurp-text)]")}>
          {t("ui.slurp.desk.offer.counterLine", { defaultValue: "They want: {{text}}", text: offer.counter })}
        </p>
      )}
      {status === "failed" && offer.error && (
        <p className={cn(SLP_TYPE.meta, "text-[var(--slurp-danger,var(--destructive))]")}>{offer.error}</p>
      )}
      {ownsCreator && status === "pending" && personaId && (
        <div className="flex gap-2">
          <SlpButton
            variant="quiet"
            className="flex-1"
            disabled={answer.isPending}
            onClick={() =>
              answer.mutate(
                { personaId, messageId: message.id, answer: "decline" },
                { onError: (error) => toast.error(errorMessage(error)) },
              )
            }
          >
            {t("ui.slurp.desk.offer.decline", { defaultValue: "Decline" })}
          </SlpButton>
          <SlpPrimaryButton
            className="flex-1"
            disabled={answer.isPending}
            onClick={() =>
              answer.mutate(
                { personaId, messageId: message.id, answer: "accept" },
                { onError: (error) => toast.error(errorMessage(error)) },
              )
            }
          >
            {t("ui.slurp.desk.offer.accept", { defaultValue: "Accept" })}
          </SlpPrimaryButton>
        </div>
      )}
    </div>
  );
}
