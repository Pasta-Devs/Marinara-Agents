// The frame parts every Slurp wizard shares (first-run setup today, the Creator onboarding next):
// one progress row ("Step 2 of 5 · Identity" + a thin bar) and one footer (Back icon · Skip text ·
// primary, never wrapping, with a one-line reason under a disabled primary). Props in, no state.
import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { cn } from "../../../lib/utils";
import { SLP_TYPE } from "../../base/chrome/SlpChrome";

export function SlpWizardProgress({
  current,
  total,
  stepOf,
  label,
}: {
  current: number;
  total: number;
  /** "Step 2 of 5", already localized. */
  stepOf: string;
  /** The short step label ("Identity"). */
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 pb-3">
      <p className={cn(SLP_TYPE.meta, "shrink-0 whitespace-nowrap")}>
        <span className="font-semibold text-[var(--slurp-text)]">{stepOf}</span>
        <span aria-hidden="true" className="px-1.5 text-[var(--slurp-muted)]">
          ·
        </span>
        <span className="text-[var(--slurp-muted)]">{label}</span>
      </p>
      <div
        role="progressbar"
        aria-label={`${stepOf} · ${label}`}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={current}
        className="h-1 min-w-12 flex-1 overflow-hidden rounded-full bg-[var(--noodle-divider)]"
      >
        <span
          className="block h-full rounded-full bg-[var(--noodle-accent)] transition-[width] duration-[var(--slurp-motion-base)] ease-[var(--slurp-ease)] motion-reduce:transition-none"
          style={{ width: `${Math.round((current / total) * 100)}%` }}
        />
      </div>
    </div>
  );
}

export function SlpWizardFooter({
  back,
  skip,
  primary,
  note,
}: {
  back?: { label: string; onClick: () => void; disabled?: boolean };
  skip?: { label: string; onClick: () => void; disabled?: boolean };
  /** The primary button (a `SlpPrimaryButton`). */
  primary?: ReactNode;
  /** Why the primary is off, or what is running now. Announced politely. */
  note?: string;
}) {
  return (
    <div className="border-t border-[var(--noodle-divider)] pt-3 max-sm:pt-2">
      <div className="flex min-h-11 items-center gap-1.5">
        {back && (
          <button
            type="button"
            onClick={back.onClick}
            disabled={back.disabled}
            aria-label={back.label}
            title={back.label}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--slurp-surface-raised)] text-[var(--slurp-text)] shadow-[var(--slurp-shadow-raised),var(--slurp-highlight)] transition-transform duration-[var(--slurp-motion-fast)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 motion-reduce:transition-none [&_svg]:!text-current"
          >
            <ChevronLeft size={20} aria-hidden="true" className="rtl:rotate-180" />
          </button>
        )}
        {skip && (
          <button
            type="button"
            onClick={skip.onClick}
            disabled={skip.disabled}
            className="min-h-11 shrink-0 whitespace-nowrap rounded-full px-3 text-[13px] font-semibold text-[var(--slurp-muted)] transition-colors hover:text-[var(--slurp-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50"
          >
            {skip.label}
          </button>
        )}
        <div className="ms-auto flex min-w-0 justify-end [&>button]:whitespace-nowrap">{primary}</div>
      </div>
      <p aria-live="polite" className={cn(SLP_TYPE.meta, "mt-1 min-h-4 text-end text-[var(--slurp-muted)]")}>
        {note}
      </p>
    </div>
  );
}
