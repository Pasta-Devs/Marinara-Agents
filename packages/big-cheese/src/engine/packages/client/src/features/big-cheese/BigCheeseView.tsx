// ──────────────────────────────────────────────
// Big Cheese: the root view. The title screen lists saved runs; an open run is RunView.
// ──────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  createRun,
  deleteRun,
  errorKey,
  getKit,
  importKit,
  listKits,
  listRuns,
  type KitSummary,
  type RunMode,
  type RunSummary,
  type StartBody,
} from "./api";
import { Cast } from "./Cast";
import { KitEditor } from "./KitEditor";
import { NewPlace } from "./NewPlace";
import { dayKey } from "./parts";
import { Preview } from "./Preview";
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
  const [editing, setEditing] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [wishing, setWishing] = useState(false);
  const [mode, setMode] = useState<RunMode>("normal");
  const [picked, setPicked] = useState<StartBody | undefined>();
  const [doomed, setDoomed] = useState<RunSummary | null>(null);
  const [hide18, setHide18] = useState(false);
  const [blur18, setBlur18] = useState(true); // 18+ title cards are blurred until the player turns it off
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [kits, setKits] = useState<KitSummary[]>([]);
  const [kitNote, setKitNote] = useState<string | null>(null);
  const [kitReasons, setKitReasons] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  const refresh = useCallback(async () => {
    setLoad("loading");
    const slow = setTimeout(() => setLoad((now) => (now === "loading" ? "slow" : now)), 8000);
    try {
      setRuns(await listRuns());
      setKits(await listKits().catch(() => []));
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
  useEffect(() => heading.current?.focus(), [open, casting, previewing, editing, wishing]);

  async function start(cast?: StartBody) {
    setBusy(true);
    setFailure(null);
    try {
      const { run } = await createRun("hafenkai", { ...cast, mode });
      setPreviewing(false);
      setPicked(undefined);
      setOpen(run.id);
    } catch (error) {
      setFailure(errorKey(error));
    } finally {
      setBusy(false);
    }
  }

  // A saved kit starts a run at once, without a cast: its people are the kit's own.
  // T3: a drafted kit is saved to the library, then the run starts from it.
  async function startDrafted(kit: unknown, body: StartBody) {
    setBusy(true);
    setFailure(null);
    try {
      const saved = await importKit(kit);
      const { run } = await createRun("hafenkai", { ...body, mode }, saved.kit.id);
      setWishing(false);
      setOpen(run.id);
    } catch (error) {
      setFailure(errorKey(error));
    } finally {
      setBusy(false);
    }
  }

  async function startSaved(id: string) {
    setBusy(true);
    setFailure(null);
    try {
      const { run } = await createRun("hafenkai", { mode }, id);
      setOpen(run.id);
    } catch (error) {
      setFailure(errorKey(error));
    } finally {
      setBusy(false);
    }
  }

  async function exportKit(kit: KitSummary) {
    setFailure(null);
    try {
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(await getKit(kit.id), null, 2)], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `${kit.id}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setFailure(errorKey(error));
    }
  }

  async function importFile(file: File) {
    setBusy(true);
    setFailure(null);
    setKitNote(null);
    setKitReasons(null);
    try {
      let kit: unknown;
      try {
        kit = JSON.parse(await file.text());
      } catch {
        setKitReasons(t("ui.bigCheese.kits.notJson"));
        return;
      }
      const saved = await importKit(kit);
      setKitNote(t("ui.bigCheese.kits.imported", { name: saved.kit.name, count: saved.fixes.length }));
      setKits(await listKits());
    } catch (error) {
      setFailure(errorKey(error));
      // ponytail: the reasons come from the server in English; localise them when kit reasons get codes.
      setKitReasons(error instanceof Error ? error.message : null);
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
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
      // The Delete button that opened the confirm is gone with its run, so the heading takes focus.
      heading.current?.focus();
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
        key={open}
        id={open}
        onOpen={setOpen}
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
        busy={false}
        failure={null}
        onStart={(cast) => {
          setPicked(cast);
          setCasting(false);
        }}
        onSkip={() => {
          setPicked(undefined);
          setCasting(false);
        }}
        onBack={() => setCasting(false)}
      />
    );
  }

  if (editing) {
    return (
      <KitEditor
        kitId={editing}
        onSaved={() => {
          setEditing(null);
          setPreviewing(false);
          void refresh();
        }}
        onBack={() => setEditing(null)}
      />
    );
  }
  if (wishing) {
    return (
      <NewPlace
        busy={busy}
        failure={failure}
        onTake={(kit, body) => void startDrafted(kit, body)}
        onBack={() => {
          setFailure(null);
          setWishing(false);
        }}
      />
    );
  }
  if (previewing) {
    return (
      <Preview
        kitId="hafenkai"
        cast={picked}
        busy={busy}
        failure={failure}
        onTake={(body) => void start(body)}
        onCast={() => setCasting(true)}
        onEdit={() => setEditing("hafenkai")}
        onBack={() => {
          setFailure(null);
          setPicked(undefined);
          setPreviewing(false);
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
          <div role="group" aria-label={t("ui.bigCheese.mode.label")} className="bc-modes">
            {(["normal", "sandbox", "ironman"] as const).map((m) => (
              <button
                key={m}
                type="button"
                className="bc-btn bc-btn-quiet"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
              >
                {t(`ui.bigCheese.mode.${m}`)}
              </button>
            ))}
          </div>
          <p className="bc-muted">{t(`ui.bigCheese.mode.${mode}Note`)}</p>
          <button type="button" className="bc-btn bc-btn-primary" disabled={busy} onClick={() => setPreviewing(true)}>
            {t("ui.bigCheese.titleScreen.start")}
          </button>
          <button type="button" className="bc-btn" disabled={busy} onClick={() => setWishing(true)}>
            {t("ui.bigCheese.titleScreen.wish")}
          </button>
          <label>
            <input type="checkbox" checked={hide18} onChange={(e) => setHide18(e.target.checked)} />{" "}
            {t("ui.bigCheese.adult.hide")}
          </label>
          <label>
            <input type="checkbox" checked={blur18} onChange={(e) => setBlur18(e.target.checked)} />{" "}
            {t("ui.bigCheese.adult.blur")}
          </label>
          <ul className="bc-cards">
            {runs
              .filter((run) => !(hide18 && run.adult))
              .map((run) => {
                const place = placeName(t, run.kitId);
                return (
                  <li key={run.id} className="bc-card">
                    {run.newer ? (
                      <p>{t("ui.bigCheese.card.newer")}</p>
                    ) : (
                      <button type="button" className="bc-card-main" onClick={() => setOpen(run.id)}>
                        <span
                          className="bc-card-name"
                          style={run.adult && blur18 ? { filter: "blur(6px)" } : undefined}
                        >
                          {place}
                          {run.cheeseMark && <span className="bc-muted"> {t("ui.bigCheese.mode.mark")}</span>}
                          {(run.generation ?? 1) > 1 && (
                            <span className="bc-chip">
                              {" "}
                              {t("ui.bigCheese.legacy.generation", { n: run.generation })}
                            </span>
                          )}
                          {run.adult && <span className="bc-chip"> {t("ui.bigCheese.adult.mark")}</span>}
                        </span>
                        <span>{t("ui.bigCheese.card.progress", { week: run.week, day: t(dayKey(run.day ?? 0)) })}</span>
                        <span className="bc-muted">
                          {t("ui.bigCheese.card.played", {
                            when: new Date(run.updatedAt).toLocaleString(undefined, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            }),
                          })}
                        </span>
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
          <section aria-labelledby="bc-kits-title">
            <h2 id="bc-kits-title">{t("ui.bigCheese.kits.title")}</h2>
            {load === "ready" && kits.length === 0 && <p>{t("ui.bigCheese.kits.empty")}</p>}
            <ul className="bc-cards">
              {kits.map((kit) => (
                <li key={kit.id} className="bc-card">
                  <span className="bc-card-name">{kit.name}</span>
                  <span className="bc-muted">{kit.premise}</span>
                  <button
                    type="button"
                    className="bc-btn"
                    disabled={busy}
                    aria-label={t("ui.bigCheese.kits.playLabel", { name: kit.name })}
                    onClick={() => void startSaved(kit.id)}
                  >
                    {t("ui.bigCheese.kits.play")}
                  </button>
                  <button
                    type="button"
                    className="bc-btn bc-btn-quiet"
                    aria-label={t("ui.bigCheese.kits.exportLabel", { name: kit.name })}
                    onClick={() => void exportKit(kit)}
                  >
                    {t("ui.bigCheese.kits.export")}
                  </button>
                  <button
                    type="button"
                    className="bc-btn bc-btn-quiet"
                    disabled={busy}
                    aria-label={t("ui.bigCheese.kits.editLabel", { name: kit.name })}
                    onClick={() => setEditing(kit.id)}
                  >
                    {t("ui.bigCheese.kits.edit")}
                  </button>
                </li>
              ))}
            </ul>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importFile(file);
              }}
            />
            <button type="button" className="bc-btn" disabled={busy} onClick={() => fileInput.current?.click()}>
              {t("ui.bigCheese.kits.import")}
            </button>
            {kitNote && <p role="status">{kitNote}</p>}
            {kitReasons && <p role="alert">{kitReasons}</p>}
          </section>
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
