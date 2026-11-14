import { ChevronRight } from "lucide-react";
import { useId, type HTMLAttributes, type ReactNode } from "react";
import { InfoPopover } from "../shared-controls";

export type SettingsRebuildOutcome = { status: "complete" | "deferred"; error?: string };

export function Toggle({
  label,
  checked,
  onChange,
  help,
  hint,
  disabled = false,
  locked = false,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  help?: ReactNode;
  /** One muted line under the label, read with the switch; use instead of `help` when the text is short. */
  hint?: string;
  disabled?: boolean;
  /** A save is running: the switch keeps focus (`aria-disabled`) but ignores changes. */
  locked?: boolean;
}) {
  const inputId = useId();
  return (
    <div className="flex min-h-11 items-end gap-2">
      <label
        htmlFor={inputId}
        className={`flex min-h-11 flex-1 items-center gap-3 text-xs font-semibold text-[var(--foreground)]${hint ? " py-1" : ""} ${disabled || locked ? "opacity-60" : "cursor-pointer"}`}
      >
        <input
          id={inputId}
          type="checkbox"
          data-ltm-switch
          checked={checked}
          disabled={disabled}
          aria-disabled={locked || undefined}
          aria-labelledby={hint ? `${inputId}-label` : undefined}
          aria-describedby={hint ? `${inputId}-hint` : undefined}
          onChange={(event) => (locked ? undefined : onChange(event.target.checked))}
        />
        {hint ? (
          <span className="min-w-0">
            <span id={`${inputId}-label`}>{label}</span>
            <span
              id={`${inputId}-hint`}
              data-ltm-toggle-hint
              className="block text-[0.6875rem] font-normal text-[var(--muted-foreground)]"
            >
              {hint}
            </span>
          </span>
        ) : (
          <span>{label}</span>
        )}
      </label>
      {help ? <InfoPopover label={label} content={help} /> : null}
    </div>
  );
}

/** A named control with one muted line under it: the name sits directly above the control it sets. */
export function Field({
  labelId,
  label,
  hint,
  children,
  wide = false,
  ...rest
}: {
  labelId: string;
  label: string;
  /** Rendered as `#${labelId}-hint`; point the control's `aria-describedby` at it. */
  hint?: ReactNode;
  children: ReactNode;
  /** Span every column of the settings grid. */
  wide?: boolean;
} & Omit<HTMLAttributes<HTMLDivElement>, "className" | "style">) {
  return (
    <div
      {...rest}
      className="space-y-1 text-xs font-semibold text-[var(--foreground)]"
      style={wide ? { gridColumn: "1 / -1" } : undefined}
    >
      <span id={labelId} className="block">
        {label}
      </span>
      {children}
      {hint ? (
        <p
          id={`${labelId}-hint`}
          data-ltm-field-hint
          className="text-[0.6875rem] font-normal text-[var(--muted-foreground)]"
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** The row of a `<details>` disclosure: a full-width target with a chevron that turns when the section is open (the turn is CSS in MemorySettings). */
export function DisclosureSummary({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <summary
      data-ltm-tab-focus
      data-ltm-disclosure-summary
      className={`min-h-11 cursor-pointer font-semibold ${className}`}
    >
      <ChevronRight aria-hidden="true" size="0.875rem" data-ltm-disclosure-chevron className="shrink-0" />
      {children}
    </summary>
  );
}

/**
 * Styles for the Settings section labels and disclosure rows. Rendered by TroubleshootingPanel, which Memory Settings
 * mounts in every state (loading, error and loaded), so they never depend on the loaded form's own style block.
 */
export function SettingsSharedStyles() {
  return (
    <style>{`
    /* Section headings read at full strength, one step above the field names under them. */
    [data-ltm-group-heading] {
      color: var(--foreground);
    }
    /* A section inside a settings panel starts at a hairline, not in a box of its own. */
    [data-ltm-settings-section] {
      border-top: 1px solid var(--marinara-editor-divider);
      padding-top: 1rem;
    }
    /* The aside on a disclosure row sits at its far end and leaves on a narrow panel. */
    [data-ltm-disclosure-note] {
      display: none;
      margin-inline-start: auto;
      font-size: 0.6875rem;
      font-weight: 400;
      color: var(--muted-foreground);
    }
    @container ltm-memory-settings (min-width: 36rem) {
      [data-ltm-disclosure-note] {
        display: block;
      }
    }
    /* Disclosure rows: the whole summary is the target, with a chevron that turns when the section is open. */
    [data-ltm-disclosure-summary] {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      list-style: none;
    }
    [data-ltm-disclosure-summary]::-webkit-details-marker {
      display: none;
    }
    [data-ltm-disclosure-chevron] {
      transition: transform 0.15s;
    }
    details[open] > [data-ltm-disclosure-summary] > [data-ltm-disclosure-chevron] {
      transform: rotate(90deg);
    }
    @media (prefers-reduced-motion: reduce) {
      [data-ltm-disclosure-chevron] {
        transition: none;
      }
    }
    details[data-ltm-disclosure] {
      border: 1px solid var(--marinara-editor-divider);
      border-radius: 0.5rem;
    }
    details[data-ltm-disclosure] > :not(summary) {
      margin-inline: 0.75rem;
    }
    details[data-ltm-disclosure][open] {
      padding-bottom: 0.75rem;
    }
    /* The space-y rule would leave a dead strip under a closed row. */
    details[data-ltm-disclosure]:not([open]) > summary {
      margin-block-end: 0;
    }
    details[data-ltm-disclosure] > [data-ltm-disclosure-summary] {
      padding-inline: 0.75rem;
    }
    /* On/off settings are switches, drawn on the real checkbox in the Engine Settings switch colours. The thumb is a
       background so it renders in every browser (inputs take no ::after in some). */
    input[data-ltm-switch] {
      appearance: none;
      -webkit-appearance: none;
      flex: none;
      width: 2.25rem;
      height: 1.25rem;
      margin: 0;
      border-radius: 9999px;
      background-color: var(--border);
      background-image: radial-gradient(circle closest-side, var(--background) calc(100% - 1.5px), var(--border) calc(100% - 1px), var(--border) calc(100% - 0.5px), transparent 100%);
      background-repeat: no-repeat;
      background-size: 1rem 1rem;
      background-position: 0.125rem 50%;
      cursor: pointer;
      transition: background-color 0.15s, background-position 0.15s;
    }
    input[data-ltm-switch]:checked {
      background-color: color-mix(in srgb, var(--primary) 70%, transparent);
      background-position: calc(100% - 0.125rem) 50%;
    }
    input[data-ltm-switch]:focus-visible {
      outline: 2px solid var(--ring);
      outline-offset: 2px;
    }
    input[data-ltm-switch]:disabled {
      cursor: default;
    }
    @media (prefers-reduced-motion: reduce) {
      input[data-ltm-switch] {
        transition: none;
      }
    }
    `}</style>
  );
}
