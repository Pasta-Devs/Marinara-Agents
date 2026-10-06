import { useTranslation } from "react-i18next";
import {
  SLP_SPICE_LEVELS,
  SLP_SPICE_STEPS,
  type SlpSpiceLevel,
  type SlpSpiceStep,
} from "../../../../../shared/src/slp/slp-spice.js";
import { ChoiceSetting } from "../../modules/settings/SlpSettingsInputs";

const INHERIT = "inherit";

/**
 * The one spice scale (0.3.17), wherever a level is picked: the Slurp-wide default (Settings › Spice),
 * a Creator's Content rules and their Stir sheet. It drives text and pictures; public posts stay one
 * step tamer, and the Slurp-wide limit caps it. `inherited` adds "Use Slurp-wide (…)" (null value).
 */
export function SlpSpiceLevelChoice({
  label,
  value,
  inherited,
  max,
  disabled = false,
  inheritLabelKey = "ui.slurp.spice.inherit",
  onChange,
}: {
  label: string;
  value: SlpSpiceStep | null;
  inherited?: SlpSpiceStep;
  max: SlpSpiceLevel;
  disabled?: boolean;
  /** "Use Slurp-wide (…)" for a Creator; the Slurp-wide default itself says "Shipped (…)". */
  inheritLabelKey?: string;
  onChange: (step: SlpSpiceStep | null) => void;
}) {
  const { t } = useTranslation();
  const shown = value ?? inherited ?? null;
  const capped = shown !== null && shown !== "clean" && SLP_SPICE_LEVELS.indexOf(shown) > SLP_SPICE_LEVELS.indexOf(max);
  const options = [
    ...(inherited
      ? [{ value: INHERIT, label: t(inheritLabelKey, { level: t(`ui.slurp.spice.levels.${inherited}`) }) }]
      : []),
    ...SLP_SPICE_STEPS.map((step) => ({
      value: step,
      label: t(`ui.slurp.spice.levels.${step}`),
      detail: t(`ui.slurp.spice.stepDetail.${step}`),
    })),
  ];
  return (
    <ChoiceSetting<string>
      variant="cards"
      label={label}
      detail={
        capped
          ? t("ui.slurp.spice.stepCapped", { max: t(`ui.slurp.spice.levels.${max}`) })
          : t("ui.slurp.spice.stepScale")
      }
      options={options}
      value={value ?? (inherited ? INHERIT : null)}
      disabled={disabled}
      onChange={(next) => onChange(next === INHERIT ? null : (next as SlpSpiceStep))}
    />
  );
}
