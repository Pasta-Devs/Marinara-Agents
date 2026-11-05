// ──────────────────────────────────────────────
// Big Cheese: the week strip, five days with a star on each booked big scene (ui.md §5.4)
// ──────────────────────────────────────────────
import { useTranslation } from "react-i18next";
import { dayKey, HOURS, type Ctx } from "./parts";

const WEEK = [0, 1, 2, 3, 4];

export function WeekStrip({ ctx }: { ctx: Ctx }) {
  const { t } = useTranslation();
  const { clock, threads, inbox } = ctx.run.game;
  const { busy, act } = ctx;
  // A secret thread shows no title, only that something is booked.
  const booked = Object.values(threads).flatMap((thread) =>
    thread.beats
      .filter((b) => b.type === "big_scene" && !b.result && b.planned?.week === clock.week)
      .map((b) => ({
        day: b.planned!.day,
        title: thread.secret
          ? t("ui.bigCheese.week.secret")
          : t(`ui.bigCheese.week.bp.${b.blueprint}`, { defaultValue: "" }),
      })),
  );
  const today = booked.find((b) => b.day === clock.day);
  const started = clock.hoursLeft < HOURS || inbox.some((card) => card.age === 0);
  return (
    <>
      <ol className="bc-plain bc-week" aria-label={t("ui.bigCheese.week.label", { week: clock.week })}>
        {WEEK.map((day) => {
          const star = booked.find((b) => b.day === day);
          return (
            <li
              key={day}
              aria-current={day === clock.day ? "date" : undefined}
              className={day === clock.day ? "bc-pill" : "bc-muted"}
            >
              {t(dayKey(day))}
              {star && (
                <span aria-label={t("ui.bigCheese.week.scene", { title: star.title })}>
                  {" "}
                  <span aria-hidden="true">★</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {today && started && (
        <div className="bc-note">
          <p>{t("ui.bigCheese.week.today", { title: today.title })}</p>
          <button
            type="button"
            className="bc-btn bc-btn-primary"
            disabled={busy || clock.hoursLeft < 2}
            onClick={() => void act("big-scene/start")}
          >
            {t("ui.bigCheese.week.start")}
          </button>
          <button
            type="button"
            className="bc-btn bc-btn-quiet"
            disabled={busy}
            onClick={() => void act("big-scene/decline")}
          >
            {t("ui.bigCheese.week.decline")}
          </button>
        </div>
      )}
    </>
  );
}
