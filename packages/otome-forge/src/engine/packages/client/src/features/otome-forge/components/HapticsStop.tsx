// ──────────────────────────────────────────────
// Otome Hearth: Stop the toys (0.34.0), always in reach while they play
// ──────────────────────────────────────────────
// In the stage's top layer (components/Stage.tsx), which a dialog never makes inert and every screen shares, so it
// stays usable over the reader with its tools hidden, a key image's pan, an open dialog or Messages.
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Square } from "lucide-react";
import { useHapticsSnapshot, useOtomeHaptics } from "../hooks/use-otome-haptics";
import { useStageLayer } from "./Stage";

export function HapticsStop() {
  const { t } = useTranslation();
  const haptics = useOtomeHaptics();
  const { playing } = useHapticsSnapshot();
  const stage = useStageLayer();
  if (!playing || !haptics || !stage) return null;
  return createPortal(
    <button type="button" className="of-haptics-stop" onClick={() => haptics.stop()}>
      <Square size={14} strokeWidth={2.4} fill="currentColor" aria-hidden="true" />
      {t("ui.otomeForge.haptics.stop")}
    </button>,
    stage.layer,
  );
}
