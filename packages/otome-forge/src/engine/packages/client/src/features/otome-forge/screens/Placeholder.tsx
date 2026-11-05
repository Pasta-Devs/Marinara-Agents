// ──────────────────────────────────────────────
// Otome Forge: the screen shown when the one asked for cannot open (its story failed to load, or what it shows is gone)
// ──────────────────────────────────────────────
import { useTranslation } from "react-i18next";
import { Heart } from "lucide-react";
import { SCREEN_ICONS } from "./screen-icons";
import { SCREEN_NAME_KEYS, type ScreenId } from "./screens";

interface PlaceholderProps {
  screen: ScreenId;
  /** Leads to Your stories, where the story can be opened (and loaded) again. */
  onStories: () => void;
}

export function Placeholder({ screen, onStories }: PlaceholderProps) {
  const { t } = useTranslation();
  const Icon = SCREEN_ICONS[screen];
  return (
    <div className="of-center">
      <div className="of-emblem of-glass" aria-hidden="true">
        <Icon size={32} strokeWidth={1.6} />
      </div>
      <h1 className="of-title" tabIndex={-1}>
        {t(SCREEN_NAME_KEYS[screen])}
      </h1>
      <div className="of-ornament" aria-hidden="true">
        <Heart size={11} strokeWidth={0} fill="currentColor" />
      </div>
      <p className="of-body">{t("ui.otomeForge.common.unavailable")}</p>
      <div className="of-actions">
        <button type="button" className="of-button of-button--quiet of-glass" onClick={onStories}>
          {t("ui.otomeForge.common.screenPicker")}
        </button>
      </div>
    </div>
  );
}
