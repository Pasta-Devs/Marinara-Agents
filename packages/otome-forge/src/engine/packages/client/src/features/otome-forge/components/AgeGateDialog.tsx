// ──────────────────────────────────────────────
// Otome Forge: the 18+ gate. One confirmation, stored on the server with a timestamp, unlocks NSFW Heat, Dark romance
// and image ratings above SFW. Turning a setting down never asks. The server enforces the gate on every write; this
// dialog only asks.
// ──────────────────────────────────────────────
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { useOtomeApi } from "../api";
import { INDEX_QUERY_KEY, useIndexQuery } from "../hooks/use-index";
import type { OtomeIndex } from "../shared/api-types";
import { Dialog } from "./Dialog";

interface AgeGateDialogProps {
  onDone: (confirmed: boolean) => void;
}

export function AgeGateDialog({ onDone }: AgeGateDialogProps) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { ageGate } = await otome.post<{ ageGate: OtomeIndex["ageGate"] }>("/age-gate", { confirm: true });
      queryClient.setQueryData<OtomeIndex>(INDEX_QUERY_KEY, (index) => (index ? { ...index, ageGate } : index));
      onDone(true);
    } catch (failure) {
      setError(otome.errorMessage(failure));
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={t("ui.otomeForge.gate.title")}
      // While the confirmation is being saved it cannot be cancelled: the server would store it as given.
      onClose={busy ? undefined : () => onDone(false)}
      actions={
        <>
          <button
            type="button"
            className="of-button of-button--quiet of-glass"
            aria-disabled={busy}
            onClick={() => {
              if (!busy) onDone(false);
            }}
          >
            {t("ui.otomeForge.gate.cancel")}
          </button>
          <button
            type="button"
            className="of-button of-button--primary"
            aria-disabled={busy}
            onClick={() => void confirm()}
          >
            <ShieldCheck size={17} strokeWidth={2} aria-hidden="true" />
            {t("ui.otomeForge.gate.confirm")}
          </button>
        </>
      }
    >
      <p className="of-body">{t("ui.otomeForge.gate.intro")}</p>
      <blockquote className="of-gate-statement">{t("ui.otomeForge.gate.statement")}</blockquote>
      <p className="of-hint">{t("ui.otomeForge.gate.selfReported")}</p>
      {error ? (
        <p className="of-notice of-notice--error" role="alert">
          {error}
        </p>
      ) : null}
    </Dialog>
  );
}

/**
 * The gate for a control that raises a setting: `request()` resolves true at once when the player has confirmed,
 * otherwise after the dialog is answered. Render `dialog` somewhere in the screen.
 */
export function useAgeGate() {
  const index = useIndexQuery();
  const confirmedAt = index.data?.ageGate?.confirmedAt ?? null;
  const [resolver, setResolver] = useState<((confirmed: boolean) => void) | null>(null);
  const request = useCallback(
    (): Promise<boolean> =>
      confirmedAt ? Promise.resolve(true) : new Promise<boolean>((resolve) => setResolver(() => resolve)),
    [confirmedAt],
  );
  const dialog = resolver ? (
    <AgeGateDialog
      onDone={(confirmed) => {
        resolver(confirmed);
        setResolver(null);
      }}
    />
  ) : null;
  return { confirmed: !!confirmedAt, confirmedAt, request, dialog };
}
