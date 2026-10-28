// ──────────────────────────────────────────────
// Otome Forge: the opening screen. The player's stories (open one, or delete it after typing its title) and the way
// into a new one. With no stories yet it is the title screen.
// ──────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { BookHeart, Heart, Sparkles, Trash } from "lucide-react";
import { useOtomeApi } from "../api";
import { Dialog } from "../components/Dialog";
import { INDEX_QUERY_KEY } from "../hooks/use-index";
import { useOtomeProps } from "../props";
import type { OtomeIndex, OtomeRunEntry } from "../shared/api-types";
import { hasDraft } from "./setup/draft";

interface WorldPickerProps {
  index: OtomeIndex;
  onNew: () => void;
  /** Opens a story (the caller activates it). */
  onOpen: (runKey: string) => void;
  /** The story being opened, while its request is in flight. */
  opening: string | null;
  /** Why the last story could not be opened. */
  error: string | null;
}

interface DeleteDialogProps {
  run: OtomeRunEntry;
  onClose: () => void;
  /** The run is gone, and the trash button that opened the dialog with it. */
  onDeleted: () => void;
}

function DeleteDialog({ run, onClose, onDeleted }: DeleteDialogProps) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const title = run.title.trim();
  const matches = typed.trim() === title;
  const remove = async () => {
    if (!matches || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { index } = await otome.post<{ index: OtomeIndex }>(`/runs/${encodeURIComponent(run.runKey)}/delete`, {
        confirmTitle: title,
      });
      queryClient.setQueryData(INDEX_QUERY_KEY, index);
      queryClient.removeQueries({ queryKey: ["otome-forge", "run", run.runKey] });
      onDeleted();
    } catch (failure) {
      setError(otome.errorMessage(failure));
      setBusy(false);
    }
  };
  return (
    <Dialog
      title={t("ui.otomeForge.setup.deleteTitle", { title: title || t("ui.otomeForge.setup.untitled") })}
      onClose={busy ? undefined : onClose}
      initialFocus={inputRef}
      actions={
        <>
          <button type="button" className="of-button of-button--quiet of-glass" onClick={onClose}>
            {t("ui.otomeForge.setup.deleteKeep")}
          </button>
          <button
            type="button"
            className="of-button of-button--danger"
            aria-disabled={!matches || busy}
            onClick={() => void remove()}
          >
            <Trash size={16} strokeWidth={2} aria-hidden="true" />
            {t("ui.otomeForge.setup.deleteConfirm")}
          </button>
        </>
      }
    >
      <p className="of-body">{t("ui.otomeForge.setup.deleteText")}</p>
      {title ? (
        <div className="of-field">
          <label className="of-label" htmlFor={`${run.runKey}-confirm`}>
            {t("ui.otomeForge.setup.deleteType", { title })}
          </label>
          <input
            ref={inputRef}
            id={`${run.runKey}-confirm`}
            className="of-input"
            value={typed}
            autoComplete="off"
            onChange={(event) => setTyped(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void remove();
            }}
          />
        </div>
      ) : null}
      {error ? (
        <p className="of-notice of-notice--error" role="alert">
          {error}
        </p>
      ) : null}
    </Dialog>
  );
}

export function WorldPicker({ index, onNew, onOpen, opening, error }: WorldPickerProps) {
  const { t } = useTranslation();
  const { locale } = useOtomeProps().localization;
  const [deleting, setDeleting] = useState<OtomeRunEntry | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // The dialog gives focus back to the trash button that opened it, which a delete removes: the heading takes it then.
  const deleted = useRef(false);
  useEffect(() => {
    if (deleting || !deleted.current) return;
    deleted.current = false;
    headingRef.current?.focus({ preventScroll: true });
  }, [deleting]);
  const draftWaiting = hasDraft();
  const runs = [...index.runs].sort((a, b) =>
    (b.lastPlayedAt ?? b.createdAt).localeCompare(a.lastPlayedAt ?? a.createdAt),
  );
  const date = (iso: string) => {
    const value = new Date(iso);
    return Number.isNaN(value.getTime()) ? "" : new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(value);
  };

  return (
    <div className={runs.length ? "of-page" : "of-center"}>
      <div className="of-page-head">
        <div className="of-emblem of-glass" aria-hidden="true">
          <Heart size={30} strokeWidth={1.6} />
        </div>
        <h1 ref={headingRef} className={runs.length ? "of-title" : "of-title of-title--hero"} tabIndex={-1}>
          {runs.length ? t("ui.otomeForge.common.screenPicker") : t("ui.otomeForge.common.title")}
        </h1>
        <p className="of-subtitle">{t("ui.otomeForge.common.tagline")}</p>
        <div className="of-ornament" aria-hidden="true">
          <Heart size={11} strokeWidth={0} fill="currentColor" />
        </div>
        {runs.length ? null : <p className="of-hand">{t("ui.otomeForge.common.taglineNote")}</p>}
      </div>

      <div className="of-actions">
        <button type="button" className="of-button of-button--primary" onClick={onNew}>
          <Sparkles size={17} strokeWidth={2} aria-hidden="true" />
          {draftWaiting ? t("ui.otomeForge.setup.continueDraft") : t("ui.otomeForge.setup.newStory")}
        </button>
      </div>

      <div className="of-live" role="alert">
        {error ? <p className="of-notice of-notice--error">{error}</p> : null}
      </div>
      {runs.length ? (
        <ul className="of-runs" aria-label={t("ui.otomeForge.common.screenPicker")}>
          {runs.map((run) => {
            const title = run.title.trim() || t("ui.otomeForge.setup.untitled");
            const current = run.runKey === index.activeRun;
            return (
              <li key={run.runKey} className="of-run of-glass" data-current={current}>
                <button
                  type="button"
                  className="of-run-open"
                  aria-disabled={opening !== null}
                  onClick={() => {
                    if (opening === null) onOpen(run.runKey);
                  }}
                >
                  <BookHeart className="of-run-icon" size={22} strokeWidth={1.6} aria-hidden="true" />
                  <span className="of-run-text">
                    <span className="of-run-title">{title}</span>
                    <span className="of-hint">
                      {run.lastPlayedAt
                        ? t("ui.otomeForge.setup.lastPlayed", { date: date(run.lastPlayedAt) })
                        : t("ui.otomeForge.setup.started", { date: date(run.createdAt) })}
                    </span>
                  </span>
                  {current ? <span className="of-badge of-badge--soft">{t("ui.otomeForge.setup.current")}</span> : null}
                  {opening === run.runKey ? (
                    <Heart className="of-pulse" size={16} strokeWidth={2} fill="currentColor" aria-hidden="true" />
                  ) : null}
                </button>
                <button
                  type="button"
                  className="of-icon-button of-run-delete"
                  aria-label={t("ui.otomeForge.setup.deleteStory", { title })}
                  title={t("ui.otomeForge.setup.deleteStory", { title })}
                  onClick={() => setDeleting(run)}
                >
                  <Trash size={16} strokeWidth={2} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {deleting ? (
        <DeleteDialog
          run={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            deleted.current = true;
            setDeleting(null);
          }}
        />
      ) : null}
    </div>
  );
}
