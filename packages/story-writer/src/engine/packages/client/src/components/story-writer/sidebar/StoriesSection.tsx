// ──────────────────────────────────────────────
// Story Writer sidebar: the story picker and story-level actions
// ──────────────────────────────────────────────
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Copy, FileDown, FileText, Plus, Save, Trash2 } from "lucide-react";
import type { StorySummary } from "../../../lib/story-writer/model";
import { useNumberFormat } from "./fields";

export function StoriesSection(props: {
  stories: StorySummary[];
  activeStoryId: string | null;
  busy: boolean;
  canExport: boolean;
  onSelect(storyId: string): void;
  onCreate(): void;
  onDuplicate(): void;
  onDelete(): void;
  onExport(format: "md" | "txt"): void;
  saving: boolean;
  onSaveNow(): void;
}) {
  const { t, i18n } = useTranslation();
  const formatNumber = useNumberFormat();
  const formatDate = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" });
    } catch {
      return new Intl.DateTimeFormat("en", { dateStyle: "medium" });
    }
  }, [i18n.language]);
  const hasActive = !!props.activeStoryId;
  return (
    <>
      {props.stories.length === 0 ? (
        <p className="sw-empty">{t("stories.empty")}</p>
      ) : (
        <ul className="sw-story-list" aria-label={t("stories.list")}>
          {props.stories.map((story) => {
            const updated = new Date(story.updatedAt);
            return (
              <li key={story.id}>
                <button
                  type="button"
                  className="sw-story-item"
                  aria-current={story.id === props.activeStoryId ? "true" : undefined}
                  disabled={props.busy && story.id !== props.activeStoryId}
                  onClick={() => props.onSelect(story.id)}
                >
                  <span className="sw-story-title">{story.title.trim() || t("app.untitled")}</span>
                  <span className="sw-story-meta">
                    {t("stories.meta", {
                      words: t("actions.words", { count: story.wordCount, formatted: formatNumber(story.wordCount) }),
                      chapters: t("stories.chapters", { count: story.chapterCount }),
                      updated: Number.isNaN(updated.getTime()) ? "" : formatDate.format(updated),
                    })}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {props.busy ? <p className="sw-hint">{t("stories.busy")}</p> : null}
      <div className="sw-button-row">
        <button
          type="button"
          className="sw-button"
          data-variant="primary"
          disabled={props.busy}
          onClick={props.onCreate}
        >
          <Plus size={16} aria-hidden="true" />
          {t("stories.new")}
        </button>
        <button type="button" className="sw-button" disabled={props.busy || !hasActive} onClick={props.onDuplicate}>
          <Copy size={15} aria-hidden="true" />
          {t("stories.duplicate")}
        </button>
        <button
          type="button"
          className="sw-button"
          data-variant="danger"
          disabled={props.busy || !hasActive}
          onClick={props.onDelete}
        >
          <Trash2 size={15} aria-hidden="true" />
          {t("stories.delete")}
        </button>
      </div>
      <div className="sw-button-row">
        <button type="button" className="sw-button" disabled={!hasActive} onClick={props.onSaveNow}>
          <Save size={15} aria-hidden="true" />
          {props.saving ? t("stories.saveNow") : t("stories.savedAll")}
        </button>
      </div>
      <p className="sw-hint">{t("stories.savedHint")}</p>
      <div className="sw-button-row">
        <button
          type="button"
          className="sw-button"
          disabled={!props.canExport}
          aria-label={t("stories.exportMarkdownLabel")}
          onClick={() => props.onExport("md")}
        >
          <FileDown size={15} aria-hidden="true" />
          {t("stories.exportMarkdown")}
        </button>
        <button
          type="button"
          className="sw-button"
          disabled={!props.canExport}
          aria-label={t("stories.exportTextLabel")}
          onClick={() => props.onExport("txt")}
        >
          <FileText size={15} aria-hidden="true" />
          {t("stories.exportText")}
        </button>
      </div>
    </>
  );
}
