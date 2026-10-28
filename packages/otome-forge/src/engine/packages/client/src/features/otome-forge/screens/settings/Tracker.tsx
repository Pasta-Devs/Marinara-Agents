// ──────────────────────────────────────────────
// Otome Forge Settings → Tracker: the period tracker, for anyone who has periods (plan M6). Off by default, kept only
// in this browser, with what reaches the model said plainly, an export to move it, and one-click Delete all.
// ──────────────────────────────────────────────
// The tracker belongs to this device, not to a story: nothing here is saved to a package document. Every change is made
// to the tracker as stored now and the screen follows other tabs (C/screens/home/HomeScreen.tsx useCycle), so a Delete
// all or a mode chosen elsewhere is never overwritten. Its copy is the agreed wording, word for word
// (ui.otomeForge.tracker.enable, .stored, .sendTodayText).
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { Download, Flower2, HandHeart, Heart, ShieldCheck, Trash2, Upload, X } from "lucide-react";
import { useConnections } from "../../hooks/use-engine-resources";
import {
  CYCLE_LENGTH,
  cycleToday,
  isDayKey,
  logStart,
  PERIOD_LENGTH,
  removeStart,
  type CycleData,
  type CycleMode,
} from "../../lib/cycle";
import {
  deleteAllCycleData,
  deletionCount,
  exportCycle,
  exportFileName,
  IMPORT_BYTES_MAX,
  importCycle,
} from "../../lib/cycle-storage";
import { localDay } from "../../lib/tap-mood";
import { useOtomeProps } from "../../props";
import type { RunView } from "../../shared/api-types";
import { useCycle, useMinute } from "../home/HomeScreen";
import { cycleTodayText } from "../remind/RemindMe";
import { ChoiceCards, Section, Switch, type Choice } from "../setup/parts";

/** The logged first days listed, newest first. */
const RECENT_STARTS = 6;

type Status = { error: boolean; text: string } | null;
/** Where a status shows: beside what was just done. */
type StatusAt = "switch" | "today" | "cycle" | "mode" | "data";

/** One click: the tracker and every caring message leave this browser. Settings → Privacy & data shows it too. */
export function DeleteCycleData({ onDeleted }: { onDeleted?: () => void }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status>(null);
  return (
    <div className="of-delete-cycle">
      <button
        type="button"
        className="of-button of-button--danger of-button--small"
        onClick={() => {
          const deleted = deleteAllCycleData();
          setStatus(
            deleted
              ? { error: false, text: t("ui.otomeForge.tracker.deleted") }
              : { error: true, text: t("ui.otomeForge.tracker.deleteBlocked") },
          );
          onDeleted?.();
        }}
      >
        <Trash2 size={15} strokeWidth={2} aria-hidden="true" />
        {t("ui.otomeForge.tracker.deleteAll")}
      </button>
      <div className="of-live" role="status" aria-live="polite">
        {status ? <p className={status.error ? "of-notice of-notice--error" : "of-hint"}>{status.text}</p> : null}
      </div>
    </div>
  );
}

export function TrackerSettings({ run }: { run: RunView | null }) {
  const { t, i18n } = useTranslation();
  const { timeZone } = useOtomeProps();
  const connections = useConnections();
  const language = i18n.resolvedLanguage ?? "en";
  const today = localDay(timeZone, new Date(useMinute()));
  const { cycle, update, reload } = useCycle();
  const [status, setStatusState] = useState<{ at: StatusAt; status: Status }>({ at: "switch", status: null });
  const setStatus = (at: StatusAt, next: Status) => setStatusState({ at, status: next });
  const statusIn = (at: StatusAt) => (
    <div className="of-live" role="status" aria-live="polite">
      {status.at === at && status.status ? (
        <p className={status.status.error ? "of-notice of-notice--error" : "of-hint"}>{status.status.text}</p>
      ) : null}
    </div>
  );
  const [another, setAnother] = useState("");
  const addRef = useRef<HTMLButtonElement>(null);
  const removeRefs = useRef<Array<HTMLButtonElement | null>>([]);
  // A removed start takes its button with it: focus moves to the next one (or the last, or Add).
  const refocus = useRef<number | null>(null);
  useEffect(() => {
    if (refocus.current === null) return;
    const at = refocus.current;
    refocus.current = null;
    const buttons = removeRefs.current.filter(Boolean);
    (buttons[Math.min(at, buttons.length - 1)] ?? addRef.current)?.focus();
  }, [cycle.starts]);

  /** Applies `change` to the tracker as stored now (another tab may have changed it) and says how it went. */
  const save = (at: StatusAt, change: (data: CycleData) => CycleData, done?: string) => {
    setStatus(
      at,
      update(change)
        ? done
          ? { error: false, text: done }
          : null
        : { error: true, text: t("ui.otomeForge.tracker.notKept") },
    );
  };

  const formatDay = (dayKey: string) =>
    new Intl.DateTimeFormat(language, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${dayKey}T00:00:00Z`));

  // The care note uses the story's chat connection, else its story connection.
  const careConnectionId = run ? (run.world.connections.chat ?? run.world.connections.narration) : "";
  const careConnection =
    connections.text.find((connection) => connection.id === careConnectionId)?.name ??
    t("ui.otomeForge.tracker.connectionUnknown");
  const modes: readonly Choice<CycleMode>[] = [
    {
      value: "send-today",
      title: t("ui.otomeForge.tracker.sendToday"),
      description: t("ui.otomeForge.tracker.sendTodayText", { connection: careConnection }),
      Icon: HandHeart,
    },
    {
      value: "keep-off-model",
      title: t("ui.otomeForge.tracker.keepOff"),
      description: t("ui.otomeForge.tracker.keepOffText"),
      Icon: ShieldCheck,
    },
  ];

  const recent = [...cycle.starts].reverse().slice(0, RECENT_STARTS);
  const startedToday = cycle.starts.includes(today);
  const anotherValid = isDayKey(another) && another <= today && !cycle.starts.includes(another);

  const onImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > IMPORT_BYTES_MAX) {
      setStatus("data", { error: true, text: t("ui.otomeForge.tracker.importNotCycle") });
      return;
    }
    const since = deletionCount();
    let read;
    try {
      const text = await file.text();
      read = importCycle(text, cycle);
    } catch {
      read = { ok: false as const, reason: "unreadable" as const };
    }
    // "Delete all cycle data" while the file was being read: nothing comes back.
    if (deletionCount() !== since) return;
    if (!read.ok) {
      setStatus("data", {
        error: true,
        text:
          read.reason === "unreadable"
            ? t("ui.otomeForge.tracker.importUnreadable")
            : t("ui.otomeForge.tracker.importNotCycle"),
      });
      return;
    }
    // The file's lengths and starts; the on switch and the mode stay as they are now (an import never loosens them).
    const imported = read.data;
    save(
      "data",
      (data) => ({ ...imported, enabled: data.enabled, mode: data.mode }),
      t("ui.otomeForge.tracker.imported", { count: imported.starts.length }),
    );
  };

  const onExport = () => {
    try {
      const url = URL.createObjectURL(new Blob([exportCycle(cycle)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = exportFileName(today);
      link.rel = "noopener";
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1_000);
      setStatus("data", { error: false, text: t("ui.otomeForge.tracker.exported") });
    } catch (error) {
      console.warn("Otome Forge could not export the tracker", error);
      setStatus("data", { error: true, text: t("ui.otomeForge.tracker.exportFailed") });
    }
  };

  const lengthOptions = (range: { min: number; max: number }) =>
    Array.from({ length: range.max - range.min + 1 }, (_, index) => range.min + index);

  return (
    <div className="of-step-body of-tracker">
      <Section title={t("ui.otomeForge.tracker.title")}>
        <Switch
          label={t("ui.otomeForge.tracker.enable")}
          hint={
            <>
              <span className="of-tracker-line">{t("ui.otomeForge.tracker.stored")}</span>
              <span className="of-tracker-line">{t("ui.otomeForge.tracker.selfReported")}</span>
            </>
          }
          checked={cycle.enabled}
          onChange={(enabled) => save("switch", (data) => ({ ...data, enabled }))}
        />
        {!cycle.enabled && cycle.starts.length ? (
          <p className="of-hint">{t("ui.otomeForge.tracker.offKept", { count: cycle.starts.length })}</p>
        ) : null}
        {statusIn("switch")}
      </Section>

      {cycle.enabled ? (
        <>
          <Section title={t("ui.otomeForge.tracker.todayTitle")}>
            <p className="of-cycle-today" data-state={cycleToday(cycle, today)?.kind ?? "none"}>
              <Flower2 size={17} strokeWidth={1.9} aria-hidden="true" />
              {cycleTodayText(t, cycleToday(cycle, today))}
            </p>
            {/* One button either way, so focus stays on it. */}
            <button
              type="button"
              className={
                startedToday
                  ? "of-button of-button--quiet of-button--small of-glass"
                  : "of-button of-button--primary of-button--small"
              }
              onClick={() =>
                startedToday
                  ? save("today", (data) => removeStart(data, today), t("ui.otomeForge.tracker.unloggedToday"))
                  : save("today", (data) => logStart(data, today, today), t("ui.otomeForge.tracker.loggedToday"))
              }
            >
              <Heart size={14} strokeWidth={2.2} fill={startedToday ? "none" : "currentColor"} aria-hidden="true" />
              {startedToday ? t("ui.otomeForge.tracker.undoToday") : t("ui.otomeForge.tracker.startedToday")}
            </button>
            <div className="of-field">
              <label className="of-label" htmlFor="of-tracker-another">
                {t("ui.otomeForge.tracker.anotherDay")}
              </label>
              <div className="of-select-row">
                <input
                  id="of-tracker-another"
                  className="of-input"
                  type="date"
                  max={today}
                  value={another}
                  aria-describedby="of-tracker-another-hint"
                  onChange={(event) => setAnother(event.target.value)}
                />
                <button
                  ref={addRef}
                  type="button"
                  className="of-button of-button--quiet of-button--small of-glass"
                  aria-disabled={!anotherValid}
                  onClick={() => {
                    if (!anotherValid) return;
                    const day = another;
                    save(
                      "today",
                      (data) => logStart(data, day, today),
                      t("ui.otomeForge.tracker.loggedDay", { day: formatDay(day) }),
                    );
                    setAnother("");
                  }}
                >
                  {t("ui.otomeForge.tracker.add")}
                </button>
              </div>
              <p id="of-tracker-another-hint" className="of-field-hint">
                <span>{t("ui.otomeForge.tracker.anotherDayHint")}</span>
              </p>
            </div>
            {recent.length ? (
              <>
                <h4 className="of-legend of-legend--small">
                  {t("ui.otomeForge.tracker.startsLogged", { count: cycle.starts.length })}
                </h4>
                <ul className="of-starts">
                  {recent.map((start, index) => (
                    <li key={start}>
                      <Heart size={13} strokeWidth={2.2} fill="currentColor" aria-hidden="true" />
                      <span>{formatDay(start)}</span>
                      <button
                        ref={(element) => {
                          removeRefs.current[index] = element;
                        }}
                        type="button"
                        className="of-icon-button of-starts-remove"
                        aria-label={t("ui.otomeForge.tracker.removeStart", { day: formatDay(start) })}
                        title={t("ui.otomeForge.tracker.removeStart", { day: formatDay(start) })}
                        onClick={() => {
                          refocus.current = index;
                          save("today", (data) => removeStart(data, start));
                        }}
                      >
                        <X size={15} strokeWidth={2.2} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {statusIn("today")}
          </Section>

          <Section title={t("ui.otomeForge.tracker.cycleTitle")}>
            <div className="of-tracker-lengths">
              <div className="of-field">
                <label className="of-label" htmlFor="of-tracker-cycle">
                  {t("ui.otomeForge.tracker.cycleLength")}
                </label>
                <select
                  id="of-tracker-cycle"
                  className="of-input of-select"
                  value={cycle.cycleLength}
                  onChange={(event) => {
                    const cycleLength = Number(event.target.value);
                    save("cycle", (data) => ({ ...data, cycleLength }));
                  }}
                >
                  {lengthOptions(CYCLE_LENGTH).map((days) => (
                    <option key={days} value={days}>
                      {t("ui.otomeForge.tracker.days", { count: days })}
                    </option>
                  ))}
                </select>
              </div>
              <div className="of-field">
                <label className="of-label" htmlFor="of-tracker-period">
                  {t("ui.otomeForge.tracker.periodLength")}
                </label>
                <select
                  id="of-tracker-period"
                  className="of-input of-select"
                  value={cycle.periodLength}
                  onChange={(event) => {
                    const periodLength = Number(event.target.value);
                    save("cycle", (data) => ({ ...data, periodLength }));
                  }}
                >
                  {lengthOptions(PERIOD_LENGTH).map((days) => (
                    <option key={days} value={days}>
                      {t("ui.otomeForge.tracker.days", { count: days })}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <Switch
              label={t("ui.otomeForge.tracker.irregular")}
              hint={t("ui.otomeForge.tracker.irregularHint")}
              checked={cycle.irregular}
              onChange={(irregular) => save("cycle", (data) => ({ ...data, irregular }))}
            />
            {statusIn("cycle")}
          </Section>

          <Section title={t("ui.otomeForge.tracker.modelTitle")}>
            <ChoiceCards
              legend={t("ui.otomeForge.tracker.modeLegend")}
              value={cycle.mode}
              choices={modes}
              columns={1}
              onChange={(mode) => save("mode", (data) => ({ ...data, mode }))}
            />
            <p className="of-hint">{t("ui.otomeForge.tracker.whenSent")}</p>
            {statusIn("mode")}
          </Section>
        </>
      ) : null}

      <Section title={t("ui.otomeForge.tracker.dataTitle")} hint={t("ui.otomeForge.tracker.dataHint")}>
        {cycle.enabled ? (
          <div className="of-inline-actions">
            <button type="button" className="of-button of-button--quiet of-button--small of-glass" onClick={onExport}>
              <Download size={15} strokeWidth={2} aria-hidden="true" />
              {t("ui.otomeForge.tracker.export")}
            </button>
            <label className="of-button of-button--quiet of-button--small of-glass of-file-button">
              <input
                className="of-visually-hidden"
                type="file"
                accept="application/json,.json"
                onChange={(event) => void onImport(event)}
              />
              <Upload size={15} strokeWidth={2} aria-hidden="true" />
              {t("ui.otomeForge.tracker.import")}
            </label>
          </div>
        ) : null}
        {statusIn("data")}
        <DeleteCycleData
          onDeleted={() => {
            // What this screen held goes too, kept or not.
            reload();
            setStatus("data", null);
          }}
        />
      </Section>
    </div>
  );
}
