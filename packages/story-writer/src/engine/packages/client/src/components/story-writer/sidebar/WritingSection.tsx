// ──────────────────────────────────────────────
// Story Writer sidebar: the model, chapter and story length, and the prompt
// ──────────────────────────────────────────────
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink, RotateCcw } from "lucide-react";
import { resolveDefaultConnectionId, type ConnectionOption } from "../../../hooks/use-engine-resources";
import { DEFAULT_SYSTEM_PROMPT, LIMITS, type StorySettings } from "../../../lib/story-writer/model";
import { NumberField, TextField, Toggle, useNumberFormat } from "./fields";

const CHAPTER_PRESETS = [
  { key: "presetShort", words: 1000 },
  { key: "presetMedium", words: 2000 },
  { key: "presetLong", words: 4000 },
] as const;

export function WritingSection(props: {
  settings: StorySettings;
  onChange(patch: Partial<StorySettings>, options?: { immediate?: boolean }): void;
  connections: ConnectionOption[];
  connectionsLoading: boolean;
  onEditConnection(connectionId: string): void;
  onManageConnections(): void;
  streaming: boolean;
  onStreamingChange(streaming: boolean): void;
  totalWords: number;
}) {
  const { t } = useTranslation();
  const formatNumber = useNumberFormat();
  const selectId = useId();
  const { settings, onChange, connections } = props;
  const connectionId = resolveDefaultConnectionId(connections, settings.connectionId);
  const target = settings.targetWords;
  const percent = target ? Math.min(100, Math.round((props.totalWords / target) * 100)) : 0;
  return (
    <>
      <div className="sw-field">
        <label className="sw-label" htmlFor={selectId}>
          {t("writing.connection")}
        </label>
        {props.connectionsLoading && connections.length === 0 ? (
          <p className="sw-empty">{t("writing.loadingConnections")}</p>
        ) : connections.length === 0 ? (
          <>
            <p className="sw-hint">{t("writing.noConnections")}</p>
            <div className="sw-button-row">
              <button type="button" className="sw-button" onClick={props.onManageConnections}>
                <ExternalLink size={15} aria-hidden="true" />
                {t("writing.manageConnections")}
              </button>
            </div>
          </>
        ) : (
          <>
            <select
              id={selectId}
              className="sw-select"
              value={connectionId ?? ""}
              aria-describedby={`${selectId}-hint`}
              onChange={(event) => onChange({ connectionId: event.target.value || null }, { immediate: true })}
            >
              {connectionId ? null : <option value="">—</option>}
              {connections.map((connection) => (
                <option key={connection.id} value={connection.id}>
                  {`${connection.isDefault ? t("writing.connectionDefault", { name: connection.name }) : connection.name}${
                    connection.model ? ` · ${connection.model}` : ""
                  }`}
                </option>
              ))}
            </select>
            <div className="sw-button-row">
              <button
                type="button"
                className="sw-button"
                disabled={!connectionId}
                onClick={() => connectionId && props.onEditConnection(connectionId)}
              >
                <ExternalLink size={15} aria-hidden="true" />
                {t("writing.editConnection")}
              </button>
            </div>
            <p id={`${selectId}-hint`} className="sw-hint">
              {t("writing.connectionHint")}
            </p>
          </>
        )}
      </div>

      <NumberField
        label={t("writing.chapterLength")}
        extra={<span className="sw-label-extra">{t("writing.wordsUnit")}</span>}
        value={settings.chapterWords}
        min={LIMITS.chapterWords.min}
        max={LIMITS.chapterWords.max}
        step={100}
        onCommit={(chapterWords) => chapterWords !== null && onChange({ chapterWords })}
      >
        <div className="sw-button-row" role="group" aria-label={t("writing.presetsLabel")}>
          {CHAPTER_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              className="sw-chip"
              aria-pressed={settings.chapterWords === preset.words}
              onClick={() => onChange({ chapterWords: preset.words }, { immediate: true })}
            >
              {t("writing.preset", { name: t(`writing.${preset.key}`), words: formatNumber(preset.words) })}
            </button>
          ))}
        </div>
      </NumberField>

      <NumberField
        label={t("writing.targetLength")}
        extra={<span className="sw-label-extra">{t("writing.wordsUnit")}</span>}
        value={target}
        optional
        min={LIMITS.targetWords.min}
        max={LIMITS.targetWords.max}
        step={1000}
        placeholder={t("writing.targetPlaceholder")}
        hint={t("writing.targetHint")}
        onCommit={(targetWords) => onChange({ targetWords })}
      >
        {target ? (
          <>
            <div
              className="sw-progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              aria-label={t("writing.targetLength")}
            >
              <span style={{ width: `${percent}%` }} />
            </div>
            <p className="sw-hint">
              {t("writing.targetProgress", {
                written: formatNumber(props.totalWords),
                target: formatNumber(target),
                percent,
              })}
            </p>
          </>
        ) : null}
      </NumberField>

      <Toggle
        label={t("writing.chapterTitles")}
        hint={t("writing.chapterTitlesHint")}
        checked={settings.chapterTitles}
        onChange={(chapterTitles) => onChange({ chapterTitles }, { immediate: true })}
      />

      <TextField
        label={t("writing.continueMessage")}
        hint={t("writing.continueMessageHint")}
        value={settings.continueMessage}
        multiline
        rows={2}
        onChange={(continueMessage) => onChange({ continueMessage })}
      />

      <TextField
        label={t("writing.prompt")}
        hint={t("writing.promptHint")}
        value={settings.systemPrompt}
        multiline
        rows={5}
        extra={
          <button
            type="button"
            className="sw-button"
            disabled={settings.systemPrompt === DEFAULT_SYSTEM_PROMPT}
            onClick={() => onChange({ systemPrompt: DEFAULT_SYSTEM_PROMPT }, { immediate: true })}
          >
            <RotateCcw size={14} aria-hidden="true" />
            {t("writing.resetPrompt")}
          </button>
        }
        onChange={(systemPrompt) => onChange({ systemPrompt })}
      />

      <TextField
        label={t("writing.banned")}
        hint={t("writing.bannedHint")}
        placeholder={t("writing.bannedPlaceholder")}
        value={settings.bannedPhrases}
        multiline
        rows={2}
        onChange={(bannedPhrases) => onChange({ bannedPhrases })}
      />

      <Toggle
        label={t("writing.streaming")}
        hint={t("writing.streamingHint")}
        checked={props.streaming}
        onChange={props.onStreamingChange}
      />
    </>
  );
}
