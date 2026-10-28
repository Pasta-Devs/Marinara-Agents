import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { cn } from "../../../lib/utils";
import { SLP_BAR_GLASS_CLASS, SLP_TYPE } from "../../base/chrome/SlpChrome";
import { SlpButton } from "../../modules/chrome/SlpButton";
import { errorMessage } from "../../modules/settings/slp-backstage-format";
import type { SlpSupportDesk } from "../../../../../shared/src/slp/slp-support-desk.js";
import { useResolveSlurpDeskTicket } from "./slp-message-action-hooks";
import type { SlurpThreadViewModel } from "./slp-thread-actions";

/** The open ticket, pinned under the header of a Support thread, with Resolve (docs/SUPPORT-DESK.md). */
export function SlpDeskTicketBar({ model, desk }: { model: SlurpThreadViewModel; desk: SlpSupportDesk }) {
  const { t } = useTranslation();
  const resolve = useResolveSlurpDeskTicket();
  const { personaId, targetCreatorAccountId, setReplyStatus } = model;
  const ticket = desk.ticket;
  if (!ticket || ticket.status === "resolved") return null;
  return (
    <div className={cn("relative z-[8] shrink-0 px-3 py-2 shadow-[var(--slurp-shadow-raised)]", SLP_BAR_GLASS_CLASS)}>
      <div className="mx-auto flex w-full max-w-[45rem] items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className={cn(SLP_TYPE.caption, "text-[var(--slurp-muted)]")}>
            {t(`ui.slurp.desk.ticketKind.${ticket.kind}`, {
              defaultValue:
                ticket.kind === "leaving"
                  ? "They want to leave"
                  : ticket.kind === "caught"
                    ? "They caught Slurp"
                    : "Ticket",
            })}
            {" · "}
            {t(`ui.slurp.desk.ticketStatus.${ticket.status}`, {
              defaultValue: ticket.status === "open" ? "Open ticket" : "Waiting on them",
            })}
          </p>
          <p className={cn(SLP_TYPE.body, "truncate font-semibold")}>{ticket.topic}</p>
        </div>
        <SlpButton
          variant="quiet"
          className="shrink-0 text-[13px]"
          disabled={!personaId || !targetCreatorAccountId || resolve.isPending}
          onClick={() =>
            personaId &&
            targetCreatorAccountId &&
            resolve.mutate(
              { personaId, creatorAccountId: targetCreatorAccountId },
              {
                onSuccess: (result) => setReplyStatus(result.replyStatus),
                onError: (error) => toast.error(errorMessage(error)),
              },
            )
          }
        >
          {resolve.isPending
            ? t("ui.slurp.desk.resolving", { defaultValue: "Resolving…" })
            : t("ui.slurp.desk.resolve", { defaultValue: "Resolve" })}
        </SlpButton>
      </div>
    </div>
  );
}
