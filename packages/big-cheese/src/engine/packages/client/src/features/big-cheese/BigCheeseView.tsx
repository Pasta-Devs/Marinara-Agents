// ──────────────────────────────────────────────
// Big Cheese: the root view. The title screen lists saved runs; an open run is RunView.
// ──────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { createRun, deleteRun, errorKey, listRuns, type RunSummary, type StartBody } from "./api";
import { Cast } from "./Cast";
import { RunView } from "./RunView";

type Load = "loading" | "slow" | "error" | "ready";

const placeName = (t: (key: string) => string, kitId?: string) =>
  kitId === "hafenkai" ? t("ui.bigCheese.kit.hafenkai") : t("ui.bigCheese.kit.unknown");

export function BigCheeseView() {
  const { t } = useTranslation();
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [load, setLoad] = useState<Load>("loading");
  const [open, setOpen] = useState<string | null>(null);
  const [casting, setCasting] = useState(false);
  const [doomed, setDoomed] = useState<RunSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  const refresh = useCallback(async () => {
    setLoad("loading");
    const slow = setTimeout(() => setLoad((now) => (now === "loading" ? "slow" : now)), 8000);
    try {
      setRuns(await listRuns());
      setLoad("ready");
    } catch (error) {
      setFailure(errorKey(error));
      setLoad("error");
    } finally {
      clearTimeout(slow);
    }
  }, []);

  useEffect(() => void refresh(), [refresh]);
  // Focus follows the screen: the heading takes it when the screen changes.
  useEffect(() => heading.current?.focus(), [open, casting]);

  async function start(cast?: StartBody) {
    setBusy(true);
    setFailure(null);
    try {
      const { run } = await createRun("hafenkai", cast);
      setCasting(false);
      setOpen(run.id);
    } catch (error) {
      setFailure(errorKey(error));
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!doomed) return;
    setBusy(true);
    setFailure(null);
    try {
      await deleteRun(doomed.id);
      setDoomed(null);
      await refresh();
    } catch (error) {
      setFailure(errorKey(error));
      setDoomed(null);
    } finally {
      setBusy(false);
    }
  }

  const closeConfirm = () => {
    setDoomed(null);
    opener.current?.focus();
  };

  if (open) {
    return (
      <RunView
        id={open}
        onExit={() => {
          setOpen(null);
          void refresh();
        }}
      />
    );
  }

  if (casting) {
    return (
      <Cast
        kitId="hafenkai"
        busy={busy}
        failure={failure}
        onStart={(cast) => void start(cast)}
        onSkip={() => void start()}
        onBack={() => {
          setFailure(null);
          setCasting(false);
        }}
      />
    );
  }

  return (
    <div className="bc-root" aria-busy={busy || load === "loading"}>
      <header className="bc-top" />
      <main className="bc-main">
        <h1 className="bc-heading" tabIndex={-1} ref={heading}>
          {t("ui.bigCheese.title")}
        </h1>
        <>
          {load === "error" && (
            <div role="alert" className="bc-note">
              <p>{t("ui.bigCheese.titleScreen.loadError")}</p>
              {failure && <p>{t(failure)}</p>}
              <button type="button" className="bc-btn" onClick={() => void refresh()}>
                {t("ui.bigCheese.titleScreen.retry")}
              </button>
            </div>
          )}
          {load === "loading" && <p className="bc-skeleton">{t("ui.bigCheese.titleScreen.loading")}</p>}
          {load === "slow" && <p>{t("ui.bigCheese.titleScreen.slow")}</p>}
          {load === "ready" && runs.length === 0 && <p>{t("ui.bigCheese.titleScreen.empty")}</p>}
          {failure && load !== "error" && (
            <p role="alert" className="bc-note">
              {t(failure)}
            </p>
          )}
          <ul className="bc-cards">
            {runs.map((run) => {
              const place = placeName(t, run.kitId);
              return (
                <li key={run.id} className="bc-card">
                  {run.newer ? (
                    <p>{t("ui.bigCheese.card.newer")}</p>
                  ) : (
                    <button type="button" className="bc-card-main" onClick={() => setOpen(run.id)}>
                      <span className="bc-card-name">{place}</span>
                      <span>{t("ui.bigCheese.card.progress", { week: run.week, day: run.day })}</span>
                      <span className="bc-sr">{t("ui.bigCheese.card.continue", { place })}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="bc-btn bc-btn-quiet"
                    aria-label={t("ui.bigCheese.card.deleteLabel", { place })}
                    onClick={(event) => {
                      opener.current = event.currentTarget;
                      setDoomed(run);
                    }}
                  >
                    {t("ui.bigCheese.card.delete")}
                  </button>
                </li>
              );
            })}
          </ul>
          <button type="button" className="bc-btn bc-btn-primary" disabled={busy} onClick={() => setCasting(true)}>
            {t("ui.bigCheese.titleScreen.start")}
          </button>
        </>
      </main>
      {doomed && (
        <div className="bc-veil" onKeyDown={(event) => event.key === "Escape" && closeConfirm()}>
          <div role="dialog" aria-modal="true" aria-labelledby="bc-confirm-title" className="bc-sheet">
            <h2 id="bc-confirm-title">{t("ui.bigCheese.confirm.title")}</h2>
            <p>{t("ui.bigCheese.confirm.body", { place: placeName(t, doomed.kitId) })}</p>
            <button type="button" className="bc-btn bc-btn-danger" disabled={busy} onClick={() => void confirmDelete()}>
              {t("ui.bigCheese.confirm.delete")}
            </button>
            <button type="button" className="bc-btn" autoFocus onClick={closeConfirm}>
              {t("ui.bigCheese.confirm.keep")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
