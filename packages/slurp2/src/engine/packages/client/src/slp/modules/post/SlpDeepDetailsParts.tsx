import { Check, Copy } from "lucide-react";
import { useState, type ReactNode } from "react";

/** Building blocks shared by the Deep details view and its image runs. */

export type SlpStepStatus = "done" | "skipped" | "rejected" | "retried" | "failed" | "missing";

const STATUS_LABEL: Record<SlpStepStatus, string> = {
  done: "Completed",
  skipped: "Skipped",
  rejected: "Rejected",
  retried: "Retried",
  failed: "Failed",
  missing: "Not recorded",
};

const STATUS_DOT: Record<SlpStepStatus, string> = {
  done: "bg-[var(--slurp-success)]",
  skipped: "bg-[var(--muted-foreground)]",
  rejected: "bg-[var(--slurp-warning)]",
  retried: "bg-[var(--slurp-warning)]",
  failed: "bg-[var(--destructive)]",
  missing: "bg-transparent ring-1 ring-inset ring-[var(--muted-foreground)]",
};

/** Status as a colored dot beside plain words, so it reads in any theme and never by color alone. */
export function StepStatus({ status }: { status: SlpStepStatus }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold">
      <span className={`size-2 rounded-full ${STATUS_DOT[status]}`} aria-hidden="true" />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function str(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

export function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function Chip({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full bg-[var(--slurp-surface-raised)] px-2.5 text-xs ring-1 ring-inset ring-[var(--slurp-outline)]">
      <span className="text-[var(--muted-foreground)]">{label}</span>
      <span className="font-bold text-[var(--noodle-accent)]">{value}</span>
    </span>
  );
}

/** One step of the timeline. `step` numbers it; `status` says what happened, in words. */
export function Section({
  title,
  step,
  status,
  action,
  children,
}: {
  title: string;
  step?: number;
  status?: SlpStepStatus;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl bg-[var(--slurp-surface-raised)] p-4 ring-1 ring-inset ring-[var(--slurp-outline)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--noodle-accent)]">
          {step !== undefined && (
            <span className="inline-flex size-6 items-center justify-center rounded-full bg-[var(--slurp-canvas)] tabular-nums ring-1 ring-inset ring-[var(--slurp-outline)]">
              {step}
            </span>
          )}
          {title}
        </h4>
        <div className="flex items-center gap-3">
          {status && <StepStatus status={status} />}
          {action}
        </div>
      </div>
      {children}
    </section>
  );
}

export function Rows({ rows, mono = false }: { rows: [string, string | null][]; mono?: boolean }) {
  const shown = rows.filter((row): row is [string, string] => Boolean(row[1]));
  if (shown.length === 0) return <p className="text-xs text-[var(--muted-foreground)]">—</p>;
  return (
    <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[minmax(8rem,12rem)_minmax(0,1fr)]">
      {shown.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-xs font-semibold text-[var(--muted-foreground)]">{label}</dt>
          <dd className={`min-w-0 whitespace-pre-wrap break-words text-xs leading-5 ${mono ? "font-mono" : ""}`}>
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Long text. Collapsed by default when `collapsed`, so the prompt is there without being the view. */
export function Block({ label, text, collapsed = false }: { label: string; text: string; collapsed?: boolean }) {
  const body = (
    <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[var(--slurp-canvas)] p-3 font-mono text-xs leading-5 ring-1 ring-inset ring-[var(--slurp-outline)]">
      {text}
    </pre>
  );
  if (collapsed) {
    return (
      <details className="mt-3">
        <summary className="mb-1 min-h-9 cursor-pointer text-xs font-semibold text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]">
          {label} <span className="font-normal tabular-nums">· {text.length} characters</span>
        </summary>
        {body}
      </details>
    );
  }
  return (
    <div className="mt-3">
      <p className="mb-1 text-xs font-semibold text-[var(--muted-foreground)]">{label}</p>
      {body}
    </div>
  );
}

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard
          .writeText(value)
          .then(() => setCopied(true))
          .catch(() => setCopied(false));
      }}
      className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-bold text-[var(--noodle-accent)] ring-1 ring-inset ring-[var(--slurp-outline)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
    >
      {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      {copied ? "Copied" : label}
    </button>
  );
}
