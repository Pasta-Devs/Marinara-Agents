// ──────────────────────────────────────────────
// Otome Forge: the top bar. Back, when the screen has one; inside a run, his chip (back to Home) and the Starlight
// counter; always fullscreen; the settings gear everywhere but Settings. When a pressed button leaves with its screen,
// OtomeForgeView moves focus to the new screen's heading.
// ──────────────────────────────────────────────
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, Heart, Settings, Sparkle } from "lucide-react";
import { initialsOf } from "../lib/accent";
import { useOtomeProps } from "../props";
import { FullscreenButton } from "./Stage";

export interface TopBarLoveInterest {
  name: string;
  /** His accent colour (sampled from his portrait from M1 on). */
  accent?: string | null;
  portraitUrl?: string | null;
}

export interface TopBarRun {
  /** The love interest on Home; null before one is chosen. */
  li: TopBarLoveInterest | null;
  /** The wallet; null before a run has one. */
  starlight: number | null;
}

interface TopBarProps {
  run?: TopBarRun | null;
  /** The screen's way back, when it has one. */
  onBack?: () => void;
  onHome?: () => void;
  /** Omitted on the settings screen itself. */
  onSettings?: () => void;
}

function LoveInterestChip({ li, onHome }: { li: TopBarLoveInterest | null; onHome?: () => void }) {
  const { t } = useTranslation();
  const label = li ? t("ui.otomeForge.common.homeWith", { name: li.name }) : t("ui.otomeForge.common.screenHome");
  const avatarStyle = li?.accent ? ({ "--of-li-accent": li.accent } as CSSProperties) : undefined;
  return (
    <button type="button" className="of-chip of-glass" aria-label={label} title={label} onClick={onHome}>
      {li ? (
        <span className="of-avatar" style={avatarStyle} aria-hidden="true">
          {li.portraitUrl ? <img src={li.portraitUrl} alt="" /> : initialsOf(li.name)}
        </span>
      ) : (
        <span className="of-avatar of-avatar--empty" aria-hidden="true">
          <Heart size={15} strokeWidth={2} />
        </span>
      )}
      <span className={li ? "of-chip-name" : "of-chip-name of-chip-name--empty"} aria-hidden="true">
        {li ? li.name : t("ui.otomeForge.common.noLoveInterest")}
      </span>
    </button>
  );
}

function StarlightCounter({ amount }: { amount: number | null }) {
  const { t } = useTranslation();
  const { locale } = useOtomeProps().localization;
  const label = t("ui.otomeForge.common.starlight");
  return (
    <div className="of-starlight of-glass" title={label}>
      <Sparkle size={15} strokeWidth={1.6} fill="currentColor" aria-hidden="true" />
      {amount === null ? (
        <>
          <span className="of-visually-hidden">{t("ui.otomeForge.common.starlightNone")}</span>
          <span aria-hidden="true">—</span>
        </>
      ) : (
        <>
          <span className="of-visually-hidden">{label}</span>
          <span>{new Intl.NumberFormat(locale).format(amount)}</span>
        </>
      )}
    </div>
  );
}

export function TopBar({ run, onBack, onHome, onSettings }: TopBarProps) {
  const { t } = useTranslation();
  const backLabel = t("ui.otomeForge.common.back");
  const settingsLabel = t("ui.otomeForge.common.screenSettings");
  return (
    <header className="of-topbar">
      {onBack ? (
        <button
          type="button"
          className="of-icon-button of-glass"
          aria-label={backLabel}
          title={backLabel}
          onClick={onBack}
        >
          <ChevronLeft className="of-back-icon" size={20} strokeWidth={2.1} aria-hidden="true" />
        </button>
      ) : null}
      {run ? <LoveInterestChip li={run.li} onHome={onHome} /> : null}
      <div className="of-topbar-spacer" />
      {run ? <StarlightCounter amount={run.starlight} /> : null}
      <FullscreenButton />
      {onSettings ? (
        <button
          type="button"
          className="of-icon-button of-glass"
          aria-label={settingsLabel}
          title={settingsLabel}
          onClick={onSettings}
        >
          <Settings size={18} strokeWidth={1.9} aria-hidden="true" />
        </button>
      ) : null}
    </header>
  );
}
