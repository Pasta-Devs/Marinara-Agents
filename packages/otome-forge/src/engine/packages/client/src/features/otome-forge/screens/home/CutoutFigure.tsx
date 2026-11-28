// ──────────────────────────────────────────────
// Otome Forge: the figure on Home (layer L2). His cut-out when the server has made one, else his uncut look under a
// slow pan with soft edges, else his initials on his accent colour (an image that fails to load steps down the same
// way); the player the same way (a painted look, then her
// persona avatar in a cameo, then initials). Three wrappers move it: parallax (20 px at most, from the pointer),
// a slow drift and breathing (scale 1 → 1.006 over 4.5 s). Every one of them is off under reduced motion.
// His touch zones (#2152: head, cheek, chest, hand, and the crotch under NSFW Heat, as Home lists them) sit on the art,
// or under the medallion as labelled buttons when there is none.
// ──────────────────────────────────────────────
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { initialsOf } from "../../lib/accent";
import type { TapMode } from "../../lib/tap-mood";
import type { TapZone } from "../../shared/home";
import type { Face } from "../../shared/faces";

/**
 * What the figure shows. `cut` is a transparent cut-out; `avatar` is a square persona avatar, shown as a cameo.
 * `fallback` is shown instead if this one fails to load (a cut-out's uncut image, a face's plain look).
 */
export interface FigureArt {
  url: string;
  cut: boolean;
  kind: "look" | "avatar";
  fallback?: FigureArt;
}

// The stored `heart` zone reads as the chest (#2152).
const ZONE_KEYS: Record<TapZone, string> = {
  head: "ui.otomeForge.home.tapHead",
  cheek: "ui.otomeForge.home.tapCheek",
  heart: "ui.otomeForge.home.tapHeart",
  hand: "ui.otomeForge.home.tapHand",
  crotch: "ui.otomeForge.home.tapCrotch",
};

const clamp = (value: number) => Math.max(-1, Math.min(1, value));

/** The first art down the fallbacks that has not failed to load, or null for the initials. */
function firstUnbroken(art: FigureArt | null, broken: readonly string[]): FigureArt | null {
  let step = art;
  while (step && broken.includes(step.url)) step = step.fallback ?? null;
  return step;
}

/**
 * Pointer parallax for Home: sets `--of-px` and `--of-py` (−1..1) on the element, once per frame. The layers turn them
 * into at most 20 px of movement. Touch never moves it (a tap is a tap), and reduced motion turns it off.
 */
export function useParallax(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const set = (x: number, y: number) => {
    const element = ref.current;
    if (!element) return;
    element.style.setProperty("--of-px", x.toFixed(3));
    element.style.setProperty("--of-py", y.toFixed(3));
  };
  useEffect(() => {
    if (!enabled) set(0, 0);
    return () => cancelAnimationFrame(frame.current);
  }, [enabled]);
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (!enabled || event.pointerType === "touch") return;
    const box = event.currentTarget.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const x = clamp(((event.clientX - box.left) / box.width) * 2 - 1);
    const y = clamp(((event.clientY - box.top) / box.height) * 2 - 1);
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => set(x, y));
  };
  const onPointerLeave = () => {
    cancelAnimationFrame(frame.current);
    set(0, 0);
  };
  return { ref, onPointerMove, onPointerLeave };
}

interface CutoutFigureProps {
  who: "him" | "me";
  name: string;
  accent: string;
  art: FigureArt | null;
  /** The figure's accessible name ("Ilvar Thorne, tender"). */
  label: string;
  face?: Face | "";
  mood?: TapMode;
  /** The zones he shows, top to bottom (C/lib/tap-mood.ts shownZones); the player's figure has none. */
  zones?: readonly TapZone[];
  onTap?: (zone: TapZone) => void;
}

export function CutoutFigure({
  who,
  name,
  accent,
  art,
  label,
  face = "",
  mood = "fond",
  zones = [],
  onTap,
}: CutoutFigureProps) {
  const { t } = useTranslation();
  // An image that fails to load steps down to its fallback, and past the last one to the initials.
  const [broken, setBroken] = useState<readonly string[]>([]);
  const [burst, setBurst] = useState<{ id: number; zone: TapZone } | null>(null);
  const shown = firstUnbroken(art, broken);
  const onArt = !!shown && shown.kind === "look";

  const tap = (zone: TapZone) => {
    setBurst((current) => ({ id: (current?.id ?? 0) + 1, zone }));
    onTap?.(zone);
  };
  const targets = onTap ? (
    <div
      className={onArt ? "of-tap-zones" : "of-tap-pills"}
      role="group"
      aria-label={t("ui.otomeForge.home.tapGroup", { name })}
    >
      {zones.map((zone) =>
        onArt ? (
          <button
            key={zone}
            type="button"
            className="of-tap-zone"
            data-zone={zone}
            aria-label={t(ZONE_KEYS[zone])}
            onClick={() => tap(zone)}
          />
        ) : (
          <button key={zone} type="button" className="of-tap-pill of-glass" data-zone={zone} onClick={() => tap(zone)}>
            {t(ZONE_KEYS[zone])}
          </button>
        ),
      )}
      {burst ? <span key={burst.id} className="of-tap-burst" data-zone={burst.zone} aria-hidden="true" /> : null}
    </div>
  ) : null;

  return (
    <div
      className="of-figure"
      data-who={who}
      data-art={shown ? shown.kind : "none"}
      data-cut={shown?.cut ? "true" : "false"}
      data-face={face || "plain"}
      data-mood={mood}
      style={{ "--of-li-accent": accent } as CSSProperties}
    >
      <div className="of-figure-parallax">
        <div className="of-figure-drift">
          <div className="of-figure-breathe">
            <span className="of-figure-aura" aria-hidden="true" />
            {shown ? (
              <img
                className="of-figure-img"
                src={shown.url}
                alt={label}
                draggable={false}
                onError={() => setBroken((list) => [...list, shown.url])}
              />
            ) : (
              <div className="of-figure-medallion" role="img" aria-label={label}>
                <span className="of-figure-ring" aria-hidden="true" />
                <span className="of-figure-initials" aria-hidden="true">
                  {initialsOf(name)}
                </span>
              </div>
            )}
            {onArt ? targets : null}
          </div>
        </div>
      </div>
      {onArt ? null : targets}
    </div>
  );
}
