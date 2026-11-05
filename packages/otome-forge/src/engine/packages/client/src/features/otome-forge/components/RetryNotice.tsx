// ──────────────────────────────────────────────
// Otome Forge: a list from the Engine (connections, personas, characters) that could not load, said plainly with Try
// again; and Check again for a list that is empty until the player adds something in the Engine.
// ──────────────────────────────────────────────
// Both buttons stay mounted (aria-disabled) while their request runs, so keyboard focus never falls to the page, and a
// status line says what is happening: the lists keep `isError` through a retry (use-engine-resources.ts).
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RotateCcw } from "lucide-react";

export function RetryNotice({
  message,
  onRetry,
  retrying = false,
}: {
  message: string;
  onRetry: () => void;
  retrying?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <>
      <div className="of-notice of-notice--error" role="alert">
        <span>{message}</span>
        <button
          type="button"
          className="of-button of-button--text"
          aria-disabled={retrying || undefined}
          onClick={() => {
            if (!retrying) onRetry();
          }}
        >
          <RotateCcw size={14} strokeWidth={2.2} aria-hidden="true" />
          {t("ui.otomeForge.common.retry")}
        </button>
      </div>
      <span className="of-visually-hidden" role="status">
        {retrying ? t("ui.otomeForge.common.retrying") : ""}
      </span>
    </>
  );
}

export function CheckAgain({ onCheck }: { onCheck: () => Promise<unknown> }) {
  const { t } = useTranslation();
  const [state, setState] = useState<"idle" | "checking" | "checked">("idle");
  const check = async () => {
    if (state === "checking") return;
    setState("checking");
    try {
      await onCheck();
    } finally {
      setState("checked");
    }
  };
  // Shown only while the list is still empty: a check that finds something replaces this button with the list.
  return (
    <>
      <button
        type="button"
        className="of-button of-button--text"
        aria-disabled={state === "checking" || undefined}
        onClick={() => void check()}
      >
        <RotateCcw size={14} strokeWidth={2.2} aria-hidden="true" />
        {t("ui.otomeForge.common.checkAgain")}
      </button>
      <span className={state === "checked" ? "of-hint" : "of-visually-hidden"} role="status">
        {state === "checking"
          ? t("ui.otomeForge.common.checking")
          : state === "checked"
            ? t("ui.otomeForge.common.nothingNew")
            : ""}
      </span>
    </>
  );
}
