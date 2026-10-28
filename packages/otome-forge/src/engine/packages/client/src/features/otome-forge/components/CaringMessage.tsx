// ──────────────────────────────────────────────
// Otome Forge: the caring message, on a day the period tracker has something to say (plan M6). Pressing Caring
// message on Home asks for today's note once; it is kept only in this browser (`otome-forge:care-note:v1`) until the
// day changes, voiced in their voice through the story's audio (M2b) with no cache key, and never quoted into a Reply.
// ──────────────────────────────────────────────
// What leaves the browser: at most the one templated line about today (C/lib/cycle.ts careLine), and only from this
// press. The tracker is read again as the request starts, so a change made in another tab since Home drew the button
// (Keep it off the model, the tracker turned off, Delete all) is what counts. "Keep it off the model", or the Engine's
// debug mode, sends nothing at all: one of their comfort lines answers (written in advance, like Rough day?). The
// server sends a comfort line too whenever it could log the request (DEBUG_AGENTS or a debug log level), and stores
// nothing. A note is kept only for the day and the state it answers, and only while the tracker is still on.
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Feather, Heart, Play, RotateCcw, Square } from "lucide-react";
import { useOtomeApi } from "../api";
import { runPath } from "../hooks/use-reader";
import { accentOf } from "../lib/accent";
import { careLine, careSpeakOptions, careStateKey, cycleToday, type CycleToday } from "../lib/cycle";
import {
  careNoteKey,
  deletionCount,
  readCareNote,
  readCycle,
  writeCareNote,
  type CareNoteEntry,
} from "../lib/cycle-storage";
import { comfortPool, FALLBACK_COMFORT_KEYS, localDay, pickLine } from "../lib/tap-mood";
import { useOtomeProps } from "../props";
import { useLineVoice } from "../screens/home/NoteCard";
import type { CareNoteResult, LinesView, Player, RunLiView, Segment } from "../shared/api-types";
import { Avatar } from "./Avatar";
import { Dialog } from "./Dialog";

/** One request per local day, love interest and state on this page, while it is in flight (a second press joins it). */
const inFlight = new Map<string, Promise<CareNoteEntry>>();

type CareState = { kind: "ready"; entry: CareNoteEntry } | { kind: "writing" } | { kind: "failed"; error: unknown };

interface CaringMessageProps {
  runKey: string;
  li: RunLiView;
  player: Pick<Player, "name" | "pronouns">;
  /** What the tracker said about today as Home drew the button (never null: it shows only then). */
  today: CycleToday;
  /** The local day, "YYYY-MM-DD", in the conversation's time zone. */
  dayKey: string;
  /** His lines (for his comfort lines); null until they load, when the catalog's stand in. */
  lines: LinesView | null;
  onClose: () => void;
}

export function CaringMessage({ runKey, li, player, today, dayKey, lines, onClose }: CaringMessageProps) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const { debugMode, timeZone } = useOtomeProps();
  const voice = useLineVoice();
  const key = careNoteKey(runKey, li.id);
  const [state, setState] = useState<CareState>(() => {
    // A note kept for another state of the day (due, then a start logged) no longer answers it.
    // A comfort line kept for a mode that is off now (Keep it off the model, debug mode) is asked for again.
    const kept = readCareNote(dayKey, key);
    const holds =
      kept?.reason === "kept-off" ? readCycle().mode === "keep-off-model" : kept?.reason === "debug" ? debugMode : true;
    return kept && holds && kept.state === careStateKey(today) ? { kind: "ready", entry: kept } : { kind: "writing" };
  });
  const [attempt, setAttempt] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lineId = useId();
  const accent = accentOf(li);

  useEffect(() => {
    if (state.kind !== "writing") return;
    let live = true;
    const requestKey = `${dayKey} ${key} ${careStateKey(today)}`;
    let request = inFlight.get(requestKey);
    if (!request) {
      const since = deletionCount();
      request = (async (): Promise<CareNoteEntry> => {
        const at = new Date().toISOString();
        // The tracker as this browser holds it now, not as Home read it.
        const stored = readCycle();
        const now = cycleToday(stored, dayKey);
        /** One of their comfort lines, else the catalog's: written in advance, nothing sent. */
        const comfort = (reason?: CareNoteEntry["reason"]): CareNoteEntry => {
          const own = comfortPool(lines);
          const pool = own.length ? own : FALLBACK_COMFORT_KEYS.map((line) => t(line));
          const text = pickLine(pool, null) ?? "";
          return { text, source: "pool", ...(reason ? { reason } : {}), state: now ? careStateKey(now) : "", at };
        };
        let entry: CareNoteEntry;
        if (!now) {
          // Turned off, or deleted, in another tab since: nothing is sent (and Home closes this as it hears of it).
          entry = comfort();
        } else if (stored.mode === "keep-off-model" || debugMode) {
          // Nothing about the day leaves this browser: the stricter mode, or the Engine's debug mode (which logs).
          entry = comfort(stored.mode === "keep-off-model" ? "kept-off" : "debug");
        } else {
          const answer = await otome.post<CareNoteResult>(`${runPath(runKey)}/care-note`, {
            li: li.id,
            careLine: careLine(now, player),
          });
          const note = typeof answer?.note === "string" ? answer.note.trim() : "";
          // No note: the server answered from their comfort lines, which aren't written yet.
          entry = note
            ? { text: note, source: answer.source === "model" ? "model" : "pool", state: careStateKey(now), at }
            : comfort();
        }
        // Kept only while it still belongs: no Delete all on this page or another (the cycle key gone turns the
        // tracker off), and still the day it was asked for (one that lands after midnight is not kept for yesterday).
        const keep =
          !!now && deletionCount() === since && readCycle().enabled && localDay(timeZone, new Date()) === dayKey;
        if (keep) writeCareNote(dayKey, key, entry);
        return entry;
      })();
      inFlight.set(requestKey, request);
      void request.then(
        () => inFlight.delete(requestKey),
        () => inFlight.delete(requestKey),
      );
    }
    request.then(
      (entry) => {
        if (live) setState({ kind: "ready", entry });
      },
      (error: unknown) => {
        if (live) setState({ kind: "failed", error });
      },
    );
    return () => {
      live = false;
    };
    // Once per press (and per Try again): the line, mode and lines are read as it is asked for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // The line's ref while it plays; with no cache key it never names a clip in the Engine's audio cache.
  const voiceId = `care:${li.id}`;
  const playing = voice.active === voiceId;
  const entry = state.kind === "ready" ? state.entry : null;
  const said: Segment | null = entry ? { speaker: li.name, text: entry.text } : null;
  // Said as it happened: the server may answer with a comfort line too (debug logging on the server, no bible yet).
  const sourceHint = !entry
    ? null
    : entry.source === "model"
      ? t("ui.otomeForge.tracker.careFromModel")
      : entry.reason === "kept-off"
        ? t("ui.otomeForge.tracker.careKeptOff", { name: li.name })
        : entry.reason === "debug"
          ? t("ui.otomeForge.tracker.careDebug", { name: li.name })
          : t("ui.otomeForge.tracker.careComfort", { name: li.name });

  return (
    <Dialog
      title={t("ui.otomeForge.tracker.careTitle")}
      describedBy={lineId}
      onClose={onClose}
      actions={
        <>
          {said && voice.can(said) ? (
            <button
              type="button"
              className="of-button of-button--quiet of-button--small of-glass"
              aria-pressed={playing}
              aria-label={t("ui.otomeForge.tracker.carePlayLabel", { name: li.name })}
              onClick={() => voice.toggle(voiceId, said, careSpeakOptions())}
            >
              {playing ? (
                <Square size={14} strokeWidth={2.4} aria-hidden="true" />
              ) : (
                <Play size={14} strokeWidth={2.4} aria-hidden="true" />
              )}
              {playing ? t("ui.otomeForge.home.stop") : t("ui.otomeForge.home.play")}
            </button>
          ) : null}
          {state.kind === "failed" ? (
            <button
              type="button"
              className="of-button of-button--quiet of-button--small of-glass"
              onClick={() => {
                // The button leaves with the failure: focus waits on Close.
                closeRef.current?.focus();
                setState({ kind: "writing" });
                setAttempt((value) => value + 1);
              }}
            >
              <RotateCcw size={14} strokeWidth={2.2} aria-hidden="true" />
              {t("ui.otomeForge.common.retry")}
            </button>
          ) : null}
          <button
            ref={closeRef}
            type="button"
            className="of-button of-button--primary of-button--small"
            onClick={onClose}
          >
            {t("ui.otomeForge.home.close")}
          </button>
        </>
      }
    >
      <figure className="of-comfort of-care" style={{ "--of-li-accent": accent } as CSSProperties}>
        <span className="of-care-seal" aria-hidden="true">
          <Avatar name={li.name} url={li.portrait} accent={accent} size={56} />
          <Heart className="of-care-heart" size={18} strokeWidth={0} fill="currentColor" />
        </span>
        <div id={lineId} className="of-care-body" aria-live="polite">
          {state.kind === "ready" ? (
            <blockquote className="of-comfort-line">
              {t("ui.otomeForge.home.noteText", { text: state.entry.text })}
            </blockquote>
          ) : state.kind === "writing" ? (
            <p className="of-care-writing" role="status">
              <Feather className="of-note-quill" size={16} strokeWidth={1.8} aria-hidden="true" />
              {t("ui.otomeForge.tracker.careWriting", { name: li.name })}
            </p>
          ) : (
            <div className="of-notice of-notice--error" role="alert">
              <span>{otome.errorMessage(state.error, "ui.otomeForge.tracker.careFailed")}</span>
            </div>
          )}
        </div>
        {entry ? (
          <figcaption className="of-comfort-by">{t("ui.otomeForge.home.comfortBy", { name: li.name })}</figcaption>
        ) : null}
      </figure>
      {sourceHint ? <p className="of-hint of-care-source">{sourceHint}</p> : null}
      {/* Always there, so a failure is announced as it is filled in. */}
      <div className="of-live" role="status" aria-live="polite">
        {voice.failed === voiceId ? <p className="of-hint">{t("ui.otomeForge.home.voiceFailed")}</p> : null}
      </div>
    </Dialog>
  );
}
