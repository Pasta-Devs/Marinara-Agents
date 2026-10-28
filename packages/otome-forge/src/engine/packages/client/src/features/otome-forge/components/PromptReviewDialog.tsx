// ──────────────────────────────────────────────
// Otome Forge: the image prompt, shown for editing before it is sent (the Engine's "Review image prompts before
// sending" setting). The client asks POST .../art/prompt for it and sends the edited text to .../art/paint.
// ──────────────────────────────────────────────
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Paintbrush } from "lucide-react";
import { CostHint } from "./CostHint";
import { Dialog } from "./Dialog";

export interface ImagePrompt {
  prompt: string;
  negativePrompt: string;
}

interface PromptReviewDialogProps {
  /** Whose look this paints. */
  subject: string;
  initial: ImagePrompt;
  busy?: boolean;
  error?: string | null;
  onSend: (prompt: ImagePrompt) => void;
  /** Skips this one image. */
  onSkip: () => void;
}

export function PromptReviewDialog({ subject, initial, busy = false, error, onSend, onSkip }: PromptReviewDialogProps) {
  const { t } = useTranslation();
  const id = useId();
  const [prompt, setPrompt] = useState(initial.prompt);
  const [negativePrompt, setNegativePrompt] = useState(initial.negativePrompt);
  return (
    <Dialog
      wide
      title={t("ui.otomeForge.setup.reviewPromptTitle", { name: subject })}
      onClose={busy ? undefined : onSkip}
      actions={
        <>
          <button
            type="button"
            className="of-button of-button--quiet of-glass"
            aria-disabled={busy}
            onClick={() => {
              if (!busy) onSkip();
            }}
          >
            {t("ui.otomeForge.setup.reviewPromptSkip")}
          </button>
          <button
            type="button"
            className="of-button of-button--primary"
            aria-disabled={busy || !prompt.trim()}
            onClick={() => {
              if (!busy && prompt.trim()) onSend({ prompt: prompt.trim(), negativePrompt: negativePrompt.trim() });
            }}
          >
            <Paintbrush size={16} strokeWidth={2} aria-hidden="true" />
            {t("ui.otomeForge.setup.reviewPromptSend")}
          </button>
        </>
      }
    >
      <p className="of-hint">{t("ui.otomeForge.setup.reviewPromptHint")}</p>
      <div className="of-field">
        <label className="of-label" htmlFor={`${id}-prompt`}>
          {t("ui.otomeForge.setup.reviewPromptPrompt")}
        </label>
        <textarea
          id={`${id}-prompt`}
          className="of-input of-textarea"
          rows={6}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
        />
      </div>
      <div className="of-field">
        <label className="of-label" htmlFor={`${id}-negative`}>
          {t("ui.otomeForge.setup.reviewPromptNegative")}
        </label>
        <textarea
          id={`${id}-negative`}
          className="of-input of-textarea"
          rows={3}
          value={negativePrompt}
          onChange={(event) => setNegativePrompt(event.target.value)}
        />
      </div>
      <CostHint images={1} />
      {error ? (
        <p className="of-notice of-notice--error" role="alert">
          {error}
        </p>
      ) : null}
    </Dialog>
  );
}
