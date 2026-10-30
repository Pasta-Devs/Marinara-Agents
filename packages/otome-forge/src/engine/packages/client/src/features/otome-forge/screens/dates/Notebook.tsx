// ──────────────────────────────────────────────
// Otome Hearth: a love interest's notebook (#1945). What they have come to know about the protagonist through Read Me,
// grouped by what each thing is about (SH/read-me.ts NOTEBOOK_CATEGORIES, in that order; newest last within a group):
// their guess, the player's verdict in words (never an icon alone), and the player's own words when there are any.
// ──────────────────────────────────────────────
// Routes (S/routes/read-me.ts): GET /runs/:run/lis/:li/notebook → NotebookView; POST the same path {action:"edit", id,
// words} ("" clears the words) or {action:"delete", id} → NotebookView. Words the server refuses (they sound like health
// or the body: SH/home.ts soundsMedical) answer 400 and save nothing; that is said beside the field, which keeps them.
// The notebook is that love interest's alone and is never story memory, so Delete (after a confirm) is final. Nothing
// here reads the period tracker. Focus: Edit moves it into the field; Save and Cancel back to that entry's Edit; a
// delete to the notebook's heading; what happened goes to a polite live region.
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CircleCheck,
  CircleDot,
  CircleX,
  NotebookPen,
  PencilLine,
  RotateCcw,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { otomeErrorCode, useOtomeApi } from "../../api";
import { Dialog } from "../../components/Dialog";
import { runPath } from "../../hooks/use-reader";
import { accentOf } from "../../lib/accent";
import type { RunLiView } from "../../shared/api-types";
import {
  NOTEBOOK_CATEGORIES,
  READ_ME_WORDS_MAX,
  type NotebookCategory,
  type NotebookEntry,
  type NotebookView,
  type ReadMeVerdict,
} from "../../shared/read-me";

export const notebookQueryKey = (runKey: string, li: string) => ["otome-forge", "notebook", runKey, li] as const;

// Literal keys, so the locale validator sees each one. A guess's category, and the notebook's section for it.
export const CATEGORY_KEYS: Record<NotebookCategory, string> = {
  likes: "ui.otomeForge.readMe.categoryLikes",
  dislikes: "ui.otomeForge.readMe.categoryDislikes",
  habits: "ui.otomeForge.readMe.categoryHabits",
  fears: "ui.otomeForge.readMe.categoryFears",
  dreams: "ui.otomeForge.readMe.categoryDreams",
  other: "ui.otomeForge.readMe.categoryOther",
};

/** Spot on, Close, Not at all: the verdict's words, shared with Read Me's buttons. */
export const VERDICT_KEYS: Record<ReadMeVerdict, string> = {
  right: "ui.otomeForge.readMe.verdictRight",
  close: "ui.otomeForge.readMe.verdictClose",
  wrong: "ui.otomeForge.readMe.verdictWrong",
};

export const VERDICT_ICONS: Record<ReadMeVerdict, LucideIcon> = {
  right: CircleCheck,
  close: CircleDot,
  wrong: CircleX,
};

/** A failed answer or edit: refused words (400) said as such, anything else as the route's code says it. */
export function wordsErrorMessage(
  otome: ReturnType<typeof useOtomeApi>,
  t: (key: string) => string,
  error: unknown,
): string {
  return otomeErrorCode(error) === "bad-request" ? t("ui.otomeForge.readMe.wordsRefused") : otome.errorMessage(error);
}

type FocusTarget = { kind: "field" } | { kind: "heading" } | { kind: "edit"; id: string };

/** `li`'s notebook: Read Me's intro opens it, and its result shows it with what the set just added. */
export function Notebook({ runKey, li }: { runKey: string; li: RunLiView }) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const id = useId();
  const name = li.name;
  const key = notebookQueryKey(runKey, li.id);
  const path = `${runPath(runKey)}/lis/${encodeURIComponent(li.id)}/notebook`;
  const notebook = useQuery({ queryKey: key, queryFn: () => otome.get<NotebookView>(path) });
  // One entry is edited, or one asked about deleting, at a time; `error` belongs to whichever is open.
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [removing, setRemoving] = useState<NotebookEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  const pendingFocus = useRef<FocusTarget | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const editRefs = useRef(new Map<string, HTMLButtonElement>());
  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    const element =
      target.kind === "field"
        ? fieldRef.current
        : target.kind === "edit"
          ? (editRefs.current.get(target.id) ?? headingRef.current)
          : headingRef.current;
    if (!element) return;
    pendingFocus.current = null;
    element.focus({ preventScroll: true });
    element.scrollIntoView({ block: "nearest" });
  });

  const send = async (body: { action: "edit"; id: string; words: string } | { action: "delete"; id: string }) => {
    const next = await otome.post<NotebookView>(path, body);
    queryClient.setQueryData(key, next);
  };

  /** An entry gone meanwhile (another tab deleted it): said in the live region, and the notebook read again. */
  const gone = (failure: unknown) => {
    setEditing(null);
    setRemoving(null);
    setError(null);
    setStatus(otome.errorMessage(failure));
    pendingFocus.current = { kind: "heading" };
    void notebook.refetch();
  };

  const edit = (entry: NotebookEntry) => {
    setEditing(entry.id);
    setDraft(entry.words ?? "");
    setError(null);
    setStatus("");
    pendingFocus.current = { kind: "field" };
  };

  const cancel = (entry: NotebookEntry) => {
    if (busy) return;
    setEditing(null);
    setError(null);
    pendingFocus.current = { kind: "edit", id: entry.id };
  };

  const save = async (entry: NotebookEntry) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await send({ action: "edit", id: entry.id, words: draft.trim() });
      setEditing(null);
      setStatus(t("ui.otomeForge.readMe.notebookSaved"));
      pendingFocus.current = { kind: "edit", id: entry.id };
    } catch (failure) {
      if (otomeErrorCode(failure) === "not-found") gone(failure);
      else setError(wordsErrorMessage(otome, t, failure));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (entry: NotebookEntry) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await send({ action: "delete", id: entry.id });
      setRemoving(null);
      setStatus(t("ui.otomeForge.readMe.notebookDeleted", { name }));
      // Its buttons went with it.
      pendingFocus.current = { kind: "heading" };
    } catch (failure) {
      if (otomeErrorCode(failure) === "not-found") gone(failure);
      else setError(otome.errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  const entries = notebook.data?.entries ?? [];
  const groups = NOTEBOOK_CATEGORIES.map((category) => ({
    category,
    entries: entries.filter((entry) => entry.category === category),
  })).filter((group) => group.entries.length > 0);
  const fieldId = `${id}-words`;
  const errorId = `${id}-error`;

  return (
    <section
      className="of-section of-glass of-rm-notebook"
      aria-labelledby={`${id}-title`}
      style={{ "--of-li-accent": accentOf(li) } as CSSProperties}
    >
      <h2 id={`${id}-title`} ref={headingRef} className="of-section-title of-rm-notebook-title" tabIndex={-1}>
        <NotebookPen size={18} strokeWidth={1.8} aria-hidden="true" />
        <span>{t("ui.otomeForge.readMe.notebookTitle", { name })}</span>
      </h2>
      <p className="of-hint">{t("ui.otomeForge.readMe.notebookHint", { name })}</p>
      {notebook.data ? (
        groups.length ? (
          groups.map((group) => (
            <section key={group.category} className="of-rm-group" aria-labelledby={`${id}-${group.category}`}>
              <h3 id={`${id}-${group.category}`} className="of-rm-group-title">
                {t(CATEGORY_KEYS[group.category])}
              </h3>
              <ul className="of-rm-entries">
                {group.entries.map((entry) => {
                  const Mark = VERDICT_ICONS[entry.verdict];
                  const open = editing === entry.id;
                  return (
                    <li key={entry.id} className="of-rm-entry" data-verdict={entry.verdict}>
                      <p className="of-rm-entry-text">{entry.text}</p>
                      <p className="of-rm-mark" data-verdict={entry.verdict}>
                        <Mark size={13} strokeWidth={2.2} aria-hidden="true" />
                        <span>{t(VERDICT_KEYS[entry.verdict])}</span>
                      </p>
                      {entry.words && !open ? (
                        <p className="of-rm-said">{t("ui.otomeForge.readMe.youSaid", { words: entry.words })}</p>
                      ) : null}
                      {open ? (
                        <form
                          className="of-rm-edit"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void save(entry);
                          }}
                        >
                          <div className="of-field">
                            <label className="of-label" htmlFor={fieldId}>
                              {t("ui.otomeForge.readMe.notebookWordsLabel")}
                            </label>
                            <textarea
                              ref={fieldRef}
                              id={fieldId}
                              className="of-input of-textarea"
                              rows={2}
                              value={draft}
                              maxLength={READ_ME_WORDS_MAX}
                              aria-invalid={error ? true : undefined}
                              aria-describedby={error ? `${fieldId}-hint ${errorId}` : `${fieldId}-hint`}
                              onChange={(event) => setDraft(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key !== "Escape") return;
                                event.stopPropagation();
                                cancel(entry);
                              }}
                            />
                            <p id={`${fieldId}-hint`} className="of-field-hint">
                              <span>{t("ui.otomeForge.readMe.notebookWordsHint", { name })}</span>
                              <span className="of-counter">
                                {draft.length} / {READ_ME_WORDS_MAX}
                              </span>
                            </p>
                          </div>
                          {error ? (
                            <p id={errorId} className="of-notice of-notice--error" role="alert">
                              {error}
                            </p>
                          ) : null}
                          <div className="of-inline-actions">
                            <button
                              type="button"
                              className="of-button of-button--quiet of-glass of-button--small"
                              onClick={() => cancel(entry)}
                            >
                              {t("ui.otomeForge.readMe.notebookCancel")}
                            </button>
                            <button
                              type="submit"
                              className="of-button of-button--primary of-button--small"
                              aria-disabled={busy}
                            >
                              {t("ui.otomeForge.readMe.notebookSave")}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="of-inline-actions">
                          <button
                            ref={(element) => {
                              if (element) editRefs.current.set(entry.id, element);
                              else editRefs.current.delete(entry.id);
                            }}
                            type="button"
                            className="of-button of-button--quiet of-glass of-button--small"
                            aria-label={t("ui.otomeForge.readMe.notebookEditLabel", { text: entry.text })}
                            onClick={() => edit(entry)}
                          >
                            <PencilLine size={14} strokeWidth={2} aria-hidden="true" />
                            {t("ui.otomeForge.readMe.notebookEdit")}
                          </button>
                          <button
                            type="button"
                            className="of-button of-button--text of-button--small"
                            aria-label={t("ui.otomeForge.readMe.notebookDeleteLabel", { text: entry.text })}
                            onClick={() => {
                              setError(null);
                              setRemoving(entry);
                            }}
                          >
                            <Trash2 size={14} strokeWidth={2} aria-hidden="true" />
                            {t("ui.otomeForge.readMe.notebookDelete")}
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        ) : (
          <p className="of-empty">{t("ui.otomeForge.readMe.notebookEmpty", { name })}</p>
        )
      ) : notebook.isError ? (
        <div className="of-inline-actions" role="alert">
          <p className="of-hint">{otome.errorMessage(notebook.error, "ui.otomeForge.readMe.notebookLoadFailed")}</p>
          <button
            type="button"
            className="of-button of-button--quiet of-glass of-button--small"
            onClick={() => void notebook.refetch()}
          >
            <RotateCcw size={14} strokeWidth={2} aria-hidden="true" />
            {t("ui.otomeForge.common.retry")}
          </button>
        </div>
      ) : (
        <p className="of-hint" role="status">
          {t("ui.otomeForge.common.loading")}
        </p>
      )}
      <p className="of-live" role="status" aria-live="polite">
        {status}
      </p>
      {removing ? (
        <Dialog
          title={t("ui.otomeForge.readMe.notebookDeleteTitle", { name })}
          onClose={busy ? undefined : () => setRemoving(null)}
          describedBy={`${id}-delete-text`}
          actions={
            <>
              <button
                type="button"
                className="of-button of-button--quiet of-glass"
                aria-disabled={busy}
                onClick={() => {
                  if (!busy) setRemoving(null);
                }}
              >
                {t("ui.otomeForge.readMe.notebookDeleteKeep")}
              </button>
              <button
                type="button"
                className="of-button of-button--danger"
                aria-disabled={busy}
                onClick={() => void remove(removing)}
              >
                <Trash2 size={16} strokeWidth={2} aria-hidden="true" />
                {t("ui.otomeForge.readMe.notebookDeleteConfirm")}
              </button>
            </>
          }
        >
          <p className="of-body of-rm-quote">{removing.text}</p>
          <p id={`${id}-delete-text`} className="of-hint">
            {t("ui.otomeForge.readMe.notebookDeleteText", { name })}
          </p>
          {error ? (
            <p className="of-notice of-notice--error" role="alert">
              {error}
            </p>
          ) : null}
        </Dialog>
      ) : null}
    </section>
  );
}
