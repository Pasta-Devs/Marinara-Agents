// ──────────────────────────────────────────────
// Otome Forge: Date Night's places. A radio group of cards, each in its scene's gradient (no image needed), plus
// "Let {name} choose". The planner adapts the place to the world and names it in the world's language. After them come
// the places the story has painted (M2b's world.places with ready art), each over its own picture: the date goes there
// under the name the story gave it.
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
  MapPin,
  Sparkles,
  Sunset,
  Telescope,
  type LucideIcon,
} from "lucide-react";
import { readyUrl } from "../../lib/reader-state";
import type { WorldView } from "../../shared/api-types";
import { DATE_PLACES, DATE_PLACE_MOODS, PARTNER_CHOICE, STORY_PLACE, type DatePlace } from "../../shared/dates";

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
  [STORY_PLACE]: "ui.otomeForge.dateNight.placeStory",
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
  [STORY_PLACE]: "ui.otomeForge.dateNight.placeStoryText",
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
  [STORY_PLACE]: MapPin,
};

/** What the player picked: one of the picker's places, or a painted place of the story (its key and name). */
export interface PlacePick {
  place: DatePlace;
  storyPlace?: { key: string; name: string };
}

/** The story's painted places (world.places with ready art), in the order the story found them. */
export function paintedPlaces(world: Pick<WorldView, "places">): Array<{ key: string; name: string; url: string }> {
  return Object.entries(world.places ?? {}).flatMap(([key, entry]) => {
    const url = readyUrl(entry?.art);
    return url && entry.name?.trim() ? [{ key, name: entry.name.trim(), url }] : [];
  });
}

interface PlacePickerProps {
  /** The love interest the date is with (names "Let {name} choose"). */
  partnerName: string;
  /** The story's painted places (paintedPlaces), offered after the picker's own. */
  storyPlaces: ReadonlyArray<{ key: string; name: string; url: string }>;
  value: PlacePick | null;
  onChange: (pick: PlacePick) => void;
}

export function PlacePicker({ partnerName, storyPlaces, value, onChange }: PlacePickerProps) {
  const { t } = useTranslation();
  const name = useId();
  const card = (
    key: string,
    place: DatePlace,
    checked: boolean,
    pick: PlacePick,
    title: string,
    art: string | null = null,
  ) => {
    const Icon = PLACE_ICONS[place];
    return (
      <label
        key={key}
        className="of-date-place"
        data-place={place}
        data-checked={checked}
        data-partner={place === PARTNER_CHOICE}
      >
        <input
          type="radio"
          className="of-visually-hidden"
          name={name}
          value={key}
          checked={checked}
          onChange={() => onChange(pick)}
        />
        <span className="of-mood" data-mood={DATE_PLACE_MOODS[place]} data-on="true" aria-hidden="true" />
        {art ? <img className="of-date-place-art" src={art} alt="" loading="lazy" decoding="async" /> : null}
        <span className="of-place-sheen" aria-hidden="true" />
        <span className="of-place-icon of-glass" aria-hidden="true">
          <Icon size={20} strokeWidth={1.7} />
        </span>
        <span className="of-place-name">{title}</span>
        <span className="of-place-text">{t(PLACE_TEXT_KEYS[place], { name: partnerName })}</span>
        {checked ? (
          <span className="of-place-check" aria-hidden="true">
            <Check size={14} strokeWidth={3} />
          </span>
        ) : null}
      </label>
    );
  };
  return (
    <fieldset className="of-places">
      <legend className="of-visually-hidden">{t("ui.otomeForge.dateNight.placeLegend", { name: partnerName })}</legend>
      {DATE_PLACES.map((place) =>
        card(place, place, value?.place === place, { place }, t(PLACE_NAME_KEYS[place], { name: partnerName })),
      )}
      {storyPlaces.length ? (
        <p className="of-eyebrow of-places-story" aria-hidden="true">
          {t("ui.otomeForge.dateNight.storyPlaces")}
        </p>
      ) : null}
      {storyPlaces.map((entry) =>
        card(
          `${STORY_PLACE}:${entry.key}`,
          STORY_PLACE,
          value?.place === STORY_PLACE && value.storyPlace?.key === entry.key,
          { place: STORY_PLACE, storyPlace: { key: entry.key, name: entry.name } },
          entry.name,
          entry.url,
        ),
      )}
    </fieldset>
  );
}
