// ──────────────────────────────────────────────
// Otome Hearth: Tarot night (#2151), a Dates activity. Three cards of the Major Arcana, laid out with one love
// interest as Past, Present and Future: they read the protagonist's cards ("reads-you", answering a question asked by
// chip or in the player's own words), or the protagonist reads theirs ("you-read", picking one of three readings for
// each card, voiced in the persona's voice, to which they react). Every reading pays within the day's caps.
// ──────────────────────────────────────────────
// Routes (S/routes/tarot.ts): GET /runs/:run/lis/:li/tarot → TarotView {open, deck}; POST /runs/:run/tarot {li, mode,
// question?, picks} → TarotReadingView; POST .../tarot/:reading/answer {card, pick} → TarotAnswer (the first answer is
// final); POST .../tarot/:reading/finish → {grants, starlight}; the deck's paint taps POST /runs/:run/art/tarot {li,
// card} (and .../prompt for review), through the item paint taps (hooks/use-items).
// - An unfinished reading opens straight at Play (as Read Me picks its set up); otherwise the intro picks the mode and
//   the question, then the player picks three of 22 face-down cards (a toggle each, a roving tabindex with the arrow
//   keys and Home/End, numbered in the order picked) or lets fate choose. Which card lies where is the server's draw.
// - Play turns the cards one at a time (a tap on the next card, Enter, or Turn it; a 400 ms flip, none under reduced
//   motion); a turned card opens large in a dialog. Each line is voiced once (`tarot:<id>:<step>`), the player's
//   reading in the persona's voice. Readings are picked by button or keys 1–3, never while the player types. Focus goes
//   to each new line, then to the result. The finish is posted as the closing line shows.
// - The deck: each card shows its painting once it is ready (crossfading in), our SVG card until then with a small
//   "Painting…" badge while it paints (this screen reads the deck again every few seconds meanwhile, the Done screen
//   too); turned cards held for consent offer one Paint these cards bar, a failed or stopped one Try painting it again
//   (a face-down card is never named, by its prompt review either). Without an image connection the cards are ours,
//   with no paint controls.
import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, Layers, MoonStar, Paintbrush, RotateCcw, Sparkle, Sparkles, WandSparkles } from "lucide-react";
import { useOtomeApi } from "../../api";
import { Avatar } from "../../components/Avatar";
import { CostHint } from "../../components/CostHint";
import { DeclinedPanel } from "../../components/DeclinedPanel";
import { Dialog } from "../../components/Dialog";
import { ARCANA_NAME_KEYS, TarotBack, TarotCard, TarotFace } from "../../components/TarotCard";
import { imagesOn, tarotPaintTarget, tarotQueryKey, useItemActions, type ItemActions } from "../../hooks/use-items";
import { useAudioSnapshot, useOtomeAudio } from "../../hooks/use-otome-audio";
import { runPath } from "../../hooks/use-reader";
import { patchRun, runQueryKey } from "../../hooks/use-run";
import { accentOf } from "../../lib/accent";
import { useOtomeProps } from "../../props";
import type { RunLiView, RunView, Segment } from "../../shared/api-types";
import { AFFECTION_EARNINGS, STARLIGHT_EARNINGS } from "../../shared/economy";
import type { Face } from "../../shared/faces";
import {
  ARCANA,
  deckKey,
  TAROT_CARDS,
  TAROT_MODES,
  TAROT_POSITIONS,
  TAROT_QUESTIONS,
  TAROT_QUESTION_MAX,
  type Arcana,
  type TarotAnswer,
  type TarotChip,
  type TarotDeckCard,
  type TarotFinishResult,
  type TarotMode,
  type TarotPosition,
  type TarotQuestion,
  type TarotReadingView,
  type TarotView,
} from "../../shared/tarot";
import { PALETTE } from "../../theme/tokens";
import { FacePlate } from "../reader/FacePlate";
import { PaintReviewDialog } from "../wish/TenPullGrid";
import { playQueryKey, type ActivityScreenProps } from "./DatesHub";
import { WaitQuiz } from "../story/PersonalityQuiz";

/** While a shown card paints, the deck is read again this often (as the Shop and the Wardrobe do). */
const POLL_MS = 3_000;

type Phase =
  | { kind: "opening" }
  | { kind: "intro" }
  | { kind: "pick" }
  | { kind: "loading"; what: "start" | "finish" }
  | { kind: "failed"; error: unknown; retry: "open" | "start" | "finish" }
  /** 0: the opening line; n: card n − 1 turned and read. */
  | { kind: "play"; step: number }
  | { kind: "done"; result: TarotFinishResult };

type FocusTarget = "title" | "line" | "next" | "pick" | "done" | "retry";

const MODE_KEYS: Record<TarotMode, { title: string; text: string }> = {
  "reads-you": { title: "ui.otomeForge.tarot.modeReadsYou", text: "ui.otomeForge.tarot.modeReadsYouText" },
  "you-read": { title: "ui.otomeForge.tarot.modeYouRead", text: "ui.otomeForge.tarot.modeYouReadText" },
};
const CHIP_KEYS: Record<TarotChip, string> = {
  us: "ui.otomeForge.tarot.chipUs",
  coming: "ui.otomeForge.tarot.chipComing",
  heart: "ui.otomeForge.tarot.chipHeart",
};
const POSITION_KEYS: Record<TarotPosition, string> = {
  past: "ui.otomeForge.tarot.positionPast",
  present: "ui.otomeForge.tarot.positionPresent",
  future: "ui.otomeForge.tarot.positionFuture",
};

/** Keys typed into a field are the player's words, never a reading. */
function typing(target: EventTarget): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** GET /runs/:run/lis/:li/tarot, read again while one of the deck's cards paints. */
function useTarot(runKey: string, li: string) {
  const otome = useOtomeApi();
  return useQuery({
    queryKey: [...tarotQueryKey(runKey), li],
    queryFn: () => otome.get<TarotView>(`${runPath(runKey)}/lis/${encodeURIComponent(li)}/tarot`),
    // Read on every visit: an open reading decides where Tarot night opens (the Engine's client keeps reads fresh longer).
    staleTime: 0,
    refetchInterval: (query) =>
      Object.values(query.state.data?.deck ?? {}).some((entry) => entry.art.state === "pending") ? POLL_MS : false,
  });
}

/** Where a reading picks up: its opening, or in "you-read" the first card still to read (the last when every card is). */
function resumeStep(reading: TarotReadingView): number {
  if (reading.mode === "reads-you") return 0;
  const open = reading.cards.findIndex((card) => !card.answer);
  return open < 0 ? TAROT_CARDS : open === 0 ? 0 : open + 1;
}

/** `li` is the love interest the cards are laid out with; an unfinished reading is kept and opens at once. */
export function TarotNight({ runKey, view, li: picked, onExit }: ActivityScreenProps) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const { locale } = useOtomeProps().localization;
  const li = view.lis.find((entry) => entry.id === picked.id) ?? null;
  const tarot = useTarot(runKey, picked.id);
  const actions = useItemActions(runKey);
  const [phase, setPhase] = useState<Phase>({ kind: "opening" });
  const [reading, setReading] = useState<TarotReadingView | null>(null);
  const [mode, setMode] = useState<TarotMode>("reads-you");
  const [chip, setChip] = useState<TarotChip | null>(null);
  const [own, setOwn] = useState("");
  const [picks, setPicks] = useState<number[]>([]);
  const [answering, setAnswering] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [enlarged, setEnlarged] = useState<number | null>(null);
  const levelBefore = useRef(li?.level ?? 1);

  // Focus moves only after the player's own action here (the router focuses the <h1> on arrival).
  const pendingFocus = useRef<FocusTarget | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const lineRef = useRef<HTMLHeadingElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const pickRef = useRef<HTMLHeadingElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const failedRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    const element =
      target === "retry"
        ? (retryRef.current ?? failedRef.current?.querySelector<HTMLElement>("[data-autofocus]"))
        : { title: titleRef, line: lineRef, next: nextRef, pick: pickRef, done: doneRef }[target].current;
    if (!element) return;
    pendingFocus.current = null;
    element.focus({ preventScroll: true });
    if (target === "next") element.scrollIntoView({ block: "nearest" });
  });

  // An unfinished reading opens at once; otherwise the intro.
  const data = tarot.data;
  useEffect(() => {
    if (phase.kind !== "opening" || tarot.isFetching) return;
    if (tarot.isError) {
      setPhase({ kind: "failed", error: tarot.error, retry: "open" });
      return;
    }
    // A copy cached from an earlier visit may hold a reading finished since: only a read made now decides.
    if (!data || !tarot.isFetchedAfterMount) return;
    if (!data.open) {
      setPhase({ kind: "intro" });
      return;
    }
    setReading(data.open);
    setPhase({ kind: "play", step: resumeStep(data.open) });
    // The first answer decides; later reads only refresh the deck.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, tarot.isError, tarot.isFetching, tarot.isFetchedAfterMount, phase.kind]);

  if (!li) {
    return (
      <div className="of-center">
        <p className="of-error" role="alert">
          {t("ui.otomeForge.errors.notFound")}
        </p>
        <button type="button" className="of-button of-button--quiet of-glass" onClick={onExit}>
          {t("ui.otomeForge.tarot.back")}
        </button>
      </div>
    );
  }
  const name = li.name;
  const accent = accentOf(li);
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  const readingPath = (id: string) => `${runPath(runKey)}/tarot/${encodeURIComponent(id)}`;
  const deck = data?.deck ?? {};

  const fail = (error: unknown, retry: "open" | "start" | "finish") => {
    pendingFocus.current = "retry";
    setPhase({ kind: "failed", error, retry });
  };

  const finish = async (current: TarotReadingView) => {
    levelBefore.current = li.level;
    setPhase({ kind: "loading", what: "finish" });
    try {
      const result = await otome.post<TarotFinishResult>(`${readingPath(current.id)}/finish`);
      patchRun(queryClient, runKey, (run) => ({ ...run, starlight: result.starlight }));
      // Their level comes back with the run, and today's rewards with the Dates hub's play view.
      void queryClient.invalidateQueries({ queryKey: runQueryKey(runKey) });
      void queryClient.invalidateQueries({ queryKey: playQueryKey(runKey) });
      void queryClient.invalidateQueries({ queryKey: tarotQueryKey(runKey) });
      pendingFocus.current = "done";
      setPhase({ kind: "done", result });
    } catch (error) {
      fail(error, "finish");
    }
  };

  const question = (): TarotQuestion | null =>
    mode !== "reads-you" ? null : own.trim() ? { own: own.trim() } : chip ? { chip } : null;

  const start = async () => {
    if (picks.length !== TAROT_CARDS) return;
    setPhase({ kind: "loading", what: "start" });
    setAnswerError(null);
    setAnnouncement("");
    try {
      const asked = question();
      const next = await otome.post<TarotReadingView>(`${runPath(runKey)}/tarot`, {
        li: li.id,
        mode,
        ...(asked ? { question: asked } : {}),
        picks,
      });
      setReading(next);
      // The drawn cards were just claimed for the deck: read it again for their paint.
      void queryClient.invalidateQueries({ queryKey: tarotQueryKey(runKey) });
      pendingFocus.current = "line";
      setPhase({ kind: "play", step: resumeStep(next) });
    } catch (error) {
      fail(error, "start");
    }
  };

  const answer = async (card: number, pick: number) => {
    if (!reading || answering || reading.cards[card]?.answer) return;
    setAnswering(true);
    setAnswerError(null);
    try {
      const result = await otome.post<TarotAnswer>(`${readingPath(reading.id)}/answer`, { card, pick });
      setReading((current) =>
        current
          ? {
              ...current,
              cards: current.cards.map((entry, index) => (index === card ? { ...entry, answer: result } : entry)),
            }
          : current,
      );
      setAnnouncement(t("ui.otomeForge.tarot.announce", { name, line: result.reaction }));
      pendingFocus.current = "next";
    } catch (error) {
      setAnswerError(otome.errorMessage(error));
    } finally {
      setAnswering(false);
    }
  };

  const step = phase.kind === "play" ? phase.step : null;
  /** The next card the player may turn: none until the shown card is read. */
  const turnable =
    reading &&
    step !== null &&
    step < TAROT_CARDS &&
    (step === 0 || reading.mode === "reads-you" || !!reading.cards[step - 1]?.answer)
      ? step
      : null;
  const advance = () => {
    if (!reading || step === null) return;
    setAnnouncement("");
    setAnswerError(null);
    if (step < TAROT_CARDS) {
      if (turnable === null) return;
      pendingFocus.current = "line";
      setPhase({ kind: "play", step: step + 1 });
    } else {
      void finish(reading);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!reading || step === null || step === 0 || reading.mode !== "you-read") return;
    // Keys pressed in a dialog (portalled, so its events still bubble here through React) never answer the card behind.
    if (!event.currentTarget.contains(event.target as Node)) return;
    if (event.altKey || event.ctrlKey || event.metaKey || typing(event.target)) return;
    const card = reading.cards[step - 1];
    if (!/^[1-3]$/u.test(event.key) || !card || card.answer) return;
    event.preventDefault();
    void answer(step - 1, Number(event.key) - 1);
  };

  const again = () => {
    setReading(null);
    setPicks([]);
    setAnnouncement("");
    pendingFocus.current = "title";
    setPhase({ kind: "intro" });
  };

  const turned = phase.kind === "done" ? TAROT_CARDS : (step ?? 0);
  const spread = reading ? (
    <Spread
      runKey={runKey}
      view={view}
      li={li}
      reading={reading}
      deck={deck}
      turned={turned}
      next={turnable}
      actions={actions}
      onTurn={advance}
      onOpen={setEnlarged}
    />
  ) : null;

  return (
    <div className="of-rh of-tarot" style={{ "--of-li-accent": accent } as CSSProperties} onKeyDown={onKeyDown}>
      <header className="of-rh-head">
        <div className="of-rh-heading">
          <p className="of-rh-eyebrow">{t("ui.otomeForge.common.screenDates")}</p>
          <h1 ref={titleRef} className="of-rh-title" tabIndex={-1}>
            {t("ui.otomeForge.tarot.title", { name })}
          </h1>
        </div>
      </header>

      {phase.kind === "opening" ? (
        <div className="of-center" role="status">
          <MoonStar className="of-pulse" size={28} strokeWidth={1.6} aria-hidden="true" />
          <p className="of-body">{t("ui.otomeForge.common.loading")}</p>
        </div>
      ) : phase.kind === "intro" ? (
        <Intro
          view={view}
          li={li}
          mode={mode}
          chip={chip}
          own={own}
          onMode={setMode}
          onChip={(next) => {
            setChip(next);
            if (next) setOwn("");
          }}
          onOwn={(next) => {
            setOwn(next);
            if (next) setChip(null);
          }}
          onBegin={() => {
            pendingFocus.current = "pick";
            setPhase({ kind: "pick" });
          }}
        />
      ) : phase.kind === "pick" ? (
        <Pick accent={accent} picks={picks} headingRef={pickRef} onPicks={setPicks} onTurn={() => void start()} />
      ) : phase.kind === "loading" ? (
        <>
          <div className="of-center" role="status">
            <Heart className="of-pulse" size={28} strokeWidth={1.6} fill="currentColor" aria-hidden="true" />
            <p className="of-body">
              {phase.what === "start" ? t("ui.otomeForge.tarot.loading", { name }) : t("ui.otomeForge.tarot.finishing")}
            </p>
          </div>
          <WaitQuiz runKey={runKey} lis={view.lis} />
        </>
      ) : phase.kind === "failed" && phase.retry === "start" ? (
        // Writing the reading failed (a refusal, no connection, a bad reply): said honestly; Retry keeps the picks.
        <div ref={failedRef} className="of-rh-failed">
          <DeclinedPanel error={phase.error} run={view} job="narration" onRetry={() => void start()} />
          <div className="of-actions">
            <button type="button" className="of-button of-button--quiet of-glass" onClick={onExit}>
              {t("ui.otomeForge.tarot.back")}
            </button>
          </div>
        </div>
      ) : phase.kind === "failed" ? (
        <div className="of-center">
          <div className="of-panel of-panel--center of-card of-glass" role="alert">
            <p className="of-error">{otome.errorMessage(phase.error)}</p>
            <div className="of-actions">
              <button type="button" className="of-button of-button--quiet of-glass" onClick={onExit}>
                {t("ui.otomeForge.tarot.back")}
              </button>
              <button
                ref={retryRef}
                type="button"
                className="of-button of-button--primary"
                onClick={() => {
                  if (phase.retry === "finish" && reading) void finish(reading);
                  else {
                    setPhase({ kind: "opening" });
                    void tarot.refetch();
                  }
                }}
              >
                <RotateCcw size={16} strokeWidth={2} aria-hidden="true" />
                {t("ui.otomeForge.common.retry")}
              </button>
            </div>
          </div>
        </div>
      ) : phase.kind === "play" && reading ? (
        <Play
          view={view}
          li={li}
          reading={reading}
          step={phase.step}
          spread={spread}
          canTurn={turnable !== null || phase.step === TAROT_CARDS}
          answering={answering}
          error={answerError}
          lineRef={lineRef}
          nextRef={nextRef}
          onAnswer={(pick) => void answer(phase.step - 1, pick)}
          onNext={advance}
        />
      ) : phase.kind === "done" && reading ? (
        <Done
          li={li}
          reading={reading}
          result={phase.result}
          levelBefore={levelBefore.current}
          doneRef={doneRef}
          number={number}
          spread={spread}
          onAgain={again}
          onExit={onExit}
        />
      ) : null}
      {reading && enlarged !== null && reading.cards[enlarged] ? (
        <CardDialog
          li={li}
          reading={reading}
          index={enlarged}
          art={readyArt(deck[deckKey(reading.cards[enlarged]!.card, li.id)])}
          onClose={() => setEnlarged(null)}
        />
      ) : null}
      <PaintReviewDialog actions={actions} />
      <p className="of-visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

const readyArt = (entry: TarotDeckCard | undefined) =>
  entry?.art.state === "ready" && entry.art.url ? entry.art.url : null;

/** "Past: The Tower, reversed". */
function useCardLabel() {
  const { t } = useTranslation();
  return (index: number, card: Arcana, reversed: boolean) => {
    const position = t(POSITION_KEYS[TAROT_POSITIONS[index] ?? "future"]);
    const card_ = t(ARCANA_NAME_KEYS[card]);
    return reversed
      ? t("ui.otomeForge.tarot.cardLabelReversed", { position, name: card_ })
      : t("ui.otomeForge.tarot.cardLabel", { position, name: card_ });
  };
}

interface IntroProps {
  view: RunView;
  li: RunLiView;
  mode: TarotMode;
  chip: TarotChip | null;
  own: string;
  onMode: (mode: TarotMode) => void;
  onChip: (chip: TarotChip | null) => void;
  onOwn: (own: string) => void;
  onBegin: () => void;
}

function Intro({ view, li, mode, chip, own, onMode, onChip, onOwn, onBegin }: IntroProps) {
  const { t } = useTranslation();
  const id = useId();
  const name = li.name;
  const fieldId = `${id}-own`;
  return (
    <div className="of-page of-rh-intro of-tarot-intro">
      <div className="of-page-head">
        <span className="of-rh-portrait">
          <Avatar name={name} url={li.portrait} accent={accentOf(li)} size={96} />
        </span>
        <p className="of-hand">{t("ui.otomeForge.tarot.note", { name })}</p>
        <p className="of-body">{t("ui.otomeForge.tarot.introLead")}</p>
      </div>
      <fieldset className="of-section of-glass of-fieldset">
        <legend className="of-section-title">{t("ui.otomeForge.tarot.modeTitle")}</legend>
        <div className="of-choices">
          {TAROT_MODES.map((option) => (
            <label key={option} className="of-choice of-glass" data-checked={mode === option}>
              <input
                className="of-visually-hidden"
                type="radio"
                name={`${id}-mode`}
                value={option}
                checked={mode === option}
                onChange={() => onMode(option)}
              />
              <span className="of-choice-head">
                {option === "reads-you" ? (
                  <Sparkles className="of-choice-icon" size={18} strokeWidth={1.8} aria-hidden="true" />
                ) : (
                  <WandSparkles className="of-choice-icon" size={18} strokeWidth={1.8} aria-hidden="true" />
                )}
                <span className="of-choice-title">{t(MODE_KEYS[option].title, { name })}</span>
              </span>
              <span className="of-choice-text">{t(MODE_KEYS[option].text, { name })}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {mode === "reads-you" ? (
        <section className="of-section of-glass" aria-labelledby={`${id}-question`}>
          <h2 id={`${id}-question`} className="of-section-title">
            {t("ui.otomeForge.tarot.questionTitle")}
          </h2>
          <div className="of-pills" role="group" aria-labelledby={`${id}-question`}>
            {TAROT_QUESTIONS.map((option) => (
              <button
                key={option}
                type="button"
                className="of-pill"
                data-checked={chip === option}
                aria-pressed={chip === option}
                onClick={() => onChip(chip === option ? null : option)}
              >
                {t(CHIP_KEYS[option])}
              </button>
            ))}
          </div>
          <div className="of-field">
            <label className="of-label" htmlFor={fieldId}>
              {t("ui.otomeForge.tarot.ownLabel")}
            </label>
            <input
              id={fieldId}
              className="of-input"
              value={own}
              maxLength={TAROT_QUESTION_MAX}
              aria-describedby={`${fieldId}-hint`}
              onChange={(event) => onOwn(event.target.value)}
            />
            <p id={`${fieldId}-hint`} className="of-field-hint">
              <span>{t("ui.otomeForge.tarot.ownHint")}</span>
              <span className="of-counter">
                {own.length} / {TAROT_QUESTION_MAX}
              </span>
            </p>
          </div>
        </section>
      ) : null}
      <section className="of-section of-glass">
        <p className="of-rh-reward">
          <Sparkle size={14} strokeWidth={1.8} fill="currentColor" aria-hidden="true" />
          <span>
            {t("ui.otomeForge.tarot.reward", {
              starlight: STARLIGHT_EARNINGS.tarot,
              affection: AFFECTION_EARNINGS.tarot,
            })}
          </span>
        </p>
        <p className="of-hint">{t("ui.otomeForge.tarot.modelNote")}</p>
        {imagesOn(view) ? (
          // At most, as the Dates hub says: a card painted before is never painted again.
          <p className="of-cost">
            <Paintbrush size={14} strokeWidth={2} aria-hidden="true" />
            <span>{t("ui.otomeForge.tarot.paintCost", { images: TAROT_CARDS })}</span>
          </p>
        ) : null}
      </section>
      <div className="of-actions">
        <button type="button" className="of-button of-button--primary" onClick={onBegin}>
          <Layers size={16} strokeWidth={2} aria-hidden="true" />
          {t("ui.otomeForge.tarot.begin")}
        </button>
      </div>
    </div>
  );
}

interface PickProps {
  accent: string;
  picks: number[];
  headingRef: RefObject<HTMLHeadingElement | null>;
  onPicks: (picks: number[]) => void;
  onTurn: () => void;
}

/** 22 face-down cards: pick three, in order (see the header). */
function Pick({ accent, picks, headingRef, onPicks, onTurn }: PickProps) {
  const { t } = useTranslation();
  const id = useId();
  const [focus, setFocus] = useState(0);
  const cards = useRef<Array<HTMLButtonElement | null>>([]);
  const gridRef = useRef<HTMLDivElement>(null);
  const ready = picks.length === TAROT_CARDS;

  const toggle = (index: number) => {
    setFocus(index);
    if (picks.includes(index)) onPicks(picks.filter((pick) => pick !== index));
    else if (picks.length < TAROT_CARDS) onPicks([...picks, index]);
  };
  const move = (index: number) => {
    const next = Math.max(0, Math.min(ARCANA.length - 1, index));
    setFocus(next);
    cards.current[next]?.focus();
  };
  const columns = () => {
    const template = gridRef.current ? getComputedStyle(gridRef.current).gridTemplateColumns : "";
    return Math.max(1, template.split(" ").filter(Boolean).length);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: columns(),
      ArrowUp: -columns(),
    };
    if (event.key === "Home") move(0);
    else if (event.key === "End") move(ARCANA.length - 1);
    else if (event.key in step) move(index + step[event.key]!);
    else return;
    event.preventDefault();
  };
  const fate = () => {
    const pool = ARCANA.map((_, index) => index);
    const chosen: number[] = [];
    while (chosen.length < TAROT_CARDS) chosen.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]!);
    onPicks(chosen);
  };

  return (
    <div className="of-page of-tarot-pick">
      <section className="of-section of-glass" aria-labelledby={`${id}-title`}>
        <h2 id={`${id}-title`} ref={headingRef} className="of-section-title" tabIndex={-1}>
          {t("ui.otomeForge.tarot.pickTitle")}
        </h2>
        <p className="of-hint">{t("ui.otomeForge.tarot.pickHint")}</p>
        <div ref={gridRef} className="of-tarot-deck" role="group" aria-labelledby={`${id}-title`}>
          {ARCANA.map((_, index) => {
            const order = picks.indexOf(index);
            return (
              <button
                key={index}
                ref={(element) => {
                  cards.current[index] = element;
                }}
                type="button"
                className="of-tarot-back-button"
                tabIndex={index === focus ? 0 : -1}
                aria-pressed={order >= 0}
                aria-label={t("ui.otomeForge.tarot.cardBack", { number: index + 1 })}
                onClick={() => toggle(index)}
                onKeyDown={(event) => onKeyDown(event, index)}
              >
                <TarotBack accent={accent} />
                {order >= 0 ? (
                  <span className="of-tarot-order" aria-hidden="true">
                    {order + 1}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <p className="of-visually-hidden" role="status" aria-live="polite">
          {t("ui.otomeForge.tarot.chosen", { chosen: picks.length, total: TAROT_CARDS })}
        </p>
      </section>
      <div className="of-actions">
        <button type="button" className="of-button of-button--quiet of-glass" onClick={fate}>
          <Sparkles size={16} strokeWidth={2} aria-hidden="true" />
          {t("ui.otomeForge.tarot.fate")}
        </button>
        <button
          type="button"
          className="of-button of-button--primary"
          aria-disabled={!ready}
          onClick={() => {
            if (ready) onTurn();
          }}
        >
          <Layers size={16} strokeWidth={2} aria-hidden="true" />
          {t("ui.otomeForge.tarot.turnCards")}
        </button>
      </div>
    </div>
  );
}

interface SpreadProps {
  runKey: string;
  view: RunView;
  li: RunLiView;
  reading: TarotReadingView;
  deck: Record<string, TarotDeckCard>;
  /** How many cards lie face up. */
  turned: number;
  /** The card a tap turns now, or null. */
  next: number | null;
  actions: ItemActions;
  onTurn: () => void;
  onOpen: (index: number) => void;
}

/** Past, Present and Future, each with its painting or our card, and the deck's paint controls. */
function Spread({ runKey, view, li, reading, deck, turned, next, actions, onTurn, onOpen }: SpreadProps) {
  const { t } = useTranslation();
  const label = useCardLabel();
  const { reviewImagePromptsBeforeSend } = useOtomeProps();
  const accent = accentOf(li);
  const images = imagesOn(view);
  const entries = reading.cards.map((card, index) => {
    const entry = deck[deckKey(card.card, li.id)];
    const name = t(ARCANA_NAME_KEYS[card.card]);
    return { card, index, entry, name, target: tarotPaintTarget(runKey, li.id, card.card, name) };
  });
  // One bar for the turned cards held for consent: a face-down card is never named, by its review either.
  const waiting = entries.filter((item) => item.index < turned && item.entry?.art.state === "waiting-consent");
  const paintAll = () => {
    // With prompt review, one review at a time: the bar stays for the rest.
    const targets = waiting.map((item) => item.target).filter((target) => !actions.busy.has(target.id));
    for (const target of reviewImagePromptsBeforeSend ? targets.slice(0, 1) : targets) void actions.paint(target);
  };
  return (
    <div className="of-tarot-table">
      <ol className="of-tarot-spread">
        {entries.map(({ card, index, entry, target }) => {
          const up = index < turned;
          const position = t(POSITION_KEYS[TAROT_POSITIONS[index] ?? "future"]);
          const art = entry?.art;
          const painting = actions.busy.has(target.id) || art?.state === "pending";
          const retry = images && up && !painting && (art?.state === "failed" || art?.state === "stopped");
          const error = actions.errors[target.id];
          return (
            <li key={index} className="of-tarot-slot" data-position={TAROT_POSITIONS[index]}>
              <span className="of-tarot-position" aria-hidden="true">
                {position}
              </span>
              <button
                type="button"
                className="of-tarot-slot-button"
                aria-label={up ? undefined : t("ui.otomeForge.tarot.turnLabel", { position })}
                aria-haspopup={up ? "dialog" : undefined}
                aria-disabled={!up && index !== next}
                onClick={() => {
                  if (up) onOpen(index);
                  else if (index === next) onTurn();
                }}
              >
                <TarotCard
                  card={card.card}
                  reversed={card.reversed}
                  art={readyArt(entry)}
                  accent={accent}
                  turned={up}
                  label={label(index, card.card, card.reversed)}
                  badge={up && painting ? t("ui.otomeForge.wish.painting") : undefined}
                />
              </button>
              {retry ? (
                <button
                  type="button"
                  className="of-button of-button--quiet of-glass of-button--small of-tarot-retry"
                  aria-label={t("ui.otomeForge.tarot.paintRetryLabel", { name: target.subject })}
                  onClick={() => void actions.paint(target)}
                >
                  <RotateCcw size={13} strokeWidth={2} aria-hidden="true" />
                  {t("ui.otomeForge.wish.paintRetry")}
                </button>
              ) : null}
              {error ? (
                <p className="of-notice of-notice--error" role="alert">
                  {error}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
      {images && waiting.length ? (
        <div className="of-tarot-paint">
          <button
            type="button"
            className="of-button of-button--quiet of-glass of-button--small"
            aria-disabled={waiting.every((item) => actions.busy.has(item.target.id))}
            onClick={paintAll}
          >
            <Paintbrush size={14} strokeWidth={2} aria-hidden="true" />
            {t("ui.otomeForge.tarot.paintCards")}
          </button>
          <CostHint images={waiting.length} />
        </div>
      ) : null}
    </div>
  );
}

/** The love interest's line and the player's reading (if any), voiced once each, the player's in the persona's voice. */
function useVoiced(lines: Array<{ segment: Segment; ref: string }>, key: string) {
  const audio = useOtomeAudio();
  useAudioSnapshot();
  const voiced = audio ? lines.filter((line) => audio.wouldSpeak(line.segment)) : [];
  const voicedKey = voiced.length ? key : "";
  useEffect(() => {
    if (!audio || !voicedKey) return;
    let stopped = false;
    void (async () => {
      for (const line of voiced) {
        if (stopped) return;
        await audio.speak(line.segment, line.ref);
      }
    })();
    return () => {
      stopped = true;
      audio.stopVoice();
    };
    // Once per line: the lines belong to their key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio, voicedKey]);
}

interface PlayProps {
  view: RunView;
  li: RunLiView;
  reading: TarotReadingView;
  step: number;
  spread: ReactNode;
  canTurn: boolean;
  answering: boolean;
  error: string | null;
  lineRef: RefObject<HTMLHeadingElement | null>;
  nextRef: RefObject<HTMLButtonElement | null>;
  onAnswer: (pick: number) => void;
  onNext: () => void;
}

function Play({
  view,
  li,
  reading,
  step,
  spread,
  canTurn,
  answering,
  error,
  lineRef,
  nextRef,
  onAnswer,
  onNext,
}: PlayProps) {
  const { t } = useTranslation();
  const id = useId();
  const label = useCardLabel();
  const name = li.name;
  const player = view.player.name || t("ui.otomeForge.tarot.you");
  const card = step > 0 ? reading.cards[step - 1]! : null;
  const answer = card?.answer;
  const face: Face | "" = answer ? answer.face : card ? card.face : reading.opening.face;
  const line = answer ? answer.reaction : card ? card.line : reading.opening.line;
  const heading = card ? label(step - 1, card.card, card.reversed) : t("ui.otomeForge.tarot.openingHeading");
  const asked = reading.question
    ? "chip" in reading.question
      ? t(CHIP_KEYS[reading.question.chip])
      : reading.question.own
    : "";
  const readsMine = reading.mode === "you-read" && !!card;
  const last = step >= TAROT_CARDS;

  // Opened lines only: a card answered before (a reading picked up again) is never voiced twice. Remembered per step
  // rather than by remounting Play on each turn, so the spread stays mounted and a turned card's flip animates
  // (Dottore on #2162).
  const openedRef = useRef(new Map<number, boolean>());
  if (!openedRef.current.has(step)) openedRef.current.set(step, !answer);
  const opened = openedRef.current.get(step)!;
  const said = (text: string, expression: Face | "" = face): Segment => ({
    speaker: name,
    text,
    ...(expression ? { expression } : {}),
  });
  useVoiced(
    !opened
      ? []
      : answer
        ? [
            { segment: { speaker: view.player.name, text: answer.reading }, ref: `tarot:${reading.id}:${step}:you` },
            { segment: said(answer.reaction), ref: `tarot:${reading.id}:${step}:reaction` },
          ]
        : [{ segment: said(line), ref: `tarot:${reading.id}:${step}` }],
    `${reading.id}:${step}:${answer ? "answer" : "line"}`,
  );

  return (
    <>
      <div className="of-rh-scene">
        <FacePlate li={li} face={face} speaking />
      </div>
      <section className="of-rh-bottom" aria-labelledby={`${id}-heading`}>
        <h2 id={`${id}-heading`} ref={lineRef} className="of-visually-hidden" tabIndex={-1}>
          {heading}
        </h2>
        {step === 0 && reading.context ? (
          <p className="of-rh-context of-glass">
            <MoonStar size={15} strokeWidth={2} aria-hidden="true" />
            <span>{reading.context}</span>
          </p>
        ) : null}
        {step === 0 && asked ? (
          <p className="of-rm-said">{t("ui.otomeForge.tarot.yourQuestion", { question: asked })}</p>
        ) : null}
        {spread}
        {answer ? (
          <p className="of-rm-said">{t("ui.otomeForge.tarot.youRead", { name: player, reading: answer.reading })}</p>
        ) : null}
        <div className="of-dialogue of-glass of-glass--strong of-rh-dialogue" data-voice="li">
          <p className="of-nameplate" data-voice="li">
            <span>{name}</span>
            <span className="of-nameplate-tag">
              {card ? t(POSITION_KEYS[TAROT_POSITIONS[step - 1] ?? "future"]) : t("ui.otomeForge.tarot.openingTag")}
            </span>
          </p>
          <p className="of-line">
            <span className="of-visually-hidden">{t("ui.otomeForge.reader.announceLine", { name, text: line })}</span>
            <span aria-hidden="true">{line}</span>
          </p>
        </div>
        {readsMine && !answer ? (
          <>
            <p className="of-rh-question" id={`${id}-ask`}>
              {t("ui.otomeForge.tarot.howRead")}
            </p>
            <div className="of-choice-pills of-tarot-readings" role="group" aria-labelledby={`${id}-ask`}>
              {(card.readings ?? []).map((text, option) => (
                <button
                  key={option}
                  type="button"
                  className="of-choice-pill of-rh-reading"
                  aria-disabled={answering}
                  aria-keyshortcuts={String(option + 1)}
                  onClick={() => {
                    if (!answering) onAnswer(option);
                  }}
                >
                  <span className="of-rh-key" aria-hidden="true">
                    {option + 1}
                  </span>
                  <span className="of-choice-pill-text">{text}</span>
                </button>
              ))}
            </div>
          </>
        ) : null}
        <p className="of-choices-status" role="status" aria-live="polite">
          {answering ? t("ui.otomeForge.tarot.answering", { name }) : (error ?? "")}
        </p>
        {readsMine && !answer ? null : (
          <button
            ref={nextRef}
            type="button"
            className="of-button of-button--primary of-rh-next"
            aria-disabled={!canTurn}
            onClick={onNext}
          >
            {last ? (
              <Heart size={16} strokeWidth={2} aria-hidden="true" />
            ) : (
              <Layers size={16} strokeWidth={2} aria-hidden="true" />
            )}
            {last
              ? t("ui.otomeForge.tarot.close")
              : step === 0
                ? t("ui.otomeForge.tarot.turnFirst")
                : t("ui.otomeForge.tarot.turnNext")}
          </button>
        )}
      </section>
    </>
  );
}

interface DoneProps {
  li: RunLiView;
  reading: TarotReadingView;
  result: TarotFinishResult;
  levelBefore: number;
  doneRef: RefObject<HTMLHeadingElement | null>;
  number: (value: number) => string;
  spread: ReactNode;
  onAgain: () => void;
  onExit: () => void;
}

function Done({ li, reading, result, levelBefore, doneRef, number, spread, onAgain, onExit }: DoneProps) {
  const { t } = useTranslation();
  const name = li.name;
  const starlight = result.grants.reduce((sum, grant) => sum + (grant.starlight ?? 0), 0);
  const affection = result.grants.reduce((sum, grant) => sum + (grant.li === li.id ? (grant.affection ?? 0) : 0), 0);
  const rose = li.level > levelBefore;
  const { closing } = reading;
  useVoiced(
    [
      {
        segment: { speaker: name, text: closing.line, ...(closing.face ? { expression: closing.face } : {}) },
        ref: `tarot:${reading.id}:closing`,
      },
    ],
    `${reading.id}:closing`,
  );
  return (
    <div className="of-page of-tarot-done">
      <section className="of-reader-panel of-chapter-end of-glass of-glass--strong" aria-labelledby="of-tarot-done">
        <h2 id="of-tarot-done" ref={doneRef} className="of-chapter-end-title of-rh-done-title" tabIndex={-1}>
          {t("ui.otomeForge.tarot.doneTitle")}
        </h2>
        {spread}
        <div className="of-dialogue of-glass of-glass--strong of-rh-dialogue" data-voice="li">
          <p className="of-nameplate" data-voice="li">
            <span>{name}</span>
          </p>
          <p className="of-line">
            <span className="of-visually-hidden">
              {t("ui.otomeForge.reader.announceLine", { name, text: closing.line })}
            </span>
            <span aria-hidden="true">{closing.line}</span>
          </p>
        </div>
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
            <span>{t("ui.otomeForge.tarot.capped")}</span>
          </p>
        )}
        <div className="of-inline-actions">
          <button type="button" className="of-button of-button--quiet of-glass of-button--small" onClick={onExit}>
            {t("ui.otomeForge.tarot.back")}
          </button>
          <button type="button" className="of-button of-button--primary of-button--small" onClick={onAgain}>
            <RotateCcw size={15} strokeWidth={2} aria-hidden="true" />
            {t("ui.otomeForge.tarot.again")}
          </button>
        </div>
      </section>
    </div>
  );
}

/** A turned card, large: the only place to look at a painted card whole. */
function CardDialog({
  li,
  reading,
  index,
  art,
  onClose,
}: {
  li: RunLiView;
  reading: TarotReadingView;
  index: number;
  art: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const label = useCardLabel();
  const card = reading.cards[index]!;
  const title = label(index, card.card, card.reversed);
  return (
    <Dialog
      title={title}
      onClose={onClose}
      actions={
        <button type="button" className="of-button of-button--primary" onClick={onClose}>
          {t("ui.otomeForge.tarot.closeCard")}
        </button>
      }
    >
      <div className="of-tarot-large" style={{ "--of-li-accent": accentOf(li) } as CSSProperties}>
        <TarotFace card={card.card} reversed={card.reversed} art={art} label={title} />
      </div>
    </Dialog>
  );
}

// ── Styles: theme/styles.ts otomeForgeStyles() adds TAROT_RULES after READ_ME_RULES, whose classes this reuses. ──

const R = ".of-root";

/** Tarot night's own rules; motion stops under reduced motion with the rest of the stylesheet (MOTION_RULES). */
export const TAROT_RULES = `
${R} .of-tarot-card { position: relative; display: block; width: 100%; aspect-ratio: 140 / 240; perspective: 900px; }
${R} .of-tarot-flip {
  position: absolute; inset: 0; display: block; transform-style: preserve-3d; transition: transform 400ms var(--of-ease);
}
${R} .of-tarot-card[data-turned="true"] .of-tarot-flip { transform: rotateY(180deg); }
${R} .of-tarot-side { position: absolute; inset: 0; display: block; backface-visibility: hidden; -webkit-backface-visibility: hidden; }
${R} .of-tarot-front { transform: rotateY(180deg); }
${R} .of-tarot-svg { display: block; width: 100%; height: 100%; border-radius: 7%; box-shadow: 0 6px 16px rgb(10 8 24 / 0.35); }
${R} .of-tarot-art { animation: of-fade-in 700ms var(--of-ease) both; }
${R} .of-tarot-badge {
  position: absolute; inset-inline: 8%; bottom: 14%; padding: 2px 6px; border-radius: 999px; text-align: center;
  font-size: 0.62rem; font-weight: 800; color: ${PALETTE.ink}; background: ${PALETTE.champagne}; pointer-events: none;
}
/* The pick: one wrapping grid of backs, six across on a phone, more on a wider stage. */
${R} .of-tarot-deck {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(48px, 1fr)); gap: 6px; margin: 0; padding: 2px;
}
${R} .of-tarot-back-button {
  position: relative; display: block; min-width: 44px; padding: 0; border: 0; border-radius: 8px; background: transparent;
  cursor: pointer; aspect-ratio: 140 / 240; transition: transform 300ms var(--of-ease), filter 300ms var(--of-ease);
}
${R} .of-tarot-back-button .of-tarot-svg { box-shadow: 0 3px 8px rgb(10 8 24 / 0.3); }
@media (hover: hover) and (pointer: fine) {
  ${R} .of-tarot-back-button:hover { transform: translateY(-4px); }
  ${R} .of-tarot-slot-button:not([aria-disabled="true"]):hover { transform: translateY(-3px); }
}
${R} .of-tarot-back-button[aria-pressed="true"] { transform: translateY(-6px); filter: drop-shadow(0 0 6px var(--of-li-accent)); }
${R} .of-tarot-order {
  position: absolute; top: -6px; inset-inline-end: -6px; display: grid; place-items: center; width: 22px; height: 22px;
  border-radius: 50%; font-size: 0.72rem; font-weight: 800; color: ${PALETTE.ink}; background: ${PALETTE.champagne};
  box-shadow: 0 2px 6px rgb(10 8 24 / 0.4);
}
/* The spread: Past, Present and Future side by side. */
${R} .of-tarot-table { display: flex; flex-direction: column; gap: 8px; }
${R} .of-tarot-spread {
  display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; width: min(100%, 360px); margin: 0 auto;
  padding: 0; list-style: none;
}
${R} .of-tarot-slot { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 0; }
${R} .of-tarot-position {
  font-size: 0.66rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--of-champagne-text);
}
${R} .of-tarot-slot-button {
  display: block; width: 100%; padding: 0; border: 0; border-radius: 8px; background: transparent; cursor: pointer;
  transition: transform 300ms var(--of-ease);
}
${R} .of-tarot-slot-button[aria-disabled="true"] { cursor: default; }
${R} .of-tarot-slot-button[aria-disabled="true"] .of-tarot-card[data-turned="false"] { opacity: 0.72; }
${R} .of-tarot-retry { font-size: 0.7rem; }
${R} .of-tarot-paint { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px; }
${R} .of-tarot-done .of-reader-panel { flex: none; gap: 12px; }
${R} .of-tarot-done .of-tarot-spread { width: min(100%, 300px); }
${R} .of-tarot-large { width: min(100%, 300px); margin: 0 auto; }
${R} .of-tarot-large .of-tarot-svg { height: auto; }`;
