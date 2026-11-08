// ──────────────────────────────────────────────
// Otome Forge: the dock. Story · Dates · Wish (raised) · Wardrobe · Album. 0.21.0: the Wardrobe and the Album carry a
// dot while they hold an item won from Wish that has not been looked at (RunView `unseen`), said to screen readers too.
// ──────────────────────────────────────────────
import { useTranslation } from "react-i18next";
import { SCREEN_ICONS } from "../screens/screen-icons";
import { DOCK_SCREENS, SCREEN_NAME_KEYS, type DockScreen, type ScreenId } from "../screens/screens";
import type { UnseenCounts } from "../shared/wish";

interface DockProps {
  active: ScreenId;
  onSelect: (screen: DockScreen) => void;
  /** How many unseen items the Wardrobe and the Album hold (absent from an older server). */
  unseen?: UnseenCounts;
}

export function Dock({ active, onSelect, unseen }: DockProps) {
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
            {(screen === "wardrobe" || screen === "album") && unseen?.[screen] ? (
              <span className="of-tab-dot of-dock-dot">
                <span className="of-visually-hidden">
                  {t("ui.otomeForge.common.newItems", { count: unseen[screen] })}
                </span>
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
