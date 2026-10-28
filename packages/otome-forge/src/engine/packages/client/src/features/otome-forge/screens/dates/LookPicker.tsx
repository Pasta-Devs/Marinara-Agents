// ──────────────────────────────────────────────
// Otome Forge: Date Night's looks. What each of them wears tonight, side by side: the painted look, or initials on
// their colour when there is no image.
// ponytail: only the base looks exist until M4's Wardrobe; the ceiling is one look each, and the upgrade path is
// listing the looks each of them owns (by id) in the same radio groups.
// ──────────────────────────────────────────────
import { useId, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Check, Shirt } from "lucide-react";
import { accentOf, initialsOf } from "../../lib/accent";
import { BASE_LOOK } from "../../shared/dates";
import type { Player, RunLiView } from "../../shared/api-types";

interface LookPickerProps {
  partner: RunLiView;
  player: Player;
  hisLook: string;
  herLook: string;
  onChange: (looks: { hisLook: string; herLook: string }) => void;
}

interface LookCardProps {
  group: string;
  who: string;
  name: string;
  url?: string;
  accent: string;
  value: string;
  onPick: (look: string) => void;
}

/** One person's looks as a radio group (one card per owned look). */
function LookCard({ group, who, name, url, accent, value, onPick }: LookCardProps) {
  const { t } = useTranslation();
  const looks = [BASE_LOOK];
  return (
    <fieldset className="of-looks-person" style={{ "--of-li-accent": accent } as CSSProperties}>
      <legend className="of-looks-who">{who}</legend>
      {looks.map((look) => {
        const checked = value === look;
        return (
          <label key={look} className="of-look" data-checked={checked}>
            <input
              type="radio"
              className="of-visually-hidden"
              name={group}
              value={look}
              checked={checked}
              onChange={() => onPick(look)}
            />
            <span className="of-look-frame" aria-hidden="true">
              {url ? (
                <img src={url} alt="" loading="lazy" />
              ) : (
                <span className="of-look-initials">{initialsOf(name)}</span>
              )}
            </span>
            <span className="of-look-name">
              {checked ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : null}
              {t("ui.otomeForge.dateNight.lookBase")}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

export function LookPicker({ partner, player, hisLook, herLook, onChange }: LookPickerProps) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <div className="of-looks">
      <div className="of-looks-pair">
        <LookCard
          group={`${id}-his`}
          who={t("ui.otomeForge.dateNight.lookTheirs", { name: partner.name })}
          name={partner.name}
          url={partner.portrait}
          accent={accentOf(partner)}
          value={hisLook}
          onPick={(look) => onChange({ hisLook: look, herLook })}
        />
        <LookCard
          group={`${id}-hers`}
          who={t("ui.otomeForge.dateNight.lookYours")}
          name={player.name}
          url={player.portrait}
          accent="var(--of-champagne)"
          value={herLook}
          onPick={(look) => onChange({ hisLook, herLook: look })}
        />
      </div>
      <p className="of-hint of-looks-note">
        <Shirt size={14} strokeWidth={2} aria-hidden="true" />
        <span>{t("ui.otomeForge.dateNight.lookWardrobeNote")}</span>
      </p>
    </div>
  );
}
