// ──────────────────────────────────────────────
// Otome Forge: his message of the day, handwritten on a slip of paper. It is written once per local day on the first
// Home visit (the server keeps it after that); Play reads it in a voice, Reply opens his thread with the note quoted.
// The note can be folded away so his face shows.
// ──────────────────────────────────────────────
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp, Feather, MessageCircleHeart, Play, RotateCcw, Square } from "lucide-react";
import { ttsService, ttsUnavailableReason, type TTSState } from "../../../../lib/tts-service";
import { initialsOf } from "../../lib/accent";
import type { NoteView } from "../../shared/api-types";

interface SpeakOptions {
  speaker: string;
  /** Only for lines that may sit in the Engine's audio cache; a comfort line has none (plan §1.9). */
  cacheKey?: string;
}

/**
 * Plays a line through the Engine's voice service and follows whether it is the one playing. A line this screen
 * started stops when the screen leaves.
 */
export function useLineVoice() {
  const [active, setActive] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const started = useRef(new Set<string>());
  useEffect(() => {
    const follow = (state: TTSState, id: string | null) =>
      setActive(state === "loading" || state === "playing" ? id : null);
    follow(ttsService.getState(), ttsService.getActiveId());
    const unsubscribe = ttsService.subscribe(follow);
    const mine = started.current;
    return () => {
      unsubscribe();
      if (mine.has(ttsService.getActiveId() ?? "")) ttsService.stop();
    };
  }, []);
  const toggle = (id: string, text: string, options: SpeakOptions) => {
    if (active === id) {
      ttsService.stop();
      return;
    }
    setFailed(null);
    started.current.add(id);
    // ponytail: the Engine's default voice reads every Home line. Ceiling: not his assigned or pooled voice. Upgrade
    // path: route through M2b's use-otome-audio (forgeSpeakerVoice) once it lands.
    ttsService.speak(text, id, { ...options, throwOnError: true }).catch((error: unknown) => {
      if (error instanceof Error && error.name === "AbortError") return;
      console.warn("Otome Forge could not play a line", error);
      setFailed(id);
    });
  };
  return { available: ttsUnavailableReason === null, active, failed, toggle };
}

export type NoteStatus =
  { kind: "ready"; note: NoteView } | { kind: "writing" } | { kind: "failed"; message: string; onRetry: () => void };

interface NoteCardProps {
  runKey: string;
  liId: string;
  name: string;
  accent: string;
  status: NoteStatus;
  onReply: (quote: string) => void;
}

export function NoteCard({ runKey, liId, name, accent, status, onReply }: NoteCardProps) {
  const { t } = useTranslation();
  const voice = useLineVoice();
  const [folded, setFolded] = useState(false);
  const titleId = useId();
  const bodyId = useId();
  const note = status.kind === "ready" ? status.note : null;
  const voiceId = note ? `otome-forge:${runKey}:note:${liId}:${note.at}` : "";
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
              {voice.available ? (
                <button
                  type="button"
                  className="of-note-button"
                  aria-pressed={playing}
                  aria-label={t("ui.otomeForge.home.notePlayLabel", { name })}
                  onClick={() => voice.toggle(voiceId, status.note.text, { speaker: name, cacheKey: voiceId })}
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
