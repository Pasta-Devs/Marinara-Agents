import { toast } from "sonner";

type Localize = (key: string, options?: Record<string, unknown>) => string;

/**
 * One tap cancels a subscription; this toast offers Undo (design step 6). Undo resumes inside the
 * paid week, so it charges nothing. Wallet, profile and Discover share it.
 */
export function showSlpSubscriptionCancelledToast({
  localizeUi,
  endsDay,
  onUndo,
}: {
  localizeUi: Localize;
  /** The last paid day, already formatted; without it the toast names no day. */
  endsDay?: string | null;
  onUndo: () => unknown;
}) {
  toast(
    endsDay
      ? localizeUi("ui.slurp.wallet.cancelled", { defaultValue: "Subscription cancelled · ends {{day}}", day: endsDay })
      : localizeUi("ui.slurp.wallet.cancelledNoDay", { defaultValue: "Subscription cancelled" }),
    {
      action: {
        label: localizeUi("ui.slurp.wallet.undo", { defaultValue: "Undo" }),
        onClick: () => void onUndo(),
      },
    },
  );
}
