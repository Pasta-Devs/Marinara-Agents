import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { useModalKeyboardNavigation } from "./use-modal-keyboard-navigation";

export type MapConfirmationOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "destructive";
};

export function useMapConfirmation() {
  const [pendingConfirmation, setPendingConfirmation] = useState<MapConfirmationOptions | null>(null);
  const confirmationResolverRef = useRef<((confirmed: boolean) => void) | null>(null);
  const confirmationDialogRef = useRef<HTMLDivElement>(null);
  const confirmationCancelRef = useRef<HTMLButtonElement>(null);
  const messageId = `marinara-map-confirmation-${useId().replaceAll(":", "")}`;

  const resolveConfirmation = useCallback((confirmed: boolean) => {
    const resolve = confirmationResolverRef.current;
    confirmationResolverRef.current = null;
    setPendingConfirmation(null);
    resolve?.(confirmed);
  }, []);

  const confirmAction = useCallback((options: MapConfirmationOptions) => {
    confirmationResolverRef.current?.(false);
    return new Promise<boolean>((resolve) => {
      confirmationResolverRef.current = resolve;
      setPendingConfirmation(options);
    });
  }, []);

  useModalKeyboardNavigation({
    dialogRef: confirmationDialogRef,
    initialFocusRef: confirmationCancelRef,
    open: Boolean(pendingConfirmation),
    onEscape: () => resolveConfirmation(false),
  });

  useEffect(
    () => () => {
      confirmationResolverRef.current?.(false);
      confirmationResolverRef.current = null;
    },
    [],
  );

  const confirmationDialog = pendingConfirmation ? (
    <div
      ref={confirmationDialogRef}
      data-chat-floating-panel
      data-marinara-maps-confirmation="true"
      role="dialog"
      aria-modal="true"
      aria-label={pendingConfirmation.title}
      aria-describedby={messageId}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--background)]/85 p-3 sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) resolveConfirmation(false);
      }}
    >
      <div className="max-h-[min(42rem,calc(100dvh-1.5rem))] w-full max-w-md overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--background)] shadow-2xl">
        <div className="flex items-start gap-3 border-b border-[var(--border)] px-4 py-4 sm:px-5">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--marinara-chat-chrome-highlight-bg)] text-[var(--marinara-chat-chrome-accent)]">
            <AlertCircle size="1.125rem" aria-hidden="true" />
          </span>
          <h2 className="min-w-0 flex-1 text-base font-semibold text-[var(--foreground)]">
            {pendingConfirmation.title}
          </h2>
        </div>
        <p
          id={messageId}
          className="whitespace-pre-wrap px-4 py-4 text-sm leading-relaxed text-[var(--foreground)] sm:px-5"
        >
          {pendingConfirmation.message}
        </p>
        <div className="flex flex-col gap-2 border-t border-[var(--border)] px-4 py-4 sm:flex-row sm:justify-end sm:px-5">
          <button
            ref={confirmationCancelRef}
            type="button"
            onClick={() => resolveConfirmation(false)}
            className="mari-chrome-control min-h-11 w-full px-4 text-sm sm:w-auto"
          >
            {pendingConfirmation.cancelLabel ?? "Cancel"}
          </button>
          <button
            type="button"
            onClick={() => resolveConfirmation(true)}
            className={`mari-chrome-control min-h-11 w-full px-4 text-sm sm:w-auto ${
              pendingConfirmation.tone === "destructive" ? "mari-chrome-control--danger" : ""
            }`}
          >
            {pendingConfirmation.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirmAction, confirmationDialog };
}
