// ──────────────────────────────────────────────
// Otome Forge: Remind Me. A month of the story's days: each love interest's birthday, the player's own (opt-in, kept
// on this device), anniversaries, Wish banners' last days, and, when the period tracker is on, a heart on each period
// day: filled for a logged day, outlined and labelled "predicted" for a forecast one, so colour is never the only
// signal. The grid follows the date-grid pattern: arrow keys move by day and week, Home and End to the week's ends,
// Page Up and Page Down by month.
// ──────────────────────────────────────────────
// GET /runs/:run/calendar → CalendarView, read defensively. Tracker data is read here and never sent anywhere: this
// screen makes no request with it. It follows changes made in another tab (C/screens/home/HomeScreen.tsx useCycle).
// Days follow the conversation's time zone.
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  Cake,
  CalendarHeart,
  ChevronLeft,
  ChevronRight,
  Flower2,
  Heart,
  Hourglass,
  RotateCcw,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useOtomeApi } from "../../api";
import { runPath } from "../../hooks/use-reader";
import { accentOf } from "../../lib/accent";
import {
  addDays,
  cycleMarks,
  cycleToday,
  dayNumber,
  isDayKey,
  logStart,
  nextPredictedStart,
  removeStart,
  type CycleData,
  type CycleMark,
  type CycleToday,
} from "../../lib/cycle";
import { isMonthDay, readProfile, writeProfile } from "../../lib/cycle-storage";
import { localDay } from "../../lib/tap-mood";
import { useOtomeProps } from "../../props";
import type { CalendarView, LiId, RunLiView, RunView } from "../../shared/api-types";
import { PALETTE } from "../../theme/tokens";
import { useCycle, useMinute } from "../home/HomeScreen";
import { Section } from "../setup/parts";

export const calendarQueryKey = (runKey: string) => ["otome-forge", "calendar", runKey] as const;

/** "Coming up" looks this far ahead. */
const UPCOMING_DAYS = 60;
const UPCOMING_MAX = 6;
const RELATIVE_DAYS = 7;
const FIRST_YEAR = 1900;
const LAST_YEAR = 2199;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const rows = (list: unknown) => (Array.isArray(list) ? list.filter(isRecord) : []);
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** The route's answer with every row checked; a damaged row is skipped, never shown half-read. */
export function readCalendar(value: unknown): CalendarView {
  const answer = isRecord(value) ? value : {};
  return {
    birthdays: rows(answer.birthdays).flatMap((row) =>
      text(row.li) && isMonthDay(row.md) ? [{ li: text(row.li), md: row.md }] : [],
    ),
    anniversaries: rows(answer.anniversaries).flatMap((row) =>
      isMonthDay(row.md) && text(row.label)
        ? [
            {
              md: row.md,
              label: text(row.label),
              ...(text(row.li) ? { li: text(row.li) } : {}),
              ...(Number.isInteger(row.year) ? { year: row.year as number } : {}),
            },
          ]
        : [],
    ),
    // The last day of each Wish banner still running (M4's banners; none before a story's first Wish).
    bannerEnds: rows(answer.bannerEnds).flatMap((row) =>
      isDayKey(row.day) && text(row.banner) ? [{ day: row.day, banner: text(row.banner) }] : [],
    ),
  };
}

// ── Days ──

const leap = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
const yearOf = (dayKey: string) => Number(dayKey.slice(0, 4));
const monthKeyOf = (dayKey: string) => dayKey.slice(0, 7);
const daysIn = (monthKey: string) =>
  new Date(Date.UTC(Number(monthKey.slice(0, 4)), Number(monthKey.slice(5, 7)), 0)).getUTCDate();
/** 0 = Sunday … 6 = Saturday (1970-01-01 was a Thursday). */
const weekdayOf = (dayKey: string) => (((dayNumber(dayKey) + 4) % 7) + 7) % 7;
/** A yearly "MM-DD" in `year`; 02-29 falls on 02-28 when the year has none. */
const inYear = (md: string, year: number) => `${year}-${md === "02-29" && !leap(year) ? "02-28" : md}`;
const utc = (dayKey: string) => new Date(dayNumber(dayKey) * 86_400_000);

/** The same day of the month `delta` months on, cut to that month's length. */
function shiftMonth(dayKey: string, delta: number): string {
  const index = yearOf(dayKey) * 12 + Number(dayKey.slice(5, 7)) - 1 + delta;
  const monthKey = `${String(Math.floor(index / 12)).padStart(4, "0")}-${String((index % 12) + 1).padStart(2, "0")}`;
  return `${monthKey}-${String(Math.min(Number(dayKey.slice(8, 10)), daysIn(monthKey))).padStart(2, "0")}`;
}

/** The week's first day for a locale (0 = Sunday … 6 = Saturday), Monday where the browser can't say. */
function weekStartOf(locale: string): number {
  try {
    const info = new Intl.Locale(locale) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number };
      weekInfo?: { firstDay: number };
    };
    const firstDay = info.getWeekInfo?.().firstDay ?? info.weekInfo?.firstDay;
    if (typeof firstDay === "number" && firstDay >= 1 && firstDay <= 7) return firstDay % 7;
  } catch {
    // An unknown locale starts on Monday.
  }
  return 1;
}

// ── What happens on a day ──

type DayEvent =
  | { kind: "birthday"; li: RunLiView }
  | { kind: "mine" }
  | { kind: "anniversary"; label: string; li: RunLiView | null }
  | { kind: "banner"; banner: string }
  | { kind: "cycle"; mark: CycleMark; start: boolean };

interface DaySources {
  calendar: CalendarView;
  lis: readonly RunLiView[];
  birthday: string | null;
  cycle: CycleData;
  today: string;
}

/** Every event from `from` to `to` (inclusive), by day. */
function eventsBetween(from: string, to: string, sources: DaySources): Map<string, DayEvent[]> {
  const events = new Map<string, DayEvent[]>();
  const [first, last] = [dayNumber(from), dayNumber(to)];
  const add = (day: string, event: DayEvent) => {
    const at = dayNumber(day);
    if (at < first || at > last) return;
    events.set(day, [...(events.get(day) ?? []), event]);
  };
  const liOf = (id: LiId | undefined) => sources.lis.find((li) => li.id === id) ?? null;
  for (let year = yearOf(from); year <= yearOf(to); year += 1) {
    for (const { li, md } of sources.calendar.birthdays) {
      const person = liOf(li);
      if (person) add(inYear(md, year), { kind: "birthday", li: person });
    }
    if (sources.birthday) add(inYear(sources.birthday, year), { kind: "mine" });
    for (const { md, label, li, year: since } of sources.calendar.anniversaries) {
      if (since === undefined || year >= since) add(inYear(md, year), { kind: "anniversary", label, li: liOf(li) });
    }
  }
  for (const { day, banner } of sources.calendar.bannerEnds) add(day, { kind: "banner", banner });
  for (const [day, mark] of cycleMarks(sources.cycle, from, to, sources.today)) {
    add(day, { kind: "cycle", mark, start: mark === "logged" && sources.cycle.starts.includes(day) });
  }
  return events;
}

const EVENT_ICONS: Record<Exclude<DayEvent["kind"], "cycle">, LucideIcon> = {
  birthday: Cake,
  mine: Cake,
  anniversary: Sparkles,
  banner: Hourglass,
};

/** His accent for his own days, rose for the player's, champagne for the story's. */
function eventColour(event: DayEvent): string {
  if (event.kind === "birthday") return accentOf(event.li);
  if (event.kind === "anniversary" && event.li) return accentOf(event.li);
  return event.kind === "banner" ? PALETTE.champagne : PALETTE.rose;
}

function CycleHeart({ mark, size }: { mark: CycleMark; size: number }) {
  return (
    <Heart
      className="of-cycle-heart"
      data-mark={mark}
      size={size}
      strokeWidth={2.2}
      fill={mark === "logged" ? "currentColor" : "none"}
      aria-hidden="true"
    />
  );
}

function EventIcon({ event, size }: { event: DayEvent; size: number }) {
  if (event.kind === "cycle") return <CycleHeart mark={event.mark} size={size} />;
  const Icon = EVENT_ICONS[event.kind];
  return (
    <Icon
      className="of-event-icon"
      size={size}
      strokeWidth={2.2}
      style={{ "--of-event": eventColour(event) } as CSSProperties}
      aria-hidden="true"
    />
  );
}

interface RemindMeProps {
  runKey: string;
  view: RunView;
  onOpenTracker: () => void;
}

export function RemindMe({ runKey, view, onOpenTracker }: RemindMeProps) {
  const { t, i18n } = useTranslation();
  const otome = useOtomeApi();
  const { timeZone, localization } = useOtomeProps();
  const language = i18n.resolvedLanguage ?? "en";
  const today = localDay(timeZone, new Date(useMinute()));
  const { cycle, update } = useCycle();
  const [birthday, setBirthday] = useState(() => readProfile().birthday);
  const [selected, setSelected] = useState(today);
  // 0, or a count of the changes this browser didn't keep: each one is announced afresh.
  const [notKept, setNotKept] = useState(0);
  const focusDay = useRef(false);
  const gridRef = useRef<HTMLTableElement>(null);
  const monthTitleId = useId();

  const calendar = useQuery({
    queryKey: calendarQueryKey(runKey),
    queryFn: async () => readCalendar(await otome.get<unknown>(`${runPath(runKey)}/calendar`)),
  });
  const days = calendar.data ?? { birthdays: [], anniversaries: [], bannerEnds: [] };
  const sources: DaySources = { calendar: days, lis: view.lis, birthday, cycle, today };

  const month = monthKeyOf(selected);
  const first = `${month}-01`;
  const last = `${month}-${String(daysIn(month)).padStart(2, "0")}`;
  const events = eventsBetween(first, last, sources);

  // ── Formatting (in the language the words are in; the week starts where the Engine's locale says) ──
  const formats = useMemo(() => {
    const make = (options: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(language, { ...options, timeZone: "UTC" });
    return {
      month: make({ month: "long", year: "numeric" }),
      full: make({ weekday: "long", month: "long", day: "numeric", year: "numeric" }),
      short: make({ month: "short", day: "numeric" }),
      weekdayShort: make({ weekday: "narrow" }),
      weekdayLong: make({ weekday: "long" }),
      relative: new Intl.RelativeTimeFormat(language, { numeric: "auto" }),
    };
  }, [language]);
  const weekStart = weekStartOf(localization.locale);

  const eventLabel = (event: DayEvent): string => {
    switch (event.kind) {
      case "birthday":
        return t("ui.otomeForge.remind.birthdayOf", { name: event.li.name });
      case "mine":
        return t("ui.otomeForge.remind.myBirthday");
      case "anniversary":
        // A first is his (the Love Timeline's words); one with no love interest is the day the story began.
        return event.li
          ? t("ui.otomeForge.remind.anniversaryWith", { label: event.label, name: event.li.name })
          : t("ui.otomeForge.remind.storyBegan", { title: event.label });
      case "banner":
        return t("ui.otomeForge.remind.bannerEnds", { banner: event.banner });
      case "cycle":
        return event.mark === "predicted"
          ? t("ui.otomeForge.remind.cyclePredicted")
          : event.start
            ? t("ui.otomeForge.remind.cycleStart")
            : t("ui.otomeForge.remind.cycleLogged");
    }
  };

  // ── Moving through the grid ──
  const moveTo = (day: string, focus: boolean) => {
    const year = yearOf(day);
    if (!isDayKey(day) || year < FIRST_YEAR || year > LAST_YEAR) return;
    focusDay.current = focus;
    setSelected(day);
  };
  useEffect(() => {
    if (!focusDay.current) return;
    focusDay.current = false;
    gridRef.current?.querySelector<HTMLElement>(`[data-day="${selected}"]`)?.focus({ preventScroll: false });
  }, [selected]);

  const column = (day: string) => (weekdayOf(day) - weekStart + 7) % 7;
  const onGridKeyDown = (event: KeyboardEvent<HTMLTableElement>) => {
    // Alt+Arrow (history), Cmd+Arrow and Ctrl/Cmd+Home/End belong to the browser.
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const rtl = (event.currentTarget.closest("[dir]")?.getAttribute("dir") ?? "ltr") === "rtl";
    const step: Record<string, () => string> = {
      ArrowRight: () => addDays(selected, rtl ? -1 : 1),
      ArrowLeft: () => addDays(selected, rtl ? 1 : -1),
      ArrowDown: () => addDays(selected, 7),
      ArrowUp: () => addDays(selected, -7),
      Home: () => addDays(selected, -column(selected)),
      End: () => addDays(selected, 6 - column(selected)),
      PageUp: () => shiftMonth(selected, -1),
      PageDown: () => shiftMonth(selected, 1),
    };
    const next = step[event.key];
    if (!next) return;
    event.preventDefault();
    moveTo(next(), true);
  };

  // The month's weeks, with blanks before the first day and after the last.
  const weeks: Array<Array<string | null>> = [];
  const lead = column(first);
  const cells: Array<string | null> = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysIn(month) }, (_, index) => addDays(first, index)),
  ];
  while (cells.length % 7) cells.push(null);
  for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7));
  const weekdays = Array.from({ length: 7 }, (_, index) => addDays("2023-01-01", (weekStart + index) % 7));

  // ── The selected day, and logging a start from it ──
  const selectedEvents = events.get(selected) ?? [];
  const canLog = cycle.enabled && dayNumber(selected) <= dayNumber(today);
  const isStart = cycle.starts.includes(selected);
  /** Logs or removes the selected day as a first day, on the tracker as stored now (it may have changed elsewhere). */
  const toggleStart = () => {
    const [day, removing] = [selected, isStart];
    const kept = update((data) =>
      !data.enabled ? data : removing ? removeStart(data, day) : logStart(data, day, today),
    );
    setNotKept((count) => (kept ? 0 : count + 1));
  };

  // ── Coming up: the next two months, then the next predicted start ──
  const ahead = eventsBetween(today, addDays(today, UPCOMING_DAYS), {
    ...sources,
    cycle: { ...cycle, enabled: false },
  });
  const upcoming: Array<{ day: string; event: DayEvent }> = [...ahead].flatMap(([day, list]) =>
    list.map((event) => ({ day, event })),
  );
  const predicted = nextPredictedStart(cycle, today);
  if (predicted && dayNumber(predicted) - dayNumber(today) <= UPCOMING_DAYS) {
    upcoming.push({ day: predicted, event: { kind: "cycle", mark: "predicted", start: true } });
  }
  upcoming.sort((a, b) => a.day.localeCompare(b.day)).splice(UPCOMING_MAX);

  /** "today", "tomorrow", "in 5 days" within a week; the date after that. */
  const when = (day: string) => {
    const inDays = dayNumber(day) - dayNumber(today);
    return inDays <= RELATIVE_DAYS ? formats.relative.format(inDays, "day") : formats.short.format(utc(day));
  };

  return (
    <div className="of-page of-remind">
      <div className="of-page-head of-page-head--compact">
        <h1 className="of-title of-title--page" tabIndex={-1}>
          {t("ui.otomeForge.common.screenRemind")}
        </h1>
        <p className="of-hint">{t("ui.otomeForge.remind.intro")}</p>
      </div>

      <section className="of-month of-glass" aria-labelledby={monthTitleId}>
        <div className="of-month-head">
          <button
            type="button"
            className="of-icon-button of-glass of-month-step"
            aria-label={t("ui.otomeForge.remind.previousMonth")}
            title={t("ui.otomeForge.remind.previousMonth")}
            onClick={() => moveTo(shiftMonth(selected, -1), false)}
          >
            <ChevronLeft size={18} strokeWidth={2.2} aria-hidden="true" />
          </button>
          <h2 id={monthTitleId} className="of-month-title" aria-live="polite">
            {formats.month.format(utc(first))}
          </h2>
          <button
            type="button"
            className="of-icon-button of-glass of-month-step"
            aria-label={t("ui.otomeForge.remind.nextMonth")}
            title={t("ui.otomeForge.remind.nextMonth")}
            onClick={() => moveTo(shiftMonth(selected, 1), false)}
          >
            <ChevronRight size={18} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>
        {monthKeyOf(today) !== month ? (
          <button
            type="button"
            className="of-button of-button--text of-month-today"
            onClick={() => moveTo(today, true)}
          >
            {t("ui.otomeForge.remind.backToToday")}
          </button>
        ) : null}

        <table
          ref={gridRef}
          className="of-month-grid"
          role="grid"
          aria-labelledby={monthTitleId}
          aria-describedby={`${monthTitleId}-keys`}
          onKeyDown={onGridKeyDown}
        >
          <thead>
            <tr>
              {weekdays.map((day) => (
                <th key={day} scope="col" abbr={formats.weekdayLong.format(utc(day))}>
                  <span aria-hidden="true">{formats.weekdayShort.format(utc(day))}</span>
                  <span className="of-visually-hidden">{formats.weekdayLong.format(utc(day))}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week.find(Boolean) ?? ""}>
                {week.map((day, index) => {
                  if (!day) return <td key={`blank-${index}`} className="of-day of-day--blank" aria-hidden="true" />;
                  const list = events.get(day) ?? [];
                  const mark = list.find((event) => event.kind === "cycle");
                  const others = list.filter((event) => event.kind !== "cycle");
                  const date = formats.full.format(utc(day));
                  const label = list.length
                    ? t("ui.otomeForge.remind.dayWithEvents", { date, events: list.map(eventLabel).join("; ") })
                    : date;
                  return (
                    <td
                      key={day}
                      className="of-day"
                      data-day={day}
                      data-cycle={mark?.kind === "cycle" ? mark.mark : undefined}
                      tabIndex={day === selected ? 0 : -1}
                      aria-selected={day === selected}
                      aria-current={day === today ? "date" : undefined}
                      onClick={() => moveTo(day, true)}
                    >
                      <span className="of-visually-hidden">{label}</span>
                      <span className="of-day-number" aria-hidden="true">
                        {Number(day.slice(8, 10))}
                      </span>
                      <span className="of-day-marks" aria-hidden="true">
                        {mark ? <EventIcon event={mark} size={12} /> : null}
                        {others.slice(0, mark ? 2 : 3).map((event, at) => (
                          <EventIcon key={at} event={event} size={11} />
                        ))}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p id={`${monthTitleId}-keys`} className="of-visually-hidden">
          {t("ui.otomeForge.remind.gridKeys")}
        </p>

        {cycle.enabled ? (
          <div className="of-cycle-legend" role="group" aria-label={t("ui.otomeForge.remind.legend")}>
            <span className="of-cycle-key">
              <CycleHeart mark="logged" size={14} />
              {t("ui.otomeForge.remind.legendLogged")}
            </span>
            {cycle.irregular ? (
              <span className="of-hint">{t("ui.otomeForge.remind.legendIrregular")}</span>
            ) : (
              <span className="of-cycle-key">
                <CycleHeart mark="predicted" size={14} />
                {t("ui.otomeForge.remind.legendPredicted")}
              </span>
            )}
          </div>
        ) : null}
        {calendar.isError ? (
          <div className="of-notice of-notice--error" role="alert">
            <span>{otome.errorMessage(calendar.error, "ui.otomeForge.remind.loadFailed")}</span>
            <button
              type="button"
              className="of-button of-button--text"
              aria-disabled={calendar.isFetching}
              onClick={() => {
                if (!calendar.isFetching) void calendar.refetch();
              }}
            >
              <RotateCcw size={14} strokeWidth={2.2} aria-hidden="true" />
              {t("ui.otomeForge.common.retry")}
            </button>
          </div>
        ) : calendar.isPending ? (
          <p className="of-hint" role="status">
            {t("ui.otomeForge.remind.loading")}
          </p>
        ) : null}
      </section>

      <section className="of-section of-glass of-day-detail" aria-labelledby={`${monthTitleId}-day`}>
        <h2 id={`${monthTitleId}-day`} className="of-section-title">
          {formats.full.format(utc(selected))}
        </h2>
        {selectedEvents.length ? (
          <ul className="of-day-events">
            {selectedEvents.map((event, at) => (
              <li key={at} data-kind={event.kind}>
                <EventIcon event={event} size={16} />
                <span>{eventLabel(event)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="of-hint">{t("ui.otomeForge.remind.nothingOnDay")}</p>
        )}
        {canLog ? (
          <button type="button" className="of-button of-button--quiet of-button--small of-glass" onClick={toggleStart}>
            <Heart size={14} strokeWidth={2.2} fill={isStart ? "none" : "currentColor"} aria-hidden="true" />
            {isStart ? t("ui.otomeForge.remind.removeStart") : t("ui.otomeForge.remind.logStart")}
          </button>
        ) : null}
        <div className="of-live" role="status" aria-live="polite">
          {notKept ? (
            <p key={notKept} className="of-notice">
              {t("ui.otomeForge.tracker.notKept")}
            </p>
          ) : null}
        </div>
      </section>

      <Section title={t("ui.otomeForge.remind.upcoming")}>
        {upcoming.length ? (
          <ul className="of-upcoming">
            {upcoming.map(({ day, event }) => (
              <li key={`${day} ${eventLabel(event)}`}>
                <EventIcon event={event} size={16} />
                <span className="of-upcoming-what">
                  {event.kind === "cycle" ? t("ui.otomeForge.remind.cycleNext") : eventLabel(event)}
                </span>
                <span className="of-upcoming-when">{when(day)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="of-hint">{t("ui.otomeForge.remind.upcomingNone")}</p>
        )}
      </Section>

      <CycleSummary cycle={cycle} today={today} onOpenTracker={onOpenTracker} />
      <MyBirthday birthday={birthday} language={language} onChange={setBirthday} />
    </div>
  );
}

/** Today's line about the cycle as the player reads it, addressed to them (never what a prompt receives). */
export function cycleTodayText(
  t: (key: string, options?: Record<string, unknown>) => string,
  state: CycleToday | null,
) {
  if (!state) return t("ui.otomeForge.tracker.todayNothing");
  if (state.kind === "day") return t("ui.otomeForge.tracker.todayDay", { n: state.n });
  if (state.kind === "due") return t("ui.otomeForge.tracker.todayDue", { count: state.inDays });
  return t("ui.otomeForge.tracker.todayDueToday");
}

function CycleSummary({ cycle, today, onOpenTracker }: { cycle: CycleData; today: string; onOpenTracker: () => void }) {
  const { t } = useTranslation();
  const titleId = useId();
  const state = cycleToday(cycle, today);
  return (
    <section className="of-section of-glass of-cycle-card" aria-labelledby={titleId}>
      <h2 id={titleId} className="of-section-title">
        <Flower2 size={17} strokeWidth={1.9} aria-hidden="true" />
        {t("ui.otomeForge.tracker.title")}
      </h2>
      {cycle.enabled ? (
        <>
          <p className="of-cycle-today" data-state={state?.kind ?? "none"}>
            {cycleTodayText(t, state)}
          </p>
          <p className="of-hint">{t("ui.otomeForge.tracker.stored")}</p>
        </>
      ) : (
        <p className="of-hint">{t("ui.otomeForge.tracker.enable")}</p>
      )}
      <button type="button" className="of-button of-button--quiet of-button--small of-glass" onClick={onOpenTracker}>
        <CalendarHeart size={15} strokeWidth={2} aria-hidden="true" />
        {cycle.enabled ? t("ui.otomeForge.tracker.settings") : t("ui.otomeForge.tracker.open")}
      </button>
    </section>
  );
}

/** The player's own birthday: opt-in, kept only in this browser, never in a prompt. */
function MyBirthday({
  birthday,
  language,
  onChange,
}: {
  birthday: string | null;
  language: string;
  onChange: (birthday: string | null) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [editing, setEditing] = useState(false);
  // 0, or a count of the saves this browser didn't keep: each one is announced afresh.
  const [notKept, setNotKept] = useState(0);
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const monthRef = useRef<HTMLSelectElement>(null);
  const editRef = useRef<HTMLButtonElement>(null);
  // The control that held focus leaves with the form (or with the date), so focus lands on what replaces it.
  const refocus = useRef<"form" | "edit" | null>(null);
  useEffect(() => {
    const target = refocus.current === "form" ? monthRef.current : refocus.current === "edit" ? editRef.current : null;
    refocus.current = null;
    target?.focus();
  }, [editing, birthday]);

  const monthNames = useMemo(() => {
    const format = new Intl.DateTimeFormat(language, { month: "long", timeZone: "UTC" });
    return Array.from({ length: 12 }, (_, index) => format.format(new Date(Date.UTC(2024, index, 1))));
  }, [language]);
  // 2024 has a 29 February, so every birthday has a day to fall on.
  const shown = birthday
    ? new Intl.DateTimeFormat(language, { month: "long", day: "numeric", timeZone: "UTC" }).format(
        new Date(Date.UTC(2024, Number(birthday.slice(0, 2)) - 1, Number(birthday.slice(3, 5)))),
      )
    : "";
  const picked = month && day ? `${month}-${day}` : "";
  const valid = isMonthDay(picked);
  const lastDay = month ? new Date(Date.UTC(2024, Number(month), 0)).getUTCDate() : 31;
  const save = (next: string | null) => {
    const kept = writeProfile({ version: 1, birthday: next });
    setNotKept((count) => (kept ? 0 : count + 1));
    onChange(next);
  };
  const close = (next?: string | null) => {
    refocus.current = "edit";
    if (next !== undefined) save(next);
    setEditing(false);
  };

  return (
    <Section title={t("ui.otomeForge.remind.myBirthdayTitle")} hint={t("ui.otomeForge.remind.myBirthdayHint")}>
      {editing ? (
        <div className="of-birthday-form">
          <div className="of-field">
            <label className="of-label" htmlFor={`${id}-month`}>
              {t("ui.otomeForge.remind.month")}
            </label>
            <select
              ref={monthRef}
              id={`${id}-month`}
              className="of-input of-select"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            >
              <option value="">—</option>
              {monthNames.map((name, index) => (
                <option key={name} value={String(index + 1).padStart(2, "0")}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="of-field">
            <label className="of-label" htmlFor={`${id}-day`}>
              {t("ui.otomeForge.remind.day")}
            </label>
            <select
              id={`${id}-day`}
              className="of-input of-select"
              value={Number(day) > lastDay ? "" : day}
              onChange={(event) => setDay(event.target.value)}
            >
              <option value="">—</option>
              {Array.from({ length: lastDay }, (_, index) => String(index + 1).padStart(2, "0")).map((value) => (
                <option key={value} value={value}>
                  {Number(value)}
                </option>
              ))}
            </select>
          </div>
          <div className="of-inline-actions">
            <button
              type="button"
              className="of-button of-button--primary of-button--small"
              aria-disabled={!valid}
              onClick={() => {
                if (valid) close(picked);
              }}
            >
              {t("ui.otomeForge.remind.saveBirthday")}
            </button>
            <button
              type="button"
              className="of-button of-button--quiet of-button--small of-glass"
              onClick={() => close()}
            >
              {t("ui.otomeForge.remind.cancel")}
            </button>
          </div>
        </div>
      ) : (
        <div className="of-inline-actions">
          {birthday ? (
            <p className="of-birthday-shown">
              <Cake size={16} strokeWidth={2} aria-hidden="true" />
              {shown}
            </p>
          ) : null}
          <button
            ref={editRef}
            type="button"
            className="of-button of-button--quiet of-button--small of-glass"
            onClick={() => {
              setMonth(birthday?.slice(0, 2) ?? "");
              setDay(birthday?.slice(3, 5) ?? "");
              refocus.current = "form";
              setEditing(true);
            }}
          >
            <Cake size={15} strokeWidth={2} aria-hidden="true" />
            {birthday ? t("ui.otomeForge.remind.changeBirthday") : t("ui.otomeForge.remind.addBirthday")}
          </button>
          {birthday ? (
            <button
              type="button"
              className="of-button of-button--text"
              onClick={() => {
                refocus.current = "edit";
                save(null);
              }}
            >
              {t("ui.otomeForge.remind.removeBirthday")}
            </button>
          ) : null}
        </div>
      )}
      <div className="of-live" role="status" aria-live="polite">
        {notKept ? (
          <p key={notKept} className="of-notice">
            {t("ui.otomeForge.tracker.notKept")}
          </p>
        ) : null}
      </div>
    </Section>
  );
}
