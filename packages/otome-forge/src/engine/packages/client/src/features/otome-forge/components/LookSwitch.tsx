// ──────────────────────────────────────────────
// Otome Forge: the look picker (Midnight, Pearl, Follow system), kept on this device
// ──────────────────────────────────────────────
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import type { LookPreference } from "../hooks/use-look";

const OPTIONS: readonly { value: LookPreference; labelKey: string; Icon: LucideIcon }[] = [
  { value: "midnight", labelKey: "ui.otomeForge.common.lookMidnight", Icon: Moon },
  { value: "pearl", labelKey: "ui.otomeForge.common.lookPearl", Icon: Sun },
  { value: "system", labelKey: "ui.otomeForge.common.lookSystem", Icon: Monitor },
];

interface LookSwitchProps {
  preference: LookPreference;
  onChange: (preference: LookPreference) => void;
}

export function LookSwitch({ preference, onChange }: LookSwitchProps) {
  const { t } = useTranslation();
  const id = useId();
  const titleId = `${id}-title`;
  return (
    <section className="of-panel of-card of-glass" aria-labelledby={titleId}>
      <h2 id={titleId} className="of-panel-title">
        {t("ui.otomeForge.common.look")}
      </h2>
      <div className="of-segmented of-glass" role="radiogroup" aria-labelledby={titleId}>
        {OPTIONS.map(({ value, labelKey, Icon }) => (
          <label key={value} className="of-segment" data-checked={preference === value}>
            <input
              className="of-visually-hidden"
              type="radio"
              name={`${id}-look`}
              value={value}
              checked={preference === value}
              onChange={() => onChange(value)}
            />
            <Icon size={15} strokeWidth={2} aria-hidden="true" />
            <span>{t(labelKey)}</span>
          </label>
        ))}
      </div>
      <p className="of-hint">{t("ui.otomeForge.common.lookHint")}</p>
    </section>
  );
}
