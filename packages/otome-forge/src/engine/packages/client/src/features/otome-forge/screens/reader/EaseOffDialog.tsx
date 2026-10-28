// ──────────────────────────────────────────────
// Otome Forge: Ease off. The scene ends where the player is, with no model call; the story picks up from its
// aftermath. Then, when the server suggests some, "Veil this from now on": a veiled subject happens off the page only.
// ──────────────────────────────────────────────
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { EyeOff, Feather } from "lucide-react";
import { Dialog } from "../../components/Dialog";
import { useOtomeApi } from "../../api";
import type { LimitId } from "../../shared/content";
import { LIMIT_LABEL_KEYS } from "../setup/ContentStep";

interface EaseOffDialogProps {
  /** Ends the scene; resolves the limits the server suggests veiling. */
  onEaseOff: () => Promise<LimitId[]>;
  onVeil: (limits: LimitId[]) => Promise<void>;
  onClose: () => void;
}

export function EaseOffDialog({ onEaseOff, onVeil, onClose }: EaseOffDialogProps) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const keepRef = useRef<HTMLButtonElement>(null);
  const [suggestions, setSuggestions] = useState<LimitId[] | null>(null);
  const [picked, setPicked] = useState<ReadonlySet<LimitId>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const easeOff = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const suggested = (await onEaseOff()).filter((id) => Object.hasOwn(LIMIT_LABEL_KEYS, id));
      if (!suggested.length) onClose();
      else {
        setSuggestions(suggested);
        setBusy(false);
      }
    } catch (failure) {
      setError(otome.errorMessage(failure));
      setBusy(false);
    }
  };

  const veil = async () => {
    if (busy) return;
    if (!picked.size) {
      onClose();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onVeil([...picked]);
      onClose();
    } catch (failure) {
      setError(otome.errorMessage(failure));
      setBusy(false);
    }
  };

  // While a request runs, neither close button closes: its result still lands, and an error needs the dialog.
  const close = () => {
    if (!busy) onClose();
  };

  const errorNote = error ? (
    <p className="of-notice of-notice--error" role="alert">
      {error}
    </p>
  ) : null;

  if (suggestions) {
    return (
      <Dialog
        title={t("ui.otomeForge.reader.veilTitle")}
        onClose={busy ? undefined : onClose}
        actions={
          <>
            <button type="button" className="of-button of-button--quiet of-glass" aria-disabled={busy} onClick={close}>
              {t("ui.otomeForge.reader.notNow")}
            </button>
            <button
              type="button"
              className="of-button of-button--primary"
              aria-disabled={busy || !picked.size}
              onClick={() => void veil()}
            >
              <EyeOff size={16} strokeWidth={2} aria-hidden="true" />
              {t("ui.otomeForge.reader.veilConfirm")}
            </button>
          </>
        }
      >
        <p className="of-body">{t("ui.otomeForge.reader.veilText")}</p>
        <fieldset className="of-fieldset">
          <legend className="of-legend of-legend--small">{t("ui.otomeForge.reader.veilLegend")}</legend>
          {suggestions.map((id) => (
            <label key={id} className="of-switch-row">
              <span className="of-switch-text">{t(LIMIT_LABEL_KEYS[id])}</span>
              <input
                className="of-switch"
                type="checkbox"
                checked={picked.has(id)}
                onChange={(event) => {
                  const next = new Set(picked);
                  if (event.target.checked) next.add(id);
                  else next.delete(id);
                  setPicked(next);
                }}
              />
            </label>
          ))}
        </fieldset>
        <p className="of-hint">{t("ui.otomeForge.reader.veilHint")}</p>
        {errorNote}
      </Dialog>
    );
  }

  return (
    <Dialog
      title={t("ui.otomeForge.reader.easeOffTitle")}
      onClose={busy ? undefined : onClose}
      initialFocus={keepRef}
      actions={
        <>
          <button
            ref={keepRef}
            type="button"
            className="of-button of-button--quiet of-glass"
            aria-disabled={busy}
            onClick={close}
          >
            {t("ui.otomeForge.reader.keepReading")}
          </button>
          <button
            type="button"
            className="of-button of-button--primary"
            aria-disabled={busy}
            onClick={() => void easeOff()}
          >
            <Feather size={16} strokeWidth={2} aria-hidden="true" />
            {t("ui.otomeForge.reader.easeOff")}
          </button>
        </>
      }
    >
      <p className="of-body">{t("ui.otomeForge.reader.easeOffText")}</p>
      <p className="of-hint">{t("ui.otomeForge.reader.easeOffFree")}</p>
      {errorNote}
    </Dialog>
  );
}
