// ──────────────────────────────────────────────
// Otome Forge: the opening screen while there is no story yet (the run picker arrives with world setup)
// ──────────────────────────────────────────────
import { useTranslation } from "react-i18next";
import { Heart, Sparkles } from "lucide-react";

export function Welcome({ onLookAround }: { onLookAround: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="of-center">
      <div className="of-emblem of-glass" aria-hidden="true">
        <Heart size={30} strokeWidth={1.6} />
      </div>
      <h1 className="of-title of-title--hero" tabIndex={-1}>
        {t("ui.otomeForge.common.title")}
      </h1>
      <p className="of-subtitle">{t("ui.otomeForge.common.tagline")}</p>
      <div className="of-ornament" aria-hidden="true">
        <Heart size={11} strokeWidth={0} fill="currentColor" />
      </div>
      <p className="of-hand">{t("ui.otomeForge.common.taglineNote")}</p>
      <div className="of-panel of-panel--center of-card of-glass">
        <p className="of-body">{t("ui.otomeForge.common.frameNotice")}</p>
        <div className="of-actions">
          <button type="button" className="of-button of-button--primary" onClick={onLookAround}>
            <Sparkles size={17} strokeWidth={2} aria-hidden="true" />
            {t("ui.otomeForge.common.lookAround")}
          </button>
        </div>
      </div>
    </div>
  );
}
