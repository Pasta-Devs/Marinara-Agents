// ──────────────────────────────────────────────
// Otome Hearth: Read Me (#1945), Read {{name}} in reverse. One love interest makes four guesses about the protagonist,
// each about what they like, dislike, do, fear or dream of; the player says whether each is spot on, close or not at
// all, may add the truth in their own words, and hears the reaction. What the player says goes into that love
// interest's notebook, which the player can read, correct and delete from here. Finishing pays within the day's caps,
// more for each guess spot on or close, and a set left half-played picks up where it stopped.
// ──────────────────────────────────────────────
// Routes (S/routes/read-me.ts): POST /runs/:run/read-me {li} → ReadMeSetView (never a reaction before its guess is
// answered); POST .../read-me/:set/answer {guess, verdict, words?} → ReadMeAnswer (the first answer is final; words that
// sound like health or the body are refused, 400, and nothing is saved); POST .../read-me/:set/finish → {grants,
// starlight, known} (pays once; `known` is the notebook after it). The Dates hub opens it with ActivityScreenProps, and
// the router focuses its <h1> on arrival and gives the top bar's Back (to Dates). The flow, its focus and the failed-
// start panel are Read Him's (ReadHim.tsx), as are most of its classes: a verdict is picked with its button (a toggle,
// aria-pressed) or keys 1–3, which never fire while the player types in a field, then sent with the words; focus moves
// to each new guess, to Next after an answer, and to the result; the reaction goes to a polite live region. The guess
// and the reaction are voiced as Read Him's lines are. Nothing here reads the period tracker.
import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Heart, HeartCrack, MessageCircleHeart, NotebookPen, RotateCcw, ScanHeart, Sparkle } from "lucide-react";
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
import {
  READ_ME_GUESSES,
  READ_ME_VERDICTS,
  READ_ME_WORDS_MAX,
  type NotebookView,
  type ReadMeAnswer,
  type ReadMeFinishResult,
  type ReadMeSetView,
  type ReadMeVerdict,
} from "../../shared/read-me";
import { PALETTE } from "../../theme/tokens";
import { FACE_LABEL_KEYS, FacePlate } from "../reader/FacePlate";
import { playQueryKey, type ActivityScreenProps } from "./DatesHub";
import { CATEGORY_KEYS, Notebook, notebookQueryKey, VERDICT_ICONS, VERDICT_KEYS, wordsErrorMessage } from "./Notebook";

type Phase =
  | { kind: "intro" }
  | { kind: "loading"; what: "start" | "finish" }
  | { kind: "failed"; error: unknown; retry: "start" | "finish" }
  | { kind: "play"; guess: number }
  | { kind: "done"; result: ReadMeFinishResult };

type FocusTarget = "guess" | "next" | "done" | "retry";

/** The answer being made to the guess on screen, before it is sent. */
interface Draft {
  verdict: ReadMeVerdict | null;
  words: string;
}
const NO_DRAFT: Draft = { verdict: null, words: "" };

/** Keys typed into a field are the player's words, never a verdict. */
function typing(target: EventTarget): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** `li` is the love interest who reads the protagonist; a set left unfinished is kept, and the next Read Me picks it up. */
export function ReadMe({ runKey, view, li: picked, onExit }: ActivityScreenProps) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const { locale } = useOtomeProps().localization;
  // The run's current view of them (their level rises after a finish).
  const li = view.lis.find((entry) => entry.id === picked.id) ?? null;
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  const [set, setSet] = useState<ReadMeSetView | null>(null);
  const [draft, setDraft] = useState<Draft>(NO_DRAFT);
  const [answering, setAnswering] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const levelBefore = useRef(li?.level ?? 1);

  // Focus moves only after the player's own action here (the router focuses the <h1> on arrival).
  const pendingFocus = useRef<FocusTarget | null>(null);
  const guessRef = useRef<HTMLHeadingElement>(null);
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
        : { guess: guessRef, next: nextRef, done: doneRef }[target].current;
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
          {t("ui.otomeForge.readMe.back")}
        </button>
      </div>
    );
  }
  const name = li.name;
  const accent = accentOf(li);
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  const setPath = (id: string) => `${runPath(runKey)}/read-me/${encodeURIComponent(id)}`;

  const fail = (error: unknown, retry: "start" | "finish") => {
    pendingFocus.current = "retry";
    setPhase({ kind: "failed", error, retry });
  };

  const finish = async (current: ReadMeSetView) => {
    levelBefore.current = li.level;
    setPhase({ kind: "loading", what: "finish" });
    try {
      const result = await otome.post<ReadMeFinishResult>(`${setPath(current.setId)}/finish`);
      patchRun(queryClient, runKey, (run) => ({ ...run, starlight: result.starlight }));
      // What they know now is the finish's own answer: the notebook below shows it without asking again.
      queryClient.setQueryData<NotebookView>(notebookQueryKey(runKey, li.id), { li: li.id, entries: result.known });
      // Their level comes back with the run, and today's rewards with the Dates hub's play view.
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
    setDraft(NO_DRAFT);
    setAnswerError(null);
    setAnnouncement("");
    try {
      const next = await otome.post<ReadMeSetView>(`${runPath(runKey)}/read-me`, { li: li.id });
      setSet(next);
      const open = next.guesses.findIndex((guess) => !guess.answer);
      if (open < 0) {
        await finish(next);
        return;
      }
      pendingFocus.current = "guess";
      setPhase({ kind: "play", guess: open });
    } catch (error) {
      fail(error, "start");
    }
  };

  const answer = async (guess: number) => {
    if (!set || answering || set.guesses[guess]?.answer) return;
    if (!draft.verdict) {
      setAnswerError(t("ui.otomeForge.readMe.pickFirst"));
      return;
    }
    const words = draft.words.trim();
    setAnswering(true);
    setAnswerError(null);
    try {
      const result = await otome.post<ReadMeAnswer>(`${setPath(set.setId)}/answer`, {
        guess,
        verdict: draft.verdict,
        ...(words ? { words } : {}),
      });
      setSet((current) =>
        current
          ? {
              ...current,
              guesses: current.guesses.map((entry, index) => (index === guess ? { ...entry, answer: result } : entry)),
            }
          : current,
      );
      setAnnouncement(
        t("ui.otomeForge.readMe.announce", {
          name,
          verdict: t(VERDICT_KEYS[result.verdict]),
          reaction: result.reaction,
        }),
      );
      pendingFocus.current = "next";
    } catch (error) {
      // Refused words stay in the field, to be changed and sent again.
      setAnswerError(wordsErrorMessage(otome, t, error));
    } finally {
      setAnswering(false);
    }
  };

  const advance = (guess: number) => {
    if (!set) return;
    setAnnouncement("");
    setDraft(NO_DRAFT);
    setAnswerError(null);
    if (guess + 1 < set.guesses.length) {
      pendingFocus.current = "guess";
      setPhase({ kind: "play", guess: guess + 1 });
    } else {
      void finish(set);
    }
  };

  const total = set?.guesses.length ?? READ_ME_GUESSES;
  const playing = phase.kind === "play" ? phase.guess : null;
  // The marks belong to the set on screen: not while a new one is being written.
  const scoring =
    !!set && (phase.kind === "play" || phase.kind === "done" || (phase.kind === "loading" && phase.what === "finish"));
  const count = (verdict: ReadMeVerdict) =>
    set?.guesses.filter((guess) => guess.answer?.verdict === verdict).length ?? 0;

  const label = (guess: number) => t("ui.otomeForge.readMe.guess", { number: number(guess + 1), total: number(total) });

  const pick = (verdict: ReadMeVerdict) => {
    if (answering) return;
    setAnswerError(null);
    setDraft((current) => ({ ...current, verdict }));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (playing === null || !set || event.altKey || event.ctrlKey || event.metaKey || typing(event.target)) return;
    const verdict = /^[1-3]$/u.test(event.key) ? READ_ME_VERDICTS[Number(event.key) - 1] : undefined;
    if (!verdict || set.guesses[playing]?.answer) return;
    event.preventDefault();
    pick(verdict);
  };

  return (
    <div className="of-rh of-rm" style={{ "--of-li-accent": accent } as CSSProperties} onKeyDown={onKeyDown}>
      <header className="of-rh-head">
        <div className="of-rh-heading">
          <p className="of-rh-eyebrow">{playing !== null ? label(playing) : t("ui.otomeForge.common.screenDates")}</p>
          <h1 className="of-rh-title" tabIndex={-1}>
            {t("ui.otomeForge.readMe.title", { name })}
          </h1>
        </div>
        {scoring && set ? <Marks set={set} current={playing} /> : null}
      </header>
      {scoring ? (
        <p className="of-visually-hidden">
          {t("ui.otomeForge.readMe.progress", { right: number(count("right")), close: number(count("close")) })}
        </p>
      ) : null}

      {phase.kind === "intro" ? (
        <Intro runKey={runKey} li={li} onBegin={() => void start()} />
      ) : phase.kind === "loading" ? (
        <div className="of-center" role="status">
          <Heart className="of-pulse" size={28} strokeWidth={1.6} fill="currentColor" aria-hidden="true" />
          <p className="of-body">
            {phase.what === "start" ? t("ui.otomeForge.readMe.loading", { name }) : t("ui.otomeForge.readMe.finishing")}
          </p>
        </div>
      ) : phase.kind === "failed" && phase.retry === "start" ? (
        // Writing the set failed (a refusal, no connection, a bad reply): said honestly, with Retry and Switch connection.
        <div ref={failedRef} className="of-rh-failed">
          <DeclinedPanel error={phase.error} run={view} job="structured" onRetry={() => void start()} />
          <div className="of-actions">
            <button type="button" className="of-button of-button--quiet of-glass" onClick={onExit}>
              {t("ui.otomeForge.readMe.back")}
            </button>
          </div>
        </div>
      ) : phase.kind === "failed" ? (
        <div className="of-center">
          <div className="of-panel of-panel--center of-card of-glass" role="alert">
            <p className="of-error">{otome.errorMessage(phase.error)}</p>
            <div className="of-actions">
              <button type="button" className="of-button of-button--quiet of-glass" onClick={onExit}>
                {t("ui.otomeForge.readMe.back")}
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
        <Guess
          key={phase.guess}
          li={li}
          set={set}
          index={phase.guess}
          label={label(phase.guess)}
          draft={draft}
          answering={answering}
          error={answerError}
          guessRef={guessRef}
          nextRef={nextRef}
          onPick={pick}
          onWords={(words) => setDraft((current) => ({ ...current, words }))}
          onAnswer={() => void answer(phase.guess)}
          onNext={() => advance(phase.guess)}
        />
      ) : phase.kind === "done" && set ? (
        <Done
          runKey={runKey}
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

/** One mark per guess: a full heart spot on, an open one close, a cracked one not at all; the open guess breathes. */
function Marks({ set, current }: { set: ReadMeSetView; current: number | null }) {
  return (
    <ol className="of-rh-hearts" aria-hidden="true">
      {set.guesses.map((guess, index) => {
        const state = guess.answer?.verdict ?? (index === current ? "current" : "ahead");
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

function Intro({ runKey, li, onBegin }: { runKey: string; li: RunLiView; onBegin: () => void }) {
  const { t } = useTranslation();
  const [notebook, setNotebook] = useState(false);
  const notebookId = useId();
  const name = li.name;
  const steps = [
    { Icon: ScanHeart, text: t("ui.otomeForge.readMe.stepGuess", { name }) },
    { Icon: MessageCircleHeart, text: t("ui.otomeForge.readMe.stepAnswer") },
    { Icon: NotebookPen, text: t("ui.otomeForge.readMe.stepRemember", { name }) },
  ];
  return (
    <div className="of-page of-rh-intro">
      <div className="of-page-head">
        <span className="of-rh-portrait">
          <Avatar name={name} url={li.portrait} accent={accentOf(li)} size={104} />
        </span>
        <p className="of-hand">{t("ui.otomeForge.readMe.question", { name })}</p>
        <p className="of-body">{t("ui.otomeForge.readMe.introLead", { name })}</p>
      </div>
      <section className="of-section of-glass" aria-labelledby="of-rm-how">
        <h2 id="of-rm-how" className="of-section-title">
          {t("ui.otomeForge.readMe.howTitle")}
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
            {t("ui.otomeForge.readMe.reward", {
              starlight: STARLIGHT_EARNINGS.readMe,
              affection: AFFECTION_EARNINGS.readMe,
              right: AFFECTION_EARNINGS.readMeRight,
              close: AFFECTION_EARNINGS.readMeClose,
            })}
          </span>
        </p>
        <p className="of-hint">{t("ui.otomeForge.readMe.modelNote")}</p>
      </section>
      <div className="of-actions">
        <button
          type="button"
          className="of-button of-button--quiet of-glass"
          aria-expanded={notebook}
          aria-controls={notebook ? notebookId : undefined}
          onClick={() => setNotebook((open) => !open)}
        >
          <NotebookPen size={16} strokeWidth={2} aria-hidden="true" />
          {t("ui.otomeForge.readMe.notebookTitle", { name })}
        </button>
        <button type="button" className="of-button of-button--primary" onClick={onBegin}>
          <ScanHeart size={16} strokeWidth={2} aria-hidden="true" />
          {t("ui.otomeForge.readMe.begin")}
        </button>
      </div>
      {notebook ? (
        <div id={notebookId}>
          <Notebook runKey={runKey} li={li} />
        </div>
      ) : null}
    </div>
  );
}

interface GuessProps {
  li: RunLiView;
  set: ReadMeSetView;
  index: number;
  /** "Guess n of 4", the guess's heading. */
  label: string;
  draft: Draft;
  answering: boolean;
  error: string | null;
  guessRef: RefObject<HTMLHeadingElement | null>;
  nextRef: RefObject<HTMLButtonElement | null>;
  onPick: (verdict: ReadMeVerdict) => void;
  onWords: (words: string) => void;
  onAnswer: () => void;
  onNext: () => void;
}

function Guess({
  li,
  set,
  index,
  label,
  draft,
  answering,
  error,
  guessRef,
  nextRef,
  onPick,
  onWords,
  onAnswer,
  onNext,
}: GuessProps) {
  const { t } = useTranslation();
  const id = useId();
  const guess = set.guesses[index]!;
  const { answer } = guess;
  const name = li.name;
  const last = index === set.guesses.length - 1;
  const face = answer ? answer.face : guess.face;
  const line = answer ? answer.reaction : guess.line;
  const faceLabel = face ? t(FACE_LABEL_KEYS[face]) : "";
  const chosen = answer?.verdict ?? draft.verdict;

  // The guess is voiced once, as it opens, and the reaction once it comes (never for a guess answered before, when a
  // set is picked up again); leaving the guess stops it. The snapshot re-renders this when the voice settings change.
  const audio = useOtomeAudio();
  useAudioSnapshot();
  const [opened] = useState(() => !guess.answer);
  const said: Segment = { speaker: name, text: line, ...(face ? { expression: face } : {}) };
  const voicedRef = opened && audio?.wouldSpeak(said) ? `readme:${set.setId}:${index}${answer ? ":reaction" : ""}` : "";
  useEffect(() => {
    if (!audio || !voicedRef) return;
    void audio.speak(said, voicedRef);
    return () => audio.stopVoice();
    // Once per line: the line belongs to its ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio, voicedRef]);

  const fieldId = `${id}-words`;
  const statusId = `${id}-status`;
  return (
    <>
      <div className="of-rh-scene">
        <FacePlate li={li} face={face} speaking />
      </div>
      <section className="of-rh-bottom" aria-labelledby={`${id}-heading`}>
        <h2 id={`${id}-heading`} ref={guessRef} className="of-visually-hidden" tabIndex={-1}>
          {label}
        </h2>
        {set.context ? (
          <p className="of-rh-context of-glass">
            <ScanHeart size={15} strokeWidth={2} aria-hidden="true" />
            <span>{set.context}</span>
          </p>
        ) : null}
        <div className="of-dialogue of-glass of-glass--strong of-rh-dialogue" data-voice="li">
          <p className="of-nameplate" data-voice="li">
            <span>{name}</span>
            <span className="of-nameplate-tag">{t(CATEGORY_KEYS[guess.category])}</span>
          </p>
          <p className="of-line">
            <span className="of-visually-hidden">
              {faceLabel
                ? t("ui.otomeForge.reader.announceLineFace", { name, face: faceLabel, text: line })
                : t("ui.otomeForge.reader.announceLine", { name, text: line })}
            </span>
            <span aria-hidden="true">{line}</span>
          </p>
        </div>
        {answer ? (
          <p className="of-rm-recap">{t("ui.otomeForge.readMe.guessed", { name, line: guess.line })}</p>
        ) : (
          <p className="of-rh-question" id={`${id}-question`}>
            {t("ui.otomeForge.readMe.question", { name })}
          </p>
        )}
        <div
          className="of-segmented of-glass of-rm-verdicts"
          role="group"
          aria-labelledby={answer ? undefined : `${id}-question`}
          aria-label={answer ? t("ui.otomeForge.readMe.yourAnswer") : undefined}
        >
          {READ_ME_VERDICTS.map((verdict, option) => {
            const Icon = VERDICT_ICONS[verdict];
            const pressed = chosen === verdict;
            return (
              <button
                key={verdict}
                type="button"
                className="of-segment of-rm-verdict"
                data-checked={pressed}
                aria-pressed={pressed}
                aria-disabled={!!answer || answering}
                aria-keyshortcuts={answer ? undefined : String(option + 1)}
                onClick={() => {
                  if (!answer) onPick(verdict);
                }}
              >
                {/* Its key while it can be picked; once answered, the mark the notebook shows. */}
                {answer ? (
                  <Icon size={16} strokeWidth={2} aria-hidden="true" />
                ) : (
                  <span className="of-rh-key" aria-hidden="true">
                    {option + 1}
                  </span>
                )}
                <span>{t(VERDICT_KEYS[verdict])}</span>
              </button>
            );
          })}
        </div>
        {answer ? (
          answer.words ? (
            <p className="of-rm-said">{t("ui.otomeForge.readMe.youSaid", { words: answer.words })}</p>
          ) : null
        ) : (
          <div className="of-field of-rm-words">
            <label className="of-label" htmlFor={fieldId}>
              {t("ui.otomeForge.readMe.wordsLabel")}
            </label>
            <textarea
              id={fieldId}
              className="of-input of-textarea"
              rows={2}
              value={draft.words}
              maxLength={READ_ME_WORDS_MAX}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${fieldId}-hint ${statusId}` : `${fieldId}-hint`}
              onChange={(event) => onWords(event.target.value)}
            />
            <p id={`${fieldId}-hint`} className="of-field-hint">
              <span>{t("ui.otomeForge.readMe.wordsHint", { name })}</span>
              <span className="of-counter">
                {draft.words.length} / {READ_ME_WORDS_MAX}
              </span>
            </p>
          </div>
        )}
        <p id={statusId} className="of-choices-status" role="status" aria-live="polite">
          {answering ? t("ui.otomeForge.readMe.answering", { name }) : (error ?? "")}
        </p>
        {answer ? (
          <button ref={nextRef} type="button" className="of-button of-button--primary of-rh-next" onClick={onNext}>
            {last ? t("ui.otomeForge.readMe.seeResult", { name }) : t("ui.otomeForge.readMe.next")}
          </button>
        ) : (
          <button
            type="button"
            className="of-button of-button--primary of-rh-next"
            aria-disabled={!draft.verdict || answering}
            onClick={onAnswer}
          >
            <MessageCircleHeart size={16} strokeWidth={2} aria-hidden="true" />
            {t("ui.otomeForge.readMe.answer", { name })}
          </button>
        )}
      </section>
    </>
  );
}

interface DoneProps {
  runKey: string;
  li: RunLiView;
  set: ReadMeSetView;
  result: ReadMeFinishResult;
  levelBefore: number;
  doneRef: RefObject<HTMLHeadingElement | null>;
  number: (value: number) => string;
  onAgain: () => void;
  onExit: () => void;
}

function Done({ runKey, li, set, result, levelBefore, doneRef, number, onAgain, onExit }: DoneProps) {
  const { t } = useTranslation();
  const name = li.name;
  const count = (verdict: ReadMeVerdict) => set.guesses.filter((guess) => guess.answer?.verdict === verdict).length;
  const starlight = result.grants.reduce((sum, grant) => sum + (grant.starlight ?? 0), 0);
  const affection = result.grants.reduce((sum, grant) => sum + (grant.li === li.id ? (grant.affection ?? 0) : 0), 0);
  const rose = li.level > levelBefore;
  return (
    <div className="of-page of-rm-done">
      <section className="of-reader-panel of-chapter-end of-glass of-glass--strong" aria-labelledby="of-rm-done">
        <span className="of-rh-portrait">
          <Avatar name={name} url={li.portrait} accent={accentOf(li)} size={72} />
        </span>
        <h2 id="of-rm-done" ref={doneRef} className="of-chapter-end-title of-rh-done-title" tabIndex={-1}>
          {t("ui.otomeForge.readMe.doneTitle", { name })}
        </h2>
        <p className="of-rm-score">
          {t("ui.otomeForge.readMe.doneScore", {
            right: number(count("right")),
            close: number(count("close")),
            wrong: number(count("wrong")),
          })}
        </p>
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
            <span>{t("ui.otomeForge.readMe.capped")}</span>
          </p>
        )}
        <div className="of-inline-actions">
          <button type="button" className="of-button of-button--quiet of-glass of-button--small" onClick={onExit}>
            {t("ui.otomeForge.readMe.back")}
          </button>
          <button type="button" className="of-button of-button--primary of-button--small" onClick={onAgain}>
            <RotateCcw size={15} strokeWidth={2} aria-hidden="true" />
            {t("ui.otomeForge.readMe.again")}
          </button>
        </div>
      </section>
      <Notebook runKey={runKey} li={li} />
    </div>
  );
}

// ── Styles: theme/styles.ts otomeForgeStyles() adds READ_ME_RULES after READ_HIM_RULES, whose classes this reuses. ──

const R = ".of-root";

/** Read Me's own rules (the verdict buttons, the notebook), scoped under `.of-root` like the rest of the stylesheet. */
export const READ_ME_RULES = `
${R} .of-rh-hearts [data-state="close"] { color: color-mix(in srgb, var(--of-li-accent) 70%, ${PALETTE.champagne}); }
/* The verdicts: a toggle group drawn as Settings' segmented control; once answered, only the answer stays lit. */
${R} .of-rm-verdict {
  flex-direction: row; flex-wrap: wrap; gap: 6px; min-height: 50px; border: 0; background: transparent; font-size: 0.86rem;
}
${R} .of-rm-verdict[aria-disabled="true"] { cursor: default; }
${R} .of-rm-verdict[aria-disabled="true"]:not([aria-pressed="true"]) { opacity: 0.55; }
${R} .of-rm-verdict .of-rh-key { width: 20px; height: 20px; font-size: 0.68rem; }
${R} .of-rm-verdict[aria-pressed="true"] .of-rh-key { color: ${PALETTE.ink}; border-color: rgb(43 26 46 / 0.35); }
${R} .of-rm-words .of-textarea { min-height: 56px; }
${R} .of-rm-recap {
  text-align: center; font-family: var(--of-font-display); font-style: italic; font-size: 1rem; line-height: 1.3;
  color: var(--of-text-soft); overflow-wrap: anywhere;
}
${R} .of-rm-said { font-size: 0.88rem; font-style: italic; color: var(--of-text); overflow-wrap: anywhere; }
${R} .of-rh-bottom > .of-rm-said { text-align: center; }
/* Body-font numerals: the display face draws a 0 like an o. */
${R} .of-rm-score { font-weight: 700; font-size: 0.92rem; color: var(--of-text-soft); font-variant-numeric: lining-nums; }
/* The result, then the notebook under it: the page scrolls from the top (centring would clip a long notebook). */
${R} .of-rm-done .of-reader-panel { flex: none; }
/* The notebook. */
${R} .of-rm-notebook { flex: none; }
${R} .of-rm-notebook-title { display: flex; align-items: center; gap: 8px; }
${R} .of-rm-notebook-title svg { flex: none; color: var(--of-accent-text); }
${R} .of-rm-notebook-title:focus { outline: none; }
${R} .of-rm-notebook-title:focus-visible { outline: 2px solid var(--of-focus); outline-offset: 3px; border-radius: 6px; }
${R} .of-rm-group { display: flex; flex-direction: column; gap: 6px; }
${R} .of-rm-group-title {
  font-size: 0.72rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--of-text-soft);
}
${R} .of-rm-entries { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
${R} .of-rm-entry {
  display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding: 10px 12px; border-radius: 14px;
  background: var(--of-surface-hover); border-inline-start: 3px solid var(--of-border-strong);
}
${R} .of-rm-entry[data-verdict="right"] { border-inline-start-color: var(--of-li-accent); }
${R} .of-rm-entry-text { font-size: 0.95rem; overflow-wrap: anywhere; }
${R} .of-rm-entry > :is(.of-rm-edit, .of-rm-said) { align-self: stretch; }
${R} .of-rm-mark {
  display: inline-flex; align-items: center; gap: 4px; padding: 2px 9px; border-radius: 999px;
  font-size: 0.7rem; font-weight: 800; letter-spacing: 0.04em; color: var(--of-text); background: var(--of-tint-strong);
}
${R} .of-rm-mark svg { flex: none; }
${R} .of-rm-mark[data-verdict="right"] { color: ${PALETTE.ink}; background: linear-gradient(135deg, #f3dcaa, ${PALETTE.champagne}); }
${R} .of-rm-edit { display: flex; flex-direction: column; gap: 8px; }
${R} .of-rm-quote { font-style: italic; overflow-wrap: anywhere; }`;
