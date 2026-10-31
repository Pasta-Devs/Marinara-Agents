// ──────────────────────────────────────────────
// Otome Forge Settings → Audio: voiced dialogue (and everyone else), generated music on an audio connection, the
// volumes and Mute. Saved on the story (POST /runs/:run/audio/settings); the volumes and Mute apply while they move, so
// the player hears the level before saving. Voices, music and its connection change only once saved, so nothing is
// generated (or paid for) on a setting the player never saved. Voices themselves are the Engine's: assigned in its TTS
// settings.
// ──────────────────────────────────────────────
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Music, Volume2 } from "lucide-react";
import { normalizeOtomeAudio } from "../../shared/audio";
import { useOtomeApi } from "../../api";
import { RetryNotice } from "../../components/RetryNotice";
import { useConnections, useMusicFolders } from "../../hooks/use-engine-resources";
import { useOtomeAudio } from "../../hooks/use-otome-audio";
import { patchRun } from "../../hooks/use-run";
import { useOtomeProps } from "../../props";
import type { AudioSettings, RunView } from "../../shared/api-types";
import { MUSIC_MOODS } from "../../shared/faces";
import { ConnectionSelect, Section, Switch } from "../setup/parts";
import { NoStory, SaveBar, storedKey } from "./ContentSettings";

/** What this tab edits; the rest of the kit's audio shape is kept as it is. */
type AudioForm = Pick<
  AudioSettings,
  | "tts"
  | "otherVoices"
  | "generate"
  | "chapterThemes"
  | "musicFolder"
  | "audioConnectionId"
  | "muted"
  | "musicVolume"
  | "dialogueVolume"
>;

const toForm = (audio: AudioSettings): AudioForm => ({
  tts: audio.tts,
  otherVoices: audio.otherVoices,
  generate: audio.generate,
  chapterThemes: audio.chapterThemes,
  musicFolder: audio.musicFolder,
  audioConnectionId: audio.audioConnectionId,
  muted: audio.muted,
  musicVolume: audio.musicVolume,
  dialogueVolume: audio.dialogueVolume,
});

const storedAudio = (run: RunView) => normalizeOtomeAudio(run.world.audio);

interface VolumeProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

/** A 0–100% slider over a 0–1 volume. */
function Volume({ label, value, onChange, disabled }: VolumeProps) {
  const { t } = useTranslation();
  const id = useId();
  const percent = Math.round(value * 100);
  return (
    <div className="of-field of-volume">
      <div className="of-volume-head">
        <label className="of-label" htmlFor={id}>
          {label}
        </label>
        <output className="of-volume-value" htmlFor={id}>
          {t("ui.otomeForge.audio.percent", { value: percent })}
        </output>
      </div>
      <input
        id={id}
        className="of-range"
        type="range"
        min={0}
        max={100}
        step={5}
        value={percent}
        disabled={disabled}
        aria-valuetext={t("ui.otomeForge.audio.percent", { value: percent })}
        style={{ "--of-range-fill": `${percent}%` } as CSSProperties}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
      />
    </div>
  );
}

/** POST /runs/:run/audio/settings: a save changes the stored settings, which start the form again from them. */
function useSaveAudio(runKey: string | null) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ error: boolean; text: string } | null>(null);
  const save = async (audio: AudioSettings) => {
    if (!runKey || busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const result = await otome.post<{ audio: AudioSettings }>(`/runs/${encodeURIComponent(runKey)}/audio/settings`, {
        audio,
      });
      const stored = normalizeOtomeAudio(result?.audio ?? audio);
      patchRun(queryClient, runKey, (view) => ({
        ...view,
        world: { ...view.world, audio: { ...view.world.audio, ...stored } },
      }));
      setStatus({ error: false, text: t("ui.otomeForge.audio.saved") });
    } catch (failure) {
      setStatus({ error: true, text: otome.errorMessage(failure) });
    } finally {
      setBusy(false);
    }
  };
  return { save, busy, status };
}

function MusicFolderSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useTranslation();
  const id = useId();
  const folders = useMusicFolders();
  const absent = !!value && !folders.folders.includes(value);
  const unavailable = absent && !folders.isLoading && !folders.isError;
  return (
    <>
      {folders.isLoading ? (
        <p className="of-hint" role="status">
          {t("ui.otomeForge.audio.musicFolderLoading")}
        </p>
      ) : folders.isError ? (
        <RetryNotice
          message={t("ui.otomeForge.audio.musicFolderFailed")}
          onRetry={() => void folders.refetch()}
          retrying={folders.retrying}
        />
      ) : null}
      <div className="of-field">
        <label className="of-label" htmlFor={id}>
          {t("ui.otomeForge.audio.musicFolder")}
        </label>
        <select
          id={id}
          className="of-input of-select"
          value={value}
          disabled={folders.isLoading || folders.isError}
          aria-describedby={`${id}-hint`}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">{t("ui.otomeForge.audio.musicFolderDefault")}</option>
          {absent ? <option value={value}>{value}</option> : null}
          {folders.folders.map((folder) => (
            <option key={folder} value={folder}>
              {folder}
            </option>
          ))}
        </select>
        <p id={`${id}-hint`} className="of-hint">
          {t(unavailable ? "ui.otomeForge.audio.musicFolderUnavailable" : "ui.otomeForge.audio.musicFolderHint")}
        </p>
      </div>
      {!folders.isLoading && !folders.isError && folders.folders.length === 0 ? (
        <p className="of-hint">{t("ui.otomeForge.audio.musicFolderEmpty")}</p>
      ) : null}
    </>
  );
}

function StoryAudio({ run, saving }: { run: RunView; saving: ReturnType<typeof useSaveAudio> }) {
  const { t } = useTranslation();
  const audio = useOtomeAudio();
  const { locale } = useOtomeProps().localization;
  const connections = useConnections();
  const saved = storedAudio(run);
  const savedRef = useRef(saved);
  savedRef.current = saved;
  const [form, setForm] = useState(() => toForm(saved));
  // A save (or another story) starts the form again from the stored settings, in place: the focused Save button and
  // the status that says "Saved." stay where they are.
  const stored = storedKey(run.runKey, toForm(saved));
  const [formFor, setFormFor] = useState(stored);
  if (formFor !== stored) {
    setFormFor(stored);
    setForm(toForm(saved));
  }
  const changed = JSON.stringify(form) !== JSON.stringify(toForm(saved));
  const set = (change: Partial<AudioForm>) => setForm((current) => ({ ...current, ...change }));

  // Only the volumes and Mute apply while they change, as a preview beside the saved settings (which alone decide
  // whether music is generated); leaving without saving puts back what is saved.
  const { muted, musicVolume, dialogueVolume } = form;
  useEffect(() => {
    audio?.configure({ ...savedRef.current, muted, musicVolume, dialogueVolume }, savedRef.current);
  }, [audio, muted, musicVolume, dialogueVolume, stored]);
  useEffect(
    () => () => {
      audio?.configure(savedRef.current);
    },
    // On leaving only.
    [audio],
  );

  const number = new Intl.NumberFormat(locale);
  return (
    <>
      <Section title={t("ui.otomeForge.audio.voicesTitle")} hint={t("ui.otomeForge.audio.voicesHint")}>
        <Switch
          label={t("ui.otomeForge.audio.tts")}
          hint={
            <>
              {t("ui.otomeForge.audio.ttsHint")}
              <span className="of-cost">
                <Volume2 size={14} strokeWidth={2} aria-hidden="true" />
                <span>
                  {t("ui.otomeForge.audio.ttsCost")}
                  <span className="of-cost-note"> · {t("ui.otomeForge.audio.ttsCostNote")}</span>
                </span>
              </span>
            </>
          }
          checked={form.tts}
          onChange={(tts) => set({ tts })}
        />
        <Switch
          label={t("ui.otomeForge.audio.otherVoices")}
          hint={t("ui.otomeForge.audio.otherVoicesHint")}
          checked={form.otherVoices}
          disabled={!form.tts}
          onChange={(otherVoices) => set({ otherVoices })}
        />
      </Section>
      <Section title={t("ui.otomeForge.audio.musicTitle")} hint={t("ui.otomeForge.audio.musicHint")}>
        <Switch
          label={t("ui.otomeForge.audio.generate")}
          hint={
            <>
              {t("ui.otomeForge.audio.generateHint")}
              <span className="of-cost">
                <Music size={14} strokeWidth={2} aria-hidden="true" />
                <span>
                  {t("ui.otomeForge.audio.generateCost", {
                    count: MUSIC_MOODS.length,
                    shown: number.format(MUSIC_MOODS.length),
                  })}
                  <span className="of-cost-note"> · {t("ui.otomeForge.audio.generateCostNote")}</span>
                </span>
              </span>
            </>
          }
          checked={form.generate}
          onChange={(generate) => set({ generate })}
        />
        {form.generate ? (
          <Switch
            label={t("ui.otomeForge.audio.chapterThemes")}
            hint={t("ui.otomeForge.audio.chapterThemesHint")}
            checked={form.chapterThemes}
            onChange={(chapterThemes) => set({ chapterThemes })}
          />
        ) : null}
        {form.generate ? (
          connections.isLoading ? (
            <p className="of-hint" role="status">
              {t("ui.otomeForge.setup.loadingConnections")}
            </p>
          ) : connections.isError && connections.music.length === 0 ? (
            // A failed list is not an empty one: the player is not told to add a connection they may already have.
            <RetryNotice
              message={t("ui.otomeForge.setup.connectionsFailed")}
              onRetry={() => void connections.refetch()}
              retrying={connections.retrying}
            />
          ) : (
            <ConnectionSelect
              label={t("ui.otomeForge.audio.connection")}
              hint={
                connections.music.length
                  ? t("ui.otomeForge.audio.connectionHint")
                  : t("ui.otomeForge.audio.noConnections")
              }
              value={form.audioConnectionId}
              connections={connections.music}
              emptyLabel={t("ui.otomeForge.audio.connectionDefault")}
              onChange={(audioConnectionId) => set({ audioConnectionId })}
            />
          )
        ) : null}
        {!form.generate ? (
          <MusicFolderSelect value={form.musicFolder} onChange={(musicFolder) => set({ musicFolder })} />
        ) : null}
      </Section>
      <Section title={t("ui.otomeForge.audio.levelsTitle")}>
        <Switch
          label={t("ui.otomeForge.audio.muted")}
          hint={t("ui.otomeForge.audio.mutedHint")}
          checked={form.muted}
          onChange={(muted) => set({ muted })}
        />
        <Volume
          label={t("ui.otomeForge.audio.musicVolume")}
          value={form.musicVolume}
          disabled={form.muted}
          onChange={(musicVolume) => set({ musicVolume })}
        />
        <Volume
          label={t("ui.otomeForge.audio.dialogueVolume")}
          value={form.dialogueVolume}
          disabled={form.muted || !form.tts}
          onChange={(dialogueVolume) => set({ dialogueVolume })}
        />
        <p className="of-hint">
          <Volume2 size={13} strokeWidth={2} aria-hidden="true" /> {t("ui.otomeForge.audio.withoutAudio")}
        </p>
      </Section>
      <SaveBar
        changed={changed}
        busy={saving.busy}
        status={saving.status}
        onSave={() => void saving.save({ ...saved, ...form })}
      />
    </>
  );
}

export function AudioSettings({ run }: { run: RunView | null }) {
  const saving = useSaveAudio(run?.runKey ?? null);
  return <div className="of-step-body">{run ? <StoryAudio run={run} saving={saving} /> : <NoStory />}</div>;
}
