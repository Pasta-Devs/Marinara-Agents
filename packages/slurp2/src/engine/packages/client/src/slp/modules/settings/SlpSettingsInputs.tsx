/**
 * Choice controls for fixed option sets, so a setting with three short answers shows all three
 * instead of hiding them in a dropdown. Dynamic lists (connections, profiles) stay `<select>`.
 */
import { X, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { focusSettingAnchor, SettingAnchor, type SlpSettingKey } from "./SlpSettingsKit";

export type ChoiceOption<T extends string> = {
  value: T;
  label: string;
  /** Cards only: one line that says what the option does. */
  detail?: string;
  /** Cards only. */
  icon?: LucideIcon;
};

/** Short labels and at most four options fit one row at 390 px; anything else wraps. */
const SEGMENT_MAX_OPTIONS = 4;
const SEGMENT_MAX_LABEL = 10;

/**
 * One native radio group, drawn as a segmented control (2–4 short options) or as cards (options
 * that need a one-line consequence, such as presets). Arrow keys and screen-reader counts come
 * from the radios. `value` null means no option matches; the caller explains that state in `detail`.
 */
export function ChoiceSetting<T extends string>({
  label,
  detail,
  settingKey,
  options,
  value,
  onChange,
  variant = "segmented",
  disabled = false,
  disabledReason,
  labelHidden = false,
}: {
  label: string;
  /** The label is still announced; hide it when a surrounding row already shows it. */
  labelHidden?: boolean;
  detail?: string;
  settingKey?: SlpSettingKey;
  options: readonly ChoiceOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  variant?: "segmented" | "cards";
  disabled?: boolean;
  /** Why this setting has no effect right now. The options stay visible and are disabled. */
  disabledReason?: string | null;
}) {
  const name = useId();
  const off = disabled || Boolean(disabledReason);
  const oneRow =
    options.length <= SEGMENT_MAX_OPTIONS && options.every((option) => option.label.length <= SEGMENT_MAX_LABEL);
  const group = (
    <fieldset disabled={off} className="min-w-0 space-y-2">
      <legend className={labelHidden ? "sr-only" : "float-left w-full text-sm font-semibold"}>{label}</legend>
      {detail && <p className="clear-left text-xs leading-5 text-[var(--muted-foreground)]">{detail}</p>}
      {disabledReason && (
        <p className="clear-left text-xs font-semibold leading-5 text-[var(--slurp-muted,var(--muted-foreground))]">
          {disabledReason}
        </p>
      )}
      <div
        className={
          variant === "cards"
            ? "clear-left grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
            : `clear-left gap-1 rounded-lg bg-[var(--slurp-canvas,var(--background))] p-1 ring-1 ring-inset ring-[var(--slurp-outline,var(--border))] ${oneRow ? "grid auto-cols-fr grid-flow-col" : "flex flex-wrap"} ${off ? "opacity-50" : ""}`
        }
      >
        {options.map((option) => {
          const checked = value === option.value;
          const Icon = option.icon;
          const input = (
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={checked}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
          );
          return variant === "cards" ? (
            <label
              key={option.value}
              className={`flex min-h-16 items-start gap-3 rounded-xl p-3 text-start ring-1 ring-inset transition-colors focus-within:ring-2 focus-within:ring-[var(--slurp-focus,var(--noodle-accent))] motion-reduce:transition-none ${off ? "cursor-not-allowed opacity-50" : "cursor-pointer"} ${checked ? "bg-[var(--slurp-nav-active)] ring-[var(--noodle-accent)]/45" : "bg-[var(--slurp-canvas,var(--background))] ring-[var(--slurp-outline,var(--border))] hover:bg-[var(--accent)]/40"}`}
            >
              {input}
              {Icon && (
                <Icon
                  size={18}
                  aria-hidden="true"
                  className={`mt-0.5 shrink-0 ${checked ? "text-[var(--noodle-accent)]" : "text-[var(--slurp-muted,var(--muted-foreground))]"}`}
                />
              )}
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{option.label}</span>
                {option.detail && (
                  <span className="mt-0.5 block text-xs leading-5 text-[var(--muted-foreground)] text-pretty">
                    {option.detail}
                  </span>
                )}
              </span>
            </label>
          ) : (
            <label
              key={option.value}
              className={`flex min-h-10 min-w-0 items-center justify-center rounded-md px-3 text-center text-sm font-semibold transition-colors focus-within:ring-2 focus-within:ring-[var(--slurp-focus,var(--noodle-accent))] motion-reduce:transition-none ${oneRow ? "" : "flex-auto"} ${off ? "cursor-not-allowed" : "cursor-pointer"} ${checked ? "bg-[var(--slurp-nav-active)] text-[var(--slurp-text,var(--foreground))] shadow-sm ring-1 ring-inset ring-[var(--noodle-accent)]/45" : "text-[var(--slurp-muted,var(--muted-foreground))] hover:text-[var(--slurp-text,var(--foreground))]"}`}
            >
              {input}
              <span className="truncate">{option.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
  return settingKey ? <SettingAnchor settingKey={settingKey}>{group}</SettingAnchor> : group;
}

/**
 * A per-Creator setting that follows the Slurp-wide value until the player turns on "Own value".
 * Off shows the inherited value; on shows the real control. Turning it off deletes the override,
 * so the Creator follows later Slurp-wide changes again.
 */
export function OverrideField({
  label,
  detail,
  inheritedValue,
  overridden,
  onOverride,
  onReset,
  disabled = false,
  children,
}: {
  label: string;
  detail?: string;
  /** Already localized, e.g. "Suggest". */
  inheritedValue: string;
  overridden: boolean;
  /** Writes the current Slurp-wide value as this Creator's own value. */
  onOverride: () => void;
  onReset: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const labelId = useId();
  return (
    <div
      className={`space-y-3 rounded-lg p-3 ring-1 ring-inset ${overridden ? "bg-[var(--slurp-surface-raised,var(--background))] ring-[var(--noodle-accent)]/35" : "ring-[var(--slurp-outline,var(--border))]"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p id={labelId} className="text-sm font-semibold">
            {label}
          </p>
          {detail && <p className="mt-0.5 text-xs leading-5 text-[var(--muted-foreground)]">{detail}</p>}
          <p className="mt-1 text-xs leading-5 text-[var(--slurp-muted,var(--muted-foreground))]">
            {overridden
              ? t("ui.slurp.settings.override.slurpValue", { value: inheritedValue })
              : t("ui.slurp.settings.override.usesSlurp", { value: inheritedValue })}
          </p>
        </div>
        <label
          className={`inline-flex min-h-11 shrink-0 items-center gap-2 text-xs font-semibold ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
        >
          <span>{t("ui.slurp.settings.override.own")}</span>
          <input
            type="checkbox"
            role="switch"
            aria-describedby={labelId}
            disabled={disabled}
            checked={overridden}
            onChange={(event) => (event.target.checked ? onOverride() : onReset())}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className="relative h-6 w-10 shrink-0 rounded-full bg-[var(--muted-foreground)]/25 shadow-inner transition-colors after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:bg-[var(--noodle-accent)] peer-checked:after:translate-x-4 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--noodle-accent)] motion-reduce:transition-none motion-reduce:after:transition-none"
          />
        </label>
      </div>
      {overridden && children}
    </div>
  );
}

/**
 * A list of short entries as chips. Enter adds the typed entry (entries may contain commas);
 * Backspace in an empty input removes the last chip. Editing a chip is remove and add again.
 */
export function ChipListInput({
  label,
  values,
  onChange,
  placeholder,
  disabled = false,
}: {
  label: string;
  values: readonly string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");
  const inputId = useId();
  const add = () => {
    const next = draft.trim();
    if (next && !values.includes(next)) onChange([...values, next]);
    setDraft("");
  };
  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="block text-xs font-semibold">
        {label}
      </label>
      <div
        className={`flex min-h-11 flex-wrap items-center gap-1.5 rounded-lg bg-[var(--slurp-canvas,var(--background))] p-1.5 ring-1 ring-inset ring-[var(--slurp-outline,var(--border))] focus-within:ring-2 focus-within:ring-[var(--slurp-focus,var(--noodle-accent))] ${disabled ? "opacity-50" : ""}`}
      >
        {values.map((value) => (
          <span
            key={value}
            className="inline-flex max-w-full items-center rounded-full bg-[var(--slurp-surface-raised,var(--accent))] ps-3 text-sm ring-1 ring-inset ring-[var(--slurp-outline,var(--border))]"
          >
            <span className="min-w-0 truncate">{value}</span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(values.filter((entry) => entry !== value))}
              aria-label={t("ui.slurp.settings.chips.remove", { value })}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-[var(--slurp-muted,var(--muted-foreground))] hover:text-[var(--slurp-text,var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus,var(--noodle-accent))] -my-2"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          id={inputId}
          value={draft}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            } else if (event.key === "Backspace" && !draft && values.length > 0) {
              onChange(values.slice(0, -1));
            }
          }}
          onBlur={add}
          className="min-h-9 min-w-32 flex-1 bg-transparent px-2 text-base outline-none placeholder:text-[var(--muted-foreground)] sm:text-sm"
        />
      </div>
    </div>
  );
}

export type StatusStripItem = { label: string; value?: string; settingKey?: SlpSettingKey };

/**
 * What a page is set to right now, as a row of chips under its header. A chip with a setting key
 * jumps to that control (opening a folded block if needed). Chips, not a sentence: a sentence with
 * links cannot be reordered for other languages.
 */
export function StatusStrip({ label, items }: { label: string; items: readonly StatusStripItem[] }) {
  return (
    <ul aria-label={label} className="flex flex-wrap gap-2">
      {items.map((item) => {
        const content = (
          <>
            <span className="text-[var(--slurp-muted,var(--muted-foreground))]">{item.label}</span>
            {item.value && <span className="font-semibold">{item.value}</span>}
          </>
        );
        const chip =
          "inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[var(--slurp-surface-raised,var(--accent))] px-3 text-sm ring-1 ring-inset ring-[var(--slurp-outline,var(--border))]";
        return (
          <li key={item.settingKey ?? item.label}>
            {item.settingKey ? (
              <button
                type="button"
                onClick={() => focusSettingAnchor(item.settingKey!)}
                className={`${chip} hover:ring-[var(--noodle-accent)]/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus,var(--noodle-accent))]`}
              >
                {content}
              </button>
            ) : (
              <span className={chip}>{content}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
