// ──────────────────────────────────────────────
// Otome Forge: the dialogue box (the bottom of the stage, frosted). A name plate in the speaker's accent colour; the
// protagonist's thoughts in pale italics; a love interest's rare thought line set apart in his colour; narration
// plain. A line types itself out (whole under reduced motion); the Next button, or a tap, shows it whole first. While
// a story CG's pan hides the box (`paused`), its line waits, and types from the top once the box is back (#2051).
// Screen readers get the whole line at once, never the typing. A line too long for the box follows its typing, so
// the newest words stay in view and a line typed out ends on its last row; once the line is whole, the box scrolls
// from there.
// ──────────────────────────────────────────────
import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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
  /** The box is hidden behind a story CG's pan: the line waits, and starts typing when this turns false. */
  paused?: boolean;
  onTyped: (lineKey: string) => void;
  /** The aftermath line after Ease off. */
  aftermath?: boolean;
  /** False while a choice waits after this line (the choices take the Next button's place). */
  canAdvance: boolean;
  onAdvance: () => void;
}

export const DialogueBox = forwardRef<HTMLButtonElement, DialogueBoxProps>(function DialogueBox(
  {
    voice,
    protagonist,
    text,
    lineKey,
    instant,
    finishToken,
    paused = false,
    onTyped,
    aftermath,
    canAdvance,
    onAdvance,
  },
  nextRef,
) {
  const { t } = useTranslation();
  const chars = useMemo(() => Array.from(text), [text]);
  const [typing, setTyping] = useState(() => ({
    key: lineKey,
    count: 0,
    token: finishToken,
    start: Date.now(),
    paused,
    whole: false,
  }));
  // A new line starts from nothing; Next (a new token) shows the current one whole. A line held behind a CG's pan
  // starts its clock when the box comes back, so none of it is typed out of sight.
  let count = typing.count;
  let whole = typing.whole;
  if (typing.key !== lineKey || typing.token !== finishToken || typing.paused !== paused) {
    const fresh = typing.key !== lineKey || (typing.paused && !paused) || paused;
    count = fresh ? 0 : chars.length;
    whole = !fresh;
    setTyping({ key: lineKey, count, token: finishToken, start: Date.now(), paused, whole });
  }
  const visible = instant ? chars.length : paused ? 0 : Math.min(count, chars.length);
  const done = visible >= chars.length;

  const lineRef = useRef<HTMLParagraphElement>(null);
  const typedRef = useRef<HTMLSpanElement>(null);
  const restRef = useRef<HTMLSpanElement>(null);
  // While its text changes the box clips instead of scrolling, and the line is lifted (translateY) so the row being
  // typed sits at the bottom edge (a line typed out, its last row): on an iPhone a box scrolled as its text changed
  // shook and fell back short of the end. A frame after the line is whole (typed out, or Next), with no text
  // changing any more, the box scrolls again from where the lift left it, so the player can scroll it.
  const followKey = `${lineKey}:${paused}`;
  const [settled, setSettled] = useState<string | null>(null);
  const lifting = !instant && settled !== followKey;
  const [lift, setLift] = useState({ key: followKey, px: 0, width: 0 });
  const liftPx = lifting && lift.key === followKey ? lift.px : 0;
  // A new line, or one back from behind a CG's pan, opens at its top; a line read again (a replay) has the same key.
  useLayoutEffect(() => {
    if (lineRef.current) lineRef.current.scrollTop = 0;
    setSettled(null);
    setLift({ key: followKey, px: 0, width: 0 });
  }, [followKey]);
  // The untyped rest is laid out (hidden), so the box is already as tall as the whole line. Measured on screen, so
  // the lift itself never counts. At one width it never drops back while the line types (a row's first character can
  // still sit at the end of the row above); a new width (a phone turned, fullscreen) measures afresh. It never passes
  // the line's end, and Next leaves it where it was.
  useLayoutEffect(() => {
    const box = lineRef.current;
    const typed = typedRef.current;
    if (!box || !typed || !lifting || whole) return;
    const at = restRef.current?.getClientRects()[0];
    const row = Number.parseFloat(getComputedStyle(box).lineHeight) || 0;
    const bottom = at ? at.top - typed.getBoundingClientRect().top + row : typed.offsetHeight;
    const most = Math.max(0, typed.offsetHeight - box.clientHeight);
    const width = box.clientWidth;
    setLift((current) => {
      const same = current.key === followKey && current.width === width;
      const px = Math.min(most, Math.max(same ? current.px : 0, Math.ceil(bottom - box.clientHeight)));
      return same && current.px === px ? current : { key: followKey, px, width };
    });
  }, [followKey, lifting, visible, whole]);
  useEffect(() => {
    if (!lifting || !done) return;
    const frame = window.requestAnimationFrame(() => setSettled(followKey));
    return () => window.cancelAnimationFrame(frame);
  }, [done, followKey, lifting]);
  // Settled: the box scrolls to where the lift showed the line, so nothing on screen moves.
  const lifted = useRef({ key: followKey, px: 0 });
  useLayoutEffect(() => {
    const box = lineRef.current;
    const before = lifted.current;
    lifted.current = { key: followKey, px: liftPx };
    if (box && !lifting && before.key === followKey && before.px > 0) box.scrollTop = before.px;
  }, [followKey, liftPx, lifting]);

  // The pace comes from the clock, not from frames: a slow frame shows more characters at once, never fewer per second.
  useEffect(() => {
    if (paused) return;
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
  }, [done, lineKey, onTyped, paused]);

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
      <p ref={lineRef} className={lineClass} data-lifting={lifting}>
        <span className="of-visually-hidden">{spoken}</span>
        {/* A new span for every step of the reveal, never text changed in place: iOS Safari repaints text changed in
            place only where the box shows it, so rows that typed while scrolled out of view came back blank. A
            removed span is repainted whole. While it types it takes no pointer events, so a held click lands on the
            line itself, which stays, and still shows the line whole (a click whose pressed element is gone never
            fires). */}
        <span
          key={`${lineKey}:${visible}`}
          ref={typedRef}
          aria-hidden="true"
          data-done={done}
          style={{
            pointerEvents: done ? undefined : "none",
            transform: liftPx ? `translateY(${-liftPx}px)` : undefined,
          }}
        >
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
