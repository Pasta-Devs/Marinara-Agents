// ──────────────────────────────────────────────
// Otome Forge: the story's soundtrack. Each mood's track, written for this world once it has been generated, or the
// Engine's own music for that mood until then; then each begun chapter's saved theme, named by its chapter, in story
// order. Play holds the row's music while the Album is open (the story's audio controller plays it, as a scene would,
// and a chapter's theme as its reader does: Album.tsx); nothing is generated from here that the settings would not
// generate anyway, and a chapter's theme is never made again.
// ──────────────────────────────────────────────
import { useTranslation } from "react-i18next";
import { Music, Pause, Play } from "lucide-react";
import { useOtomeAudio } from "../../hooks/use-otome-audio";
import type { MusicMood } from "../../shared/faces";
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
  entries: SoundtrackEntry[];
  /** The cue of the row playing (a mood, or a chapter's `chapter-<key>`), or null. */
  playing: string | null;
  onPlay: (cue: string | null) => void;
}

export function Soundtrack({ entries, playing, onPlay }: SoundtrackProps) {
  const { t } = useTranslation();
  const audio = useOtomeAudio();
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
          const name = "chapter" in entry ? entry.chapter.title : t(CUE_KEYS[entry.cue]);
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
              {on ? <span className="of-song-bars" aria-hidden="true" /> : null}
            </li>
          );
        })}
      </ul>
      <p className="of-hint">
        {muted ? t("ui.otomeForge.album.soundtrackMuted") : t("ui.otomeForge.album.soundtrackHint")}
      </p>
    </div>
  );
}
