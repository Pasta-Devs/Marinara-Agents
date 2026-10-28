// ──────────────────────────────────────────────
// Otome Forge: Date Night's places. A radio group of cards, each in its scene's gradient (no image needed), plus
// "Let {name} choose". The planner adapts the place to the world and names it in the world's language.
// ──────────────────────────────────────────────
import { useId } from "react";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  Check,
  Coffee,
  FerrisWheel,
  Fish,
  Flower2,
  Lamp,
  Sparkles,
  Sunset,
  Telescope,
  type LucideIcon,
} from "lucide-react";
import { DATE_PLACES, DATE_PLACE_MOODS, PARTNER_CHOICE, type DatePlace } from "../../shared/dates";

export const PLACE_NAME_KEYS: Record<DatePlace, string> = {
  aquarium: "ui.otomeForge.dateNight.placeAquarium",
  rooftop: "ui.otomeForge.dateNight.placeRooftop",
  bookshop: "ui.otomeForge.dateNight.placeBookshop",
  "night-market": "ui.otomeForge.dateNight.placeNightMarket",
  observatory: "ui.otomeForge.dateNight.placeObservatory",
  seaside: "ui.otomeForge.dateNight.placeSeaside",
  cafe: "ui.otomeForge.dateNight.placeCafe",
  fairground: "ui.otomeForge.dateNight.placeFairground",
  [PARTNER_CHOICE]: "ui.otomeForge.dateNight.placePartnerChoice",
};

const PLACE_TEXT_KEYS: Record<DatePlace, string> = {
  aquarium: "ui.otomeForge.dateNight.placeAquariumText",
  rooftop: "ui.otomeForge.dateNight.placeRooftopText",
  bookshop: "ui.otomeForge.dateNight.placeBookshopText",
  "night-market": "ui.otomeForge.dateNight.placeNightMarketText",
  observatory: "ui.otomeForge.dateNight.placeObservatoryText",
  seaside: "ui.otomeForge.dateNight.placeSeasideText",
  cafe: "ui.otomeForge.dateNight.placeCafeText",
  fairground: "ui.otomeForge.dateNight.placeFairgroundText",
  [PARTNER_CHOICE]: "ui.otomeForge.dateNight.placePartnerChoiceText",
};

export const PLACE_ICONS: Record<DatePlace, LucideIcon> = {
  aquarium: Fish,
  rooftop: Flower2,
  bookshop: BookOpen,
  "night-market": Lamp,
  observatory: Telescope,
  seaside: Sunset,
  cafe: Coffee,
  fairground: FerrisWheel,
  [PARTNER_CHOICE]: Sparkles,
};

interface PlacePickerProps {
  /** The love interest the date is with (names "Let {name} choose"). */
  partnerName: string;
  value: DatePlace | null;
  onChange: (place: DatePlace) => void;
}

export function PlacePicker({ partnerName, value, onChange }: PlacePickerProps) {
  const { t } = useTranslation();
  const name = useId();
  return (
    <fieldset className="of-places">
      <legend className="of-visually-hidden">{t("ui.otomeForge.dateNight.placeLegend", { name: partnerName })}</legend>
      {DATE_PLACES.map((place) => {
        const Icon = PLACE_ICONS[place];
        const checked = value === place;
        return (
          <label
            key={place}
            className="of-place"
            data-place={place}
            data-checked={checked}
            data-partner={place === PARTNER_CHOICE}
          >
            <input
              type="radio"
              className="of-visually-hidden"
              name={name}
              value={place}
              checked={checked}
              onChange={() => onChange(place)}
            />
            <span className="of-mood" data-mood={DATE_PLACE_MOODS[place]} data-on="true" aria-hidden="true" />
            <span className="of-place-sheen" aria-hidden="true" />
            <span className="of-place-icon of-glass" aria-hidden="true">
              <Icon size={20} strokeWidth={1.7} />
            </span>
            <span className="of-place-name">{t(PLACE_NAME_KEYS[place], { name: partnerName })}</span>
            <span className="of-place-text">{t(PLACE_TEXT_KEYS[place], { name: partnerName })}</span>
            {checked ? (
              <span className="of-place-check" aria-hidden="true">
                <Check size={14} strokeWidth={3} />
              </span>
            ) : null}
          </label>
        );
      })}
    </fieldset>
  );
}
