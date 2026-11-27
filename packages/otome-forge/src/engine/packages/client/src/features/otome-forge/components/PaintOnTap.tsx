// ──────────────────────────────────────────────
// Otome Hearth: one picture painted on the player's tap, as a date's keepsake is: a hangout's memento (#2458) and his
// selfie in Messages (#2504)
// ──────────────────────────────────────────────
// POST `path` paints it. Ask before painting confirms the tap first, and the Engine's prompt review (Review image prompts
// before sending) shows POST `${path}/prompt` for editing before it is sent. `onSettled` reads the picture's record
// again once a paint ends, whatever came of it.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Paintbrush, RotateCcw } from "lucide-react";
import { useOtomeApi } from "../api";
import { useOtomeProps } from "../props";
import type { Paint } from "../shared/api-types";
import { CostHint } from "./CostHint";
import { Dialog } from "./Dialog";
import { PromptReviewDialog, type ImagePrompt } from "./PromptReviewDialog";

interface PaintOnTapOptions {
  path: string;
  art: Paint | undefined;
  /** Ask before painting (Settings → Images). */
  ask: boolean;
  onSettled: () => void;
  /** The confirmation's title and text, and whose picture the prompt review names. */
  askTitle: string;
  askText: string;
  subject: string;
}

/** The tap (`tap`), whether it is painting, its error, and the dialogs it opens (render `dialogs`). */
export function usePaintOnTap({ path, art, ask, onSettled, askTitle, askText, subject }: PaintOnTapOptions) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const { reviewImagePromptsBeforeSend } = useOtomeProps();
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [review, setReview] = useState<ImagePrompt | null>(null);
  const paint = async (prompt?: ImagePrompt) => {
    setBusy(true);
    setError(null);
    try {
      await otome.post(path, { ...(prompt ?? {}) });
      setReview(null);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
      onSettled();
    }
  };
  const start = async () => {
    setConfirming(false);
    if (!reviewImagePromptsBeforeSend) {
      await paint();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setReview(await otome.post<ImagePrompt>(`${path}/prompt`, {}));
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };
  const painting = busy || art?.state === "pending";
  const tap = () => {
    if (painting) return;
    if (ask) setConfirming(true);
    else void start();
  };
  const dialogs = (
    <>
      {confirming ? (
        <Dialog
          title={askTitle}
          onClose={() => setConfirming(false)}
          actions={
            <>
              <button
                type="button"
                className="of-button of-button--quiet of-glass"
                onClick={() => setConfirming(false)}
              >
                {t("ui.otomeForge.dateNight.keepsakeAskNo")}
              </button>
              <button type="button" className="of-button of-button--primary" onClick={() => void start()}>
                <Paintbrush size={16} strokeWidth={2} aria-hidden="true" />
                {t("ui.otomeForge.dateNight.keepsakeAskYes")}
              </button>
            </>
          }
        >
          <p className="of-body">{askText}</p>
          <CostHint images={1} />
        </Dialog>
      ) : null}
      {review ? (
        <PromptReviewDialog
          subject={subject}
          initial={review}
          busy={busy}
          error={error ? otome.errorMessage(error) : null}
          onSend={(prompt) => void paint(prompt)}
          onSkip={() => setReview(null)}
        />
      ) : null}
    </>
  );
  return { painting, error, tap, dialogs };
}

/** The tap's button: Paint, or Retry once a paint failed or stopped, saying so while it paints. */
export function PaintButton({
  art,
  painting,
  onTap,
  labels,
}: {
  art: Paint | undefined;
  painting: boolean;
  onTap: () => void;
  labels: { paint: string; retry: string; painting: string };
}) {
  const again = art?.state === "failed" || art?.state === "stopped";
  return (
    <button
      type="button"
      className="of-button of-button--quiet of-glass of-button--small"
      aria-disabled={painting}
      onClick={onTap}
    >
      {again ? (
        <RotateCcw size={14} strokeWidth={2} aria-hidden="true" />
      ) : (
        <Paintbrush size={14} strokeWidth={2} aria-hidden="true" />
      )}
      {painting ? labels.painting : again ? labels.retry : labels.paint}
    </button>
  );
}
