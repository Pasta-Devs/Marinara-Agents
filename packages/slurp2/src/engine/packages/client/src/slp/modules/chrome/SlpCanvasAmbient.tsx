// ──────────────────────────────────────────────
// Ambient canvas (de-vibe pass): the room behind the app takes a soft wash of
// colour from the biggest photo in view, like a TV's ambient light. It replaces the three radial
// orbs. On phones it shows behind the see-through nav and between cards, a little quieter. Calm on purpose: it looks again at most once a second, never while the reader scrolls, only
// changes when another photo leads, and cross-fades slowly; no fade under reduced motion.
// ──────────────────────────────────────────────
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { slpPrefersReducedMotion } from "../../base/chrome/slp-motion";
import { slpAmbientMayLook, slpLeadingPhotoSrc } from "./slp-canvas-ambient";

// A tiny, blurred copy of the photo scaled up to fill the room: the blur is paid on 4 % of the
// area, so it stays cheap on a 1680 px frame.
const LAYER: CSSProperties = {
  position: "absolute",
  left: 0,
  top: 0,
  width: "4%",
  height: "4%",
  transform: "scale(25)",
  transformOrigin: "0 0",
  backgroundSize: "cover",
  backgroundPosition: "center",
  filter: "blur(1.6px) saturate(1.35)",
};

export function SlpCanvasAmbient() {
  const ref = useRef<HTMLDivElement>(null);
  const [layers, setLayers] = useState<{ current: string | null; previous: string | null }>({
    current: null,
    previous: null,
  });

  useEffect(() => {
    const frame = ref.current?.parentElement;
    if (!frame) return;
    let lastScrollAt = Number.NEGATIVE_INFINITY;
    const onScroll = () => {
      lastScrollAt = performance.now();
    };
    // Measuring every picture each second is real work on a long feed: with nothing scrolled since
    // the last look, check again only every 3 s (for pictures that finished loading).
    let lastLookAt = Number.NEGATIVE_INFINITY;
    const look = () => {
      const now = performance.now();
      if (document.visibilityState !== "visible" || !slpAmbientMayLook(now, lastScrollAt)) return;
      if (lastScrollAt < lastLookAt && now - lastLookAt < 3000) return;
      lastLookAt = now;
      const src = slpLeadingPhotoSrc(frame);
      if (src) setLayers((now) => (now.current === src ? now : { current: src, previous: now.current }));
    };
    look();
    const timer = window.setInterval(look, 1000);
    // Capture: the scrollers are the screens inside the frame, and scroll events do not bubble.
    frame.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      window.clearInterval(timer);
      frame.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, []);

  const still = slpPrefersReducedMotion();
  return (
    <div
      ref={ref}
      aria-hidden="true"
      data-slp-canvas-ambient=""
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden opacity-[0.16] @min-[1024px]:opacity-[0.22]"
      // Its own layer for good, so a cross-fade starting or ending never re-layers the screen above it.
      style={{ transform: "translateZ(0)" }}
    >
      {layers.previous && !still && (
        <div key={layers.previous} style={{ ...LAYER, backgroundImage: `url("${layers.previous}")` }} />
      )}
      {layers.current && (
        <div
          key={layers.current}
          className={still ? undefined : "slp-ambient-in"}
          style={{ ...LAYER, backgroundImage: `url("${layers.current}")` }}
        />
      )}
    </div>
  );
}
