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

// Pages that scroll (setup, forging, the bible, settings), their sections, and the controls inside them.
const PAGE_RULES = `
${R} .of-page {
  flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 14px;
  padding: 6px 16px 28px; scrollbar-width: thin; scrollbar-color: var(--of-border-strong) transparent;
}
${R} .of-page > .of-actions { margin-top: 0; }
${R} .of-page-head { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; padding-top: 6px; }
${R} .of-page-head--compact { align-items: flex-start; text-align: start; gap: 2px; padding-top: 0; }
${R} .of-title--page { font-size: clamp(1.55rem, 7.4cqw, 2rem); }
${R} .of-section {
  display: flex; flex-direction: column; gap: 10px; padding: 14px 14px 16px; border-radius: 20px; min-width: 0;
}
${R} .of-section > .of-button { align-self: flex-start; }
${R} .of-section-title { font-family: var(--of-font-display); font-weight: 600; font-size: 1.22rem; line-height: 1.12; }
${R} .of-step-body { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
${R} .of-step-note { align-self: center; text-align: center; max-width: 26ch; margin: 2px 0 4px; font-size: 1.35rem; }
${R} .of-faint { color: var(--of-text-faint); }
/* An empty live region stays in the accessibility tree (a region that appears with its message is often not read),
   hidden visually and out of the flex gap. */
${R} .of-live:empty {
  position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden;
  clip: rect(0 0 0 0); border: 0;
}
${R} .of-notice {
  display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; border-radius: 14px; font-size: 0.86rem;
  background: rgb(230 201 138 / 0.12); border: 1px solid rgb(230 201 138 / 0.32); color: var(--of-text);
}
${R} .of-notice svg { flex: none; margin-top: 2px; color: var(--of-champagne-text); }
${R} .of-notice--error { background: var(--of-tint); border-color: var(--of-danger); }
${R} .of-empty {
  display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 16px 14px; border-radius: 16px;
  text-align: center; color: var(--of-text-soft); font-size: 0.88rem; border: 1px dashed var(--of-border-strong);
}
${R} .of-empty svg { color: var(--of-accent-text); }
${R} .of-badge {
  display: inline-flex; align-items: center; gap: 3px; margin-inline-start: auto; padding: 2px 8px; border-radius: 999px;
  font-size: 0.66rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; white-space: nowrap;
  color: ${PALETTE.ink}; background: linear-gradient(135deg, #f3dcaa, ${PALETTE.champagne});
}
${R} .of-badge--soft { background: var(--of-tint-strong); color: var(--of-accent-text); }
${R} code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.78rem; overflow-wrap: anywhere;
}
${R} .of-button--small { min-height: 36px; padding: 0 15px; font-size: 0.85rem; gap: 6px; }
${R} .of-button--text {
  min-height: 32px; padding: 0 8px; background: transparent; color: var(--of-accent-text); border-radius: 10px;
}
${R} .of-button--text:hover { background: var(--of-surface-hover); }
${R} .of-button--danger {
  color: #fff; background: linear-gradient(135deg, #b8456a, #8f2f52);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.3), 0 8px 20px rgb(143 47 82 / 0.32);
}
${R} .of-button--forge { padding: 0 24px; }
${R} .of-inline-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
${R} .of-actions--start { justify-content: flex-start; }
${R} .of-cost {
  display: inline-flex; align-items: center; gap: 6px; font-size: 0.8rem; font-weight: 700;
  color: var(--of-champagne-text);
}
${R} .of-cost svg { flex: none; }
${R} .of-cost-note { font-weight: 500; color: var(--of-text-soft); }`;

const FORM_RULES = `
${R} .of-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
${R} .of-label { font-size: 0.82rem; font-weight: 700; letter-spacing: 0.02em; color: var(--of-text); }
${R} .of-input {
  width: 100%; min-height: 42px; padding: 10px 14px; border-radius: 14px; border: 1px solid var(--of-border);
  background: var(--of-input-bg); color: var(--of-text); font: inherit; font-size: 0.95rem; line-height: 1.4;
  box-shadow: inset 0 1px 2px rgb(0 0 0 / 0.08);
  transition: border-color 360ms var(--of-ease), background-color 360ms var(--of-ease), box-shadow 360ms var(--of-ease);
}
${R} .of-input::placeholder { color: var(--of-text-faint); }
${R} .of-input:hover { border-color: var(--of-border-strong); }
${R} .of-input:focus { outline: none; }
${R} .of-input:focus-visible {
  border-color: var(--of-focus); background: var(--of-input-bg-focus);
  box-shadow: 0 0 0 3px var(--of-glow-soft), inset 0 1px 2px rgb(0 0 0 / 0.08);
}
${R} .of-input:disabled { opacity: 0.6; }
${R} .of-textarea { resize: vertical; min-height: 64px; line-height: 1.5; }
${R} .of-select {
  appearance: none; padding-inline-end: 36px; cursor: pointer;
  background-image:
    linear-gradient(45deg, transparent 50%, currentColor 50%), linear-gradient(135deg, currentColor 50%, transparent 50%);
  background-position: calc(100% - 19px) 52%, calc(100% - 14px) 52%;
  background-size: 5px 5px, 5px 5px; background-repeat: no-repeat;
}
${R}[dir="rtl"] .of-select { background-position: 14px 52%, 19px 52%; }
${R} .of-select option { background: var(--of-option-bg); color: var(--of-text); }
${R} .of-field-hint {
  display: flex; justify-content: space-between; gap: 10px; font-size: 0.78rem; color: var(--of-text-soft);
}
${R} .of-counter { flex: none; font-variant-numeric: tabular-nums; color: var(--of-text-faint); }
${R} .of-select-row { display: flex; align-items: center; gap: 8px; min-width: 0; }
${R} .of-select-row > .of-input { flex: 1; min-width: 0; }
${R} .of-search { margin-bottom: 4px; }
${R} .of-fieldset { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; border: 0; min-width: 0; }
${R} .of-legend {
  padding: 0; margin-bottom: 4px; font-family: var(--of-font-display); font-weight: 600; font-size: 1.18rem;
  line-height: 1.15;
}
${R} .of-legend--small {
  font-family: var(--of-font-body); font-size: 0.82rem; font-weight: 700; letter-spacing: 0.02em; margin-bottom: 2px;
}
/* Choice cards: a radio group of frosted cards; the chosen one glows champagne. */
${R} .of-choices { display: flex; flex-direction: column; gap: 8px; }
${R} .of-choice {
  position: relative; display: flex; flex-direction: column; gap: 3px; padding: 12px 14px; border-radius: 16px;
  cursor: pointer; transition: transform 420ms var(--of-ease), box-shadow 420ms var(--of-ease),
    background-color 420ms var(--of-ease), border-color 420ms var(--of-ease);
}
${R} .of-choice:hover { border-color: var(--of-border-strong); transform: translateY(-1px); }
${R} .of-choice[data-checked="true"] {
  border-color: rgb(230 201 138 / 0.75);
  background: linear-gradient(135deg, var(--of-tint-strong), rgb(230 201 138 / 0.14)), var(--of-surface);
  box-shadow: inset 0 0 0 1px rgb(230 201 138 / 0.5), 0 8px 24px var(--of-glow-soft);
}
${R} .of-choice:has(input:focus-visible) { outline: 2px solid var(--of-focus); outline-offset: 2px; }
${R} .of-choice-head { display: flex; align-items: center; gap: 8px; min-width: 0; }
${R} .of-choice-icon { flex: none; color: var(--of-accent-text); }
${R} .of-choice-title { font-family: var(--of-font-display); font-weight: 600; font-size: 1.14rem; line-height: 1.1; }
${R} .of-choice-text { font-size: 0.83rem; color: var(--of-text-soft); }
${R} .of-choice:has(.of-choice-icon) .of-choice-text { padding-inline-start: 26px; }
/* Pills: a compact radio group. */
${R} .of-pills { display: flex; flex-wrap: wrap; gap: 6px; }
${R} .of-pill {
  position: relative; display: inline-flex; align-items: center; justify-content: center; min-height: 34px;
  padding: 0 14px; border-radius: 999px; border: 1px solid var(--of-border); background: var(--of-surface);
  color: var(--of-text-soft); font-size: 0.84rem; font-weight: 700; cursor: pointer; white-space: nowrap;
  transition: color 360ms var(--of-ease), background-color 360ms var(--of-ease), box-shadow 360ms var(--of-ease);
}
${R} .of-pill:hover { color: var(--of-text); border-color: var(--of-border-strong); }
${R} .of-pill[data-checked="true"] {
  color: ${PALETTE.ink}; border-color: transparent;
  background: linear-gradient(135deg, #f3dcaa 0%, ${PALETTE.champagne} 30%, ${PALETTE.rose} 100%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.55), 0 3px 12px var(--of-glow-soft);
}
${R} .of-pill:has(input:focus-visible) { outline: 2px solid var(--of-focus); outline-offset: 2px; }
${R} .of-pills--small .of-pill { min-height: 30px; padding: 0 11px; font-size: 0.76rem; }
${R} .of-fieldset:disabled .of-pill { cursor: default; opacity: 0.62; }
${R} .of-pronouns { display: flex; flex-direction: column; gap: 8px; }
${R} .of-pronoun-custom { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
/* Switch: a checkbox drawn as a track and a pearl knob. */
${R} .of-switch-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
${R} .of-switch-text { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
${R} .of-switch {
  appearance: none; position: relative; flex: none; width: 46px; height: 26px; margin: 2px 0 0; border-radius: 999px;
  border: 1px solid var(--of-border-strong); background: var(--of-input-bg); cursor: pointer;
  transition: background-color 360ms var(--of-ease), border-color 360ms var(--of-ease);
}
${R} .of-switch::before {
  content: ""; position: absolute; top: 2px; inset-inline-start: 2px; width: 20px; height: 20px; border-radius: 50%;
  background: var(--of-pearl); box-shadow: 0 1px 4px rgb(0 0 0 / 0.3); transition: transform 360ms var(--of-ease);
}
${R} .of-switch:checked {
  border-color: transparent; background: linear-gradient(135deg, ${PALETTE.champagne}, ${PALETTE.rose});
}
${R} .of-switch:checked::before { transform: translateX(20px); }
${R}[dir="rtl"] .of-switch:checked::before { transform: translateX(-20px); }
${R} .of-switch:focus-visible { outline: 2px solid var(--of-focus); outline-offset: 3px; }
/* Details: a quiet disclosure with a turning chevron. */
${R} .of-details { border-radius: 16px; border: 1px solid var(--of-border); }
${R} .of-summary {
  display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 11px 14px; cursor: pointer;
  list-style: none; font-weight: 700; font-size: 0.88rem; border-radius: 16px;
}
${R} .of-summary::-webkit-details-marker { display: none; }
${R} .of-summary::after {
  content: ""; flex: none; width: 7px; height: 7px; border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor; transform: rotate(45deg) translateY(-2px); opacity: 0.7;
  transition: transform 360ms var(--of-ease);
}
${R} .of-details[open] > .of-summary::after { transform: rotate(-135deg) translateY(-2px); }
${R} .of-details-body { display: flex; flex-direction: column; gap: 12px; padding: 2px 14px 14px; }
${R} .of-details.of-glass > .of-summary { font-family: var(--of-font-display); font-weight: 600; font-size: 1.15rem; }`;

const SETUP_RULES = `
${R} .of-wizard { flex: 1; min-height: 0; display: flex; flex-direction: column; }
${R} .of-wizard-head {
  display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 0 16px 8px;
}
${R} .of-wizard-head .of-title--page { font-size: clamp(1.35rem, 6.4cqw, 1.75rem); }
${R} .of-stepper { position: relative; display: flex; align-items: center; gap: 7px; margin: 0; padding: 0; list-style: none; }
${R} .of-stepper-item { position: relative; display: flex; }
${R} .of-stepper-item + .of-stepper-item::before {
  content: ""; position: absolute; top: 50%; inset-inline-end: 100%; width: 7px; height: 1px;
  background: var(--of-border-strong);
}
${R} .of-stepper-dot {
  display: grid; place-items: center; width: 24px; height: 24px; padding: 0; border-radius: 50%; cursor: pointer;
  border: 1px solid var(--of-border-strong); background: var(--of-surface); color: var(--of-text-faint);
  font-size: 0.7rem; font-weight: 800; transition: transform 420ms var(--of-ease), box-shadow 420ms var(--of-ease);
}
${R} .of-stepper-dot[data-state="done"] { color: ${PALETTE.ink}; border-color: transparent; background: ${PALETTE.champagne}; }
${R} .of-stepper-dot[data-state="current"] {
  color: ${PALETTE.ink}; border-color: transparent; transform: scale(1.14);
  background: linear-gradient(135deg, #f3dcaa, ${PALETTE.rose});
  box-shadow: 0 0 0 3px var(--of-glow-soft), 0 0 14px var(--of-glow);
}
${R} .of-stepper-dot[aria-disabled="true"] { cursor: default; opacity: 0.55; }
${R} .of-wizard-body {
  flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; padding: 8px 16px 20px;
  scrollbar-width: thin; scrollbar-color: var(--of-border-strong) transparent;
  -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 12px); mask-image: linear-gradient(to bottom, transparent 0, #000 12px);
}
${R} .of-step-count {
  font-size: 0.72rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--of-champagne-text);
}
${R} .of-step-title {
  margin-top: -8px; font-family: var(--of-font-display); font-weight: 600; font-size: clamp(1.7rem, 8cqw, 2.2rem);
  line-height: 1.05; background: var(--of-title-ink); -webkit-background-clip: text; background-clip: text;
  color: transparent; padding-bottom: 0.06em;
}
${R} .of-step-title:focus { outline: none; }
${R} .of-step-title:focus-visible { outline: 2px solid var(--of-focus); outline-offset: 4px; border-radius: 6px; }
${R} .of-wizard-reset { display: flex; flex-direction: column; align-items: center; gap: 2px; margin-top: 6px; text-align: center; }
${R} .of-wizard-foot {
  display: flex; flex-direction: column; gap: 6px; margin: 0 10px max(10px, env(safe-area-inset-bottom));
  padding: 10px; border-radius: 24px;
}
${R} .of-wizard-actions { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
${R} .of-foot-status { padding: 0 6px; font-size: 0.84rem; color: var(--of-text-soft); text-align: center; }
${R} .of-foot-status--error { color: var(--of-danger); font-weight: 700; }
/* Persona and card tiles. */
${R} .of-tiles {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(86px, 1fr)); gap: 8px; margin: 0; padding: 2px;
  list-style: none;
}
${R} .of-tiles--scroll { max-height: 330px; overflow-y: auto; scrollbar-width: thin; }
${R} .of-tile {
  position: relative; display: flex; flex-direction: column; align-items: center; gap: 6px; width: 100%; height: 100%;
  padding: 10px 6px 9px; border-radius: 16px; cursor: pointer; text-align: center; color: var(--of-text);
  transition: transform 420ms var(--of-ease), box-shadow 420ms var(--of-ease), border-color 420ms var(--of-ease);
}
${R} .of-tile:hover { transform: translateY(-1px); border-color: var(--of-border-strong); }
${R} .of-tile[data-checked="true"] {
  border-color: rgb(230 201 138 / 0.8); background: linear-gradient(160deg, var(--of-tint-strong), var(--of-surface));
  box-shadow: inset 0 0 0 1px rgb(230 201 138 / 0.5), 0 6px 18px var(--of-glow-soft);
}
${R} .of-tile[aria-disabled="true"] { opacity: 0.5; cursor: default; transform: none; }
${R} .of-tile:has(input:focus-visible) { outline: 2px solid var(--of-focus); outline-offset: 2px; }
${R} .of-tile-name {
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden;
  font-size: 0.78rem; font-weight: 700; line-height: 1.2; overflow-wrap: anywhere;
}
${R} .of-tile-check {
  position: absolute; top: 6px; inset-inline-end: 6px; display: grid; place-items: center; width: 18px; height: 18px;
  border-radius: 50%; background: ${PALETTE.champagne}; color: ${PALETTE.ink};
}
${R} .of-avatar--hero { box-shadow: 0 0 0 3px var(--of-wish-ring), 0 0 0 7px var(--of-li-accent, var(--of-rose)), 0 0 36px var(--of-glow); }
/* The chosen cast. */
${R} .of-members { display: flex; flex-direction: column; gap: 10px; margin: 0; padding: 0; list-style: none; }
${R} .of-member {
  display: flex; flex-direction: column; gap: 10px; padding: 12px; border-radius: 18px;
  border-inline-start: 3px solid var(--of-li-accent, var(--of-rose));
}
${R} .of-member-head { display: flex; align-items: center; gap: 10px; }
${R} .of-member-title { display: flex; flex-direction: column; flex: 1; min-width: 0; }
${R} .of-member-name {
  font-family: var(--of-font-display); font-weight: 600; font-size: 1.2rem; line-height: 1.1;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${R} .of-member-source { font-size: 0.76rem; color: var(--of-text-soft); }
${R} .of-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }
${R} .of-trait {
  display: inline-flex; align-items: center; gap: 2px; padding-block: 3px; padding-inline: 12px 4px;
  border-radius: 999px; background: var(--of-tint); border: 1px solid var(--of-border-strong);
  font-size: 0.82rem; font-weight: 700;
}
${R} .of-trait-remove {
  display: grid; place-items: center; width: 24px; height: 24px; padding: 0; border: 0; border-radius: 50%;
  background: transparent; color: var(--of-text-soft); cursor: pointer;
}
${R} .of-trait-remove:hover { background: var(--of-surface-hover); color: var(--of-text); }
/* Archetype cards. */
${R} .of-archetypes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 0; padding: 0; list-style: none; }
${R} .of-archetype {
  position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: 4px; width: 100%;
  height: 100%; padding: 12px 12px 12px; border-radius: 16px; cursor: pointer; text-align: start; color: var(--of-text);
  transition: transform 420ms var(--of-ease), border-color 420ms var(--of-ease), box-shadow 420ms var(--of-ease);
}
${R} .of-archetype:hover { transform: translateY(-1px); border-color: var(--of-border-strong); box-shadow: 0 8px 22px var(--of-glow-soft); }
${R} .of-archetype[aria-disabled="true"] { opacity: 0.5; cursor: default; transform: none; }
${R} .of-archetype-sigil {
  display: grid; place-items: center; width: 36px; height: 36px; margin-bottom: 2px; border-radius: 50%;
  color: var(--of-accent-text); background: radial-gradient(circle at 30% 25%, var(--of-tint-strong), transparent 70%);
  border: 1px solid var(--of-border-strong);
}
${R} .of-archetype-name { font-family: var(--of-font-display); font-weight: 600; font-size: 1.06rem; line-height: 1.1; }
${R} .of-archetype-seed { font-size: 0.74rem; line-height: 1.35; color: var(--of-text-soft); }
${R} .of-archetype-add { position: absolute; top: 10px; inset-inline-end: 10px; color: var(--of-champagne-text); }
/* Lines & Veils. */
${R} .of-limits { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; }
${R} .of-limit {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 10px; padding: 9px 0;
  border-bottom: 1px solid var(--of-border);
}
${R} .of-limit:last-child { border-bottom: 0; }
${R} .of-limit-name { display: flex; flex-direction: column; gap: 2px; font-size: 0.88rem; font-weight: 700; min-width: 0; }
${R} .of-limit-fixed {
  display: inline-flex; align-items: center; gap: 4px; font-size: 0.7rem; font-weight: 600; color: var(--of-text-soft);
}
${R} .of-custom-limits { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; margin-top: 4px; }
${R} .of-custom-limit {
  display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 6px; width: 100%;
}
/* Review. */
${R} .of-review { display: flex; flex-direction: column; gap: 8px; padding: 14px; border-radius: 20px; }
${R} .of-review-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
${R} .of-review-title { font-family: var(--of-font-display); font-weight: 600; font-style: italic; font-size: 1.3rem; }
${R} .of-review-premise {
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 6; overflow: hidden; white-space: pre-line;
  font-size: 0.9rem;
}
${R} .of-review-person { display: flex; align-items: center; gap: 10px; min-width: 0; }
${R} .of-review-person > div { min-width: 0; }
${R} .of-review-cast { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
${R} .of-review-list {
  display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 5px 14px; margin: 0; align-items: baseline;
}
${R} .of-review-list dt { font-size: 0.78rem; color: var(--of-text-soft); }
${R} .of-review-list dd { margin: 0; font-size: 0.88rem; font-weight: 700; overflow-wrap: anywhere; }
${R} .of-review--cost { border-color: rgb(230 201 138 / 0.55); }
/* Forging. */
${R} .of-forge-steps { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; }
${R} .of-forge-step {
  display: grid; grid-template-columns: 28px minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 8px 2px;
}
${R} .of-forge-step + .of-forge-step { border-top: 1px solid var(--of-border); }
${R} .of-forge-icon {
  display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; color: var(--of-text-faint);
  border: 1px solid var(--of-border-strong);
}
${R} .of-forge-step[data-state="done"] .of-forge-icon { color: ${PALETTE.ink}; background: ${PALETTE.champagne}; border-color: transparent; }
${R} .of-forge-step[data-state="running"] .of-forge-icon {
  color: var(--of-accent-text); border-color: var(--of-accent-text); box-shadow: 0 0 14px var(--of-glow);
  animation: of-breathe 2.4s ease-in-out infinite;
}
${R} .of-forge-step[data-state="failed"] .of-forge-icon { color: var(--of-danger); border-color: var(--of-danger); }
${R} .of-forge-step[data-state="waiting-consent"] .of-forge-icon { color: var(--of-champagne-text); border-style: dashed; }
${R} .of-forge-text { display: flex; flex-direction: column; min-width: 0; }
${R} .of-forge-name { font-size: 0.92rem; font-weight: 700; }
${R} .of-forge-state { font-size: 0.75rem; color: var(--of-text-soft); }
${R} .of-forge-step[data-state="failed"] .of-forge-state { color: var(--of-danger); font-weight: 700; }
${R} .of-forge-why { font-size: 0.78rem; color: var(--of-text-soft); }
${R} .of-forge-error { font-family: ui-monospace, Menlo, monospace; font-size: 0.7rem; color: var(--of-text-faint); overflow-wrap: anywhere; }
${R} .of-forge-retry { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
${R} .of-paint-offer { align-items: center; text-align: center; }
${R} .of-paint-offer > .of-button { align-self: center; }
${R} .of-cast {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; margin: 0; padding: 0;
  list-style: none;
}
${R} .of-cast-card {
  display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 14px 8px 8px; border-radius: 18px;
  text-align: center; background: linear-gradient(180deg, color-mix(in srgb, var(--of-li-accent) 22%, transparent), transparent 70%), var(--of-surface);
  border: 1px solid var(--of-border); border-top: 3px solid var(--of-li-accent, var(--of-rose));
}
${R} .of-cast-name { margin-top: 4px; font-family: var(--of-font-display); font-weight: 600; font-size: 1.15rem; line-height: 1.1; }
/* The story list. */
${R} .of-runs { display: flex; flex-direction: column; gap: 10px; width: 100%; margin: 0; padding: 0; list-style: none; }
${R} .of-run { display: flex; align-items: center; gap: 4px; padding: 4px; border-radius: 20px; }
${R} .of-run[data-current="true"] { border-color: rgb(230 201 138 / 0.6); box-shadow: inset 0 0 0 1px rgb(230 201 138 / 0.35), var(--of-panel-shadow); }
${R} .of-run-open {
  flex: 1; min-width: 0; display: flex; align-items: center; gap: 12px; padding: 10px 10px; border: 0; border-radius: 16px;
  background: transparent; color: var(--of-text); text-align: start; cursor: pointer;
}
${R} .of-run-open:hover { background: var(--of-surface-hover); }
${R} .of-run-icon { flex: none; color: var(--of-accent-text); }
${R} .of-run-text { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
${R} .of-run-title {
  font-family: var(--of-font-display); font-weight: 600; font-size: 1.22rem; line-height: 1.1;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${R} .of-run-delete { background: transparent; border: 0; color: var(--of-text-soft); }
${R} .of-run-delete:hover { color: var(--of-danger); background: var(--of-surface-hover); }
/* The bible. */
${R} .of-spoiler { align-items: center; text-align: center; padding: 22px 18px; color: var(--of-accent-text); }
${R} .of-spoiler .of-body { color: var(--of-text-soft); }
${R} .of-bible-toolbar { display: flex; justify-content: flex-end; gap: 8px; }
${R} .of-bible-fields { display: flex; flex-direction: column; gap: 10px; margin: 0; }
${R} .of-bible-row { display: flex; flex-direction: column; gap: 2px; }
${R} .of-bible-row dt {
  font-size: 0.7rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--of-champagne-text);
}
${R} .of-bible-row dd { margin: 0; font-size: 0.92rem; white-space: pre-wrap; overflow-wrap: anywhere; }
${R} .of-bible-list { margin: 0; padding-inline-start: 18px; }
${R} .of-bible-secret, ${R} .of-bible-stage {
  display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; border-radius: 14px; background: var(--of-surface-hover);
}
/* Settings. */
${R} .of-tabs {
  display: flex; gap: 4px; padding: 4px; border-radius: 18px; overflow-x: auto; scrollbar-width: none; flex: none;
}
${R} .of-tabs::-webkit-scrollbar { display: none; }
${R} .of-tab {
  flex: none; display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; border: 0; border-radius: 14px;
  background: transparent; color: var(--of-text-soft); font-size: 0.8rem; font-weight: 700; white-space: nowrap;
  cursor: pointer; transition: color 360ms var(--of-ease), background-color 360ms var(--of-ease);
}
${R} .of-tab:hover { color: var(--of-text); }
${R} .of-tab[aria-selected="true"] {
  color: ${PALETTE.ink}; background: linear-gradient(135deg, #f3dcaa 0%, ${PALETTE.champagne} 30%, ${PALETTE.rose} 100%);
}
${R} .of-tab-panel { display: flex; flex-direction: column; gap: 12px; border-radius: 12px; }
${R} .of-tab-panel:focus { outline: none; }
${R} .of-tab-panel:focus-visible { outline: 2px solid var(--of-focus); outline-offset: 4px; }
${R} .of-settings .of-panel { width: 100%; }
${R} .of-save-bar { display: flex; flex-direction: column; align-items: stretch; gap: 6px; padding-top: 4px; }
${R} .of-statements { display: flex; flex-direction: column; gap: 10px; margin: 0; padding: 0; list-style: none; }
${R} .of-statements li { display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: 10px; font-size: 0.86rem; }
${R} .of-statements svg { margin-top: 2px; color: var(--of-champagne-text); }
${R} .of-debug-errors { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
${R} .of-debug-errors li { display: flex; flex-direction: column; gap: 2px; font-size: 0.8rem; }`;

// Dialogs render into the stage's own layer (Stage.tsx), over the top bar and the dock.
const DIALOG_RULES = `
${R} .of-stage-layer { position: absolute; inset: 0; z-index: 6; pointer-events: none; }
${R} .of-stage-layer:empty { display: none; }
${R} .of-dialog-backdrop {
  position: absolute; inset: 0; display: grid; place-items: center; padding: 16px; pointer-events: auto;
  background: var(--of-scrim); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
  animation: of-fade-in 360ms var(--of-ease) both;
}
${R} .of-dialog {
  display: flex; flex-direction: column; gap: 12px; width: min(100%, 360px); max-height: 100%; overflow-y: auto;
  padding: 20px 18px 16px; border-radius: 24px; animation: of-rise 480ms var(--of-ease) both;
}
${R} .of-dialog--wide { width: min(100%, 440px); }
${R} .of-dialog:focus { outline: none; }
${R} .of-dialog-title { font-family: var(--of-font-display); font-weight: 600; font-size: 1.5rem; line-height: 1.1; }
${R} .of-dialog-body { display: flex; flex-direction: column; gap: 10px; }
${R} .of-dialog-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; margin-top: 4px; }
${R} .of-gate-statement {
  margin: 2px 0; padding: 12px 14px; border-inline-start: 3px solid ${PALETTE.champagne};
  border-radius: 4px 14px 14px 4px; background: var(--of-tint);
  font-family: var(--of-font-display); font-style: italic; font-weight: 600; font-size: 1.22rem; line-height: 1.25;
}
${R}[dir="rtl"] .of-gate-statement { border-radius: 14px 4px 4px 14px; }`;

const MOTION_RULES = `
@keyframes of-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes of-rise { from { opacity: 0; transform: translateY(12px) scale(0.98); } to { opacity: 1; transform: none; } }
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
    PAGE_RULES,
    FORM_RULES,
    SETUP_RULES,
    DIALOG_RULES,
    MOTION_RULES,
  ].join("\n");
}
