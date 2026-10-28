// ──────────────────────────────────────────────
// Otome Forge: Rough day? One of his comfort lines, written in advance (warmth, rest, food, company; never advice), so
// nothing asks the model. Play reads it aloud in his voice (M2b's voice picking) with no cache key: comfort lines stand
// in for the care note on a tracked day (M6), so their audio never lands in the Engine's audio cache (plan §1.9).
// ──────────────────────────────────────────────
import { useId, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Play, Shuffle, Square } from "lucide-react";
import { Avatar } from "../../components/Avatar";
import { Dialog } from "../../components/Dialog";
import { accentOf } from "../../lib/accent";
import { comfortPool, FALLBACK_COMFORT_KEYS, pickLine } from "../../lib/tap-mood";
import type { LinesView, RunLiView, Segment } from "../../shared/api-types";
import { useLineVoice } from "./NoteCard";

interface RoughDaySheetProps {
  li: RunLiView;
  lines: LinesView | null;
  onClose: () => void;
}

export function RoughDaySheet({ li, lines, onClose }: RoughDaySheetProps) {
  const { t } = useTranslation();
  const voice = useLineVoice();
  const own = comfortPool(lines);
  const pool = own.length ? own : FALLBACK_COMFORT_KEYS.map((key) => t(key));
  const [line, setLine] = useState(() => pickLine(pool, null) ?? "");
  const voiceId = `comfort:${li.id}`;
  const said: Segment = { speaker: li.name, text: line };
  const playing = voice.active === voiceId;
  const accent = accentOf(li);
  // The line describes the dialog, so it is read as the dialog opens; Another changes it in its live region.
  const lineId = useId();
  return (
    <Dialog
      title={t("ui.otomeForge.home.roughDayTitle")}
      describedBy={lineId}
      onClose={onClose}
      actions={
        <>
          {voice.can(said) ? (
            <button
              type="button"
              className="of-button of-button--quiet of-button--small of-glass"
              aria-pressed={playing}
              aria-label={t("ui.otomeForge.home.comfortPlayLabel", { name: li.name })}
              onClick={() => voice.toggle(voiceId, said, { cache: false })}
            >
              {playing ? (
                <Square size={14} strokeWidth={2.4} aria-hidden="true" />
              ) : (
                <Play size={14} strokeWidth={2.4} aria-hidden="true" />
              )}
              {playing ? t("ui.otomeForge.home.stop") : t("ui.otomeForge.home.play")}
            </button>
          ) : null}
          {pool.length > 1 ? (
            <button
              type="button"
              className="of-button of-button--quiet of-button--small of-glass"
              onClick={() => {
                if (playing) voice.stop();
                setLine((current) => pickLine(pool, current) ?? current);
              }}
            >
              <Shuffle size={14} strokeWidth={2.2} aria-hidden="true" />
              {t("ui.otomeForge.home.roughDayAnother")}
            </button>
          ) : null}
          <button type="button" className="of-button of-button--primary of-button--small" onClick={onClose}>
            {t("ui.otomeForge.home.close")}
          </button>
        </>
      }
    >
      <figure className="of-comfort" style={{ "--of-li-accent": accent } as CSSProperties}>
        <Avatar name={li.name} url={li.portrait} accent={accent} size={56} />
        <blockquote id={lineId} className="of-comfort-line" aria-live="polite">
          {t("ui.otomeForge.home.noteText", { text: line })}
        </blockquote>
        <figcaption className="of-comfort-by">{t("ui.otomeForge.home.comfortBy", { name: li.name })}</figcaption>
      </figure>
      {voice.failed === voiceId ? (
        <p className="of-hint" role="status">
          {t("ui.otomeForge.home.voiceFailed")}
        </p>
      ) : null}
    </Dialog>
  );
}
