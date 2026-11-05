// ──────────────────────────────────────────────
// Story Writer sidebar: the characters, personas and lorebooks the story uses
// ──────────────────────────────────────────────
import { useTranslation } from "react-i18next";
import { BookMarked } from "lucide-react";
import { useCharacterOptions, useLorebookOptions, usePersonaOptions } from "../../../hooks/use-engine-resources";
import type { StorySettings } from "../../../lib/story-writer/model";
import { Checklist } from "./fields";

export function CastSection(props: {
  settings: StorySettings;
  onChange(patch: Partial<StorySettings>, options?: { immediate?: boolean }): void;
}) {
  const { t } = useTranslation();
  const characters = useCharacterOptions();
  const personas = usePersonaOptions();
  const lorebooks = useLorebookOptions();
  const { settings, onChange } = props;
  return (
    <>
      <Checklist
        label={t("cast.characters")}
        hint={t("cast.charactersHint")}
        searchLabel={t("cast.searchCharacters")}
        emptyText={t("cast.noCharacters")}
        items={characters.items}
        isLoading={characters.isLoading}
        selected={settings.characterIds}
        onChange={(characterIds) => onChange({ characterIds }, { immediate: true })}
      />
      <Checklist
        label={t("cast.personas")}
        hint={t("cast.personasHint")}
        searchLabel={t("cast.searchPersonas")}
        emptyText={t("cast.noPersonas")}
        items={personas.items}
        isLoading={personas.isLoading}
        selected={settings.personaIds}
        onChange={(personaIds) => onChange({ personaIds }, { immediate: true })}
      />
      <Checklist
        label={t("cast.lorebooks")}
        hint={t("cast.lorebooksHint")}
        searchLabel={t("cast.searchLorebooks")}
        emptyText={t("cast.noLorebooks")}
        items={lorebooks.items}
        isLoading={lorebooks.isLoading}
        selected={settings.lorebookIds}
        fallbackIcon={<BookMarked size={15} />}
        onChange={(lorebookIds) => onChange({ lorebookIds }, { immediate: true })}
      />
    </>
  );
}
