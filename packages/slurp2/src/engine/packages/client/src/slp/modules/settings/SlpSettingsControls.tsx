/**
 * The settings controls both settings surfaces share.
 *
 * The Backstage host composes panels rather than drawing controls itself, so these live here as a
 * reusable module: every feature panel and the simulation panel draw the same control set.
 */
import { ChevronRight, CircleHelp } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { SettingAnchor, type SlpSettingKey } from "./SlpSettingsKit";

export function NumberSetting({
  value,
  min,
  max,
  onSave,
  /** Whole numbers by default. Tuning has rates and multipliers that are legitimately fractional. */
  integer = true,
  disabled = false,
}: {
  value: number;
  min: number;
  max: number;
  onSave: (value: number) => Promise<boolean> | boolean | void;
  integer?: boolean;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const saveQueueRef = useRef(Promise.resolve());
  const saveGenerationRef = useRef(0);
  const commit = async (raw = draft, resetInvalid = true) => {
    const next = Number(raw);
    if (!raw.trim() || !(integer ? Number.isInteger(next) : Number.isFinite(next)) || next < min || next > max) {
      if (resetInvalid) setDraft(String(value));
      return;
    }
    // Serialize saves so a slow older request can't land after a newer one and persist a
    // stale value; skip a queued save (and its failure recovery) once a later edit has
    // already superseded it. Compare a generation token, not the value itself — a sequence
    // like 1 -> 2 -> 1 would otherwise let the first save's failure recovery match the last.
    // Swallow rejections so one failed save doesn't wedge the queue for every save after it.
    const saveGeneration = ++saveGenerationRef.current;
    saveQueueRef.current = saveQueueRef.current.then(async () => {
      if (saveGenerationRef.current !== saveGeneration) return;
      try {
        if ((await onSave(next)) === false && saveGenerationRef.current === saveGeneration) setDraft(String(value));
      } catch {
        if (saveGenerationRef.current === saveGeneration) setDraft(String(value));
      }
    });
    await saveQueueRef.current;
  };
  return (
    <input
      type="number"
      disabled={disabled}
      step={integer ? 1 : "any"}
      min={min}
      max={max}
      value={draft}
      onChange={(event) => {
        const nextDraft = event.target.value;
        setDraft(nextDraft);
        void commit(nextDraft, false);
      }}
      onBlur={() => void commit()}
      onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
      className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--slurp-canvas,var(--background))] px-3 text-base outline-none transition-colors focus:border-[var(--noodle-accent)] focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]/30 disabled:opacity-50 sm:text-sm"
    />
  );
}

export function SectionTitle({ title, detail }: { title: string; detail: string }) {
  return (
    <div>
      <h2 className="text-lg font-black tracking-tight text-balance">{title}</h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)] text-pretty">{detail}</p>
    </div>
  );
}
/** A labelled group of related settings. Used by every section that has more than a handful. */
export function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      className="space-y-4 rounded-xl bg-[var(--slurp-surface-raised,var(--background))] p-4 shadow-[var(--slurp-shadow-raised)] sm:p-5"
      aria-label={title}
    >
      <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--noodle-accent-foreground)]">{title}</h3>
      {children}
    </section>
  );
}
export function GuidanceBox({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-[var(--noodle-accent)]/[0.065] p-4 ring-1 ring-inset ring-[var(--noodle-accent)]/20 sm:p-5">
      <span className="absolute inset-y-3 start-0 w-0.5 rounded-full bg-[var(--noodle-accent)]" aria-hidden="true" />
      <p className="text-sm font-bold text-[var(--noodle-accent)]">{title}</p>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)] text-pretty">{detail}</p>
    </div>
  );
}
export function Field({
  label,
  detail,
  settingKey,
  disabledReason,
  children,
}: {
  label: string;
  detail?: string;
  /** Marks the field as the Backstage search target for this setting. */
  settingKey?: SlpSettingKey;
  /**
   * Why this setting has no effect right now ("Needs …"). The control stays visible, so the player
   * sees it exists; the caller disables its own input.
   */
  disabledReason?: string | null;
  children: ReactNode;
}) {
  const field = (
    <label className="block space-y-2 text-sm font-semibold">
      <span className="flex items-center gap-1.5">
        <span>{label}</span>
        {detail && (
          <span title={detail} aria-label={detail} className="inline-flex text-[var(--muted-foreground)]">
            <CircleHelp size={14} strokeWidth={2} aria-hidden="true" />
          </span>
        )}
      </span>
      {detail && <span className="block text-xs font-normal leading-5 text-[var(--muted-foreground)]">{detail}</span>}
      {disabledReason && (
        <span className="block text-xs font-semibold leading-5 text-[var(--slurp-muted,var(--muted-foreground))]">
          {disabledReason}
        </span>
      )}
      {children}
    </label>
  );
  return settingKey ? <SettingAnchor settingKey={settingKey}>{field}</SettingAnchor> : field;
}
export function Toggle({
  label,
  detail,
  value,
  onChange,
  compact = false,
  settingKey,
  disabledReason,
}: {
  label: string;
  detail?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  compact?: boolean;
  /** Marks the toggle as the Backstage search target for this setting. */
  settingKey?: SlpSettingKey;
  /** Why this toggle has no effect right now. It stays visible and is disabled. */
  disabledReason?: string | null;
}) {
  const disabled = Boolean(disabledReason);
  const toggle = (
    <label
      data-slurp-setting-toggle
      className={`group relative flex ${compact ? "min-h-11" : "min-h-16"} ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"} items-center justify-between gap-4 rounded-lg bg-[var(--slurp-surface-raised,var(--background))] px-3 py-2 text-sm shadow-[var(--slurp-shadow-raised)] ring-1 ring-inset ring-transparent transition-[background-color,box-shadow] hover:bg-[var(--accent)]/40 hover:ring-[var(--border)] focus-within:ring-2 focus-within:ring-[var(--noodle-accent)] motion-reduce:transition-none`}
    >
      <span className="min-w-0">
        <span className="block font-semibold">{label}</span>
        {detail && (
          <span className="mt-1 block text-xs font-normal leading-5 text-[var(--muted-foreground)]">{detail}</span>
        )}
        {disabledReason && <span className="mt-1 block text-xs font-semibold leading-5">{disabledReason}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        disabled={disabled}
        checked={value}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="relative h-7 w-12 shrink-0 rounded-full bg-[var(--muted-foreground)]/25 shadow-inner transition-colors after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:bg-[var(--noodle-accent)] peer-checked:after:translate-x-5 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--noodle-accent)] motion-reduce:transition-none motion-reduce:after:transition-none"
      />
    </label>
  );
  return settingKey ? <SettingAnchor settingKey={settingKey}>{toggle}</SettingAnchor> : toggle;
}

/**
 * Rarely needed settings, one level deep. More than two disclosure levels hurt usability
 * (NN/g, progressive disclosure), so an Advanced block never nests another.
 */
export function AdvancedGroup({
  title,
  icon,
  count,
  children,
}: {
  title: string;
  icon?: ReactNode;
  /** How many settings are inside, shown on the closed fold. */
  count?: number;
  children: ReactNode;
}) {
  return (
    <details className="group rounded-xl bg-[var(--slurp-surface-raised,var(--background))] ring-1 ring-inset ring-[var(--slurp-outline)]">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] [&::-webkit-details-marker]:hidden">
        {icon}
        <span className="min-w-0 flex-1">{title}</span>
        {count !== undefined && (
          <span className="rounded-full bg-[var(--slurp-canvas)] px-2 text-xs font-semibold text-[var(--slurp-muted)] tabular-nums">
            {count}
          </span>
        )}
        <ChevronRight
          size={17}
          className="transition-transform group-open:rotate-90 rtl:rotate-180 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </summary>
      <div className="space-y-4 border-t border-[var(--slurp-outline)] p-4 sm:p-5">{children}</div>
    </details>
  );
}
