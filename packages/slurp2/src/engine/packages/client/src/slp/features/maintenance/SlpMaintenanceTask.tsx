import type { ReactNode } from "react";

export const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]";
export const quietButton = `inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-semibold ring-1 ring-inset ring-[var(--slurp-outline)] transition-[background-color,transform] hover:bg-[var(--slurp-canvas)] active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:opacity-50 ${focusRing}`;

/** One maintenance job: what it does, what it will touch, and the button that does it. */
export function MaintenanceTask({
  title,
  detail,
  preview,
  children,
  danger = false,
}: {
  title: string;
  detail: string;
  preview?: ReactNode;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <section
      className={`rounded-xl bg-[var(--slurp-surface-raised)] p-4 ring-1 ring-inset sm:p-5 ${danger ? "ring-[var(--slurp-danger)]/35" : "ring-[var(--slurp-outline)]"}`}
    >
      <h3 className={`text-sm font-bold ${danger ? "text-[var(--slurp-danger)]" : ""}`}>{title}</h3>
      <p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--slurp-muted)]">{detail}</p>
      {preview && (
        <p className="mt-3 rounded-lg bg-[var(--slurp-canvas)] p-3 text-xs leading-5 ring-1 ring-inset ring-[var(--slurp-outline)]">
          {preview}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">{children}</div>
    </section>
  );
}
