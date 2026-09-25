/**
 * The settings controls both settings surfaces share.
 *
 * The Backstage host composes panels rather than drawing controls itself, so these live here as a
 * reusable module: every feature panel and the simulation panel draw the same control set.
 */
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { SettingAnchor, type SlpSettingKey } from "./SlpSettingsKit";

/**
 * Saves a number in order. A slow older request cannot land after a newer one and persist a stale
 * value; a queued save is skipped once a later edit supersedes it. The generation token, not the
 * value, decides: 1 -> 2 -> 1 would otherwise let the first save's failure recovery match the last.
 * Rejections are swallowed so one failed save does not wedge the queue for every save after it.
 */
function useQueuedSave(value: number, onSave: (value: number) => Promise<boolean> | boolean | void) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const saveQueueRef = useRef(Promise.resolve());
  const saveGenerationRef = useRef(0);
  const save = async (next: number) => {
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
  return { draft, setDraft, save };
}

const stepButton =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-lg font-semibold ring-1 ring-inset ring-[var(--border)] hover:bg-[var(--accent)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] disabled:opacity-40";

export function NumberSetting({
  value,
  min,
  max,
  onSave,
  /** Whole numbers by default. Tuning has rates and multipliers that are legitimately fractional. */
  integer = true,
  disabled = false,
  /** Adds − and + buttons: for small counts a player nudges rather than types. */
  stepper = false,
  label,
}: {
  value: number;
  min: number;
  max: number;
  onSave: (value: number) => Promise<boolean> | boolean | void;
  integer?: boolean;
  disabled?: boolean;
  stepper?: boolean;
  /** Accessible name when the number has no visible label of its own. */
  label?: string;
}) {
  const { draft, setDraft, save } = useQueuedSave(value, onSave);
  const commit = async (raw = draft, resetInvalid = true) => {
    const next = Number(raw);
    if (!raw.trim() || !(integer ? Number.isInteger(next) : Number.isFinite(next)) || next < min || next > max) {
      if (resetInvalid) setDraft(String(value));
      return;
    }
    await save(next);
  };
  const input = (
    <input
      type="number"
      aria-label={label}
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
      className={`h-11 min-w-0 rounded-lg border border-[var(--border)] bg-[var(--slurp-canvas,var(--background))] px-3 text-base tabular-nums outline-none transition-colors focus:border-[var(--noodle-accent)] focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]/30 disabled:opacity-50 sm:text-sm ${stepper ? "w-20 text-center" : "w-full max-w-40"}`}
    />
  );
  if (!stepper) return input;
  const current = Number(draft);
  const nudge = (delta: number) => {
    const next = Math.min(max, Math.max(min, (Number.isFinite(current) ? current : value) + delta));
    setDraft(String(next));
    void commit(String(next));
  };
  return (
    // The input comes first in the DOM: a click on a surrounding <label> activates its first
    // control, which must be the number, not the "−" button. `order` puts "−" back on the left.
    <span className="flex items-center gap-2 @xl:w-auto!">
      {input}
      <button
        type="button"
        aria-label="−1"
        disabled={disabled || current <= min}
        onClick={() => nudge(-1)}
        className={`${stepButton} order-first`}
      >
        −
      </button>
      <button
        type="button"
        aria-label="+1"
        disabled={disabled || current >= max}
        onClick={() => nudge(1)}
        className={stepButton}
      >
        +
      </button>
    </span>
  );
}

/**
 * A slider for a bounded, small range where the position matters more than the exact digit. It
 * saves when the thumb is let go, not on every move. Exact money values stay typed.
 */
export function RangeSetting({
  value,
  min,
  max,
  step = 1,
  format = String,
  onSave,
  disabled = false,
  label,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  /** The chip text, e.g. "3 weeks" or "07:00". */
  format?: (value: number) => string;
  onSave: (value: number) => Promise<boolean> | boolean | void;
  disabled?: boolean;
  label?: string;
}) {
  const { draft, setDraft, save } = useQueuedSave(value, onSave);
  const commit = () => {
    const next = Number(draft);
    if (next !== value && Number.isFinite(next)) void save(next);
  };
  return (
    <span className="flex items-center gap-3">
      <input
        type="range"
        aria-label={label}
        aria-valuetext={format(Number(draft))}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
        className="h-11 min-w-0 flex-1 accent-[var(--noodle-accent)] disabled:opacity-50"
      />
      <span className="min-w-16 rounded-full bg-[var(--slurp-canvas,var(--accent))] px-2.5 py-1 text-center text-sm font-semibold tabular-nums">
        {format(Number(draft))}
      </span>
    </span>
  );
}

/** One label, two numbers: a lower and an upper bound side by side, "to" between them. */
export function RangePairField({
  label,
  detail,
  unit,
  bounds,
  min,
  max,
}: {
  label: string;
  detail?: string;
  unit: string;
  bounds: [number, number];
  min: { settingKey: SlpSettingKey; label: string; value: number; onSave: (value: number) => unknown };
  max: { settingKey: SlpSettingKey; label: string; value: number; onSave: (value: number) => unknown };
}) {
  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="text-sm font-semibold">{label}</legend>
      {detail && <p className="text-xs leading-5 text-[var(--muted-foreground)]">{detail}</p>}
      <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2 text-sm">
        <SettingAnchor settingKey={min.settingKey}>
          <NumberSetting
            label={min.label}
            value={min.value}
            min={bounds[0]}
            max={Math.min(bounds[1], max.value)}
            onSave={(value) => void min.onSave(value)}
          />
        </SettingAnchor>
        <span className="text-[var(--muted-foreground)]">–</span>
        <SettingAnchor settingKey={max.settingKey}>
          <NumberSetting
            label={max.label}
            value={max.value}
            min={Math.max(bounds[0], min.value)}
            max={bounds[1]}
            onSave={(value) => void max.onSave(value)}
          />
        </SettingAnchor>
        <span className="text-xs text-[var(--muted-foreground)]">{unit}</span>
      </div>
    </fieldset>
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
/**
 * A labelled group of related settings: one card, one hairline between its rows. Rows carry no
 * box of their own, so a page reads as a few groups instead of a stack of boxes.
 */
export function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      className="rounded-xl bg-[var(--slurp-surface-raised,var(--background))] px-4 py-3 shadow-[var(--slurp-shadow-raised)] sm:px-5"
      aria-label={title}
    >
      <h3 className="pb-1 pt-1 text-xs font-bold uppercase tracking-[0.14em] text-[var(--noodle-accent-foreground)]">
        {title}
      </h3>
      <div className="divide-y divide-[var(--slurp-outline,var(--border))] [&>*]:py-3.5 [&>*:last-child]:pb-1.5">
        {children}
      </div>
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
/**
 * The shared frame of one setting: what it is on the left, the control on the right. A narrow
 * container (phone, a half-width column) stacks them. The frame queries its own width, not the
 * viewport, so the same control is a row in a wide page and a stack in the Creator modal column.
 */
export const settingRowGrid = "grid gap-2 @xl:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] @xl:items-center @xl:gap-x-8";

export function Field({
  label,
  detail,
  settingKey,
  disabledReason,
  wide = false,
  group = false,
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
  /** Text areas and lists need the whole width; they always sit under the label. */
  wide?: boolean;
  /**
   * Several controls (a checkbox list, a button row). A <label> around them would send a click on
   * the text to the first one, so the frame becomes a named group instead.
   */
  group?: boolean;
  children: ReactNode;
}) {
  const labelId = useId();
  const Root = group ? "div" : "label";
  const field = (
    <Root className="@container block text-sm" {...(group ? { role: "group", "aria-labelledby": labelId } : {})}>
      <span className={wide ? "grid gap-2" : `${settingRowGrid} @xl:has-[textarea]:grid-cols-1`}>
        <span className="block min-w-0">
          <span id={labelId} className="block font-semibold">
            {label}
          </span>
          {detail && (
            <span className="mt-0.5 block max-w-prose text-xs leading-5 text-[var(--muted-foreground)] text-pretty">
              {detail}
            </span>
          )}
          {disabledReason && (
            <span className="mt-0.5 block text-xs font-semibold leading-5 text-[var(--slurp-muted,var(--muted-foreground))]">
              {disabledReason}
            </span>
          )}
        </span>
        <span className="flex min-w-0 flex-col @xl:items-end @xl:[&>*]:w-full">{children}</span>
      </span>
    </Root>
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
      className={`group relative flex ${compact ? "min-h-11" : "min-h-12"} ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"} items-center justify-between gap-4 rounded-lg text-sm focus-within:ring-2 focus-within:ring-[var(--noodle-accent)] focus-within:ring-offset-4 focus-within:ring-offset-[var(--slurp-surface)]`}
    >
      <span className="min-w-0">
        <span className="block font-semibold">{label}</span>
        {detail && (
          <span className="mt-0.5 block max-w-prose text-xs font-normal leading-5 text-[var(--muted-foreground)] text-pretty">
            {detail}
          </span>
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
 * The long "how this works" text of a page, folded under its lead. It is read once, so it must not
 * push the controls below the fold on every visit.
 */
export function HowItWorks({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="group text-xs leading-5 text-[var(--slurp-muted,var(--muted-foreground))]">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-lg font-semibold text-[var(--noodle-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] [&::-webkit-details-marker]:hidden">
        {label}
        <ChevronRight
          size={15}
          className="transition-transform group-open:rotate-90 rtl:rotate-180 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </summary>
      <div className="max-w-prose space-y-2 pb-2 text-pretty">{children}</div>
    </details>
  );
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
