// ──────────────────────────────────────────────
// Otome Forge: the dialogue box (the bottom of the stage, frosted). A name plate in the speaker's accent colour; the
// protagonist's thoughts in pale italics; a love interest's rare thought line set apart in his colour; narration
// plain. A line types itself out (whole under reduced motion); the Next button, or a tap, shows it whole first.
// Screen readers get the whole line at once, never the typing. A line too long for the box scrolls with its typing,
// so the newest words stay in view, until the player touches or scrolls the box themselves.
// ──────────────────────────────────────────────
import { forwardRef, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, CloudMoon } from "lucide-react";
import { accentOf } from "../../lib/accent";
import { TYPE_MS, type Voice } from "../../lib/reader-state";

interface DialogueBoxProps {
  voice: Voice;
  /** The protagonist's name, for her plate. */
  protagonist: string;
  text: string;
  /** Changes with every line (and every new read of a beat). */
  lineKey: string;
  /** Show the line whole at once (reduced motion, or a line skipped to). */
  instant: boolean;
  /** Bumped to show the current line whole. */
  finishToken: number;
  onTyped: (lineKey: string) => void;
  /** The aftermath line after Ease off. */
  aftermath?: boolean;
  /** False while a choice waits after this line (the choices take the Next button's place). */
  canAdvance: boolean;
  onAdvance: () => void;
}

export const DialogueBox = forwardRef<HTMLButtonElement, DialogueBoxProps>(function DialogueBox(
  { voice, protagonist, text, lineKey, instant, finishToken, onTyped, aftermath, canAdvance, onAdvance },
  nextRef,
) {
  const { t } = useTranslation();
  const chars = useMemo(() => Array.from(text), [text]);
  const [typing, setTyping] = useState(() => ({ key: lineKey, count: 0, token: finishToken, start: Date.now() }));
  // A new line starts from nothing; Next (a new token) shows the current one whole.
  let count = typing.count;
  if (typing.key !== lineKey || typing.token !== finishToken) {
    count = typing.key !== lineKey ? 0 : chars.length;
    setTyping({ key: lineKey, count, token: finishToken, start: Date.now() });
  }
  const visible = instant ? chars.length : Math.min(count, chars.length);
  const done = visible >= chars.length;

  const lineRef = useRef<HTMLParagraphElement>(null);
  const restRef = useRef<HTMLSpanElement>(null);
  const following = useRef(true);
  // A new line opens at its top and follows its typing again.
  useEffect(() => {
    following.current = true;
    if (lineRef.current) lineRef.current.scrollTop = 0;
  }, [lineKey]);
  // The untyped rest is laid out (hidden), so the box is already as tall as the whole line: scroll so the row being
  // typed sits at the bottom edge.
  useEffect(() => {
    const box = lineRef.current;
    const rest = restRef.current;
    if (!box || !rest || !following.current) return;
    const row = Number.parseFloat(getComputedStyle(box).lineHeight) || 0;
    const target = rest.offsetTop - box.offsetTop + row - box.clientHeight;
    if (target > box.scrollTop) box.scrollTop = target;
  }, [visible]);
  const stopFollowing = () => {
    following.current = false;
  };

  // The pace comes from the clock, not from frames: a slow frame shows more characters at once, never fewer per second.
  useEffect(() => {
    if (done) {
      onTyped(lineKey);
      return;
    }
    const timer = window.setInterval(
      () =>
        setTyping((current) =>
          current.key === lineKey
            ? { ...current, count: Math.max(current.count, Math.floor((Date.now() - current.start) / TYPE_MS)) }
            : current,
        ),
      40,
    );
    return () => window.clearInterval(timer);
  }, [done, lineKey, onTyped]);

  const thought = voice.kind !== "narration" && voice.thought;
  const plate =
    voice.kind === "li"
      ? { name: voice.li.name, accent: accentOf(voice.li) }
      : voice.kind === "protagonist" && !voice.thought
        ? { name: protagonist, accent: null }
        : voice.kind === "other"
          ? { name: voice.name, accent: null }
          : null;
  // What a screen reader hears for a thought, which no plate (or a plain one) introduces.
  const spoken =
    voice.kind === "protagonist" && voice.thought
      ? t("ui.otomeForge.reader.announceThought", { text })
      : voice.kind === "li" && voice.thought
        ? t("ui.otomeForge.reader.announceHisThought", { name: voice.li.name, text })
        : text;
  const style = plate?.accent ? ({ "--of-li-accent": plate.accent } as CSSProperties) : undefined;
  const lineClass = aftermath
    ? "of-line of-line--aftermath"
    : voice.kind === "narration"
      ? "of-line of-line--narration"
      : thought && voice.kind === "li"
        ? "of-line of-line--his-thought"
        : thought
          ? "of-line of-line--thought"
          : "of-line";

  return (
    <div className="of-dialogue of-glass of-glass--strong" data-voice={voice.kind} data-thought={thought} style={style}>
      {plate ? (
        <p className="of-nameplate" data-voice={voice.kind}>
          <span>{plate.name}</span>
          {thought ? (
            <span className="of-nameplate-tag">
              <CloudMoon size={12} strokeWidth={2.2} aria-hidden="true" />
              {t("ui.otomeForge.reader.thinking")}
            </span>
          ) : null}
        </p>
      ) : null}
      <p ref={lineRef} className={lineClass} onTouchStart={stopFollowing} onWheel={stopFollowing}>
        <span className="of-visually-hidden">{spoken}</span>
        <span aria-hidden="true" data-done={done}>
          {done ? text : chars.slice(0, visible).join("")}
          {done ? null : (
            <span ref={restRef} className="of-line-rest">
              {chars.slice(visible).join("")}
            </span>
          )}
        </span>
      </p>
      {canAdvance ? (
        <button
          ref={nextRef}
          type="button"
          className="of-next"
          data-done={done}
          aria-label={done ? t("ui.otomeForge.reader.next") : t("ui.otomeForge.reader.showLine")}
          title={done ? t("ui.otomeForge.reader.next") : t("ui.otomeForge.reader.showLine")}
          onClick={(event) => {
            event.stopPropagation();
            onAdvance();
          }}
        >
          <ChevronDown size={20} strokeWidth={2.2} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
});
