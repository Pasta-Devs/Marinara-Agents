import { type MouseEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { useLtmTranslation } from "../localization";

const FOCUSABLE =
  'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, a[href], [tabindex]:not([tabindex="-1"])';

// Removing a pill unmounts its focused button, so focus moves to the pill now in its place, else
// the previous pill, else the first control after the pill list.
function removeAndKeepFocus(event: MouseEvent<HTMLButtonElement>, onRemove: () => void) {
  const button = event.currentTarget;
  const list = button.closest("[data-ltm-pill]")?.parentElement;
  if (!list) return onRemove();
  const index = [...list.querySelectorAll("[data-ltm-pill-remove]")].indexOf(button);
  const after = [...document.querySelectorAll<HTMLElement>(FOCUSABLE)].find(
    (element) =>
      !list.contains(element) &&
      Boolean(list.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING) &&
      element.getClientRects().length > 0,
  );
  onRemove();
  requestAnimationFrame(() => {
    const remaining = list.isConnected ? [...list.querySelectorAll<HTMLElement>("[data-ltm-pill-remove]")] : [];
    const target = remaining[Math.min(index, remaining.length - 1)] ?? (after?.isConnected ? after : null);
    target?.focus({ preventScroll: true });
  });
}

export function Pill({ children, label, onRemove }: { children: ReactNode; label?: string; onRemove: () => void }) {
  const { t: localizeUi } = useLtmTranslation();
  const removeLabel = localizeUi("ui.longTermMemory.pill.removeValue1", {
    value1: label ?? String(children),
  });
  return (
    <span
      data-ltm-pill
      className="inline-flex min-h-11 max-w-full items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2 text-xs text-[var(--foreground)]"
    >
      <span className="truncate">{children}</span>
      <button
        type="button"
        data-ltm-pill-remove
        onClick={(event) => removeAndKeepFocus(event, onRemove)}
        aria-label={removeLabel}
        title={removeLabel}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded leading-none hover:bg-[var(--accent)]"
      >
        <X aria-hidden="true" size="0.75rem" />
      </button>
    </span>
  );
}
