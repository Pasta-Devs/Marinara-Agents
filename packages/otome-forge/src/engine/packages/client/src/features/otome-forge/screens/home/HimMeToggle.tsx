// ──────────────────────────────────────────────
// Otome Forge: who stands on Home, the love interest (by name, whatever their pronouns) or the player ("Me"). Two
// native radios, so the arrow keys move between them. The whole name shows and an ellipsis cuts one too long: a first
// word may be a title ("Lord", "Dr."), never their name.
// ──────────────────────────────────────────────
import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { HomeShow } from "../../shared/api-types";

interface HimMeToggleProps {
  /** The love interest's name: the label, and the title that shows it whole when the ellipsis cuts it. */
  name: string;
  show: HomeShow;
  onChange: (show: HomeShow) => void;
}

const SIDES: readonly HomeShow[] = ["him", "me"];

export function HimMeToggle({ name, show, onChange }: HimMeToggleProps) {
  const { t } = useTranslation();
  const group = useId();
  return (
    <fieldset className="of-himme of-glass">
      <legend className="of-visually-hidden">{t("ui.otomeForge.home.showLabel")}</legend>
      {SIDES.map((side) => (
        <label
          key={side}
          className="of-himme-option"
          data-checked={show === side}
          title={side === "him" ? name : undefined}
        >
          <input
            type="radio"
            className="of-visually-hidden"
            name={group}
            value={side}
            checked={show === side}
            onChange={() => onChange(side)}
          />
          <span>{side === "him" ? name : t("ui.otomeForge.home.me")}</span>
        </label>
      ))}
    </fieldset>
  );
}
