// ──────────────────────────────────────────────
// Big Cheese M4 T15: the books and the quarter's budget sliders (detailed money)
// ──────────────────────────────────────────────
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getLedger, type LedgerState, type Meter } from "./api";
import { rebalance } from "./budget";
import type { Ctx } from "./parts";

const METER_ORDER: Meter[] = ["money", "output", "people", "standing"];

export function Ledger({ ctx }: { ctx: Ctx }) {
  const { t } = useTranslation();
  const { run, kit, busy, act, go } = ctx;
  const [data, setData] = useState<LedgerState | null>(null);
  const [failed, setFailed] = useState(false);
  const [budget, setBudget] = useState<Record<Meter, number> | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [weeks, setWeeks] = useState<number | null>(null);

  const load = useCallback(() => {
    getLedger(run.id)
      .then((d) => {
        setData(d);
        setBudget(d.budget);
      })
      .catch(() => setFailed(true));
  }, [run.id]);
  // Each action changes the run, so the books reload with the new revision.
  useEffect(() => load(), [load, run.revision]);

  const label = (m: Meter) => kit.meters[m]?.label ?? m;
  const open = data?.loans.filter((l) => !l.repaid) ?? [];
  const changed = !!data && !!budget && METER_ORDER.some((m) => budget[m] !== data.budget[m]);

  return (
    <>
      <h1 className="bc-heading" tabIndex={-1} data-focus>
        {t("ui.bigCheese.ledger.title")}
      </h1>
      {failed && <p role="alert">{t("ui.bigCheese.ledger.error")}</p>}
      {data && budget && (
        <>
          <section className="bc-section" aria-labelledby="bc-ledger-books">
            <h2 id="bc-ledger-books" className="bc-subhead">
              {t("ui.bigCheese.ledger.books")}
            </h2>
            <ul className="bc-plain">
              <li className="bc-row-text">{t("ui.bigCheese.ledger.revenue", { n: data.revenue })}</li>
              <li className="bc-row-text">{t("ui.bigCheese.ledger.salaries", { n: data.salaries })}</li>
              <li className="bc-row-text">{t("ui.bigCheese.ledger.upkeep", { n: data.upkeep })}</li>
              {open
                .filter((l) => l.due <= data.week)
                .map((l) => (
                  <li key={l.id} className="bc-row-text">
                    {t("ui.bigCheese.ledger.payment", { n: l.owed })}
                  </li>
                ))}
            </ul>
            <p className="bc-muted">
              {data.audit === null
                ? t("ui.bigCheese.ledger.noAudit")
                : t("ui.bigCheese.ledger.audit", { n: data.audit })}
            </p>
          </section>

          <section className="bc-section" aria-labelledby="bc-ledger-loans">
            <h2 id="bc-ledger-loans" className="bc-subhead">
              {t("ui.bigCheese.ledger.loans")}
            </h2>
            {open.length === 0 && <p className="bc-muted">{t("ui.bigCheese.ledger.noLoans")}</p>}
            <ul className="bc-list">
              {open.map((l) => (
                <li key={l.id} className="bc-panel">
                  <p className="bc-row-title">{t("ui.bigCheese.ledger.loan", { n: l.amount })}</p>
                  <p className="bc-row-meta">
                    {t(l.missed ? "ui.bigCheese.ledger.late" : "ui.bigCheese.ledger.due", {
                      week: l.due,
                      owed: l.owed,
                    })}
                  </p>
                </li>
              ))}
            </ul>
            <div role="group" aria-label={t("ui.bigCheese.ledger.amount")} className="bc-form">
              <span>{t("ui.bigCheese.ledger.amount")}</span>
              <div className="bc-cards">
                {data.offers.amounts.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="bc-btn"
                    aria-pressed={amount === n}
                    onClick={() => setAmount(n)}
                  >
                    {t("ui.bigCheese.ledger.points", { n })}
                  </button>
                ))}
              </div>
            </div>
            <div role="group" aria-label={t("ui.bigCheese.ledger.term")} className="bc-form">
              <span>{t("ui.bigCheese.ledger.term")}</span>
              <div className="bc-cards">
                {data.offers.weeks.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="bc-btn"
                    aria-pressed={weeks === n}
                    onClick={() => setWeeks(n)}
                  >
                    {t("ui.bigCheese.ledger.weeks", { n })}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              className="bc-btn bc-btn-primary"
              disabled={busy || amount === null || weeks === null || open.length >= 2}
              onClick={() => void act("loan", { amount, weeks }).then(() => (setAmount(null), setWeeks(null)))}
            >
              {t("ui.bigCheese.ledger.take")}
            </button>
          </section>

          <section className="bc-section" aria-labelledby="bc-ledger-budget">
            <h2 id="bc-ledger-budget" className="bc-subhead">
              {t("ui.bigCheese.ledger.budget", { n: data.quarter })}
            </h2>
            <p className="bc-muted">{t("ui.bigCheese.ledger.budgetHelp")}</p>
            <div className="bc-form">
              {METER_ORDER.map((m) => (
                <label key={m} htmlFor={`bc-budget-${m}`}>
                  {label(m)}: {budget[m]}
                  <input
                    id={`bc-budget-${m}`}
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={budget[m]}
                    disabled={busy}
                    style={{ width: "100%", minHeight: 44 }}
                    onChange={(event) => setBudget(rebalance(budget, m, Number(event.target.value)))}
                  />
                </label>
              ))}
            </div>
            <button
              type="button"
              className="bc-btn bc-btn-primary"
              disabled={busy || !changed}
              onClick={() => void act("budget", { budget })}
            >
              {t("ui.bigCheese.ledger.save")}
            </button>
          </section>
        </>
      )}
      <button type="button" className="bc-btn bc-btn-quiet" onClick={() => go("office")}>
        {t("ui.bigCheese.ledger.back")}
      </button>
    </>
  );
}
