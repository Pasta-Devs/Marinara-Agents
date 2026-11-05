// Big Cheese: term goals and perks (content.md 8, 9)
// Pick 3 of the 5 goals of the term, see how the picks stand, and take the perk offered after a term.
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getGoals, type GoalsState } from "./api";
import type { Ctx } from "./parts";

export function Goals({ ctx }: { ctx: Ctx }) {
  const { t } = useTranslation();
  const { run, busy, act, go } = ctx;
  const [data, setData] = useState<GoalsState | null>(null);
  const [failed, setFailed] = useState(false);
  const [sel, setSel] = useState<string[]>([]);
  const load = useCallback(() => {
    getGoals(run.id)
      .then(setData)
      .catch(() => setFailed(true));
  }, [run.id]);

  // Each action changes the run, so the sheet reloads with the new revision.
  useEffect(() => load(), [load, run.revision]);

  const want = data ? Math.min(3, data.offered.length) : 3;
  const toggle = (id: string) =>
    setSel((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < want ? [...cur, id] : cur));

  return (
    <>
      <h1 className="bc-heading" tabIndex={-1} data-focus>
        {t("ui.bigCheese.goals.title")}
      </h1>
      {failed && <p role="alert">{t("ui.bigCheese.goals.error")}</p>}
      {data && (
        <>
          <section className="bc-section" aria-labelledby="bc-goals-term">
            <h2 id="bc-goals-term" className="bc-subhead">
              {t("ui.bigCheese.goals.term", { n: data.term })}
            </h2>
            {data.set ? (
              <ul className="bc-list">
                {data.picked.map((g) => (
                  <li key={g.id} className="bc-panel">
                    <p className="bc-row-title">{g.text}</p>
                    <p className="bc-row-meta">{t(g.ok ? "ui.bigCheese.goals.ok" : "ui.bigCheese.goals.notYet")}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <>
                <p className="bc-muted">{t("ui.bigCheese.goals.help", { n: want })}</p>
                <ul className="bc-list">
                  {data.offered.map((g) => (
                    <li key={g.id} className="bc-panel">
                      <button
                        type="button"
                        className={sel.includes(g.id) ? "bc-btn bc-btn-primary" : "bc-btn"}
                        aria-pressed={sel.includes(g.id)}
                        disabled={busy}
                        onClick={() => toggle(g.id)}
                      >
                        {g.text}
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="bc-btn bc-btn-primary"
                  disabled={busy || sel.length !== want}
                  onClick={() => void act("goals", { picks: sel }).then(() => setSel([]))}
                >
                  {t("ui.bigCheese.goals.set", { count: sel.length, n: want })}
                </button>
              </>
            )}
          </section>

          {data.history.length > 0 && (
            <section className="bc-section">
              <h2 className="bc-subhead">{t("ui.bigCheese.goals.history")}</h2>
              <ul className="bc-plain">
                {data.history.map((h) => (
                  <li key={h.term} className="bc-row-text">
                    {t("ui.bigCheese.goals.result", { n: h.term, met: h.met.length, total: h.picked.length })}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="bc-section" aria-labelledby="bc-perks">
            <h2 id="bc-perks" className="bc-subhead">
              {t("ui.bigCheese.goals.perks")}
            </h2>
            {data.perkOffer.length > 0 && (
              <>
                <p className="bc-muted">{t("ui.bigCheese.goals.perkHelp")}</p>
                <ul className="bc-list">
                  {data.perkOffer.map((p) => (
                    <li key={p.id} className="bc-panel">
                      <p className="bc-row-title">{p.name}</p>
                      <p className="bc-row-meta">{p.text}</p>
                      <button
                        type="button"
                        className="bc-btn bc-btn-primary"
                        disabled={busy}
                        onClick={() => void act("perk", { perk: p.id })}
                      >
                        {t("ui.bigCheese.goals.take")}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {data.perks.length === 0 ? (
              <p className="bc-muted">{t("ui.bigCheese.goals.noPerks")}</p>
            ) : (
              <ul className="bc-plain">
                {data.perks.map((p) => (
                  <li key={p.id} className="bc-row-text">
                    <span className="bc-row-title">{p.name}</span> <span className="bc-muted">{p.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
      <button type="button" className="bc-btn bc-btn-quiet" onClick={() => go("office")}>
        {t("ui.bigCheese.goals.back")}
      </button>
    </>
  );
}
