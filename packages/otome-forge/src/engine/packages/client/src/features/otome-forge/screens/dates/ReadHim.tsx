// ──────────────────────────────────────────────
// Otome Forge: Read {{name}} (plan M5 "Read Him"). Five small moments with one love interest: the moment, what is said
// and the face worn saying it; the player picks which reading is what is really felt, then hears the thought behind
// it. Failure still pays, the day's caps limit only the pay, and a set left half-played picks up where it stopped.
// ──────────────────────────────────────────────
// Routes (S/routes/read-him.ts): POST /runs/:run/read-him {li} → ReadHimSetView (never a round's truth before it is
// answered); POST .../read-him/:set/answer {round, pick} → ReadHimAnswer (the first pick is the answer); POST
// .../read-him/:set/finish → {grants, starlight} (pays once). The Dates hub opens it with ActivityScreenProps, and the
// router focuses its <h1> on arrival and gives the top bar's Back (to Dates). Keys 1–4 pick a reading; focus moves to
// each new moment, to Next after an answer, and to the result; the verdict and the thought go to a polite live region.
// Each moment shows the face it names through the reader's FacePlate: their painted face once M2b's set is ready (the
// run view's `expressions`), else their look with the face as a labelled chip, else their initials with an aura and
// the chip, so nothing rests on a picture or on colour alone. Their line is voiced as the reader voices one (M2b's
// audio, with the kit's voice picking) when the moment opens; the thought, like every thought, never is.
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Check, CloudMoon, Eye, Heart, HeartCrack, RotateCcw, Sparkle, X } from "lucide-react";
import { useOtomeApi } from "../../api";
import { Avatar } from "../../components/Avatar";
import { DeclinedPanel } from "../../components/DeclinedPanel";
import { useAudioSnapshot, useOtomeAudio } from "../../hooks/use-otome-audio";
import { runPath } from "../../hooks/use-reader";
import { patchRun, runQueryKey } from "../../hooks/use-run";
import { accentOf } from "../../lib/accent";
import { useOtomeProps } from "../../props";
import type { RunLiView, Segment } from "../../shared/api-types";
import { AFFECTION_EARNINGS, STARLIGHT_EARNINGS } from "../../shared/economy";
import type { ReadHimAnswer, ReadHimFinishResult, ReadHimSetView } from "../../shared/read-him";
import { PALETTE } from "../../theme/tokens";
import { FACE_LABEL_KEYS, FacePlate } from "../reader/FacePlate";
import { playQueryKey, type ActivityScreenProps } from "./DatesHub";

type Phase =
  | { kind: "intro" }
  | { kind: "loading"; what: "start" | "finish" }
  | { kind: "failed"; error: unknown; retry: "start" | "finish" }
  | { kind: "play"; round: number }
  | { kind: "done"; result: ReadHimFinishResult };

type FocusTarget = "round" | "next" | "done" | "retry";

const SCORE_KEYS = {
  perfect: "ui.otomeForge.readHim.scorePerfect",
  good: "ui.otomeForge.readHim.scoreGood",
  some: "ui.otomeForge.readHim.scoreSome",
  none: "ui.otomeForge.readHim.scoreNone",
} as const;

function scoreKey(right: number, total: number): string {
  if (right === total) return SCORE_KEYS.perfect;
  if (right * 2 > total) return SCORE_KEYS.good;
  return right > 0 ? SCORE_KEYS.some : SCORE_KEYS.none;
}

/** `li` is the love interest to read; a set left unfinished is kept, and the next Read of them picks it up. */
export function ReadHim({ runKey, view, li: picked, onExit }: ActivityScreenProps) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const { locale } = useOtomeProps().localization;
  // The run's current view of them (their level rises after a finish).
  const li = view.lis.find((entry) => entry.id === picked.id) ?? null;
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  const [set, setSet] = useState<ReadHimSetView | null>(null);
  const [answering, setAnswering] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const levelBefore = useRef(li?.level ?? 1);

  // Focus moves only after the player's own action here (the router focuses the <h1> on arrival).
  const pendingFocus = useRef<FocusTarget | null>(null);
  const roundRef = useRef<HTMLHeadingElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const failedRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    // A failed start shows the shared DeclinedPanel, whose Retry is the one marked to take focus.
    const element =
      target === "retry"
        ? (retryRef.current ?? failedRef.current?.querySelector<HTMLElement>("[data-autofocus]"))
        : { round: roundRef, next: nextRef, done: doneRef }[target].current;
    if (!element) return;
    pendingFocus.current = null;
    element.focus({ preventScroll: true });
    if (target === "next") element.scrollIntoView({ block: "nearest" });
  });

  if (!li) {
    return (
      <div className="of-center">
        <p className="of-error" role="alert">
          {t("ui.otomeForge.errors.notFound")}
        </p>
        <button type="button" className="of-button of-button--quiet of-glass" onClick={onExit}>
          {t("ui.otomeForge.readHim.back")}
        </button>
      </div>
    );
  }
  const name = li.name;
  const accent = accentOf(li);
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  const setPath = (id: string) => `${runPath(runKey)}/read-him/${encodeURIComponent(id)}`;

  const fail = (error: unknown, retry: "start" | "finish") => {
    pendingFocus.current = "retry";
    setPhase({ kind: "failed", error, retry });
  };

  const finish = async (current: ReadHimSetView) => {
    levelBefore.current = li.level;
    setPhase({ kind: "loading", what: "finish" });
    try {
      const result = await otome.post<ReadHimFinishResult>(`${setPath(current.setId)}/finish`);
      patchRun(queryClient, runKey, (run) => ({ ...run, starlight: result.starlight }));
      // His level comes back with the run, and today's rewards with the Dates hub's play view.
      void queryClient.invalidateQueries({ queryKey: runQueryKey(runKey) });
      void queryClient.invalidateQueries({ queryKey: playQueryKey(runKey) });
      pendingFocus.current = "done";
      setPhase({ kind: "done", result });
    } catch (error) {
      fail(error, "finish");
    }
  };

  const start = async () => {
    setPhase({ kind: "loading", what: "start" });
    setAnswerError(null);
    setAnnouncement("");
    try {
      const next = await otome.post<ReadHimSetView>(`${runPath(runKey)}/read-him`, { li: li.id });
      setSet(next);
      const open = next.rounds.findIndex((round) => !round.answer);
      if (open < 0) {
        await finish(next);
        return;
      }
      pendingFocus.current = "round";
      setPhase({ kind: "play", round: open });
    } catch (error) {
      fail(error, "start");
    }
  };

  const answer = async (round: number, pick: number) => {
    if (!set || answering || set.rounds[round]?.answer) return;
    setAnswering(true);
    setAnswerError(null);
    try {
      const result = await otome.post<ReadHimAnswer>(`${setPath(set.setId)}/answer`, { round, pick });
      setSet((current) =>
        current
          ? {
              ...current,
              rounds: current.rounds.map((entry, index) => (index === round ? { ...entry, answer: result } : entry)),
            }
          : current,
      );
      const truth = set.rounds[round]!.readings[result.trueIndex] ?? "";
      setAnnouncement(
        result.correct
          ? t("ui.otomeForge.readHim.announceRight", { name, reading: truth, thought: result.thought })
          : t("ui.otomeForge.readHim.announceWrong", { name, reading: truth, thought: result.thought }),
      );
      pendingFocus.current = "next";
    } catch (error) {
      setAnswerError(otome.errorMessage(error));
    } finally {
      setAnswering(false);
    }
  };

  const advance = (round: number) => {
    if (!set) return;
    setAnnouncement("");
    if (round + 1 < set.rounds.length) {
      pendingFocus.current = "round";
      setPhase({ kind: "play", round: round + 1 });
    } else {
      void finish(set);
    }
  };

  const total = set?.rounds.length ?? 5;
  const right = set?.rounds.filter((round) => round.answer?.correct).length ?? 0;
  const playing = phase.kind === "play" ? phase.round : null;
  // The hearts belong to the set on screen: not while a new one is being written.
  const scoring =
    !!set && (phase.kind === "play" || phase.kind === "done" || (phase.kind === "loading" && phase.what === "finish"));

  const moment = (round: number) =>
    t("ui.otomeForge.readHim.moment", { number: number(round + 1), total: number(total) });

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (playing === null || !set || event.altKey || event.ctrlKey || event.metaKey) return;
    const index = Number(event.key) - 1;
    const round = set.rounds[playing];
    if (!round || round.answer || !Number.isInteger(index) || index < 0 || index >= round.readings.length) return;
    event.preventDefault();
    void answer(playing, index);
  };

  return (
    <div className="of-rh" style={{ "--of-li-accent": accent } as CSSProperties} onKeyDown={onKeyDown}>
      <header className="of-rh-head">
        <div className="of-rh-heading">
          <p className="of-rh-eyebrow">{playing !== null ? moment(playing) : t("ui.otomeForge.common.screenDates")}</p>
          <h1 className="of-rh-title" tabIndex={-1}>
            {t("ui.otomeForge.readHim.title", { name })}
          </h1>
        </div>
        {scoring && set ? <Hearts set={set} current={playing} /> : null}
      </header>
      {scoring ? (
        <p className="of-visually-hidden">
          {t("ui.otomeForge.readHim.progress", { right: number(right), total: number(total) })}
        </p>
      ) : null}

      {phase.kind === "intro" ? (
        <Intro li={li} onBegin={() => void start()} />
      ) : phase.kind === "loading" ? (
        <div className="of-center" role="status">
          <Heart className="of-pulse" size={28} strokeWidth={1.6} fill="currentColor" aria-hidden="true" />
          <p className="of-body">
            {phase.what === "start"
              ? t("ui.otomeForge.readHim.loading", { name })
              : t("ui.otomeForge.readHim.finishing")}
          </p>
        </div>
      ) : phase.kind === "failed" && phase.retry === "start" ? (
        // Writing the set failed (a refusal, no connection, a bad reply): said honestly, with Retry and Switch connection.
        <div ref={failedRef} className="of-rh-failed">
          <DeclinedPanel error={phase.error} run={view} job="structured" onRetry={() => void start()} />
          <div className="of-actions">
            <button type="button" className="of-button of-button--quiet of-glass" onClick={onExit}>
              {t("ui.otomeForge.readHim.back")}
            </button>
          </div>
        </div>
      ) : phase.kind === "failed" ? (
        <div className="of-center">
          <div className="of-panel of-panel--center of-card of-glass" role="alert">
            <p className="of-error">{otome.errorMessage(phase.error)}</p>
            <div className="of-actions">
              <button type="button" className="of-button of-button--quiet of-glass" onClick={onExit}>
                {t("ui.otomeForge.readHim.back")}
              </button>
              <button
                ref={retryRef}
                type="button"
                className="of-button of-button--primary"
                onClick={() => (set ? void finish(set) : void start())}
              >
                <RotateCcw size={16} strokeWidth={2} aria-hidden="true" />
                {t("ui.otomeForge.common.retry")}
              </button>
            </div>
          </div>
        </div>
      ) : phase.kind === "play" && set ? (
        <Round
          key={phase.round}
          li={li}
          set={set}
          index={phase.round}
          label={moment(phase.round)}
          answering={answering}
          error={answerError}
          roundRef={roundRef}
          nextRef={nextRef}
          onAnswer={(pick) => void answer(phase.round, pick)}
          onNext={() => advance(phase.round)}
        />
      ) : phase.kind === "done" && set ? (
        <Done
          li={li}
          set={set}
          result={phase.result}
          levelBefore={levelBefore.current}
          doneRef={doneRef}
          number={number}
          onAgain={() => void start()}
          onExit={onExit}
        />
      ) : null}
      <p className="of-visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

/** One heart per moment: filled when read right, cracked when not, breathing on the moment being played. */
function Hearts({ set, current }: { set: ReadHimSetView; current: number | null }) {
  return (
    <ol className="of-rh-hearts" aria-hidden="true">
      {set.rounds.map((round, index) => {
        const state = round.answer
          ? round.answer.correct
            ? "right"
            : "wrong"
          : index === current
            ? "current"
            : "ahead";
        const Icon = state === "wrong" ? HeartCrack : Heart;
        return (
          <li key={index} data-state={state}>
            <Icon size={15} strokeWidth={2} fill={state === "right" ? "currentColor" : "none"} />
          </li>
        );
      })}
    </ol>
  );
}

function Intro({ li, onBegin }: { li: RunLiView; onBegin: () => void }) {
  const { t } = useTranslation();
  const name = li.name;
  const steps = [
    { Icon: Eye, text: t("ui.otomeForge.readHim.stepWatch") },
    { Icon: Heart, text: t("ui.otomeForge.readHim.stepPick", { name }) },
    { Icon: CloudMoon, text: t("ui.otomeForge.readHim.stepThought") },
  ];
  return (
    <div className="of-page of-rh-intro">
      <div className="of-page-head">
        <span className="of-rh-portrait">
          <Avatar name={name} url={li.portrait} accent={accentOf(li)} size={104} />
        </span>
        <p className="of-hand">{t("ui.otomeForge.readHim.question", { name })}</p>
        <p className="of-body">{t("ui.otomeForge.readHim.introLead", { name })}</p>
      </div>
      <section className="of-section of-glass" aria-labelledby="of-rh-how">
        <h2 id="of-rh-how" className="of-section-title">
          {t("ui.otomeForge.readHim.howTitle")}
        </h2>
        <ol className="of-rh-steps">
          {steps.map(({ Icon, text }, index) => (
            <li key={index} className="of-rh-step">
              <span className="of-rh-step-icon" aria-hidden="true">
                <Icon size={16} strokeWidth={2} />
              </span>
              <span>{text}</span>
            </li>
          ))}
        </ol>
        <p className="of-rh-reward">
          <Sparkle size={14} strokeWidth={1.8} fill="currentColor" aria-hidden="true" />
          <span>
            {t("ui.otomeForge.readHim.reward", {
              starlight: STARLIGHT_EARNINGS.readHim,
              affection: AFFECTION_EARNINGS.readHim,
            })}
          </span>
        </p>
        <p className="of-hint">{t("ui.otomeForge.readHim.modelNote")}</p>
      </section>
      <div className="of-actions">
        <button type="button" className="of-button of-button--primary" onClick={onBegin}>
          <Eye size={16} strokeWidth={2} aria-hidden="true" />
          {t("ui.otomeForge.readHim.begin")}
        </button>
      </div>
    </div>
  );
}

interface RoundProps {
  li: RunLiView;
  set: ReadHimSetView;
  index: number;
  /** "Moment n of 5", the round's heading. */
  label: string;
  answering: boolean;
  error: string | null;
  roundRef: RefObject<HTMLHeadingElement | null>;
  nextRef: RefObject<HTMLButtonElement | null>;
  onAnswer: (pick: number) => void;
  onNext: () => void;
}

function Round({ li, set, index, label, answering, error, roundRef, nextRef, onAnswer, onNext }: RoundProps) {
  const { t } = useTranslation();
  const round = set.rounds[index]!;
  const { answer } = round;
  const name = li.name;
  const last = index === set.rounds.length - 1;
  const faceLabel = round.face ? t(FACE_LABEL_KEYS[round.face]) : "";
  const truth = answer ? (round.readings[answer.trueIndex] ?? "") : "";

  // Their line is voiced once, as the moment opens (never for a moment answered before, when a set is picked up again),
  // and leaving the moment stops it. The snapshot re-renders this when the voice settings change.
  const audio = useOtomeAudio();
  useAudioSnapshot();
  const [opened] = useState(() => !round.answer);
  const said: Segment = { speaker: name, text: round.line, ...(round.face ? { expression: round.face } : {}) };
  const voicedRef = opened && audio?.wouldSpeak(said) ? `readhim:${set.setId}:${index}` : "";
  useEffect(() => {
    if (!audio || !voicedRef) return;
    void audio.speak(said, voicedRef);
    return () => audio.stopVoice();
    // Once per moment: the line belongs to its ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio, voicedRef]);
  return (
    <>
      <div className="of-rh-scene">
        <FacePlate li={li} face={round.face} speaking />
      </div>
      <section className="of-rh-bottom" aria-labelledby="of-rh-round">
        <h2 id="of-rh-round" ref={roundRef} className="of-visually-hidden" tabIndex={-1}>
          {label}
        </h2>
        <p className="of-rh-context of-glass">
          <Eye size={15} strokeWidth={2} aria-hidden="true" />
          <span>{round.context}</span>
        </p>
        <div className="of-dialogue of-glass of-glass--strong of-rh-dialogue" data-voice="li" data-thought={!!answer}>
          <p className="of-nameplate" data-voice="li">
            <span>{name}</span>
            {answer ? (
              <span className="of-nameplate-tag">
                <CloudMoon size={12} strokeWidth={2.2} aria-hidden="true" />
                {t("ui.otomeForge.reader.thinking")}
              </span>
            ) : null}
          </p>
          {answer ? (
            <p className="of-line of-line--his-thought of-rh-thought">
              <span className="of-visually-hidden">
                {t("ui.otomeForge.reader.announceHisThought", { name, text: answer.thought })}
              </span>
              <span aria-hidden="true">{answer.thought}</span>
            </p>
          ) : (
            <p className="of-line">
              <span className="of-visually-hidden">
                {faceLabel
                  ? t("ui.otomeForge.reader.announceLineFace", { name, face: faceLabel, text: round.line })
                  : t("ui.otomeForge.reader.announceLine", { name, text: round.line })}
              </span>
              <span aria-hidden="true">{round.line}</span>
            </p>
          )}
        </div>
        {answer ? (
          <p className="of-rh-verdict" data-correct={answer.correct}>
            {answer.correct ? (
              <Check size={18} strokeWidth={2.4} aria-hidden="true" />
            ) : (
              <HeartCrack size={18} strokeWidth={2} aria-hidden="true" />
            )}
            <span>
              {answer.correct
                ? t("ui.otomeForge.readHim.right", { name })
                : t("ui.otomeForge.readHim.wrong", { name, reading: truth })}
            </span>
          </p>
        ) : (
          <p className="of-rh-question" id="of-rh-question">
            {t("ui.otomeForge.readHim.question", { name })}
          </p>
        )}
        <ul className="of-choice-pills of-rh-readings" aria-labelledby={answer ? undefined : "of-rh-question"}>
          {round.readings.map((reading, option) => {
            const state = !answer
              ? "open"
              : option === answer.trueIndex
                ? "true"
                : option === answer.pick
                  ? "wrong"
                  : "dim";
            return (
              <li key={option}>
                <button
                  type="button"
                  className="of-choice-pill of-rh-reading"
                  data-state={state}
                  aria-disabled={!!answer || answering}
                  aria-keyshortcuts={answer ? undefined : String(option + 1)}
                  onClick={() => {
                    if (!answer && !answering) onAnswer(option);
                  }}
                >
                  <span className="of-rh-key" aria-hidden="true">
                    {option + 1}
                  </span>
                  <span className="of-choice-pill-text">{reading}</span>
                  {state === "true" ? (
                    <span className="of-rh-badge of-rh-badge--true">
                      <Check size={11} strokeWidth={3} aria-hidden="true" />
                      {t("ui.otomeForge.readHim.truthBadge")}
                    </span>
                  ) : state === "wrong" ? (
                    <span className="of-rh-badge">
                      <X size={11} strokeWidth={3} aria-hidden="true" />
                      {t("ui.otomeForge.readHim.pickBadge")}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="of-choices-status" role="status" aria-live="polite">
          {answering ? t("ui.otomeForge.readHim.answering") : (error ?? "")}
        </p>
        {answer?.tellLearned ? (
          <p className="of-rh-tell">
            <Eye size={14} strokeWidth={2} aria-hidden="true" />
            <span>{t("ui.otomeForge.readHim.tellLearned", { tell: answer.tellLearned })}</span>
          </p>
        ) : null}
        {answer ? (
          <button ref={nextRef} type="button" className="of-button of-button--primary of-rh-next" onClick={onNext}>
            {last ? t("ui.otomeForge.readHim.seeResult") : t("ui.otomeForge.readHim.next")}
          </button>
        ) : null}
      </section>
    </>
  );
}

interface DoneProps {
  li: RunLiView;
  set: ReadHimSetView;
  result: ReadHimFinishResult;
  levelBefore: number;
  doneRef: RefObject<HTMLHeadingElement | null>;
  number: (value: number) => string;
  onAgain: () => void;
  onExit: () => void;
}

function Done({ li, set, result, levelBefore, doneRef, number, onAgain, onExit }: DoneProps) {
  const { t } = useTranslation();
  const name = li.name;
  const total = set.rounds.length;
  const right = set.rounds.filter((round) => round.answer?.correct).length;
  const tells = [
    ...new Set(set.rounds.flatMap((round) => (round.answer?.tellLearned ? [round.answer.tellLearned] : []))),
  ];
  const starlight = result.grants.reduce((sum, grant) => sum + (grant.starlight ?? 0), 0);
  const affection = result.grants.reduce((sum, grant) => sum + (grant.li === li.id ? (grant.affection ?? 0) : 0), 0);
  const rose = li.level > levelBefore;
  return (
    <div className="of-page of-rh-done">
      <section className="of-reader-panel of-chapter-end of-glass of-glass--strong" aria-labelledby="of-rh-done">
        <p className="of-rh-score" aria-hidden="true">
          <span className="of-rh-score-value">{number(right)}</span>
          <span className="of-rh-score-total">/ {number(total)}</span>
        </p>
        <h2 id="of-rh-done" ref={doneRef} className="of-chapter-end-title of-rh-done-title" tabIndex={-1}>
          {t("ui.otomeForge.readHim.score", { name, right: number(right), total: number(total) })}
        </h2>
        <p className="of-subtitle">{t(scoreKey(right, total), { name })}</p>
        {starlight || affection ? (
          <ul className="of-grants">
            {starlight ? (
              <li className="of-grant of-grant--starlight">
                <Sparkle size={16} strokeWidth={1.6} fill="currentColor" aria-hidden="true" />
                <span>{t("ui.otomeForge.reader.grantStarlight", { amount: number(starlight) })}</span>
              </li>
            ) : null}
            {affection ? (
              <li className="of-grant" style={{ "--of-li-accent": accentOf(li) } as CSSProperties} data-rose={rose}>
                <Avatar name={name} url={li.portrait} accent={accentOf(li)} size={30} />
                <span>{t("ui.otomeForge.reader.grantAffection", { name, amount: number(affection) })}</span>
                <span className="of-badge of-badge--soft">
                  {rose
                    ? t("ui.otomeForge.reader.levelUp", { level: li.level })
                    : t("ui.otomeForge.story.level", { level: li.level })}
                </span>
              </li>
            ) : null}
          </ul>
        ) : (
          <p className="of-notice">
            <Sparkle size={14} strokeWidth={1.8} aria-hidden="true" />
            <span>{t("ui.otomeForge.readHim.capped")}</span>
          </p>
        )}
        {tells.length ? (
          <div className="of-rh-tells-block">
            <h3 className="of-rh-tells-title">{t("ui.otomeForge.readHim.tellsTitle")}</h3>
            <ul className="of-rh-tells">
              {tells.map((tell) => (
                <li key={tell} className="of-rh-tell">
                  <Eye size={13} strokeWidth={2} aria-hidden="true" />
                  <span>{tell}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="of-inline-actions">
          <button type="button" className="of-button of-button--quiet of-glass of-button--small" onClick={onExit}>
            {t("ui.otomeForge.readHim.back")}
          </button>
          <button type="button" className="of-button of-button--primary of-button--small" onClick={onAgain}>
            <RotateCcw size={15} strokeWidth={2} aria-hidden="true" />
            {t("ui.otomeForge.readHim.again")}
          </button>
        </div>
      </section>
    </div>
  );
}

// ── Styles: the lead adds READ_HIM_RULES to theme/styles.ts otomeForgeStyles() (before DIALOG_RULES). ──

const R = ".of-root";

/** Read Him's rules, scoped under `.of-root` like the rest of the stylesheet; motion stops under reduced motion there. */
export const READ_HIM_RULES = `
${R} .of-rh { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; isolation: isolate; }
${R} .of-rh::before {
  content: ""; position: absolute; inset: 0; z-index: -1; pointer-events: none;
  background: radial-gradient(95% 52% at 50% 28%, color-mix(in srgb, var(--of-li-accent) 24%, transparent), transparent 72%);
}
${R} .of-rh-head { display: flex; align-items: center; gap: 10px; padding: 2px 16px 6px; }
${R} .of-rh-heading { flex: 1; min-width: 0; display: flex; flex-direction: column; }
${R} .of-rh-eyebrow {
  overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: 0.68rem; font-weight: 800;
  letter-spacing: 0.12em; text-transform: uppercase; color: var(--of-champagne-text);
}
${R} .of-rh-title {
  overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
  font-family: var(--of-font-display); font-weight: 600; font-size: 1.3rem; line-height: 1.12;
}
${R} .of-rh-title:focus, ${R} .of-rh-done-title:focus { outline: none; }
${R} .of-rh-title:focus-visible, ${R} .of-rh-done-title:focus-visible {
  outline: 2px solid var(--of-focus); outline-offset: 3px; border-radius: 6px;
}
${R} .of-rh-hearts { flex: none; display: flex; gap: 3px; margin: 0; padding: 0; list-style: none; color: var(--of-text-faint); }
${R} .of-rh-hearts li { display: grid; place-items: center; }
${R} .of-rh-hearts [data-state="right"] {
  color: color-mix(in srgb, var(--of-li-accent) 70%, ${PALETTE.champagne});
  filter: drop-shadow(0 0 5px var(--of-glow)); animation: of-rh-pop 520ms var(--of-ease) both;
}
${R} .of-rh-hearts [data-state="wrong"] { color: var(--of-text-soft); }
${R} .of-rh-hearts [data-state="current"] { color: var(--of-accent-text); animation: of-breathe 2.4s ease-in-out infinite; }
/* The moment: his face above, the words and the readings below (the readings scroll before the face goes). */
${R} .of-rh-scene {
  position: relative; flex: 1 1 150px; min-height: 104px; display: flex; flex-direction: column; container-type: size;
}
/* The bottom scrolls as one: its parts never shrink (a squeezed box would clip the line). */
${R} .of-rh-bottom {
  flex: 0 1 auto; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 10px;
  padding: 4px 12px max(16px, env(safe-area-inset-bottom)); scrollbar-width: thin;
  scrollbar-color: var(--of-border-strong) transparent;
}
${R} .of-rh-bottom > * { flex-shrink: 0; }
${R} .of-rh-context {
  display: flex; align-items: flex-start; gap: 8px; padding: 10px 14px; border-radius: 16px;
  font-style: italic; font-size: 0.92rem; line-height: 1.5; color: var(--of-text-soft);
  animation: of-rise 480ms var(--of-ease) both;
}
${R} .of-rh-context svg { flex: none; margin-top: 3px; color: var(--of-champagne-text); }
${R} .of-rh-dialogue { min-height: 0; margin-top: 12px; padding: 20px 16px 14px; animation: of-rise 560ms var(--of-ease) 80ms both; }
${R} .of-rh-dialogue .of-line { padding-inline-end: 0; max-height: none; overflow: visible; }
${R} .of-rh-thought { animation: of-fade-in 700ms var(--of-ease) both; }
${R} .of-rh-question {
  font-family: var(--of-font-display); font-style: italic; font-weight: 600; font-size: 1.16rem; line-height: 1.2;
  text-align: center;
}
${R} .of-rh-verdict {
  display: flex; align-items: center; justify-content: center; gap: 8px; margin: 0; text-align: center;
  font-weight: 800; font-size: 0.95rem; color: var(--of-text); animation: of-rh-pop 520ms var(--of-ease) both;
}
${R} .of-rh-verdict svg { flex: none; color: var(--of-text-soft); }
${R} .of-rh-verdict[data-correct="true"] { color: var(--of-champagne-text); }
${R} .of-rh-verdict[data-correct="true"] svg { color: var(--of-champagne-text); filter: drop-shadow(0 0 6px var(--of-wish-glow)); }
${R} .of-rh-reading { min-height: 46px; padding: 9px 14px; }
${R} .of-rh-key {
  flex: none; display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%;
  font-size: 0.72rem; font-weight: 800; color: var(--of-accent-text); border: 1px solid var(--of-border-strong);
}
/* Once answered a reading is settled: it outranks the pill's hover, drops the "busy" fade, and shows only its state
   (the state rules below come later at the same weight). */
${R} .of-rh-reading[aria-disabled="true"]:not([data-state="open"]) {
  cursor: default; opacity: 1; transform: none; border-color: var(--of-border-strong); background: var(--of-surface-strong);
}
${R} .of-rh-reading[aria-disabled="true"][data-state="true"] {
  border-color: rgb(230 201 138 / 0.9);
  background: linear-gradient(135deg, rgb(230 201 138 / 0.3), var(--of-tint-strong)), var(--of-surface-strong);
  box-shadow: inset 0 0 0 1px rgb(230 201 138 / 0.45), 0 0 24px rgb(230 201 138 / 0.32);
  animation: of-rh-glow 900ms var(--of-ease) both;
}
${R} .of-rh-reading[aria-disabled="true"][data-state="true"] .of-rh-key { color: ${PALETTE.ink}; border-color: transparent; background: ${PALETTE.champagne}; }
${R} .of-rh-reading[aria-disabled="true"][data-state="wrong"] {
  border-color: var(--of-danger); animation: of-rh-shake 420ms ease both;
}
${R} .of-rh-reading[aria-disabled="true"][data-state="dim"] { opacity: 0.5; }
${R} .of-rh-badge {
  flex: none; display: inline-flex; align-items: center; gap: 3px; padding: 2px 8px; border-radius: 999px;
  font-size: 0.62rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--of-text); background: var(--of-tint-strong);
}
${R} .of-rh-badge--true { color: ${PALETTE.ink}; background: linear-gradient(135deg, #f3dcaa, ${PALETTE.champagne}); }
${R} .of-rh-tell {
  display: inline-flex; align-items: center; align-self: center; gap: 6px; margin: 0; padding: 5px 12px;
  border-radius: 999px; font-size: 0.8rem; font-weight: 700; color: var(--of-accent-text);
  background: var(--of-tint-strong); border: 1px solid var(--of-border-strong);
  animation: of-rh-pop 620ms var(--of-ease) 120ms both;
}
${R} .of-rh-tell svg { flex: none; }
${R} .of-rh-next { align-self: center; min-width: 180px; }
/* A set that could not be written: the shared panel, with the way back below it. */
${R} .of-rh-failed {
  display: flex; flex-direction: column; gap: 12px; width: min(100%, 560px); margin: auto; padding: 12px 16px;
}
${R} .of-rh-failed .of-actions { justify-content: center; }
/* Before the first moment, and after the last. */
${R} .of-rh-portrait { position: relative; display: grid; place-items: center; margin: 6px 0 4px; }
${R} .of-rh-portrait::before {
  content: ""; position: absolute; inset: -16px; border-radius: 50%; filter: blur(14px); opacity: 0.7;
  background: radial-gradient(circle, var(--of-li-accent), transparent 68%); animation: of-breathe 5s ease-in-out infinite;
}
${R} .of-rh-portrait .of-avatar { position: relative; }
${R} .of-rh-steps { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
${R} .of-rh-step { display: flex; align-items: center; gap: 10px; font-size: 0.92rem; }
${R} .of-rh-step-icon {
  flex: none; display: grid; place-items: center; width: 32px; height: 32px; border-radius: 50%;
  color: var(--of-accent-text); background: var(--of-tint);
}
${R} .of-rh-reward {
  display: flex; align-items: center; gap: 6px; font-size: 0.84rem; font-weight: 700; color: var(--of-champagne-text);
}
${R} .of-rh-reward svg { flex: none; }
${R} .of-rh-done { justify-content: center; }
/* Body-font numerals: the display face draws a 1 like a capital I. */
${R} .of-rh-score {
  display: flex; align-items: baseline; justify-content: center; gap: 6px; margin: 0;
  font-family: var(--of-font-body); font-weight: 800; font-variant-numeric: lining-nums tabular-nums;
}
${R} .of-rh-score-value {
  font-size: 3.4rem; line-height: 1; padding-bottom: 0.04em; background: var(--of-title-ink);
  -webkit-background-clip: text; background-clip: text; color: transparent; animation: of-rh-pop 700ms var(--of-ease) both;
}
${R} .of-rh-score-total { font-size: 1.3rem; font-weight: 700; color: var(--of-text-soft); }
${R} .of-rh-done-title { font-size: 1.5rem; }
${R} .of-rh-done .of-subtitle { max-width: 30ch; }
${R} .of-rh-tells-block { display: flex; flex-direction: column; align-items: center; gap: 6px; }
${R} .of-rh-tells-title {
  margin: 0; font-size: 0.72rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--of-text-soft);
}
${R} .of-rh-tells { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; margin: 0; padding: 0; list-style: none; }
@keyframes of-rh-pop { 0% { opacity: 0; transform: scale(0.86); } 60% { opacity: 1; transform: scale(1.05); } 100% { transform: none; } }
@keyframes of-rh-shake {
  0%, 100% { transform: none; } 25% { transform: translateX(-5px); } 50% { transform: translateX(4px); } 75% { transform: translateX(-2px); }
}
@keyframes of-rh-glow {
  from { box-shadow: inset 0 0 0 1px rgb(230 201 138 / 0.45), 0 0 0 0 rgb(230 201 138 / 0.75); }
  to { box-shadow: inset 0 0 0 1px rgb(230 201 138 / 0.45), 0 0 24px rgb(230 201 138 / 0.32); }
}`;
