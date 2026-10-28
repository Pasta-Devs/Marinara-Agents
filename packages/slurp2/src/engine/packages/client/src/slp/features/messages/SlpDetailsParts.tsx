// The small parts the Details panel is built from (bars, meters, rows, folding sections). Split out
// of SlpMessageInsights.tsx (size cap); props in, no data hooks beyond the inline-edit context.
import { Activity, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../../lib/utils";
import { SlpEditableDetail, useSlpDetailEditing } from "./SlpMessageDetailsEditor";

export const PANEL_TONES = {
  accent: {
    fill: "bg-[var(--noodle-accent)]",
    track: "bg-[color-mix(in_srgb,var(--noodle-accent)_18%,transparent)]",
    text: "text-[var(--noodle-accent-foreground)]",
    ring: "ring-[color-mix(in_srgb,var(--noodle-accent)_40%,transparent)]",
  },
  good: {
    fill: "bg-emerald-500",
    track: "bg-emerald-500/18",
    text: "text-emerald-600 dark:text-emerald-400",
    ring: "ring-emerald-500/40",
  },
  warning: {
    fill: "bg-amber-500",
    track: "bg-amber-500/18",
    text: "text-amber-600 dark:text-amber-400",
    ring: "ring-amber-500/40",
  },
  serious: {
    fill: "bg-red-500",
    track: "bg-red-500/18",
    text: "text-red-600 dark:text-red-400",
    ring: "ring-red-500/40",
  },
} as const;

type PanelTone = keyof typeof PANEL_TONES;

export const humanizeValue = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/gu, (character) => character.toUpperCase());
const clampPercent = (value: number) => Math.max(0, Math.min(100, value));
export const bandWord = (value: number) =>
  value <= 25 ? "low" : value <= 60 ? "medium" : value <= 80 ? "high" : "urgent";
export const moodWord = (mood: number) =>
  mood >= 40 ? "warm" : mood >= 10 ? "open" : mood > -25 ? "neutral" : mood > -60 ? "cooling" : "cold";

export function Meter({
  label,
  value,
  tone = "accent",
  hint,
}: {
  label: string;
  value: number;
  tone?: PanelTone;
  hint?: string;
}) {
  const tones = PANEL_TONES[tone];
  const editing = useSlpDetailEditing(label);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[0.7rem] text-[var(--muted-foreground)]">{label}</span>
        <span className="min-w-0 flex-1 text-right text-[0.72rem] font-bold tabular-nums">
          <SlpEditableDetail label={label}>{value}</SlpEditableDetail>
        </span>
      </div>
      {!editing && (
        <div
          role="meter"
          aria-valuenow={clampPercent(value)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label}
          className={cn("h-1.5 overflow-hidden rounded-full", tones.track)}
        >
          <div
            className={cn("h-full rounded-r-[4px] transition-[width] motion-reduce:transition-none", tones.fill)}
            style={{ width: `${clampPercent(value)}%` }}
          />
        </div>
      )}
      {hint && <p className="mt-1 text-[0.65rem] leading-snug text-[var(--muted-foreground)]">{hint}</p>}
    </div>
  );
}

export function DivergingBar({
  label,
  value,
  max,
  negativeLabel,
  positiveLabel,
  reading,
  fieldKey,
}: {
  label: string;
  value: number;
  max: number;
  negativeLabel?: string;
  positiveLabel?: string;
  reading?: string;
  fieldKey?: string;
}) {
  const editing = useSlpDetailEditing(fieldKey ?? label);
  const share = max > 0 ? Math.min(1, Math.abs(value) / max) : 0;
  const tones = value < 0 ? PANEL_TONES.serious : PANEL_TONES.accent;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[0.7rem] text-[var(--muted-foreground)]">{label}</span>
        <span className={cn("min-w-0 flex-1 text-right text-[0.72rem] font-bold", value < 0 && tones.text)}>
          <SlpEditableDetail label={label} fieldKey={fieldKey}>
            {reading ?? (value > 0 ? `+${value}` : String(value))}
          </SlpEditableDetail>
        </span>
      </div>
      {!editing && (
        <div className="relative h-1.5 rounded-full bg-[color-mix(in_srgb,var(--muted-foreground)_16%,transparent)]">
          <div className="absolute inset-y-[-2px] left-1/2 w-px -translate-x-1/2 bg-[var(--muted-foreground)]/45" />
          <div
            className={cn(
              "absolute inset-y-0 rounded-full transition-[width] motion-reduce:transition-none",
              tones.fill,
            )}
            style={value < 0 ? { right: "50%", width: `${share * 50}%` } : { left: "50%", width: `${share * 50}%` }}
          />
        </div>
      )}
      {(negativeLabel || positiveLabel) && (
        <div className="mt-1 flex justify-between text-[0.6rem] text-[var(--muted-foreground)]">
          <span>{negativeLabel}</span>
          <span>{positiveLabel}</span>
        </div>
      )}
    </div>
  );
}

export function Stepper({ steps, current, label }: { steps: readonly string[]; current: string; label: string }) {
  const index = steps.indexOf(current);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[0.7rem] text-[var(--muted-foreground)]">{label}</span>
        <span className="min-w-0 flex-1 text-right text-[0.72rem] font-bold capitalize">
          <SlpEditableDetail label={label}>{humanizeValue(current)}</SlpEditableDetail>
        </span>
      </div>
      <ol className="flex gap-[2px]" aria-label={`${label}: ${humanizeValue(current)}`}>
        {steps.map((step, position) => (
          <li
            key={step}
            title={humanizeValue(step)}
            className={cn(
              "h-1.5 flex-1 rounded-full",
              position <= index
                ? "bg-[var(--noodle-accent)]"
                : "bg-[color-mix(in_srgb,var(--noodle-accent)_18%,transparent)]",
            )}
          />
        ))}
      </ol>
    </div>
  );
}

export function StatusRow({
  icon: Icon,
  tone,
  title,
  detail,
}: {
  icon: typeof Activity;
  tone: PanelTone;
  title: string;
  detail?: string;
}) {
  const tones = PANEL_TONES[tone];
  return (
    <div className={cn("flex items-start gap-2 rounded-xl px-2.5 py-2 ring-1 ring-inset", tones.ring)}>
      <Icon size={14} className={cn("mt-px shrink-0", tones.text)} aria-hidden="true" />
      <div className="min-w-0">
        <p className={cn("font-bold", tones.text)}>{title}</p>
        {detail && <p className="mt-0.5 leading-snug text-[var(--muted-foreground)]">{detail}</p>}
      </div>
    </div>
  );
}

export function Field({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-[var(--slurp-surface-raised)] px-2.5 py-2">
      <div className="text-xs text-[var(--slurp-muted)]">{label}</div>
      <div className="mt-0.5 break-words font-bold capitalize">
        <SlpEditableDetail label={label}>{value}</SlpEditableDetail>
      </div>
      {hint && <div className="mt-1 text-[0.65rem] leading-snug text-[var(--muted-foreground)]">{hint}</div>}
    </div>
  );
}

export function PanelSection({
  icon: Icon,
  title,
  summary,
  children,
  defaultOpen = false,
}: {
  icon: typeof Activity;
  title: string;
  summary: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="border-b border-[var(--noodle-divider)] last:border-b-0">
      <summary className="group flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-2.5 font-bold [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2">
          <Icon size={15} className="shrink-0 text-[var(--noodle-accent-foreground)]" aria-hidden="true" />
          <span className="truncate">{title}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="max-w-[9rem] truncate text-right text-[0.68rem] font-normal text-[var(--muted-foreground)]">
            {summary}
          </span>
          <ChevronDown
            size={13}
            className="shrink-0 text-[var(--muted-foreground)] transition-transform group-open:rotate-180 motion-reduce:transition-none"
            aria-hidden="true"
          />
        </span>
      </summary>
      <div className="space-y-2.5 pb-3.5">{children}</div>
    </details>
  );
}
