import { Brain, Check, Link, X } from "lucide-react";
import { useOpenSlurpCreatorThread, useSlurpComposeTargets } from "../../features/messages/slp-messages-hooks";
import { useRef } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import {
  CommissionRequest,
  CommissionRow,
  isCommissionRequest,
  SlurpCommissionsPanel,
} from "./commissions/SlpCommissions";
import { cn } from "../../../lib/utils";
import { SlurpCoin, SlurpCoinAmount, SlurpCoinBurst } from "../../modules/coin/SlpCoin";
import type { SlurpMessage, SlurpThread, SlurpThreadRelationship } from "../../features/messages/slp-messages-contract";
import { useCancelSlurpFollowUp } from "../../features/messages/slp-message-action-hooks";
import {
  useSlurpCompose,
  useSlurpMessagePrompt,
  useSlurpOlderMessages,
  useSlurpThread,
  useSlurpThreads,
} from "../../features/messages/slp-messages-hooks";
import { useSlurpSettings, useUpdateSlurpSettings } from "../../features/settings/slp-settings-contract";
import {
  SlurpPromptDebugPanel,
  SlurpRapportBadge,
  SlurpRelationshipPanel,
  SlurpTierLadder,
  useDismissablePopover,
} from "./SlpMessageInsights";

// The thread header controls, the connection switcher and one follow-up row.

/** One header control. All of them are icons at the same size, so none reads as the primary one. */
export function HeaderIconButton({
  icon: Icon,
  label,
  onClick,
  badge = 0,
  className,
}: {
  icon: typeof Brain;
  label: string;
  onClick: () => void;
  badge?: number;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "relative flex min-h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--muted-foreground)] transition-[background-color,transform] hover:bg-[var(--slurp-surface)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100",
        className,
      )}
    >
      <Icon size={16} aria-hidden="true" />
      {badge > 0 && (
        <span className="absolute right-1.5 top-1.5 min-w-4 rounded-full bg-[var(--noodle-accent)] px-1 text-[0.6rem] font-black leading-4 text-zinc-950 [&_svg]:!text-zinc-950">
          {badge}
        </span>
      )}
    </button>
  );
}

export function SlurpConnectionSwitcher({
  connections,
  activeConnectionId,
  open,
  onOpenChange,
  pending,
  onChange,
}: {
  connections: Array<{ id: string; name?: string; model?: string; provider?: string }>;
  activeConnectionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  onChange: (connectionId: string | null) => void;
}) {
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const active = connections.find((connection) => connection.id === activeConnectionId);
  const label = active?.name ?? active?.model ?? "Default connection";

  return (
    <div className="relative shrink-0">
      <button
        ref={anchorRef}
        type="button"
        disabled={pending}
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Text connection: ${label}`}
        title={`Text connection: ${label}`}
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-xl text-[var(--muted-foreground)] transition-colors hover:bg-[var(--noodle-accent)]/10 hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50",
          open && "bg-[var(--noodle-accent)]/10 text-[var(--noodle-accent)]",
        )}
      >
        <Link size={15} className="shrink-0" aria-hidden="true" />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="Text connections"
          className="absolute bottom-full start-0 z-20 mb-2 max-h-72 min-w-56 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl bg-[var(--slurp-surface-raised)] p-1 shadow-[var(--slurp-shadow-floating)] ring-1 ring-inset ring-[var(--noodle-divider)]"
        >
          <button
            type="button"
            role="option"
            aria-selected={activeConnectionId === null}
            onClick={() => {
              onChange(null);
              onOpenChange(false);
            }}
            className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-xs hover:bg-[var(--slurp-surface)]"
          >
            <span className="min-w-0 flex-1 truncate">Default connection</span>
            {activeConnectionId === null && <Check size={14} aria-hidden="true" />}
          </button>
          {connections.map((connection) => {
            const selected = connection.id === activeConnectionId;
            return (
              <button
                key={connection.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(connection.id);
                  onOpenChange(false);
                }}
                className="flex min-h-12 w-full items-center gap-2 rounded-lg px-3 text-left hover:bg-[var(--slurp-surface)]"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold">{connection.name ?? connection.id}</span>
                  {connection.model && (
                    <span className="block truncate text-[0.65rem] text-[var(--muted-foreground)]">
                      {connection.model}
                    </span>
                  )}
                </span>
                {selected && <Check size={14} aria-hidden="true" />}
              </button>
            );
          })}
          {connections.length === 0 && (
            <p className="px-3 py-3 text-xs text-[var(--muted-foreground)]">No text connections found.</p>
          )}
        </div>
      )}
    </div>
  );
}

export function SlurpFollowUpItem({
  followUp,
  threadId,
  personaId,
  editable,
}: {
  followUp: {
    id: string;
    scheduledAt: string;
    type: string;
    reason: string;
    context: string;
    sequenceNumber?: number;
    totalInSequence?: number;
  };
  threadId: string | null;
  personaId: string | null;
  editable: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  const cancelFollowUp = useCancelSlurpFollowUp();

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMin = Math.round(diffMs / 60_000);

    if (diffMin < 0) return localizeUi("ui.slurp.messages.followUpOverdue", { defaultValue: "Overdue" });
    if (diffMin < 60) return `${diffMin}min`;
    const diffHr = Math.round(diffMin / 60);
    if (diffHr < 24) return `${diffHr}hr`;
    const diffDays = Math.round(diffHr / 24);
    return `${diffDays}d`;
  };

  const typeLabel =
    {
      reminder: localizeUi("ui.slurp.messages.followUpTypeReminder", { defaultValue: "Reminder" }),
      promise_delivery: localizeUi("ui.slurp.messages.followUpTypePromise", { defaultValue: "Promise" }),
      task_update: localizeUi("ui.slurp.messages.followUpTypeTask", { defaultValue: "Task update" }),
      check_in: localizeUi("ui.slurp.messages.followUpTypeCheckIn", { defaultValue: "Check-in" }),
      recurring: localizeUi("ui.slurp.messages.followUpTypeRecurring", { defaultValue: "Update" }),
    }[followUp.type] || followUp.type;

  const handleCancel = async () => {
    if (!threadId || !personaId) return;
    await cancelFollowUp.mutateAsync({ threadId, followUpId: followUp.id, personaId });
  };

  return (
    <li className="flex items-start gap-1.5 rounded-xl bg-[var(--slurp-surface)] px-2.5 py-1.5 text-xs leading-snug">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5">
          <span className="rounded bg-[var(--slurp-surface-raised)] px-1.5 py-0.5 text-[0.65rem] font-bold text-[var(--muted-foreground)]">
            {typeLabel}
          </span>
          <span className="text-[0.65rem] text-[var(--muted-foreground)]">in {formatTime(followUp.scheduledAt)}</span>
          {followUp.sequenceNumber && followUp.totalInSequence && (
            <span className="text-[0.65rem] text-[var(--muted-foreground)]">
              ({followUp.sequenceNumber}/{followUp.totalInSequence})
            </span>
          )}
        </p>
        <p className="mt-0.5 break-words">{followUp.reason}</p>
        {followUp.context && <p className="mt-0.5 text-[0.65rem] text-[var(--muted-foreground)]">{followUp.context}</p>}
      </div>
      {editable && (
        <button
          type="button"
          disabled={cancelFollowUp.isPending}
          onClick={handleCancel}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--slurp-surface-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-40"
          aria-label={localizeUi("ui.slurp.messages.cancelFollowUp", { defaultValue: "Cancel follow-up" })}
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </li>
  );
}

/**
 * What the creator remembers about this fan, and the one place it can be corrected.
 *
 * These notes are written by the model and were read-only, so a creator who had misheard a name
 * or kept a job the fan had left said it back forever. Editing is the cheapest possible fix and
 * it goes through the same normalizer the model's own writes do, so nothing here can be longer,
 * more numerous, or shaped differently than a memory the creator wrote herself.
 */
