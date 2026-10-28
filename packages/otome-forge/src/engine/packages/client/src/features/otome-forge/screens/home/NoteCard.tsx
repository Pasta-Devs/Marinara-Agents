// ──────────────────────────────────────────────
// Otome Forge: his message of the day, handwritten on a slip of paper. It is written once per local day on the first
// Home visit (the server keeps it after that); Play reads it in his voice, Reply opens his thread with the note quoted.
// The note can be folded away so his face shows.
// ──────────────────────────────────────────────
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp, Feather, MessageCircleHeart, Play, RotateCcw, Square } from "lucide-react";
import { useAudioSnapshot, useOtomeAudio } from "../../hooks/use-otome-audio";
import { initialsOf } from "../../lib/accent";
import type { NoteView, Segment } from "../../shared/api-types";

/**
 * Home's voice: a line voiced through the story's audio (M2b, hooks/use-otome-audio.ts), with the kit's voice picking
 * over the Engine's voice settings (his card's own voice, else the pool for his voice). `can` is false while Settings →
 * Audio voices nobody (or the Engine has no voice service), and then nothing is offered or played. A line this screen
 * started stops when the screen leaves. `cache: false` keeps a line out of the Engine's audio cache (a comfort line,
 * plan §1.9); every other line is cached under its ref.
 */
export function useLineVoice() {
  const audio = useOtomeAudio();
  const { speaking } = useAudioSnapshot();
  const [failed, setFailed] = useState<string | null>(null);
  const started = useRef(new Set<string>());
  useEffect(() => {
    const mine = started.current;
    return () => {
      if (audio && mine.has(audio.getSnapshot().speaking ?? "")) audio.stopVoice();
    };
  }, [audio]);
  const can = (segment: Segment) => !!audio?.wouldSpeak(segment);
  const stop = () => audio?.stopVoice();
  const play = (ref: string, segment: Segment, options?: { cache?: boolean }) => {
    if (!audio) return;
    setFailed(null);
    started.current.add(ref);
    void audio.speak(segment, ref, options).then((outcome) => {
      if (outcome === "failed") setFailed(ref);
    });
  };
  const toggle = (ref: string, segment: Segment, options?: { cache?: boolean }) =>
    speaking === ref ? stop() : play(ref, segment, options);
  return { can, active: speaking, failed, play, stop, toggle };
}

export type NoteStatus =
  { kind: "ready"; note: NoteView } | { kind: "writing" } | { kind: "failed"; message: string; onRetry: () => void };

interface NoteCardProps {
  liId: string;
  name: string;
  accent: string;
  status: NoteStatus;
  onReply: (quote: string) => void;
}

export function NoteCard({ liId, name, accent, status, onReply }: NoteCardProps) {
  const { t } = useTranslation();
  const voice = useLineVoice();
  const [folded, setFolded] = useState(false);
  const titleId = useId();
  const bodyId = useId();
  const note = status.kind === "ready" ? status.note : null;
  // Cached under the note's own ref: the day's note is read again with no new voice call.
  const voiceId = note ? `note:${liId}:${note.at}` : "";
  const line: Segment | null = note ? { speaker: name, text: note.text } : null;
  const playing = !!note && voice.active === voiceId;
  const foldLabel = folded ? t("ui.otomeForge.home.noteUnfold", { name }) : t("ui.otomeForge.home.noteFold");

  return (
    <article
      className="of-note"
      data-folded={folded}
      data-state={status.kind}
      aria-labelledby={titleId}
      style={{ "--of-li-accent": accent } as CSSProperties}
    >
      <div className="of-note-head">
        <h2 id={titleId} className="of-note-from">
          <MessageCircleHeart size={14} strokeWidth={2} aria-hidden="true" />
          {t("ui.otomeForge.home.noteFrom", { name })}
        </h2>
        <button
          type="button"
          className="of-note-fold"
          aria-expanded={!folded}
          aria-controls={bodyId}
          aria-label={foldLabel}
          title={foldLabel}
          onClick={() => setFolded((value) => !value)}
        >
          {folded ? (
            <ChevronDown size={16} strokeWidth={2.2} aria-hidden="true" />
          ) : (
            <ChevronUp size={16} strokeWidth={2.2} aria-hidden="true" />
          )}
        </button>
      </div>
      <div id={bodyId} className="of-note-body" hidden={folded}>
        {status.kind === "writing" ? (
          <p className="of-note-quiet" role="status">
            <Feather className="of-note-quill" size={16} strokeWidth={1.8} aria-hidden="true" />
            {t("ui.otomeForge.home.noteWriting", { name })}
          </p>
        ) : status.kind === "failed" ? (
          <div className="of-note-failed" role="alert">
            <p className="of-note-quiet">{t("ui.otomeForge.home.noteFailed", { name })}</p>
            <p className="of-hint">{status.message}</p>
            <button type="button" className="of-note-button" onClick={status.onRetry}>
              <RotateCcw size={14} strokeWidth={2.2} aria-hidden="true" />
              {t("ui.otomeForge.common.retry")}
            </button>
          </div>
        ) : (
          <>
            <p className="of-note-text">{t("ui.otomeForge.home.noteText", { text: status.note.text })}</p>
            <div className="of-note-foot">
              {line && voice.can(line) ? (
                <button
                  type="button"
                  className="of-note-button"
                  aria-pressed={playing}
                  aria-label={t("ui.otomeForge.home.notePlayLabel", { name })}
                  onClick={() => voice.toggle(voiceId, line)}
                >
                  {playing ? (
                    <Square size={13} strokeWidth={2.4} aria-hidden="true" />
                  ) : (
                    <Play size={13} strokeWidth={2.4} aria-hidden="true" />
                  )}
                  {playing ? t("ui.otomeForge.home.stop") : t("ui.otomeForge.home.play")}
                </button>
              ) : (
                <span />
              )}
              <span className="of-note-sign" aria-hidden="true">
                ~ {initialsOf(name).slice(0, 1)}.
              </span>
              <button type="button" className="of-note-button" onClick={() => onReply(status.note.text)}>
                {t("ui.otomeForge.home.noteReply")}
                <MessageCircleHeart size={14} strokeWidth={2.2} aria-hidden="true" />
              </button>
            </div>
            {voice.failed === voiceId ? (
              <p className="of-note-voice-error" role="status">
                {t("ui.otomeForge.home.voiceFailed")}
              </p>
            ) : null}
          </>
        )}
      </div>
    </article>
  );
}
