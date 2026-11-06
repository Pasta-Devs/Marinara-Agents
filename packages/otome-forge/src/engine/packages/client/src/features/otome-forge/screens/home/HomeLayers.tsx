// ──────────────────────────────────────────────
// Otome Forge: Home's layers, back to front. L0 the place: his newest unlocked CG, else the newest painted place (the
// server names it, S/routes/home.ts), over a soft room-light gradient with stars after dark, which is all L0 shows
// without one or when it fails to load; L1 the time-of-day tint from the player's zone (the sky is .of-home's
// data-sky); L2 the figure (children), laid out by Home's grid; L3 light: a window beam and drifting motes, with the
// shade over it. The back (L0, L1) and the front (L3, shade) fill the whole stage, behind the top bar and the dock; L0
// and L3 move with the parallax (styles.ts). #2128: each figurine bought in Wish's Shop stands in L0, small, on a
// ledge of its own that suits the plain room and a painted backdrop alike, behind him and every control: cut out like a
// look (LookImage: its cut-out, else the free display cleanup of the painted image), and a faint stand-in while it
// paints or until it is clean (#2138).
// ──────────────────────────────────────────────
import { useState, type ReactNode } from "react";
import { LookImage } from "../../components/LookImage";
import type { HomeView } from "../../shared/api-types";

interface HomeLayersProps {
  /** L0's picture, or null for the gradient alone. */
  backdrop: HomeView["backdrop"];
  /** The figurines bought, once painted or while they paint, on their ledge in L0. */
  figurines?: HomeView["figurines"];
  /** L2: what stands between the place and the light (the figure's cell, and his nameplate under it). */
  children: ReactNode;
}

export function HomeLayers({ backdrop, figurines = [], children }: HomeLayersProps) {
  const [broken, setBroken] = useState<string | null>(null);
  const shown = backdrop && backdrop.url !== broken ? backdrop : null;
  return (
    <>
      <div className="of-home-layers">
        <div className="of-home-l0" data-layer="place" data-backdrop={shown?.kind} aria-hidden="true">
          <span className="of-home-stars" />
          <span className="of-home-window" />
          {shown ? (
            <img
              key={shown.url}
              className="of-home-backdrop"
              src={shown.url}
              alt=""
              decoding="async"
              onError={() => setBroken(shown.url)}
            />
          ) : null}
          {figurines.length ? (
            <span className="of-home-figurines">
              {figurines.map((figurine) => (
                <LookImage
                  key={figurine.li}
                  className="of-home-figurine"
                  src={figurine.url}
                  alt=""
                  decoding="async"
                  fallback={<span className="of-home-figurine of-home-figurine--painting" />}
                />
              ))}
            </span>
          ) : null}
        </div>
        <div className="of-home-l1" data-layer="tint" aria-hidden="true" />
      </div>
      {children}
      <div className="of-home-front">
        <div className="of-home-l3" data-layer="light" aria-hidden="true">
          <span className="of-home-beam" />
          <span className="of-home-motes" />
        </div>
        <div className="of-home-shade" aria-hidden="true" />
      </div>
    </>
  );
}
