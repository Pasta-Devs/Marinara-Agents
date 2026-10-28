// ──────────────────────────────────────────────
// Otome Forge: the one stylesheet (frame, panels, controls), scoped under `.of-root`
// ──────────────────────────────────────────────
// client-entry.tsx injects it as one <style> while an Otome Forge element is on the page. The look comes from
// `.of-root[data-look]` (tokens.ts); the stage sizes itself from the panel the Engine gives it (container queries), not
// from the window, because the Engine may show its sidebar beside the tab. Motion is calm (400–700 ms) and all of it
// stops under prefers-reduced-motion.
import { fontFaceCss, FONT_STACKS } from "./fonts";
import { LOOK_TOKENS, PALETTE, RARITY, type Look } from "./tokens";

const R = ".of-root";

function lookRules(look: Look): string {
  const declarations = Object.entries(LOOK_TOKENS[look])
    .map(([name, value]) => `--of-${name}: ${value};`)
    .join(" ");
  return `${R}[data-look="${look}"] { ${declarations} color-scheme: ${look === "midnight" ? "dark" : "light"}; }`;
}

const ROOT_RULES = `
${R} {
  --of-midnight: ${PALETTE.midnight}; --of-pearl: ${PALETTE.pearl}; --of-rose: ${PALETTE.rose};
  --of-champagne: ${PALETTE.champagne}; --of-ink: ${PALETTE.ink};
  --of-rarity-silver: ${RARITY.silver}; --of-rarity-violet: ${RARITY.violet}; --of-rarity-gold: ${RARITY.gold};
  --of-font-display: ${FONT_STACKS.display};
  --of-font-body: ${FONT_STACKS.body};
  --of-font-hand: ${FONT_STACKS.hand};
  --of-ease: cubic-bezier(0.22, 0.8, 0.26, 1);
  --of-fade: 560ms;
  --of-glass-blur: blur(18px) saturate(1.45);
  position: relative; display: block; width: 100%; height: 100%; min-height: 0; overflow: hidden; isolation: isolate;
  background: var(--of-backdrop-base); color: var(--of-text);
  font-family: var(--of-font-body); font-size: 1rem; font-weight: 400; line-height: 1.45; text-align: start;
  -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; -webkit-tap-highlight-color: transparent;
  transition: background-color var(--of-fade) var(--of-ease), color var(--of-fade) var(--of-ease);
}
${R} *, ${R} *::before, ${R} *::after { box-sizing: border-box; }
${R} :is(h1, h2, h3, p) { margin: 0; }
${R} button { font: inherit; color: inherit; letter-spacing: inherit; }
${R} :focus-visible { outline: 2px solid var(--of-focus); outline-offset: 3px; }
${R} .of-visually-hidden {
  position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden;
  clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}`;

// The frame: a blurred, dimmed copy of the scene fills the panel, and the 9:16 stage sits centred on it. At phone width
// the stage fills the panel instead. Screens with a place or CG set --of-bg on .of-frame.
const FRAME_RULES = `
${R} .of-frame {
  position: absolute; inset: 0; display: grid; place-items: center; overflow: hidden;
  container: of-frame / size;
}
${R} .of-frame-blur {
  position: absolute; inset: -60px; background: var(--of-bg); background-size: cover; background-position: center;
  filter: blur(34px) saturate(1.2) brightness(var(--of-backdrop-dim)); transform: scale(1.06);
}
${R} .of-frame-blur::after { content: ""; position: absolute; inset: 0; background: var(--of-backdrop-veil); }
${R} .of-stage {
  position: relative; z-index: 1; display: flex; flex-direction: column; overflow: hidden; isolation: isolate;
  height: 100%; max-width: 100%; aspect-ratio: 9 / 16; border-radius: 26px;
  box-shadow: var(--of-stage-shadow); container: of-stage / inline-size;
}
@supports (width: 1cqw) {
  ${R} .of-stage {
    --of-gap: clamp(10px, 3.2cqh, 30px);
    height: auto; max-width: none;
    width: min(calc(100cqw - 2 * var(--of-gap)), calc((100cqh - 2 * var(--of-gap)) * 9 / 16));
  }
}
${R} .of-stage::after {
  content: ""; position: absolute; inset: 0; z-index: 4; border-radius: inherit; pointer-events: none;
  box-shadow: inset 0 0 0 1px var(--of-stage-ring);
}
@container of-frame (max-width: 560px) {
  ${R} .of-stage { width: 100cqw; height: 100cqh; aspect-ratio: auto; border-radius: 0; box-shadow: none; }
  ${R} .of-stage::after { display: none; }
}
${R} .of-scene { position: absolute; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; }
${R} .of-scene-bg {
  position: absolute; inset: 0; background: var(--of-bg); background-size: cover; background-position: center;
}
/* A faint field of stars (Midnight) or pearl glints (Pearl). */
${R} .of-scene-stars {
  position: absolute; inset: 0; opacity: var(--of-star-opacity);
  background-image:
    radial-gradient(1.4px 1.4px at 8% 12%, var(--of-star) 50%, transparent 52%),
    radial-gradient(1px 1px at 22% 30%, var(--of-star) 50%, transparent 52%),
    radial-gradient(1.6px 1.6px at 37% 8%, var(--of-star) 50%, transparent 52%),
    radial-gradient(1px 1px at 52% 22%, var(--of-star) 50%, transparent 52%),
    radial-gradient(1.2px 1.2px at 68% 11%, var(--of-star) 50%, transparent 52%),
    radial-gradient(1.8px 1.8px at 84% 26%, var(--of-star) 50%, transparent 52%),
    radial-gradient(1px 1px at 93% 6%, var(--of-star) 50%, transparent 52%),
    radial-gradient(1.2px 1.2px at 14% 46%, var(--of-star) 50%, transparent 52%),
    radial-gradient(1px 1px at 77% 44%, var(--of-star) 50%, transparent 52%),
    radial-gradient(1.4px 1.4px at 46% 52%, var(--of-star) 50%, transparent 52%),
    radial-gradient(1px 1px at 28% 64%, var(--of-star) 50%, transparent 52%),
    radial-gradient(1.2px 1.2px at 90% 62%, var(--of-star) 50%, transparent 52%),
    radial-gradient(1px 1px at 6% 78%, var(--of-star) 50%, transparent 52%),
    radial-gradient(1.4px 1.4px at 60% 74%, var(--of-star) 50%, transparent 52%);
  animation: of-twinkle 7s ease-in-out infinite alternate;
}
/* Two slow, soft glows drifting behind everything. */
${R} .of-scene-glow {
  position: absolute; width: 85%; aspect-ratio: 1; border-radius: 50%; filter: blur(46px); opacity: 0.55;
  background: radial-gradient(circle, var(--of-glow) 0%, transparent 68%);
  inset-inline-start: -30%; top: 6%; animation: of-drift 22s ease-in-out infinite alternate;
}
${R} .of-scene-glow + .of-scene-glow {
  inset-inline-start: auto; inset-inline-end: -34%; top: 48%; opacity: 0.4;
  background: radial-gradient(circle, rgb(230 201 138 / 0.5) 0%, transparent 68%);
  animation-duration: 28s; animation-direction: alternate-reverse;
}
${R} .of-scene-veil {
  position: absolute; inset: 0;
  background:
    radial-gradient(130% 85% at 50% 42%, transparent 58%, var(--of-vignette) 100%),
    linear-gradient(to top, var(--of-floor) 0%, transparent 26%);
}
${R} .of-stage-body { position: relative; z-index: 1; flex: 1; min-height: 0; display: flex; flex-direction: column; }
${R} .of-screen {
  flex: 1; min-height: 0; display: flex; flex-direction: column;
  animation: of-fade-in var(--of-fade) var(--of-ease) both;
}`;

const GLASS_RULES = `
${R} .of-glass {
  background: var(--of-surface); border: 1px solid var(--of-border);
  box-shadow: inset 0 1px 0 var(--of-highlight), var(--of-panel-shadow);
  -webkit-backdrop-filter: var(--of-glass-blur); backdrop-filter: var(--of-glass-blur);
  transition: background-color var(--of-fade) var(--of-ease), border-color var(--of-fade) var(--of-ease),
    color var(--of-fade) var(--of-ease);
}
${R} .of-glass--strong { background: var(--of-surface-strong); }
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  ${R} .of-glass { background: var(--of-surface-solid); }
}
${R} .of-card { border-radius: 22px; padding: 18px 18px 16px; }`;

const TOPBAR_RULES = `
${R} .of-topbar {
  position: relative; z-index: 3; display: flex; align-items: center; gap: 8px;
  padding: max(12px, env(safe-area-inset-top)) 12px 6px;
}
${R} .of-topbar-spacer { flex: 1; }
${R} .of-chip {
  display: inline-flex; align-items: center; gap: 9px; min-width: 0; max-width: 58%; height: 42px;
  padding-block: 3px; padding-inline: 3px 15px; border-radius: 999px; cursor: pointer;
}
${R} .of-chip:hover { background: var(--of-surface-strong); }
${R} .of-avatar {
  flex: none; display: grid; place-items: center; width: 34px; height: 34px; overflow: hidden; border-radius: 50%;
  background:
    radial-gradient(circle at 30% 24%, rgb(255 255 255 / 0.5), transparent 52%),
    var(--of-li-accent, var(--of-rose));
  color: var(--of-on-accent); font-family: var(--of-font-display); font-weight: 600; font-size: 1rem;
  box-shadow: 0 0 0 2px var(--of-wish-ring), 0 0 14px var(--of-glow-soft);
}
${R} .of-avatar img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 12%; }
${R} .of-avatar--empty {
  background: transparent; color: var(--of-accent-text); box-shadow: none;
  border: 1.5px dashed var(--of-border-strong);
}
${R} .of-chip-name {
  min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
  font-family: var(--of-font-display); font-weight: 600; font-size: 1.14rem; line-height: 1;
}
${R} .of-chip-name--empty { font-style: italic; color: var(--of-text-soft); }
${R} .of-starlight {
  display: inline-flex; align-items: center; gap: 6px; height: 34px; padding-block: 0; padding-inline: 10px 13px;
  border-radius: 999px;
  font-weight: 700; font-size: 0.9rem; font-variant-numeric: tabular-nums; white-space: nowrap;
}
${R} .of-starlight svg { color: var(--of-champagne-text); filter: drop-shadow(0 0 6px var(--of-wish-glow)); }
${R} .of-icon-button {
  flex: none; display: grid; place-items: center; width: 38px; height: 38px; padding: 0; border-radius: 50%;
  cursor: pointer;
}
${R} .of-icon-button:hover { background: var(--of-surface-strong); color: var(--of-accent-text); }`;

const DOCK_RULES = `
${R} .of-dock {
  position: relative; z-index: 3; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); align-items: end;
  margin: 0 10px max(10px, env(safe-area-inset-bottom)); padding: 7px 4px 6px; border-radius: 26px;
}
${R} .of-dock-item {
  display: flex; flex-direction: column; align-items: center; gap: 3px; min-width: 0; padding: 6px 2px 3px;
  border: 0; border-radius: 16px; background: transparent; color: var(--of-text-soft); cursor: pointer;
  transition: color 420ms var(--of-ease), background-color 420ms var(--of-ease);
}
${R} .of-dock-item:hover { color: var(--of-text); background: var(--of-surface-hover); }
${R} .of-dock-item[aria-current="page"] { color: var(--of-accent-text); }
${R} .of-dock-icon { position: relative; display: grid; place-items: center; height: 24px; }
${R} .of-dock-item[aria-current="page"] .of-dock-icon::after {
  content: ""; position: absolute; left: 50%; bottom: -5px; width: 4px; height: 4px; margin-left: -2px;
  border-radius: 50%; background: currentColor; box-shadow: 0 0 8px currentColor;
}
${R} .of-dock-label {
  max-width: 100%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
  font-size: 0.7rem; font-weight: 700; letter-spacing: 0.03em;
}
/* Wish: a raised orb that rises out of the dock. */
${R} .of-dock-wish { margin-top: -34px; padding-top: 0; }
${R} .of-dock-wish:hover { background: transparent; }
${R} .of-dock-wish .of-dock-label { color: var(--of-champagne-text); }
${R} .of-wish {
  position: relative; display: grid; place-items: center; width: 62px; height: 62px;
  transition: transform 520ms var(--of-ease);
}
${R} .of-dock-wish:hover .of-wish { transform: translateY(-2px); }
${R} .of-wish-halo {
  position: absolute; inset: -7px; border-radius: 50%; filter: blur(3px); opacity: 0.9;
  background: conic-gradient(from 0deg, transparent 0deg, rgb(255 236 200 / 0.75) 40deg, transparent 100deg,
    rgb(231 166 184 / 0.7) 170deg, transparent 230deg, rgb(255 236 200 / 0.6) 290deg, transparent 350deg);
  animation: of-spin 10s linear infinite;
}
${R} .of-wish-orb {
  position: relative; display: grid; place-items: center; width: 100%; height: 100%; overflow: hidden;
  border-radius: 50%; color: ${PALETTE.ink};
  background:
    radial-gradient(circle at 32% 24%, rgb(255 250 240 / 0.95) 0%, transparent 40%),
    linear-gradient(150deg, #f6e2b0 0%, ${PALETTE.champagne} 30%, ${PALETTE.rose} 72%, #c48ab9 100%);
  box-shadow: 0 0 0 3px var(--of-wish-ring), 0 10px 24px var(--of-wish-shadow), 0 0 30px var(--of-wish-glow);
}
${R} .of-wish-orb::after {
  content: ""; position: absolute; inset: -40%;
  background: linear-gradient(115deg, transparent 40%, rgb(255 255 255 / 0.55) 50%, transparent 60%);
  transform: translateX(-70%); animation: of-sheen 6.5s var(--of-ease) infinite;
}
${R} .of-wish-orb svg { position: relative; z-index: 1; filter: drop-shadow(0 1px 0 rgb(255 255 255 / 0.5)); }
${R} .of-dock-wish[aria-current="page"] .of-wish-orb {
  box-shadow: 0 0 0 3px var(--of-wish-ring), 0 0 0 6px var(--of-glow-soft), 0 10px 24px var(--of-wish-shadow),
    0 0 36px var(--of-wish-glow);
}`;

const CONTENT_RULES = `
${R} .of-center {
  flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 14px; padding: 20px 26px 28px; text-align: center;
}
${R}[dir="rtl"] .of-back-icon { transform: scaleX(-1); }
${R} .of-emblem {
  position: relative; display: grid; place-items: center; width: 78px; height: 78px; border-radius: 50%;
  color: var(--of-accent-text);
}
${R} .of-emblem::before {
  content: ""; position: absolute; inset: -5px; border-radius: 50%; padding: 1px;
  background: linear-gradient(140deg, var(--of-champagne), transparent 45%, var(--of-rose));
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor; mask-composite: exclude;
}
${R} .of-title {
  font-family: var(--of-font-display); font-weight: 600; font-size: clamp(2rem, 10.5cqw, 2.7rem); line-height: 1.04;
  letter-spacing: 0.01em; background: var(--of-title-ink); -webkit-background-clip: text; background-clip: text;
  color: transparent; padding-bottom: 0.06em;
}
${R} .of-title--hero { font-size: clamp(2.6rem, 14cqw, 3.5rem); }
${R} .of-subtitle {
  font-family: var(--of-font-display); font-style: italic; font-weight: 600; font-size: 1.22rem; line-height: 1.25;
  color: var(--of-text-soft); max-width: 24ch;
}
${R} .of-ornament {
  display: flex; align-items: center; gap: 10px; width: min(210px, 64%); color: var(--of-champagne-text);
}
${R} .of-ornament::before, ${R} .of-ornament::after { content: ""; flex: 1; height: 1px; }
${R} .of-ornament::before { background: linear-gradient(to right, transparent, currentColor); }
${R} .of-ornament::after { background: linear-gradient(to left, transparent, currentColor); }
${R} .of-body { color: var(--of-text-soft); max-width: 32ch; font-size: 0.97rem; }
${R} .of-hand {
  font-family: var(--of-font-hand); font-weight: 500; font-size: 1.55rem; line-height: 1.1;
  color: var(--of-accent-text); transform: rotate(-2.5deg);
}
${R} .of-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 4px; }
${R} .of-button {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 0 22px;
  border: 0; border-radius: 999px; cursor: pointer; font-weight: 700; font-size: 0.95rem; letter-spacing: 0.02em;
  transition: transform 420ms var(--of-ease), box-shadow 420ms var(--of-ease), background-color 420ms var(--of-ease);
}
${R} .of-button:is(:disabled, [aria-disabled="true"]) { cursor: default; opacity: 0.6; }
${R} .of-button--primary {
  color: ${PALETTE.ink};
  background: linear-gradient(135deg, #f3dcaa 0%, ${PALETTE.champagne} 28%, ${PALETTE.rose} 100%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.65), 0 8px 22px var(--of-glow-soft), 0 0 0 1px rgb(255 255 255 / 0.2);
}
${R} .of-button--primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.65), 0 12px 28px var(--of-glow), 0 0 0 1px rgb(255 255 255 / 0.3);
}
${R} .of-button--quiet:hover:not(:disabled) { background: var(--of-surface-strong); }
${R} .of-panel { width: min(100%, 330px); display: flex; flex-direction: column; gap: 12px; text-align: start; }
${R} .of-panel--center { align-items: center; text-align: center; }
${R} .of-panel-title {
  font-family: var(--of-font-display); font-weight: 600; font-size: 1.3rem; line-height: 1.1;
}
${R} .of-hint { color: var(--of-text-soft); font-size: 0.82rem; }
${R} .of-segmented {
  display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; margin: 0; padding: 4px;
  border-radius: 20px; min-width: 0;
}
${R} .of-segment {
  position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
  min-width: 0; min-height: 56px; padding: 6px 6px; border-radius: 16px; cursor: pointer; color: var(--of-text-soft);
  font-size: 0.8rem; font-weight: 700; line-height: 1.15; text-align: center;
  transition: color 420ms var(--of-ease), background-color 420ms var(--of-ease), box-shadow 420ms var(--of-ease);
}
${R} .of-segment span { max-width: 100%; overflow-wrap: anywhere; }
${R} .of-segment svg { flex: none; }
${R} .of-segment:hover { color: var(--of-text); }
${R} .of-segment[data-checked="true"] {
  color: ${PALETTE.ink};
  background: linear-gradient(135deg, #f3dcaa 0%, ${PALETTE.champagne} 30%, ${PALETTE.rose} 100%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.6), 0 4px 14px var(--of-glow-soft);
}
${R} .of-segment:has(input:focus-visible) { outline: 2px solid var(--of-focus); outline-offset: 2px; }
${R} .of-pulse { color: var(--of-accent-text); animation: of-breathe 2.4s ease-in-out infinite; }
${R} .of-error { color: var(--of-text); max-width: 30ch; }`;

const MOTION_RULES = `
@keyframes of-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes of-twinkle { from { opacity: calc(var(--of-star-opacity) * 0.55); } to { opacity: var(--of-star-opacity); } }
@keyframes of-drift { from { transform: translate3d(0, 0, 0) scale(1); } to { transform: translate3d(14%, 8%, 0) scale(1.12); } }
@keyframes of-spin { to { transform: rotate(360deg); } }
@keyframes of-sheen { 0%, 62% { transform: translateX(-70%); } 100% { transform: translateX(70%); } }
@keyframes of-breathe { 0%, 100% { transform: scale(1); opacity: 0.75; } 50% { transform: scale(1.1); opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  ${R}, ${R} *, ${R} *::before, ${R} *::after {
    animation: none !important; transition: none !important; scroll-behavior: auto !important;
  }
}`;

/** The whole stylesheet, fonts first. */
export function otomeForgeStyles(): string {
  return [
    fontFaceCss(),
    ROOT_RULES,
    lookRules("midnight"),
    lookRules("pearl"),
    FRAME_RULES,
    GLASS_RULES,
    TOPBAR_RULES,
    DOCK_RULES,
    CONTENT_RULES,
    MOTION_RULES,
  ].join("\n");
}
