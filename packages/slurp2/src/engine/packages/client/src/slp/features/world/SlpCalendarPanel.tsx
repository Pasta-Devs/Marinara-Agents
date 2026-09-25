import { CalendarDays, ChevronLeft, ChevronRight, Clock3, List, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import type { SlpStoryCalendarItem } from "../../../../../shared/src/slp/slp-story-engine.js";
import type { SlpBackstagePageProps } from "../backstage/slp-backstage-contract";
import { useSlpStoryCalendar } from "./slp-story-hooks.js";

const buttonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--slurp-outline)] px-3 text-sm font-semibold transition-[background-color,color,transform] hover:bg-[var(--slurp-surface-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100";
const today = () => {
  const date = new Date();
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
};
const monthLabel = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
const dayLabel = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", timeZone: "UTC" });
const weekdayLabel = new Intl.DateTimeFormat(undefined, { weekday: "short", timeZone: "UTC" });
const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const addMonths = (date: Date, count: number) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + count, 1));

function calendarDays(month: Date) {
  const firstDay = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1));
  const start = new Date(firstDay);
  start.setUTCDate(1 - firstDay.getUTCDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + index);
    return day;
  });
}

const itemTone = (item: SlpStoryCalendarItem) =>
  item.kind === "occasion"
    ? "bg-[var(--slurp-violet)]/12 text-[var(--slurp-violet)] ring-[var(--slurp-violet)]/25"
    : item.kind === "plan"
      ? "bg-[var(--noodle-accent)]/15 text-[var(--noodle-accent)] ring-[var(--noodle-accent)]/30"
      : item.status === "active"
        ? "bg-[var(--noodle-accent)]/15 text-[var(--noodle-accent)] ring-[var(--noodle-accent)]/30"
        : "bg-[var(--slurp-surface-raised)] text-[var(--slurp-text)] ring-[var(--slurp-outline)]";

export function SlpCalendarPanel(page: SlpBackstagePageProps) {
  const [month, setMonth] = useState(today);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [view, setView] = useState<"month" | "agenda">("month");
  const createPlan = page.createPlan;
  const from = useMemo(
    () => new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1 - month.getUTCDay())),
    [month],
  );
  const to = useMemo(
    () => new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + 42)),
    [from],
  );
  const calendar = useSlpStoryCalendar(from, to);
  const days = useMemo(() => calendarDays(month), [month]);
  const byDay = useMemo(() => {
    const map = new Map<string, SlpStoryCalendarItem[]>();
    // Every day an item covers, not only its first: a week-long occasion used to show on day one.
    for (const item of calendar.data?.items ?? []) {
      const end = Date.parse(item.endsAt);
      const day = new Date(item.startsAt);
      for (let guard = 0; guard < 62 && (guard === 0 || day.getTime() < end); guard += 1) {
        const key = isoDate(day);
        map.set(key, [...(map.get(key) ?? []), item]);
        day.setDate(day.getDate() + 1);
      }
    }
    return map;
  }, [calendar.data?.items]);
  const selectedItem = useMemo(
    () => calendar.data?.items.find((item) => item.id === selectedItemId) ?? null,
    [calendar.data?.items, selectedItemId],
  );
  const orderedItems = useMemo(
    () => [...(calendar.data?.items ?? [])].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)),
    [calendar.data?.items],
  );
  const open = (target: "events" | "arcs" | "packs" | "storylines") =>
    page.onNavigate({
      ...page.navigation,
      section: "content",
      target,
    });
  const createPlanFromOccasion = async (item: SlpStoryCalendarItem) => {
    if (item.kind !== "occasion" || !page.selectedCreatorId || !page.viewerPersonaId) return;
    try {
      await createPlan.mutateAsync({
        creatorAccountId: page.selectedCreatorId,
        personaId: page.viewerPersonaId,
        title: item.title,
        direction: item.description,
        chapters: [],
        typeId: null,
        durationDays: Math.max(1, Math.round((Date.parse(item.endsAt) - Date.parse(item.startsAt)) / 86_400_000)),
      });
      setSelectedItemId(null);
    } catch {
      // The shared request error UI remains responsible for the request details.
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--noodle-accent)]">When</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight">Your Slurp calendar</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--slurp-muted)]">
            Events are context. Active items are work in progress. Nothing publishes only because it appears here.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className={buttonClass} onClick={() => setMonth(today())}>
            Today
          </button>
          <button
            type="button"
            className={buttonClass}
            aria-label="Previous month"
            onClick={() => setMonth((value) => addMonths(value, -1))}
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={buttonClass}
            aria-label="Next month"
            onClick={() => setMonth((value) => addMonths(value, 1))}
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="flex flex-wrap gap-2 text-xs font-semibold text-[var(--slurp-muted)]"
          aria-label="Calendar legend"
        >
          <span className="inline-flex items-center gap-2 rounded-full bg-[var(--slurp-violet)]/10 px-3 py-2">
            <Sparkles size={13} aria-hidden="true" /> Event
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-[var(--noodle-accent)]/10 px-3 py-2">
            <Clock3 size={13} aria-hidden="true" /> Plan or activity
          </span>
        </div>
        <div
          className="flex rounded-lg bg-[var(--slurp-surface-raised)] p-1 ring-1 ring-inset ring-[var(--slurp-outline)]"
          role="group"
          aria-label="Calendar view"
        >
          <button
            type="button"
            aria-pressed={view === "month"}
            className={`${buttonClass} min-h-9 border-0 px-2.5 ${view === "month" ? "bg-[var(--slurp-text)] text-[var(--slurp-canvas)]" : "text-[var(--slurp-muted)]"}`}
            onClick={() => setView("month")}
          >
            <CalendarDays size={15} aria-hidden="true" /> Month
          </button>
          <button
            type="button"
            aria-pressed={view === "agenda"}
            className={`${buttonClass} min-h-9 border-0 px-2.5 ${view === "agenda" ? "bg-[var(--slurp-text)] text-[var(--slurp-canvas)]" : "text-[var(--slurp-muted)]"}`}
            onClick={() => setView("agenda")}
          >
            <List size={15} aria-hidden="true" /> Agenda
          </button>
        </div>
      </div>

      {calendar.isLoading ? (
        <p role="status" className="rounded-xl bg-[var(--slurp-surface-raised)] p-6 text-sm text-[var(--slurp-muted)]">
          Loading calendar…
        </p>
      ) : calendar.isError ? (
        <div
          role="alert"
          className="rounded-xl bg-[var(--slurp-surface-raised)] p-6 text-sm text-red-600 ring-1 ring-inset ring-red-500/25"
        >
          <p>Unable to load the calendar.</p>
          <button type="button" className={`${buttonClass} mt-3`} onClick={() => void calendar.refetch()}>
            Try again
          </button>
        </div>
      ) : (
        <section
          aria-labelledby="slurp-calendar-month"
          className={`${view === "month" ? "" : "hidden"} overflow-hidden rounded-2xl bg-[var(--slurp-surface-raised)] shadow-[var(--slurp-shadow)] ring-1 ring-inset ring-[var(--slurp-outline)]`}
        >
          <div className="flex items-center gap-3 border-b border-[var(--slurp-outline)] px-4 py-3">
            <CalendarDays size={18} className="text-[var(--noodle-accent)]" aria-hidden="true" />
            <h3 id="slurp-calendar-month" className="text-base font-black">
              {monthLabel.format(month)}
            </h3>
          </div>
          <div className="grid grid-cols-7 border-b border-[var(--slurp-outline)] text-center text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[var(--slurp-muted)]">
            {Array.from({ length: 7 }, (_, index) => (
              <span key={index} className="px-1 py-3">
                {weekdayLabel.format(new Date(Date.UTC(2024, 0, 7 + index)))}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const key = isoDate(day);
              const items = byDay.get(key) ?? [];
              const inMonth = day.getUTCMonth() === month.getUTCMonth();
              return (
                <div
                  key={key}
                  className={`min-h-28 border-b border-e border-[var(--slurp-outline)] p-2 ${inMonth ? "" : "bg-[var(--slurp-canvas)] opacity-55"}`}
                >
                  <time dateTime={key} className="text-xs font-bold text-[var(--slurp-muted)]">
                    {day.getUTCDate()}
                  </time>
                  <div className="mt-2 space-y-1">
                    {items.slice(0, 3).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedItemId(item.id)}
                        className={`block w-full truncate rounded-md px-2 py-1 text-start text-[0.68rem] font-bold ring-1 ring-inset ${itemTone(item)} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]`}
                        title={item.description || item.title}
                      >
                        {item.title}
                      </button>
                    ))}
                    {items.length > 3 && (
                      <span className="block px-2 text-[0.68rem] font-semibold text-[var(--slurp-muted)]">
                        +{items.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {!calendar.isLoading && !calendar.isError && view === "agenda" && (
        <section
          aria-labelledby="slurp-calendar-agenda"
          className="rounded-2xl bg-[var(--slurp-surface-raised)] p-4 shadow-[var(--slurp-shadow)] ring-1 ring-inset ring-[var(--slurp-outline)]"
        >
          <div className="flex items-center gap-3">
            <List size={18} className="text-[var(--noodle-accent)]" aria-hidden="true" />
            <h3 id="slurp-calendar-agenda" className="text-base font-black">
              Agenda
            </h3>
          </div>
          {orderedItems.length === 0 ? (
            <div className="mt-5 rounded-xl bg-[var(--slurp-canvas)] p-5 text-center">
              <p className="text-sm font-bold">Nothing is scheduled in this range.</p>
              <p className="mt-1 text-xs text-[var(--slurp-muted)]">Add an occasion or start a Plan to see it here.</p>
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {orderedItems.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="flex min-h-14 w-full items-center gap-3 rounded-xl bg-[var(--slurp-canvas)] p-3 text-start ring-1 ring-inset ring-[var(--slurp-outline)] hover:bg-[var(--slurp-surface-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
                    onClick={() => setSelectedItemId(item.id)}
                  >
                    <span
                      className={`size-2.5 shrink-0 rounded-full ${item.kind === "occasion" ? "bg-[var(--slurp-violet)]" : "bg-[var(--noodle-accent)]"}`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{item.title}</span>
                      <span className="mt-1 block text-xs text-[var(--slurp-muted)]">
                        {dayLabel.format(new Date(item.startsAt))} ·{" "}
                        {item.kind === "occasion" ? "Event" : item.kind === "plan" ? "Storyline" : "Running event"}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold capitalize text-[var(--slurp-muted)]">
                      {item.status}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {selectedItem && (
        <aside
          aria-labelledby="slurp-calendar-selection"
          className="rounded-2xl bg-[var(--slurp-surface-raised)] p-4 shadow-[var(--slurp-shadow)] ring-1 ring-inset ring-[var(--slurp-outline)]"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--slurp-muted)]">
                {selectedItem.kind === "occasion"
                  ? "Event"
                  : selectedItem.kind === "plan"
                    ? "Storyline"
                    : "Running event"}
              </p>
              <h3 id="slurp-calendar-selection" className="mt-1 text-lg font-black">
                {selectedItem.title}
              </h3>
            </div>
            <button type="button" className={buttonClass} onClick={() => setSelectedItemId(null)}>
              Close details
            </button>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--slurp-muted)]">
            {selectedItem.description || "No additional guidance is configured."}
          </p>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-xl bg-[var(--slurp-canvas)] p-3">
              <dt className="text-xs font-bold text-[var(--slurp-muted)]">Starts</dt>
              <dd className="mt-1 font-semibold">{dayLabel.format(new Date(selectedItem.startsAt))}</dd>
            </div>
            <div className="rounded-xl bg-[var(--slurp-canvas)] p-3">
              <dt className="text-xs font-bold text-[var(--slurp-muted)]">Ends</dt>
              <dd className="mt-1 font-semibold">{dayLabel.format(new Date(selectedItem.endsAt))}</dd>
            </div>
            <div className="rounded-xl bg-[var(--slurp-canvas)] p-3">
              <dt className="text-xs font-bold text-[var(--slurp-muted)]">Status</dt>
              <dd className="mt-1 font-semibold capitalize">{selectedItem.status}</dd>
            </div>
          </dl>
          <button
            type="button"
            className={`${buttonClass} mt-4`}
            onClick={() => open(selectedItem.kind === "occasion" ? "events" : "arcs")}
          >
            {selectedItem.kind === "occasion" ? "Edit Event" : "Open Storyline types"}
          </button>
          {selectedItem.kind === "occasion" && (
            <button
              type="button"
              className={`${buttonClass} mt-2 ms-2 bg-[var(--noodle-accent)] text-white`}
              disabled={!page.selectedCreatorId || !page.viewerPersonaId || createPlan.isPending}
              onClick={() => void createPlanFromOccasion(selectedItem)}
            >
              {createPlan.isPending ? "Creating storyline…" : "Create storyline from event"}
            </button>
          )}
          {selectedItem.kind === "occasion" && (!page.selectedCreatorId || !page.viewerPersonaId) && (
            <p className="mt-2 text-xs text-[var(--slurp-muted)]">
              Select a Creator and a persona first; the Plan is created for that Creator.
            </p>
          )}
        </aside>
      )}

      <section className="grid gap-3 sm:grid-cols-2" aria-label="Calendar actions">
        <button
          type="button"
          className="rounded-xl bg-[var(--slurp-surface-raised)] p-4 text-start ring-1 ring-inset ring-[var(--slurp-outline)] hover:bg-[var(--slurp-canvas)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
          onClick={() => open("events")}
        >
          <span className="block text-sm font-black">Edit occasions</span>
          <span className="mt-1 block text-xs leading-5 text-[var(--slurp-muted)]">
            Change dates, guidance, and automation for holidays and campaigns.
          </span>
        </button>
        <button
          type="button"
          className="rounded-xl bg-[var(--slurp-surface-raised)] p-4 text-start ring-1 ring-inset ring-[var(--slurp-outline)] hover:bg-[var(--slurp-canvas)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
          onClick={() => open("storylines")}
        >
          <span className="block text-sm font-black">Open storyline rules</span>
          <span className="mt-1 block text-xs leading-5 text-[var(--slurp-muted)]">
            Set how storylines start and move on. Reusable types live in Storyline types.
          </span>
        </button>
        <button
          type="button"
          className="rounded-xl bg-[var(--slurp-surface-raised)] p-4 text-start ring-1 ring-inset ring-[var(--slurp-outline)] hover:bg-[var(--slurp-canvas)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
          onClick={() => open("packs")}
        >
          <span className="block text-sm font-black">Open Packs</span>
          <span className="mt-1 block text-xs leading-5 text-[var(--slurp-muted)]">
            Import reusable Events and Storyline types.
          </span>
        </button>
      </section>
    </div>
  );
}
