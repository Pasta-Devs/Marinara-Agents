// ──────────────────────────────────────────────
// Otome Hearth: the personality quiz (#2174), under "Planning chapter …" while a chapter that opens no arc is planned
// ──────────────────────────────────────────────
// Optional, as Who said what? is (C/screens/reader/WhoSaidWhat.tsx): one Play button, then a statement and a 1–5 scale
// from strongly disagree to strongly agree. The answer is saved (POST /runs/:run/quiz/answer; the first is final) and
// each love interest's own answer to it is revealed in a polite live region, with how alike the two of you are so far
// (SH/quiz.ts quizAgreement), then Next statement. The quiz is read only once Play is pressed (GET /runs/:run/quiz,
// which queues what it is missing in the background: their answers, or new statements once every one is answered),
// and read again now and then while something it shows is still being written, or slowly while the statement on
// screen has none of their answers and nothing is being written (a call that failed waits out the server's cool-down).
// Play stays the same button until that first read lands, as Try again when it failed, so focus never falls out of the
// dialog. Focus moves only after the player's own Play, answer or Next, never on open; new statements that arrive
// while the player waits take focus only from the waiting message, and are otherwise said in the live region. The
// planning dialog unmounts it the moment the chapter is planned.
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { useOtomeApi } from "../../api";
import { Avatar } from "../../components/Avatar";
import { runPath } from "../../hooks/use-reader";
import { accentOf } from "../../lib/accent";
import type { RunLiView } from "../../shared/api-types";
import { QUIZ_SCALE, quizAgreement, type QuizScore, type QuizView } from "../../shared/quiz";

/** How often the quiz is read again while their answers or new statements are being written. */
const REFRESH_MS = 15_000;
/** How often it is read while the statement on screen has none of their answers and nothing is being written. */
const STALLED_MS = 60_000;

const SCALE_KEYS: Record<QuizScore, string> = {
  1: "ui.otomeForge.quiz.scale1",
  2: "ui.otomeForge.quiz.scale2",
  3: "ui.otomeForge.quiz.scale3",
  4: "ui.otomeForge.quiz.scale4",
  5: "ui.otomeForge.quiz.scale5",
};

/** The statement on screen: the one just answered (`shown`), else the first still open. */
const onScreen = (view: QuizView, shown: string | null) =>
  (shown && [...view.open, ...view.answered].find((entry) => entry.id === shown)) || view.open[0] || null;

export function PersonalityQuiz({ runKey, lis }: { runKey: string; lis: readonly RunLiView[] }) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const titleId = useId();
  const statementId = useId();
  const [playing, setPlaying] = useState(false);
  /** The statement on screen; null shows the first one still open. */
  const [shown, setShown] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<unknown>(null);
  /** New statements arrived while the player waited with focus elsewhere: the live region says so. */
  const [arrived, setArrived] = useState(false);
  const queryKey = ["otome-forge", "quiz", runKey];
  const { data, error, isFetching, refetch } = useQuery({
    queryKey,
    queryFn: () => otome.get<QuizView>(`${runPath(runKey)}/quiz`),
    enabled: playing,
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    refetchInterval: (query) => {
      const view = query.state.data;
      if (!view) return false;
      if (view.scoring || (view.refilling && !view.open.length)) return REFRESH_MS;
      const current = onScreen(view, shown);
      return current && !Object.keys(current.scores).length ? STALLED_MS : false;
    },
  });
  const statement = data ? onScreen(data, shown) : null;
  const pendingFocus = useRef<"statement" | "next" | null>(null);
  const statementRef = useRef<HTMLParagraphElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  /** The waiting message was on screen at the last render. */
  const waited = useRef(false);
  useEffect(() => {
    if (data && !statement) waited.current = true;
    else if (waited.current && statement) {
      // New statements replaced the waiting message: focus goes to the first only if it fell out with that message.
      waited.current = false;
      const active = document.activeElement;
      if (!active || active === document.body) pendingFocus.current = "statement";
      else setArrived(true);
    }
  }, [data, statement]);
  useEffect(() => {
    const target = pendingFocus.current;
    const element = target === "statement" ? statementRef.current : target === "next" ? nextRef.current : null;
    if (!element) return;
    pendingFocus.current = null;
    element.focus({ preventScroll: true });
    element.scrollIntoView({ block: "nearest" });
  });

  const scaleLabel = (score: QuizScore) => t(SCALE_KEYS[score]);

  if (!data) {
    // The same button until the first read lands, so focus stays on it; Try again once that read failed.
    const reading = playing && (isFetching || !error);
    return (
      <>
        <button
          type="button"
          className="of-button of-button--quiet of-glass of-quiz-play"
          aria-disabled={reading}
          onClick={() => {
            if (!playing) {
              pendingFocus.current = "statement";
              setPlaying(true);
            } else if (!reading) void refetch();
          }}
        >
          <Sparkles size={16} strokeWidth={2} aria-hidden="true" />
          {error ? t("ui.otomeForge.common.retry") : t("ui.otomeForge.quiz.play")}
        </button>
        {error && !isFetching ? (
          <p className="of-notice of-notice--error" role="alert">
            {otome.errorMessage(error)}
          </p>
        ) : null}
      </>
    );
  }

  const head = (
    <div className="of-quiz-head">
      <h3 id={titleId} className="of-eyebrow">
        {t("ui.otomeForge.quiz.title")}
      </h3>
      {data.answered.length ? (
        <p className="of-hint">{t("ui.otomeForge.quiz.answeredCount", { count: data.answered.length })}</p>
      ) : null}
    </div>
  );
  if (!statement) {
    // The waiting message sits in the live region the statement's view keeps (the same element, by its key), so the
    // new statements' arrival can be said there; keyed, it is never reused as the statement itself.
    return (
      <section className="of-quiz" aria-labelledby={titleId}>
        {head}
        <div key="live" className="of-live" role="status" aria-live="polite">
          <p key="waiting" ref={statementRef} className="of-hint" tabIndex={-1}>
            {data.refilling ? t("ui.otomeForge.quiz.refilling") : t("ui.otomeForge.quiz.allDone")}
          </p>
        </div>
      </section>
    );
  }
  const answer = statement.answer;
  const answering = lis.filter((li) => statement.scores[li.id]);
  const choose = async (score: QuizScore) => {
    if (answer || saving) return;
    setSaving(true);
    setFailed(null);
    try {
      const view = await otome.post<QuizView>(`${runPath(runKey)}/quiz/answer`, {
        statement: statement.id,
        answer: score,
      });
      pendingFocus.current = "next";
      setArrived(false);
      setShown(statement.id);
      queryClient.setQueryData(queryKey, view);
    } catch (caught) {
      setFailed(caught);
    } finally {
      setSaving(false);
    }
  };
  const next = () => {
    pendingFocus.current = "statement";
    setArrived(false);
    setShown(null);
  };
  return (
    <section className="of-quiz" aria-labelledby={titleId}>
      {head}
      <p ref={statementRef} id={statementId} className="of-show-text of-quiz-statement" tabIndex={-1}>
        {statement.text}
      </p>
      <div className="of-quiz-scale" role="group" aria-labelledby={statementId}>
        {QUIZ_SCALE.map((score) => (
          <button
            key={score}
            type="button"
            className="of-quiz-point"
            aria-label={t("ui.otomeForge.quiz.point", { score, label: scaleLabel(score) })}
            aria-pressed={answer ? answer === score : undefined}
            aria-disabled={!!answer || saving}
            onClick={() => void choose(score)}
          >
            {score}
          </button>
        ))}
      </div>
      <div className="of-quiz-ends" aria-hidden="true">
        <span>{scaleLabel(1)}</span>
        <span>{scaleLabel(5)}</span>
      </div>
      {failed ? (
        <p className="of-notice of-notice--error" role="alert">
          {otome.errorMessage(failed)}
        </p>
      ) : null}
      <div key="live" className="of-live" role="status" aria-live="polite">
        {answer ? (
          <>
            <p className="of-quiz-you">{t("ui.otomeForge.quiz.you", { answer: scaleLabel(answer) })}</p>
            {answering.length ? (
              <ul className="of-quiz-answers">
                {answering.map((li) => {
                  const theirs = statement.scores[li.id]!;
                  const alike = quizAgreement(data.answered, li.id);
                  return (
                    <li key={li.id} className="of-quiz-answer">
                      <Avatar name={li.name} url={li.portrait} accent={accentOf(li)} size={32} />
                      <span className="of-quiz-answer-name">
                        {t("ui.otomeForge.quiz.their", { name: li.name, answer: scaleLabel(theirs) })}
                      </span>
                      {alike !== null ? (
                        <span className="of-quiz-alike">{t("ui.otomeForge.quiz.alike", { percent: alike })}</span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              // Being written only while a call runs; one that failed waits out the cool-down (the slow read above).
              <p className="of-hint">
                {data.scoring ? t("ui.otomeForge.quiz.noScores") : t("ui.otomeForge.quiz.noScoresYet")}
              </p>
            )}
          </>
        ) : arrived ? (
          <p className="of-hint">{t("ui.otomeForge.quiz.arrived")}</p>
        ) : null}
      </div>
      {answer ? (
        <button ref={nextRef} type="button" className="of-button of-button--primary" onClick={next}>
          {t("ui.otomeForge.quiz.next")}
        </button>
      ) : null}
    </section>
  );
}
