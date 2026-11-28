// ──────────────────────────────────────────────
// Otome Hearth Messages: hand him the remote of her toys (0.34.0), in his thread's header
// ──────────────────────────────────────────────
// For 15, 30 or 60 minutes (hooks/use-otome-haptics.ts REMOTE_MINUTES). While he holds it, her messages tell the server
// so, and his replies may drive the toys (each cue loops until his next one or Stop). Take it back ends it at once and
// stops what his messages started; it also ends by itself.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Gamepad2 } from "lucide-react";
import { REMOTE_MINUTES, useHapticsSnapshot, useOtomeHaptics } from "../../hooks/use-otome-haptics";
import type { RunLiView } from "../../shared/api-types";

export function RemoteControl({ li }: { li: Pick<RunLiView, "id" | "name"> }) {
  const { t } = useTranslation();
  const haptics = useOtomeHaptics();
  const { remote } = useHapticsSnapshot();
  const [open, setOpen] = useState(false);
  // The minutes left move on their own, once a minute is enough.
  const [, setNow] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  if (!haptics) return null;
  const minutes = remote[li.id] ? haptics.remoteMinutes(li.id) : 0;
  if (minutes) {
    return (
      <div className="of-remote">
        <span className="of-remote-held">{t("ui.otomeForge.haptics.remoteHeld", { name: li.name, minutes })}</span>
        <button
          type="button"
          className="of-button of-button--text of-button--small"
          onClick={() => haptics.takeRemote(li.id)}
        >
          {t("ui.otomeForge.haptics.takeBack")}
        </button>
      </div>
    );
  }
  return (
    <div className="of-remote">
      <button
        type="button"
        className="of-icon-button"
        aria-expanded={open}
        aria-label={t("ui.otomeForge.haptics.giveRemote", { name: li.name })}
        title={t("ui.otomeForge.haptics.giveRemote", { name: li.name })}
        onClick={() => setOpen((shown) => !shown)}
      >
        <Gamepad2 size={19} strokeWidth={2} aria-hidden="true" />
      </button>
      {open ? (
        <div
          className="of-remote-menu of-glass"
          role="group"
          aria-label={t("ui.otomeForge.haptics.giveRemote", { name: li.name })}
        >
          {REMOTE_MINUTES.map((option) => (
            <button
              key={option}
              type="button"
              className="of-button of-button--quiet of-button--small"
              onClick={() => {
                haptics.giveRemote(li.id, option);
                setOpen(false);
              }}
            >
              {t("ui.otomeForge.haptics.remoteFor", { minutes: option })}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
