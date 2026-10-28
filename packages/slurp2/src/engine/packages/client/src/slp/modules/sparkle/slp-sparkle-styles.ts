// ──────────────────────────────────────────────
// Slurp's sparkle system: the CSS for the ambient layers in SlpSparkle.tsx (glint, shimmer, ring
// glint, twinkle). Injected once by slp-client-entry.tsx next to the toast styles, so
// it does not depend on the package Tailwind build or the Engine safelist.
//
// Rules (design language §3): ambient cycles are ≥ 4 s and low opacity, they pause off-screen and in
// a hidden tab (`data-slp-paused`, set by `useSlpAmbientPause`), and everything is static under
// reduced motion. Textures are single SVG tiles, not DOM nodes.
// ──────────────────────────────────────────────

const PINK = "#ff7ec1";
const VIOLET = "#c29af1";
const GOLD = "#f6c56b";
const BLUSH = "#ffd6ec";

const STAR_PATH = "M12 0C13 8 16 11 24 12C16 13 13 16 12 24C11 16 8 13 0 12C8 11 11 8 12 0Z";
const HEART_PATH = "M12 21S4 15.8 4 10a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11Z";

type Candy = { kind: "star" | "heart" | "coin"; x: number; y: number; size: number; color: string; opacity: number };

/** One tile of mixed candy: mostly four-point stars, a few tiny hearts and coin glints. */
function candyTile(width: number, height: number, candies: Candy[]) {
  const shapes = candies
    .map(({ kind, x, y, size, color, opacity }) => {
      if (kind === "coin")
        return `<circle cx="${x}" cy="${y}" r="${size / 2}" fill="${color}" fill-opacity="${opacity}"/>`;
      const path = kind === "star" ? STAR_PATH : HEART_PATH;
      return `<path d="${path}" fill="${color}" fill-opacity="${opacity}" transform="translate(${x - size / 2} ${y - size / 2}) scale(${size / 24})"/>`;
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${shapes}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const SHIMMER_TILE = candyTile(120, 90, [
  { kind: "star", x: 18, y: 20, size: 8, color: "#fff", opacity: 0.9 },
  { kind: "star", x: 92, y: 14, size: 5, color: GOLD, opacity: 0.9 },
  { kind: "coin", x: 60, y: 48, size: 2, color: "#fff", opacity: 0.9 },
  { kind: "star", x: 104, y: 70, size: 6, color: BLUSH, opacity: 0.9 },
  { kind: "heart", x: 34, y: 74, size: 5, color: BLUSH, opacity: 0.7 },
]);

export const SLP_SPARKLE_MASKS = {
  star: `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${STAR_PATH}"/></svg>`)}")`,
  heart: `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${HEART_PATH}"/></svg>`)}")`,
};
export const SLP_SPARKLE_COLORS = [PINK, VIOLET, GOLD, PINK, BLUSH] as const;

const EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";

export const SLP_SPARKLE_STYLES = `
  .slp-glint, .slp-shimmer, .slp-ring {
    position: absolute; inset: 0; z-index: -1; pointer-events: none; border-radius: inherit;
  }
  .slp-glint {
    background: linear-gradient(105deg, transparent 38%, rgb(255 255 255 / 0.42) 50%, transparent 62%) no-repeat;
    background-size: 300% 100%; background-position: 130% 0; opacity: 0;
  }
  .slp-shimmer { overflow: hidden; }
  .slp-shimmer::before {
    content: ""; position: absolute; inset: 0; background: ${SHIMMER_TILE}; opacity: 0.32;
  }
  .slp-shimmer::after {
    content: ""; position: absolute; inset: 0; opacity: 0;
    background: linear-gradient(105deg, transparent 35%, rgb(255 255 255 / 0.16) 50%, transparent 65%) no-repeat;
    background-size: 300% 100%; background-position: 130% 0;
  }
  .slp-ring {
    inset: 0; z-index: 1; padding: 2.5px; background: var(--slurp-hero, ${PINK});
    -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
    -webkit-mask-composite: xor; mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0);
    overflow: hidden;
  }
  .slp-ring-seen { background: color-mix(in srgb, var(--slurp-muted, currentColor) 55%, transparent); }
  .slp-ring-seen::before { display: none; }
  .slp-ring::before {
    content: ""; position: absolute; inset: -50%; opacity: 0;
    background: conic-gradient(from 0deg, transparent 0 70%, rgb(255 255 255 / 0.95) 86%, transparent 98%);
  }
  .slp-twinkle {
    position: absolute; pointer-events: none; width: var(--slp-twinkle-size, 10px); height: var(--slp-twinkle-size, 10px);
    background: var(--slp-twinkle-color, ${PINK}); -webkit-mask: ${"var(--slp-star-mask)"} center / contain no-repeat;
    mask: ${"var(--slp-star-mask)"} center / contain no-repeat; opacity: 0.85;
  }
  :root { --slp-star-mask: ${SLP_SPARKLE_MASKS.star}; }
  /* Unlock: the veil over a freshly revealed post clears from the centre out (hole grows, blur
     and sparkle fade). Needs @property for the hole; without it the veil still fades. */
  @property --slp-veil-hole { syntax: "<percentage>"; inherits: false; initial-value: 0%; }
  .slp-veil-dissolve {
    -webkit-mask-image: radial-gradient(circle at 50% 45%, transparent var(--slp-veil-hole), #000 calc(var(--slp-veil-hole) + 22%));
    mask-image: radial-gradient(circle at 50% 45%, transparent var(--slp-veil-hole), #000 calc(var(--slp-veil-hole) + 22%));
    backdrop-filter: blur(14px) saturate(0.9); -webkit-backdrop-filter: blur(14px) saturate(0.9);
  }
  /* A picture that is still being drawn: a soft light sweep over the reserved frame, once every 4 s
     (the sweep itself takes the first 1.8 s). */
  .slp-image-shimmer {
    position: absolute; inset: 0; pointer-events: none;
    background:
      radial-gradient(120% 80% at 20% 10%, color-mix(in srgb, ${PINK} 18%, transparent), transparent 60%),
      radial-gradient(90% 70% at 85% 90%, color-mix(in srgb, ${VIOLET} 16%, transparent), transparent 60%);
  }
  .slp-image-shimmer::after {
    content: ""; position: absolute; inset: 0; opacity: 0.9;
    background: linear-gradient(100deg, transparent 30%, rgb(255 255 255 / 0.10) 45%, rgb(255 255 255 / 0.18) 50%, rgb(255 255 255 / 0.10) 55%, transparent 70%) no-repeat;
    background-size: 250% 100%; background-position: 120% 0;
  }

  @media (prefers-reduced-motion: no-preference) {
    .slp-glint { animation: slp-glint 900ms ${EASE} 180ms 1 both; }
    *:hover > .slp-glint { animation-name: slp-glint-again; }
    .slp-shimmer::before { animation: slp-breathe 5s ease-in-out infinite alternate; }
    .slp-shimmer::after { animation: slp-sheen 7s ${EASE} 600ms infinite; }
    .slp-ring::before { animation: slp-ring-glint 7s ${EASE} infinite; }
    .slp-twinkle { animation: slp-twinkle 700ms ${EASE} var(--slp-twinkle-delay, 0ms) 1 both; }
    .slp-twinkle-fade { animation: slp-twinkle-fade 1500ms ${EASE} var(--slp-twinkle-delay, 0ms) 1 both; }
    .slp-veil-dissolve { animation: slp-veil-dissolve 1000ms cubic-bezier(0.45, 0, 0.3, 1) 120ms both; }
    .slp-image-shimmer::after { animation: slp-image-sweep 4s ease-in-out infinite; }
    .slp-field-glow { animation: slp-field-glow 1800ms ${EASE} both; }
    /* The role-play sign-up (onboarding pass 3): a chapter note pops in, the phone goes live, the
       finale's lines land one after another, and the chosen casting card flies into the scene. */
    .slp-chapter-in { animation: slp-chapter-in 520ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }
    .slp-live-in { animation: slp-live-in 700ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }
    .slp-notice-in { animation: slp-notice-in 420ms ${EASE} var(--slp-notice-delay, 0ms) both; }
    ::view-transition-group(slp-cast) { animation-duration: 560ms; animation-timing-function: ${EASE}; }
    [data-slp-paused], [data-slp-paused]::before, [data-slp-paused]::after { animation-play-state: paused !important; }
  }
  @keyframes slp-glint { 0% { opacity: 1; background-position: 130% 0; } 100% { opacity: 1; background-position: -30% 0; } }
  @keyframes slp-glint-again { 0% { opacity: 1; background-position: 130% 0; } 100% { opacity: 1; background-position: -30% 0; } }
  @keyframes slp-breathe { from { opacity: 0.18; } to { opacity: 0.42; } }
  @keyframes slp-sheen {
    0% { opacity: 1; background-position: 130% 0; } 22% { opacity: 1; background-position: -30% 0; }
    23%, 100% { opacity: 0; background-position: -30% 0; }
  }
  @keyframes slp-ring-glint {
    0% { opacity: 0; transform: rotate(0deg); } 4% { opacity: 1; }
    20% { opacity: 1; transform: rotate(360deg); } 24%, 100% { opacity: 0; transform: rotate(360deg); }
  }
  @keyframes slp-twinkle {
    0% { opacity: 0; transform: scale(0.4) rotate(-20deg); } 60% { opacity: 1; transform: scale(1.15) rotate(8deg); }
    100% { opacity: 0.85; transform: scale(1) rotate(0deg); }
  }
  @keyframes slp-twinkle-fade {
    0% { opacity: 0; transform: scale(0.4) rotate(-20deg); } 28% { opacity: 1; transform: scale(1.15) rotate(8deg); }
    47% { opacity: 0.85; transform: scale(1) rotate(0deg); } 100% { opacity: 0; transform: scale(0.8) rotate(0deg); }
  }
  @media (prefers-reduced-motion: reduce) { .slp-veil-dissolve { display: none; } }
  @keyframes slp-veil-dissolve {
    0% { --slp-veil-hole: 0%; opacity: 1; backdrop-filter: blur(14px) saturate(0.9); -webkit-backdrop-filter: blur(14px) saturate(0.9); }
    25% { --slp-veil-hole: 6%; opacity: 1; backdrop-filter: blur(12px) saturate(0.9); -webkit-backdrop-filter: blur(12px) saturate(0.9); }
    75% { opacity: 0.85; }
    100% { --slp-veil-hole: 110%; opacity: 0; backdrop-filter: blur(0px); -webkit-backdrop-filter: blur(0px); }
  }
  /* A page field the chat just filled lights up, then settles (role-play sign-up). */
  @keyframes slp-field-glow {
    0% { box-shadow: inset 0 0 0 1.5px var(--noodle-accent), 0 0 18px color-mix(in srgb, var(--noodle-accent) 40%, transparent); }
    100% { box-shadow: inset 0 0 0 0 transparent, 0 0 0 transparent; }
  }
  @keyframes slp-chapter-in {
    0% { opacity: 0; transform: translateY(6px) scale(0.86); } 100% { opacity: 1; transform: none; }
  }
  @keyframes slp-live-in {
    0% { opacity: 0; transform: translateY(18px) scale(0.9); } 100% { opacity: 1; transform: none; }
  }
  @keyframes slp-notice-in { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: none; } }
  @keyframes slp-image-sweep { 0% { background-position: 120% 0; } 45%, 100% { background-position: -20% 0; } }
`;
