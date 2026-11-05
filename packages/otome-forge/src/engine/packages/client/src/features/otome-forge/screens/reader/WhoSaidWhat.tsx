// ──────────────────────────────────────────────
// Otome Forge: Who said what? (#2041), under "Writing the next scene…" while a scene is written. Optional: one Play
// button, then a line from the story already read and the love interests to choose from; the answer is revealed in a
// polite live region with who really said it, then Next line. No model call and nothing saved: the lines come from
// GET /runs/:run/who-said-what (S/minigames/who-said-what.ts), and the tally lives only while this scene is written.
// Focus moves only after the player's own Play, answer or Next, never on open (ReadHim's rule). The reader unmounts it
// the moment the scene is ready; it has no timer. Answered pills and the verdict are Read Him's, the line Wardrobe's.
// ──────────────────────────────────────────────
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Check, Quote, X } from "lucide-react";
import { useOtomeApi } from "../../api";
import { runPath } from "../../hooks/use-reader";
import type { LiId, RunLiView, WhoSaidWhatView } from "../../shared/api-types";

export function WhoSaidWhat({ runKey, lis }: { runKey: string; lis: readonly RunLiView[] }) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const titleId = useId();
  // A fresh shuffle on each wait, steady while it lasts.
  const { data } = useQuery({
    queryKey: ["otome-forge", "who-said-what", runKey],
    queryFn: () => otome.get<WhoSaidWhatView>(`${runPath(runKey)}/who-said-what`),
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
  });
  /** The round being played; null before Play. */
  const [round, setRound] = useState<number | null>(null);
  const [pick, setPick] = useState<LiId | null>(null);
  const [score, setScore] = useState({ right: 0, played: 0 });
  const pendingFocus = useRef<"line" | "next" | null>(null);
  const lineRef = useRef<HTMLParagraphElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const target = pendingFocus.current;
    const element = target === "line" ? lineRef.current : target === "next" ? nextRef.current : null;
    if (!element) return;
    pendingFocus.current = null;
    element.focus({ preventScroll: true });
    element.scrollIntoView({ block: "nearest" });
  });

  const choices = (data?.choices ?? []).flatMap((id) => lis.filter((li) => li.id === id));
  const lines = (data?.lines ?? []).filter((line) => choices.some((li) => li.id === line.li));
  if (choices.length < 2 || !lines.length) return null;

  if (round === null) {
    return (
      <button
        type="button"
        className="of-button of-button--quiet of-glass of-wsw-play"
        onClick={() => {
          pendingFocus.current = "line";
          setRound(0);
        }}
      >
        <Quote size={16} strokeWidth={2} aria-hidden="true" />
        {t("ui.otomeForge.whoSaidWhat.play")}
      </button>
    );
  }

  // ponytail: the batch starts over after its last line; the upgrade path is fetching a new shuffle there.
  const line = lines[round % lines.length]!;
  const speaker = choices.find((li) => li.id === line.li)!;
  const answered = pick !== null;
  const correct = pick === line.li;
  const answer = (li: LiId) => {
    if (answered) return;
    pendingFocus.current = "next";
    setPick(li);
    setScore((tally) => ({ right: tally.right + (li === line.li ? 1 : 0), played: tally.played + 1 }));
  };
  const next = () => {
    pendingFocus.current = "line";
    setPick(null);
    setRound(round + 1);
  };
  return (
    <section className="of-reader-panel of-glass of-glass--strong of-wsw" aria-labelledby={titleId}>
      <div className="of-wsw-head">
        <h2 id={titleId} className="of-eyebrow">
          {t("ui.otomeForge.whoSaidWhat.title")}
        </h2>
        {score.played ? (
          <p className="of-hint">
            {t("ui.otomeForge.whoSaidWhat.score", { right: score.right, played: score.played })}
          </p>
        ) : null}
      </div>
      <p ref={lineRef} className="of-show-text of-wsw-line" tabIndex={-1}>
        {t("ui.otomeForge.dateNight.quoted", { line: line.text })}
      </p>
      <ul className="of-choice-pills of-wsw-choices" aria-labelledby={titleId}>
        {choices.map((li) => {
          const state = !answered ? "open" : li.id === line.li ? "true" : li.id === pick ? "wrong" : "dim";
          return (
            <li key={li.id}>
              <button
                type="button"
                className="of-choice-pill of-rh-reading"
                data-state={state}
                aria-disabled={answered}
                onClick={() => answer(li.id)}
              >
                {state === "true" ? (
                  <Check className="of-choice-pill-mark" size={16} strokeWidth={2.6} aria-hidden="true" />
                ) : state === "wrong" ? (
                  <X className="of-choice-pill-mark" size={16} strokeWidth={2.6} aria-hidden="true" />
                ) : null}
                <span className="of-choice-pill-text">{li.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="of-live" role="status" aria-live="polite">
        {answered ? (
          <p className="of-rh-verdict" data-correct={correct}>
            {correct ? (
              <Check size={18} strokeWidth={2.4} aria-hidden="true" />
            ) : (
              <X size={18} strokeWidth={2.4} aria-hidden="true" />
            )}
            <span>
              {correct
                ? t("ui.otomeForge.whoSaidWhat.right", { name: speaker.name })
                : t("ui.otomeForge.whoSaidWhat.wrong", { name: speaker.name })}
            </span>
          </p>
        ) : null}
      </div>
      {answered ? (
        <button ref={nextRef} type="button" className="of-button of-button--primary" onClick={next}>
          {t("ui.otomeForge.whoSaidWhat.next")}
        </button>
      ) : null}
    </section>
  );
}
