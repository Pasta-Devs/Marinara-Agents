// ──────────────────────────────────────────────
// Otome Forge: favourite lines, starred in the reader's backlog. A love interest's line plays again in their voice
// from the clip kept when it was first voiced (the same cache key as the reader's).
// ──────────────────────────────────────────────
import { useEffect, useRef, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Quote, Square, Volume2 } from "lucide-react";
import { useAudioSnapshot, useOtomeAudio } from "../../hooks/use-otome-audio";
import { accentOf } from "../../lib/accent";
import type { Favorite, RunView } from "../../shared/api-types";
import { useFormatAt } from "./CgViewer";

export function Favorites({ view, favorites }: { view: RunView; favorites: Favorite[] }) {
  const { t } = useTranslation();
  const formatAt = useFormatAt();
  const audio = useOtomeAudio();
  const { speaking } = useAudioSnapshot();
  // The line this tab started: leaving the tab stops it, but never another screen's voice.
  const started = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (started.current && audio?.getSnapshot().speaking === started.current) audio.stopVoice();
    },
    [audio],
  );
  if (!favorites.length) {
    return (
      <p className="of-empty of-glass">
        <Quote size={20} strokeWidth={1.8} aria-hidden="true" />
        {t("ui.otomeForge.album.favoritesEmpty")}
      </p>
    );
  }
  return (
    <ul className="of-favorites">
      {[...favorites]
        .sort((a, b) => b.at.localeCompare(a.at))
        .map((favorite) => {
          const person = view.lis.find((item) => item.id === favorite.li) ?? null;
          const segment = person ? { speaker: person.name, text: favorite.text } : null;
          const voiced = !!segment && !!audio?.wouldSpeak(segment);
          const playing = speaking === favorite.ref;
          return (
            <li
              key={favorite.ref}
              className="of-favorite of-glass"
              style={person ? ({ "--of-li-accent": accentOf(person) } as CSSProperties) : undefined}
            >
              <blockquote className="of-favorite-text">“{favorite.text}”</blockquote>
              <p className="of-favorite-meta">
                {person ? <span className="of-favorite-who">{person.name}</span> : null}
                <time dateTime={favorite.at}>{formatAt(favorite.at)}</time>
                {voiced && segment ? (
                  <button
                    type="button"
                    className="of-icon-button of-glass of-favorite-play"
                    aria-label={
                      playing
                        ? t("ui.otomeForge.audio.stopVoice")
                        : t("ui.otomeForge.audio.playVoice", { name: segment.speaker })
                    }
                    title={
                      playing
                        ? t("ui.otomeForge.audio.stopVoice")
                        : t("ui.otomeForge.audio.playVoice", { name: segment.speaker })
                    }
                    onClick={() => {
                      if (playing) audio?.stopVoice();
                      else {
                        started.current = favorite.ref;
                        void audio?.speak(segment, favorite.ref);
                      }
                    }}
                  >
                    {playing ? (
                      <Square size={14} strokeWidth={2} aria-hidden="true" />
                    ) : (
                      <Volume2 size={15} strokeWidth={2} aria-hidden="true" />
                    )}
                  </button>
                ) : null}
              </p>
            </li>
          );
        })}
    </ul>
  );
}
