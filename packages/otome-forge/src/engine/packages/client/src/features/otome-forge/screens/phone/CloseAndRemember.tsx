// ──────────────────────────────────────────────
// Otome Forge: Close and remember. The open conversation becomes a memory only this love interest can recall (a chat
// source with audience [li]), the next message starts a new one, and closing grants a little affection (capped per
// day). One close at a time: the confirm button is inert while it runs, and the trigger while a reply is on its way
// or nothing is open to remember. The server holds one send or close per thread (409 busy), and a close sent again
// after it landed gets the same memory and earns nothing.
// ──────────────────────────────────────────────
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BookHeart } from "lucide-react";
import { useOtomeApi } from "../../api";
import { Dialog } from "../../components/Dialog";
import type { PhoneCloseResult, RunLiView } from "../../shared/api-types";
import { phonePath } from "./PhoneScreen";

interface CloseAndRememberProps {
  runKey: string;
  li: RunLiView;
  /** Nothing to remember (no open conversation), or a reply is still on its way. */
  disabled: boolean;
  onClosed: (result: PhoneCloseResult) => void;
}

export function CloseAndRemember({ runKey, li, disabled, onClosed }: CloseAndRememberProps) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const [asking, setAsking] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = t("ui.otomeForge.phone.close");

  const close = async () => {
    if (closing) return;
    setClosing(true);
    setError(null);
    try {
      const result = await otome.post<PhoneCloseResult>(`${phonePath(runKey, li.id)}/close`);
      setAsking(false);
      onClosed(result);
    } catch (failure) {
      setError(otome.errorMessage(failure));
    } finally {
      setClosing(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="of-button of-button--quiet of-button--small of-glass of-thread-close"
        aria-disabled={disabled}
        title={disabled ? t("ui.otomeForge.phone.closeNothing") : label}
        onClick={() => {
          if (disabled) return;
          // A new dialog starts clean: the last attempt's failure is not news.
          setError(null);
          setAsking(true);
        }}
      >
        <BookHeart size={15} strokeWidth={2} aria-hidden="true" />
        <span>{label}</span>
      </button>
      {asking ? (
        <Dialog
          title={t("ui.otomeForge.phone.closeTitle")}
          onClose={closing ? undefined : () => setAsking(false)}
          actions={
            <>
              <button
                type="button"
                className="of-button of-button--quiet of-button--small of-glass"
                aria-disabled={closing}
                onClick={() => !closing && setAsking(false)}
              >
                {t("ui.otomeForge.phone.closeCancel")}
              </button>
              <button
                type="button"
                className="of-button of-button--primary of-button--small"
                aria-disabled={closing}
                onClick={() => void close()}
              >
                <BookHeart size={15} strokeWidth={2} aria-hidden="true" />
                {closing ? t("ui.otomeForge.phone.closing") : t("ui.otomeForge.phone.closeConfirm")}
              </button>
            </>
          }
        >
          <p className="of-body">{t("ui.otomeForge.phone.closeText", { name: li.name })}</p>
          {error ? (
            <p className="of-notice of-notice--error" role="alert">
              {error}
            </p>
          ) : null}
        </Dialog>
      ) : null}
    </>
  );
}
