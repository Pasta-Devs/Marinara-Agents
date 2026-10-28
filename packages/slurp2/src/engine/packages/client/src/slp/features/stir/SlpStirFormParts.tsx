import { cn } from "../../../lib/utils";
import { SLP_TYPE } from "../../base/chrome/SlpChrome";
import { SlpChip } from "../../modules/chrome/SlpButton";
import { SlpCreatorChips } from "../../modules/chrome/SlpCreatorChips";
import type { SlpStirView } from "../../../../../shared/src/slp/slp-stir.js";

type Creator = SlpStirView["creators"][number];

/** Who can be picked, as avatar chips. `max` 1 or 2. */
export function CreatorPicker({
  creators,
  picked,
  onPick,
  max,
  label,
}: {
  creators: Creator[];
  picked: string[];
  onPick: (ids: string[]) => void;
  max: number;
  label: string;
}) {
  // A full pick swaps out the last one, so the Creator the sheet came from stays picked.
  const toggle = (id: string) =>
    onPick(
      picked.includes(id)
        ? picked.filter((entry) => entry !== id)
        : picked.length < max
          ? [...picked, id]
          : [...picked.slice(0, max - 1), id],
    );
  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className={cn(SLP_TYPE.meta, "font-semibold")}>{label}</legend>
      <SlpCreatorChips creators={creators} picked={picked} onToggle={toggle} label={label} />
    </fieldset>
  );
}

/** One choice out of a few, as chips (steer, move, mood, pace, level). */
export function Choice({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className={cn(SLP_TYPE.meta, "font-semibold")}>{label}</legend>
      <div className="flex flex-wrap gap-1.5" role="radiogroup">
        {options.map((option) => (
          <SlpChip
            key={option.value}
            role="radio"
            aria-pressed={undefined}
            aria-checked={value === option.value}
            selected={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </SlpChip>
        ))}
      </div>
    </fieldset>
  );
}
