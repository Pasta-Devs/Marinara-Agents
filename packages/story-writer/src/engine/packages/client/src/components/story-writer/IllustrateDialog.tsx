// ──────────────────────────────────────────────
// Story Writer: the picture prompt review (Illustrate, when the Engine asks to expose media prompts before sending)
// ──────────────────────────────────────────────
// Peek's in-tree dialog: the drawer's scrim and Escape handling, with everything behind it inert.
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, X } from "lucide-react";
import type { PictureReview } from "../../hooks/use-story-illustration";
import { LIMITS } from "../../lib/story-writer/model";
import { dialogKeyDown } from "./PromptPeek";

export function IllustrateDialog(props: { review: PictureReview; onPaint(prompt: string): void; onCancel(): void }) {
  const { t } = useTranslation();
  const titleId = useId();
  const fieldId = useId();
  const { review, onPaint, onCancel } = props;
  const [prompt, setPrompt] = useState(review.prompt);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  // The view keys the dialog by its status, so the prompt the model wrote arrives as a new dialog's first value.
  const ready = review.status === "ready";

  useEffect(() => {
    if (ready) fieldRef.current?.focus({ preventScroll: true });
    else cancelRef.current?.focus({ preventScroll: true });
  }, [ready]);

  const onKeyDown = (event: KeyboardEvent) => dialogKeyDown(event, onCancel);

  return (
    <>
      <div className="sw-scrim sw-peek-scrim" data-open="true" aria-hidden="true" onClick={onCancel} />
      <div
        className="sw-peek sw-illustrate"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <header className="sw-peek-head">
          <h2 id={titleId}>{t("illustrate.reviewTitle")}</h2>
          <button
            type="button"
            className="sw-icon-button"
            aria-label={t("illustrate.cancel")}
            title={t("illustrate.cancel")}
            onClick={onCancel}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="sw-peek-body">
          {ready ? (
            <>
              <label className="sw-label" htmlFor={fieldId}>
                {t("illustrate.promptLabel")}
              </label>
              <textarea
                ref={fieldRef}
                id={fieldId}
                className="sw-textarea"
                rows={7}
                maxLength={LIMITS.picturePrompt}
                value={prompt}
                aria-describedby={`${fieldId}-hint`}
                onChange={(event) => setPrompt(event.target.value)}
              />
              <p id={`${fieldId}-hint`} className="sw-hint">
                {t(review.again ? "illustrate.reviewAgainHint" : "illustrate.reviewHint")}
              </p>
            </>
          ) : (
            <p className="sw-peek-status" role="status">
              <Loader2 className="sw-spin" size={16} aria-hidden="true" />
              {t("illustrate.writingPrompt")}
            </p>
          )}
          <div className="sw-button-row sw-illustrate-actions">
            <button ref={cancelRef} type="button" className="sw-button" onClick={onCancel}>
              {t("illustrate.cancel")}
            </button>
            {ready ? (
              <button
                type="button"
                className="sw-button"
                data-variant="primary"
                disabled={!prompt.trim()}
                onClick={() => onPaint(prompt)}
              >
                {t("illustrate.paint")}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
