// ──────────────────────────────────────────────
// Otome Forge: the story's soundtrack. Each mood's track, written for this world once it has been generated, or the
// Engine's own music for that mood until then; then each begun chapter's saved theme, named by its chapter, in story
// order. Play holds the row's music while the Album is open (the story's audio controller plays it, as a scene would,
// and a chapter's theme as its reader does: Album.tsx); nothing is generated from here that the settings would not
// generate anyway, and a chapter's theme is never made again. 0.44.0: the house beside a row makes it Home's music (POST
// /runs/:run/audio/settings with `homeCue` and a theme's `homeTrack`); pressed again, Home plays its own.
// ──────────────────────────────────────────────
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { House, Music, Pause, Play } from "lucide-react";
import { useOtomeApi } from "../../api";
import { useOtomeAudio } from "../../hooks/use-otome-audio";
import { patchRun } from "../../hooks/use-run";
import { normalizeOtomeAudio } from "../../shared/audio";
import type { AudioSettings, RunLiView } from "../../shared/api-types";
import type { MusicMood } from "../../shared/faces";
import { chapterTitle } from "../reader/ReaderControls";
import type { SoundtrackEntry } from "../../shared/wardrobe";

const CUE_KEYS: Record<MusicMood, string> = {
  home: "ui.otomeForge.album.cueHome",
  date: "ui.otomeForge.album.cueDate",
  tender: "ui.otomeForge.album.cueTender",
  tense: "ui.otomeForge.album.cueTense",
  angst: "ui.otomeForge.album.cueAngst",
  confession: "ui.otomeForge.album.cueConfession",
};

interface SoundtrackProps {
  runKey: string;
  entries: SoundtrackEntry[];
  /** The row Home plays (AudioSettings.homeCue), "" for Home's own music. */
  homeCue: string;
  /** The cue of the row playing (a mood, or a chapter's `chapter-<key>`), or null. */
  playing: string | null;
  onPlay: (cue: string | null) => void;
  /** The cast, to name a figurine scene's track (chapterTitle). */
  lis: ReadonlyArray<Pick<RunLiView, "id" | "name">>;
}

/** Saves the row Home plays, or none; the story's audio plays it from the saved settings. */
function useHomeChoice(runKey: string) {
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const choose = async (entry: SoundtrackEntry | null) => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const home = { homeCue: entry?.cue ?? "", homeTrack: entry && "chapter" in entry ? entry.track : null };
      const result = await otome.post<{ audio: AudioSettings }>(`/runs/${encodeURIComponent(runKey)}/audio/settings`, {
        audio: home,
      });
      const { homeCue, homeTrack } = normalizeOtomeAudio(result?.audio ?? home);
      patchRun(queryClient, runKey, (view) => ({
        ...view,
        world: { ...view.world, audio: { ...view.world.audio, homeCue, homeTrack } },
      }));
    } catch (failure) {
      setError(otome.errorMessage(failure));
    } finally {
      setSaving(false);
    }
  };
  return { choose, error };
}

export function Soundtrack({ runKey, entries, homeCue, playing, onPlay, lis }: SoundtrackProps) {
  const { t } = useTranslation();
  const audio = useOtomeAudio();
  const home = useHomeChoice(runKey);
  const muted = !!audio && (audio.audioSettings.muted || audio.audioSettings.musicVolume <= 0);
  if (!entries.length) {
    return (
      <p className="of-empty of-glass">
        <Music size={20} strokeWidth={1.8} aria-hidden="true" />
        {t("ui.otomeForge.album.soundtrackEmpty")}
      </p>
    );
  }
  return (
    <div className="of-songs-wrap">
      <ul className="of-songs">
        {entries.map((entry) => {
          const on = playing === entry.cue;
          const onHome = homeCue === entry.cue;
          const name = "chapter" in entry ? chapterTitle(t, entry.chapter, lis) : t(CUE_KEYS[entry.cue]);
          return (
            <li key={entry.cue} className="of-song of-glass" data-playing={on}>
              <button
                type="button"
                className="of-icon-button of-song-play"
                aria-pressed={on}
                aria-label={on ? t("ui.otomeForge.album.pause", { name }) : t("ui.otomeForge.album.play", { name })}
                title={on ? t("ui.otomeForge.album.pause", { name }) : t("ui.otomeForge.album.play", { name })}
                onClick={() => onPlay(on ? null : entry.cue)}
              >
                {on ? (
                  <Pause size={16} strokeWidth={2} aria-hidden="true" />
                ) : (
                  <Play size={16} strokeWidth={2} aria-hidden="true" />
                )}
              </button>
              <span className="of-song-text">
                <span className="of-song-name">{name}</span>
                <span className="of-song-source">
                  {"chapter" in entry
                    ? t("ui.otomeForge.album.trackChapter")
                    : entry.track
                      ? t("ui.otomeForge.album.trackOwn")
                      : t("ui.otomeForge.album.trackStock")}
                </span>
              </span>
              <span className="of-song-end">
                {on ? <span className="of-song-bars" aria-hidden="true" /> : null}
                <button
                  type="button"
                  className="of-icon-button of-song-home"
                  aria-pressed={onHome}
                  aria-label={t("ui.otomeForge.album.playOnHome", { name })}
                  title={t("ui.otomeForge.album.playOnHome", { name })}
                  onClick={() => void home.choose(onHome ? null : entry)}
                >
                  <House size={16} strokeWidth={2} aria-hidden="true" />
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      {home.error ? (
        <p className="of-error" role="alert">
          {home.error}
        </p>
      ) : null}
      <p className="of-hint">
        {muted ? t("ui.otomeForge.album.soundtrackMuted") : t("ui.otomeForge.album.soundtrackHint")}
      </p>
    </div>
  );
}
