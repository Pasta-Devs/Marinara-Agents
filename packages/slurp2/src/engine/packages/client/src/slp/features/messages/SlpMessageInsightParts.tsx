import { useEffect, type RefObject } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { getSlurpPromptErrorKind } from "./slp-message-keys";
import type { SlurpPromptDebug } from "./slp-messages-contract";

export function SlurpPromptDebugPanel({
  enabled,
  query,
}: {
  enabled: boolean;
  query: { data?: SlurpPromptDebug; error?: unknown; isPending: boolean; isError: boolean };
}) {
  const { t: localizeUi } = useUiTranslation();
  if (!enabled)
    return (
      <p className="mx-3 mt-2 shrink-0 rounded-xl bg-[var(--slurp-surface)] p-3 text-xs text-[var(--muted-foreground)]">
        {localizeUi("ui.slurp.messages.promptDisabled", {
          defaultValue: "Prompt details need an active conversation.",
        })}
      </p>
    );
  if (query.isPending)
    return (
      <p className="mx-3 mt-2 shrink-0 rounded-xl bg-[var(--slurp-surface)] p-3 text-xs text-[var(--muted-foreground)]">
        {localizeUi("ui.slurp.messages.promptLoading", { defaultValue: "Loading prompt details…" })}
      </p>
    );
  if (query.isError || !query.data) {
    const errorKind = getSlurpPromptErrorKind(query.error);
    const message =
      errorKind === "disabled"
        ? localizeUi("ui.slurp.messages.promptDebugDisabled", {
            defaultValue: "Prompt details are disabled outside debug mode.",
          })
        : errorKind === "connection"
          ? localizeUi("ui.slurp.messages.promptNoConnection", {
              defaultValue: "Prompt details need a configured text connection.",
            })
          : errorKind === "unauthorized"
            ? localizeUi("ui.slurp.messages.promptUnauthorized", {
                defaultValue: "You are not authorized to view these prompt details.",
              })
            : errorKind === "not-found"
              ? localizeUi("ui.slurp.messages.promptNotFound", {
                  defaultValue: "Prompt details are disabled, or this conversation was not found.",
                })
              : localizeUi("ui.slurp.messages.promptUnavailable", {
                  defaultValue: "Prompt details are not available.",
                });
    return (
      <p className="mx-3 mt-2 shrink-0 rounded-xl bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
        {message}
      </p>
    );
  }
  return (
    <details
      open
      className="mx-3 mt-2 shrink-0 rounded-xl bg-[var(--slurp-surface)] p-3 text-xs ring-1 ring-inset ring-[var(--noodle-divider)]"
    >
      <summary className="cursor-pointer font-bold">
        {localizeUi("ui.slurp.messages.promptDebug", { defaultValue: "Prompt details" })}
      </summary>
      <div className="mt-2 space-y-2">
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/10 p-2">
          {JSON.stringify(query.data.stance, null, 2)}
        </pre>
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/10 p-2">
          {query.data.prompt.map((message) => `${message.role}: ${message.content}`).join("\n\n")}
        </pre>
      </div>
    </details>
  );
}

export function useDismissablePopover(
  open: boolean,
  setOpen: (open: boolean) => void,
  panelRef: RefObject<HTMLElement | null>,
  triggerRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open, setOpen, panelRef, triggerRef]);
}
