// The answers on a stage (docs/OPENING-DAY.md): big cards in the thumb zone instead of small chips.
// A tap presses the card, lights the pick up and drops the others, then reports the pick. Props in.
import { useState, type ReactNode } from "react";
import { cn } from "../../../lib/utils";
import { slpPrefersReducedMotion } from "../../base/chrome/slp-motion";

export type SlpChoice = {
  id: string;
  label: ReactNode;
  hint?: string;
  /** An emoji or a small icon in front of the label. */
  glyph?: ReactNode;
  /** The suggested pick (the default, or the one way on). */
  primary?: boolean;
  /** The quiet way out ("Not now", "Use the defaults"). */
  ghost?: boolean;
  ariaLabel?: string;
};

export type SlpChoiceLayout = "one" | "two" | "three" | "list";

/** Time for the chosen card to light up before the stage moves on. */
const CHOSEN_MS = 220;

const GRID: Record<SlpChoiceLayout, string> = {
  one: "grid-cols-1",
  two: "grid-cols-2",
  three: "grid-cols-3",
  list: "grid-cols-1 max-h-[34dvh] overflow-y-auto overscroll-contain p-0.5",
};

export function SlpChoiceCards({
  choices,
  layout,
  label,
  onSelect,
}: {
  choices: readonly SlpChoice[];
  /** Defaults to two columns, one for a single card. */
  layout?: SlpChoiceLayout;
  /** The question, as the group's accessible name. */
  label: string;
  onSelect: (id: string) => void;
}) {
  const [chosen, setChosen] = useState<string | null>(null);
  const shape = layout ?? (choices.length === 1 ? "one" : "two");
  const row = shape === "one" || shape === "list";
  const pick = (id: string) => {
    if (chosen) return;
    if (slpPrefersReducedMotion()) return onSelect(id);
    setChosen(id);
    window.setTimeout(() => {
      setChosen(null);
      onSelect(id);
    }, CHOSEN_MS);
  };
  return (
    <div role="group" aria-label={label} className={cn("grid gap-2.5", GRID[shape])}>
      {choices.map((choice, index) => {
        const lit = chosen === choice.id || (!chosen && choice.primary);
        return (
          <button
            key={choice.id}
            type="button"
            aria-label={choice.ariaLabel}
            onClick={() => pick(choice.id)}
            style={{ animationDelay: `${index * 45}ms` }}
            className={cn(
              "slp-choice-in flex min-h-14 min-w-0 gap-3 rounded-[18px] px-3.5 py-3 text-start transition-[transform,background-color,box-shadow,opacity] duration-150 ease-[var(--slurp-ease)] active:translate-y-[3px] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--noodle-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--slurp-surface)] motion-reduce:transition-none",
              row ? "items-center" : "flex-col items-start gap-1.5",
              lit
                ? "bg-[var(--noodle-accent)] text-[var(--slurp-on-accent)] shadow-[0_4px_0_color-mix(in_srgb,var(--noodle-accent)_55%,black)] [&_svg]:!text-current"
                : choice.ghost
                  ? "bg-transparent text-[var(--slurp-text)] shadow-[inset_0_0_0_1.5px_color-mix(in_srgb,var(--slurp-text)_16%,transparent)] hover:bg-[var(--accent)]"
                  : "bg-[var(--slurp-surface-raised)] text-[var(--slurp-text)] shadow-[inset_0_0_0_1.5px_color-mix(in_srgb,var(--noodle-accent)_20%,transparent),0_3px_0_rgb(0_0_0/0.35)] hover:bg-[color-mix(in_srgb,var(--noodle-accent)_10%,var(--slurp-surface-raised))]",
              chosen && chosen !== choice.id && "pointer-events-none translate-y-2 scale-95 opacity-0",
            )}
          >
            {choice.glyph && (
              <span aria-hidden="true" className="shrink-0 text-[26px] leading-none">
                {choice.glyph}
              </span>
            )}
            <span className="min-w-0">
              <span className="block text-[15px] font-bold leading-5">{choice.label}</span>
              {choice.hint && (
                <span
                  className={cn(
                    "mt-0.5 block text-[12.5px] leading-4",
                    lit ? "text-[color-mix(in_srgb,var(--slurp-on-accent)_72%,transparent)]" : "text-[var(--slurp-muted)]",
                  )}
                >
                  {choice.hint}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
