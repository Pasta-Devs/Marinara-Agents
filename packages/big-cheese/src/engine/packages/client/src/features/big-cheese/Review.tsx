// ──────────────────────────────────────────────
// Big Cheese: the term-end review sheet (modules.md §4): a review for each key person, then one award
// ──────────────────────────────────────────────
import { useTranslation } from "react-i18next";
import type { ChronicleState } from "./api";
import { Face, nameOf, type Ctx } from "./parts";

// Each key is a literal, so the locale validator finds it.
export const PICK_KEYS: Record<string, string> = {
  praise: "ui.bigCheese.yearbook.pick.praise",
  raise: "ui.bigCheese.yearbook.pick.raise",
  role: "ui.bigCheese.yearbook.pick.role",
  warning: "ui.bigCheese.yearbook.pick.warning",
};

export function Review({ ctx, pending }: { ctx: Ctx; pending: NonNullable<ChronicleState["pending"]> }) {
  const { t } = useTranslation();
  const { kit, busy, act } = ctx;
  const done = pending.done ?? [];
  const everyone = [...pending.review, ...done.map((d) => d.who)];
  return (
    <section className="bc-section" aria-labelledby="bc-review">
      <h2 id="bc-review" className="bc-subhead">
        {t("ui.bigCheese.yearbook.reviewTitle", { n: pending.term })}
      </h2>
      {pending.review.length > 0 && <p className="bc-muted">{t("ui.bigCheese.yearbook.reviewHelp")}</p>}
      <ul className="bc-list">
        {pending.review.map((who) => (
          <li key={who} className="bc-panel">
            <p className="bc-row-title">
              <Face kit={kit} id={who} size="s" /> {nameOf(kit, who)}
            </p>
            <div role="group" aria-label={nameOf(kit, who)}>
              {Object.entries(PICK_KEYS).map(([pick, key]) => (
                <button
                  key={pick}
                  type="button"
                  className="bc-btn"
                  disabled={busy}
                  onClick={() => void act("review", { who, pick })}
                >
                  {t(key)}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
      {done.length > 0 && (
        <ul className="bc-plain">
          {done.map((d) => (
            <li key={d.who} className="bc-row-text">
              {t("ui.bigCheese.yearbook.given", {
                name: nameOf(kit, d.who),
                pick: t(PICK_KEYS[d.pick] ?? PICK_KEYS.praise!),
              })}
            </li>
          ))}
        </ul>
      )}
      {pending.award ? (
        <p className="bc-row-meta">{t("ui.bigCheese.yearbook.awarded", { name: nameOf(kit, pending.award) })}</p>
      ) : (
        everyone.length > 0 && (
          <>
            <h3 className="bc-subhead">{t("ui.bigCheese.yearbook.awardTitle")}</h3>
            <div role="group" aria-label={t("ui.bigCheese.yearbook.awardTitle")}>
              {everyone.map((who) => (
                <button
                  key={who}
                  type="button"
                  className="bc-btn"
                  disabled={busy}
                  onClick={() => void act("award", { who })}
                >
                  {nameOf(kit, who)}
                </button>
              ))}
            </div>
          </>
        )
      )}
    </section>
  );
}
