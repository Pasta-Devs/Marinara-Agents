/**
 * Choice controls for fixed option sets, so a setting with three short answers shows all three
 * instead of hiding them in a dropdown. Dynamic lists (connections, profiles) stay `<select>`.
 */
import type { LucideIcon } from "lucide-react";
import { useId } from "react";
import { SettingAnchor, type SlpSettingKey } from "./SlpSettingsKit";

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
}: {
  label: string;
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
      <legend className="float-left w-full text-sm font-semibold">{label}</legend>
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
