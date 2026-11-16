// ──────────────────────────────────────────────
// Otome Forge: a date (plan M5; #2303, dates won from Wish). Who's coming, and what she wears; the date's scenes in the
// reader (one choice each, scored in secret against what they like); then how it went: what landed with them, their
// last words, what it earned, and a keepsake that paints only when the player asks for it.
// ──────────────────────────────────────────────
// #2303: Date Night is no longer started. A date is won on Wish's Dates banner (an item: its title, premise, place and
// scenes) and opened here from Wish, or from the Album's Dates tab, as `{item}`; an earlier date, of either kind, is
// opened as `{key}` to go on with it or count it. For a won date the player picks whom to take: one love interest or
// several, none of them holding a grievance of their own (PlayView `held`). Someone who has been on the date already
// can only read it again: a company with someone new writes a new playthrough, one with nobody new reads one of its
// playthroughs again (they are listed under the company). The server returns the playthrough with the same company
// that is still open instead of planning another (`resumed`), and leaving mid-date keeps it for later. The outcome is
// counted once by the server; reopening a date read to its end counts it then.
// #2128: with a gift from the Shop in hand (the Wardrobe view's `gifts`, absent from an older server), the looks step
// also offers Bring a gift; the gift is spent when the date is planned, and the ending names it.
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Check,
  ChevronLeft,
  Feather,
  Gift,
  Heart,
  HeartCrack,
  House,
  MapPin,
  Paintbrush,
  PlugZap,
  RotateCcw,
  Sparkle,
  Users,
  X,
} from "lucide-react";
import { useOtomeApi } from "../../api";
import { Avatar } from "../../components/Avatar";
import { CostHint } from "../../components/CostHint";
import { DeclinedPanel } from "../../components/DeclinedPanel";
import { Dialog } from "../../components/Dialog";
import { GIFT_NAME_KEYS, GiftArt } from "../../components/GiftArt";
import { PromptReviewDialog, type ImagePrompt } from "../../components/PromptReviewDialog";
import { cancelStoryWork, runPath } from "../../hooks/use-reader";
import { patchRun, runQueryKey } from "../../hooks/use-run";
import { accentOf } from "../../lib/accent";
import { useOtomeProps } from "../../props";
import type { LiId, Paint, RunLiView, RunView } from "../../shared/api-types";
import {
  BASE_LOOK,
  dateCast,
  newcomersOf,
  type DateEntry,
  type DateFinishResult,
  type DateOutcome,
  type DateScore,
  type DatesView,
  type PulledDate,
} from "../../shared/dates";
import { giftsFor, type GiftId } from "../../shared/shop";
import { Reader } from "../reader/Reader";
import { playQueryKey, usePlay } from "./DatesHub";
import { LookPicker, wornDateLook } from "./LookPicker";
import { useWardrobe } from "../wardrobe/Wardrobe";
import { datesQueryKey, shopQueryKey, wardrobeQueryKey } from "../../hooks/use-items";
import { PLACE_NAME_KEYS } from "./PlacePicker";
import { WaitQuiz } from "../story/PersonalityQuiz";

/** GET /runs/:run/dates: the dates won from Wish with their playthroughs, and every date not counted yet or counted. */
export function useDates(runKey: string) {
  const otome = useOtomeApi();
  return useQuery({
    queryKey: datesQueryKey(runKey),
    queryFn: () => otome.get<DatesView>(`${runPath(runKey)}/dates`),
    // A plan left mid-write can still finish on the server, so a list cached earlier may miss that date.
    refetchOnMount: "always",
    // 0.34.8: a won date's place painting in the background (Album → Dates, Paint it) is read again until it lands.
    refetchInterval: (query) =>
      query.state.data?.pulled?.some(({ item }) => item.art?.state === "pending") ? 4_000 : false,
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

export const OUTCOME_SHORT_KEYS: Record<DateOutcome, string> = {
  great: "ui.otomeForge.dateNight.outcomeGreatShort",
  good: "ui.otomeForge.dateNight.outcomeGoodShort",
  awkward: "ui.otomeForge.dateNight.outcomeAwkwardShort",
};

const PICK_LABEL_KEYS: Record<`${DateScore}`, string> = {
  "1": "ui.otomeForge.dateNight.pickLoved",
  "0": "ui.otomeForge.dateNight.pickFine",
  "-1": "ui.otomeForge.dateNight.pickGrated",
};

/** "Kai", "Kai and Sol", "Kai, Sol and Mira", in the player's language. */
export function useNames() {
  const { locale } = useOtomeProps().localization;
  return (names: readonly string[]) => new Intl.ListFormat(locale, { type: "conjunction" }).format(names);
}

/**
 * What the date screen opens: a won date to take someone on (#2303), or an earlier date to go on with by its key, at
 * its ending when `at` says so (#2302: where the player was when they left for Settings).
 */
export type DateOpen = { item: string } | { key: string; at?: "ending" };

type Step =
  | { kind: "company" }
  | { kind: "looks" }
  | { kind: "planning" }
  | { kind: "reading"; key: string }
  | { kind: "ending"; key: string };

export interface DateNightProps {
  runKey: string;
  view: RunView;
  open: DateOpen;
  /** Back where it was opened from (onExit), with that place's name for its button. */
  onExit: () => void;
  exitLabel: string;
  /** Home, from the reader's and the ending's Home button; Back (onExit) when omitted. */
  onHome?: () => void;
  /** True while the date's scenes are read full-stage (the top bar and the dock step aside), false otherwise. */
  onImmersive?: (immersive: boolean) => void;
  /**
   * #2302: where the date is now, each time the player moves to a playthrough's scenes or its ending, so the screen can
   * open there again after a trip to Settings instead of at its first step.
   */
  onResume?: (open: DateOpen) => void;
  /** #2302: opens Settings → Images, from a keepsake that could not be painted. */
  onImageSettings?: () => void;
}

/**
 * Where a date opens by its entry: its scenes to read (still to read, or a counted date read again), or, read through
 * and not counted yet, its outcome.
 */
const stepOf = (entry: Pick<DateEntry, "key" | "state">): Step =>
  entry.state === "done" ? { kind: "ending", key: entry.key } : { kind: "reading", key: entry.key };

/** Every date the view lists, newest first: open ones, won dates' playthroughs, counted ones. */
const allEntries = (view: DatesView | undefined): DateEntry[] => [
  ...(view?.open ?? []),
  ...(view?.pulled ?? []).flatMap((entry) => entry.plays),
  ...(view?.dates ?? []),
];

export function DateNight({
  runKey,
  view,
  open,
  onExit,
  exitLabel,
  onHome = onExit,
  onImmersive,
  onResume,
  onImageSettings,
}: DateNightProps) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const names = useNames();
  const dates = useDates(runKey);
  const play = usePlay(runKey);
  const [step, setStep] = useState<Step | null>(null);
  const [picked, setPicked] = useState<LiId[]>([]);
  const held = (li: LiId) => !!play.data?.lis[li]?.held;
  // Who's coming: those picked, less anyone whose grievance shows only now (PlayView may arrive after the dates). They
  // show unchecked, and nothing planned or sent holds them.
  const cast = picked.filter((li) => !held(li));
  const [herLook, setHerLook] = useState(BASE_LOOK);
  // The looks she owns (the Wardrobe's list): the picker starts on what she wears now.
  const wardrobe = useWardrobe(runKey);
  const chosenLook = useRef(false);
  const [planError, setPlanError] = useState<unknown>(null);
  const abortRef = useRef<AbortController | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  // Set by the player's own navigation, so focus moves only then: to the new step's heading, which also announces it.
  const moved = useRef(false);
  const herWorn = wornDateLook(wardrobe.data?.me);
  useEffect(() => {
    if (!chosenLook.current) setHerLook(herWorn);
  }, [herWorn]);
  // #2128: the gifts she can bring (owned, and offered under the story's Heat), and the one picked while she has it.
  const [gift, setGift] = useState<GiftId | null>(null);
  const gifts = giftsFor(view.world.content).flatMap((id) => {
    const count = wardrobe.data?.gifts?.[id] ?? 0;
    return count > 0 ? [{ id, count }] : [];
  });
  const given = gifts.some((entry) => entry.id === gift) ? gift : null;

  const pulled = "item" in open ? (dates.data?.pulled.find((entry) => entry.item.id === open.item) ?? null) : null;
  const entry = step && "key" in step ? (allEntries(dates.data).find((item) => item.key === step.key) ?? null) : null;
  // Who the date is with: the company being picked, else the date's own (its entry's cast, or Date Night's one or two).
  const company = (
    step?.kind === "company" || step?.kind === "looks" || step?.kind === "planning"
      ? cast
      : entry
        ? (entry.cast ?? (entry.second ? [entry.li, entry.second] : [entry.li]))
        : cast
  ).flatMap((li) => view.lis.filter((item) => item.id === li));
  const lead = company[0] ?? null;
  const together = names(company.map((li) => li.name));

  // Opens once the dates are known. On a first visit that is after the loading state, which has no heading for the
  // router to focus, so focus goes to the step's heading as it would after a move. Only a list fetched since this
  // screen opened counts: one cached from before may lack a date that finished after the player left.
  if (step === null && dates.data && dates.isFetchedAfterMount && !dates.isError) {
    moved.current = true;
    if ("key" in open) {
      const found = allEntries(dates.data).find((item) => item.key === open.key);
      setStep(
        open.at === "ending"
          ? { kind: "ending", key: open.key }
          : found
            ? stepOf(found)
            : { kind: "reading", key: open.key },
      );
    } else setStep({ kind: "company" });
  }

  const go = useCallback((next: Step) => {
    moved.current = true;
    setStep(next);
  }, []);

  // #2302: where the date is now, whichever way it got there (the first step a date opens at included), so a trip to
  // Settings opens it there again.
  const stepKind = step?.kind;
  const stepKey = step && "key" in step ? step.key : null;
  useEffect(() => {
    if (!stepKey) return;
    if (stepKind === "reading") onResume?.({ key: stepKey });
    if (stepKind === "ending") onResume?.({ key: stepKey, at: "ending" });
  }, [onResume, stepKind, stepKey]);

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
    // Starting a date wears her look (S/routes/dates.ts): Home and the Wardrobe show it, and they and the Shop count
    // the gift it spent.
    void queryClient.invalidateQueries({ queryKey: wardrobeQueryKey(runKey) });
    void queryClient.invalidateQueries({ queryKey: shopQueryKey(runKey) });
    void queryClient.invalidateQueries({ queryKey: runQueryKey(runKey) });
  }, [queryClient, runKey]);

  const plan = useCallback(async () => {
    if (!pulled || !cast.length) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setPlanError(null);
    go({ kind: "planning" });
    try {
      const { date } = await otome.post<{ date: DateEntry; resumed: boolean }>(
        `${runPath(runKey)}/dates/pulled`,
        { item: pulled.item.id, cast, herLook, ...(given ? { gift: given } : {}) },
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      refresh();
      go(stepOf(date));
    } catch (error) {
      if (controller.signal.aborted) return;
      setPlanError(error);
      // A gift given elsewhere meanwhile is refused: the picker reads her gifts again.
      if (given) void queryClient.invalidateQueries({ queryKey: wardrobeQueryKey(runKey) });
    }
  }, [cast, given, go, herLook, otome, pulled, queryClient, refresh, runKey]);

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

  if (!step || ("item" in open && step.kind === "company" && !pulled)) {
    const missing = !!dates.data && dates.isFetchedAfterMount && "item" in open && !pulled;
    return (
      <div className="of-page of-dates">
        {dates.isError || missing ? (
          <div className="of-panel of-panel--center of-card of-glass" role="alert">
            <h1 className="of-section-title" tabIndex={-1}>
              {t("ui.otomeForge.dateNight.pulledTitle")}
            </h1>
            <p className="of-error">
              {dates.isError ? otome.errorMessage(dates.error) : t("ui.otomeForge.dateNight.pulledMissing")}
            </p>
            {dates.isError ? (
              <button
                type="button"
                className="of-button of-button--quiet of-glass"
                onClick={() => void dates.refetch()}
              >
                <RotateCcw size={16} strokeWidth={2} aria-hidden="true" />
                {t("ui.otomeForge.common.retry")}
              </button>
            ) : (
              <button type="button" className="of-button of-button--quiet of-glass" onClick={onExit}>
                <ChevronLeft className="of-back-icon" size={16} strokeWidth={2} aria-hidden="true" />
                {exitLabel}
              </button>
            )}
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
          exitLabel={exitLabel}
          onHome={() => {
            refresh();
            onHome();
          }}
          onFinished={() => go({ kind: "ending", key: step.key })}
        />
      </div>
    );
  }

  const newcomers = pulled ? newcomersOf(cast, pulled.playedBy) : [];
  const sameCompany = (play: DateEntry) => {
    const own = dateCast(play);
    return own.length === cast.length && own.every((li) => cast.includes(li));
  };
  // With nobody new, the playthrough this company already had: to go on with, or to read again.
  const again = pulled && cast.length && !newcomers.length ? (pulled.plays.find(sameCompany) ?? null) : null;

  return (
    <div ref={rootRef} className="of-page of-dates" style={lead ? accentStyle(lead) : undefined}>
      {step.kind === "company" && pulled ? (
        <>
          <StepHead pulled={pulled} company={company} step={1} title={t("ui.otomeForge.dateNight.companyTitle")} />
          <CompanyPicker view={view} playedBy={pulled.playedBy} held={held} value={cast} onChange={setPicked} />
          <div className="of-dates-actions">
            {!cast.length || newcomers.length ? (
              <button
                type="button"
                className="of-button of-button--primary"
                aria-disabled={!cast.length}
                aria-describedby={cast.length ? undefined : "of-date-company-needed"}
                onClick={() => {
                  if (cast.length) go({ kind: "looks" });
                }}
              >
                {t("ui.otomeForge.dateNight.toLooks")}
              </button>
            ) : again ? (
              <button type="button" className="of-button of-button--primary" onClick={() => go(stepOf(again))}>
                <BookOpen size={16} strokeWidth={2} aria-hidden="true" />
                {again.state === "finished"
                  ? t("ui.otomeForge.dateNight.playReadAgain")
                  : t("ui.otomeForge.dateNight.playContinue")}
              </button>
            ) : null}
          </div>
          {!cast.length ? (
            <p id="of-date-company-needed" className="of-hint of-dates-pick-hint">
              {t("ui.otomeForge.dateNight.companyNeeded")}
            </p>
          ) : !newcomers.length && !again ? (
            <p className="of-hint of-dates-pick-hint" role="status">
              {t("ui.otomeForge.dateNight.companyAllPlayed")}
            </p>
          ) : null}
          <PlaysList view={view} plays={pulled.plays} onOpen={(play) => go(stepOf(play))} />
        </>
      ) : null}

      {step.kind === "looks" && pulled ? (
        <>
          <StepHead pulled={pulled} company={company} step={2} title={t("ui.otomeForge.dateNight.looksTitlePulled")} />
          <LookPicker
            partner={null}
            player={view.player}
            herLooks={wardrobe.data?.me}
            hisLook={BASE_LOOK}
            herLook={herLook}
            onChange={(next) => {
              chosenLook.current = true;
              setHerLook(next.herLook);
            }}
          />
          {gifts.length ? (
            <GiftPicker
              partnerName={together}
              gifts={gifts}
              value={given}
              onChange={setGift}
              hint={company.length > 1 ? t("ui.otomeForge.dateNight.giftHintGroup", { names: together }) : undefined}
            />
          ) : null}
          <section className="of-section of-glass of-date-summary" aria-labelledby="of-date-summary">
            <p className="of-eyebrow">{t("ui.otomeForge.dateNight.tonight")}</p>
            <h2 id="of-date-summary" className="of-section-title of-date-summary-title">
              <MapPin size={18} strokeWidth={1.8} aria-hidden="true" />
              <span>
                {t("ui.otomeForge.dateNight.pulledSummary", {
                  title: pulled.item.title,
                  place: pulled.item.place?.name ?? "",
                  count: pulled.item.scenes ?? 1,
                })}
              </span>
            </h2>
            {pulled.item.premise ? <p className="of-body">{pulled.item.premise}</p> : null}
            <p className="of-body">
              {t("ui.otomeForge.dateNight.pulledHowItPlays", { names: together, count: pulled.item.scenes ?? 1 })}
            </p>
            {newcomers.length < cast.length ? (
              <p className="of-hint">
                {t("ui.otomeForge.dateNight.pulledFirstTimers", {
                  names: names(
                    newcomers.flatMap((li) => view.lis.filter((item) => item.id === li).map((item) => item.name)),
                  ),
                })}
              </p>
            ) : null}
            {given ? (
              <p className="of-notice of-date-gift-line">
                <GiftArt gift={given} className="of-date-gift-icon" />
                <span>
                  {t("ui.otomeForge.dateNight.giftBring", { name: together, gift: t(GIFT_NAME_KEYS[given]) })}
                </span>
              </p>
            ) : null}
          </section>
          <div className="of-dates-actions">
            <button
              type="button"
              className="of-button of-button--quiet of-glass"
              onClick={() => go({ kind: "company" })}
            >
              <ChevronLeft className="of-back-icon" size={16} strokeWidth={2} aria-hidden="true" />
              {t("ui.otomeForge.dateNight.toCompany")}
            </button>
            <button
              type="button"
              className="of-button of-button--primary"
              aria-disabled={!cast.length}
              aria-describedby={cast.length ? undefined : "of-date-company-needed"}
              onClick={() => void plan()}
            >
              <Heart size={16} strokeWidth={2} fill="currentColor" aria-hidden="true" />
              {t("ui.otomeForge.dateNight.begin")}
            </button>
          </div>
          {/* Everyone picked turned out to need space (PlayView came after the dates): back to who's coming. */}
          {!cast.length ? (
            <p id="of-date-company-needed" className="of-hint of-dates-pick-hint" role="status">
              {t("ui.otomeForge.dateNight.companyNeeded")}
            </p>
          ) : null}
        </>
      ) : null}

      {step.kind === "planning" && pulled ? (
        <>
          <StepHead pulled={pulled} company={company} title={t("ui.otomeForge.dateNight.planningTitle")} />
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
            <>
              <section className="of-reader-panel of-writing of-glass of-glass--strong" role="status">
                <span className="of-quill" aria-hidden="true">
                  <Feather size={22} strokeWidth={1.7} />
                </span>
                <p className="of-section-title">{t("ui.otomeForge.dateNight.planning", { name: together })}</p>
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
              <WaitQuiz runKey={runKey} lis={view.lis} />
            </>
          )}
        </>
      ) : null}

      {step.kind === "ending" && lead ? (
        <DateEnding
          key={step.key}
          runKey={runKey}
          view={view}
          company={company}
          dateKey={step.key}
          exitLabel={exitLabel}
          onDone={leave}
          onHome={() => {
            refresh();
            onHome();
          }}
          onCounted={refresh}
          onImageSettings={onImageSettings}
        />
      ) : null}
    </div>
  );
}

const accentStyle = (li: RunLiView) => ({ "--of-li-accent": accentOf(li) }) as CSSProperties;

interface CompanyPickerProps {
  view: RunView;
  /** Everyone who has been on this date: it only replays for them. */
  playedBy: readonly LiId[];
  /** Whether a love interest holds a grievance of their own with her (#2156): every date with them waits. */
  held: (li: LiId) => boolean;
  value: readonly LiId[];
  onChange: (cast: LiId[]) => void;
}

/**
 * #2303: who's coming: one love interest, several or everyone, as a group of checkboxes in cast order (the order they
 * were picked is the order the date names them). One who has been on this date is marked; one who needs space can't
 * come.
 */
function CompanyPicker({ view, playedBy, held, value, onChange }: CompanyPickerProps) {
  const { t } = useTranslation();
  const id = useId();
  return (
    // A group with a heading, not a fieldset: Safari keeps a legend on the card's top border in a flex fieldset
    // (.of-section), with the glass painted above it (0.34.8).
    <div
      role="group"
      className="of-section of-glass of-partners"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-hint`}
    >
      <h2 id={`${id}-title`} className="of-section-title">
        <Users size={18} strokeWidth={1.9} aria-hidden="true" />
        {t("ui.otomeForge.dateNight.companyLegend")}
      </h2>
      <p id={`${id}-hint`} className="of-hint">
        {t("ui.otomeForge.dateNight.companyHint")}
      </p>
      <div className="of-partner-list">
        {view.lis.map((li) => {
          const checked = value.includes(li.id);
          const away = held(li.id);
          return (
            <label
              key={li.id}
              className="of-partner"
              data-checked={checked}
              data-disabled={away || undefined}
              style={accentStyle(li)}
            >
              <input
                type="checkbox"
                className="of-visually-hidden"
                name={`${id}-company`}
                value={li.id}
                checked={checked}
                disabled={away}
                onChange={() => onChange(checked ? value.filter((item) => item !== li.id) : [...value, li.id])}
              />
              <Avatar name={li.name} url={li.portrait} accent={accentOf(li)} size={46} />
              <span className="of-partner-name">{li.name}</span>
              <span className="of-partner-level">
                {away ? (
                  <>
                    <HeartCrack size={10} strokeWidth={2} aria-hidden="true" />
                    {t("ui.otomeForge.dateNight.companyHeld")}
                  </>
                ) : playedBy.includes(li.id) ? (
                  <>
                    <Check size={10} strokeWidth={3} aria-hidden="true" />
                    {t("ui.otomeForge.dateNight.companyPlayed")}
                  </>
                ) : (
                  <>
                    <Heart size={10} strokeWidth={2} fill="currentColor" aria-hidden="true" />
                    {t("ui.otomeForge.story.level", { level: li.level })}
                  </>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

/** #2303: a won date's playthroughs, newest first: who came, and Continue or Read again. */
export function PlaysList({
  view,
  plays,
  onOpen,
}: {
  view: RunView;
  plays: readonly DateEntry[];
  onOpen: (play: DateEntry) => void;
}) {
  const { t } = useTranslation();
  const names = useNames();
  const id = useId();
  if (!plays.length) return null;
  return (
    <section className="of-section of-glass" aria-labelledby={`${id}-plays`}>
      <h2 id={`${id}-plays`} className="of-section-title">
        {t("ui.otomeForge.dateNight.playsTitle")}
      </h2>
      <ul className="of-date-history">
        {plays.map((play) => {
          const company = dateCast(play).flatMap((li) => view.lis.filter((item) => item.id === li));
          const first = company[0];
          return (
            <li key={play.key} className="of-date-memory">
              {first ? <Avatar name={first.name} url={first.portrait} accent={accentOf(first)} size={40} /> : null}
              <span className="of-date-memory-text">
                <span className="of-date-memory-title">
                  {t("ui.otomeForge.dateNight.playWith", { names: names(company.map((li) => li.name)) })}
                </span>
                <span className="of-hint">
                  {play.state === "finished"
                    ? t("ui.otomeForge.dateNight.playFinished")
                    : play.state === "done"
                      ? t("ui.otomeForge.dateNight.playDone")
                      : t("ui.otomeForge.dateNight.playReading")}
                </span>
              </span>
              <button
                type="button"
                className="of-button of-button--quiet of-glass of-button--small"
                aria-label={t("ui.otomeForge.dateNight.playOpenLabel", {
                  action:
                    play.state === "finished"
                      ? t("ui.otomeForge.dateNight.playReadAgain")
                      : t("ui.otomeForge.dateNight.playContinue"),
                  names: names(company.map((li) => li.name)),
                })}
                onClick={() => onOpen(play)}
              >
                <BookOpen size={14} strokeWidth={2} aria-hidden="true" />
                {play.state === "finished"
                  ? t("ui.otomeForge.dateNight.playReadAgain")
                  : t("ui.otomeForge.dateNight.playContinue")}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

interface GiftPickerProps {
  partnerName: string;
  /** The gifts she can bring, each with how many she owns (shown only when there is one). */
  gifts: Array<{ id: GiftId; count: number }>;
  value: GiftId | null;
  onChange: (gift: GiftId | null) => void;
  /** #2153: the heading and hint where it is not a date's (a birthday's); a date's by default. */
  title?: string;
  hint?: string;
}

/** #2128: Bring a gift: No gift, or one of hers, as a radio group of small cards. */
export function GiftPicker({ partnerName, gifts, value, onChange, title, hint }: GiftPickerProps) {
  const { t } = useTranslation();
  const id = useId();
  const options = [null, ...gifts];
  return (
    <section className="of-section of-glass of-date-gifts" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="of-section-title">
        <Gift size={18} strokeWidth={1.9} aria-hidden="true" />
        {title ?? t("ui.otomeForge.dateNight.giftTitle")}
      </h2>
      <p className="of-hint">{hint ?? t("ui.otomeForge.dateNight.giftHint", { name: partnerName })}</p>
      <div className="of-date-gift-options" role="radiogroup" aria-labelledby={`${id}-title`}>
        {options.map((option) => {
          const checked = value === (option?.id ?? null);
          const name = option ? t(GIFT_NAME_KEYS[option.id]) : t("ui.otomeForge.dateNight.giftNone");
          return (
            <label key={option?.id ?? "none"} className="of-date-gift" data-checked={checked}>
              <input
                type="radio"
                className="of-visually-hidden"
                name={`${id}-gift`}
                value={option?.id ?? ""}
                checked={checked}
                onChange={() => onChange(option?.id ?? null)}
              />
              <span className="of-date-gift-frame" aria-hidden="true">
                {option ? (
                  <>
                    <GiftArt gift={option.id} className="of-date-gift-art" />
                    <span className="of-shelf-count">×{option.count}</span>
                  </>
                ) : (
                  <Gift className="of-date-gift-none" size={24} strokeWidth={1.6} />
                )}
              </span>
              <span className="of-date-gift-name" aria-hidden={option ? true : undefined}>
                {checked ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : null}
                {name}
              </span>
              {option ? (
                <span className="of-visually-hidden">
                  {t("ui.otomeForge.shop.ownedCount", { name, count: option.count })}
                </span>
              ) : null}
            </label>
          );
        })}
      </div>
    </section>
  );
}

interface StepHeadProps {
  pulled: PulledDate;
  /** Whom the player has picked so far. */
  company: RunLiView[];
  /** "Step n of 2" while choosing; none while planning. */
  step?: number;
  title: string;
}

/** The step's heading: the date (its name), who's coming once anyone is, and the step's question. */
function StepHead({ pulled, company, step, title }: StepHeadProps) {
  const { t } = useTranslation();
  const lead = company[0];
  return (
    <header className="of-date-head">
      {lead ? (
        <Avatar name={lead.name} url={lead.portrait} accent={accentOf(lead)} size={54} />
      ) : (
        <span className="of-emblem of-glass" aria-hidden="true">
          <MapPin size={26} strokeWidth={1.6} />
        </span>
      )}
      <div className="of-date-head-text">
        <p className="of-eyebrow">
          {t("ui.otomeForge.dateNight.pulledTitle")}
          {step ? (
            <span className="of-faint"> · {t("ui.otomeForge.dateNight.stepOf", { number: step, total: 2 })}</span>
          ) : null}
        </p>
        <h1 className="of-title of-title--page" tabIndex={-1}>
          {title}
        </h1>
        <p className="of-hand">{pulled.item.title}</p>
      </div>
    </header>
  );
}

interface DateEndingProps {
  runKey: string;
  view: RunView;
  /** Everyone on the date, its first love interest first. */
  company: RunLiView[];
  dateKey: string;
  /** Back where the date was opened from, with that place's name. */
  exitLabel: string;
  onDone: () => void;
  onHome: () => void;
  /** The server counted the date (the dates list changed). */
  onCounted: () => void;
  onImageSettings?: () => void;
}

/** How the evening went. Counting it is the server's (once); this asks once per date and shows what came back. */
function DateEnding({
  runKey,
  view,
  company,
  dateKey,
  exitLabel,
  onDone,
  onHome,
  onCounted,
  onImageSettings,
}: DateEndingProps) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const { locale } = useOtomeProps().localization;
  const names = useNames();
  const partner = company[0]!;
  const together = names(company.map((li) => li.name));
  const [result, setResult] = useState<DateFinishResult | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [levelsBefore] = useState(() => new Map(company.map((li) => [li.id, li.level])));
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
          {error ? t("ui.otomeForge.dateNight.countFailed") : t("ui.otomeForge.dateNight.counting", { name: together })}
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
  // Each one's affection (#2303: a date with several pays its first-timers), the gift's included.
  const affections = company.flatMap((li) => {
    const amount = result.grants.reduce((sum, grant) => sum + (grant.li === li.id ? (grant.affection ?? 0) : 0), 0);
    const level = view.lis.find((item) => item.id === li.id)?.level ?? li.level;
    return amount ? [{ li, amount, level, rose: level > (levelsBefore.get(li.id) ?? li.level) }] : [];
  });
  // #2128: the gift's own affection (in the sums above too), when this request counted the date.
  const giftAffection = result.grants.reduce(
    (sum, grant) => sum + (grant.source === "gift" ? (grant.affection ?? 0) : 0),
    0,
  );
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
        <span className="of-date-ending-company">
          {company.map((li) => (
            <Avatar
              key={li.id}
              name={li.name}
              url={li.portrait}
              accent={accentOf(li)}
              size={company.length > 1 ? 56 : 72}
            />
          ))}
        </span>
        <p className="of-eyebrow">
          {mend
            ? t("ui.otomeForge.dateNight.makeItRight")
            : date.item
              ? t("ui.otomeForge.dateNight.pulledTitle")
              : t("ui.otomeForge.dateNight.title")}{" "}
          · {date.placeName || t(PLACE_NAME_KEYS[date.place], { name: partner.name })}
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
            : t(OUTCOME_TEXT_KEYS[outcome], { name: together })}
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

      {date.gift ? (
        <p className="of-notice of-date-gift-line">
          <GiftArt gift={date.gift} className="of-date-gift-icon" />
          <span>{t("ui.otomeForge.dateNight.giftGiven", { name: together, gift: t(GIFT_NAME_KEYS[date.gift]) })}</span>
          {giftAffection ? (
            <span className="of-badge of-badge--soft">
              {t("ui.otomeForge.dateNight.giftEarned", { amount: number(giftAffection) })}
            </span>
          ) : null}
        </p>
      ) : null}

      {result.picks.length ? (
        <section className="of-section of-glass" aria-labelledby="of-date-picks">
          <h2 id="of-date-picks" className="of-section-title">
            {t("ui.otomeForge.dateNight.picksTitle", { name: together })}
          </h2>
          <ol className="of-date-picks">
            {result.picks.map((pick, index) => {
              const label = t(PICK_LABEL_KEYS[`${pick.score}`], { name: together });
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
        {starlight || affections.length ? (
          <ul className="of-grants">
            {starlight ? (
              <li className="of-grant of-grant--starlight">
                <Sparkle size={16} strokeWidth={1.6} fill="currentColor" aria-hidden="true" />
                <span>{t("ui.otomeForge.reader.grantStarlight", { amount: number(starlight) })}</span>
              </li>
            ) : null}
            {affections.map(({ li, amount, level, rose }) => (
              <li key={li.id} className="of-grant" style={accentStyle(li)} data-rose={rose}>
                <Avatar name={li.name} url={li.portrait} accent={accentOf(li)} size={30} />
                <span>{t("ui.otomeForge.reader.grantAffection", { name: li.name, amount: number(amount) })}</span>
                <span className="of-badge of-badge--soft">
                  {rose ? t("ui.otomeForge.reader.levelUp", { level }) : t("ui.otomeForge.story.level", { level })}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="of-hint">
            {result.counted ? t("ui.otomeForge.dateNight.earnedCapped") : t("ui.otomeForge.dateNight.earnedBefore")}
          </p>
        )}
      </section>

      {result.keepsake.offer || date.keepsake ? (
        <Keepsake
          runKey={runKey}
          view={view}
          // The picture draws her with the first two of a won date's company, or with the first love interest of an
          // earlier evening (S/minigames/date-night.ts keepsakeSubject).
          who={names(company.slice(0, date.cast ? 2 : 1).map((li) => li.name))}
          entry={date}
          onPainted={onCounted}
          onImageSettings={onImageSettings}
        />
      ) : null}

      <div className="of-dates-actions">
        <button type="button" className="of-button of-button--quiet of-glass" onClick={onHome}>
          <House size={16} strokeWidth={2} aria-hidden="true" />
          {t("ui.otomeForge.common.screenHome")}
        </button>
        <button type="button" className="of-button of-button--primary" onClick={onDone}>
          <ChevronLeft className="of-back-icon" size={16} strokeWidth={2} aria-hidden="true" />
          {exitLabel}
        </button>
      </div>
    </article>
  );
}

interface KeepsakeProps {
  runKey: string;
  view: RunView;
  /** Everyone on the date, named together ("Kai and Sol"). */
  who: string;
  entry: DateEntry;
  onPainted: () => void;
  /** #2302: Settings → Images, offered beside Try again once a paint fails, to pick another image connection. */
  onImageSettings?: () => void;
}

/**
 * The keepsake: offered with its cost, painted only on a tap (after a confirmation when Ask before painting is on,
 * through the prompt review when the Engine asks for it), then kept in a polaroid frame. A failure says so and
 * waits for Try again; it is never repainted by itself. #2302: beside Try again it offers Settings → Images, and the
 * date opens at its ending again when the player comes back.
 */
function Keepsake({ runKey, view, who, entry, onPainted, onImageSettings }: KeepsakeProps) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const { reviewImagePromptsBeforeSend } = useOtomeProps();
  const [art, setArt] = useState<Paint | null>(entry.keepsake);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [review, setReview] = useState<ImagePrompt | null>(null);
  const subject = t("ui.otomeForge.dateNight.keepsakeSubject", { name: who });

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

  // #2302: a keepsake still painting from before a trip to Settings shows as painting, and is read again until it lands.
  const painting = art?.state === "pending";
  const queryClient = useQueryClient();
  const dates = useDates(runKey);
  const listed = allEntries(dates.data).find((item) => item.key === entry.key)?.keepsake;
  useEffect(() => {
    if (!painting) return;
    const timer = window.setInterval(
      () => void queryClient.invalidateQueries({ queryKey: datesQueryKey(runKey) }),
      4000,
    );
    return () => window.clearInterval(timer);
  }, [painting, queryClient, runKey]);
  useEffect(() => {
    if (painting && listed && listed.state !== "pending") {
      setArt(listed);
      if (listed.state === "ready") onPainted();
    }
  }, [listed, onPainted, painting]);

  const ready = art?.state === "ready" && art.url ? art : null;
  const failed = art?.state === "failed" || art?.state === "stopped";
  return (
    <section className="of-section of-glass of-date-keepsake" aria-labelledby="of-keepsake-title" aria-busy={busy}>
      <h2 id="of-keepsake-title" className="of-section-title">
        {t("ui.otomeForge.dateNight.keepsakeTitle")}
      </h2>
      {ready ? (
        <figure className="of-keepsake-photo">
          <img src={ready.url} alt={t("ui.otomeForge.dateNight.keepsakeAlt", { name: who, title: entry.title })} />
          <figcaption className="of-keepsake-caption">{entry.title}</figcaption>
        </figure>
      ) : (
        <>
          <p className="of-body">{t("ui.otomeForge.dateNight.keepsakeText", { name: who })}</p>
          {(busy || painting) && !review ? (
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
            aria-disabled={busy || painting}
            onClick={() => {
              if (!painting) tap();
            }}
          >
            {failed ? (
              <RotateCcw size={15} strokeWidth={2} aria-hidden="true" />
            ) : (
              <Paintbrush size={15} strokeWidth={2} aria-hidden="true" />
            )}
            {failed ? t("ui.otomeForge.common.retry") : t("ui.otomeForge.dateNight.keepsakePaint")}
          </button>
          {(failed || error) && !busy && onImageSettings ? (
            <button
              type="button"
              className="of-button of-button--quiet of-glass of-button--small"
              onClick={onImageSettings}
            >
              <PlugZap size={15} strokeWidth={2} aria-hidden="true" />
              {t("ui.otomeForge.dateNight.keepsakeImageSettings")}
            </button>
          ) : null}
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
          <p className="of-body">{t("ui.otomeForge.dateNight.keepsakeAskText", { name: who })}</p>
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
