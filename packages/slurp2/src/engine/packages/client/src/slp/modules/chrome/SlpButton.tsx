import type { ComponentProps, ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "../../../lib/utils";
import { playSlpPop, SlpGlint } from "../sparkle/SlpSparkle";

// Every Slurp button shares this shape (design language §7): a pill, at least 44 px, sentence case,
// the 0.96 press, one focus ring.
const PILL =
  "relative isolate inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold transition-[transform,filter,box-shadow,background-color] duration-[var(--slurp-motion-fast)] ease-[var(--slurp-ease)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100";

/**
 * The primary call to action (design language §7): Slurp pink fill, pink glow, a glint on appear,
 * a Pop on press, plum text, pill, at least 44 px. One per screen; say the outcome in the label.
 * (The hero gradient is kept for signature cards and Story rings; as a button it read as a second
 * brand colour.)
 */
export function SlpPrimaryButton({
  className,
  children,
  onClick,
  type = "button",
  ...props
}: ComponentProps<"button">) {
  return (
    <button
      type={type}
      {...props}
      onClick={(event) => {
        playSlpPop(event.currentTarget, { bounce: false });
        onClick?.(event);
      }}
      data-slp-primary-button=""
      className={cn(
        PILL,
        "bg-[var(--noodle-accent)] text-[var(--slurp-on-accent)] shadow-[var(--slurp-glow),var(--slurp-highlight)] hover:brightness-110 disabled:hover:brightness-100 [&_svg]:!text-[var(--slurp-on-accent)]",
        className,
      )}
    >
      <SlpGlint />
      {children}
    </button>
  );
}

const VARIANTS = {
  /** Pink tint: the second choice next to a primary, or the main action where a spend is not involved. */
  secondary:
    "bg-[var(--slurp-tint)] text-[var(--slurp-text)] shadow-[var(--slurp-highlight)] hover:bg-[color-mix(in_srgb,var(--noodle-accent)_22%,var(--slurp-surface-raised))] [&_svg]:!text-[var(--slurp-ink)]",
  /** Neutral raised glass: the quiet actions beside a primary (Follow, Message, Tip), so pink stays for the primary. */
  quiet:
    "bg-[var(--slurp-surface-raised)] text-[var(--slurp-text)] shadow-[var(--slurp-shadow-raised),var(--slurp-highlight)] hover:bg-[color-mix(in_srgb,var(--noodle-accent)_8%,var(--slurp-surface-raised))] disabled:shadow-none disabled:hover:bg-[var(--slurp-surface-raised)] [&_svg]:!text-[var(--slurp-ink)]",
  /** Text only, in pink ink: Cancel, Report bug, See all. */
  tertiary: "px-3 text-[var(--slurp-ink)] hover:bg-[var(--accent)] [&_svg]:!text-current",
  /** Danger ink on a faint danger tint: delete, leave, cancel a subscription. */
  danger:
    "bg-[color-mix(in_srgb,var(--slurp-danger)_10%,transparent)] text-[var(--slurp-danger)] hover:bg-[color-mix(in_srgb,var(--slurp-danger)_16%,transparent)] [&_svg]:!text-current",
} as const;

/** The button look, for a link that acts like a button (Report bug). */
export const slpButtonClass = (variant: keyof typeof VARIANTS = "secondary") => cn(PILL, VARIANTS[variant]);

/** Secondary / tertiary / danger buttons. The primary one is `SlpPrimaryButton` (it carries the sparkle). */
export function SlpButton({
  variant = "secondary",
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: keyof typeof VARIANTS }) {
  return <button type={type} {...props} className={cn(slpButtonClass(variant), className)} />;
}

/**
 * Selected = pink tint + ring (the settings `ChoiceSetting` segment look), never a solid pink disc,
 * so "selected" never reads like "primary".
 */
const CHIP_SELECTED =
  "bg-[image:var(--slurp-nav-active)] text-[var(--slurp-text)] ring-1 ring-inset ring-[var(--noodle-accent)]/45 [&_svg]:!text-[var(--slurp-ink)]";
const CHIP_IDLE =
  "text-[var(--slurp-muted)] ring-1 ring-inset ring-[var(--noodle-divider)] hover:text-[var(--slurp-text)] hover:bg-[var(--accent)] [&_svg]:!text-current";
const CHIP =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold tabular-nums transition-colors duration-[var(--slurp-motion-base)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none";

/**
 * A static label in the chip look (post access "Public post" / "Locked"): same pill and ring, but
 * 24 px and not a control. `selected` gives it the pink tint + ring of a selected chip.
 */
export const slpTagClass = (selected = false) =>
  cn(
    "inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-[11px] font-semibold leading-none",
    selected ? CHIP_SELECTED : "text-[var(--slurp-muted)] ring-1 ring-inset ring-[var(--noodle-divider)]",
  );

/** A toggle or a quick pick (filters, tip amounts). `selected` is announced as pressed. */
export function SlpChip({
  selected = false,
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { selected?: boolean }) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      {...props}
      className={cn(CHIP, selected ? CHIP_SELECTED : CHIP_IDLE, className)}
    />
  );
}

/** One choice out of a few, as a pill track (layout toggle, feed tabs). */
export function SlpSegment<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: readonly { value: T; label: string; icon?: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "inline-flex gap-1 rounded-full bg-[var(--slurp-canvas)] p-1 ring-1 ring-inset ring-[var(--noodle-divider)]",
        className,
      )}
    >
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            // An icon-only segment still has a name.
            aria-label={option.icon ? option.label : undefined}
            title={option.icon ? option.label : undefined}
            onClick={() => onChange(option.value)}
            className={cn(
              CHIP,
              "min-h-9 min-w-9 px-3 ring-0",
              checked
                ? CHIP_SELECTED
                : "text-[var(--slurp-muted)] hover:text-[var(--slurp-text)] [&_svg]:!text-current",
            )}
          >
            {option.icon ?? option.label}
          </button>
        );
      })}
    </div>
  );
}

/** The square check mark of a checkbox or multi-select row (a round mark reads as a radio). Decorative: the row carries the state. */
export function SlpSquareCheck({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-5 shrink-0 place-items-center rounded-[5px] ring-2 ring-inset transition-colors duration-[var(--slurp-motion-fast)] motion-reduce:transition-none",
        checked
          ? "bg-[var(--noodle-accent)] text-[var(--slurp-on-accent)] ring-[var(--noodle-accent)] [&_svg]:!text-[var(--slurp-on-accent)]"
          : "ring-[var(--slurp-muted)]/50",
      )}
    >
      {checked && <Check size={14} strokeWidth={3} />}
    </span>
  );
}
