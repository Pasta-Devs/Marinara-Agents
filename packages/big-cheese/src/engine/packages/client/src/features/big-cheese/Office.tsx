// ──────────────────────────────────────────────
// Big Cheese: the Office, home base of a run (ui.md §5.4)
// ──────────────────────────────────────────────
import { useTranslation } from "react-i18next";
import type { Meter } from "./api";
import { WeekStrip } from "./WeekStrip";
import { dayKey, Face, nameOf, threadTitle, type Ctx } from "./parts";

const METERS: Meter[] = ["money", "output", "people", "standing"];

/** Letters that have arrived: all of them after week 1, else up to today (server lettersUnlocked). */
export const arrived = (letter: { day: number }, clock: { week: number; day: number }) =>
  clock.week > 1 || letter.day <= clock.day;

export function Office({ ctx, canStart }: { ctx: Ctx; canStart: boolean }) {
  const { t } = useTranslation();
  const { run, kit, busy, act, go } = ctx;
  const { clock, meters, hearing } = run.game;
  const friday = clock.day === 4;
  // Story cards, most urgent first (design.md 3.5). A secret thread shows once the boss learns of it.
  const due = (thread: { clock: { dueWeek: number | "open" } }) =>
    thread.clock.dueWeek === "open" ? Infinity : thread.clock.dueWeek;
  const threads = Object.values(run.game.threads)
    .filter((thread) => !thread.secret)
    .sort((a, b) => due(a) - due(b));
  const coming = kit.letters.filter((letter) => !arrived(letter, clock));
  const promises = threads.filter((thread) => thread.kind === "promise" && thread.promise);

  return (
    <>
      <h1 className="bc-heading" tabIndex={-1} data-focus>
        {kit.name}
      </h1>
      <WeekStrip ctx={ctx} />
      <ul className="bc-meters" aria-label={t("ui.bigCheese.office.meters")}>
        {METERS.map((meter) => {
          const value = meters[meter];
          const low = value < 20;
          return (
            <li key={meter} className={low ? "bc-meter bc-meter-low" : "bc-meter"}>
              <span className="bc-muted">{kit.meters[meter]?.label ?? meter}</span>
              <span className="bc-meter-value">
                {value}
                {low && <span className="bc-meter-tag">{t("ui.bigCheese.office.low")}</span>}
              </span>
              <span className="bc-bar" aria-hidden="true">
                <span style={{ width: `${value}%` }} />
              </span>
            </li>
          );
        })}
      </ul>

      {hearing && (
        <div className="bc-note bc-note-warn">
          <p>
            {t("ui.bigCheese.hearing.notice", {
              meter: kit.meters[hearing.meter]?.label ?? hearing.meter,
              day: t(dayKey(hearing.day)),
              week: hearing.week,
            })}
          </p>
          <button type="button" className="bc-btn" onClick={() => go("hearing")}>
            {t("ui.bigCheese.hearing.prepare")}
          </button>
        </div>
      )}

      {canStart ? (
        <button type="button" className="bc-btn bc-btn-primary" disabled={busy} onClick={() => void act("day/start")}>
          {t("ui.bigCheese.office.startDay")}
        </button>
      ) : (
        <button
          type="button"
          className={clock.hoursLeft === 0 ? "bc-btn bc-btn-primary" : "bc-btn"}
          disabled={busy}
          onClick={() => void act("day/end")}
        >
          {friday ? t("ui.bigCheese.office.endWeek") : t("ui.bigCheese.office.endDay")}
        </button>
      )}

      <section className="bc-section" aria-labelledby="bc-threads">
        <h2 id="bc-threads" className="bc-subhead">
          {t("ui.bigCheese.office.threads")}
        </h2>
        {threads.length === 0 && <p>{t("ui.bigCheese.office.noThreads")}</p>}
        <ul className="bc-list">
          {threads.map((thread) => {
            const lead = thread.people[0];
            const body = (
              <>
                {lead && <Face kit={kit} id={lead} size="s" />}
                <span className="bc-row-text">
                  <span className="bc-row-title">{threadTitle(t, kit, thread)}</span>
                  <span className="bc-muted">
                    {thread.kind === "guided"
                      ? t("ui.bigCheese.letters.progress", {
                          read: thread.beats.filter((beat) => beat.read).length,
                          total: thread.beats.length,
                        })
                      : [
                          thread.people.map((id) => nameOf(kit, id)).join(", "),
                          t(`ui.bigCheese.story.pressure.${thread.clock.pressure}`, { defaultValue: "" }),
                          thread.stakes,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                  </span>
                </span>
              </>
            );
            return (
              <li key={thread.id}>
                {thread.kind === "guided" ? (
                  <button type="button" className="bc-row" onClick={() => go("letters")}>
                    {body}
                  </button>
                ) : (
                  <div className="bc-row">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {promises.length > 0 && (
        <section className="bc-section" aria-labelledby="bc-promises">
          <h2 id="bc-promises" className="bc-subhead">
            {t("ui.bigCheese.promise.title")}
          </h2>
          <ul className="bc-list">
            {promises.map(({ id, promise }) => (
              <li key={id} className="bc-panel">
                <p>
                  {t("ui.bigCheese.promise.line", {
                    name: nameOf(kit, promise!.to),
                    what: promise!.what.replace(/[.!?]+$/, ""),
                    day: t(dayKey(promise!.due.day)),
                    week: promise!.due.week,
                  })}
                </p>
                {promise!.kept ? (
                  <p role="status" className="bc-stamp" tabIndex={-1} data-focus-kept={id}>
                    {t("ui.bigCheese.promise.kept", { day: t(dayKey(promise!.due.day)), week: promise!.due.week })}
                  </p>
                ) : (
                  <button
                    type="button"
                    className="bc-btn"
                    disabled={busy || clock.hoursLeft === 0}
                    onClick={async () => {
                      // The button goes away, so focus moves to the "Kept" line that replaces it.
                      if (await act(`promises/${encodeURIComponent(id)}/keep`))
                        requestAnimationFrame(() =>
                          document.querySelector<HTMLElement>(`[data-focus-kept="${CSS.escape(id)}"]`)?.focus(),
                        );
                    }}
                  >
                    {t("ui.bigCheese.promise.keep")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {coming.length > 0 && (
        <section className="bc-section" aria-labelledby="bc-coming">
          <h2 id="bc-coming" className="bc-subhead">
            {t("ui.bigCheese.office.comingUp")}
          </h2>
          <ul className="bc-plain">
            {coming.map((letter) => (
              <li key={`${letter.day}-${letter.person}`}>
                {t("ui.bigCheese.office.letterDue", { day: t(dayKey(letter.day)), name: nameOf(kit, letter.person) })}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
