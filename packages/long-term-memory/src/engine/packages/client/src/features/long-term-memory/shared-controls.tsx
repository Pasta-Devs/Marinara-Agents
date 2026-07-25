import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";

export const inputClass =
  "min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--ring)]";

export function Button({
  children,
  primary = false,
  destructive = false,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  primary?: boolean;
  destructive?: boolean;
}) {
  const tone = primary
    ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
    : destructive
      ? "border-[var(--destructive)]/35 text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
      : "border-[var(--border)] bg-[var(--secondary)] text-[var(--foreground)] hover:bg-[var(--accent)]";
  return (
    <button
      type="button"
      data-ltm-control="button"
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50 ${tone} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  disabled = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="space-y-1 text-xs font-medium text-[var(--muted-foreground)]">
      <span>{label}</span>
      <input
        data-ltm-control="number"
        className={inputClass}
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next))
            onChange(Math.max(min, Math.min(max, next)));
        }}
      />
    </label>
  );
}

export function StatusSurface({
  children,
  tone = "neutral",
  busy = false,
  compact = false,
  className = "",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "danger";
  busy?: boolean;
  compact?: boolean;
}) {
  const toneClass = {
    neutral: "border-[var(--border)] text-[var(--muted-foreground)]",
    success: "border-emerald-500/35 text-emerald-600 dark:text-emerald-400",
    danger: "border-[var(--destructive)]/35 text-[var(--destructive)]",
  }[tone];
  return (
    <p
      role={tone === "danger" ? "alert" : "status"}
      aria-live="polite"
      data-ltm-status={tone}
      className={`flex items-center gap-2 rounded-lg border bg-[var(--secondary)]/45 ${compact ? "px-2 py-1.5 text-[0.625rem]" : "min-h-11 px-3 text-xs"} ${toneClass}`}
    >
      {busy ? (
        <Loader2 aria-hidden="true" size="0.875rem" className="animate-spin" />
      ) : null}
      {children}
    </p>
  );
}
