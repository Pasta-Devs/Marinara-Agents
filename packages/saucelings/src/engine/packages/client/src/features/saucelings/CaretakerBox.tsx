import { useEffect, useRef, useState, type ReactNode } from "react";
import type { SaucelingEvent } from "../../../../shared/src/features/agents/saucelings/types.js";
import { CaretakerAvatar, useCaretakerAvatar } from "./care-ui.js";
import { useSaucelingsTranslation } from "./localization.js";
import { stageIsStill } from "./stage-director.js";

/** How many of the caretaker's latest lines the box pages through. */
const LINES_SHOWN = 8;
/** A new line types out two characters at a time, about 45 a second. */
const TYPE_STEP = 2;
const TYPE_MS = 44;

/**
 * The caretaker's message box, joined under the stage in the manner of a visual novel's dialogue box: their name,
 * what they last said, Previous and Next through their recent lines beside when it was said, then whatever the
 * Nook puts under it (Check in and Ask, on a wide panel). A caretaker with sprites stands in the scene above it; one without has their avatar here.
 * A line that arrives while the box is open types out; tapping it, or paging, shows it whole.
 */
export function CaretakerBox({
  lines,
  fallbackLine,
  caretakerId,
  caretakerName,
  isCharacter,
  meals,
  isEgg,
  writing,
  standing,
  onTyping,
  children,
}: {
  /** The caretaker's lines, newest first. */
  lines: SaucelingEvent[];
  fallbackLine: string;
  caretakerId: string;
  caretakerName: string;
  isCharacter: boolean;
  /** Meals given of those due over the last 7 days; an egg counts times kept warm. */
  meals: { given: number; total: number };
  isEgg: boolean;
  /** Lines the model is still writing; each shows the caretaker writing until it lands. */
  writing: string[];
  /** The caretaker stands in the scene, so the box leaves out their picture. */
  standing: boolean;
  /** Told when their newest line starts and stops typing out. */
  onTyping?: (typing: boolean) => void;
  children?: ReactNode;
}) {
  const { t } = useSaucelingsTranslation();
  const recent = lines.slice(0, LINES_SHOWN);
  const [index, setIndex] = useState(0);
  // A new line always shows first.
  const newestId = recent[0]?.id;
  useEffect(() => setIndex(0), [newestId]);
  const at = Math.min(index, Math.max(0, recent.length - 1));
  const shown = recent[at] ?? null;
  const avatar = useCaretakerAvatar(caretakerId, isCharacter && !standing);

  const text =
    shown && writing.includes(shown.id)
      ? t("saucelings.checkIn.pending", { name: shown.speaker ?? caretakerName })
      : (shown?.text ?? fallbackLine);

  // The newest line once its words are in; the lines already there when the box opened show whole.
  const newest = recent[0] && !writing.includes(recent[0].id) ? recent[0] : null;
  const newestKey = newest ? `${newest.id}:${newest.text}` : null;
  const seenKey = useRef(newestKey);
  const [typed, setTyped] = useState<number | null>(null);
  useEffect(() => {
    if (!newestKey || newestKey === seenKey.current) return;
    seenKey.current = newestKey;
    setTyped(stageIsStill() ? null : 0);
  }, [newestKey]);
  const chars = Array.from(text);
  const typing = typed !== null && at === 0 && shown === newest && typed < chars.length;
  useEffect(() => {
    if (!typing) return;
    const timer = window.setTimeout(() => setTyped((count) => (count === null ? null : count + TYPE_STEP)), TYPE_MS);
    return () => window.clearTimeout(timer);
  }, [typing, typed]);
  useEffect(() => onTyping?.(typing), [onTyping, typing]);
  const page = (next: number) => {
    setTyped(null);
    setIndex(next);
  };

  return (
    <section
      className={`sl-box sl-box--joined ${standing ? "sl-box--standing" : ""}`}
      aria-label={t("saucelings.caretaker.says", { name: caretakerName })}
    >
      {standing ? null : <CaretakerAvatar box name={caretakerName} src={avatar} />}
      <div className="sl-box-plate">
        {/* A line from before a caretaker change keeps the name of whoever said it. */}
        <strong>{shown?.speaker ?? caretakerName}</strong>
        {meals.total > 0 ? (
          <span
            className="sl-pill"
            title={t(isEgg ? "saucelings.pet.keptWarmTitle" : "saucelings.pet.mealsTitle", { name: caretakerName })}
          >
            {t(isEgg ? "saucelings.pet.keptWarm" : "saucelings.pet.meals", meals)}
          </span>
        ) : null}
        {shown?.generated ? <span className="sl-pill sl-pill--ai">{t("saucelings.journal.generated")}</span> : null}
      </div>

      {/* Screen readers hear the whole line once; the typed copy over its reserved space is for the eye. */}
      <p
        className={`sl-box-line ${typing ? "sl-box-line--typing" : ""}`}
        aria-live="polite"
        onClick={() => setTyped(null)}
      >
        <span className="sl-box-typed" aria-hidden="true">
          <span className="sl-box-ghost">{text}</span>
          <span>{typing ? chars.slice(0, typed).join("") : text}</span>
        </span>
        <span className="sl-sr-only">{text}</span>
      </p>

      {shown ? (
        <div className="sl-box-nav">
          {recent.length > 1 ? (
            <>
              <button
                type="button"
                className="sl-btn sl-btn--small"
                aria-label={t("saucelings.caretaker.previous")}
                disabled={at >= recent.length - 1}
                onClick={() => page(at + 1)}
              >
                ◀
              </button>
              <span>{t("saucelings.caretaker.position", { index: recent.length - at, count: recent.length })}</span>
              <button
                type="button"
                className="sl-btn sl-btn--small"
                aria-label={t("saucelings.caretaker.next")}
                disabled={at === 0}
                onClick={() => page(at - 1)}
              >
                ▶
              </button>
            </>
          ) : null}
          <time className="sl-box-time">{new Date(shown.createdAt).toLocaleString()}</time>
        </div>
      ) : null}
      {children}
    </section>
  );
}
