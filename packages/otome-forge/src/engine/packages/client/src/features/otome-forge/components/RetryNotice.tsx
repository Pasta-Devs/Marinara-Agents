// ──────────────────────────────────────────────
// Otome Forge: a list from the Engine (connections, personas, characters) that could not load, said plainly with Try
// again; and Check again for a list that is empty until the player adds something in the Engine.
// ──────────────────────────────────────────────
import { useTranslation } from "react-i18next";
import { RotateCcw } from "lucide-react";

export function RetryNotice({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="of-notice of-notice--error" role="alert">
      <span>{message}</span>
      <button type="button" className="of-button of-button--text" onClick={onRetry}>
        <RotateCcw size={14} strokeWidth={2.2} aria-hidden="true" />
        {t("ui.otomeForge.common.retry")}
      </button>
    </div>
  );
}

export function CheckAgain({ onCheck }: { onCheck: () => void }) {
  const { t } = useTranslation();
  return (
    <button type="button" className="of-button of-button--text" onClick={onCheck}>
      <RotateCcw size={14} strokeWidth={2.2} aria-hidden="true" />
      {t("ui.otomeForge.common.checkAgain")}
    </button>
  );
}
