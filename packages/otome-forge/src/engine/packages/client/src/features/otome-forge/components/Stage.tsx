// ──────────────────────────────────────────────
// Otome Forge: the portrait stage. A 9:16 stage centred over a blurred, dimmed copy of the scene; full-bleed at phone
// width; never rotates. Fullscreen goes through the Home browser's own control (`browserFullscreen.setActive`).
// ──────────────────────────────────────────────
import type { CSSProperties, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Maximize2, Minimize2 } from "lucide-react";
import { useOtomeProps } from "../props";

interface StageProps {
  /** A CSS background for the scene (a place or CG); the look's gradient when omitted. */
  background?: string | null;
  children: ReactNode;
}

export function Stage({ background, children }: StageProps) {
  const { t } = useTranslation();
  const style = background ? ({ "--of-bg": background } as CSSProperties) : undefined;
  return (
    <div className="of-frame" style={style}>
      <div className="of-frame-blur" aria-hidden="true" />
      <section className="of-stage" aria-label={t("ui.otomeForge.common.title")}>
        <div className="of-scene" aria-hidden="true">
          <div className="of-scene-bg" />
          <div className="of-scene-glow" />
          <div className="of-scene-glow" />
          <div className="of-scene-stars" />
          <div className="of-scene-veil" />
        </div>
        <div className="of-stage-body">{children}</div>
      </section>
    </div>
  );
}

/** Enters or leaves the Home browser's fullscreen; nothing on a host without the control. */
export function FullscreenButton() {
  const { t } = useTranslation();
  const fullscreen = useOtomeProps().browserFullscreen;
  if (!fullscreen) return null;
  const label = fullscreen.active
    ? (fullscreen.exitLabel ?? t("ui.otomeForge.common.exitFullscreen"))
    : (fullscreen.enterLabel ?? t("ui.otomeForge.common.enterFullscreen"));
  const Icon = fullscreen.active ? Minimize2 : Maximize2;
  return (
    <button
      type="button"
      className="of-icon-button of-glass"
      aria-label={label}
      title={label}
      onClick={() => fullscreen.setActive(!fullscreen.active)}
    >
      <Icon size={17} strokeWidth={2} aria-hidden="true" />
    </button>
  );
}
