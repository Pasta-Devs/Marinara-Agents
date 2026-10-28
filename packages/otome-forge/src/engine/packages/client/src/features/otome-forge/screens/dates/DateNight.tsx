// ──────────────────────────────────────────────
// Otome Forge: Date Night (plan M5). Where, and in what; the date's three scenes in the reader (one choice each, scored
// in secret against their likes); then how the evening went: what landed with them, their last words, what it earned,
// Make it right during a rupture, and a keepsake that paints only when the player asks for it.
// ──────────────────────────────────────────────
// The Dates hub picks who the evening is with and opens this screen with ActivityScreenProps. An unfinished date is
// resumed, never planned twice: the server returns the open one, and leaving mid-date keeps it for later. The outcome
// is counted once by the server; reopening a date read to its end counts it then.
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarHeart,
  ChevronLeft,
  Feather,
  Heart,
  HeartCrack,
  HeartHandshake,
  House,
  Paintbrush,
  RotateCcw,
  Sparkle,
  X,
} from "lucide-react";
import { useOtomeApi } from "../../api";
import { Avatar } from "../../components/Avatar";
import { CostHint } from "../../components/CostHint";
import { DeclinedPanel } from "../../components/DeclinedPanel";
import { Dialog } from "../../components/Dialog";
import { PromptReviewDialog, type ImagePrompt } from "../../components/PromptReviewDialog";
import { cancelStoryWork, runPath } from "../../hooks/use-reader";
import { patchRun, runQueryKey } from "../../hooks/use-run";
import { accentOf } from "../../lib/accent";
import { placeEntry, readyUrl, worldPlaces } from "../../lib/reader-state";
import { useOtomeProps } from "../../props";
import type { Paint, RunLiView, RunView } from "../../shared/api-types";
import {
  BASE_LOOK,
  DATE_PLACE_MOODS,
  PARTNER_CHOICE,
  STORY_PLACE,
  type DateEntry,
  type DateFinishResult,
  type DateOutcome,
  type DatePlace,
  type DateScore,
  type DatesView,
} from "../../shared/dates";
import { Reader } from "../reader/Reader";
import { playQueryKey, type ActivityScreenProps } from "./DatesHub";
import { LookPicker } from "./LookPicker";
import { PLACE_ICONS, PLACE_NAME_KEYS, PlacePicker, paintedPlaces, type PlacePick } from "./PlacePicker";

export const datesQueryKey = (runKey: string) => ["otome-forge", "dates", runKey] as const;

/** GET /runs/:run/dates: each love interest (a rupture, an open date) and the finished dates, newest first. */
export function useDates(runKey: string) {
  const otome = useOtomeApi();
  return useQuery({
    queryKey: datesQueryKey(runKey),
    queryFn: () => otome.get<DatesView>(`${runPath(runKey)}/dates`),
    // A plan left mid-write can still finish on the server, so a list cached earlier may miss that date.
    refetchOnMount: "always",
  });
}

const OUTCOME_TITLE_KEYS: Record<DateOutcome, string> = {
  great: "ui.otomeForge.dateNight.outcomeGreat",
  good: "ui.otomeForge.dateNight.outcomeGood",
  awkward: "ui.otomeForge.dateNight.outcomeAwkward",
};

const OUTCOME_TEXT_KEYS: Record<DateOutcome, string> = {
  great: "ui.otomeForge.dateNight.outcomeGreatText",
  good: "ui.otomeForge.dateNight.outcomeGoodText",
  awkward: "ui.otomeForge.dateNight.outcomeAwkwardText",
};

const OUTCOME_SHORT_KEYS: Record<DateOutcome, string> = {
  great: "ui.otomeForge.dateNight.outcomeGreatShort",
  good: "ui.otomeForge.dateNight.outcomeGoodShort",
  awkward: "ui.otomeForge.dateNight.outcomeAwkwardShort",
};

const PICK_LABEL_KEYS: Record<`${DateScore}`, string> = {
  "1": "ui.otomeForge.dateNight.pickLoved",
  "0": "ui.otomeForge.dateNight.pickFine",
  "-1": "ui.otomeForge.dateNight.pickGrated",
};

/** A place's icon. */
function PlaceIcon({ place, size }: { place: DatePlace; size: number }) {
  const Icon = PLACE_ICONS[place];
  return <Icon size={size} strokeWidth={1.8} aria-hidden="true" />;
}

type Step =
  | { kind: "place" }
  | { kind: "looks" }
  | { kind: "planning" }
  | { kind: "reading"; key: string }
  | { kind: "ending"; key: string };

export interface DateNightProps extends ActivityScreenProps {
  /** Home, from the reader's and the ending's Home button; Back to Dates (onExit) when omitted. */
  onHome?: () => void;
  /** True while the date's scenes are read full-stage (the top bar and the dock step aside), false otherwise. */
  onImmersive?: (immersive: boolean) => void;
}

/** Where the love interest's dates stand: continue an open one (or count one read to its end), else plan a new one. */
function stepFor(view: DatesView, li: string): Step {
  const open = view.lis.find((entry) => entry.li === li)?.open;
  if (open) return { kind: open.state === "done" ? "ending" : "reading", key: open.key };
  return { kind: "place" };
}

export function DateNight({ runKey, view, li: picked, onExit, onHome = onExit, onImmersive }: DateNightProps) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const dates = useDates(runKey);
  const [step, setStep] = useState<Step | null>(null);
  const [place, setPlace] = useState<PlacePick | null>(null);
  const [looks, setLooks] = useState({ hisLook: BASE_LOOK, herLook: BASE_LOOK });
  const [planError, setPlanError] = useState<unknown>(null);
  const abortRef = useRef<AbortController | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  // Set by the player's own navigation, so focus moves only then: to the new step's heading, which also announces it.
  const moved = useRef(false);
  // The run view's copy carries the newest level.
  const partner = view.lis.find((item) => item.id === picked.id) ?? picked;
  const rupture = !!dates.data?.lis.find((entry) => entry.li === partner.id)?.rupture;

  // Opens where this love interest's dates stand, once they are known. On a first visit that is after the loading
  // state, which has no heading for the router to focus, so focus goes to the step's heading as it would after a move.
  // Only a list fetched since this screen opened counts: one cached from before may lack a date that finished after
  // the player left, and Begin would then resume that date unannounced.
  if (step === null && dates.data && dates.isFetchedAfterMount && !dates.isError) {
    moved.current = true;
    setStep(stepFor(dates.data, partner.id));
  }

  const go = useCallback((next: Step) => {
    moved.current = true;
    setStep(next);
  }, []);

  const reading = step?.kind === "reading";
  useEffect(() => {
    onImmersive?.(reading);
  }, [onImmersive, reading]);
  useEffect(() => () => onImmersive?.(false), [onImmersive]);
  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (!moved.current || !step) return;
    moved.current = false;
    // The reader's heading arrives with its chapter: look again for a few frames. Never away from wherever the player
    // has moved focus meanwhile (outside this screen).
    let frame = 0;
    let handle = 0;
    const focus = () => {
      const active = document.activeElement;
      if (active && active !== document.body && rootRef.current && !rootRef.current.contains(active)) return;
      const heading = rootRef.current?.querySelector<HTMLElement>("h1");
      if (heading) heading.focus({ preventScroll: true });
      else if ((frame += 1) < 30) handle = window.requestAnimationFrame(focus);
    };
    focus();
    return () => window.cancelAnimationFrame(handle);
  }, [step]);

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: datesQueryKey(runKey) });
  }, [queryClient, runKey]);

  const plan = useCallback(async () => {
    if (!place) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setPlanError(null);
    go({ kind: "planning" });
    try {
      const { date } = await otome.post<{ date: DateEntry; resumed: boolean }>(
        `${runPath(runKey)}/dates`,
        {
          li: partner.id,
          place: place.place,
          ...(place.storyPlace ? { storyPlace: place.storyPlace.key } : {}),
          ...looks,
        },
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      refresh();
      go({ kind: date.state === "done" ? "ending" : "reading", key: date.key });
    } catch (error) {
      if (!controller.signal.aborted) setPlanError(error);
    }
  }, [go, looks, otome, partner.id, place, refresh, runKey]);

  const cancelPlan = () => {
    abortRef.current?.abort();
    void cancelStoryWork(otome.post, runKey);
    setPlanError(null);
    go({ kind: "looks" });
  };

  const leave = () => {
    refresh();
    onExit();
  };

  if (!step) {
    return (
      <div className="of-page of-dates">
        {dates.isError ? (
          <div className="of-panel of-panel--center of-card of-glass" role="alert">
            <h1 className="of-section-title" tabIndex={-1}>
              {t("ui.otomeForge.dateNight.title")}
            </h1>
            <p className="of-error">{otome.errorMessage(dates.error)}</p>
            <button type="button" className="of-button of-button--quiet of-glass" onClick={() => void dates.refetch()}>
              <RotateCcw size={16} strokeWidth={2} aria-hidden="true" />
              {t("ui.otomeForge.common.retry")}
            </button>
          </div>
        ) : (
          <div className="of-center" role="status">
            <Heart className="of-pulse" size={26} strokeWidth={1.6} fill="currentColor" aria-hidden="true" />
            <p className="of-body">{t("ui.otomeForge.dateNight.loading")}</p>
          </div>
        )}
      </div>
    );
  }

  if (step.kind === "reading") {
    return (
      <div ref={rootRef} className="of-dates-reading">
        <Reader
          runKey={runKey}
          chapterKey={step.key}
          view={view}
          onExit={leave}
          onHome={() => {
            refresh();
            onHome();
          }}
          onFinished={() => go({ kind: "ending", key: step.key })}
        />
      </div>
    );
  }

  return (
    <div ref={rootRef} className="of-page of-dates" style={accentStyle(partner)}>
      {step.kind === "place" ? (
        <>
          <StepHead partner={partner} rupture={rupture} step={1} title={t("ui.otomeForge.dateNight.placeTitle")} />
          <PlacePicker
            partnerName={partner.name}
            storyPlaces={paintedPlaces(view.world)}
            value={place}
            onChange={setPlace}
          />
          <div className="of-dates-actions">
            <button
              type="button"
              className="of-button of-button--primary"
              aria-disabled={!place}
              aria-describedby={place ? undefined : "of-date-place-needed"}
              onClick={() => {
                if (place) go({ kind: "looks" });
              }}
            >
              {t("ui.otomeForge.dateNight.toLooks")}
            </button>
          </div>
          {!place ? (
            <p id="of-date-place-needed" className="of-hint of-dates-pick-hint">
              {t("ui.otomeForge.dateNight.placeNeeded")}
            </p>
          ) : null}
          <DateHistory view={view} partner={partner} dates={dates.data} />
        </>
      ) : null}

      {step.kind === "looks" && place ? (
        <>
          <StepHead partner={partner} rupture={rupture} step={2} title={t("ui.otomeForge.dateNight.looksTitle")} />
          <LookPicker partner={partner} player={view.player} {...looks} onChange={setLooks} />
          <section className="of-section of-glass of-date-summary" aria-labelledby="of-date-summary">
            <p className="of-eyebrow">{t("ui.otomeForge.dateNight.tonight")}</p>
            <h2 id="of-date-summary" className="of-section-title of-date-summary-title">
              <PlaceIcon place={place.place} size={18} />
              <span>
                {place.place === PARTNER_CHOICE
                  ? t("ui.otomeForge.dateNight.summaryPartnerChoice", { name: partner.name })
                  : t("ui.otomeForge.dateNight.summary", {
                      place: place.storyPlace?.name ?? t(PLACE_NAME_KEYS[place.place], { name: partner.name }),
                      name: partner.name,
                    })}
              </span>
            </h2>
            <p className="of-body">{t("ui.otomeForge.dateNight.howItPlays", { name: partner.name })}</p>
            {rupture ? (
              <p className="of-notice of-date-mend">
                <HeartHandshake size={16} strokeWidth={2} aria-hidden="true" />
                <span>{t("ui.otomeForge.dateNight.makeItRightText", { name: partner.name })}</span>
              </p>
            ) : null}
          </section>
          <div className="of-dates-actions">
            <button type="button" className="of-button of-button--quiet of-glass" onClick={() => go({ kind: "place" })}>
              <ChevronLeft className="of-back-icon" size={16} strokeWidth={2} aria-hidden="true" />
              {t("ui.otomeForge.dateNight.toPlace")}
            </button>
            <button type="button" className="of-button of-button--primary" onClick={() => void plan()}>
              <Heart size={16} strokeWidth={2} fill="currentColor" aria-hidden="true" />
              {rupture ? t("ui.otomeForge.dateNight.beginMend") : t("ui.otomeForge.dateNight.begin")}
            </button>
          </div>
        </>
      ) : null}

      {step.kind === "planning" ? (
        <>
          <StepHead partner={partner} rupture={rupture} title={t("ui.otomeForge.dateNight.planningTitle")} />
          {planError ? (
            <>
              <DeclinedPanel error={planError} run={view} job="structured" onRetry={() => void plan()} />
              <div className="of-dates-actions">
                <button
                  type="button"
                  className="of-button of-button--quiet of-glass"
                  onClick={() => go({ kind: "looks" })}
                >
                  <ChevronLeft className="of-back-icon" size={16} strokeWidth={2} aria-hidden="true" />
                  {t("ui.otomeForge.dateNight.toLooksBack")}
                </button>
              </div>
            </>
          ) : (
            <section className="of-reader-panel of-writing of-glass of-glass--strong" role="status">
              <span className="of-quill" aria-hidden="true">
                <Feather size={22} strokeWidth={1.7} />
              </span>
              <p className="of-section-title">{t("ui.otomeForge.dateNight.planning", { name: partner.name })}</p>
              <p className="of-hint">{t("ui.otomeForge.dateNight.planningHint")}</p>
              <button
                type="button"
                className="of-button of-button--quiet of-glass of-button--small"
                onClick={cancelPlan}
              >
                <X size={15} strokeWidth={2} aria-hidden="true" />
                {t("ui.otomeForge.reader.cancel")}
              </button>
            </section>
          )}
        </>
      ) : null}

      {step.kind === "ending" ? (
        <DateEnding
          key={step.key}
          runKey={runKey}
          view={view}
          partner={partner}
          dateKey={step.key}
          onDone={leave}
          onHome={() => {
            refresh();
            onHome();
          }}
          onCounted={refresh}
        />
      ) : null}
    </div>
  );
}

const accentStyle = (li: RunLiView) => ({ "--of-li-accent": accentOf(li) }) as CSSProperties;

interface StepHeadProps {
  partner: RunLiView;
  rupture: boolean;
  /** "Step n of 2" while choosing; none while planning. */
  step?: number;
  title: string;
}

/** The step's heading: who the evening is with, Make it right when a rupture stands, and the step's question. */
function StepHead({ partner, rupture, step, title }: StepHeadProps) {
  const { t } = useTranslation();
  return (
    <header className="of-date-head">
      <Avatar name={partner.name} url={partner.portrait} accent={accentOf(partner)} size={54} />
      <div className="of-date-head-text">
        <p className="of-eyebrow">
          {rupture ? (
            <span className="of-date-mend-eyebrow">
              <HeartCrack size={11} strokeWidth={2.4} aria-hidden="true" />
              {t("ui.otomeForge.dateNight.makeItRight")}
            </span>
          ) : (
            t("ui.otomeForge.dateNight.title")
          )}
          {step ? (
            <span className="of-faint"> · {t("ui.otomeForge.dateNight.stepOf", { number: step, total: 2 })}</span>
          ) : null}
        </p>
        <h1 className="of-title of-title--page" tabIndex={-1}>
          {title}
        </h1>
        <p className="of-hand">{t("ui.otomeForge.dateNight.with", { name: partner.name })}</p>
      </div>
    </header>
  );
}

interface DateHistoryProps {
  view: RunView;
  partner: RunLiView;
  dates: DatesView | undefined;
}

/**
 * The evenings with this love interest so far, newest first: their keepsake (or a story place's picture, or the
 * place's colours) and how it went.
 */
function DateHistory({ view, partner, dates }: DateHistoryProps) {
  const { t } = useTranslation();
  const finished = (dates?.dates ?? []).filter((entry) => entry.li === partner.id).slice(0, 6);
  if (!finished.length) return null;
  const artOf = (entry: DateEntry) =>
    (entry.keepsake?.state === "ready" && entry.keepsake.url) ||
    (entry.place === STORY_PLACE ? readyUrl(placeEntry(worldPlaces(view.world), entry.placeName)?.art) : null);
  return (
    <section className="of-section of-glass" aria-labelledby="of-date-history">
      <h2 id="of-date-history" className="of-section-title">
        {t("ui.otomeForge.dateNight.historyTitle", { name: partner.name })}
      </h2>
      <ul className="of-date-history">
        {finished.map((entry) => (
          <li key={entry.key} className="of-date-memory">
            {artOf(entry) ? (
              <img className="of-date-memory-art" src={artOf(entry)!} alt="" loading="lazy" />
            ) : (
              <span className="of-date-memory-art of-date-memory-art--quiet" aria-hidden="true">
                <span className="of-mood" data-mood={DATE_PLACE_MOODS[entry.place]} data-on="true" />
                <PlaceIcon place={entry.place} size={18} />
              </span>
            )}
            <span className="of-date-memory-text">
              <span className="of-date-memory-title">{entry.title}</span>
              <span className="of-hint">
                {entry.placeName || t(PLACE_NAME_KEYS[entry.place], { name: partner.name })}
              </span>
            </span>
            {entry.outcome ? (
              <span className="of-badge of-badge--soft">{t(OUTCOME_SHORT_KEYS[entry.outcome])}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

interface DateEndingProps {
  runKey: string;
  view: RunView;
  partner: RunLiView;
  dateKey: string;
  /** Back to Dates. */
  onDone: () => void;
  onHome: () => void;
  /** The server counted the date (the dates list changed). */
  onCounted: () => void;
}

/** How the evening went. Counting it is the server's (once); this asks once per date and shows what came back. */
function DateEnding({ runKey, view, partner, dateKey, onDone, onHome, onCounted }: DateEndingProps) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const { locale } = useOtomeProps().localization;
  const [result, setResult] = useState<DateFinishResult | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [levelBefore] = useState(partner.level);
  const asked = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);

  const finish = useCallback(async () => {
    setError(null);
    try {
      const done = await otome.post<DateFinishResult>(`${runPath(runKey)}/dates/${encodeURIComponent(dateKey)}/finish`);
      setResult(done);
      patchRun(queryClient, runKey, (current) => ({ ...current, starlight: done.starlight }));
      if (done.grants.some((grant) => grant.affection)) {
        void queryClient.invalidateQueries({ queryKey: runQueryKey(runKey) });
      }
      // Today's rewards and Make it right on the Dates hub.
      if (done.counted) void queryClient.invalidateQueries({ queryKey: playQueryKey(runKey) });
      onCounted();
    } catch (failure) {
      setError(failure);
    }
  }, [dateKey, onCounted, otome, queryClient, runKey]);

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    void finish();
  }, [finish]);

  // The outcome replaces the counting panel, and the heading that had focus with it: focus goes to the new one, never
  // away from wherever the player has moved it meanwhile.
  useEffect(() => {
    const active = document.activeElement;
    if (result && (!active || active === document.body)) headingRef.current?.focus({ preventScroll: true });
  }, [result]);

  if (!result) {
    return (
      <section className="of-reader-panel of-glass of-glass--strong of-date-counting" role={error ? "alert" : "status"}>
        <h1 className="of-section-title" tabIndex={-1}>
          {error
            ? t("ui.otomeForge.dateNight.countFailed")
            : t("ui.otomeForge.dateNight.counting", { name: partner.name })}
        </h1>
        {error ? (
          <>
            <p className="of-body">{otome.errorMessage(error)}</p>
            <button
              type="button"
              className="of-button of-button--primary of-button--small"
              onClick={() => void finish()}
            >
              <RotateCcw size={15} strokeWidth={2} aria-hidden="true" />
              {t("ui.otomeForge.common.retry")}
            </button>
          </>
        ) : (
          <Heart className="of-pulse" size={24} strokeWidth={1.6} fill="currentColor" aria-hidden="true" />
        )}
      </section>
    );
  }

  const { outcome, date } = result;
  const starlight = result.grants.reduce((sum, grant) => sum + (grant.starlight ?? 0), 0);
  const affection = result.grants.reduce((sum, grant) => sum + (grant.affection ?? 0), 0);
  const level = view.lis.find((li) => li.id === partner.id)?.level ?? partner.level;
  const rose = level > levelBefore;
  // Make it right only when its rupture still stood as the date was counted (mended elsewhere first, it was an
  // ordinary evening); whether it mended is the server's to say: a good evening with a scene eased off before its
  // choice does not, nor does one that leaves another rupture standing.
  const mend = date.makeItRight;
  const mended = result.mends;
  return (
    <article className="of-date-ending" data-outcome={outcome} aria-labelledby="of-date-ending">
      <section className="of-date-ending-card of-glass of-glass--strong">
        <span
          className="of-mood"
          data-mood={outcome === "awkward" ? "tense" : "date"}
          data-on="true"
          aria-hidden="true"
        />
        <span className="of-date-ending-hearts" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <Heart key={index} size={14 + (index === 1 ? 8 : 0)} strokeWidth={1.6} fill="currentColor" />
          ))}
        </span>
        <Avatar name={partner.name} url={partner.portrait} accent={accentOf(partner)} size={72} />
        <p className="of-eyebrow">
          {mend ? t("ui.otomeForge.dateNight.makeItRight") : t("ui.otomeForge.dateNight.title")} ·{" "}
          {date.placeName || t(PLACE_NAME_KEYS[date.place], { name: partner.name })}
        </p>
        <h1 ref={headingRef} id="of-date-ending" className="of-chapter-end-title" tabIndex={-1}>
          {mend
            ? mended
              ? t("ui.otomeForge.dateNight.repaired")
              : t("ui.otomeForge.dateNight.notRepaired")
            : t(OUTCOME_TITLE_KEYS[outcome])}
        </h1>
        <p className="of-subtitle">{date.title}</p>
        <p className="of-body">
          {mend
            ? mended
              ? t("ui.otomeForge.dateNight.repairedText", { name: partner.name })
              : t("ui.otomeForge.dateNight.notRepairedText", { name: partner.name })
            : t(OUTCOME_TEXT_KEYS[outcome], { name: partner.name })}
        </p>
        {result.line ? (
          <figure className="of-date-line">
            <blockquote>
              <p>{t("ui.otomeForge.dateNight.quoted", { line: result.line })}</p>
            </blockquote>
            <figcaption>{t("ui.otomeForge.dateNight.lastWords", { name: partner.name })}</figcaption>
          </figure>
        ) : null}
      </section>

      {result.picks.length ? (
        <section className="of-section of-glass" aria-labelledby="of-date-picks">
          <h2 id="of-date-picks" className="of-section-title">
            {t("ui.otomeForge.dateNight.picksTitle", { name: partner.name })}
          </h2>
          <ol className="of-date-picks">
            {result.picks.map((pick, index) => {
              const label = t(PICK_LABEL_KEYS[`${pick.score}`], { name: partner.name });
              const Icon = pick.score < 0 ? HeartCrack : Heart;
              return (
                <li key={index} className="of-date-pick" data-score={pick.score}>
                  <span className="of-date-pick-mark">
                    <Icon
                      size={16}
                      strokeWidth={2}
                      fill={pick.score > 0 ? "currentColor" : "none"}
                      aria-hidden="true"
                    />
                    <span className="of-visually-hidden">{label}</span>
                  </span>
                  <span className="of-date-pick-text">{pick.text}</span>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      <section className="of-section of-glass" aria-labelledby="of-date-earned">
        <h2 id="of-date-earned" className="of-section-title">
          {t("ui.otomeForge.dateNight.earnedTitle")}
        </h2>
        {starlight || affection ? (
          <ul className="of-grants">
            {starlight ? (
              <li className="of-grant of-grant--starlight">
                <Sparkle size={16} strokeWidth={1.6} fill="currentColor" aria-hidden="true" />
                <span>{t("ui.otomeForge.reader.grantStarlight", { amount: number(starlight) })}</span>
              </li>
            ) : null}
            {affection ? (
              <li className="of-grant" style={accentStyle(partner)} data-rose={rose}>
                <Avatar name={partner.name} url={partner.portrait} accent={accentOf(partner)} size={30} />
                <span>
                  {t("ui.otomeForge.reader.grantAffection", { name: partner.name, amount: number(affection) })}
                </span>
                <span className="of-badge of-badge--soft">
                  {rose ? t("ui.otomeForge.reader.levelUp", { level }) : t("ui.otomeForge.story.level", { level })}
                </span>
              </li>
            ) : null}
          </ul>
        ) : (
          <p className="of-hint">
            {result.counted ? t("ui.otomeForge.dateNight.earnedCapped") : t("ui.otomeForge.dateNight.earnedBefore")}
          </p>
        )}
      </section>

      {result.keepsake.offer || date.keepsake ? (
        <Keepsake runKey={runKey} view={view} partner={partner} entry={date} onPainted={onCounted} />
      ) : null}

      <div className="of-dates-actions">
        <button type="button" className="of-button of-button--quiet of-glass" onClick={onHome}>
          <House size={16} strokeWidth={2} aria-hidden="true" />
          {t("ui.otomeForge.common.screenHome")}
        </button>
        <button type="button" className="of-button of-button--primary" onClick={onDone}>
          <CalendarHeart size={16} strokeWidth={2} aria-hidden="true" />
          {t("ui.otomeForge.dateNight.toDates")}
        </button>
      </div>
    </article>
  );
}

interface KeepsakeProps {
  runKey: string;
  view: RunView;
  partner: RunLiView;
  entry: DateEntry;
  onPainted: () => void;
}

/**
 * The keepsake: offered with its cost, painted only on a tap (after a confirmation when Ask before painting is on,
 * through the prompt review when the Engine asks for it), then kept in a polaroid frame. A failure says so and
 * waits for Try again; it is never repainted by itself.
 */
function Keepsake({ runKey, view, partner, entry, onPainted }: KeepsakeProps) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const { reviewImagePromptsBeforeSend } = useOtomeProps();
  const [art, setArt] = useState<Paint | null>(entry.keepsake);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [review, setReview] = useState<ImagePrompt | null>(null);
  const subject = t("ui.otomeForge.dateNight.keepsakeSubject", { name: partner.name });

  const paint = async (prompt?: ImagePrompt) => {
    setBusy(true);
    setError(null);
    try {
      const { paint: painted } = await otome.post<{ paint: Paint }>(`${runPath(runKey)}/art/keepsake`, {
        key: entry.key,
        ...(prompt ?? {}),
      });
      setArt(painted);
      setReview(null);
      onPainted();
    } catch (failure) {
      setError(otome.errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  /** The player's tap: review the prompt first when the Engine asks for that, else paint. */
  const start = async () => {
    setConfirming(false);
    if (!reviewImagePromptsBeforeSend) {
      await paint();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setReview(await otome.post<ImagePrompt>(`${runPath(runKey)}/art/keepsake/prompt`, { key: entry.key }));
    } catch (failure) {
      setError(otome.errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  const tap = () => {
    if (busy) return;
    if (view.world.images.ask) setConfirming(true);
    else void start();
  };

  const ready = art?.state === "ready" && art.url ? art : null;
  const failed = art?.state === "failed" || art?.state === "stopped";
  return (
    <section className="of-section of-glass of-keepsake" aria-labelledby="of-keepsake-title" aria-busy={busy}>
      <h2 id="of-keepsake-title" className="of-section-title">
        {t("ui.otomeForge.dateNight.keepsakeTitle")}
      </h2>
      {ready ? (
        <figure className="of-keepsake-photo">
          <img
            src={ready.url}
            alt={t("ui.otomeForge.dateNight.keepsakeAlt", { name: partner.name, title: entry.title })}
          />
          <figcaption className="of-keepsake-caption">{entry.title}</figcaption>
        </figure>
      ) : (
        <>
          <p className="of-body">{t("ui.otomeForge.dateNight.keepsakeText", { name: partner.name })}</p>
          {busy && !review ? (
            <p className="of-hint of-keepsake-busy" role="status">
              <Paintbrush className="of-pulse" size={15} strokeWidth={2} aria-hidden="true" />
              {t("ui.otomeForge.dateNight.keepsakePainting")}
            </p>
          ) : null}
          {failed && !busy ? (
            <p className="of-notice of-notice--error" role="alert">
              {art?.state === "stopped"
                ? t("ui.otomeForge.dateNight.keepsakeStopped")
                : t("ui.otomeForge.dateNight.keepsakeFailed")}
            </p>
          ) : null}
          {error ? (
            <p className="of-notice of-notice--error" role="alert">
              {error}
            </p>
          ) : null}
          <CostHint images={1} />
          <button
            type="button"
            className="of-button of-button--primary of-button--small"
            aria-disabled={busy}
            onClick={tap}
          >
            {failed ? (
              <RotateCcw size={15} strokeWidth={2} aria-hidden="true" />
            ) : (
              <Paintbrush size={15} strokeWidth={2} aria-hidden="true" />
            )}
            {failed ? t("ui.otomeForge.common.retry") : t("ui.otomeForge.dateNight.keepsakePaint")}
          </button>
        </>
      )}
      {confirming ? (
        <Dialog
          title={t("ui.otomeForge.dateNight.keepsakeAskTitle")}
          onClose={() => setConfirming(false)}
          actions={
            <>
              <button
                type="button"
                className="of-button of-button--quiet of-glass"
                onClick={() => setConfirming(false)}
              >
                {t("ui.otomeForge.dateNight.keepsakeAskNo")}
              </button>
              <button type="button" className="of-button of-button--primary" onClick={() => void start()}>
                <Paintbrush size={16} strokeWidth={2} aria-hidden="true" />
                {t("ui.otomeForge.dateNight.keepsakeAskYes")}
              </button>
            </>
          }
        >
          <p className="of-body">{t("ui.otomeForge.dateNight.keepsakeAskText", { name: partner.name })}</p>
          <CostHint images={1} />
        </Dialog>
      ) : null}
      {review ? (
        <PromptReviewDialog
          subject={subject}
          initial={review}
          busy={busy}
          error={error}
          onSend={(prompt) => void paint(prompt)}
          onSkip={() => setReview(null)}
        />
      ) : null}
    </section>
  );
}
