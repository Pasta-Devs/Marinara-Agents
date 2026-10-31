// ──────────────────────────────────────────────
// Otome Forge: Date Night's looks. What each of them wears tonight, side by side: every look they own and can wear (the
// Wardrobe's own list, GET /runs/:run/wardrobe), their everyday look first, or initials on their colour when a look has
// no image. Starting the date wears the picks, as Wear at home does (S/routes/dates.ts), so they stay on afterwards.
// ──────────────────────────────────────────────
import { useId, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Check, Shirt } from "lucide-react";
import { accentOf, initialsOf } from "../../lib/accent";
import { BASE_LOOK } from "../../shared/dates";
import type { Player, RunLiView } from "../../shared/api-types";
import type { LookView } from "../../shared/wardrobe";

interface LookPickerProps {
  partner: RunLiView;
  player: Player;
  /** Their looks and yours, from the Wardrobe; absent while it loads (only the everyday looks show). */
  hisLooks?: LookView[];
  herLooks?: LookView[];
  hisLook: string;
  herLook: string;
  onChange: (looks: { hisLook: string; herLook: string }) => void;
}

/** The looks a date may use: the everyday one, then every owned look that is painted (only those can be worn). */
export function dateLooks(looks: readonly LookView[] | undefined): LookView[] {
  return (looks ?? []).filter((look) => look.id === BASE_LOOK || look.wearable);
}

/** The look a person wears now, as a date's starting pick: their worn look when they may wear it, else the everyday. */
export function wornDateLook(looks: readonly LookView[] | undefined): string {
  return dateLooks(looks).find((look) => look.worn)?.id ?? BASE_LOOK;
}

interface LookCardProps {
  group: string;
  who: string;
  name: string;
  /** The everyday look's image (their portrait), used when the Wardrobe has not loaded. */
  url?: string;
  looks: LookView[];
  accent: string;
  value: string;
  onPick: (look: string) => void;
}

/** One person's looks as a radio group (one card per look they can wear). */
function LookCard({ group, who, name, url, looks, accent, value, onPick }: LookCardProps) {
  const { t } = useTranslation();
  const shown = looks.length ? looks : [{ id: BASE_LOOK, name: "", url } as Pick<LookView, "id" | "name" | "url">];
  return (
    <fieldset className="of-looks-person" style={{ "--of-li-accent": accent } as CSSProperties}>
      <legend className="of-looks-who">{who}</legend>
      {shown.map((look) => {
        const checked = value === look.id;
        const image = look.url ?? (look.id === BASE_LOOK ? url : undefined);
        return (
          <label key={look.id} className="of-look" data-checked={checked}>
            <input
              type="radio"
              className="of-visually-hidden"
              name={group}
              value={look.id}
              checked={checked}
              onChange={() => onPick(look.id)}
            />
            <span className="of-look-frame" aria-hidden="true">
              {image ? (
                <img src={image} alt="" loading="lazy" />
              ) : (
                <span className="of-look-initials">{initialsOf(name)}</span>
              )}
            </span>
            <span className="of-look-name">
              {checked ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : null}
              {look.id === BASE_LOOK ? t("ui.otomeForge.dateNight.lookBase") : look.name}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

export function LookPicker({ partner, player, hisLooks, herLooks, hisLook, herLook, onChange }: LookPickerProps) {
  const { t } = useTranslation();
  const id = useId();
  const his = dateLooks(hisLooks);
  const hers = dateLooks(herLooks);
  // Owned looks that are not painted yet (opened in the Wardrobe they paint, and can then be worn).
  const unpainted = [...(hisLooks ?? []), ...(herLooks ?? [])].some((look) => look.id !== BASE_LOOK && !look.wearable);
  return (
    <div className="of-looks">
      <div className="of-looks-pair">
        <LookCard
          group={`${id}-his`}
          who={t("ui.otomeForge.dateNight.lookTheirs", { name: partner.name })}
          name={partner.name}
          url={partner.portrait}
          looks={his}
          accent={accentOf(partner)}
          value={hisLook}
          onPick={(look) => onChange({ hisLook: look, herLook })}
        />
        <LookCard
          group={`${id}-hers`}
          who={t("ui.otomeForge.dateNight.lookYours")}
          name={player.name}
          url={player.portrait}
          looks={hers}
          accent="var(--of-champagne)"
          value={herLook}
          onPick={(look) => onChange({ hisLook, herLook: look })}
        />
      </div>
      <p className="of-hint of-looks-note">
        <Shirt size={14} strokeWidth={2} aria-hidden="true" />
        <span>
          {t(unpainted ? "ui.otomeForge.dateNight.lookUnpaintedNote" : "ui.otomeForge.dateNight.lookWearNote")}
        </span>
      </p>
    </div>
  );
}
