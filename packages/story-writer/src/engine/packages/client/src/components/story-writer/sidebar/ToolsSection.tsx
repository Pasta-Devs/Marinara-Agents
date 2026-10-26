// ──────────────────────────────────────────────
// Story Writer sidebar: chapters and summaries, the timeline, and the author's note option
// ──────────────────────────────────────────────
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDown, ArrowUp, ChevronDown, Layers, Plus, Sparkles, Trash2, X } from "lucide-react";
import { chaptersToSummarize, type StoryGenerationApi } from "../../../hooks/use-story-generation";
import { generateClientId } from "../../../lib/utils";
import {
  LIMITS,
  chapterTitle,
  countWords,
  type StoryChapter,
  type StorySettings,
  type TimelineEvent,
} from "../../../lib/story-writer/model";
import { NumberField, TextField, Toggle, useDraftText, useNumberFormat } from "./fields";

type SettingsChange = (patch: Partial<StorySettings>, options?: { immediate?: boolean }) => void;

export function ToolsSection(props: {
  settings: StorySettings;
  onChange: SettingsChange;
  chapters: StoryChapter[];
  generation: StoryGenerationApi;
  /** A connection is available and no generation is running. */
  canGenerate: boolean;
  onSaveSummary(chapterId: string, summary: string): void;
  onDeleteChapter(chapterId: string): void;
  onJump(chapterId: string): void;
}) {
  const { t } = useTranslation();
  const { settings, onChange, chapters, generation, canGenerate } = props;
  const keep = settings.keepFullChapters;
  // The same rule the button runs, so the hint never offers chapters it would skip.
  const unsummarized = useMemo(() => chaptersToSummarize(chapters, keep).length, [chapters, keep]);
  return (
    <>
      <h4 className="sw-subheading">{t("tools.chapters")}</h4>
      <ChapterList
        chapters={chapters}
        canGenerate={canGenerate}
        generation={generation}
        onSaveSummary={props.onSaveSummary}
        onDeleteChapter={props.onDeleteChapter}
        onJump={props.onJump}
      />
      <div className="sw-field">
        <div className="sw-button-row">
          <button
            type="button"
            className="sw-button"
            disabled={!canGenerate || unsummarized === 0}
            onClick={() => void generation.summarizeOlderChapters()}
          >
            <Layers size={15} aria-hidden="true" />
            {t("tools.summarizeOlder")}
          </button>
        </div>
        <p className="sw-hint">
          {unsummarized > 0
            ? t("tools.summarizeOlderHint", { count: unsummarized, keep })
            : t("tools.summarizeOlderNone", { keep })}
        </p>
      </div>
      <NumberField
        label={t("tools.keepFull")}
        hint={t("tools.keepFullHint")}
        value={keep}
        min={LIMITS.keepFullChapters.min}
        max={LIMITS.keepFullChapters.max}
        onCommit={(keepFullChapters) => keepFullChapters !== null && onChange({ keepFullChapters })}
      />
      <Toggle
        label={t("tools.autoSummarize")}
        hint={t("tools.autoSummarizeHint")}
        checked={settings.autoSummarize}
        onChange={(autoSummarize) => onChange({ autoSummarize }, { immediate: true })}
      />

      <h4 className="sw-subheading">{t("tools.timeline")}</h4>
      <p className="sw-hint">{t("tools.timelineHint")}</p>
      <TimelineEditor events={settings.timeline} onChange={onChange} />
      <div className="sw-button-row">
        <button
          type="button"
          className="sw-button"
          disabled={!canGenerate}
          onClick={() => void generation.fillTimeline()}
        >
          <Sparkles size={15} aria-hidden="true" />
          {t("tools.fillTimeline")}
        </button>
      </div>
      <Toggle
        label={t("tools.autoTimeline")}
        checked={settings.autoTimeline}
        onChange={(autoTimeline) => onChange({ autoTimeline }, { immediate: true })}
      />

      <h4 className="sw-subheading">{t("tools.authorNote")}</h4>
      <Toggle
        label={t("tools.clearNote")}
        hint={t("tools.clearNoteHint")}
        checked={settings.clearNoteAfterChapter}
        onChange={(clearNoteAfterChapter) => onChange({ clearNoteAfterChapter }, { immediate: true })}
      />
    </>
  );
}

function ChapterList(props: {
  chapters: StoryChapter[];
  canGenerate: boolean;
  generation: StoryGenerationApi;
  onSaveSummary(chapterId: string, summary: string): void;
  onDeleteChapter(chapterId: string): void;
  onJump(chapterId: string): void;
}) {
  const { t } = useTranslation();
  const formatNumber = useNumberFormat();
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const rows = useMemo(
    () =>
      props.chapters.map((chapter, index) => ({
        chapter,
        number: index + 1,
        title: chapterTitle(chapter.text),
        words: countWords(chapter.text),
      })),
    [props.chapters],
  );
  if (rows.length === 0) return <p className="sw-empty">{t("tools.noChapters")}</p>;
  const toggle = (chapterId: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(chapterId)) next.add(chapterId);
      return next;
    });
  return (
    <ol className="sw-toc">
      {rows.map(({ chapter, number, title, words }) => {
        const open = expanded.has(chapter.id);
        const detailsId = `sw-toc-${chapter.id}`;
        const displayTitle = title || t("tools.untitledChapter");
        const generating = props.generation.generatingChapterId === chapter.id;
        return (
          <li key={chapter.id} className="sw-toc-item">
            <div className="sw-toc-row">
              <button
                type="button"
                className="sw-toc-jump"
                aria-label={t("tools.jumpTo", { number, title: displayTitle })}
                onClick={() => props.onJump(chapter.id)}
              >
                <span className="sw-toc-number" aria-hidden="true">
                  {number}
                </span>
                <span className="sw-toc-title">{displayTitle}</span>
                {chapter.status === "draft" ? <span className="sw-toc-tag">{t("tools.draft")}</span> : null}
                <span className="sw-toc-words">{formatNumber(words)}</span>
              </button>
              <button
                type="button"
                className="sw-icon-button"
                aria-expanded={open}
                aria-controls={detailsId}
                aria-label={t("tools.details", { number })}
                onClick={() => toggle(chapter.id)}
              >
                <ChevronDown
                  size={17}
                  aria-hidden="true"
                  style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 200ms" }}
                />
              </button>
            </div>
            {open ? (
              <div id={detailsId} className="sw-toc-details">
                <TextField
                  label={t("tools.summary")}
                  value={chapter.summary}
                  placeholder={t("tools.summaryPlaceholder")}
                  multiline
                  rows={4}
                  onChange={(summary) => props.onSaveSummary(chapter.id, summary)}
                />
                <div className="sw-button-row">
                  <button
                    type="button"
                    className="sw-button"
                    disabled={!props.canGenerate || !chapter.text.trim()}
                    onClick={() => void props.generation.summarizeChapter(chapter.id)}
                  >
                    <Sparkles size={15} aria-hidden="true" />
                    {t("tools.summarize")}
                  </button>
                  <button
                    type="button"
                    className="sw-button"
                    data-variant="danger"
                    disabled={generating || props.generation.status !== "idle"}
                    onClick={() => props.onDeleteChapter(chapter.id)}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                    {t("tools.deleteChapter")}
                  </button>
                </div>
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function TimelineEditor(props: { events: TimelineEvent[]; onChange: SettingsChange }) {
  const { t } = useTranslation();
  const { events, onChange } = props;
  const [draft, setDraft] = useState("");
  const replace = (next: TimelineEvent[], immediate = true) => onChange({ timeline: next }, { immediate });
  const move = (index: number, offset: number) => {
    const target = index + offset;
    if (target < 0 || target >= events.length) return;
    const next = [...events];
    [next[index], next[target]] = [next[target], next[index]];
    replace(next);
  };
  const add = () => {
    const text = draft.trim();
    if (!text) return;
    replace([...events, { id: generateClientId(), text, done: false }]);
    setDraft("");
  };
  return (
    <>
      {events.length === 0 ? (
        <p className="sw-empty">{t("tools.timelineEmpty")}</p>
      ) : (
        <ol className="sw-timeline">
          {events.map((event, index) => (
            <li key={event.id} className="sw-event" data-done={event.done ? "true" : "false"}>
              <span className="sw-event-index" aria-hidden="true">
                {index + 1}
              </span>
              <input
                type="checkbox"
                checked={event.done}
                aria-label={t("tools.eventDone", { number: index + 1 })}
                onChange={() =>
                  replace(events.map((item) => (item.id === event.id ? { ...item, done: !item.done } : item)))
                }
              />
              <EventText
                value={event.text}
                label={t("tools.eventText", { number: index + 1 })}
                onChange={(text) =>
                  replace(
                    events.map((item) => (item.id === event.id ? { ...item, text } : item)),
                    false,
                  )
                }
              />
              <button
                type="button"
                className="sw-icon-button"
                aria-label={t("tools.moveUp", { number: index + 1 })}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                <ArrowUp size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="sw-icon-button"
                aria-label={t("tools.moveDown", { number: index + 1 })}
                disabled={index === events.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDown size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="sw-icon-button"
                data-variant="danger"
                aria-label={t("tools.deleteEvent", { number: index + 1 })}
                onClick={() => replace(events.filter((item) => item.id !== event.id))}
              >
                <X size={15} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ol>
      )}
      {events.length < LIMITS.timelineEvents ? (
        <form
          className="sw-event-add"
          onSubmit={(formEvent) => {
            formEvent.preventDefault();
            add();
          }}
        >
          <input
            type="text"
            className="sw-input"
            value={draft}
            maxLength={LIMITS.timelineEventText}
            placeholder={t("tools.newEventPlaceholder")}
            aria-label={t("tools.newEvent")}
            onChange={(changeEvent) => setDraft(changeEvent.target.value)}
          />
          <button type="submit" className="sw-button" disabled={!draft.trim()}>
            <Plus size={15} aria-hidden="true" />
            {t("tools.addEvent")}
          </button>
        </form>
      ) : null}
    </>
  );
}

/**
 * An event's text. Stored events are trimmed and never empty, so clearing the field keeps the old text (delete has its
 * own button) and a trailing space being typed is not an outside change.
 */
function EventText(props: { value: string; label: string; onChange(text: string): void }) {
  const [draft, update] = useDraftText(
    props.value,
    (text) => {
      if (text.trim() && text.trim() !== props.value) props.onChange(text);
    },
    (text) => text.trim().slice(0, LIMITS.timelineEventText),
  );
  return (
    <input
      type="text"
      className="sw-input"
      value={draft}
      maxLength={LIMITS.timelineEventText}
      aria-label={props.label}
      onChange={(event) => update(event.target.value)}
      onBlur={() => {
        if (!draft.trim()) update(props.value);
      }}
    />
  );
}
