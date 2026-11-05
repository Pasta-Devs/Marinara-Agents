// ──────────────────────────────────────────────
// Story Writer sidebar: what the story is (title, overview, details, voice, story bible)
// ──────────────────────────────────────────────
import { useTranslation } from "react-i18next";
import type { StorySettings } from "../../../lib/story-writer/model";
import { TextField } from "./fields";

type DetailKey = "fandom" | "genre" | "rating" | "relationships" | "warnings" | "tags";
const DETAILS: DetailKey[] = ["fandom", "genre", "rating", "relationships", "warnings", "tags"];

export function StorySection(props: { settings: StorySettings; onChange(patch: Partial<StorySettings>): void }) {
  const { t } = useTranslation();
  const { settings, onChange } = props;
  return (
    <>
      <TextField
        label={t("story.title")}
        value={settings.title}
        placeholder={t("story.titlePlaceholder")}
        maxLength={300}
        onChange={(title) => onChange({ title })}
      />
      <TextField
        label={t("story.overview")}
        value={settings.overview}
        placeholder={t("story.overviewPlaceholder")}
        hint={t("story.overviewHint")}
        multiline
        rows={5}
        onChange={(overview) => onChange({ overview })}
      />
      <h4 className="sw-subheading">{t("story.details")}</h4>
      <div className="sw-grid-2">
        {DETAILS.map((key) => (
          <TextField
            key={key}
            label={t(`story.${key}`)}
            value={settings[key]}
            placeholder={t(`story.${key}Placeholder`)}
            onChange={(value) => onChange({ [key]: value })}
          />
        ))}
      </div>
      <TextField
        label={t("story.author")}
        value={settings.author}
        placeholder={t("story.authorPlaceholder")}
        hint={t("story.authorHint")}
        onChange={(author) => onChange({ author })}
      />
      <TextField
        label={t("story.style")}
        value={settings.style}
        placeholder={t("story.stylePlaceholder")}
        onChange={(style) => onChange({ style })}
      />
      <TextField
        label={t("story.language")}
        value={settings.language}
        placeholder={t("story.languagePlaceholder")}
        maxLength={200}
        onChange={(language) => onChange({ language })}
      />
      <TextField
        label={t("story.notes")}
        value={settings.notes}
        placeholder={t("story.notesPlaceholder")}
        hint={t("story.notesHint")}
        multiline
        rows={5}
        onChange={(notes) => onChange({ notes })}
      />
    </>
  );
}
