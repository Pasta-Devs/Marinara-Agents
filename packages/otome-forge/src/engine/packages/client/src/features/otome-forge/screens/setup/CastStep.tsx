// ──────────────────────────────────────────────
// Otome Forge setup, step 3: the cast. Two to five love interests of any gender, from the player's Engine cards (the
// card stays canon) or from six original archetypes, each with the pronouns the player chooses.
// ──────────────────────────────────────────────
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Check,
  Crown,
  Drama,
  FlaskConical,
  HeartCrack,
  Plus,
  Sword,
  UsersRound,
  VenetianMask,
  X,
  type LucideIcon,
} from "lucide-react";
import { Avatar } from "../../components/Avatar";
import { useCharacterOptions, type PickerItem } from "../../hooks/use-engine-resources";
import { nameAccent } from "../../lib/accent";
import { ARCHETYPE_IDS, type ArchetypeId } from "../../shared/archetypes";
import { LI_NAME_MAX, LIS_MAX, LIS_MIN, NOTES_MAX, newLiKey, type DraftLi, type SetupDraft } from "./draft";
import { PronounPicker, Section, TextField } from "./parts";

interface CastStepProps {
  draft: SetupDraft;
  update: (change: (draft: SetupDraft) => SetupDraft) => void;
}

/** Each archetype's label and tagline (the English prompt seeds live in SH/archetypes.ts). */
export const ARCHETYPE_LABELS: Record<ArchetypeId, { nameKey: string; seedKey: string; Icon: LucideIcon }> = {
  "brilliant-monster": {
    nameKey: "ui.otomeForge.setup.archetypeBrilliantMonster",
    seedKey: "ui.otomeForge.setup.archetypeBrilliantMonsterSeed",
    Icon: FlaskConical,
  },
  "gilded-tyrant": {
    nameKey: "ui.otomeForge.setup.archetypeGildedTyrant",
    seedKey: "ui.otomeForge.setup.archetypeGildedTyrantSeed",
    Icon: Crown,
  },
  "gentle-liar": {
    nameKey: "ui.otomeForge.setup.archetypeGentleLiar",
    seedKey: "ui.otomeForge.setup.archetypeGentleLiarSeed",
    Icon: VenetianMask,
  },
  "loyal-blade": {
    nameKey: "ui.otomeForge.setup.archetypeLoyalBlade",
    seedKey: "ui.otomeForge.setup.archetypeLoyalBladeSeed",
    Icon: Sword,
  },
  "ruined-saint": {
    nameKey: "ui.otomeForge.setup.archetypeRuinedSaint",
    seedKey: "ui.otomeForge.setup.archetypeRuinedSaintSeed",
    Icon: HeartCrack,
  },
  "laughing-stranger": {
    nameKey: "ui.otomeForge.setup.archetypeLaughingStranger",
    seedKey: "ui.otomeForge.setup.archetypeLaughingStrangerSeed",
    Icon: Drama,
  },
};

const SEARCH_FROM = 10;

function CastMember({
  li,
  onChange,
  onRemove,
}: {
  li: DraftLi;
  onChange: (li: DraftLi) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const archetype = li.archetype ? ARCHETYPE_LABELS[li.archetype] : null;
  const shownName = li.name.trim() || (archetype ? t(archetype.nameKey) : "");
  return (
    <li className="of-member of-glass" style={{ ["--of-li-accent" as string]: nameAccent(shownName) }}>
      <div className="of-member-head">
        <Avatar
          name={shownName}
          url={li.source === "card" ? li.avatarUrl : null}
          accent={nameAccent(shownName)}
          size={46}
        />
        <div className="of-member-title">
          <span className="of-member-name">{shownName}</span>
          <span className="of-member-source">
            {li.source === "card"
              ? t("ui.otomeForge.setup.fromCard")
              : t("ui.otomeForge.setup.fromArchetype", { archetype: archetype ? t(archetype.nameKey) : "" })}
          </span>
        </div>
        <button
          type="button"
          className="of-icon-button of-glass"
          aria-label={t("ui.otomeForge.setup.removeLi", { name: shownName })}
          title={t("ui.otomeForge.setup.removeLi", { name: shownName })}
          onClick={onRemove}
        >
          <X size={16} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </div>
      {li.source === "archetype" ? (
        <>
          <TextField
            label={t("ui.otomeForge.setup.liNameLabel")}
            placeholder={t("ui.otomeForge.setup.liNamePlaceholder")}
            max={LI_NAME_MAX}
            value={li.name}
            onChange={(name) => onChange({ ...li, name })}
          />
          <TextField
            label={t("ui.otomeForge.setup.liNotesLabel")}
            placeholder={t("ui.otomeForge.setup.liNotesPlaceholder")}
            rows={2}
            max={NOTES_MAX}
            counter
            value={li.notes}
            onChange={(notes) => onChange({ ...li, notes })}
          />
        </>
      ) : null}
      <PronounPicker
        legend={t("ui.otomeForge.setup.liPronouns", { name: shownName })}
        value={li.pronouns}
        onChange={(pronouns) => onChange({ ...li, pronouns })}
      />
    </li>
  );
}

function CardPicker({
  chosen,
  full,
  onToggle,
}: {
  chosen: ReadonlySet<string>;
  full: boolean;
  onToggle: (item: PickerItem) => void;
}) {
  const { t } = useTranslation();
  const characters = useCharacterOptions();
  const [search, setSearch] = useState("");
  const query = search.trim().toLocaleLowerCase();
  const shown = query
    ? characters.items.filter((item) => item.name.toLocaleLowerCase().includes(query))
    : characters.items;
  if (characters.isLoading) {
    return (
      <p className="of-hint" role="status">
        {t("ui.otomeForge.setup.loadingCards")}
      </p>
    );
  }
  if (characters.isError) {
    return (
      <p className="of-notice of-notice--error" role="alert">
        {t("ui.otomeForge.setup.cardsFailed")}
      </p>
    );
  }
  if (characters.items.length === 0) return <p className="of-hint">{t("ui.otomeForge.setup.noCards")}</p>;
  return (
    <>
      {characters.items.length >= SEARCH_FROM ? (
        <input
          className="of-input of-search"
          type="search"
          value={search}
          placeholder={t("ui.otomeForge.setup.cardSearch")}
          aria-label={t("ui.otomeForge.setup.cardSearch")}
          onChange={(event) => setSearch(event.target.value)}
        />
      ) : null}
      <ul className="of-tiles of-tiles--scroll" aria-label={t("ui.otomeForge.setup.cardsLegend")}>
        {shown.map((item) => {
          const picked = chosen.has(item.id);
          return (
            <li key={item.id}>
              <button
                type="button"
                className="of-tile of-glass"
                data-checked={picked}
                aria-pressed={picked}
                aria-disabled={!picked && full}
                title={item.detail || item.name}
                onClick={() => {
                  if (picked || !full) onToggle(item);
                }}
              >
                <Avatar name={item.name} url={item.avatarUrl} accent={nameAccent(item.name)} />
                <span className="of-tile-name">{item.name}</span>
                {picked ? (
                  <span className="of-tile-check" aria-hidden="true">
                    <Check size={12} strokeWidth={3} />
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      {shown.length === 0 ? <p className="of-hint">{t("ui.otomeForge.setup.noMatches")}</p> : null}
    </>
  );
}

export function CastStep({ draft, update }: CastStepProps) {
  const { t } = useTranslation();
  const lis = draft.lis;
  const full = lis.length >= LIS_MAX;
  const chosenCards = new Set(lis.filter((li) => li.source === "card").map((li) => li.cardId));
  const setLis = (change: (lis: DraftLi[]) => DraftLi[]) =>
    update((current) => ({ ...current, lis: change(current.lis) }));
  const emptyPronouns = { preset: null, custom: { subject: "", object: "", possessive: "" } } as const;

  const toggleCard = (item: PickerItem) =>
    setLis((current) =>
      current.some((li) => li.source === "card" && li.cardId === item.id)
        ? current.filter((li) => !(li.source === "card" && li.cardId === item.id))
        : current.length >= LIS_MAX
          ? current
          : [
              ...current,
              {
                key: newLiKey(),
                source: "card",
                cardId: item.id,
                archetype: "",
                name: item.name,
                avatarUrl: item.avatarUrl,
                notes: "",
                pronouns: { ...emptyPronouns, custom: { ...emptyPronouns.custom } },
              },
            ],
    );

  const addArchetype = (archetype: ArchetypeId) =>
    setLis((current) =>
      current.length >= LIS_MAX
        ? current
        : [
            ...current,
            {
              key: newLiKey(),
              source: "archetype",
              cardId: "",
              archetype,
              name: "",
              avatarUrl: null,
              notes: "",
              pronouns: { ...emptyPronouns, custom: { ...emptyPronouns.custom } },
            },
          ],
    );

  return (
    <div className="of-step-body">
      <p className="of-hand of-step-note">{t("ui.otomeForge.setup.castNote")}</p>
      <Section
        title={t("ui.otomeForge.setup.castChosen", { count: lis.length, max: LIS_MAX })}
        hint={lis.length < LIS_MIN ? t("ui.otomeForge.setup.castHint", { min: LIS_MIN, max: LIS_MAX }) : undefined}
      >
        {lis.length ? (
          <ul className="of-members">
            {lis.map((li) => (
              <CastMember
                key={li.key}
                li={li}
                onChange={(next) => setLis((current) => current.map((other) => (other.key === li.key ? next : other)))}
                onRemove={() => setLis((current) => current.filter((other) => other.key !== li.key))}
              />
            ))}
          </ul>
        ) : (
          <div className="of-empty">
            <UsersRound size={22} strokeWidth={1.7} aria-hidden="true" />
            <p>{t("ui.otomeForge.setup.castEmpty")}</p>
          </div>
        )}
        {full ? <p className="of-hint">{t("ui.otomeForge.setup.castFull", { max: LIS_MAX })}</p> : null}
      </Section>
      <Section title={t("ui.otomeForge.setup.cardsLegend")} hint={t("ui.otomeForge.setup.cardsHint")}>
        <CardPicker chosen={chosenCards} full={full} onToggle={toggleCard} />
      </Section>
      <Section title={t("ui.otomeForge.setup.archetypesLegend")} hint={t("ui.otomeForge.setup.archetypesHint")}>
        <ul className="of-archetypes">
          {ARCHETYPE_IDS.map((id) => {
            const { nameKey, seedKey, Icon } = ARCHETYPE_LABELS[id];
            return (
              <li key={id}>
                <button
                  type="button"
                  className="of-archetype of-glass"
                  aria-disabled={full}
                  onClick={() => {
                    if (!full) addArchetype(id);
                  }}
                >
                  <span className="of-archetype-sigil" aria-hidden="true">
                    <Icon size={20} strokeWidth={1.7} />
                  </span>
                  <span className="of-archetype-name">{t(nameKey)}</span>
                  <span className="of-archetype-seed">{t(seedKey)}</span>
                  <span className="of-archetype-add" aria-hidden="true">
                    <Plus size={14} strokeWidth={2.4} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Section>
    </div>
  );
}
