// ──────────────────────────────────────────────
// Big Cheese: the Friday report and the end of a run (ui.md §5.9)
// ──────────────────────────────────────────────
import { useTranslation } from "react-i18next";
import type { Meter, Meters } from "./api";
import { Face, nameOf, stanceKey, type Ctx } from "./parts";
import { useState } from "react";
import { Achievements } from "./Achievements";
import { PlayNext } from "./Heir"; // M4 T6

const METERS: Meter[] = ["money", "output", "people", "standing"];
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

function MeterLines({ ctx, before, after }: { ctx: Ctx; before?: Meters; after: Meters }) {
  return (
    <dl className="bc-receipt-rows">
      {METERS.map((meter) => (
        <div key={meter}>
          <dt>{ctx.kit.meters[meter]?.label ?? meter}</dt>
          <dd>
            {before ? `${before[meter]} → ${after[meter]} ` : after[meter]}
            {before && (
              <span className={after[meter] >= before[meter] ? "bc-up" : "bc-down"}>
                {signed(after[meter] - before[meter])}
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function Report({ ctx, onNext }: { ctx: Ctx; onNext: () => void }) {
  const { t } = useTranslation();
  const { run, kit, busy } = ctx;
  const report = run.game.report!;
  const feelings = run.text.feelings[String(report.week)] ?? [];
  const handled = (run.game.delegateLog ?? []).filter((e) => e.week === report.week);
  return (
    <main className="bc-main">
      <article className="bc-receipt">
        <h1 className="bc-receipt-title" tabIndex={-1} data-focus>
          {kit.name}
        </h1>
        <p className="bc-receipt-sub">{t("ui.bigCheese.report.title", { week: report.week })}</p>
        <MeterLines ctx={ctx} before={report.before} after={report.after} />
        <p>{t("ui.bigCheese.report.income", { income: signed(report.income) })}</p>
        <h2 className="bc-receipt-head">{t("ui.bigCheese.report.feelings")}</h2>
        {feelings.length === 0 && <p>{t("ui.bigCheese.report.noFeelings")}</p>}
        <ul className="bc-plain">
          {feelings.map((entry) => (
            <li key={entry.person} className="bc-row bc-row-flat">
              <Face kit={kit} id={entry.person} size="s" />
              <span className="bc-row-text">
                <strong>{nameOf(kit, entry.person)}</strong>
                <span>{entry.line}</span>
              </span>
            </li>
          ))}
        </ul>
        {handled.length > 0 && (
          <>
            <h2 className="bc-receipt-head">{t("ui.bigCheese.report.delegated")}</h2>
            <ul className="bc-plain">
              {handled.map((e, i) => (
                <li key={i}>
                  {t("ui.bigCheese.report.handledLine", {
                    name: nameOf(kit, e.who),
                    meter: kit.meters[e.need]?.label,
                    stance: t(stanceKey(e.stance)),
                  })}
                </li>
              ))}
            </ul>
          </>
        )}
        {run.game.hearing && (
          <p className="bc-note bc-note-warn">
            {t("ui.bigCheese.report.hearing", { meter: kit.meters[run.game.hearing.meter]?.label })}
          </p>
        )}
      </article>
      <button type="button" className="bc-btn bc-btn-primary" disabled={busy} onClick={onNext}>
        {t("ui.bigCheese.report.next", { week: run.game.clock.week })}
      </button>
    </main>
  );
}

export function RunEnd({ ctx, onExit, onOpen }: { ctx: Ctx; onExit: () => void; onOpen?: (id: string) => void }) {
  const { t } = useTranslation();
  const { run, kit } = ctx;
  const over = run.game.status === "ended";
  return (
    <main className="bc-main">
      <article className="bc-receipt">
        <h1 className="bc-receipt-title" tabIndex={-1} data-focus>
          {over ? t("ui.bigCheese.end.over") : t("ui.bigCheese.end.complete")}
        </h1>
        <p className="bc-receipt-sub">
          {kit.name} · {t("ui.bigCheese.end.week", { week: run.game.clock.week })}
        </p>
        {run.end?.title && <h2 className="bc-receipt-head">{run.end.title}</h2>}
        {run.end?.text ? <p>{run.end.text}</p> : run.game.ending && <p>{run.game.ending}</p>}
        <MeterLines ctx={ctx} after={run.game.meters} />
        {run.end && <Achievements list={run.end.achievements} />}
      </article>
      <PlayNext ctx={ctx} onOpen={onOpen} />
      <button type="button" className="bc-btn bc-btn-primary" onClick={onExit}>
        {t("ui.bigCheese.end.back")}
      </button>
    </main>
  );
}

// Each key is a literal, so the locale validator finds it.
const WAYS = {
  quit: { label: "ui.bigCheese.leave.quit", help: "ui.bigCheese.leave.quitHelp", ask: "ui.bigCheese.leave.quitAsk" },
  sell: { label: "ui.bigCheese.leave.sell", help: "ui.bigCheese.leave.sellHelp", ask: "ui.bigCheese.leave.sellAsk" },
  abdicate: {
    label: "ui.bigCheese.leave.abdicate",
    help: "ui.bigCheese.leave.abdicateHelp",
    ask: "ui.bigCheese.leave.abdicateAsk",
  },
};

/** M4 T9: leave the job. Pick a way out, then confirm: it ends the run at once. */
export function Leave({ ctx }: { ctx: Ctx }) {
  const { t } = useTranslation();
  const { busy, act, go } = ctx;
  const [kind, setKind] = useState<"quit" | "sell" | "abdicate" | null>(null);
  return (
    <section className="bc-section" aria-labelledby="bc-leave-title">
      <h1 id="bc-leave-title" className="bc-heading" tabIndex={-1} data-focus>
        {t("ui.bigCheese.leave.title")}
      </h1>
      {kind ? (
        <>
          <p role="alert">{t(WAYS[kind].ask)}</p>
          <button
            type="button"
            className="bc-btn bc-btn-danger"
            disabled={busy}
            onClick={() => void act("quit", { kind })}
          >
            {t("ui.bigCheese.leave.confirm")}
          </button>
          <button type="button" className="bc-btn" disabled={busy} onClick={() => setKind(null)}>
            {t("ui.bigCheese.leave.cancel")}
          </button>
        </>
      ) : (
        <ul className="bc-list">
          {(Object.keys(WAYS) as (keyof typeof WAYS)[]).map((k) => (
            <li key={k} className="bc-panel">
              <p className="bc-row-meta">{t(WAYS[k].help)}</p>
              <button type="button" className="bc-btn" onClick={() => setKind(k)}>
                {t(WAYS[k].label)}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="bc-btn bc-btn-quiet" onClick={() => go("office")}>
        {t("ui.bigCheese.leave.back")}
      </button>
    </section>
  );
}
