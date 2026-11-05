// ──────────────────────────────────────────────
// Otome Forge: the portrait stage. A 9:16 stage centred over a blurred, dimmed copy of the scene; full-bleed at phone
// width. User-selected fullscreen fills the Home browser's panel through its own control (`browserFullscreen.setActive`).
// ──────────────────────────────────────────────
import { createContext, useContext, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Maximize2, Minimize2 } from "lucide-react";
import { useOtomeProps } from "../props";

interface StageProps {
  /** A CSS background for the scene (a place or CG); the look's gradient when omitted. */
  background?: string | null;
  children: ReactNode;
}

/** The layer over the stage that dialogs render into (components/Dialog.tsx), and the body they make inert. */
export interface StageLayer {
  layer: HTMLDivElement;
  body: HTMLDivElement;
}

const StageLayerContext = createContext<StageLayer | null>(null);

export function useStageLayer(): StageLayer | null {
  return useContext(StageLayerContext);
}

export function Stage({ background, children }: StageProps) {
  const { t } = useTranslation();
  const fullscreen = useOtomeProps().browserFullscreen?.active === true;
  const [body, setBody] = useState<HTMLDivElement | null>(null);
  const [layer, setLayer] = useState<HTMLDivElement | null>(null);
  // One value per pair of elements: a new object on every render would rerun each open dialog's mount effect (focus
  // jumping back to its first control) whenever the host redraws.
  const stageLayer = useMemo(() => (body && layer ? { body, layer } : null), [body, layer]);
  const style = background ? ({ "--of-bg": background } as CSSProperties) : undefined;
  return (
    <div className="of-frame" style={style} data-fullscreen={fullscreen ? "true" : undefined}>
      <div className="of-frame-blur" aria-hidden="true" />
      <section className="of-stage" aria-label={t("ui.otomeForge.common.title")}>
        <div className="of-scene" aria-hidden="true">
          <div className="of-scene-bg" />
          <div className="of-scene-glow" />
          <div className="of-scene-glow" />
          <div className="of-scene-stars" />
          <div className="of-scene-veil" />
        </div>
        <StageLayerContext.Provider value={stageLayer}>
          <div ref={setBody} className="of-stage-body">
            {children}
          </div>
        </StageLayerContext.Provider>
        <div ref={setLayer} className="of-stage-layer" />
      </section>
    </div>
  );
}

/** Enters or leaves the Home browser's fullscreen; nothing on a host without the control. */
export function FullscreenButton({ className }: { className?: string } = {}) {
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
      className={className ? `of-icon-button of-glass ${className}` : "of-icon-button of-glass"}
      aria-label={label}
      title={label}
      onClick={() => fullscreen.setActive(!fullscreen.active)}
    >
      <Icon size={17} strokeWidth={2} aria-hidden="true" />
    </button>
  );
}
