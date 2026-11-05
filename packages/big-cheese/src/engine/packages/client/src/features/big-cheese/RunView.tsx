// ──────────────────────────────────────────────
// Big Cheese: one open run. Loads it, posts actions and picks the screen.
// ──────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CONFLICT_KEY, errorKey, getRun, postAction, type RunState } from "./api";
import { HOURS, dayKey, HourPips, type Ctx } from "./parts";
import { Office } from "./Office";
import { Letters } from "./Letters";
import { CardScreen, Inbox } from "./Inbox";
import { People, PersonSheet } from "./People";
import { Place } from "./Place";
import { Scene } from "./Scene";
import { Report, RunEnd } from "./Report";
import { HearingPrep, MeetingScreen } from "./Meeting";
import { Board } from "./Board";

const TABS = [
  { view: "office", key: "ui.bigCheese.dock.office" },
  { view: "inbox", key: "ui.bigCheese.dock.inbox" },
  { view: "people", key: "ui.bigCheese.dock.people" },
  { view: "place", key: "ui.bigCheese.dock.place" },
  { view: "meeting", key: "ui.bigCheese.dock.meeting" },
];

export function RunView({ id, onExit }: { id: string; onExit: () => void }) {
  const { t } = useTranslation();
  const [data, setData] = useState<RunState | null>(null);
  const [load, setLoad] = useState<"loading" | "slow" | "error" | "ready">("loading");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [view, setView] = useState("office");
  const [board, setBoard] = useState(false);
  // A finished scene leaves `run.scene`; we keep its id to show the receipt.
  const [ended, setEnded] = useState<string | null>(null);
  const [reportSeen, setReportSeen] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);

  const reload = useCallback(async () => {
    setLoad("loading");
    setNote(null);
    const slow = setTimeout(() => setLoad((now) => (now === "loading" ? "slow" : now)), 8000);
    try {
      setData(await getRun(id));
      setLoad("ready");
    } catch (error) {
      setNote(errorKey(error));
      setLoad("error");
    } finally {
      clearTimeout(slow);
    }
  }, [id]);

  useEffect(() => void reload(), [reload]);

  const act = async (path: string, body: object = {}) => {
    if (!data || busy) return false;
    setBusy(true);
    setNote(null);
    try {
      const next = await postAction(data.run, path, body);
      if (data.run.scene && !next.run.scene) setEnded(data.run.scene);
      setData(next);
      return true;
    } catch (error) {
      setNote(errorKey(error));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const game = data?.run.game;
  const canStart = !!game && game.clock.hoursLeft === HOURS && !game.inbox.some((card) => card.age === 0);
  const report = game?.report;
  const sceneId = data?.run.scene ?? ended;
  const showReport =
    !!report && report.week === game!.clock.week - 1 && game!.clock.day === 0 && canStart && reportSeen !== report.week;
  const screenKey = `${view}|${sceneId}|${showReport}|${game?.status}|${load}`;

  // Focus follows the screen: each screen's heading takes it.
  useEffect(() => {
    root.current?.querySelector<HTMLElement>("[data-focus]")?.focus();
  }, [screenKey]);
  // An action can remove the control that had focus (Start the day, a scene choice). Focus then
  // falls to <body>, so the screen's heading takes it back.
  useEffect(() => {
    if (document.activeElement === document.body) root.current?.querySelector<HTMLElement>("[data-focus]")?.focus();
  }, [data]);

  const noteBlock = note && (
    <div role="alert" className="bc-note">
      <p>{t(note)}</p>
      {(note === CONFLICT_KEY || load === "error") && (
        <button type="button" className="bc-btn" onClick={() => void reload()}>
          {t("ui.bigCheese.run.reload")}
        </button>
      )}
    </div>
  );

  if (!data || !game) {
    return (
      <div className="bc-root" ref={root} aria-busy={load === "loading"}>
        <header className="bc-top">
          <button type="button" className="bc-btn bc-btn-quiet" onClick={onExit}>
            {t("ui.bigCheese.office.back")}
          </button>
        </header>
        <main className="bc-main">
          <h1 className="bc-heading" tabIndex={-1} data-focus>
            {t("ui.bigCheese.office.title")}
          </h1>
          {noteBlock}
          {load !== "error" && <div className="bc-skeleton" />}
          {load !== "error" && <div className="bc-skeleton" />}
          {load === "slow" && <p>{t("ui.bigCheese.busy.slow")}</p>}
        </main>
      </div>
    );
  }

  const ctx: Ctx = { run: data.run, kit: data.kit, busy, act, go: setView };

  let stage = null;
  if (sceneId && data.run.text.scenes[sceneId]) {
    stage = (
      <Scene
        ctx={ctx}
        id={sceneId}
        onLeave={onExit}
        onClose={() => {
          setEnded(null);
          setView("office");
        }}
      />
    );
  } else if (game.status !== "playing") {
    stage = <RunEnd ctx={ctx} onExit={onExit} />;
  } else if (showReport) {
    stage = (
      <Report
        ctx={ctx}
        onNext={async () => {
          if (await act("day/start")) {
            setReportSeen(report!.week);
            setView("office");
          }
        }}
      />
    );
  }
  if (stage) {
    return (
      <div className="bc-root bc-stage-root" ref={root} aria-busy={busy}>
        {noteBlock}
        {stage}
      </div>
    );
  }

  const [base, arg] = view.split(":");
  const tab = TABS.some((entry) => entry.view === base) ? base : null;
  let screen;
  if (base === "card" && game.inbox.some((card) => card.id === arg)) screen = <CardScreen ctx={ctx} id={arg} />;
  else if (base === "person" && arg) screen = <PersonSheet ctx={ctx} id={arg} />;
  else if (base === "letters") screen = <Letters ctx={ctx} />;
  else if (base === "hearing" && game.hearing) screen = <HearingPrep ctx={ctx} />;
  else if (base === "inbox" || base === "card")
    screen = <Inbox ctx={ctx} canStart={canStart} remembered={base === "inbox" ? arg : undefined} />;
  else if (base === "people") screen = <People ctx={ctx} />;
  else if (base === "place") screen = <Place ctx={ctx} />;
  else if (base === "meeting") screen = <MeetingScreen ctx={ctx} />;
  else screen = <Office ctx={ctx} canStart={canStart} />;

  const { clock } = game;
  return (
    <div
      className="bc-root"
      ref={root}
      // The person file reads like a sheet, so Esc closes it (the Board sheet handles its own Esc).
      onKeyDown={(event) => event.key === "Escape" && base === "person" && !board && setView("people")}
    >
      <header className="bc-top">
        {tab ? (
          <button
            type="button"
            className="bc-btn bc-btn-quiet"
            aria-label={t("ui.bigCheese.office.back")}
            onClick={onExit}
          >
            {t("ui.bigCheese.run.back")}
          </button>
        ) : (
          <button
            type="button"
            className="bc-btn bc-btn-quiet"
            onClick={() => setView(base === "card" ? "inbox" : base === "person" ? "people" : "office")}
          >
            {t("ui.bigCheese.run.back")}
          </button>
        )}
        <button type="button" className="bc-btn bc-btn-quiet" onClick={() => setBoard(true)}>
          {t("ui.bigCheese.board.open")}
        </button>
        <span className="bc-top-day">
          {t("ui.bigCheese.run.when", { day: t(dayKey(clock.day)), week: clock.week })}
        </span>
        <HourPips
          left={clock.hoursLeft}
          label={t("ui.bigCheese.run.hours", { count: clock.hoursLeft, total: HOURS })}
        />
      </header>
      <main className="bc-main" aria-busy={busy}>
        {!board && noteBlock}
        {screen}
      </main>
      {board && <Board ctx={ctx} note={noteBlock} onClose={() => setBoard(false)} />}
      {tab && (
        <nav className="bc-dock" aria-label={t("ui.bigCheese.dock.label")}>
          {TABS.map((entry) => (
            <button
              key={entry.view}
              type="button"
              className="bc-dock-tab"
              aria-current={tab === entry.view ? "page" : undefined}
              onClick={() => setView(entry.view)}
            >
              {t(entry.key)}
              {entry.view === "inbox" && game.inbox.length > 0 && (
                <span className="bc-badge">
                  <span aria-hidden="true">{game.inbox.length}</span>
                  <span className="bc-sr">{t("ui.bigCheese.dock.waiting", { count: game.inbox.length })}</span>
                </span>
              )}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
