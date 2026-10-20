// ──────────────────────────────────────────────
// The Engine's app dialogs, as package clients see them (Pasta-Devs/Marinara-Agents#1487)
// ──────────────────────────────────────────────
// A package opens alerts, confirms and prompts through the Engine's own module (`__MARINARA_HOST__.services.dialogs`),
// and the Engine's one renderer shows them on its topmost layer. Packages render no dialog renderer of their own.
// On an Engine without the member a dialog resolves at once as cancelled and says why: it never waits forever.
import { marinaraHost, showNeedsNewerEngine } from "./marinara-host-bridge";
import type {
  AlertDialogState,
  ChoiceDialogState,
  ConfirmDialogState,
  PromptDialogState,
} from "../stores/dialog.store";

interface HostDialogs {
  showAlertDialog: (options: Omit<AlertDialogState, "kind">) => Promise<void>;
  showConfirmDialog: (options: Omit<ConfirmDialogState, "kind">) => Promise<boolean>;
  showPromptDialog: (options: Omit<PromptDialogState, "kind">) => Promise<string | null>;
  showChoiceDialog: (options: Omit<ChoiceDialogState, "kind">) => Promise<string | null>;
}

const host = marinaraHost()?.services?.dialogs as Partial<HostDialogs> | undefined;
const dialogs: HostDialogs | null = typeof host?.showConfirmDialog === "function" ? (host as HostDialogs) : null;

function cancelled<T>(value: T): Promise<T> {
  showNeedsNewerEngine("This dialog");
  return Promise.resolve(value);
}

export const showAlertDialog: HostDialogs["showAlertDialog"] = dialogs
  ? dialogs.showAlertDialog
  : () => cancelled(undefined);
export const showConfirmDialog: HostDialogs["showConfirmDialog"] = dialogs
  ? dialogs.showConfirmDialog
  : () => cancelled(false);
export const showPromptDialog: HostDialogs["showPromptDialog"] = dialogs
  ? dialogs.showPromptDialog
  : () => cancelled(null);
export const showChoiceDialog: HostDialogs["showChoiceDialog"] = dialogs
  ? dialogs.showChoiceDialog
  : () => cancelled(null);
