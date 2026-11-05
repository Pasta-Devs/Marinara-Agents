// ──────────────────────────────────────────────
// Big Cheese: the yearbook, one page for each ended term, and the term review (modules.md §4)
// ──────────────────────────────────────────────
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getChronicle, type ChronicleState } from "./api";
import type { Ctx } from "./parts";
import { Review } from "./Review";

export function Yearbook({ ctx }: { ctx: Ctx }) {
  const { t } = useTranslation();
  const { run, busy, act, go } = ctx;
  const [data, setData] = useState<ChronicleState | null>(null);
  const [failed, setFailed] = useState(false);
  const [adult, setAdult] = useState(false);
  const load = useCallback(() => {
    getChronicle(run.id)
      .then(setData)
      .catch(() => setFailed(true));
  }, [run.id]);
  useEffect(() => load(), [load, run.revision]);

  const pending = data?.pending;
  const writable = !!pending && !data?.pages.some((p) => p.term === pending.term);
  return (
    <main className="bc-main">
      <h1 className="bc-heading" tabIndex={-1} data-focus>
        {t("ui.bigCheese.yearbook.title")}
      </h1>
      {failed && <p role="alert">{t("ui.bigCheese.yearbook.error")}</p>}
      {pending && run.game.status === "playing" && <Review ctx={ctx} pending={pending} />}
      {pending && writable && (
        <section className="bc-section">
          {run.game.adult && (
            <label className="bc-row-meta">
              <input type="checkbox" checked={adult} onChange={(event) => setAdult(event.target.checked)} />{" "}
              {t("ui.bigCheese.yearbook.withAdult")}
            </label>
          )}
          <button
            type="button"
            className="bc-btn bc-btn-primary"
            disabled={busy}
            onClick={() => void act("chronicle", { adult })}
          >
            {t("ui.bigCheese.yearbook.write", { n: pending.term })}
          </button>
        </section>
      )}
      {data && data.pages.length === 0 && <p className="bc-muted">{t("ui.bigCheese.yearbook.empty")}</p>}
      {data?.pages.map((page) => (
        <article key={page.term} className="bc-receipt">
          <h2 className="bc-receipt-head">{page.title}</h2>
          <p className="bc-receipt-sub">{t("ui.bigCheese.yearbook.term", { n: page.term })}</p>
          <p>{page.text}</p>
        </article>
      ))}
      <button type="button" className="bc-btn bc-btn-quiet" onClick={() => go("office")}>
        {t("ui.bigCheese.yearbook.back")}
      </button>
    </main>
  );
}
