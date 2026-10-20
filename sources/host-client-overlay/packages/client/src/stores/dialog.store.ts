// ──────────────────────────────────────────────
// The Engine's app dialog store, as package clients see it (Pasta-Devs/Marinara-Agents#1487)
// ──────────────────────────────────────────────
// The Engine renders the one dialog renderer. A copy of this store in a package was invisible to it, so packages had
// to render their own; this file is stacked over that module, so `useDialogStore` is `__MARINARA_HOST__.stores.dialog`.
// Packages open dialogs through lib/app-dialogs.ts, which is the Engine's module too.
import { create } from "zustand";
import { hostStore, readOnlyStore, type BoundStore } from "../lib/marinara-host-bridge";

export type AppDialogTone = "default" | "destructive" | "accent";

type AppDialogCommon = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: AppDialogTone;
  chatStyle?: boolean;
};

export type AlertDialogState = AppDialogCommon & { kind: "alert" };
export type ConfirmDialogState = AppDialogCommon & { kind: "confirm" };
export type PromptDialogState = AppDialogCommon & {
  kind: "prompt";
  defaultValue?: string;
  placeholder?: string;
  previewImageUrl?: string;
};
export type ChoiceDialogState = AppDialogCommon & {
  kind: "choice";
  choices: Array<{ key: string; label: string; tone?: AppDialogTone; description?: string | null }>;
};
export type AppDialogState = AlertDialogState | ConfirmDialogState | PromptDialogState | ChoiceDialogState;

/** What package code reads from the Engine's dialog store. */
export type DialogStoreState = {
  dialog: AppDialogState | null;
  openDialog: (dialog: AppDialogState) => void;
  closeDialog: () => void;
};

export const useDialogStore: BoundStore<DialogStoreState> =
  hostStore<DialogStoreState>("dialog") ??
  readOnlyStore<DialogStoreState>(create, { dialog: null, openDialog: () => undefined, closeDialog: () => undefined });
