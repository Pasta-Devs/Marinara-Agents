// ──────────────────────────────────────────────
// Otome Forge: Home's layers, back to front. L0 the place (a soft room-light gradient, with stars after dark), L1 the
// time-of-day tint from the player's zone, L2 the figure (children), L3 light: a window beam and drifting motes. The
// layers fill the whole stage, behind the top bar and the dock; L0 and L3 move with the parallax (styles.ts).
// ──────────────────────────────────────────────
import type { ReactNode } from "react";
import type { SkyPhase } from "../../lib/tap-mood";

interface HomeLayersProps {
  sky: SkyPhase;
  /** L2: the figure on Home. */
  children: ReactNode;
}

export function HomeLayers({ sky, children }: HomeLayersProps) {
  return (
    <div className="of-home-layers" data-sky={sky}>
      {/* ponytail: L0 is the home-mood gradient. Ceiling: no painted place or unlocked CG behind him yet. Upgrade
          path: once M2b's places and album CGs land, the server's home view names one and L0 shows it as an image. */}
      <div className="of-home-l0" data-layer="place" aria-hidden="true">
        <span className="of-home-stars" />
        <span className="of-home-window" />
      </div>
      <div className="of-home-l1" data-layer="tint" aria-hidden="true" />
      {children}
      <div className="of-home-l3" data-layer="light" aria-hidden="true">
        <span className="of-home-beam" />
        <span className="of-home-motes" />
      </div>
      <div className="of-home-shade" aria-hidden="true" />
    </div>
  );
}
