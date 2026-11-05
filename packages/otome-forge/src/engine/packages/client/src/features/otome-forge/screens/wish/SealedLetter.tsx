// ──────────────────────────────────────────────
// Otome Forge: the sealed letter a wish arrives in. Its wax seal glows by the best rarity inside (silver 3★, violet
// 4★, gold 5★); dragging the seal up draws the letter out, and past the halfway mark it opens. A tap, Enter or Space on
// the seal opens it too, so nobody needs the gesture, and the overlay's Skip always passes it by.
// ──────────────────────────────────────────────
// One pointer drives a drag: a second finger, a pointer that is cancelled or whose capture is lost resets it, and a
// drag that moved is not also taken as a tap. Under reduced motion the letter opens without drawing out.
import { useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { Heart } from "lucide-react";
import type { Rarity } from "../../shared/wish";

/** How far the seal travels (px) for a full draw; the letter opens from OPEN_AT of it. */
const TRAVEL = 150;
const OPEN_AT = 0.5;
/** A tap that moves less than this is a tap, not a drag. */
const SLOP = 8;
/** How long the opened letter glows before the wishes show. */
export const LETTER_OPEN_MS = 900;

export const RARITY_NAMES: Record<Rarity, "silver" | "violet" | "gold"> = { 3: "silver", 4: "violet", 5: "gold" };

interface SealedLetterProps {
  /** The best rarity inside. */
  rarity: Rarity;
  /** Whom it is addressed to: the protagonist's name. */
  to: string;
  count: number;
  reducedMotion: boolean;
  /** The seal broke (a stock sound plays here). */
  onBreak?: () => void;
  /** The letter is open: the wishes show. */
  onOpened: () => void;
}

interface Drag {
  id: number;
  x: number;
  y: number;
  moved: boolean;
}

export function SealedLetter({ rarity, to, count, reducedMotion, onBreak, onOpened }: SealedLetterProps) {
  const { t } = useTranslation();
  const hintId = useId();
  const [progress, setProgress] = useState(0);
  const [opening, setOpening] = useState(false);
  const progressRef = useRef(0);
  const drag = useRef<Drag | null>(null);
  const moved = useRef(false);
  const broken = useRef(false);
  const sealRef = useRef<HTMLButtonElement>(null);
  const opened = useRef(onOpened);
  opened.current = onOpened;

  const move = (value: number) => {
    progressRef.current = value;
    setProgress(value);
  };

  const open = () => {
    if (broken.current) return;
    broken.current = true;
    drag.current = null;
    move(1);
    setOpening(true);
    onBreak?.();
  };

  // The seal takes focus when the letter arrives: Enter or Space opens it from the keyboard.
  useEffect(() => sealRef.current?.focus({ preventScroll: true }), []);

  useEffect(() => {
    if (!opening) return;
    const timer = window.setTimeout(() => opened.current(), reducedMotion ? 0 : LETTER_OPEN_MS);
    return () => window.clearTimeout(timer);
  }, [opening, reducedMotion]);

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (broken.current || drag.current || (event.pointerType === "mouse" && event.button !== 0)) return;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    moved.current = false;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // A pointer that is already gone: the drag ends with the next event.
    }
  };

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - current.x, event.clientY - current.y) > SLOP) current.moved = true;
    if (!reducedMotion) move(Math.min(1, Math.max(0, (current.y - event.clientY) / TRAVEL)));
  };

  /** Ends the drag: opens it past the mark (on a release only), otherwise lets the letter settle back. */
  const finish = (event: PointerEvent<HTMLButtonElement>, release: boolean) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    drag.current = null;
    // Only a release is followed by a click to swallow; a cancelled drag leaves the next tap (or key) its own.
    moved.current = release && current.moved;
    if (release && current.moved && (progressRef.current >= OPEN_AT || reducedMotion)) open();
    else if (!broken.current) move(0);
  };

  const style = { "--of-letter-open": progress } as CSSProperties;
  return (
    <div className="of-letter" data-rarity={RARITY_NAMES[rarity]} data-opening={opening} style={style}>
      <div className="of-letter-rays" aria-hidden="true" />
      <div className="of-letter-envelope" aria-hidden="true">
        <span className="of-letter-back" />
        <span className="of-letter-sheet">
          <span className="of-letter-lines" />
        </span>
        <span className="of-letter-pocket" />
        <span className="of-letter-to">{t("ui.otomeForge.wish.letterTo", { name: to })}</span>
        <span className="of-letter-flap" />
      </div>
      <button
        ref={sealRef}
        type="button"
        className="of-letter-seal"
        aria-label={t("ui.otomeForge.wish.letterSeal")}
        aria-describedby={hintId}
        aria-disabled={opening}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(event) => finish(event, true)}
        onPointerCancel={(event) => finish(event, false)}
        onLostPointerCapture={(event) => finish(event, false)}
        onClick={() => {
          // A drag that moved was already handled when it was released.
          if (moved.current) {
            moved.current = false;
            return;
          }
          open();
        }}
      >
        <span className="of-letter-wax" aria-hidden="true">
          <Heart size={22} strokeWidth={1.8} fill="currentColor" />
        </span>
      </button>
      <p id={hintId} className="of-letter-hint">
        {opening
          ? t("ui.otomeForge.wish.letterOpening")
          : count > 1
            ? t("ui.otomeForge.wish.letterHintMany", { count })
            : t("ui.otomeForge.wish.letterHint")}
      </p>
    </div>
  );
}
