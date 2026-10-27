import { useEffect, useId, useRef, useState } from "react";
import { useSaucelingsTranslation } from "./localization.js";

/** Kept in the browser: the tour shows once, after the first egg, and the Tour button replays it. */
const SEEN_KEY = "saucelings-tour-seen";

export function tourSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markTourSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // A private window keeps no storage; the tour then only shows after a first egg again.
  }
}

// ponytail: Mari's sprites by their path in the Engine's public folder, always the basic look; the player's chosen
// Mari pack is not followed, and a moved path only hides her. An Engine-exported Mari helper is the upgrade.
export function mariPose(pose: string): string {
  return `/sprites/mari/basic/pose-${pose}.webp?v=39c2`;
}

/** Each step points at the part of the page marked with its `data-sl-tour`; the first is about the whole nook, and
 *  `HATCHED_FIRST` takes its place once the egg has hatched. */
const STEPS = [
  { title: "saucelings.tour.eggTitle", body: "saucelings.tour.eggBody", target: null, pose: "greet" },
  { title: "saucelings.tour.metersTitle", body: "saucelings.tour.metersBody", target: "meters", pose: "point-up" },
  { title: "saucelings.tour.careTitle", body: "saucelings.tour.careBody", target: "care", pose: "point-down" },
  {
    title: "saucelings.tour.caretakerTitle",
    body: "saucelings.tour.caretakerBody",
    target: "caretaker",
    pose: "explaining",
  },
  { title: "saucelings.tour.aboutTitle", body: "saucelings.tour.aboutBody", target: "menu", pose: "point-up" },
  { title: "saucelings.tour.tabsTitle", body: "saucelings.tour.tabsBody", target: "tabs", pose: "point-up" },
] as const;
const HATCHED_FIRST = { ...STEPS[0], title: "saucelings.tour.petTitle", body: "saucelings.tour.petBody" } as const;

/** Mari's walk through the nook: a card docked at the bottom, with the part each step is about outlined. */
export function NookTour({
  caretaker,
  hatched,
  onClose,
}: {
  caretaker: string;
  hatched: boolean;
  onClose: () => void;
}) {
  const { t } = useSaucelingsTranslation();
  const [index, setIndex] = useState(0);
  const [mariShown, setMariShown] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const step = index === 0 && hatched ? HATCHED_FIRST : STEPS[index];
  const last = index === STEPS.length - 1;

  useEffect(markTourSeen, []);

  useEffect(() => {
    const root = cardRef.current?.closest(".sl-shell") ?? document;
    const targets = step.target ? [...root.querySelectorAll<HTMLElement>(`[data-sl-tour="${step.target}"]`)] : [];
    if (!targets.length) return;
    for (const target of targets) target.classList.add("sl-tour-target");
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    targets[0].scrollIntoView({ block: "center", behavior: still ? "auto" : "smooth" });
    return () => targets.forEach((target) => target.classList.remove("sl-tour-target"));
  }, [step.target]);

  return (
    <div
      ref={cardRef}
      className="sl-tour"
      role="dialog"
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        onClose();
      }}
    >
      {mariShown ? (
        <img className="sl-tour-mari" src={mariPose(step.pose)} alt="" onError={() => setMariShown(false)} />
      ) : null}
      <div className="sl-tour-text">
        <strong id={titleId}>{t(step.title, { caretaker })}</strong>
        <p>{t(step.body, { caretaker })}</p>
        <div className="sl-tour-foot">
          <span className="sl-tour-dots" aria-hidden="true">
            {STEPS.map((s, i) => (
              <span key={s.title} className={i === index ? "sl-tour-dot sl-tour-dot--on" : "sl-tour-dot"} />
            ))}
          </span>
          {last ? null : (
            <button type="button" className="sl-link" onClick={onClose}>
              {t("saucelings.tour.skip")}
            </button>
          )}
          {index > 0 ? (
            <button
              type="button"
              className="sl-btn sl-btn--small"
              onClick={() => {
                // Back leaves the first step, where it is not shown, so the keyboard moves on to Next with it.
                if (index === 1) nextRef.current?.focus();
                setIndex(index - 1);
              }}
            >
              {t("saucelings.tour.back")}
            </button>
          ) : null}
          <button
            ref={nextRef}
            type="button"
            className="sl-btn sl-btn--small sl-btn--primary"
            // The card takes focus as it opens, so the keyboard can walk it straight away.
            autoFocus
            onClick={() => (last ? onClose() : setIndex(index + 1))}
          >
            {last ? t("saucelings.tour.done") : t("saucelings.tour.next")}
          </button>
        </div>
      </div>
    </div>
  );
}
