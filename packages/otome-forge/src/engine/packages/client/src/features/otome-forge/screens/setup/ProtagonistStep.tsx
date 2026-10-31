// ──────────────────────────────────────────────
// Otome Forge setup, step 2: the protagonist. An Engine persona (Otome keeps its id: the Engine has no active persona),
// pronouns the player chooses (nothing is assumed), up to five traits and a goal of their own.
// ──────────────────────────────────────────────
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, UserRound, X } from "lucide-react";
import { usePersonaOptions, type PickerItem } from "../../hooks/use-engine-resources";
import { Avatar } from "../../components/Avatar";
import { CheckAgain, RetryNotice } from "../../components/RetryNotice";
import { GOAL_MAX, TRAIT_MAX, TRAITS_MAX, type SetupDraft } from "./draft";
import { PronounPicker, Section, TextField } from "./parts";

interface ProtagonistStepProps {
  draft: SetupDraft;
  update: (change: (draft: SetupDraft) => SetupDraft) => void;
}

const SEARCH_FROM = 7;

function PersonaGrid({
  items,
  value,
  onChange,
}: {
  items: PickerItem[];
  value: string;
  onChange: (item: PickerItem) => void;
}) {
  const { t } = useTranslation();
  const name = useId();
  const [search, setSearch] = useState("");
  const query = search.trim().toLocaleLowerCase();
  const shown = query ? items.filter((item) => item.name.toLocaleLowerCase().includes(query)) : items;
  return (
    <fieldset className="of-fieldset">
      <legend className="of-legend">{t("ui.otomeForge.setup.personaLegend")}</legend>
      {items.length >= SEARCH_FROM ? (
        <input
          className="of-input of-search"
          type="search"
          value={search}
          placeholder={t("ui.otomeForge.setup.personaSearch")}
          aria-label={t("ui.otomeForge.setup.personaSearch")}
          onChange={(event) => setSearch(event.target.value)}
        />
      ) : null}
      <div className="of-tiles">
        {shown.map((item) => (
          <label
            key={item.id}
            className="of-tile of-glass"
            data-checked={value === item.id}
            title={item.detail || item.name}
          >
            <input
              className="of-visually-hidden"
              type="radio"
              name={name}
              value={item.id}
              checked={value === item.id}
              onChange={() => onChange(item)}
            />
            <Avatar name={item.name} url={item.avatarUrl} crop={item.avatarCrop} />
            <span className="of-tile-name">{item.name}</span>
          </label>
        ))}
      </div>
      {shown.length === 0 ? <p className="of-hint">{t("ui.otomeForge.setup.noMatches")}</p> : null}
    </fieldset>
  );
}

function Traits({ traits, onChange }: { traits: string[]; onChange: (traits: string[]) => void }) {
  const { t } = useTranslation();
  const id = useId();
  const [text, setText] = useState("");
  const full = traits.length >= TRAITS_MAX;
  const add = () => {
    const trait = text.trim().slice(0, TRAIT_MAX);
    if (!trait || full || traits.includes(trait)) return;
    onChange([...traits, trait]);
    setText("");
  };
  return (
    <div className="of-field">
      <label className="of-label" htmlFor={id}>
        {t("ui.otomeForge.setup.traitsLabel")}
      </label>
      <div className="of-select-row">
        <input
          id={id}
          className="of-input"
          value={text}
          maxLength={TRAIT_MAX}
          disabled={full}
          placeholder={full ? t("ui.otomeForge.setup.traitsFull") : t("ui.otomeForge.setup.traitsPlaceholder")}
          aria-describedby={`${id}-hint`}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
        />
        <button
          type="button"
          className="of-icon-button of-glass"
          aria-label={t("ui.otomeForge.setup.traitsAdd")}
          title={t("ui.otomeForge.setup.traitsAdd")}
          disabled={full || !text.trim()}
          onClick={add}
        >
          <Plus size={17} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
      <p id={`${id}-hint`} className="of-field-hint">
        <span>{t("ui.otomeForge.setup.traitsHint")}</span>
        <span className="of-counter">
          {traits.length} / {TRAITS_MAX}
        </span>
      </p>
      {traits.length ? (
        <ul className="of-chips" aria-label={t("ui.otomeForge.setup.traitsChosen")}>
          {traits.map((trait) => (
            <li key={trait} className="of-trait">
              <span>{trait}</span>
              <button
                type="button"
                className="of-trait-remove"
                aria-label={t("ui.otomeForge.setup.traitsRemove", { trait })}
                onClick={() => onChange(traits.filter((other) => other !== trait))}
              >
                <X size={13} strokeWidth={2.4} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function ProtagonistStep({ draft, update }: ProtagonistStepProps) {
  const { t } = useTranslation();
  const personas = usePersonaOptions();
  const protagonist = draft.protagonist;
  const setProtagonist = (patch: Partial<SetupDraft["protagonist"]>) =>
    update((current) => ({ ...current, protagonist: { ...current.protagonist, ...patch } }));
  return (
    <div className="of-step-body">
      <p className="of-hand of-step-note">{t("ui.otomeForge.setup.protagonistNote")}</p>
      {personas.isLoading ? (
        <p className="of-hint" role="status">
          {t("ui.otomeForge.setup.loadingPersonas")}
        </p>
      ) : personas.isError ? (
        <RetryNotice
          message={t("ui.otomeForge.setup.personasFailed")}
          onRetry={() => void personas.refetch()}
          retrying={personas.retrying}
        />
      ) : personas.items.length === 0 ? (
        <div className="of-empty of-glass">
          <UserRound size={22} strokeWidth={1.7} aria-hidden="true" />
          <p>{t("ui.otomeForge.setup.noPersonas")}</p>
          <CheckAgain onCheck={personas.refetch} />
        </div>
      ) : (
        <PersonaGrid
          items={personas.items}
          value={protagonist.personaId}
          onChange={(item) => setProtagonist({ personaId: item.id, name: item.name })}
        />
      )}
      <Section title={t("ui.otomeForge.setup.aboutYou")}>
        <PronounPicker
          legend={t("ui.otomeForge.setup.yourPronouns")}
          value={protagonist.pronouns}
          onChange={(pronouns) => setProtagonist({ pronouns })}
        />
        <Traits traits={protagonist.traits} onChange={(traits) => setProtagonist({ traits })} />
        <TextField
          label={t("ui.otomeForge.setup.goalLabel")}
          placeholder={t("ui.otomeForge.setup.goalPlaceholder")}
          hint={t("ui.otomeForge.setup.goalHint")}
          rows={3}
          max={GOAL_MAX}
          counter
          value={protagonist.goal}
          onChange={(goal) => setProtagonist({ goal })}
        />
      </Section>
    </div>
  );
}
