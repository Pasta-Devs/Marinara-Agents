// The one AI assist for text fields: "Write" when the field is empty, "Improve" when it has text, an
// optional short note, the answer straight into the field, and Undo until the player types again.
// Sits in the field's label row (a wrapping flex row); the note row opens under it at full width.
import { useId, useState } from "react";
import { Loader2, Undo2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import { SlpSparkleGlyph } from "../../base/chrome/SlpGlyphs";
import { SlpButton } from "../../modules/chrome/SlpButton";
import { noteSlpAiUseOnce, SlpUsesAiMark } from "../../modules/chrome/SlpAiMark";
import { errorMessage } from "../../modules/settings/slp-backstage-format";
import { SLP_ASSIST_NOTE_MAX, type SlpAssistField } from "../../../../../shared/src/slp/slp-actions.js";
import { runSlpAction } from "./slp-assist-hooks";

export type SlpTextAssistRun = (input: { mode: "write" | "improve"; note: string }) => Promise<string>;

const TRIGGER =
  "inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-semibold text-[var(--slurp-ink)] transition-colors hover:bg-[var(--slurp-tint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 motion-reduce:transition-none [&_svg]:!text-current";

export function SlpTextAssist({
  field,
  value,
  onApply,
  accountId,
  context,
  run,
  disabled = false,
  className,
}: {
  /** What the field is, for the action layer. Not needed with `run`. */
  field?: SlpAssistField;
  value: string;
  /** Receives the new text (and the old one on Undo). The field saves it the way it saves typing. */
  onApply: (text: string) => void;
  accountId?: string;
  context?: string;
  /** A field with its own writer (fan type voice, post guidance) passes it; the rest use the action layer. */
  run?: SlpTextAssistRun;
  disabled?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const noteId = useId();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ before: string; after: string } | null>(null);
  const mode = value.trim() ? "improve" : "write";

  const go = async () => {
    if (busy) return;
    noteSlpAiUseOnce(t);
    setBusy(true);
    setError(null);
    try {
      const trimmed = note.trim();
      const text = run
        ? await run({ mode, note: trimmed })
        : !field
          ? value
          : mode === "improve"
            ? (
                await runSlpAction("improve-text", {
                  field,
                  text: value,
                  accountId,
                  context,
                  note: trimmed || undefined,
                })
              ).text
            : (await runSlpAction("write-text", { field, accountId, context, note: trimmed || undefined })).text;
      setUndo({ before: value, after: text });
      onApply(text);
      setOpen(false);
      setNote("");
    } catch (failure) {
      setError(
        errorMessage(failure, t("ui.slurp.assist.failed", { defaultValue: "Could not write that. Try again." })),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <span className={cn("ms-auto inline-flex shrink-0 items-center", className)}>
        {undo && undo.after === value && !open && (
          <button
            type="button"
            className={TRIGGER}
            onClick={() => {
              onApply(undo.before);
              setUndo(null);
            }}
          >
            <Undo2 size={13} aria-hidden="true" />
            {t("ui.slurp.assist.undo", { defaultValue: "Undo" })}
          </button>
        )}
        <button
          type="button"
          data-slurp-assist={field ?? "own"}
          aria-expanded={open}
          aria-controls={open ? noteId : undefined}
          disabled={disabled}
          className={TRIGGER}
          onClick={() => {
            setError(null);
            setOpen((current) => !current);
          }}
        >
          <SlpSparkleGlyph size={13} aria-hidden="true" />
          {mode === "write"
            ? t("ui.slurp.assist.write", { defaultValue: "Write" })
            : t("ui.slurp.assist.improve", { defaultValue: "Improve" })}
        </button>
      </span>
      {open && (
        <div
          id={noteId}
          role="group"
          aria-label={t("ui.slurp.assist.title", { defaultValue: "Writing help" })}
          className="w-full basis-full space-y-1.5 rounded-xl bg-[var(--slurp-tint)] p-2"
        >
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              value={note}
              maxLength={SLP_ASSIST_NOTE_MAX}
              disabled={busy}
              aria-label={t("ui.slurp.assist.noteLabel", { defaultValue: "Note for Slurp" })}
              placeholder={
                mode === "write"
                  ? t("ui.slurp.assist.notePlaceholderWrite", { defaultValue: "What should it say? (optional)" })
                  : t("ui.slurp.assist.notePlaceholderImprove", { defaultValue: "What should change? (optional)" })
              }
              onChange={(event) => setNote(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void go();
                }
                if (event.key === "Escape") setOpen(false);
              }}
              className="h-10 min-w-0 flex-1 rounded-lg bg-[var(--slurp-surface-raised)] px-3 text-base text-[var(--slurp-text)] outline-none ring-1 ring-inset ring-[var(--noodle-divider)] placeholder:text-[var(--slurp-muted)] focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] sm:text-[13px]"
            />
            <button
              type="button"
              aria-label={t("ui.slurp.assist.close", { defaultValue: "Close" })}
              disabled={busy}
              onClick={() => setOpen(false)}
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-[var(--slurp-muted)] hover:text-[var(--slurp-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {error && (
              <p role="alert" className="min-w-0 flex-1 text-xs text-[var(--slurp-danger)]">
                {error}
              </p>
            )}
            <SlpButton disabled={busy} onClick={() => void go()} className="min-h-9 px-3.5 text-xs">
              {busy ? (
                <Loader2 size={14} aria-hidden="true" className="animate-spin" />
              ) : (
                <SlpSparkleGlyph size={14} aria-hidden="true" />
              )}
              {busy
                ? t("ui.slurp.assist.writing", { defaultValue: "Writing…" })
                : error
                  ? t("capabilities.actions.tryAgain", { defaultValue: "Try again" })
                  : mode === "write"
                    ? t("ui.slurp.assist.writeIt", { defaultValue: "Write it" })
                    : t("ui.slurp.assist.improveIt", { defaultValue: "Improve it" })}
              <SlpUsesAiMark />
            </SlpButton>
          </div>
        </div>
      )}
    </>
  );
}
