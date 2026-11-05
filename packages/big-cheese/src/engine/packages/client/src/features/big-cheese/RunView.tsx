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
import { Rules } from "./Rules";
import { Wish } from "./Wish";
import { Export } from "./Export";
import { Calls } from "./Calls";

const TABS = [
  { view: "office", key: "ui.bigCheese.dock.office" },
  { view: "inbox", key: "ui.bigCheese.dock.inbox" },
  { view: "people", key: "ui.bigCheese.dock.people" },
  { view: "place", key: "ui.bigCheese.dock.place" },
  { view: "meeting", key: "ui.bigCheese.dock.meeting" },
];

const DAYS = 5;
// Each key is a literal, so the locale validator finds it.
const POLICY_KEYS: Record<string, string> = {
  nobody: "ui.bigCheese.viewer.policy.nobody",
  deputy: "ui.bigCheese.viewer.policy.deputy",
  kind: "ui.bigCheese.viewer.policy.kind",
  strict: "ui.bigCheese.viewer.policy.strict",
  greedy: "ui.bigCheese.viewer.policy.greedy",
  chaotic: "ui.bigCheese.viewer.policy.chaotic",
};
const HALT_KEYS: Record<string, string> = {
  hearing: "ui.bigCheese.viewer.halt.hearing",
  crisis: "ui.bigCheese.viewer.halt.crisis",
  quit: "ui.bigCheese.viewer.halt.quit",
  couple: "ui.bigCheese.viewer.halt.couple",
  plot: "ui.bigCheese.viewer.halt.plot",
  low: "ui.bigCheese.viewer.halt.low",
  secret: "ui.bigCheese.viewer.halt.secret",
};

export function RunView({ id, onExit }: { id: string; onExit: () => void }) {
  const { t } = useTranslation();
  const [data, setData] = useState<RunState | null>(null);
  const [load, setLoad] = useState<"loading" | "slow" | "error" | "ready">("loading");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [view, setView] = useState("office");
  const [board, setBoard] = useState(false);
  const [menu, setMenu] = useState(false); // the "[...]" run menu
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

  // T8: viewer mode. One timer tick is one slot; the next tick waits for the last advance to finish.
  const [watching, setWatching] = useState<{ speed: number; policy: string } | null>(null);
  const [halt, setHalt] = useState<string | null>(null);
  const [digest, setDigest] = useState<string | null>(null);
  const [beat, setBeat] = useState(0);
  const advance = async (body: object) => {
    if (!data || busy) return;
    setBusy(true);
    setNote(null);
    try {
      const next = (await postAction(data.run, "advance", body)) as RunState & {
        paused: string | null;
        digest: string | null;
      };
      setData(next);
      setHalt(next.paused);
      if (next.digest) setDigest(next.digest);
    } catch (error) {
      setNote(errorKey(error));
      setWatching(null);
    } finally {
      setBusy(false);
    }
  };
  const live = !!data && !data.run.scene && data.run.game.status === "playing";
  useEffect(() => {
    if (!watching || halt || busy || !live) return;
    const g = data.run.game; // the day must be started by hand first
    if (g.clock.hoursLeft === HOURS && !g.inbox.some((c) => c.age === 0)) return;
    const timer = setTimeout(
      () => (document.hidden ? setBeat((b) => b + 1) : void advance({ slots: 1, policy: watching.policy })),
      20000 / watching.speed,
    );
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watching, halt, busy, live, data, beat]);

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
  else if (base === "rules") screen = <Rules ctx={ctx} />;
  else if (base === "wish") screen = <Wish ctx={ctx} />;
  else if (base === "export") screen = <Export ctx={ctx} />;
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
        {game.mode !== "sandbox" && (
          <button type="button" className="bc-btn bc-btn-quiet" onClick={() => setBoard(true)}>
            {t("ui.bigCheese.board.open")}
          </button>
        )}
        <span className="bc-menu">
          <button
            type="button"
            className="bc-btn bc-btn-quiet"
            aria-expanded={menu}
            aria-label={t("ui.bigCheese.run.menuLabel")}
            onClick={() => setMenu((open) => !open)}
          >
            {t("ui.bigCheese.run.menu")}
          </button>
          {menu && (
            // Items are append-only: each ticket adds its own button here.
            <span role="group" aria-label={t("ui.bigCheese.run.menuLabel")}>
              <button
                type="button"
                className="bc-btn bc-btn-quiet"
                onClick={() => {
                  setMenu(false);
                  setView("export");
                }}
              >
                {t("ui.bigCheese.run.menuExport")}
              </button>
            </span>
          )}
        </span>
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
        {!board && live && !canStart && !(game.meeting && !game.meeting.done) && (
          <div className="bc-note" role="group" aria-label={t("ui.bigCheese.viewer.label")}>
            <button
              type="button"
              className="bc-btn"
              aria-pressed={!!watching}
              onClick={() => {
                setHalt(null);
                setWatching(watching ? null : { speed: 1, policy: "nobody" });
              }}
            >
              {t(watching ? "ui.bigCheese.viewer.pause" : "ui.bigCheese.viewer.watch")}
            </button>
            {watching && (
              <>
                {[1, 2, 4].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="bc-btn bc-btn-quiet"
                    aria-pressed={watching.speed === n}
                    onClick={() => setWatching({ ...watching, speed: n })}
                  >
                    {t("ui.bigCheese.viewer.speed", { n })}
                  </button>
                ))}
                <label>
                  {t("ui.bigCheese.viewer.boss")}{" "}
                  <select
                    value={watching.policy}
                    onChange={(event) => setWatching({ ...watching, policy: event.target.value })}
                  >
                    {Object.entries(POLICY_KEYS).map(([value, key]) => (
                      <option key={value} value={value}>
                        {t(key)}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            <button
              type="button"
              className="bc-btn bc-btn-quiet"
              disabled={busy || clock.hoursLeft <= HOURS - 3}
              onClick={() => void advance({ slots: 3 - (HOURS - clock.hoursLeft), skip: true })}
            >
              {t("ui.bigCheese.viewer.skipEvening")}
            </button>
            <button
              type="button"
              className="bc-btn bc-btn-quiet"
              disabled={busy}
              onClick={() => void advance({ slots: clock.hoursLeft + HOURS * (DAYS - 1 - clock.day), skip: true })}
            >
              {t("ui.bigCheese.viewer.skipMonday")}
            </button>
          </div>
        )}
        {halt && (
          <div className="bc-note" role="alert">
            <p>{t(HALT_KEYS[halt] ?? HALT_KEYS.hearing!)}</p>
            <button type="button" className="bc-btn" onClick={() => setHalt(null)}>
              {t("ui.bigCheese.viewer.keep")}
            </button>
            <button
              type="button"
              className="bc-btn bc-btn-quiet"
              onClick={() => {
                setHalt(null);
                setWatching(null);
              }}
            >
              {t("ui.bigCheese.viewer.step")}
            </button>
          </div>
        )}
        {digest && (
          <div className="bc-note" role="status">
            <p>{digest}</p>
            <button type="button" className="bc-btn bc-btn-quiet" onClick={() => setDigest(null)}>
              {t("ui.bigCheese.viewer.close")}
            </button>
          </div>
        )}
        {screen}
        {base === "rules" && <Calls id={ctx.run.id} />}
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
          {game.mode === "sandbox" && (
            <button type="button" className="bc-dock-tab" onClick={() => setBoard(true)}>
              {t("ui.bigCheese.dock.board")}
            </button>
          )}
        </nav>
      )}
    </div>
  );
}
