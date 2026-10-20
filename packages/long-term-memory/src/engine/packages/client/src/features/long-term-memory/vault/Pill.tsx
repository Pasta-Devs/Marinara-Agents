import { type ReactNode } from "react";
import { X } from "lucide-react";
import { useLtmTranslation } from "../localization";

export function Pill({ children, label, onRemove }: { children: ReactNode; label?: string; onRemove: () => void }) {
  const { t: localizeUi } = useLtmTranslation();
  const removeLabel = localizeUi("ui.longTermMemory.pill.removeValue1", {
    value1: label ?? String(children),
  });
  return (
    <span className="inline-flex min-h-11 max-w-full items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2 text-xs text-[var(--foreground)]">
      <span className="truncate">{children}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        title={removeLabel}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded leading-none hover:bg-[var(--accent)]"
      >
        <X aria-hidden="true" size="0.75rem" />
      </button>
    </span>
  );
}
