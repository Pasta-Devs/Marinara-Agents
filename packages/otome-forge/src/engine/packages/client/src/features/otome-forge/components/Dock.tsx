// ──────────────────────────────────────────────
// Otome Forge: the dock. Story · Dates · Wish (raised) · Wardrobe · Album
// ──────────────────────────────────────────────
import { useTranslation } from "react-i18next";
import { SCREEN_ICONS } from "../screens/screen-icons";
import { DOCK_SCREENS, SCREEN_NAME_KEYS, type DockScreen, type ScreenId } from "../screens/screens";

interface DockProps {
  active: ScreenId;
  onSelect: (screen: DockScreen) => void;
}

export function Dock({ active, onSelect }: DockProps) {
  const { t } = useTranslation();
  return (
    <nav className="of-dock of-glass of-glass--strong" aria-label={t("ui.otomeForge.common.dockLabel")}>
      {DOCK_SCREENS.map((screen) => {
        const Icon = SCREEN_ICONS[screen];
        const current = active === screen ? "page" : undefined;
        const label = <span className="of-dock-label">{t(SCREEN_NAME_KEYS[screen])}</span>;
        return screen === "wish" ? (
          <button
            key={screen}
            type="button"
            className="of-dock-item of-dock-wish"
            aria-current={current}
            onClick={() => onSelect(screen)}
          >
            <span className="of-wish" aria-hidden="true">
              <span className="of-wish-halo" />
              <span className="of-wish-orb">
                <Icon size={27} strokeWidth={1.8} />
              </span>
            </span>
            {label}
          </button>
        ) : (
          <button
            key={screen}
            type="button"
            className="of-dock-item"
            aria-current={current}
            onClick={() => onSelect(screen)}
          >
            <span className="of-dock-icon" aria-hidden="true">
              <Icon size={21} strokeWidth={1.8} />
            </span>
            {label}
          </button>
        );
      })}
    </nav>
  );
}
