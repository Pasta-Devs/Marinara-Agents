// ──────────────────────────────────────────────
// Otome Forge: the one stylesheet (frame, panels, controls), scoped under `.of-root`
// ──────────────────────────────────────────────
// client-entry.tsx injects it as one <style> while an Otome Forge element is on the page. The look comes from
// `.of-root[data-look]` (tokens.ts); the stage sizes itself from the panel the Engine gives it (container queries), not
// from the window, because the Engine may show its sidebar beside the tab. Motion is calm (400–700 ms) and all of it
// stops under prefers-reduced-motion.
import { DATE_NIGHT_RULES } from "../screens/dates/date-night-styles";
import { READ_HIM_RULES } from "../screens/dates/ReadHim";
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
  position: relative; display: block; width: 100%; height: 100%; min-height: 0; overflow: clip; isolation: isolate;
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
// The frame, the stage and the scenes clip (overflow: clip), never hide: a hidden box is still a scroll container, and
// the backdrop's blur overhang let a scrollIntoView (a native control's focus, a screen reader, a test's click) shift
// the whole stage out of place.
const FRAME_RULES = `
${R} .of-frame {
  position: absolute; inset: 0; display: grid; place-items: center; overflow: clip;
  container: of-frame / size;
}
${R} .of-frame-blur {
  position: absolute; inset: -60px; background: var(--of-bg); background-size: cover; background-position: center;
  filter: blur(34px) saturate(1.2) brightness(var(--of-backdrop-dim)); transform: scale(1.06);
}
${R} .of-frame-blur::after { content: ""; position: absolute; inset: 0; background: var(--of-backdrop-veil); }
${R} .of-stage {
  position: relative; z-index: 1; display: flex; flex-direction: column; overflow: clip; isolation: isolate;
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
${R} .of-scene { position: absolute; inset: 0; z-index: 0; overflow: clip; pointer-events: none; }
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
/* background-color, not the shorthand, which would reset the arrow .of-select draws with background-image. */
${R} .of-input:focus-visible {
  border-color: var(--of-focus); background-color: var(--of-input-bg-focus);
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

// Wish, the Wardrobe and the Album (M4). A wish arrives over the whole stage, always under the night sky (Midnight's
// tokens, whatever the look), in its rarity's colour: silver 3★, violet 4★, gold 5★.
const midnightTokens = () =>
  Object.entries(LOOK_TOKENS.midnight)
    .map(([name, value]) => `--of-${name}: ${value};`)
    .join(" ");

const COLLECTION_RULES = `
${R} [data-rarity="silver"] {
  --of-rarity: var(--of-rarity-silver); --of-rarity-ink: var(--of-rarity-silver-ink); --of-rarity-glow: rgb(201 207 218 / 0.5);
}
${R} [data-rarity="violet"] {
  --of-rarity: var(--of-rarity-violet); --of-rarity-ink: var(--of-rarity-violet-ink); --of-rarity-glow: rgb(183 156 242 / 0.55);
}
${R} [data-rarity="gold"] {
  --of-rarity: var(--of-rarity-gold); --of-rarity-ink: var(--of-rarity-gold-ink); --of-rarity-glow: rgb(230 201 138 / 0.65);
}
/* Stars and pity rings use the rarity's ink: the colour itself on the night, darker on Pearl. */
${R} .of-stars { display: inline-flex; gap: 1px; color: var(--of-rarity-ink, var(--of-champagne-text)); }
${R} .of-stars svg { filter: drop-shadow(0 0 4px var(--of-rarity-glow, transparent)); }
${R} .of-tab { position: relative; }
${R} .of-tab-dot {
  width: 7px; height: 7px; border-radius: 50%; background: ${PALETTE.rose}; box-shadow: 0 0 8px ${PALETTE.rose};
}
/* An item's picture, or a quiet card in their colour with their initials. */
${R} .of-item-art {
  position: relative; display: grid; place-items: center; flex: none; width: 100%; aspect-ratio: 3 / 4;
  overflow: clip; border-radius: 14px; isolation: isolate;
  background:
    radial-gradient(90% 70% at 30% 20%, rgb(255 255 255 / 0.28), transparent 60%),
    radial-gradient(120% 90% at 80% 110%, color-mix(in srgb, var(--of-rarity, var(--of-champagne)) 55%, transparent), transparent 70%),
    linear-gradient(160deg, color-mix(in srgb, var(--of-li-accent, var(--of-rose)) 70%, #2b2236), #1b1533);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.14);
}
${R} .of-item-art img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 18%; }
${R} .of-item-initials {
  font-family: var(--of-font-display); font-weight: 600; font-size: 1.6rem; color: rgb(255 250 244 / 0.92);
  text-shadow: 0 2px 14px rgb(0 0 0 / 0.3);
}
${R} .of-item-art[data-painting="true"]::after, ${R} .of-banner-hero[data-painting="true"]::after,
${R} .of-ward-frame[data-painting="true"]::after {
  content: ""; position: absolute; inset: -40%; z-index: 1;
  background: linear-gradient(115deg, transparent 40%, rgb(255 255 255 / 0.32) 50%, transparent 60%);
  animation: of-sheen 2.6s var(--of-ease) infinite;
}

/* Wish's banners. */
${R} .of-page-head--tight { gap: 2px; padding-top: 0; }
${R} .of-page-head--tight .of-hand { font-size: 1.35rem; }
${R} .of-banner {
  display: flex; flex-direction: column; gap: 12px; padding: 10px 10px 14px; border-radius: 24px; min-width: 0;
  border-color: color-mix(in srgb, var(--of-li-accent, var(--of-champagne)) 45%, var(--of-border));
}
${R} .of-banner[data-kind="my-wardrobe"] { --of-li-accent: var(--of-rarity-violet); }
${R} .of-banner > :not(.of-banner-hero) { margin-inline: 4px; }
${R} .of-banner-back { align-self: flex-start; }
${R} .of-banner-hero {
  /* Square, but never more than about 44% of the panel's height (the frame is a size container), so the pity and the
     wish buttons stay in view on a short desktop panel. */
  position: relative; display: grid; aspect-ratio: 1; max-height: 44cqh; overflow: clip; border-radius: 18px;
  isolation: isolate;
  background:
    radial-gradient(80% 60% at 20% 10%, rgb(255 236 210 / 0.4), transparent 60%),
    radial-gradient(90% 70% at 90% 90%, color-mix(in srgb, var(--of-li-accent, var(--of-rose)) 60%, transparent), transparent 70%),
    linear-gradient(170deg, #3a2a5f, #15122b);
  box-shadow: 0 16px 36px var(--of-wish-shadow), inset 0 0 0 1px rgb(255 255 255 / 0.16);
}
${R} .of-banner-img {
  position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 22%;
  animation: of-banner-drift 24s ease-in-out infinite alternate;
}
${R} .of-banner-quiet { position: absolute; inset: 0; display: grid; place-items: center; padding-bottom: 30%; }
${R} .of-banner-quiet .of-item-initials { font-size: 4.2rem; opacity: 0.85; }
${R} .of-banner-shade {
  position: absolute; inset: 0;
  background: linear-gradient(to top, rgb(12 8 26 / 0.92) 0%, rgb(12 8 26 / 0.55) 34%, transparent 62%);
}
${R} .of-banner-caption {
  position: absolute; inset-inline: 0; bottom: 0; z-index: 2; display: flex; flex-direction: column; gap: 4px;
  padding: 16px 16px 14px; color: #fff8f1; text-shadow: 0 1px 10px rgb(0 0 0 / 0.45);
}
${R} .of-banner-eyebrow {
  font-size: 0.68rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: ${PALETTE.champagne};
}
${R} .of-banner-title {
  font-family: var(--of-font-display); font-weight: 600; font-size: clamp(1.6rem, 8cqw, 2.1rem); line-height: 1.04;
}
${R} .of-banner-featured {
  display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-weight: 700; font-size: 0.9rem;
  --of-rarity: var(--of-rarity-gold); --of-rarity-glow: rgb(230 201 138 / 0.65);
}
/* On the banner art's dark shade in either look, so the bright gold, not Pearl's ink. */
${R} .of-banner-featured .of-stars { color: var(--of-rarity-gold); }
${R} .of-banner-featured .of-badge { margin-inline-start: 0; }
${R} .of-banner-who { font-family: var(--of-font-display); font-style: italic; font-size: 1.05rem; opacity: 0.9; }
${R} .of-banner-premise { max-width: none; font-family: var(--of-font-display); font-size: 1.08rem; line-height: 1.35; }
${R} .of-banner-pulls { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
${R} .of-banner-pull { display: flex; flex-direction: column; align-items: stretch; gap: 4px; min-width: 0; }
/* On a narrow stage the price moves under the label, and a long label wraps; the icon never shrinks. */
${R} .of-banner-wish {
  width: 100%; min-height: 52px; padding: 6px 10px; flex-wrap: wrap; gap: 2px 6px; font-size: 0.9rem; line-height: 1.15;
  text-align: center;
}
${R} .of-banner-wish svg { flex: none; }
${R} .of-banner-price {
  display: inline-flex; flex: none; align-items: center; gap: 3px; padding: 2px 8px; border-radius: 999px; white-space: nowrap;
  font-variant-numeric: tabular-nums; font-size: 0.8rem; background: rgb(255 255 255 / 0.32);
}
${R} .of-button--quiet .of-banner-price { background: var(--of-surface-hover); color: var(--of-champagne-text); }
${R} .of-banner-short { font-size: 0.74rem; text-align: center; color: var(--of-text-soft); }
${R} .of-banner-contents .of-details-body { gap: 10px; }
${R} .of-banner-row { display: grid; grid-template-columns: 52px minmax(0, 1fr); gap: 8px; align-items: start; }
${R} .of-banner-row > .of-stars { padding-top: 4px; }
${R} .of-banner-items {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(64px, 1fr)); gap: 8px; margin: 0; padding: 0;
  list-style: none;
}
${R} .of-banner-item { position: relative; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
${R} .of-banner-item .of-item-art { border-radius: 10px; }
${R} .of-banner-item .of-item-initials { font-size: 0.95rem; }
${R} .of-banner-item-name {
  font-size: 0.7rem; line-height: 1.2; color: var(--of-text-soft); overflow: hidden; display: -webkit-box;
  -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}
${R} .of-banner-item-owned {
  position: absolute; top: 4px; inset-inline-end: 4px; display: grid; place-items: center; width: 18px; height: 18px;
  border-radius: 50%; color: ${PALETTE.ink}; background: ${PALETTE.champagne};
}
${R} .of-banner-new .of-planning { align-items: flex-start; text-align: start; }
${R} .of-item-cost { display: flex; flex-direction: column; gap: 4px; }
/* The exact pity: "5★ in 23", with two rings that fill as the guarantee nears. */
${R} .of-pity {
  display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 12px;
  border-radius: 16px; background: var(--of-surface-hover);
}
${R} .of-pity-text { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px; font-weight: 700; font-size: 0.9rem; }
${R} .of-pity-five { color: var(--of-champagne-text); font-size: 1.02rem; }
${R} .of-pity-dot { color: var(--of-text-faint); }
${R} .of-pity-rings { display: flex; gap: 6px; flex: none; }
${R} .of-pity-ring {
  --of-pity: 0; position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center;
  width: 44px; height: 44px; border-radius: 50%;
  background: conic-gradient(var(--of-rarity-ink) calc(var(--of-pity) * 360deg), var(--of-border) 0);
}
${R} .of-pity-ring::before { content: ""; position: absolute; inset: 3px; border-radius: 50%; background: var(--of-surface-solid); }
${R} .of-pity-value, ${R} .of-pity-label { position: relative; line-height: 1; }
${R} .of-pity-value { font-weight: 800; font-size: 0.84rem; font-variant-numeric: tabular-nums; }
${R} .of-pity-label { margin-top: 1px; font-size: 0.5rem; font-weight: 800; color: var(--of-rarity-ink); }
/* Echoes: every past banner, still there. */
${R} .of-echoes { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
${R} .of-echo {
  display: grid; grid-template-columns: 52px minmax(0, 1fr) auto; align-items: center; gap: 12px; width: 100%;
  padding: 8px 12px 8px 8px; border-radius: 18px; cursor: pointer; text-align: start; color: var(--of-text);
  border-inline-start: 3px solid var(--of-li-accent, var(--of-rose));
}
${R} .of-echo:hover { background: var(--of-surface-strong); }
${R} .of-echo .of-item-art { border-radius: 12px; }
${R} .of-echo .of-item-initials { font-size: 1rem; }
${R} .of-echo-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
${R} .of-echo-kind { font-size: 0.68rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--of-accent-text); }
${R} .of-echo-title { font-family: var(--of-font-display); font-weight: 600; font-size: 1.16rem; line-height: 1.1; }
${R} .of-echo-dates { font-size: 0.76rem; color: var(--of-text-soft); }
${R} .of-selector-list { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; padding: 0; list-style: none; }
${R} .of-wishes-foot { text-align: center; }

/* A wish arriving: the whole stage, under the night sky. */
${R} .of-takeover {
  ${midnightTokens()} color-scheme: dark;
  position: absolute; inset: 0; z-index: 1; display: flex; flex-direction: column; overflow: clip;
  pointer-events: auto; color: var(--of-text); background: #0b0818;
  animation: of-fade-in 420ms var(--of-ease) both;
}
${R} .of-takeover:focus { outline: none; }
${R} .of-takeover-sky {
  position: absolute; inset: 0;
  background:
    radial-gradient(70% 45% at 50% 46%, var(--of-rarity-glow, rgb(230 201 138 / 0.4)), transparent 70%),
    radial-gradient(1.4px 1.4px at 12% 16%, #fff 50%, transparent 52%),
    radial-gradient(1px 1px at 30% 8%, #fff 50%, transparent 52%),
    radial-gradient(1.6px 1.6px at 72% 12%, #fff 50%, transparent 52%),
    radial-gradient(1px 1px at 88% 30%, #fff 50%, transparent 52%),
    radial-gradient(1.2px 1.2px at 8% 64%, #fff 50%, transparent 52%),
    radial-gradient(1px 1px at 92% 74%, #fff 50%, transparent 52%),
    radial-gradient(1.4px 1.4px at 58% 90%, #fff 50%, transparent 52%),
    linear-gradient(180deg, #1d1640 0%, #0f0b24 60%, #08061a 100%);
  animation: of-twinkle 6s ease-in-out infinite alternate;
}
${R} .of-takeover-top {
  position: absolute; top: max(12px, env(safe-area-inset-top)); inset-inline-end: 12px; z-index: 5;
}
${R} .of-takeover-body { position: relative; z-index: 1; flex: 1; min-height: 0; display: flex; flex-direction: column; }
/* The sealed letter: drag the seal up to draw it out. */
${R} .of-letter {
  --of-letter-open: 0; position: relative; flex: 1; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 22px; padding: 64px 20px 32px;
}
${R} .of-letter-rays {
  position: absolute; left: 50%; top: 44%; width: 160%; aspect-ratio: 1; translate: -50% -50%; pointer-events: none;
  opacity: calc(0.25 + var(--of-letter-open) * 0.75); scale: calc(0.6 + var(--of-letter-open) * 0.6);
  background: conic-gradient(from 0deg, transparent 0deg, var(--of-rarity-glow) 12deg, transparent 26deg,
    transparent 52deg, var(--of-rarity-glow) 64deg, transparent 80deg, transparent 112deg,
    var(--of-rarity-glow) 124deg, transparent 140deg, transparent 172deg, var(--of-rarity-glow) 184deg,
    transparent 200deg, transparent 232deg, var(--of-rarity-glow) 244deg, transparent 260deg,
    transparent 292deg, var(--of-rarity-glow) 304deg, transparent 320deg);
  -webkit-mask: radial-gradient(circle, #000 18%, transparent 62%); mask: radial-gradient(circle, #000 18%, transparent 62%);
  animation: of-spin 40s linear infinite;
}
${R} .of-letter-envelope {
  position: relative; width: min(78%, 300px); aspect-ratio: 4 / 3; perspective: 900px;
  filter: drop-shadow(0 22px 40px rgb(0 0 0 / 0.5));
}
${R} .of-letter-back, ${R} .of-letter-pocket, ${R} .of-letter-flap { position: absolute; inset: 0; border-radius: 10px; }
${R} .of-letter-back { background: linear-gradient(160deg, #efe2d2, #d9c6b3); }
${R} .of-letter-sheet {
  position: absolute; inset: 8% 7% 6%; display: flex; flex-direction: column; gap: 10px; padding: 14px 16px;
  border-radius: 6px; background: linear-gradient(180deg, #fffaf3, #f6ecdf); color: ${PALETTE.ink};
  box-shadow: 0 2px 10px rgb(60 30 40 / 0.2);
  translate: 0 calc(var(--of-letter-open) * -58%); transition: translate 380ms var(--of-ease);
}
${R} .of-letter-to {
  position: absolute; inset-inline: 0; bottom: 12%; z-index: 1; text-align: center; pointer-events: none;
  font-family: var(--of-font-hand); font-size: 1.6rem; line-height: 1; color: #a04d6b;
}
${R} .of-letter-lines {
  flex: 1; background: repeating-linear-gradient(to bottom, transparent 0 13px, rgb(160 77 107 / 0.2) 13px 14px);
}
${R} .of-letter-pocket {
  background: linear-gradient(200deg, #f6ebde, #e4d2bf);
  clip-path: polygon(0 34%, 50% 70%, 100% 34%, 100% 100%, 0 100%);
}
${R} .of-letter-flap {
  background: linear-gradient(180deg, #e8d8c6, #d8c3ae); transform-origin: top center;
  clip-path: polygon(0 0, 100% 0, 50% 62%);
  rotate: x calc(var(--of-letter-open) * 180deg); opacity: calc(1 - var(--of-letter-open) * 1.3);
  transition: rotate 380ms var(--of-ease), opacity 380ms var(--of-ease);
}
${R} .of-letter-seal {
  position: absolute; left: 50%; top: calc(44% - 22px); z-index: 2; display: grid; place-items: center;
  width: 72px; height: 72px; margin-left: -36px; padding: 0; border: 0; border-radius: 50%; cursor: grab;
  touch-action: none; -webkit-user-select: none; user-select: none;
  background: radial-gradient(circle at 34% 28%, rgb(255 255 255 / 0.65), transparent 38%),
    radial-gradient(circle, var(--of-rarity) 0%, color-mix(in srgb, var(--of-rarity) 70%, #3b1f2e) 100%);
  color: color-mix(in srgb, var(--of-rarity) 40%, #3b1f2e);
  box-shadow: 0 0 0 4px rgb(255 255 255 / 0.18), 0 0 calc(24px + var(--of-letter-open) * 50px) var(--of-rarity-glow),
    inset 0 -4px 10px rgb(0 0 0 / 0.25);
  translate: 0 calc(var(--of-letter-open) * -150px); transition: translate 380ms var(--of-ease);
  animation: of-seal-glow 2.4s ease-in-out infinite;
}
${R} .of-letter-seal:active { cursor: grabbing; transition: none; }
${R} .of-letter-seal:focus-visible { outline: 3px solid var(--of-focus); outline-offset: 5px; }
${R} .of-letter-wax { display: grid; place-items: center; width: 46px; height: 46px; border-radius: 50%;
  box-shadow: inset 0 0 0 2px rgb(255 255 255 / 0.3), inset 0 2px 6px rgb(0 0 0 / 0.2); }
${R} .of-letter-hint { position: relative; max-width: 26ch; text-align: center; font-size: 0.92rem; color: var(--of-text-soft); }
${R} .of-letter[data-opening="true"] .of-letter-seal { opacity: 0; scale: 1.6; transition: opacity 600ms var(--of-ease), scale 600ms var(--of-ease); }
${R} .of-letter[data-opening="true"] .of-letter-rays { opacity: 1; scale: 1.3; transition: opacity 700ms, scale 900ms var(--of-ease); }
/* A 5★: the stage dims and gathers gold, then the art pans and the title rises. */
${R} .of-reveal { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: flex-end; }
${R} .of-reveal-art {
  position: absolute; inset: 0; overflow: clip; background: #07050f; opacity: 0;
  transition: opacity 900ms var(--of-ease);
}
${R} .of-reveal-art img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 28%; }
${R} .of-reveal-quiet {
  position: absolute; inset: 0; display: grid; place-items: center; padding-bottom: 36%;
  background: radial-gradient(70% 50% at 50% 34%, color-mix(in srgb, var(--of-li-accent, var(--of-rose)) 70%, transparent), transparent 72%),
    linear-gradient(180deg, #2a1f4a, #0c0920);
}
${R} .of-reveal-quiet .of-item-initials { font-size: 5rem; }
${R} .of-reveal[data-shown="true"] .of-reveal-art { opacity: 1; }
${R} .of-reveal[data-shown="true"][data-motion="true"] .of-reveal-art img {
  animation: of-cg-pan 6s cubic-bezier(0.32, 0.06, 0.3, 1) both;
}
${R} .of-reveal-glow {
  position: absolute; left: 50%; top: 40%; width: 140%; aspect-ratio: 1; translate: -50% -50%; pointer-events: none;
  background: radial-gradient(circle, rgb(255 240 200 / 0.95) 0%, rgb(230 201 138 / 0.6) 18%, transparent 52%);
  animation: of-gather 600ms var(--of-ease) both;
}
${R} .of-reveal[data-shown="true"] .of-reveal-glow { animation: of-flash 900ms var(--of-ease) both; }
${R} .of-reveal-card {
  position: relative; z-index: 2; display: flex; flex-direction: column; align-items: center; gap: 6px;
  margin: 0 14px max(16px, env(safe-area-inset-bottom)); padding: 18px 16px 16px; border-radius: 24px;
  text-align: center; background: linear-gradient(180deg, rgb(20 14 40 / 0.55), rgb(14 10 30 / 0.88));
  border: 1px solid rgb(230 201 138 / 0.4); -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px);
  box-shadow: 0 0 40px rgb(230 201 138 / 0.25);
  opacity: 0; translate: 0 18px; transition: opacity 700ms var(--of-ease) 300ms, translate 700ms var(--of-ease) 300ms;
}
${R} .of-reveal[data-shown="true"] .of-reveal-card { opacity: 1; translate: 0 0; }
${R} .of-reveal-count { font-size: 0.72rem; font-weight: 800; letter-spacing: 0.1em; color: var(--of-text-faint); }
${R} .of-reveal-kind {
  display: inline-flex; align-items: center; gap: 8px; font-size: 0.74rem; font-weight: 800; letter-spacing: 0.1em;
  text-transform: uppercase; color: ${PALETTE.champagne};
  --of-rarity: var(--of-rarity-gold); --of-rarity-glow: rgb(230 201 138 / 0.65);
}
${R} .of-reveal-title {
  font-family: var(--of-font-display); font-weight: 600; font-size: clamp(2rem, 10cqw, 2.6rem); line-height: 1.02;
  background: linear-gradient(100deg, #f6e2b0 0%, #fff6ea 50%, ${PALETTE.champagne} 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent; padding-bottom: 0.06em;
}
${R} .of-reveal-title:focus { outline: none; }
${R} .of-reveal-who { font-family: var(--of-font-display); font-style: italic; font-size: 1.15rem; color: var(--of-text-soft); }
${R} .of-reveal-line, ${R} .of-reveal-premise {
  max-width: 30ch; font-family: var(--of-font-display); font-size: 1.12rem; line-height: 1.35; color: var(--of-text);
}
${R} .of-reveal-line { font-style: italic; color: color-mix(in srgb, var(--of-li-accent, var(--of-rose)) 55%, #fff); }
${R} .of-reveal-actions { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 10px; margin-top: 6px; }
${R} .of-reveal-open { display: flex; flex-direction: column; align-items: center; gap: 4px; }
/* The results: one card, or ten. */
${R} .of-pulls {
  flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 12px;
  padding: 58px 16px max(18px, env(safe-area-inset-bottom));
}
${R} .of-pulls-title {
  text-align: center; font-family: var(--of-font-display); font-weight: 600; font-size: 2rem; line-height: 1.05;
  background: var(--of-title-ink); -webkit-background-clip: text; background-clip: text; color: transparent;
}
${R} .of-pulls-title:focus { outline: none; }
${R} .of-pulls-summary { text-align: center; font-size: 0.86rem; color: var(--of-text-soft); }
${R} .of-pulls-refund { color: var(--of-champagne-text); font-weight: 700; }
${R} .of-pulls-grid {
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 0; padding: 0; list-style: none;
}
${R} .of-pulls-grid > li { animation: of-rise 520ms var(--of-ease) both; animation-delay: calc(var(--of-i) * 90ms); }
${R} .of-pulls[data-count="1"] .of-pulls-grid { grid-template-columns: minmax(0, 220px); justify-content: center; }
${R} .of-pull-tile {
  position: relative; display: grid; grid-template-columns: 52px minmax(0, 1fr); align-items: center; gap: 10px;
  width: 100%; height: 100%; padding: 6px 8px 6px 6px; border-radius: 16px; cursor: pointer; text-align: start;
  color: var(--of-text); background: var(--of-surface); border: 1px solid color-mix(in srgb, var(--of-rarity) 55%, transparent);
  box-shadow: inset 0 1px 0 var(--of-highlight), 0 0 18px color-mix(in srgb, var(--of-rarity-glow) 40%, transparent);
  transition: transform 360ms var(--of-ease), box-shadow 360ms var(--of-ease);
}
${R} .of-pull-tile:hover { transform: translateY(-1px); background: var(--of-surface-strong); }
${R} .of-pull-tile[data-rarity="gold"] {
  background: linear-gradient(135deg, rgb(230 201 138 / 0.22), transparent 60%), var(--of-surface);
  box-shadow: inset 0 1px 0 var(--of-highlight), 0 0 26px rgb(230 201 138 / 0.45);
}
${R} .of-pull-tile .of-item-art { border-radius: 11px; }
${R} .of-pull-tile .of-item-initials { font-size: 1rem; }
${R} .of-pull-tile-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
${R} .of-pull-tile-title {
  font-family: var(--of-font-display); font-weight: 600; font-size: 1.02rem; line-height: 1.1; overflow: hidden;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}
${R} .of-pull-tile-kind { font-size: 0.68rem; color: var(--of-text-soft); }
${R} .of-pulls[data-count="1"] .of-pull-tile { grid-template-columns: 1fr; padding: 8px; text-align: center; }
${R} .of-pulls[data-count="1"] .of-pull-tile-text { align-items: center; padding-bottom: 4px; }
${R} .of-pulls[data-count="1"] .of-pull-tile .of-item-initials { font-size: 2.4rem; }
@container of-stage (min-width: 460px) {
  ${R} .of-pulls:not([data-count="1"]) .of-pulls-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); }
  ${R} .of-pulls:not([data-count="1"]) .of-pull-tile { grid-template-columns: 1fr; padding: 6px; text-align: center; }
  ${R} .of-pulls:not([data-count="1"]) .of-pull-tile-text { align-items: center; }
  ${R} .of-pulls:not([data-count="1"]) .of-pull-tile-title { font-size: 0.86rem; }
}
${R} .of-ribbon {
  position: absolute; top: 4px; inset-inline-start: -4px; z-index: 2; padding: 2px 8px 2px 7px; border-radius: 4px 999px 999px 4px;
  font-size: 0.6rem; font-weight: 900; letter-spacing: 0.12em; color: ${PALETTE.ink};
  background: linear-gradient(135deg, #f3dcaa, ${PALETTE.rose}); box-shadow: 0 2px 8px rgb(0 0 0 / 0.3);
}
${R}[dir="rtl"] .of-ribbon { border-radius: 999px 4px 4px 999px; }
${R} .of-ribbon--inline { position: static; border-radius: 999px; }
/* Over the art's corner (where a first copy's ribbon goes), never over the stars beside it. */
${R} .of-pull-refund {
  position: absolute; top: 4px; inset-inline-start: 2px; z-index: 2; display: inline-flex; align-items: center; gap: 2px;
  padding: 1px 6px; border-radius: 999px; font-size: 0.62rem; font-weight: 800; color: var(--of-champagne-text);
  background: rgb(12 9 28 / 0.75);
}
${R} .of-pulls-actions { display: flex; justify-content: center; padding-top: 4px; }
${R} .of-pulls--detail { gap: 10px; }
${R} .of-pulls-back { align-self: flex-start; }
/* An item's page (Wish's results, the Album). */
${R} .of-item-detail { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
${R} .of-item-detail > .of-item-art { width: min(72%, 230px); align-self: center; border-radius: 18px; }
${R} .of-item-detail > .of-item-art .of-item-initials { font-size: 3rem; }
${R} .of-item-detail[data-rarity="gold"] > .of-item-art { box-shadow: 0 0 30px rgb(230 201 138 / 0.4), inset 0 0 0 1px rgb(230 201 138 / 0.5); }
${R} .of-item-body { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
${R} .of-item-kind {
  display: inline-flex; align-items: center; gap: 8px; font-size: 0.72rem; font-weight: 800; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--of-accent-text);
}
${R} .of-item-title { font-family: var(--of-font-display); font-weight: 600; font-size: 1.6rem; line-height: 1.06; }
${R} .of-item-title:focus { outline: none; }
${R} .of-item-title:focus-visible { outline: 2px solid var(--of-focus); outline-offset: 3px; }
${R} .of-item-who { font-family: var(--of-font-display); font-style: italic; font-size: 1.05rem; color: var(--of-text-soft); }
${R} .of-item-text { font-size: 0.94rem; line-height: 1.5; color: var(--of-text-soft); }
${R} .of-item-text--snapshot {
  padding: 10px 14px; border-radius: 4px 16px 16px 4px; border-inline-start: 3px solid var(--of-li-accent, var(--of-rose));
  background: var(--of-tint); font-family: var(--of-font-display); font-size: 1.08rem; color: var(--of-text);
}
${R} .of-item-line {
  margin: 2px 0; padding: 10px 14px; border-radius: 16px; background: var(--of-surface-hover);
  font-family: var(--of-font-display); font-style: italic; font-size: 1.12rem; line-height: 1.35;
}
${R} .of-item-line .of-button { margin-top: 4px; font-style: normal; font-family: var(--of-font-body); }
${R} .of-item-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 4px; }

/* The Wardrobe. */
${R} .of-ward-owners {
  display: flex; gap: 6px; margin: 0; padding: 5px; border-radius: 20px; overflow-x: auto; scrollbar-width: none;
  flex: none; min-width: 0;
}
${R} .of-ward-owners::-webkit-scrollbar { display: none; }
${R} .of-ward-owner {
  flex: none; display: inline-flex; align-items: center; gap: 7px; min-height: 40px; padding: 4px 14px 4px 5px;
  border-radius: 999px; cursor: pointer; font-weight: 700; font-size: 0.86rem; color: var(--of-text-soft);
  transition: color 360ms var(--of-ease), background-color 360ms var(--of-ease);
}
${R} .of-ward-owner:hover { color: var(--of-text); }
${R} .of-ward-owner[data-checked="true"] {
  color: ${PALETTE.ink};
  background: linear-gradient(135deg, #f3dcaa 0%, ${PALETTE.champagne} 30%, ${PALETTE.rose} 100%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.55), 0 3px 12px var(--of-glow-soft);
}
${R} .of-ward-owner:has(input:focus-visible) { outline: 2px solid var(--of-focus); outline-offset: 2px; }
${R} .of-ward-owner-dot {
  display: grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; font-family: var(--of-font-display);
  font-size: 0.86rem; font-weight: 600; color: ${PALETTE.ink};
  background: var(--of-li-accent, linear-gradient(135deg, ${PALETTE.champagne}, var(--of-rarity-violet)));
  box-shadow: 0 0 0 2px rgb(255 255 255 / 0.6);
}
${R} .of-ward-owner-name { max-width: 14ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
${R} .of-ward-grid {
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 0; padding: 0; list-style: none;
}
${R} .of-ward-look {
  display: flex; flex-direction: column; gap: 8px; height: 100%; padding: 6px 6px 10px; border-radius: 18px;
  background: var(--of-surface-hover); border: 1px solid var(--of-border);
}
${R} .of-ward-look[data-worn="true"] {
  border-color: rgb(230 201 138 / 0.7); box-shadow: inset 0 0 0 1px rgb(230 201 138 / 0.45), 0 8px 22px var(--of-glow-soft);
}
${R} .of-ward-frame {
  position: relative; display: grid; place-items: center; width: 100%; aspect-ratio: 832 / 1216; overflow: clip;
  border-radius: 14px; isolation: isolate;
  background: radial-gradient(80% 60% at 50% 30%, color-mix(in srgb, var(--of-li-accent, var(--of-rarity-violet)) 55%, transparent), transparent 72%),
    linear-gradient(180deg, #8a8494, #5e5869);
}
${R} .of-ward-frame img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 8%; }
${R} .of-ward-frame--small { width: 64px; border-radius: 10px; }
${R} .of-ward-frame--small .of-item-initials { font-size: 1rem; }
${R} .of-ward-worn {
  position: absolute; top: 6px; inset-inline-end: 6px; z-index: 2; display: grid; place-items: center; width: 24px;
  height: 24px; border-radius: 50%; color: ${PALETTE.ink}; background: ${PALETTE.champagne};
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.3);
}
${R} .of-ward-look-body { display: flex; flex-direction: column; gap: 4px; padding-inline: 4px; min-width: 0; flex: 1; }
${R} .of-ward-look-name { font-family: var(--of-font-display); font-weight: 600; font-size: 1.1rem; line-height: 1.1; overflow-wrap: anywhere; }
${R} .of-ward-look-state { font-size: 0.74rem; font-weight: 800; color: var(--of-champagne-text); }
${R} .of-ward-faces { display: flex; gap: 4px; }
${R} .of-ward-faces img { width: 26px; height: 26px; border-radius: 50%; object-fit: cover; object-position: 50% 12%;
  box-shadow: 0 0 0 1.5px var(--of-li-accent, var(--of-rose)); }
${R} .of-ward-actions { display: flex; flex-direction: column; align-items: stretch; gap: 6px; margin-top: auto; padding-top: 4px; }
${R} .of-ward-actions .of-button { width: 100%; padding: 4px 10px; line-height: 1.15; text-align: center; }
${R} .of-ward-actions .of-cost { justify-content: center; font-size: 0.72rem; }
${R} .of-couples { display: flex; flex-direction: column; gap: 10px; margin: 0; padding: 0; list-style: none; }
${R} .of-couple {
  display: flex; flex-direction: column; gap: 10px; padding: 12px; border-radius: 18px;
  background: var(--of-surface-hover); border: 1px solid var(--of-border);
}
${R} .of-couple[data-complete="true"] { border-color: rgb(230 201 138 / 0.6); }
${R} .of-couple-title {
  display: flex; align-items: center; gap: 8px; font-family: var(--of-font-display); font-weight: 600; font-size: 1.12rem;
}
${R} .of-couple-pair { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 8px; }
${R} .of-couple-half { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 0; text-align: center; }
${R} .of-couple-half[data-owned="false"] .of-ward-frame { opacity: 0.45; filter: grayscale(0.6); }
${R} .of-couple-name { font-size: 0.82rem; font-weight: 700; overflow-wrap: anywhere; }
${R} .of-couple-state { display: inline-flex; align-items: center; gap: 3px; font-size: 0.7rem; color: var(--of-text-soft); }
${R} .of-couple-heart { color: var(--of-li-accent, var(--of-rose)); filter: drop-shadow(0 0 6px var(--of-glow)); }
${R} .of-couple-portrait { width: 100%; border-radius: 14px; aspect-ratio: 9 / 16; max-height: 320px; object-fit: cover; }
/* "{name} noticed: …", in their colour and her handwriting. */
${R} .of-noticed {
  margin: 0; padding: 10px 14px; border-radius: 16px; border-inline-start: 3px solid var(--of-li-accent, var(--of-rose));
}
${R} .of-noticed-who { font-size: 0.72rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: var(--of-accent-text); }
${R} .of-noticed-line {
  margin: 2px 0 0; font-family: var(--of-font-hand); font-size: 1.45rem; line-height: 1.12;
  color: color-mix(in srgb, var(--of-li-accent, var(--of-rose)) 45%, var(--of-text));
}
${R} .of-show-list { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
${R} .of-show-list .of-candidate { flex-direction: row; justify-content: flex-start; padding: 10px 14px; text-align: start; }
${R} .of-show-list .of-candidate .of-avatar { margin-bottom: 0; }
${R} .of-show-line { display: flex; flex-direction: column; align-items: center; gap: 6px; margin: 0; text-align: center; }
${R} .of-show-line .of-avatar--hero { width: 84px; height: 84px; font-size: 2rem; }
${R} .of-show-who { font-family: var(--of-font-display); font-weight: 600; font-size: 1.2rem; }
${R} .of-show-text { font-family: var(--of-font-display); font-style: italic; font-size: 1.22rem; line-height: 1.35; }
${R} .of-show-text:focus { outline: none; }

/* The Album. */
${R} .of-album-cgs {
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 0; padding: 0; list-style: none;
}
${R} .of-album-cg {
  position: relative; display: block; width: 100%; aspect-ratio: 3 / 4; padding: 0; overflow: clip; border: 0;
  border-radius: 16px; cursor: zoom-in; background: #0c0920; box-shadow: inset 0 0 0 1px var(--of-border);
}
${R} .of-album-cg img {
  position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 26%;
  transition: transform 700ms var(--of-ease);
}
${R} .of-album-cg:hover img { transform: scale(1.04); }
${R} .of-album-cg-caption {
  position: absolute; inset-inline: 0; bottom: 0; display: flex; flex-direction: column; gap: 1px; padding: 22px 10px 8px;
  text-align: start; color: #fff8f1; background: linear-gradient(to top, rgb(10 6 22 / 0.85), transparent);
}
${R} .of-album-cg-title { font-family: var(--of-font-display); font-weight: 600; font-size: 0.98rem; line-height: 1.1; }
${R} .of-album-cg-date { font-size: 0.68rem; opacity: 0.8; }
${R} .of-viewer { display: flex; flex-direction: column; gap: 10px; }
${R} .of-viewer-figure { display: flex; flex-direction: column; gap: 6px; margin: 0; }
${R} .of-viewer-img {
  width: 100%; max-height: min(58vh, 560px); object-fit: contain; border-radius: 14px; background: #07050f;
}
${R} .of-viewer-caption { font-size: 0.78rem; color: var(--of-text-soft); text-align: center; }
${R} .of-viewer-steps { display: flex; align-items: center; justify-content: center; gap: 14px; }
${R} .of-viewer-count { font-size: 0.8rem; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--of-text-soft); }
${R} .of-keepsakes { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
${R} .of-keepsake {
  display: grid; grid-template-columns: 58px minmax(0, 1fr) auto; align-items: center; gap: 12px; width: 100%;
  padding: 8px 12px 8px 8px; border-radius: 18px; cursor: pointer; text-align: start; color: var(--of-text);
  border-inline-start: 3px solid var(--of-li-accent, var(--of-rose));
}
${R} .of-keepsake:hover { background: var(--of-surface-strong); }
${R} .of-keepsake .of-item-art { border-radius: 12px; }
${R} .of-keepsake .of-item-initials { font-size: 1.05rem; }
${R} .of-keepsake-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
${R} .of-keepsake-kind {
  display: inline-flex; align-items: center; gap: 6px; font-size: 0.66rem; font-weight: 800; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--of-accent-text);
}
${R} .of-keepsake-title { font-family: var(--of-font-display); font-weight: 600; font-size: 1.14rem; line-height: 1.1; }
${R} .of-keepsake-who { font-size: 0.78rem; color: var(--of-text-soft); }
${R} .of-keepsake-snapshot {
  font-size: 0.82rem; color: var(--of-text-soft); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
${R} .of-keepsake-state {
  display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 999px; white-space: nowrap;
  font-size: 0.66rem; font-weight: 800; color: var(--of-accent-text); background: var(--of-tint-strong);
}
${R} .of-album-timeline { display: flex; flex-direction: column; gap: 10px; padding: 14px; border-radius: 20px; }
${R} .of-love-line { position: relative; display: flex; flex-direction: column; gap: 14px; margin: 6px 0 0; padding: 0 0 0 22px; list-style: none; }
${R}[dir="rtl"] .of-love-line { padding: 0 22px 0 0; }
${R} .of-love-line::before {
  content: ""; position: absolute; top: 6px; bottom: 6px; inset-inline-start: 6px; width: 2px; border-radius: 2px;
  background: linear-gradient(to bottom, ${PALETTE.champagne}, ${PALETTE.rose}, transparent);
}
${R} .of-love-entry { position: relative; display: flex; flex-direction: column; gap: 3px; }
${R} .of-love-dot {
  position: absolute; top: 4px; inset-inline-start: -21px; width: 12px; height: 12px; border-radius: 50%;
  background: var(--of-li-accent, var(--of-rose)); box-shadow: 0 0 0 3px var(--of-surface-solid), 0 0 10px var(--of-glow);
}
${R} .of-love-when { font-size: 0.72rem; font-weight: 800; letter-spacing: 0.04em; color: var(--of-champagne-text); }
${R} .of-love-who { color: var(--of-accent-text); }
${R} .of-love-text { font-family: var(--of-font-display); font-size: 1.08rem; line-height: 1.35; }
${R} .of-favorites { display: flex; flex-direction: column; gap: 10px; margin: 0; padding: 0; list-style: none; }
${R} .of-favorite {
  display: flex; flex-direction: column; gap: 6px; padding: 12px 14px; border-radius: 18px;
  border-inline-start: 3px solid var(--of-li-accent, var(--of-champagne));
}
${R} .of-favorite-text { margin: 0; font-family: var(--of-font-display); font-style: italic; font-size: 1.16rem; line-height: 1.35; }
${R} .of-favorite-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 0.74rem; color: var(--of-text-soft); }
${R} .of-favorite-who { font-weight: 800; color: var(--of-accent-text); }
${R} .of-favorite-play { width: 32px; height: 32px; margin-inline-start: auto; }
${R} .of-songs-wrap { display: flex; flex-direction: column; gap: 10px; }
${R} .of-songs { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
${R} .of-song {
  display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 12px; padding: 8px 14px 8px 8px;
  border-radius: 999px;
}
${R} .of-song[data-playing="true"] { border-color: rgb(230 201 138 / 0.6); background: var(--of-surface-strong); }
${R} .of-song-play {
  width: 42px; height: 42px; color: ${PALETTE.ink};
  background: linear-gradient(135deg, #f3dcaa 0%, ${PALETTE.champagne} 30%, ${PALETTE.rose} 100%);
}
${R} .of-song-play:hover { color: ${PALETTE.ink}; background: linear-gradient(135deg, #f8e6bd, ${PALETTE.rose}); }
${R} .of-song-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
${R} .of-song-name { font-family: var(--of-font-display); font-weight: 600; font-size: 1.14rem; line-height: 1.1; }
${R} .of-song-source { font-size: 0.74rem; color: var(--of-text-soft); }
${R} .of-song-bars {
  width: 22px; height: 16px;
  background: linear-gradient(var(--of-champagne-text), var(--of-champagne-text)) 0 100% / 4px 60% no-repeat,
    linear-gradient(var(--of-champagne-text), var(--of-champagne-text)) 9px 100% / 4px 100% no-repeat,
    linear-gradient(var(--of-champagne-text), var(--of-champagne-text)) 18px 100% / 4px 40% no-repeat;
  animation: of-bars 1.1s ease-in-out infinite alternate;
}
${R} .of-tells { display: flex; flex-direction: column; gap: 10px; }
${R} .of-tells-page {
  display: flex; flex-direction: column; gap: 8px; padding: 12px 14px 14px; border-radius: 18px;
  border-top: 3px solid var(--of-li-accent, var(--of-rose));
}
${R} .of-tells-head { display: flex; align-items: center; gap: 10px; }
${R} .of-tells-name { font-family: var(--of-font-display); font-weight: 600; font-size: 1.24rem; }
${R} .of-tells-list { display: flex; flex-direction: column; gap: 4px; margin: 0; padding: 0; list-style: none; }
${R} .of-tells-item {
  position: relative; padding-inline-start: 20px; font-family: var(--of-font-hand); font-size: 1.4rem; line-height: 1.15;
  color: color-mix(in srgb, var(--of-li-accent, var(--of-rose)) 45%, var(--of-text));
}
${R} .of-tells-item::before {
  content: "♥"; position: absolute; inset-inline-start: 0; top: 0.32em; font-family: var(--of-font-body); font-size: 0.7rem;
  color: var(--of-li-accent, var(--of-rose));
}
@keyframes of-banner-drift { from { transform: scale(1.02); } to { transform: scale(1.08) translate3d(0, -1.5%, 0); } }
@keyframes of-seal-glow { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(1.12); } }
@keyframes of-gather { from { opacity: 0; scale: 1.6; } to { opacity: 0.9; scale: 0.4; } }
@keyframes of-flash { 0% { opacity: 0.95; scale: 0.4; } 40% { opacity: 1; scale: 1.1; } 100% { opacity: 0; scale: 1.5; } }
@keyframes of-bars { from { background-size: 4px 30%, 4px 90%, 4px 60%; } to { background-size: 4px 90%, 4px 40%, 4px 100%; } }
@media (prefers-reduced-motion: reduce) {
  ${R} .of-reveal-card { opacity: 1; translate: none; }
  ${R} .of-reveal-art { opacity: 1; }
  ${R} .of-reveal-glow { display: none; }
}`;

// The Story screen: the next chapter, each love interest's affection, and every chapter as a path of its scenes.
const STORY_RULES = `
${R} .of-eyebrow {
  font-size: 0.7rem; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--of-champagne-text);
}
${R} .of-story-next {
  border-color: rgb(230 201 138 / 0.55);
  background: linear-gradient(150deg, var(--of-tint-strong), transparent 62%), var(--of-surface);
}
${R} .of-story-next .of-section-title { font-size: 1.45rem; }
${R} .of-story-continue { border-inline-start: 3px solid var(--of-li-accent, var(--of-rose)); }
${R} :is(.of-story-next, .of-story-continue) > .of-button { align-self: flex-start; }
${R} .of-chapter-head { display: flex; align-items: center; gap: 10px; min-width: 0; }
${R} .of-chapter-heading { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0; }
${R} .of-chapter-eyebrow { font-size: 0.75rem; font-weight: 700; color: var(--of-text-soft); }
${R} .of-chapter-title {
  font-family: var(--of-font-display); font-weight: 600; font-size: 1.32rem; line-height: 1.08; overflow-wrap: anywhere;
}
${R} h3.of-chapter-title { font-size: 1.14rem; }
${R} .of-chapters { display: flex; flex-direction: column; gap: 10px; margin: 0; padding: 0; list-style: none; }
${R} .of-chapter {
  display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: 18px;
  background: var(--of-surface-hover); border: 1px solid var(--of-border);
}
${R} .of-chapter[data-state="in-progress"] {
  border-color: rgb(230 201 138 / 0.55); box-shadow: inset 0 0 0 1px rgb(230 201 138 / 0.22);
}
${R} .of-chapter > .of-button { align-self: flex-start; }
/* A chapter's scenes: stars on a thread. Read ones glow champagne; the one being read breathes in rose. */
${R} .of-path { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 4px; padding: 6px 2px; }
${R} .of-path::before {
  content: ""; position: absolute; inset-inline: 10px; top: 50%; height: 1px; opacity: 0.7;
  background: linear-gradient(to right, var(--of-champagne), var(--of-border-strong));
}
${R}[dir="rtl"] .of-path::before { background: linear-gradient(to left, var(--of-champagne), var(--of-border-strong)); }
${R} .of-path-node {
  position: relative; z-index: 1; flex: none; display: grid; place-items: center; width: 14px; height: 14px;
  border-radius: 50%; border: 1.5px solid var(--of-border-strong); background: var(--of-surface-solid);
  color: var(--of-text-soft);
}
${R} .of-path-node:has(svg) { width: 24px; height: 24px; }
${R} .of-path-node[data-state="read"] {
  border-color: transparent; color: ${PALETTE.ink};
  background: linear-gradient(135deg, #f6e2b0, ${PALETTE.champagne}); box-shadow: 0 0 9px var(--of-wish-glow);
}
${R} .of-path-node[data-state="current"] {
  border-color: var(--of-accent-text); color: var(--of-accent-text);
  box-shadow: 0 0 0 3px var(--of-glow-soft), 0 0 14px var(--of-glow); animation: of-breathe 2.4s ease-in-out infinite;
}
${R} .of-path-node[data-kind="confrontation"]:not([data-state="read"]) { border-color: var(--of-danger); color: var(--of-danger); }
/* Affection: ten hearts in his colour. */
${R} .of-affection-list { display: flex; flex-direction: column; gap: 10px; margin: 0; padding: 0; list-style: none; }
${R} .of-affection {
  display: grid; grid-template-columns: auto minmax(0, 1fr) auto; grid-template-areas: "avatar name level" "avatar hearts hearts";
  align-items: center; column-gap: 10px; row-gap: 3px;
}
${R} .of-affection > .of-avatar { grid-area: avatar; }
${R} .of-affection-name {
  grid-area: name; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
  font-family: var(--of-font-display); font-weight: 600; font-size: 1.12rem; line-height: 1.1;
}
${R} .of-affection-level { grid-area: level; font-size: 0.74rem; font-weight: 800; color: var(--of-accent-text); }
${R} .of-hearts { grid-area: hearts; display: flex; flex-wrap: wrap; gap: 3px; color: var(--of-li-accent, var(--of-rose)); }
${R} .of-hearts svg[data-on="false"] { color: var(--of-border-strong); }
${R}[data-look="pearl"] .of-hearts { filter: brightness(0.8) saturate(1.35); }
/* "Who walks with you this chapter?" */
${R} .of-candidates {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(128px, 1fr)); gap: 10px; margin: 0; padding: 0;
  list-style: none;
}
${R} .of-candidate {
  display: flex; flex-direction: column; align-items: center; gap: 6px; width: 100%; height: 100%;
  padding: 18px 10px 14px; border-radius: 20px; cursor: pointer; text-align: center; color: var(--of-text);
  background: linear-gradient(180deg, color-mix(in srgb, var(--of-li-accent) 26%, transparent), transparent 72%), var(--of-surface);
  border-top: 3px solid var(--of-li-accent, var(--of-rose));
  transition: transform 420ms var(--of-ease), box-shadow 420ms var(--of-ease);
}
${R} .of-candidate:hover { transform: translateY(-2px); box-shadow: 0 12px 28px var(--of-glow-soft); }
${R} .of-candidate .of-avatar { margin-bottom: 6px; }
${R} .of-candidate-name { font-family: var(--of-font-display); font-weight: 600; font-size: 1.28rem; line-height: 1.05; }
${R} .of-candidate-level {
  display: inline-flex; align-items: center; gap: 4px; font-size: 0.74rem; font-weight: 800; color: var(--of-accent-text);
}
${R} .of-candidate-reason { font-size: 0.82rem; line-height: 1.35; font-style: italic; color: var(--of-text-soft); }
${R} .of-planning { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 10px 0; text-align: center; }`;

// Moods: each music cue's scene, until M2b paints places. Midnight's are deep; Pearl's are light.
const MOODS: Record<Look, Record<string, string>> = {
  midnight: {
    home: "radial-gradient(90% 60% at 18% 8%, rgb(230 201 138 / 0.42), transparent 62%), radial-gradient(80% 60% at 92% 72%, rgb(231 166 184 / 0.3), transparent 66%), linear-gradient(180deg, #3a2a4f 0%, #1d1633 58%, #120d24 100%)",
    date: "radial-gradient(85% 55% at 74% 12%, rgb(255 188 210 / 0.5), transparent 62%), radial-gradient(80% 60% at 8% 82%, rgb(183 156 242 / 0.36), transparent 66%), linear-gradient(180deg, #4a2a55 0%, #26183d 56%, #140e26 100%)",
    tender:
      "radial-gradient(90% 58% at 50% 16%, rgb(231 166 184 / 0.5), transparent 64%), radial-gradient(70% 50% at 16% 92%, rgb(230 201 138 / 0.24), transparent 66%), linear-gradient(180deg, #3d2850 0%, #221a3d 56%, #15102a 100%)",
    tense:
      "radial-gradient(80% 52% at 84% 8%, rgb(140 170 230 / 0.34), transparent 62%), radial-gradient(80% 60% at 8% 70%, rgb(90 80 160 / 0.36), transparent 66%), linear-gradient(180deg, #1d2340 0%, #141832 56%, #0b0d1f 100%)",
    angst:
      "radial-gradient(80% 52% at 14% 12%, rgb(170 60 92 / 0.42), transparent 62%), radial-gradient(80% 60% at 88% 88%, rgb(80 40 122 / 0.46), transparent 66%), linear-gradient(180deg, #1f1430 0%, #150d24 56%, #0a0716 100%)",
    confession:
      "radial-gradient(70% 46% at 50% 26%, rgb(255 214 170 / 0.55), transparent 64%), radial-gradient(100% 70% at 50% 30%, rgb(231 166 184 / 0.3), transparent 72%), linear-gradient(180deg, #4b2f4a 0%, #2a1c3c 56%, #171026 100%)",
  },
  pearl: {
    home: "radial-gradient(90% 60% at 18% 8%, rgb(230 201 138 / 0.5), transparent 62%), radial-gradient(80% 60% at 92% 72%, rgb(231 166 184 / 0.4), transparent 66%), linear-gradient(180deg, #fbefe6 0%, #f3e3ea 56%, #ead8e6 100%)",
    date: "radial-gradient(85% 55% at 74% 12%, rgb(255 178 204 / 0.55), transparent 62%), radial-gradient(80% 60% at 8% 82%, rgb(183 156 242 / 0.4), transparent 66%), linear-gradient(180deg, #fde8ef 0%, #f3dff0 56%, #e9d9f2 100%)",
    tender:
      "radial-gradient(90% 58% at 50% 16%, rgb(231 166 184 / 0.5), transparent 64%), radial-gradient(70% 50% at 16% 92%, rgb(230 201 138 / 0.34), transparent 66%), linear-gradient(180deg, #fbeaf0 0%, #f2e3ef 56%, #eadcef 100%)",
    tense:
      "radial-gradient(80% 52% at 84% 8%, rgb(140 170 230 / 0.42), transparent 62%), radial-gradient(80% 60% at 8% 70%, rgb(120 110 190 / 0.3), transparent 66%), linear-gradient(180deg, #e8ecf6 0%, #dfe2f0 56%, #d6d8ea 100%)",
    angst:
      "radial-gradient(80% 52% at 14% 12%, rgb(176 70 100 / 0.3), transparent 62%), radial-gradient(80% 60% at 88% 88%, rgb(110 70 150 / 0.32), transparent 66%), linear-gradient(180deg, #ece0ea 0%, #e0d2e2 56%, #d4c5da 100%)",
    confession:
      "radial-gradient(70% 46% at 50% 26%, rgb(255 206 150 / 0.6), transparent 64%), radial-gradient(100% 70% at 50% 30%, rgb(231 166 184 / 0.36), transparent 72%), linear-gradient(180deg, #fff1e2 0%, #fbe6ea 56%, #f1dcea 100%)",
  },
};

const moodRules = (look: Look) =>
  Object.entries(MOODS[look])
    .map(
      ([mood, background]) => `${R}[data-look="${look}"] .of-mood[data-mood="${mood}"] { background: ${background}; }`,
    )
    .join("\n");

// The reader: the scene, the face on stage, the dialogue box in the bottom third, choices, panels and the backlog.
const READER_RULES = `
${R} .of-reader {
  position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: clip; isolation: isolate;
}
${R} .of-reader-scene { position: absolute; inset: 0; z-index: 0; overflow: clip; pointer-events: none; }
${R} .of-mood { position: absolute; inset: 0; opacity: 0; transition: opacity 900ms var(--of-ease); }
${R} .of-mood[data-on="true"] { opacity: 1; }
${moodRules("midnight")}
${moodRules("pearl")}
${R} .of-reader-motes {
  position: absolute; inset: -12%; opacity: 0.55;
  background-image:
    radial-gradient(2px 2px at 12% 22%, rgb(255 236 200 / 0.9) 50%, transparent 52%),
    radial-gradient(1.5px 1.5px at 34% 64%, rgb(255 214 228 / 0.8) 50%, transparent 52%),
    radial-gradient(2.4px 2.4px at 58% 18%, rgb(255 246 230 / 0.85) 50%, transparent 52%),
    radial-gradient(1.6px 1.6px at 76% 48%, rgb(255 214 228 / 0.8) 50%, transparent 52%),
    radial-gradient(2px 2px at 88% 82%, rgb(255 236 200 / 0.8) 50%, transparent 52%),
    radial-gradient(1.4px 1.4px at 22% 88%, rgb(255 246 230 / 0.75) 50%, transparent 52%),
    radial-gradient(1.8px 1.8px at 48% 40%, rgb(255 236 200 / 0.7) 50%, transparent 52%);
  animation: of-motes 28s ease-in-out infinite alternate;
}
${R}[data-look="pearl"] .of-reader-motes { opacity: 0.9; filter: drop-shadow(0 0 2px rgb(231 166 184 / 0.6)); }
${R} .of-reader-vignette {
  position: absolute; inset: 0;
  background: radial-gradient(125% 85% at 50% 38%, transparent 56%, rgb(6 4 18 / 0.48) 100%),
    linear-gradient(to top, rgb(6 4 18 / 0.5) 0%, transparent 40%);
}
${R}[data-look="pearl"] .of-reader-vignette {
  background: radial-gradient(125% 85% at 50% 38%, transparent 58%, rgb(120 70 100 / 0.16) 100%),
    linear-gradient(to top, rgb(120 70 100 / 0.12) 0%, transparent 40%);
}
/* The header: the way out, the chapter's title, and the tools. */
${R} .of-reader-head {
  position: relative; z-index: 3; display: flex; flex-direction: column; gap: 6px;
  padding: max(12px, env(safe-area-inset-top)) 12px 4px;
}
${R} .of-reader-row { display: flex; align-items: center; gap: 8px; min-width: 0; }
${R} .of-reader-row--sub { align-items: flex-start; }
${R} .of-reader-title { flex: 1; min-width: 0; display: flex; flex-direction: column; text-shadow: 0 1px 12px rgb(0 0 0 / 0.3); }
${R}[data-look="pearl"] .of-reader-title { text-shadow: 0 1px 10px rgb(255 255 255 / 0.7); }
${R} .of-reader:focus, ${R} .of-reader-title:focus { outline: none; }
${R} .of-reader-title:focus-visible { outline: 2px solid var(--of-focus); outline-offset: 3px; border-radius: 6px; }
${R} .of-reader-eyebrow {
  font-size: 0.68rem; font-weight: 800; line-height: 1.3; letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--of-champagne-text);
}
/* The count moves to its own line whole when the kind and count do not fit together (its leading space collapses). */
${R} .of-reader-scene-count {
  display: inline-block; padding-inline-start: 0.3em; white-space: nowrap; letter-spacing: 0.06em;
  color: var(--of-text-soft);
}
${R} .of-reader-name {
  overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
  font-family: var(--of-font-display); font-weight: 600; font-size: 1.24rem; line-height: 1.12;
}
${R} .of-reader-tools { flex: none; display: flex; align-items: center; gap: 6px; }
${R} .of-reader-tool { width: 36px; height: 36px; }
${R} .of-reader-tool[aria-pressed="true"] {
  color: ${PALETTE.ink}; border-color: transparent;
  background: linear-gradient(135deg, #f3dcaa 0%, ${PALETTE.champagne} 30%, ${PALETTE.rose} 100%);
}
${R} .of-reader-tool[aria-disabled="true"] { opacity: 0.45; cursor: default; }
${R} .of-reader-tool[aria-disabled="true"]:hover { background: var(--of-surface); color: inherit; }
/* The scene's chips stay on one line and scroll sideways, fading at the end. */
${R} .of-reader-chips {
  flex: 1; min-width: 0; display: flex; gap: 5px; margin: 0; padding: 4px 0; overflow-x: auto; list-style: none;
  scrollbar-width: none; -webkit-mask-image: linear-gradient(to right, #000 calc(100% - 20px), transparent);
  mask-image: linear-gradient(to right, #000 calc(100% - 20px), transparent);
}
${R}[dir="rtl"] .of-reader-chips {
  -webkit-mask-image: linear-gradient(to left, #000 calc(100% - 20px), transparent);
  mask-image: linear-gradient(to left, #000 calc(100% - 20px), transparent);
}
${R} .of-reader-chips::-webkit-scrollbar { display: none; }
${R} .of-reader-chip {
  flex: none; display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px; border-radius: 999px; white-space: nowrap;
  font-size: 0.68rem; font-weight: 800; letter-spacing: 0.04em; color: var(--of-text);
  background: var(--of-surface); border: 1px solid var(--of-border);
  -webkit-backdrop-filter: var(--of-glass-blur); backdrop-filter: var(--of-glass-blur);
}
${R} .of-reader-chip--tag { color: var(--of-accent-text); background: var(--of-tint-strong); border-color: var(--of-border-strong); }
${R} .of-reader-chip--frame { color: var(--of-champagne-text); border-color: rgb(230 201 138 / 0.5); }
${R} .of-reader-chip--replay { color: var(--of-text-soft); }
${R} .of-reader-chip--place { animation: of-place-in 900ms var(--of-ease) both; }
${R} .of-reader-chip--place svg { color: var(--of-champagne-text); }
${R} .of-reader-pill {
  display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 12px; border-radius: 999px;
  font-size: 0.78rem; font-weight: 800; white-space: nowrap; cursor: pointer;
}
${R} .of-reader-pill:hover { background: var(--of-surface-strong); }
${R} .of-reader-pill--ease { color: var(--of-accent-text); }
/* The middle: the place, the face on stage (or a quiet card for a key image), and toasts. */
/* A size container: the face and the quiet card fit whatever height the choices or a panel leave them. */
${R} .of-reader-stage {
  position: relative; z-index: 1; flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center;
  justify-content: flex-end; overflow: clip; cursor: pointer; container-type: size;
}
${R} .of-face {
  position: relative; flex: 1; min-height: 0; width: 100%; margin: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: flex-end; gap: 10px; padding-bottom: 8px;
  transition: filter 560ms var(--of-ease), transform 560ms var(--of-ease);
}
${R} .of-face[data-speaking="false"] { filter: saturate(0.82) brightness(0.86); transform: scale(0.985); }
${R}[data-look="pearl"] .of-face[data-speaking="false"] { filter: saturate(0.8) brightness(0.97); }
${R} .of-face[data-face="tender"] { --of-face-aura: rgb(255 182 202 / 0.95); }
${R} .of-face[data-face="flustered"] { --of-face-aura: rgb(255 128 166 / 0.95); }
${R} .of-face[data-face="cold"] { --of-face-aura: rgb(150 192 244 / 0.95); }
${R} .of-face[data-face="hurt"] { --of-face-aura: rgb(164 142 222 / 0.95); }
${R} .of-face[data-face="angry"] { --of-face-aura: rgb(244 92 92 / 0.95); }
${R} .of-face-art { position: relative; flex: 1; min-height: 0; width: min(82%, 380px); }
${R} .of-face-art::before {
  content: ""; position: absolute; inset: 10% 6% 0; border-radius: 50%; filter: blur(30px); opacity: 0.55;
  background: radial-gradient(circle, var(--of-face-aura, var(--of-li-accent)), transparent 68%);
}
${R} .of-face-img {
  position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 6%; opacity: 0;
  transition: opacity 520ms var(--of-ease);
  -webkit-mask-image: radial-gradient(70% 82% at 50% 40%, #000 62%, transparent 100%);
  mask-image: radial-gradient(70% 82% at 50% 40%, #000 62%, transparent 100%);
}
${R} .of-face-img[data-front="true"] { opacity: 1; }
${R} .of-face-medallion {
  --of-medallion: clamp(48px, min(210px, 54cqw, calc(100cqh - 66px)), 210px);
  position: relative; flex: none; display: grid; place-items: center; width: var(--of-medallion); aspect-ratio: 1;
  margin: 0 0 4px;
}
${R} .of-face-medallion::before {
  content: ""; position: absolute; inset: 0; border-radius: 50%;
  background:
    radial-gradient(circle at 32% 24%, rgb(255 255 255 / 0.55), transparent 50%),
    linear-gradient(150deg, color-mix(in srgb, var(--of-li-accent) 80%, white), var(--of-li-accent) 55%,
      color-mix(in srgb, var(--of-li-accent) 72%, ${PALETTE.ink}));
  box-shadow: 0 0 0 3px var(--of-wish-ring), 0 18px 40px rgb(0 0 0 / 0.3), 0 0 46px var(--of-glow-soft);
}
${R} .of-face-aura {
  position: absolute; inset: -26%; border-radius: 50%; opacity: 0.6; filter: blur(10px);
  background: radial-gradient(circle, var(--of-face-aura, var(--of-li-accent)) 0%, transparent 66%);
  animation: of-breathe 5s ease-in-out infinite;
}
${R} .of-face-ring {
  position: absolute; inset: -9px; border-radius: 50%; border: 1px solid color-mix(in srgb, var(--of-li-accent) 55%, white);
  box-shadow: 0 0 0 7px color-mix(in srgb, var(--of-li-accent) 16%, transparent);
}
${R} .of-face-initials {
  position: relative; font-family: var(--of-font-display); font-weight: 600; font-size: calc(var(--of-medallion) * 0.34);
  letter-spacing: 0.02em; color: ${PALETTE.ink}; text-shadow: 0 1px 0 rgb(255 255 255 / 0.45);
}
${R} .of-face-chip {
  display: inline-flex; align-items: center; gap: 5px; padding: 4px 12px; border-radius: 999px;
  font-size: 0.74rem; font-weight: 800; letter-spacing: 0.04em; color: var(--of-text);
  background: var(--of-surface-strong); border: 1px solid var(--of-border);
  -webkit-backdrop-filter: var(--of-glass-blur); backdrop-filter: var(--of-glass-blur);
  animation: of-fade-in 420ms var(--of-ease) both;
}
${R} .of-face-chip svg { color: var(--of-accent-text); }
${R} .of-cg-quiet {
  position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px;
  width: clamp(120px, min(78cqw, 330px, calc((100cqh - 28px) * 0.8)), 330px); aspect-ratio: 4 / 5; margin: 0 0 14px;
  padding: 18px; border-radius: 28px; text-align: center;
  border-color: rgb(230 201 138 / 0.5); animation: of-rise 700ms var(--of-ease) both;
}
${R} .of-cg-frame {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; width: 68%;
  aspect-ratio: 1; border-radius: 50%; color: var(--of-champagne-text);
  background: radial-gradient(circle, var(--of-tint-strong), transparent 70%);
  border: 1px solid rgb(230 201 138 / 0.5); box-shadow: inset 0 0 34px rgb(230 201 138 / 0.18);
}
${R} .of-cg-names { font-family: var(--of-font-display); font-weight: 600; font-size: 1.45rem; color: var(--of-text); }
${R} .of-toasts {
  position: absolute; top: 10px; inset-inline: 12px; z-index: 3; display: flex; flex-direction: column;
  align-items: center; gap: 8px; pointer-events: none;
}
${R} .of-toast {
  display: inline-flex; align-items: center; gap: 8px; margin: 0; padding: 8px 16px; border-radius: 999px;
  background: var(--of-surface-strong); border: 1px solid var(--of-border-strong); box-shadow: var(--of-panel-shadow);
  -webkit-backdrop-filter: var(--of-glass-blur); backdrop-filter: var(--of-glass-blur);
  animation: of-toast 3.2s var(--of-ease) both;
}
${R} .of-toast--remember {
  padding: 8px 20px; font-family: var(--of-font-hand); font-weight: 500; font-size: 1.45rem; line-height: 1.1;
  color: var(--of-text);
}
${R} .of-toast--remember svg { color: var(--of-accent-text); }
${R} .of-toast--starlight { font-weight: 800; font-size: 0.86rem; color: var(--of-champagne-text); }
/* The bottom third: the dialogue box and its choices, or the panel that stands in for them. */
${R} .of-reader-bottom {
  position: relative; z-index: 2; min-height: 30%; display: flex; flex-direction: column; justify-content: flex-end;
  gap: 10px; padding: 18px 10px max(10px, env(safe-area-inset-bottom));
}
${R} .of-dialogue-wrap { cursor: pointer; }
${R} .of-dialogue {
  position: relative; display: flex; flex-direction: column; gap: 6px; min-height: 128px; padding: 22px 18px 16px;
  border-radius: 22px;
}
${R} .of-dialogue::before {
  content: ""; position: absolute; inset: 5px; border-radius: 17px; pointer-events: none;
  border: 1px solid rgb(230 201 138 / 0.26);
}
${R} .of-nameplate {
  position: absolute; top: -15px; inset-inline-start: 16px; display: inline-flex; align-items: center; gap: 8px;
  max-width: calc(100% - 32px); margin: 0; padding: 6px 16px; border-radius: 999px 999px 999px 6px; overflow: hidden;
  white-space: nowrap; text-overflow: ellipsis; font-family: var(--of-font-display); font-weight: 600; font-size: 1.14rem;
  line-height: 1; color: ${PALETTE.ink};
  background: linear-gradient(135deg, color-mix(in srgb, var(--of-li-accent, ${PALETTE.rose}) 62%, white), var(--of-li-accent, ${PALETTE.rose}));
  box-shadow: 0 6px 16px rgb(0 0 0 / 0.2), inset 0 1px 0 rgb(255 255 255 / 0.6);
}
${R}[dir="rtl"] .of-nameplate { border-radius: 999px 999px 6px 999px; }
${R} .of-nameplate[data-voice="protagonist"] { background: linear-gradient(135deg, #f3dcaa, ${PALETTE.rose}); }
${R} .of-nameplate[data-voice="other"] { background: linear-gradient(135deg, #f6ecd6, ${PALETTE.champagne}); }
${R} .of-nameplate-tag {
  display: inline-flex; align-items: center; gap: 3px; font-family: var(--of-font-body); font-size: 0.6rem; font-weight: 800;
  letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.78;
}
${R} .of-line {
  max-height: 9.8em; margin: 0; padding-inline-end: 34px; overflow-y: auto; white-space: pre-wrap; overflow-wrap: anywhere;
  font-size: 1.02rem; line-height: 1.62; color: var(--of-text);
}
${R} .of-line-rest { visibility: hidden; }
${R} .of-line--thought { font-style: italic; color: var(--of-text-soft); }
${R} .of-line--thought > [aria-hidden="true"]::before { content: "("; }
${R} .of-line--thought > [aria-hidden="true"]::after { content: ")"; }
${R} .of-line--his-thought {
  font-family: var(--of-font-display); font-style: italic; font-weight: 600; font-size: 1.2rem; line-height: 1.45;
  color: color-mix(in srgb, var(--of-li-accent) 45%, var(--of-text));
  text-shadow: 0 0 16px color-mix(in srgb, var(--of-li-accent) 40%, transparent);
}
${R} .of-line--aftermath { padding-inline: 18px; font-style: italic; text-align: center; color: var(--of-text-soft); }
${R} .of-next {
  position: absolute; bottom: 6px; inset-inline-end: 6px; display: grid; place-items: center; width: 44px; height: 44px;
  padding: 0; border: 0; border-radius: 50%; background: transparent; color: var(--of-accent-text); cursor: pointer;
}
${R} .of-next:hover { background: var(--of-surface-hover); }
${R} .of-next[data-done="true"] svg { animation: of-nudge 1.6s ease-in-out infinite; }
${R} .of-next[data-done="false"] { color: var(--of-text-faint); }
${R} .of-choices-panel { display: flex; flex-direction: column; gap: 8px; padding: 0 4px; animation: of-rise 480ms var(--of-ease) both; }
${R} .of-choices-heading {
  font-family: var(--of-font-display); font-style: italic; font-weight: 600; font-size: 1.2rem; text-align: center;
  text-shadow: 0 1px 10px rgb(0 0 0 / 0.3);
}
${R}[data-look="pearl"] .of-choices-heading { text-shadow: 0 1px 10px rgb(255 255 255 / 0.8); }
${R} .of-choices-note {
  display: flex; align-items: center; justify-content: center; gap: 6px; margin: -4px 0 0; font-size: 0.78rem;
  font-weight: 700; text-align: center; color: var(--of-champagne-text);
}
${R} .of-choice-pills { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
${R} .of-choice-pill {
  display: flex; align-items: center; gap: 10px; width: 100%; min-height: 48px; padding: 10px 18px; border-radius: 999px;
  border: 1px solid var(--of-border-strong); background: var(--of-surface-strong); color: var(--of-text);
  -webkit-backdrop-filter: var(--of-glass-blur); backdrop-filter: var(--of-glass-blur);
  box-shadow: inset 0 1px 0 var(--of-highlight), var(--of-panel-shadow);
  font-weight: 700; font-size: 0.95rem; line-height: 1.3; text-align: start; cursor: pointer;
  transition: transform 360ms var(--of-ease), border-color 360ms var(--of-ease), background-color 360ms var(--of-ease);
}
${R} .of-choice-pill:hover {
  transform: translateY(-1px); border-color: rgb(230 201 138 / 0.85);
  background: linear-gradient(135deg, var(--of-tint-strong), rgb(230 201 138 / 0.16)), var(--of-surface-strong);
}
${R} .of-choice-pill[aria-disabled="true"] { opacity: 0.65; cursor: progress; transform: none; }
${R} .of-choice-pill-mark { flex: none; color: var(--of-accent-text); }
${R} .of-choice-pill-text { flex: 1; min-width: 0; overflow-wrap: anywhere; }
${R} .of-choice-pill[data-first="true"] { border-color: rgb(230 201 138 / 0.7); }
${R} .of-choice-first {
  flex: none; padding: 2px 8px; border-radius: 999px; font-size: 0.62rem; font-weight: 800; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--of-accent-text); background: var(--of-tint-strong);
}
${R} .of-choices-panel[data-kind="big"] .of-choice-pill {
  border-color: rgb(230 201 138 / 0.85); box-shadow: inset 0 0 0 1px rgb(230 201 138 / 0.35), 0 0 20px rgb(230 201 138 / 0.22);
}
${R} .of-choices-status { min-height: 1.2em; margin: 0; font-size: 0.8rem; text-align: center; color: var(--of-text-soft); }
${R} .of-choices-status:empty { min-height: 0; }
${R} .of-reader-panel {
  display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 18px 16px; border-radius: 22px;
  text-align: center;
}
${R} .of-reader-panel .of-body { max-width: 36ch; }
${R} .of-quill {
  display: grid; place-items: center; width: 46px; height: 46px; border-radius: 50%; color: var(--of-accent-text);
  background: var(--of-tint); animation: of-write 1.8s ease-in-out infinite;
}
${R} .of-declined { display: flex; flex-direction: column; gap: 10px; padding: 16px; border-radius: 22px; border-color: rgb(240 138 164 / 0.55); }
${R} .of-declined-head { display: flex; align-items: center; gap: 8px; color: var(--of-accent-text); }
${R} .of-declined-head .of-section-title { color: var(--of-text); }
${R} .of-declined .of-select-row { flex-wrap: wrap; }
${R} .of-declined .of-select-row > .of-input { min-width: 160px; }
${R} .of-tags-card {
  display: flex; flex-direction: column; gap: 10px; padding: 18px 16px; border-radius: 22px;
  border-color: rgb(230 201 138 / 0.55);
}
${R} .of-tags-card .of-hint { display: flex; align-items: center; gap: 6px; }
${R} .of-tag-list { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }
${R} .of-tag {
  padding: 4px 11px; border-radius: 999px; font-size: 0.8rem; font-weight: 800; color: var(--of-accent-text);
  background: var(--of-tint-strong); border: 1px solid var(--of-border-strong);
}
${R} .of-chapter-end { gap: 8px; }
${R} .of-chapter-end-mark {
  display: grid; place-items: center; width: 52px; height: 52px; border-radius: 50%; color: var(--of-champagne-text);
  background: radial-gradient(circle, rgb(230 201 138 / 0.3), transparent 70%); box-shadow: 0 0 30px var(--of-wish-glow);
}
${R} .of-chapter-end-title {
  font-family: var(--of-font-display); font-weight: 600; font-size: 1.85rem; line-height: 1.05; padding-bottom: 0.06em;
  background: var(--of-title-ink); -webkit-background-clip: text; background-clip: text; color: transparent;
}
${R} .of-chapter-end-title:focus { outline: none; }
${R} .of-chapter-end-title:focus-visible { outline: 2px solid var(--of-focus); outline-offset: 4px; border-radius: 6px; }
${R} .of-grants { display: flex; flex-direction: column; gap: 6px; width: 100%; margin: 4px 0; padding: 0; list-style: none; }
${R} .of-grant {
  display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 14px; text-align: start;
  background: var(--of-surface-hover); font-weight: 700; font-size: 0.9rem;
}
${R} .of-grant > span:not(.of-avatar):not(.of-badge) { flex: 1; min-width: 0; }
${R} .of-grant--starlight { color: var(--of-champagne-text); }
${R} .of-grant[data-rose="true"] .of-badge { color: ${PALETTE.ink}; background: linear-gradient(135deg, #f3dcaa, ${PALETTE.champagne}); }
${R} .of-reader-notice { align-items: center; justify-content: space-between; flex-wrap: wrap; }
/* Its action stays on one line, and goes to its own line (at its end) when the text needs the room. */
${R} .of-reader-notice > span { flex: 1 1 16rem; }
${R} .of-reader-notice .of-button { margin-inline-start: auto; white-space: nowrap; }
${R} .of-reader-show { position: absolute; bottom: max(14px, env(safe-area-inset-bottom)); inset-inline-end: 14px; }
/* The backlog. */
${R} .of-log {
  display: flex; flex-direction: column; gap: 10px; max-height: 52vh; margin: 0; padding: 0 4px 0 0; overflow-y: auto;
  list-style: none; scrollbar-width: thin; border-radius: 8px;
}
${R} .of-log-line { display: flex; align-items: flex-start; gap: 8px; padding-bottom: 10px; border-bottom: 1px solid var(--of-border); }
${R} .of-log-line:last-child { border-bottom: 0; }
${R} .of-log-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
${R} .of-log-who {
  font-family: var(--of-font-display); font-weight: 600; font-size: 1.02rem;
  color: color-mix(in srgb, var(--of-li-accent, ${PALETTE.rose}) 45%, var(--of-text));
}
${R} .of-log-said { font-size: 0.92rem; line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; }
${R} .of-log-line[data-thought="true"] .of-log-said { font-style: italic; color: var(--of-text-soft); }
${R} .of-log-line[data-voice="narration"] .of-log-said { color: var(--of-text-soft); }
${R} .of-log-star { width: 34px; height: 34px; border: 0; background: transparent; color: var(--of-text-soft); }
${R} .of-log-star[aria-pressed="true"] { color: var(--of-champagne-text); }`;

// Home (M3). The layers fill the whole stage, behind the top bar and the dock: .of-home is not positioned, so they
// anchor to the stage body. Its grid keeps everything that takes a tap apart: the note across the top, the rail at the
// inline start, and beside it the figure's cell with his nameplate under it. The figure stands in its cell (its art may
// run on behind the rail, the nameplate and the dock), and his tap zones and pills never leave it, so nothing covers
// them at any size. The pointer sets --of-px and --of-py (−1..1); L0 moves 6 px, the figure 14 px (plus a 5 px drift),
// the light 20 px.
const SKIES = {
  dawn: {
    tint: "linear-gradient(180deg, rgb(255 170 140 / 0.24) 0%, rgb(255 210 170 / 0.1) 42%, transparent 72%)",
    light: "rgb(255 214 170 / 0.55)",
    top: "rgb(255 196 168 / 0.92)",
    bottom: "rgb(255 230 196 / 0.7)",
    glow: "rgb(255 200 160 / 0.4)",
    stars: "0",
  },
  day: {
    tint: "linear-gradient(180deg, rgb(255 248 230 / 0.16) 0%, transparent 60%)",
    light: "rgb(255 248 228 / 0.46)",
    top: "rgb(214 232 255 / 0.9)",
    bottom: "rgb(255 246 230 / 0.72)",
    glow: "rgb(255 250 230 / 0.34)",
    stars: "0",
  },
  dusk: {
    tint: "linear-gradient(180deg, rgb(236 120 150 / 0.26) 0%, rgb(140 90 200 / 0.16) 52%, transparent 86%)",
    light: "rgb(255 170 190 / 0.42)",
    top: "rgb(240 150 180 / 0.88)",
    bottom: "rgb(150 110 200 / 0.72)",
    glow: "rgb(231 166 184 / 0.38)",
    stars: "0.4",
  },
  night: {
    tint: "linear-gradient(180deg, rgb(16 18 64 / 0.44) 0%, rgb(10 8 30 / 0.22) 62%, rgb(10 8 30 / 0.12) 100%)",
    light: "rgb(170 180 255 / 0.24)",
    top: "rgb(40 46 116 / 0.92)",
    bottom: "rgb(24 22 72 / 0.92)",
    glow: "rgb(140 150 255 / 0.26)",
    stars: "0.95",
  },
} as const;

const skyRules = () =>
  Object.entries(SKIES)
    .map(
      ([sky, value]) =>
        `${R} .of-home[data-sky="${sky}"] { --of-home-tint: ${value.tint}; --of-home-light: ${value.light}; ` +
        `--of-home-window-top: ${value.top}; --of-home-window-bottom: ${value.bottom}; ` +
        `--of-home-window-glow: ${value.glow}; --of-home-stars: ${value.stars}; }`,
    )
    .join("\n");

const HOME_RULES = `
/* The note's row gives way first (its text scrolls), so the rail and the figure's cell always have their room: the
   second row is at least as tall as the rail, and as the cell's minimum plus the nameplate. */
${R} .of-home {
  --of-px: 0; --of-py: 0;
  flex: 1; min-height: 0; display: grid; gap: 8px; padding: 2px 12px 10px;
  grid-template-columns: auto minmax(0, 1fr); grid-template-rows: minmax(0, auto) minmax(auto, 1fr);
  grid-template-areas: "top top" "rail main";
}
${R} :is(.of-home-layers, .of-home-front) { position: absolute; inset: 0; overflow: clip; pointer-events: none; }
${R} .of-home-layers { z-index: 0; }
/* After the figure's cell, at its z-index: the light and the shade fall over him, under the note, rail and plate. */
${R} .of-home-front { z-index: 1; }
${skyRules()}
${R} .of-home-l0 {
  position: absolute; inset: -24px; background: ${MOODS.midnight.home};
  transform: translate3d(calc(var(--of-px) * -6px), calc(var(--of-py) * -4px), 0);
  transition: transform 900ms var(--of-ease);
}
${R}[data-look="pearl"] .of-home-l0 { background: ${MOODS.pearl.home}; }
${R} .of-home-stars {
  position: absolute; inset: 0 0 40%; opacity: var(--of-home-stars, 0); transition: opacity 1.2s var(--of-ease);
  background-image:
    radial-gradient(1.4px 1.4px at 10% 14%, var(--of-star) 50%, transparent 52%),
    radial-gradient(1px 1px at 24% 34%, var(--of-star) 50%, transparent 52%),
    radial-gradient(1.6px 1.6px at 41% 9%, var(--of-star) 50%, transparent 52%),
    radial-gradient(1px 1px at 58% 27%, var(--of-star) 50%, transparent 52%),
    radial-gradient(1.2px 1.2px at 71% 6%, var(--of-star) 50%, transparent 52%),
    radial-gradient(1.8px 1.8px at 88% 22%, var(--of-star) 50%, transparent 52%),
    radial-gradient(1px 1px at 16% 52%, var(--of-star) 50%, transparent 52%),
    radial-gradient(1.2px 1.2px at 47% 44%, var(--of-star) 50%, transparent 52%);
  animation: of-home-twinkle 7s ease-in-out infinite alternate;
}
/* An arched window onto the sky: the room's only light, in the colour of the hour. */
${R} .of-home-window {
  position: absolute; top: 12%; inset-inline-end: 9%; width: 36%; aspect-ratio: 3 / 4.6; opacity: 0.5;
  border-radius: 999px 999px 14px 14px;
  background:
    linear-gradient(90deg, transparent calc(50% - 1px), rgb(255 255 255 / 0.16) calc(50% - 1px) calc(50% + 1px),
      transparent calc(50% + 1px)),
    linear-gradient(180deg, transparent 46%, rgb(255 255 255 / 0.14) 46% calc(46% + 2px), transparent calc(46% + 2px)),
    linear-gradient(180deg, var(--of-home-window-top), var(--of-home-window-bottom));
  box-shadow: 0 0 70px 10px var(--of-home-window-glow), inset 0 0 0 2px rgb(255 255 255 / 0.08);
  -webkit-mask-image: linear-gradient(to bottom, #000 70%, transparent);
  mask-image: linear-gradient(to bottom, #000 70%, transparent);
}
${R}[data-look="pearl"] .of-home-window { opacity: 0.62; }
/* His CG or a painted place, dimmed a little so he stands out in front of it. */
${R} .of-home-backdrop {
  position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; filter: brightness(0.78) saturate(0.92);
}
${R}[data-look="pearl"] .of-home-backdrop { filter: brightness(0.96) saturate(0.9); }
${R} .of-home-l1 { position: absolute; inset: 0; background: var(--of-home-tint); }
${R}[data-look="pearl"] .of-home[data-sky="night"] {
  --of-home-tint: linear-gradient(180deg, rgb(110 110 190 / 0.24) 0%, rgb(140 120 200 / 0.1) 62%, transparent 100%);
}
${R} .of-home-l3 {
  position: absolute; inset: -30px; mix-blend-mode: screen;
  transform: translate3d(calc(var(--of-px) * 20px), calc(var(--of-py) * 12px), 0);
  transition: transform 900ms var(--of-ease);
}
${R}[data-look="pearl"] .of-home-l3 { mix-blend-mode: normal; opacity: 0.8; }
${R} .of-home-beam {
  position: absolute; top: -6%; inset-inline-end: 2%; width: 66%; height: 92%; filter: blur(22px);
  background: linear-gradient(196deg, var(--of-home-light) 0%, transparent 58%); transform: skewX(-12deg);
  animation: of-home-beam 14s ease-in-out infinite alternate;
}
${R} .of-home-motes {
  position: absolute; inset: 0; opacity: 0.6;
  background-image:
    radial-gradient(2px 2px at 14% 26%, rgb(255 236 200 / 0.9) 50%, transparent 52%),
    radial-gradient(1.5px 1.5px at 32% 62%, rgb(255 214 228 / 0.8) 50%, transparent 52%),
    radial-gradient(2.2px 2.2px at 61% 20%, rgb(255 246 230 / 0.85) 50%, transparent 52%),
    radial-gradient(1.6px 1.6px at 78% 46%, rgb(255 214 228 / 0.8) 50%, transparent 52%),
    radial-gradient(1.8px 1.8px at 86% 78%, rgb(255 236 200 / 0.75) 50%, transparent 52%),
    radial-gradient(1.4px 1.4px at 24% 84%, rgb(255 246 230 / 0.7) 50%, transparent 52%);
  animation: of-motes 30s ease-in-out infinite alternate;
}
/* Keeps the note and the nameplate readable, and lets his figure fade into the floor. */
${R} .of-home-shade {
  position: absolute; inset: 0;
  background: linear-gradient(to bottom, rgb(10 8 26 / 0.42) 0%, transparent 20%, transparent 60%, rgb(10 8 26 / 0.74) 100%);
}
${R}[data-look="pearl"] .of-home-shade {
  background: linear-gradient(to bottom, rgb(247 241 236 / 0.46) 0%, transparent 20%, transparent 62%, rgb(247 236 240 / 0.8) 100%);
}
${R} .of-home[data-rupture="true"] .of-home-l1 { background: var(--of-home-tint), linear-gradient(rgb(90 110 160 / 0.16), rgb(90 110 160 / 0.16)); }

/* L2: the figure's cell (a size container: cqw and cqh below are its own) and his nameplate under it. */
/* Its first row is the cell: at least 128 px, and as tall as the line he noticed (on Me), which stands in it. The
   128 px floor is the row's, not a min-height on the cell: when a short stage left the row at that min-height, Chrome
   kept the cell 128 px tall but read its cqh as 0, and his figure and medallion shrank to nothing. */
${R} .of-home-main {
  grid-area: main; min-width: 0; display: grid; grid-template: minmax(128px, 1fr) auto / minmax(0, 1fr); gap: 8px;
  pointer-events: none;
}
${R} .of-home-stage { grid-area: 1 / 1; position: relative; z-index: 1; container-type: size; }
${R} .of-home-main > .of-home-foot { grid-area: 2 / 1; }
/* Me: what a love interest noticed about her look (M4's P19), at the cell's inline end above her name, over the cell
   (her art may run on behind it) and under nothing that takes a tap. */
${R} .of-home-noticed {
  grid-area: 1 / 1; align-self: end; justify-self: end; position: relative; z-index: 3; min-width: 0;
  max-width: min(100%, 300px);
}
${R} .of-home-noticed .of-noticed { padding: 8px 12px; }
${R} .of-home-noticed .of-noticed-line { font-size: clamp(1rem, 5cqw, 1.3rem); }
/* A cut-out or a look (832 × 1216) stands in the cell: as wide as keeps his head and heart zones inside it (its end
   may reach the stage's edge, 12 px past the cell), and no taller than 1 / 0.62 of the cell, so his hand zone (down to
   56 % of the art) stays in it. His head sits as high as keeps his feet behind the dock (96 px under the cell) and
   8 px under the note, but never lower than puts the art's 58 % line on the cell's floor. Initials or an avatar stand
   in its middle, as a medallion or cameo. */
${R} .of-figure {
  --of-figure-w: min((100cqw + 12px) / 0.67, 100cqh * 1.1036);
  position: absolute; width: var(--of-figure-w); aspect-ratio: 832 / 1216;
  inset-inline-start: min((100cqw - var(--of-figure-w)) / 2, 100cqw + 12px - var(--of-figure-w));
  top: min(100cqh - var(--of-figure-w) * 0.848, max(8px, 100cqh + 96px - var(--of-figure-w) * 1.4615));
  pointer-events: none; animation: of-fade-in 700ms var(--of-ease) both;
}
${R} :is(.of-figure-parallax, .of-figure-drift, .of-figure-breathe) { position: absolute; inset: 0; }
${R} .of-figure-parallax {
  transform: translate3d(calc(var(--of-px) * 14px), calc(var(--of-py) * 8px), 0); transition: transform 700ms var(--of-ease);
}
${R} .of-figure-drift { animation: of-figure-drift 19s ease-in-out infinite alternate; }
${R} .of-figure-breathe {
  transform-origin: 50% 100%; animation: of-figure-breathe 4.5s ease-in-out infinite;
  transition: filter 700ms var(--of-ease);
}
${R} .of-figure[data-face="tender"] { --of-face-aura: rgb(255 182 202 / 0.95); }
${R} .of-figure[data-face="flustered"] { --of-face-aura: rgb(255 128 166 / 0.95); }
${R} .of-figure[data-face="cold"] { --of-face-aura: rgb(150 192 244 / 0.95); }
${R} .of-figure[data-face="hurt"] { --of-face-aura: rgb(164 142 222 / 0.95); }
${R} .of-figure[data-face="angry"] { --of-face-aura: rgb(244 92 92 / 0.95); }
${R} .of-figure-aura {
  position: absolute; inset: 12% 6% 34%; border-radius: 50%; filter: blur(42px); opacity: 0.5;
  background: radial-gradient(circle, var(--of-face-aura, var(--of-li-accent)), transparent 68%);
}
${R} .of-figure-img {
  position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; object-position: 50% 100%;
  user-select: none; -webkit-user-drag: none;
}
${R} .of-figure[data-cut="true"] .of-figure-img {
  filter: drop-shadow(0 0 1px rgb(255 255 255 / 0.45)) drop-shadow(0 22px 34px rgb(0 0 0 / 0.32))
    drop-shadow(0 0 26px color-mix(in srgb, var(--of-li-accent) 40%, transparent));
}
/* No cut-out yet (or it failed): the look's flat grey melts away under a soft mask and a slow pan. */
${R} .of-figure[data-art="look"][data-cut="false"] .of-figure-img {
  object-fit: cover; animation: of-figure-pan 28s ease-in-out infinite alternate;
  -webkit-mask-image: linear-gradient(to bottom, transparent, #000 8%),
    radial-gradient(58% 70% at 50% 42%, #000 56%, transparent 100%);
  -webkit-mask-composite: source-in;
  mask-image: linear-gradient(to bottom, transparent, #000 8%), radial-gradient(58% 70% at 50% 42%, #000 56%, transparent 100%);
  mask-composite: intersect;
}
${R} .of-figure[data-mood="cold"] .of-figure-breathe { filter: saturate(0.7) brightness(0.93); }
${R} .of-figure[data-mood="annoyed"] .of-figure-drift { animation: of-pout 420ms ease-in-out 2; }
/* Without a full-body look the medallion or cameo and its pills fill the cell's middle: the medallion leaves room for
   its ring above (12 px), the 18 px gap its ring reaches into and the pills (54 px), 84 px in all. */
${R} .of-figure:is([data-art="none"], [data-art="avatar"]) {
  --of-medallion: min(220px, 100cqw - 32px, 100cqh - 84px);
  inset: 0; width: auto; aspect-ratio: auto;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px;
}
${R} .of-figure:is([data-art="none"], [data-art="avatar"]) :is(.of-figure-parallax, .of-figure-drift, .of-figure-breathe) {
  position: relative; inset: auto; width: 100%;
}
${R} .of-figure[data-art="avatar"] { --of-medallion: min(220px, 100cqw - 32px, (100cqh - 84px) * 0.8); }
${R} .of-figure:is([data-art="none"], [data-art="avatar"]) .of-figure-parallax { flex: none; width: var(--of-medallion); }
${R} .of-figure[data-art="none"] .of-figure-breathe { aspect-ratio: 1; }
${R} .of-figure[data-art="avatar"] .of-figure-breathe { aspect-ratio: 4 / 5; }
${R} .of-figure:is([data-art="none"], [data-art="avatar"]) .of-figure-aura { inset: -28%; filter: blur(24px); opacity: 0.6; }
${R} .of-figure-medallion {
  position: absolute; inset: 0; display: grid; place-items: center; border-radius: 50%;
  background:
    radial-gradient(circle at 32% 24%, rgb(255 255 255 / 0.55), transparent 50%),
    linear-gradient(150deg, color-mix(in srgb, var(--of-li-accent) 78%, white), var(--of-li-accent) 55%,
      color-mix(in srgb, var(--of-li-accent) 70%, ${PALETTE.ink}));
  box-shadow: 0 0 0 3px var(--of-wish-ring), 0 22px 50px rgb(0 0 0 / 0.3), 0 0 60px var(--of-glow-soft);
}
${R} .of-figure[data-who="me"] .of-figure-medallion {
  background:
    radial-gradient(circle at 32% 24%, rgb(255 255 255 / 0.6), transparent 50%),
    linear-gradient(150deg, #f6e2b0 0%, ${PALETTE.champagne} 34%, ${PALETTE.rose} 78%, #c48ab9 100%);
}
${R} .of-figure-ring {
  position: absolute; inset: -12px; border-radius: 50%; border: 1px solid color-mix(in srgb, var(--of-li-accent) 55%, white);
  box-shadow: 0 0 0 8px color-mix(in srgb, var(--of-li-accent) 14%, transparent);
}
${R} .of-figure-initials {
  position: relative; font-family: var(--of-font-display); font-weight: 600;
  font-size: min(5.4rem, var(--of-medallion) * 0.37);
  letter-spacing: 0.02em; color: ${PALETTE.ink}; text-shadow: 0 1px 0 rgb(255 255 255 / 0.45);
}
${R} .of-figure[data-art="avatar"] .of-figure-img {
  object-fit: cover; object-position: 50% 18%; border-radius: 999px 999px 40% 40% / 999px 999px 30% 30%;
  box-shadow: 0 0 0 3px var(--of-wish-ring), 0 0 0 9px rgb(230 201 138 / 0.22), 0 24px 50px rgb(0 0 0 / 0.3);
}
/* His tap zones: invisible over the art (a soft glow on hover, a dashed ring on focus), labelled pills without it.
   A zone stops at the cell's inline start (--of-cell-start, in the art's own box), so the rail never covers one. */
${R} .of-tap-zones {
  position: absolute; inset: 0;
  --of-cell-start: max((100% - 100cqw) / 2, 100% - 100cqw - 12px);
}
${R} .of-tap-zone {
  position: absolute; padding: 0; border: 0; border-radius: 46%; background: transparent; cursor: pointer;
  pointer-events: auto;
}
${R} .of-tap-zone[data-zone="head"] { inset-inline: max(33%, var(--of-cell-start)) 33%; top: 2%; height: 16%; }
${R} .of-tap-zone[data-zone="heart"] { inset-inline: max(34%, var(--of-cell-start)) 34%; top: 23%; height: 15%; }
${R} .of-tap-zone[data-zone="hand"] { inset-inline: max(14%, var(--of-cell-start)) 14%; top: 42%; height: 14%; }
${R} .of-tap-zone:hover { background: radial-gradient(closest-side, rgb(255 255 255 / 0.14), transparent); }
${R} .of-tap-zone:focus-visible {
  outline: 2px dashed var(--of-focus); outline-offset: 0;
  background: radial-gradient(closest-side, var(--of-glow-soft), transparent);
}
${R} .of-tap-pills {
  position: relative; display: flex; justify-content: center; gap: 6px; max-width: 100%; pointer-events: auto;
}
${R} .of-tap-pill {
  display: inline-flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
  width: 60px; min-width: 0; min-height: 54px; padding: 6px 4px; border-radius: 18px; overflow-wrap: anywhere;
  font-weight: 700; font-size: 0.72rem; cursor: pointer;
}
${R} .of-tap-pill svg { color: var(--of-accent-text); }
${R} .of-tap-pill:hover { background: var(--of-surface-strong); }
/* Hidden at rest (opacity 0): the animation shows it, so with motion reduced it never stays over him. */
${R} .of-tap-burst {
  position: absolute; left: 50%; top: 10%; width: 54px; height: 54px; margin: -27px 0 0 -27px; border-radius: 50%;
  pointer-events: none; opacity: 0; border: 2px solid rgb(255 214 228 / 0.9);
  box-shadow: 0 0 18px rgb(255 182 202 / 0.8), inset 0 0 12px rgb(255 214 228 / 0.6);
  animation: of-tap-burst 900ms var(--of-ease) both;
}
${R} .of-tap-burst[data-zone="heart"] { top: 30%; }
${R} .of-tap-burst[data-zone="hand"] { top: 49%; }
${R} .of-tap-pills .of-tap-burst { top: -60%; }

/* The note, the rail and the nameplate sit over the art; only what they hold takes the pointer. */
${R} :is(.of-home-top, .of-home-rail, .of-home-foot) { pointer-events: none; }
${R} :is(.of-home-top, .of-home-rail, .of-home-foot) > * { pointer-events: auto; }
${R} .of-home-top {
  grid-area: top; position: relative; z-index: 2; min-height: 0; display: flex; justify-content: center;
  padding-top: 4px;
}
/* The rail stands at the inline start, as wide as its widest button up to 11rem (less on a narrow stage): a longer
   label is cut short (the Him option) or wraps. It ends 16 px over the dock, clear of the Wish orb rising out of it. */
${R} .of-home-rail {
  grid-area: rail; align-self: end; position: relative; z-index: 2; max-width: min(11rem, 46cqw); margin-bottom: 16px;
  display: flex; flex-direction: column; align-items: flex-start; gap: 8px;
}
${R} .of-home-rail > * { max-width: 100%; }
/* M6's Remind Me and Caring message: round, side by side at the rail's foot; only the buttons take the pointer. */
${R} .of-home-rail-row { display: flex; gap: 8px; pointer-events: none; }
${R} .of-home-rail-row > * { pointer-events: auto; }
/* A short stage (a 360 × 600 phone under the Engine's own bars leaves about 500 px): the rail tightens by 30 px, every
   button still at least 30 px tall, so the note keeps a line of its words above M6's row. */
@container of-frame (max-height: 540px) {
  ${R} .of-home-rail { gap: 5px; }
  ${R} .of-home-rail .of-home-action { min-height: 36px; }
  ${R} .of-home-rail .of-himme-option { min-height: 30px; }
  ${R} .of-home-rail-row .of-icon-button { width: 36px; height: 36px; }
}
${R} .of-home-action {
  display: inline-flex; align-items: center; gap: 8px; min-height: 40px; padding-block: 0; padding-inline: 11px 15px;
  border-radius: 999px; cursor: pointer; font-weight: 700; font-size: 0.82rem; letter-spacing: 0.02em;
}
${R} .of-home-action:hover { background: var(--of-surface-strong); }
${R} .of-home-action svg { flex: none; color: var(--of-accent-text); }
${R} .of-home-badge {
  display: inline-grid; place-items: center; min-width: 19px; height: 19px; padding: 0 5px; border-radius: 999px;
  font-size: 0.68rem; font-weight: 800; font-variant-numeric: tabular-nums; color: ${PALETTE.ink};
  background: linear-gradient(135deg, #f3dcaa, ${PALETTE.rose}); box-shadow: 0 0 10px var(--of-glow-soft);
}
${R} .of-himme { display: inline-flex; gap: 3px; margin: 0; padding: 3px; border-radius: 999px; min-width: 0; }
${R} .of-himme-option + .of-himme-option { flex: none; }
/* His side gives way to the rail's width (min-width 0), so a long name is cut short inside the rail rather than push
   Me out over his cell. */
${R} .of-himme-option {
  position: relative; display: inline-flex; align-items: center; min-width: 0; min-height: 34px; max-width: 8.5rem;
  padding: 0 13px;
  border-radius: 999px; cursor: pointer; font-weight: 700; font-size: 0.82rem; color: var(--of-text-soft);
  transition: color 360ms var(--of-ease), background-color 360ms var(--of-ease);
}
${R} .of-himme-option span { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
${R} .of-himme-option:hover { color: var(--of-text); }
${R} .of-himme-option[data-checked="true"] {
  color: ${PALETTE.ink};
  background: linear-gradient(135deg, #f3dcaa 0%, ${PALETTE.champagne} 30%, ${PALETTE.rose} 100%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.55), 0 3px 12px var(--of-glow-soft);
}
${R} .of-himme-option:has(input:focus-visible) { outline: 2px solid var(--of-focus); outline-offset: 2px; }
/* His line, at the top of the figure's cell (aria-hidden, and it lets taps through). */
${R} .of-home-bubble {
  grid-area: main; align-self: start; justify-self: end; position: relative; z-index: 3; max-width: min(100%, 270px);
  margin: 4px 0 0; padding: 11px 16px;
  border-radius: 20px 20px 20px 6px; pointer-events: none;
  font-family: var(--of-font-display); font-style: italic; font-weight: 600; font-size: 1.14rem; line-height: 1.3;
  box-shadow: inset 0 1px 0 var(--of-highlight), var(--of-panel-shadow),
    0 0 0 1px color-mix(in srgb, var(--of-li-accent) 45%, transparent);
  animation: of-bubble 4.6s var(--of-ease) both;
}
${R}[dir="rtl"] .of-home-bubble { border-radius: 20px 20px 6px 20px; }
/* Beside a medallion (no full-body look) the bubble takes the cell's inline start. */
${R} .of-home[data-figure="medallion"] .of-home-bubble { justify-self: start; border-radius: 20px 20px 6px 20px; }
${R}[dir="rtl"] .of-home[data-figure="medallion"] .of-home-bubble { border-radius: 20px 20px 20px 6px; }
${R} .of-home-bubble[data-mode="cold"] { font-style: normal; color: var(--of-text-soft); }
${R} .of-home-bubble[data-mode="annoyed"] { box-shadow: var(--of-panel-shadow), 0 0 0 1px rgb(240 138 164 / 0.7); }
${R} .of-home-foot { position: relative; z-index: 2; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
${R} .of-home-plate {
  display: flex; flex-direction: column; align-items: flex-end; gap: 3px; max-width: 100%; padding: 8px 16px 9px;
  border-radius: 20px 20px 6px 20px; text-align: end; border-inline-end: 3px solid var(--of-li-accent);
}
${R}[dir="rtl"] .of-home-plate { border-radius: 20px 20px 20px 6px; }
/* Sized to keep a name of two short words on one line beside the rail on a narrow stage (a longer one wraps). */
${R} .of-home-name {
  font-family: var(--of-font-display); font-weight: 600; font-size: clamp(1.3rem, 6.2cqw, 2.05rem); line-height: 1.02;
  overflow-wrap: anywhere; padding-bottom: 0.04em;
}
${R} .of-home-name:focus { outline: none; }
${R} .of-home-name:focus-visible { outline: 2px solid var(--of-focus); outline-offset: 4px; border-radius: 6px; }
${R} .of-mood-chip {
  display: inline-flex; align-items: center; gap: 6px; font-family: var(--of-font-hand); font-weight: 500;
  font-size: 1.22rem; line-height: 1.05; color: var(--of-accent-text);
}
${R} .of-mood-chip svg { flex: none; color: var(--of-champagne-text); }

/* The message of the day: a slip of paper taped over the scene, in his handwriting. Paper and ink in both looks. On a
   short stage its row gives way to the rail and his cell, and the text scrolls inside it (Play and Reply stay). */
${R} .of-note {
  --of-focus: #8E3F5E; --of-paper-ink: #3a2a42;
  position: relative; display: flex; flex-direction: column; width: min(100%, 340px); max-height: 100%;
  padding: 14px 16px 10px; border-radius: 4px 16px 6px 18px;
  color: var(--of-paper-ink);
  background:
    repeating-linear-gradient(180deg, transparent 0 27px, rgb(160 77 107 / 0.1) 27px 28px) 0 40px / 100% calc(100% - 52px) no-repeat,
    radial-gradient(120% 90% at 0% 0%, rgb(255 255 255 / 0.9), transparent 60%),
    linear-gradient(170deg, #fffaf2 0%, #fbf1e6 60%, #f6e6dc 100%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.8), 0 16px 34px rgb(8 4 24 / 0.34), 0 2px 6px rgb(8 4 24 / 0.18);
  transform: rotate(-1.2deg); transform-origin: 50% 0; animation: of-note-in 700ms var(--of-ease) both;
}
${R}[data-look="pearl"] .of-note {
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.8), 0 14px 30px rgb(120 70 100 / 0.22), 0 2px 6px rgb(120 70 100 / 0.14);
}
${R} .of-note::before {
  content: ""; position: absolute; top: -10px; left: 50%; width: 86px; height: 22px; translate: -50% 0; rotate: 2.5deg;
  background: linear-gradient(90deg, color-mix(in srgb, var(--of-li-accent) 62%, transparent),
    color-mix(in srgb, var(--of-li-accent) 44%, transparent));
  clip-path: polygon(3% 0, 97% 5%, 100% 100%, 0 95%); box-shadow: 0 1px 3px rgb(0 0 0 / 0.12);
}
${R} .of-note-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
${R} .of-note-from {
  display: inline-flex; align-items: center; gap: 6px; min-width: 0; font-family: var(--of-font-body); font-size: 0.68rem;
  font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: #8e3f5e;
}
${R} .of-note-fold {
  flex: none; display: grid; place-items: center; width: 32px; height: 32px; margin-block: -6px; margin-inline-end: -8px;
  padding: 0; border: 0; border-radius: 50%; background: transparent; color: #8e3f5e; cursor: pointer;
}
${R} .of-note-fold:hover { background: rgb(160 77 107 / 0.1); }
${R} .of-note-body { display: flex; flex-direction: column; gap: 8px; min-height: 0; margin-top: 6px; }
${R} .of-note-body[hidden] { display: none; }
${R} .of-note-text {
  min-height: 0; overflow-y: auto; font-family: var(--of-font-hand); font-weight: 500; font-size: 1.5rem;
  line-height: 1.14; overflow-wrap: anywhere;
}
${R} .of-note-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
${R} .of-note-sign {
  font-family: var(--of-font-hand); font-size: 1.32rem; color: color-mix(in srgb, var(--of-li-accent) 45%, #3a2a42);
}
${R} .of-note-button {
  display: inline-flex; align-items: center; gap: 5px; min-height: 32px; padding: 0 12px; border-radius: 999px;
  border: 1px solid rgb(160 77 107 / 0.3); background: rgb(255 255 255 / 0.62); color: #6b2f4a; cursor: pointer;
  font-weight: 800; font-size: 0.78rem;
}
${R} .of-note-button:hover { background: #fff; }
${R} .of-note-button[aria-pressed="true"] { background: #fbe3ea; }
${R} .of-note-quiet {
  display: flex; align-items: center; gap: 8px; font-family: var(--of-font-hand); font-size: 1.3rem; line-height: 1.15;
  color: #5a4060;
}
${R} .of-note-quill { flex: none; color: #a04d6b; animation: of-write 1.8s ease-in-out infinite; }
${R} .of-note .of-hint { color: #5a4060; }
${R} .of-note-failed, ${R} .of-note--alert { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
${R} .of-note-voice-error { font-size: 0.76rem; font-weight: 700; color: #8e3f5e; }

/* Rough day? and Who's home? */
${R} .of-comfort { display: flex; flex-direction: column; align-items: center; gap: 10px; margin: 0; text-align: center; }
${R} .of-comfort-line {
  margin: 0; font-family: var(--of-font-hand); font-weight: 500; font-size: 1.62rem; line-height: 1.16;
  color: var(--of-text); overflow-wrap: anywhere;
}
${R} .of-comfort-by { font-family: var(--of-font-display); font-style: italic; font-weight: 600; color: var(--of-text-soft); }
${R} .of-home-picks { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
${R} .of-home-pick {
  display: flex; align-items: center; gap: 12px; width: 100%; padding: 8px 12px; border-radius: 18px; cursor: pointer;
  text-align: start; transition: border-color 360ms var(--of-ease), box-shadow 360ms var(--of-ease);
}
${R} .of-home-pick:hover { border-color: var(--of-border-strong); }
${R} .of-home-pick[aria-current="true"] {
  border-color: rgb(230 201 138 / 0.75);
  box-shadow: inset 0 0 0 1px rgb(230 201 138 / 0.5), 0 8px 24px var(--of-glow-soft);
}
${R} .of-home-pick-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
${R} .of-home-pick-name { font-family: var(--of-font-display); font-weight: 600; font-size: 1.16rem; line-height: 1.1; }
${R} .of-home-pick-mark { flex: none; color: var(--of-champagne-text); }
@keyframes of-figure-drift { from { transform: translate3d(-3px, 1px, 0); } to { transform: translate3d(5px, -3px, 0); } }
@keyframes of-figure-breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.006); } }
@keyframes of-figure-pan {
  from { transform: scale(1.03) translate3d(-1.2%, 0.6%, 0); } to { transform: scale(1.07) translate3d(1.2%, -0.8%, 0); }
}
@keyframes of-home-beam { from { opacity: 0.62; } to { opacity: 0.92; } }
@keyframes of-tap-burst { from { opacity: 0.95; transform: scale(0.3); } to { opacity: 0; transform: scale(1.7); } }
@keyframes of-pout { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
@keyframes of-bubble {
  0% { opacity: 0; transform: translateY(6px) scale(0.96); } 10% { opacity: 1; transform: none; }
  86% { opacity: 1; transform: none; } 100% { opacity: 0; transform: translateY(-4px); }
}
@keyframes of-note-in {
  from { opacity: 0; transform: translateY(-10px) rotate(-3deg); } to { opacity: 1; transform: rotate(-1.2deg); }
}
@media (prefers-reduced-motion: reduce) {
  ${R} :is(.of-home-l0, .of-home-l3, .of-figure-parallax) { transform: none !important; }
}`;

// The phone: the thread list, and one thread with bubbles in his accent colour, stickers, suggestions and the composer.
const PHONE_RULES = `
${R} .of-threads { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
${R} .of-thread-row {
  display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px 12px; border-radius: 20px; cursor: pointer;
  text-align: start; border-inline-start: 3px solid var(--of-li-accent);
}
${R} .of-thread-row:hover { background: var(--of-surface-strong); }
${R} .of-thread-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
${R} .of-thread-name { font-family: var(--of-font-display); font-weight: 600; font-size: 1.2rem; line-height: 1.1; }
${R} .of-thread-last {
  overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: 0.86rem; color: var(--of-text-soft);
}
${R} .of-thread-row[data-unread="true"] .of-thread-last { color: var(--of-text); font-weight: 700; }
${R} .of-thread-meta { flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 5px; }
${R} .of-thread-time { font-size: 0.72rem; color: var(--of-text-faint); font-variant-numeric: tabular-nums; }
${R} .of-thread {
  flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 8px;
  padding: 0 10px max(10px, env(safe-area-inset-bottom));
}
/* At phone width Close and remember wraps under his name rather than cutting it short. */
${R} .of-thread-head {
  display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; padding: 6px 8px; border-radius: 22px;
  border-bottom: 2px solid color-mix(in srgb, var(--of-li-accent) 55%, transparent);
}
${R} .of-thread-title {
  flex: 1 1 8rem; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
  font-family: var(--of-font-display); font-weight: 600; font-size: 1.3rem; line-height: 1.1;
}
${R} .of-thread-title:focus { outline: none; }
${R} .of-thread-title:focus-visible { outline: 2px solid var(--of-focus); outline-offset: 3px; border-radius: 6px; }
${R} .of-thread-close { flex: none; margin-inline-start: auto; padding: 0 12px; }
${R} .of-thread-close[aria-disabled="true"] { opacity: 0.55; cursor: default; }
${R} .of-thread-log {
  flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; display: flex; flex-direction: column; gap: 4px;
  margin: 0; padding: 6px 2px 4px; list-style: none; scrollbar-width: thin;
  scrollbar-color: var(--of-border-strong) transparent;
}
${R} .of-thread-empty {
  margin: auto; display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-radius: 16px;
  font-size: 0.9rem; text-align: center; color: var(--of-text-soft);
}
${R} .of-thread-older { align-self: center; }
/* The end of a closed conversation: what he remembers of it. */
${R} .of-thread-divider {
  display: flex; flex-direction: column; align-items: center; gap: 5px; margin: 10px 6px; padding: 9px 14px 11px;
  border-radius: 16px; text-align: center; background: rgb(230 201 138 / 0.08); border: 1px dashed rgb(230 201 138 / 0.42);
}
${R} .of-thread-divider-title {
  display: inline-flex; align-items: center; gap: 6px; font-size: 0.7rem; font-weight: 800; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--of-champagne-text);
}
${R} .of-thread-divider .of-badge { margin-inline-start: 0; }
${R} .of-bubble-row { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; }
${R} .of-bubble-row[data-who="player"] { align-items: flex-end; }
${R} .of-bubble-row[data-archived="true"] { opacity: 0.66; }
${R} .of-bubble-row[data-pending="true"] { opacity: 0.78; }
${R} .of-bubble {
  position: relative; display: flex; flex-direction: column; gap: 4px; max-width: 80%; padding: 9px 14px;
  border-radius: 20px; font-size: 0.95rem; line-height: 1.42; white-space: pre-wrap; overflow-wrap: anywhere;
  animation: of-bubble-in 360ms var(--of-ease) both;
}
${R} .of-bubble-row[data-who="li"] .of-bubble {
  border-end-start-radius: 6px; color: var(--of-text);
  background: color-mix(in srgb, var(--of-li-accent) 30%, var(--of-surface-solid));
  border: 1px solid color-mix(in srgb, var(--of-li-accent) 52%, transparent); box-shadow: 0 6px 16px rgb(0 0 0 / 0.14);
}
${R} .of-bubble-row[data-who="player"] .of-bubble {
  border-end-end-radius: 6px; color: ${PALETTE.ink};
  background: linear-gradient(135deg, #f6e4bd 0%, #f0cfae 40%, ${PALETTE.rose} 100%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.6), 0 6px 16px rgb(0 0 0 / 0.12);
}
${R} .of-bubble-row .of-bubble[data-sticker="true"] { padding: 4px; background: transparent; border-color: transparent; box-shadow: none; }
${R} .of-bubble-quote {
  display: block; padding: 3px 10px; border-inline-start: 3px solid currentColor; border-radius: 4px 10px 10px 4px;
  background: rgb(255 255 255 / 0.22); font-family: var(--of-font-hand); font-size: 1.1rem; line-height: 1.12; opacity: 0.9;
}
${R} .of-bubble-time { padding: 0 6px; font-size: 0.68rem; color: var(--of-text-faint); font-variant-numeric: tabular-nums; }
${R} .of-sticker {
  display: block; width: 112px; height: 112px; object-fit: cover; object-position: 50% 12%; border-radius: 22px;
  box-shadow: 0 0 0 3px var(--of-wish-ring), 0 8px 18px rgb(0 0 0 / 0.2);
}
${R} .of-sticker--quiet {
  display: inline-flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; width: 96px;
  height: 96px; font-weight: 800; font-size: 0.74rem; color: ${PALETTE.ink};
  background:
    radial-gradient(circle at 32% 24%, rgb(255 255 255 / 0.55), transparent 52%),
    linear-gradient(150deg, color-mix(in srgb, var(--of-li-accent) 78%, white), var(--of-li-accent));
}
${R} .of-typing { flex-direction: row; align-items: center; gap: 5px; padding: 13px 15px; }
${R} .of-typing-dot {
  width: 7px; height: 7px; border-radius: 50%; background: currentColor; opacity: 0.5;
  animation: of-typing 1.2s ease-in-out infinite;
}
${R} .of-typing-dot:nth-child(2) { animation-delay: 0.15s; }
${R} .of-typing-dot:nth-child(3) { animation-delay: 0.3s; }
${R} .of-memory-text { font-size: 0.86rem; color: var(--of-text-soft); }
${R} .of-memory-quote { font-family: var(--of-font-hand); font-size: 1.22rem; line-height: 1.12; color: var(--of-accent-text); }
${R} .of-suggestions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; margin: 0; padding: 0; list-style: none; }
${R} .of-suggestion {
  min-height: 34px; padding: 0 14px; border-radius: 999px; font-weight: 700; font-size: 0.84rem; cursor: pointer;
  border-color: color-mix(in srgb, var(--of-li-accent) 55%, transparent);
}
${R} .of-suggestion:hover { background: var(--of-surface-strong); }
${R} .of-suggestion[aria-disabled="true"] { opacity: 0.6; cursor: default; }
${R} .of-composer { position: relative; display: flex; flex-direction: column; gap: 6px; padding: 6px; border-radius: 24px; }
${R} .of-composer-row { display: flex; align-items: flex-end; gap: 6px; }
${R} .of-composer-input {
  flex: 1; min-width: 0; min-height: 40px; max-height: 7.6em; resize: none; padding: 9px 14px; border-radius: 18px;
  field-sizing: content;
}
${R} .of-send {
  border: 0; color: ${PALETTE.ink};
  background: linear-gradient(135deg, #f3dcaa 0%, ${PALETTE.champagne} 30%, ${PALETTE.rose} 100%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.6), 0 6px 16px var(--of-glow-soft);
}
${R} .of-send:hover { color: ${PALETTE.ink}; background: linear-gradient(135deg, #f6e2b8 0%, ${PALETTE.champagne} 30%, ${PALETTE.rose} 100%); }
${R} .of-send[aria-disabled="true"] { opacity: 0.5; cursor: default; }
${R} .of-composer-counter { position: absolute; top: -18px; inset-inline-end: 14px; font-size: 0.7rem; }
${R} .of-quote-chip {
  display: flex; align-items: center; gap: 8px; padding-block: 5px; padding-inline: 12px 5px; border-radius: 16px;
  background: var(--of-tint); border-inline-start: 3px solid var(--of-li-accent);
}
${R} .of-quote-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
${R} .of-quote-label {
  font-size: 0.66rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--of-accent-text);
}
${R} .of-quote-chip q { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-family: var(--of-font-hand); font-size: 1.15rem; }
${R} .of-quote-chip .of-icon-button { width: 32px; height: 32px; }
${R} .of-stickers { position: relative; flex: none; }
${R} .of-stickers .of-icon-button[aria-disabled="true"] { opacity: 0.5; cursor: default; }
${R} .of-sticker-panel {
  position: absolute; bottom: calc(100% + 8px); inset-inline-start: 0; z-index: 5; display: grid;
  grid-template-columns: repeat(3, 64px); gap: 6px; padding: 8px; border-radius: 18px;
  animation: of-rise 300ms var(--of-ease) both;
}
${R} .of-sticker-choice {
  width: 64px; height: 64px; padding: 0; border: 0; border-radius: 16px; overflow: hidden; cursor: pointer;
  background: transparent; transition: transform 300ms var(--of-ease);
}
${R} .of-sticker-choice img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 12%; }
${R} .of-sticker-choice:hover { transform: scale(1.05); }
@keyframes of-bubble-in { from { opacity: 0; transform: translateY(6px) scale(0.97); } to { opacity: 1; transform: none; } }
@keyframes of-typing { 0%, 60%, 100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-4px); opacity: 1; } }`;
// M2b: painted places and story CGs, the Confrontation's stances and ending, voices in the backlog, routes and
// ruptures on the Story screen, and Settings → Audio.
const PRESENTATION_RULES = `
/* A painted place behind the scene, crossfading; the mood's colour still tints it through the vignette. */
${R} .of-place {
  position: absolute; inset: 0; background-size: cover; background-position: center; opacity: 0;
  transform: scale(1.03); transition: opacity 900ms var(--of-ease);
}
${R} .of-place[data-on="true"] { opacity: 1; }
${R} .of-place::after {
  content: ""; position: absolute; inset: 0;
  background: linear-gradient(to bottom, rgb(10 8 24 / 0.18), transparent 34%, rgb(10 8 24 / 0.42) 100%);
}
${R}[data-look="pearl"] .of-place::after {
  background: linear-gradient(to bottom, rgb(255 250 246 / 0.2), transparent 34%, rgb(90 50 80 / 0.22) 100%);
}
/* Over a picture (a place or a CG) the header keeps its contrast: a scrim in the look's own surface colour. */
${R}[data-look="midnight"] { --of-picture-scrim: rgb(12 9 28 / 0.72); }
${R}[data-look="pearl"] { --of-picture-scrim: rgb(255 250 246 / 0.86); }
${R} .of-reader[data-picture="true"] .of-reader-head::before {
  content: ""; position: absolute; inset: 0 0 -48px; z-index: -1; pointer-events: none;
  background: linear-gradient(to bottom, var(--of-picture-scrim) 0%, var(--of-picture-scrim) 55%, transparent 100%);
}
${R} .of-reader[data-picture="true"] .of-choices-heading,
${R} .of-reader[data-picture="true"] .of-stances-round { text-shadow: none; }
${R} .of-reader[data-picture="true"] .of-choices-heading {
  align-self: center; padding: 2px 14px; border-radius: 999px; background: var(--of-picture-scrim);
}
/* A story CG takes the stage: letterbox bars close in, the image pans for about 6 s, then the box returns at 80%. */
${R} .of-cg {
  position: absolute; inset: 0; z-index: 1; margin: 0; overflow: clip; background: #07050f;
  animation: of-fade-in 900ms var(--of-ease) both;
}
${R} .of-cg-img {
  position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 30%;
  transform: scale(1.04); transition: transform 1200ms var(--of-ease);
}
${R} .of-cg[data-intro="true"] .of-cg-img { animation: of-cg-pan 6s cubic-bezier(0.32, 0.06, 0.3, 1) both; }
${R} .of-cg-bar {
  position: absolute; inset-inline: 0; height: 11%; background: #050309; transform: scaleY(0);
  transition: transform 700ms var(--of-ease);
}
${R} .of-cg-bar--top { top: 0; transform-origin: top; }
${R} .of-cg-bar--bottom { bottom: 0; transform-origin: bottom; }
${R} .of-cg[data-intro="true"] .of-cg-bar { transform: scaleY(1); }
/* While it pans the picture holds focus (the faded UI is inert) and a tap anywhere ends it. */
${R} .of-cg[data-intro="true"] { cursor: pointer; }
${R} .of-cg:focus-visible { outline-offset: -6px; }
${R} .of-reader[data-cg="intro"] :is(.of-reader-head, .of-reader-bottom) {
  opacity: 0; pointer-events: none; transition: opacity 600ms var(--of-ease);
}
${R} .of-reader[data-cg] :is(.of-reader-head, .of-reader-bottom) { transition: opacity 700ms var(--of-ease); }
${R} .of-reader[data-cg="shown"] .of-dialogue { opacity: 0.8; transition: opacity 420ms var(--of-ease); }
${R} .of-reader[data-cg="shown"] .of-dialogue:is(:hover, :focus-within) { opacity: 1; }
${R} .of-reader[data-cg] .of-reader-vignette { opacity: 0.6; }
${R} .of-cg-caption { display: flex; flex-direction: column; align-items: center; gap: 8px; }
${R} .of-cg-quiet .of-cost { justify-content: center; }
/* Toasts for an unlocked CG and for audio that could not play. */
${R} .of-toast--cg { font-weight: 800; font-size: 0.88rem; color: var(--of-champagne-text); }
${R} .of-toast--cg svg { filter: drop-shadow(0 0 6px var(--of-wish-glow)); }
${R} .of-toast-note { font-weight: 600; color: var(--of-text-soft); }
${R} .of-toast--audio { font-weight: 700; font-size: 0.8rem; color: var(--of-text-soft); }
${R} .of-reader-chip-slot { flex: none; display: flex; }
${R} .of-reader-chip--paint {
  cursor: pointer; color: var(--of-champagne-text); border-color: rgb(230 201 138 / 0.55); font-family: inherit;
}
${R} .of-reader-chip--paint:hover { background: var(--of-surface-strong); }
${R} .of-reader-chip--paint[aria-disabled="true"] { opacity: 0.6; cursor: progress; }
/* The Confrontation: four stances in his colour, a round marker, and the ending's card. */
${R} .of-stances { display: flex; flex-direction: column; gap: 8px; padding: 0 4px; animation: of-rise 480ms var(--of-ease) both; }
${R} .of-stances-round {
  align-self: center; display: inline-flex; align-items: center; gap: 6px; padding: 3px 12px; border-radius: 999px;
  font-size: 0.66rem; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--of-champagne-text);
  background: var(--of-surface-strong); border: 1px solid rgb(230 201 138 / 0.45);
  -webkit-backdrop-filter: var(--of-glass-blur); backdrop-filter: var(--of-glass-blur);
}
${R} .of-stance-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 0; padding: 0; list-style: none; }
${R} .of-stance-list > li { display: flex; min-width: 0; }
${R} .of-stance {
  --of-stance: var(--of-li-accent, ${PALETTE.rose});
  position: relative; display: flex; align-items: flex-start; gap: 9px; width: 100%; min-height: 64px; padding: 10px 12px;
  border-radius: 18px; border: 1px solid color-mix(in srgb, var(--of-stance) 45%, var(--of-border-strong));
  background: linear-gradient(150deg, color-mix(in srgb, var(--of-stance) 20%, transparent), transparent 70%), var(--of-surface-strong);
  -webkit-backdrop-filter: var(--of-glass-blur); backdrop-filter: var(--of-glass-blur);
  box-shadow: inset 0 1px 0 var(--of-highlight), var(--of-panel-shadow); color: var(--of-text); text-align: start; cursor: pointer;
  transition: transform 360ms var(--of-ease), border-color 360ms var(--of-ease), box-shadow 360ms var(--of-ease);
}
${R} .of-stance[data-stance="press"] { --of-stance: #F08AA4; }
${R} .of-stance[data-stance="hold"] { --of-stance: #9DB8F0; }
${R} .of-stance[data-stance="yield"] { --of-stance: ${PALETTE.champagne}; }
${R} .of-stance[data-stance="reveal"] { --of-stance: #B79CF2; }
${R} .of-stance:hover {
  transform: translateY(-1px); border-color: var(--of-stance);
  box-shadow: inset 0 1px 0 var(--of-highlight), 0 10px 26px color-mix(in srgb, var(--of-stance) 30%, transparent);
}
${R} .of-stance[aria-disabled="true"] { opacity: 0.65; cursor: progress; transform: none; }
${R} .of-stance-mark {
  flex: none; display: grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; color: ${PALETTE.ink};
  background: linear-gradient(140deg, color-mix(in srgb, var(--of-stance) 55%, white), var(--of-stance));
  box-shadow: 0 0 12px color-mix(in srgb, var(--of-stance) 45%, transparent);
}
${R} .of-stance-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
${R} .of-stance-name {
  font-size: 0.66rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase;
  color: color-mix(in srgb, var(--of-stance) 55%, var(--of-text));
}
${R}[data-look="pearl"] .of-stance-name { color: color-mix(in srgb, var(--of-stance) 40%, ${PALETTE.ink}); }
${R} .of-stance-line { font-size: 0.86rem; font-weight: 700; line-height: 1.3; overflow-wrap: anywhere; }
@container of-stage (max-width: 330px) { ${R} .of-stance-list { grid-template-columns: minmax(0, 1fr); } }
${R} .of-outcome { gap: 8px; border-color: color-mix(in srgb, var(--of-li-accent, ${PALETTE.rose}) 55%, transparent); }
${R} .of-outcome-mark {
  display: grid; place-items: center; width: 52px; height: 52px; border-radius: 50%; color: var(--of-accent-text);
  background: radial-gradient(circle, color-mix(in srgb, var(--of-li-accent, ${PALETTE.rose}) 38%, transparent), transparent 70%);
  box-shadow: 0 0 30px color-mix(in srgb, var(--of-li-accent, ${PALETTE.rose}) 40%, transparent);
}
${R} .of-outcome[data-outcome="walkout"] .of-outcome-mark { color: var(--of-danger); }
${R} .of-outcome[data-outcome="standoff"] .of-outcome-mark { color: var(--of-champagne-text); }
${R} .of-outcome-title {
  font-family: var(--of-font-display); font-weight: 600; font-size: 1.65rem; line-height: 1.08; padding-bottom: 0.06em;
  background: var(--of-title-ink); -webkit-background-clip: text; background-clip: text; color: transparent;
}
${R} .of-outcome-title:focus { outline: none; }
${R} .of-outcome-title:focus-visible { outline: 2px solid var(--of-focus); outline-offset: 4px; border-radius: 6px; }
/* The chapter's end: a stage a gate opened, a rupture a repair closed. */
${R} .of-arc-news {
  display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 12px; border-radius: 14px; text-align: start;
  font-weight: 800; font-size: 0.9rem; color: var(--of-text);
  background: linear-gradient(120deg, color-mix(in srgb, var(--of-li-accent, ${PALETTE.rose}) 30%, transparent), transparent 75%), var(--of-surface-hover);
  border: 1px solid color-mix(in srgb, var(--of-li-accent, ${PALETTE.rose}) 50%, transparent);
}
${R} .of-arc-news svg { flex: none; color: var(--of-champagne-text); }
/* The backlog's voice replay. */
${R} .of-log-voice { width: 34px; height: 34px; border: 0; background: transparent; color: var(--of-text-soft); }
${R} .of-log-voice[aria-pressed="true"] { color: var(--of-accent-text); background: var(--of-tint); }
/* The Story screen: a rupture's banner, and each love interest's route. */
${R} .of-rupture {
  border-color: color-mix(in srgb, var(--of-danger) 55%, transparent);
  background: linear-gradient(150deg, color-mix(in srgb, var(--of-li-accent, ${PALETTE.rose}) 22%, transparent), transparent 64%), var(--of-surface);
}
${R} .of-rupture > .of-button { align-self: flex-start; }
${R} .of-rupture-head { display: flex; align-items: center; gap: 12px; min-width: 0; }
${R} .of-rupture-mark { position: relative; flex: none; display: grid; }
${R} .of-rupture-mark .of-avatar { filter: saturate(0.7); }
${R} .of-rupture-crack {
  position: absolute; inset-inline-end: -4px; bottom: -4px; display: grid; place-items: center; width: 22px; height: 22px;
  border-radius: 50%; color: #fff; background: linear-gradient(135deg, #d0587d, #8f2f52); box-shadow: 0 0 0 2px var(--of-wish-ring);
}
${R} .of-routes { display: flex; flex-direction: column; gap: 10px; margin: 0; padding: 0; list-style: none; }
${R} .of-route {
  display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: 18px;
  border: 1px solid var(--of-border); border-inline-start: 3px solid var(--of-li-accent, ${PALETTE.rose});
  background: linear-gradient(120deg, color-mix(in srgb, var(--of-li-accent, ${PALETTE.rose}) 16%, transparent), transparent 60%), var(--of-surface-hover);
}
${R} .of-route[data-state="open"], ${R} .of-route[data-state="reading"] {
  border-color: rgb(230 201 138 / 0.55); box-shadow: inset 0 0 0 1px rgb(230 201 138 / 0.2), 0 8px 22px var(--of-glow-soft);
}
${R} .of-route[data-state="locked"] .of-avatar, ${R} .of-route[data-state="rupture"] .of-avatar { filter: saturate(0.55); }
${R} .of-route-line {
  display: inline-flex; align-items: center; gap: 6px; font-size: 0.84rem; font-weight: 700;
  color: color-mix(in srgb, var(--of-li-accent, ${PALETTE.rose}) 45%, var(--of-text));
}
${R}[data-look="pearl"] .of-route-line { color: color-mix(in srgb, var(--of-li-accent, ${PALETTE.rose}) 35%, ${PALETTE.ink}); }
${R} .of-route-lock {
  display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 0.8rem; color: var(--of-text-soft);
}
${R} .of-route-lock svg { flex: none; }
${R} .of-route[data-state="rupture"] .of-route-lock svg { color: var(--of-danger); }
/* Settings → Audio: volume sliders with a filled track. */
${R} .of-volume-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
${R} .of-volume-value { font-size: 0.8rem; font-weight: 800; font-variant-numeric: tabular-nums; color: var(--of-accent-text); }
${R} .of-range {
  --of-range-fill: 50%;
  -webkit-appearance: none; appearance: none; width: 100%; height: 24px; margin: 0; background: transparent; cursor: pointer;
}
${R} .of-range::-webkit-slider-runnable-track {
  height: 6px; border-radius: 999px; border: 1px solid var(--of-border-strong);
  background: linear-gradient(to right, ${PALETTE.champagne}, ${PALETTE.rose}) 0 / var(--of-range-fill) 100% no-repeat, var(--of-input-bg);
}
${R}[dir="rtl"] .of-range::-webkit-slider-runnable-track {
  background: linear-gradient(to left, ${PALETTE.champagne}, ${PALETTE.rose}) 100% 0 / var(--of-range-fill) 100% no-repeat, var(--of-input-bg);
}
${R} .of-range::-moz-range-track { height: 6px; border-radius: 999px; border: 1px solid var(--of-border-strong); background: var(--of-input-bg); }
${R} .of-range::-moz-range-progress { height: 6px; border-radius: 999px; background: linear-gradient(to right, ${PALETTE.champagne}, ${PALETTE.rose}); }
${R} .of-range::-webkit-slider-thumb {
  -webkit-appearance: none; width: 20px; height: 20px; margin-top: -8px; border-radius: 50%; border: 0;
  background: var(--of-pearl); box-shadow: 0 1px 6px rgb(0 0 0 / 0.35), 0 0 0 3px var(--of-glow-soft);
}
${R} .of-range::-moz-range-thumb {
  width: 20px; height: 20px; border-radius: 50%; border: 0; background: var(--of-pearl);
  box-shadow: 0 1px 6px rgb(0 0 0 / 0.35), 0 0 0 3px var(--of-glow-soft);
}
${R} .of-range:focus { outline: none; }
${R} .of-range:focus-visible::-webkit-slider-thumb { outline: 2px solid var(--of-focus); outline-offset: 2px; }
${R} .of-range:focus-visible::-moz-range-thumb { outline: 2px solid var(--of-focus); outline-offset: 2px; }
${R} .of-range:disabled { opacity: 0.5; cursor: default; }`;

// Remind Me (M6): the month and its hearts, the chosen day, what is coming up, the cycle and the player's birthday;
// the period tracker's settings; and the caring message on Home. A logged period day is a filled heart on a rose wash,
// a predicted one an outlined heart on a dashed cell, so neither depends on colour.
const REMIND_RULES = `
${R} .of-month { display: flex; flex-direction: column; gap: 10px; padding: 12px 10px 14px; border-radius: 22px; }
${R} .of-month-head { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 8px; }
${R} .of-month-title {
  font-family: var(--of-font-display); font-weight: 600; font-size: clamp(1.3rem, 6.2cqw, 1.62rem); line-height: 1.1;
  text-align: center; overflow-wrap: anywhere;
}
${R}[dir="rtl"] .of-month-step svg { transform: scaleX(-1); }
${R} .of-month-today { align-self: center; margin-top: -6px; }
${R} .of-month-grid { width: 100%; table-layout: fixed; border-collapse: separate; border-spacing: 3px; margin: -3px 0; }
${R} .of-month-grid th {
  padding: 2px 0 4px; font-size: 0.68rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;
  text-align: center; color: var(--of-champagne-text);
}
${R} .of-day {
  height: 50px; padding: 4px 1px 3px; border-radius: 14px; border: 1px solid transparent; text-align: center;
  vertical-align: top; cursor: pointer; background: var(--of-surface-hover);
  transition: border-color 360ms var(--of-ease), box-shadow 360ms var(--of-ease), background-color 360ms var(--of-ease);
}
${R} .of-day--blank { background: transparent; cursor: default; }
${R} .of-day:not(.of-day--blank):hover { border-color: var(--of-border-strong); }
${R} .of-day:focus { outline: none; }
${R} .of-day:focus-visible { outline: 2px solid var(--of-focus); outline-offset: 1px; }
${R} .of-day[data-cycle="logged"] { background: linear-gradient(180deg, var(--of-tint-strong), var(--of-tint)); }
${R} .of-day[data-cycle="predicted"] { border: 1px dashed var(--of-border-strong); }
${R} .of-day[aria-selected="true"] {
  border: 1px solid rgb(230 201 138 / 0.85);
  box-shadow: inset 0 0 0 1px rgb(230 201 138 / 0.45), 0 4px 14px var(--of-glow-soft);
}
/* Pale gold vanishes on Pearl's near-white cells: its deeper champagne (about 5:1) marks the selection there, 2 px
   wide, with the padding trimmed so the cell keeps its size. */
${R}[data-look="pearl"] .of-day[aria-selected="true"] { border: 2px solid var(--of-champagne-text); padding: 3px 0 2px; }
${R} .of-day-number {
  display: inline-grid; place-items: center; min-width: 24px; height: 24px; padding: 0 4px; border-radius: 999px;
  font-size: 0.86rem; font-weight: 700; font-variant-numeric: tabular-nums;
}
${R} .of-day[aria-current="date"] .of-day-number {
  color: ${PALETTE.ink}; background: linear-gradient(135deg, #f3dcaa, ${PALETTE.rose}); box-shadow: 0 0 10px var(--of-glow);
}
${R} .of-day-marks { display: flex; justify-content: center; align-items: center; gap: 2px; min-height: 13px; margin-top: 2px; }
${R} .of-cycle-heart { flex: none; color: var(--of-accent-text); }
${R} .of-event-icon { flex: none; color: var(--of-event); }
${R}[data-look="pearl"] .of-event-icon { filter: brightness(0.7) saturate(1.4); }
${R} .of-cycle-legend {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 6px 16px;
  font-size: 0.8rem; font-weight: 700; color: var(--of-text-soft);
}
${R} .of-cycle-key { display: inline-flex; align-items: center; gap: 6px; }
${R} .of-month > .of-notice { align-items: center; justify-content: space-between; flex-wrap: wrap; }
${R} .of-day-detail .of-section-title { font-size: 1.12rem; }
${R} .of-day-detail > .of-button { align-self: flex-start; }
${R} :is(.of-day-events, .of-upcoming) { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
${R} :is(.of-day-events, .of-upcoming) li {
  display: grid; grid-template-columns: 18px minmax(0, 1fr) auto; align-items: center; gap: 10px; font-size: 0.9rem;
}
${R} .of-day-events li > span, ${R} .of-upcoming-what { overflow-wrap: anywhere; font-weight: 600; }
${R} .of-upcoming-when { font-size: 0.78rem; font-weight: 800; white-space: nowrap; color: var(--of-champagne-text); }
${R} .of-cycle-card .of-section-title { display: flex; align-items: center; gap: 8px; }
${R} .of-cycle-card .of-section-title svg, ${R} .of-cycle-today svg { flex: none; color: var(--of-accent-text); }
${R} .of-cycle-card > .of-button { align-self: flex-start; }
${R} .of-cycle-today {
  display: flex; align-items: center; gap: 8px; font-family: var(--of-font-hand); font-weight: 500; font-size: 1.42rem;
  line-height: 1.15; color: var(--of-text);
}
${R} .of-birthday-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
${R} .of-birthday-form > .of-inline-actions { grid-column: 1 / -1; }
${R} .of-birthday-shown {
  display: inline-flex; align-items: center; gap: 7px; margin-inline-end: 4px;
  font-family: var(--of-font-display); font-weight: 600; font-size: 1.22rem;
}
${R} .of-birthday-shown svg { color: var(--of-accent-text); }
${R} .of-tracker .of-section > .of-button { align-self: flex-start; }
${R} .of-tracker-line { display: block; }
${R} .of-tracker-line + .of-tracker-line { margin-top: 4px; }
${R} .of-tracker-lengths { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
${R} .of-starts { display: flex; flex-direction: column; gap: 4px; margin: 0; padding: 0; list-style: none; }
${R} .of-starts li {
  display: grid; grid-template-columns: 14px minmax(0, 1fr) auto; align-items: center; gap: 10px;
  padding-block: 2px; padding-inline: 12px 2px; border-radius: 12px; background: var(--of-surface-hover);
  font-size: 0.88rem; font-weight: 600;
}
${R} .of-starts li > svg { color: var(--of-accent-text); }
${R} .of-starts-remove { width: 34px; height: 34px; border: 0; background: transparent; color: var(--of-text-soft); }
${R} .of-file-button { position: relative; }
${R} .of-file-button:has(input:focus-visible) { outline: 2px solid var(--of-focus); outline-offset: 3px; }
${R} .of-delete-cycle { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
/* Caring message: a rose rim, a light rose wash and a slow glow over the strong glass, its icon in the text colour,
   so it reads over his look in both moods (at least 3:1, as an icon needs). */
${R} .of-home-care {
  border-color: rgb(231 166 184 / 0.7);
  background: linear-gradient(135deg, rgb(231 166 184 / 0.2), rgb(230 201 138 / 0.12)), var(--of-surface-strong);
  animation: of-care-glow 3.2s ease-in-out infinite alternate;
}
${R} .of-care-seal { position: relative; display: inline-grid; }
${R} .of-care-heart {
  position: absolute; bottom: -3px; inset-inline-end: -5px; color: ${PALETTE.rose};
  filter: drop-shadow(0 0 6px var(--of-glow));
}
${R} .of-care-body { display: flex; align-items: center; justify-content: center; min-height: 3.4em; }
${R} .of-care-body > .of-notice { text-align: start; }
${R} .of-care-writing {
  display: flex; align-items: center; gap: 8px; font-family: var(--of-font-hand); font-size: 1.36rem; line-height: 1.15;
  color: var(--of-text-soft);
}
${R} .of-care-source { text-align: center; }
@keyframes of-care-glow {
  from { box-shadow: inset 0 1px 0 var(--of-highlight), 0 0 0 0 var(--of-glow-soft); }
  to { box-shadow: inset 0 1px 0 var(--of-highlight), 0 0 18px 2px var(--of-glow-soft); }
}`;

// Dialogs render into the stage's own layer (Stage.tsx), over the top bar and the dock.
const DIALOG_RULES = `
${R} .of-stage-layer { position: absolute; inset: 0; z-index: 6; pointer-events: none; }
${R} .of-stage-layer:empty { display: none; }
/* Above a takeover (z-index 1) in the same layer, so a dialog opened from a wish's results is the one on top. */
${R} .of-dialog-backdrop {
  position: absolute; inset: 0; z-index: 2; display: grid; place-items: center; padding: 16px; pointer-events: auto;
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

// Dates (M5): pick who to spend time with, the activities, today's capped rewards, and the plush shelf.
const DATES_RULES = `
${R} .of-partners { margin: 0; min-width: 0; }
${R} .of-partners > legend { float: inline-start; width: 100%; padding: 0; margin-bottom: 10px; }
${R} .of-partner-list { clear: both; display: flex; gap: 8px; overflow-x: auto; padding: 2px 2px 6px; scrollbar-width: thin; }
${R} .of-partner {
  flex: 0 0 auto; min-width: 86px; display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 10px 8px 8px; border-radius: 18px; cursor: pointer; border: 1.5px solid transparent;
  background: var(--of-surface-hover);
  transition: border-color 360ms var(--of-ease), background-color 360ms var(--of-ease), box-shadow 360ms var(--of-ease);
}
${R} .of-partner:hover { border-color: var(--of-border-strong); }
${R} .of-partner[data-checked="true"] {
  border-color: var(--of-li-accent);
  background: linear-gradient(180deg, color-mix(in srgb, var(--of-li-accent) 30%, transparent), transparent 82%), var(--of-surface);
  box-shadow: 0 6px 18px var(--of-glow-soft);
}
${R} .of-partner:has(input:focus-visible) { outline: 2px solid var(--of-focus); outline-offset: 2px; }
${R} .of-partner-name {
  max-width: 9ch; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
  font-family: var(--of-font-display); font-weight: 600; font-size: 1.06rem; line-height: 1.1;
}
${R} .of-partner-level {
  display: inline-flex; align-items: center; gap: 3px; font-size: 0.68rem; font-weight: 800; color: var(--of-accent-text);
}
${R} .of-meter { display: flex; flex-direction: column; gap: 5px; }
${R} .of-meter-head { display: flex; justify-content: space-between; gap: 8px; font-size: 0.84rem; font-weight: 700; }
${R} .of-meter-value { flex: none; font-variant-numeric: tabular-nums; color: var(--of-champagne-text); }
${R} .of-meter-bar {
  height: 8px; overflow: hidden; border-radius: 999px; background: var(--of-surface-hover); border: 1px solid var(--of-border);
}
${R} .of-meter-bar > span {
  display: block; height: 100%; border-radius: inherit;
  background: linear-gradient(90deg, ${PALETTE.champagne}, ${PALETTE.rose});
  transition: inline-size 700ms var(--of-ease);
}
${R} .of-activities { display: flex; flex-direction: column; gap: 10px; margin: 0; padding: 0; list-style: none; }
${R} .of-activity {
  display: grid; grid-template-columns: auto minmax(0, 1fr); grid-template-areas: "icon body" "icon play";
  column-gap: 12px; row-gap: 10px; padding: 14px; border-radius: 20px;
  border-inline-start: 3px solid var(--of-li-accent, var(--of-rose));
}
${R} .of-activity[data-repair] { border-inline-start-color: var(--of-danger); }
${R} .of-activity-icon {
  grid-area: icon; display: grid; place-items: center; width: 46px; height: 46px; border-radius: 15px; color: ${PALETTE.ink};
  background: linear-gradient(135deg, color-mix(in srgb, var(--of-li-accent) 40%, #fff), var(--of-li-accent));
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.6), 0 6px 14px var(--of-glow-soft);
}
${R} .of-activity-body { grid-area: body; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
${R} .of-activity-title {
  font-family: var(--of-font-display); font-weight: 600; font-size: 1.3rem; line-height: 1.08; overflow-wrap: anywhere;
}
${R} .of-activity-text { font-size: 0.88rem; color: var(--of-text-soft); }
${R} .of-activity-reward {
  display: flex; align-items: flex-start; gap: 6px; font-size: 0.8rem; font-weight: 700; color: var(--of-champagne-text);
}
${R} .of-activity-reward svg { flex: none; margin-top: 2px; }
${R} .of-activity-play { grid-area: play; justify-self: start; }
${R} .of-shelf-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
${R} .of-shelf-head .of-badge { margin: 0; }
/* The shelf: plushies stand on planks, one plank per row. */
${R} .of-shelf {
  --of-row: 90px; --of-plank: color-mix(in srgb, ${PALETTE.champagne} 62%, #8a5a3c);
  display: grid; grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)); grid-auto-rows: var(--of-row);
  gap: 0 6px; margin: 0; padding: 0 4px; list-style: none; border-radius: 12px;
  /* One plank per row, tiled (a repeating gradient would draw a seam at the top edge). */
  background: linear-gradient(to bottom, transparent calc(100% - 10px), var(--of-plank) calc(100% - 10px) calc(100% - 4px),
    color-mix(in srgb, var(--of-plank) 70%, #2b2236) calc(100% - 4px)) 0 0 / 100% var(--of-row) repeat-y;
}
${R} .of-shelf-slot { position: relative; display: grid; place-items: end center; padding-bottom: 10px; min-width: 0; }
${R} .of-plush { display: block; overflow: visible; }
${R} .of-shelf-plush { width: 62px; height: 62px; filter: drop-shadow(0 4px 3px rgb(43 34 54 / 0.25)); }
${R} .of-shelf-slot[data-owned="false"] .of-shelf-plush { filter: grayscale(1) brightness(0.4) opacity(0.3); }
${R} .of-shelf-slot[data-owned="false"]::after {
  content: "?"; position: absolute; left: 50%; bottom: 28px; translate: -50% 0;
  font-family: var(--of-font-display); font-weight: 700; font-size: 1.3rem; color: var(--of-text-faint);
}
${R} .of-shelf-count {
  position: absolute; top: 6px; inset-inline-end: 4px; padding: 1px 6px; border-radius: 999px;
  font-size: 0.68rem; font-weight: 800; font-variant-numeric: tabular-nums;
  background: var(--of-surface-strong); border: 1px solid var(--of-border);
}
${R} .of-shelf-new {
  position: absolute; bottom: 58px; inset-inline-start: 50%; translate: -50% 0; rotate: -6deg; z-index: 1; padding: 1px 6px; border-radius: 999px;
  font-size: 0.6rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: ${PALETTE.ink};
  background: linear-gradient(135deg, #f3dcaa, ${PALETTE.champagne}); box-shadow: 0 0 10px var(--of-wish-glow);
}
${R} .of-shelf-slot[data-new] .of-shelf-plush { animation: of-claw-land 760ms var(--of-ease) both; }`;

// The Claw Machine (M5): the cabinet, the claw on its cable (driven by custom properties the game writes each frame:
// --cx claw x, --cc cable 0–1, --co open 0–1, --ca swing angle, --gx landing guide; --px/--py a prize's place, and
// --ax/--ay/--ar/--ao while it is carried), the turn pips, the cheer meter and the big buttons.
const CLAW_RULES = `
${R} .of-claw { gap: 10px; padding-top: 0; }
${R} .of-claw-title { flex-direction: row; flex-wrap: wrap; justify-content: center; align-items: baseline; gap: 4px 10px; padding-top: 0; }
${R} .of-claw-title .of-subtitle { font-size: 1.06rem; max-width: none; }
${R} .of-claw-game { display: flex; flex-direction: column; align-items: center; gap: 9px; }
${R} :is(.of-claw-hud, .of-claw-partner, .of-claw-meter, .of-claw-controls) { width: min(100%, 360px); }
${R} .of-claw-hud { display: flex; align-items: center; gap: 8px; }
${R} .of-claw-pips { flex: 1; display: flex; flex-wrap: wrap; gap: 5px; margin: 0; padding: 0; list-style: none; }
${R} .of-claw-pip {
  display: grid; place-items: center; width: 26px; height: 26px; border-radius: 50%;
  font-size: 0.68rem; font-weight: 800; color: var(--of-text-soft); background: var(--of-surface);
  border: 1.5px solid var(--of-border-strong);
}
${R} .of-claw-pip[data-who="partner"] { border-color: color-mix(in srgb, var(--of-li-accent) 75%, transparent); }
${R} .of-claw-pip[data-bonus] { border-style: dashed; }
${R} .of-claw-pip[data-state="current"] {
  color: var(--of-text); border-color: ${PALETTE.champagne}; box-shadow: 0 0 0 3px var(--of-glow-soft);
  animation: of-breathe 1.8s ease-in-out infinite;
}
${R} .of-claw-pip[data-state="caught"] {
  color: ${PALETTE.ink}; border-color: transparent; background: linear-gradient(135deg, #f6e2b0, ${PALETTE.champagne});
}
${R} .of-claw-pip[data-state="missed"] { opacity: 0.45; }
${R} .of-claw-toggles { display: flex; gap: 6px; }
${R} .of-claw-toggles .of-icon-button { width: 34px; height: 34px; }
${R} .of-claw-toggles .of-icon-button[aria-pressed="false"] { color: var(--of-text-faint); }
${R} .of-claw-partner { display: flex; align-items: center; gap: 10px; min-height: 54px; }
${R} .of-claw-bubble {
  flex: 1; min-width: 0; padding: 8px 13px; border-radius: 16px 16px 16px 4px;
  border-color: color-mix(in srgb, var(--of-li-accent) 55%, transparent);
  font-family: var(--of-font-display); font-style: italic; font-weight: 600; font-size: 1.04rem; line-height: 1.22;
}
${R}[dir="rtl"] .of-claw-bubble { border-radius: 16px 16px 4px 16px; }
${R} .of-claw-status {
  flex: 1; font-size: 0.76rem; font-weight: 800; letter-spacing: 0.13em; text-transform: uppercase;
  color: var(--of-champagne-text);
}
/* The cabinet, in his colour, with a marquee of bulbs. */
${R} .of-claw-cabinet {
  position: relative; width: min(100%, 360px, 50svh); padding: 10px 10px 14px; border-radius: 30px 30px 22px 22px;
  background: linear-gradient(165deg, color-mix(in srgb, var(--of-li-accent) 52%, #fff6f8) 0%, var(--of-li-accent) 44%,
    color-mix(in srgb, var(--of-li-accent) 55%, #2b2236) 100%);
  box-shadow: inset 0 2px 0 rgb(255 255 255 / 0.55), inset 0 -6px 14px rgb(43 34 54 / 0.25), 0 18px 40px rgb(10 6 28 / 0.32),
    0 0 34px var(--of-glow-soft);
}
${R} .of-claw-cabinet--preview { align-self: center; width: min(100%, 300px, 38svh); }
${R} .of-claw-cabinet[data-shake] { animation: of-claw-shake 520ms ease-in-out; }
${R} .of-claw-marquee {
  display: flex; align-items: center; justify-content: center; gap: 8px; margin: 0 6px 8px; padding: 5px 12px;
  border-radius: 999px; background: rgb(43 34 54 / 0.55); box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.2);
}
${R} .of-claw-marquee-title {
  min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
  font-family: var(--of-font-display); font-weight: 700; font-size: 1.06rem; letter-spacing: 0.08em; color: #fff4e6;
  text-shadow: 0 0 10px rgb(255 214 170 / 0.85);
}
${R} .of-claw-bulbs {
  flex: 1; max-width: 72px; height: 8px;
  background: radial-gradient(circle, #ffe9b8 0 2.4px, transparent 3px) 0 50% / 12px 8px repeat-x;
  filter: drop-shadow(0 0 4px #ffd48a); animation: of-claw-bulbs 1.1s steps(2, jump-none) infinite;
}
${R} .of-claw-bulbs + .of-claw-marquee-title + .of-claw-bulbs { animation-delay: -0.55s; }
/* The glass: back wall, floor, chute, rail, claw and prizes. Everything inside sizes from the glass (cqw, cqh). */
${R} .of-claw-glass {
  position: relative; aspect-ratio: 0.95; container-type: size; overflow: clip; border-radius: 20px;
  touch-action: none; user-select: none; -webkit-user-select: none;
  background:
    radial-gradient(70% 45% at 50% 0%, rgb(255 255 255 / 0.7), transparent 70%),
    radial-gradient(2px 2px at 22% 30%, #fff 50%, transparent 52%), radial-gradient(1.5px 1.5px at 72% 22%, #fff 50%, transparent 52%),
    radial-gradient(2px 2px at 84% 48%, #fff 50%, transparent 52%), radial-gradient(1.5px 1.5px at 40% 44%, #fff 50%, transparent 52%),
    linear-gradient(180deg, #fdf1f6 0%, #f3e2f1 58%, #e8d6ef 100%);
  box-shadow: inset 0 0 0 3px rgb(255 255 255 / 0.55), inset 0 10px 30px rgb(80 40 90 / 0.18);
}
${R}[data-look="midnight"] .of-claw-glass {
  --of-claw-dot: rgb(255 255 255 / 0.13);
  background:
    radial-gradient(70% 45% at 50% 0%, rgb(255 210 230 / 0.32), transparent 70%),
    radial-gradient(2px 2px at 22% 30%, #fff 50%, transparent 52%), radial-gradient(1.5px 1.5px at 72% 22%, #fff 50%, transparent 52%),
    radial-gradient(2px 2px at 84% 48%, #fff 50%, transparent 52%), radial-gradient(1.5px 1.5px at 40% 44%, #fff 50%, transparent 52%),
    linear-gradient(180deg, #3b2d5e 0%, #2c2249 60%, #231b3c 100%);
  box-shadow: inset 0 0 0 3px rgb(255 255 255 / 0.18), inset 0 10px 30px rgb(0 0 0 / 0.3);
}
/* The back wall's soft polka dots, and the floor the pile lies on. */
${R} .of-claw-wall {
  position: absolute; inset: 0;
  background: radial-gradient(circle, var(--of-claw-dot, rgb(255 255 255 / 0.42)) 0 1.6px, transparent 2.2px) 0 0 / 7cqw 7cqw;
  -webkit-mask: linear-gradient(to bottom, #000 10%, transparent 80%); mask: linear-gradient(to bottom, #000 10%, transparent 80%);
}
${R} .of-claw-glass::before {
  content: ""; position: absolute; inset: auto 0 0; height: 15cqh; border-top: 1px solid rgb(255 255 255 / 0.35);
  background: linear-gradient(to top, rgb(120 70 120 / 0.28), rgb(255 255 255 / 0.06));
}
${R} .of-claw-chute {
  position: absolute; left: 2%; bottom: 0; z-index: 6; width: 18%; height: 27cqh; display: grid; place-items: end center;
  padding-bottom: 7cqh; border: 2px solid rgb(255 255 255 / 0.75); border-bottom: 0; border-radius: 10px 10px 0 0;
  color: var(--of-li-accent);
  background: linear-gradient(180deg, rgb(255 255 255 / 0.62), rgb(255 255 255 / 0.28));
  box-shadow: inset 0 -10px 16px rgb(43 34 54 / 0.12);
}
${R} .of-claw-chute::before {
  content: ""; position: absolute; top: -5px; left: 8%; right: 8%; height: 10px; border-radius: 50%;
  background: rgb(43 34 54 / 0.45);
}
${R} .of-claw-chute svg { filter: drop-shadow(0 0 4px var(--of-li-accent)); }
${R} .of-claw-rail {
  position: absolute; top: 4cqh; left: 3%; right: 3%; z-index: 7; height: 2.2cqh; border-radius: 999px;
  background: linear-gradient(180deg, #fff, #d9c6d8); box-shadow: 0 2px 4px rgb(43 34 54 / 0.25);
}
${R} .of-claw-rig { position: absolute; top: 5cqh; left: calc(var(--cx) * 100%); z-index: 8; width: 0; height: 0; }
${R} .of-claw-carriage {
  position: absolute; left: -7cqw; top: -3cqh; width: 14cqw; height: 5cqh; border-radius: 8px;
  background: linear-gradient(180deg, #fff6fa, #e2cde0);
  box-shadow: 0 3px 6px rgb(43 34 54 / 0.25), inset 0 -2px 0 rgb(43 34 54 / 0.12);
}
${R} .of-claw-arm { position: absolute; left: 0; top: 0; transform-origin: 0 0; rotate: var(--ca); }
${R} .of-claw-cable {
  position: absolute; left: -1.5px; top: 0; width: 3px; height: calc((0.1 + var(--cc) * 0.6) * 100cqh);
  background: linear-gradient(90deg, #b9a5bd, #fff, #b9a5bd);
}
${R} .of-claw-head {
  position: absolute; left: -12cqw; top: calc((0.1 + var(--cc) * 0.6) * 100cqh); width: 24cqw; height: 13cqh;
  filter: drop-shadow(0 3px 2px rgb(43 34 54 / 0.3));
}
${R} .of-claw-svg { display: block; width: 100%; height: 100%; overflow: visible; }
${R} .of-claw-prong path { fill: none; stroke-linecap: round; stroke-linejoin: round; }
${R} .of-claw-prong-edge { stroke: #8d7896; stroke-width: 6.4; }
${R} .of-claw-prong-face { stroke: #f7eef5; stroke-width: 3.4; }
${R} .of-claw-collar { fill: #d6c2d8; stroke: #8d7896; stroke-width: 1.2; }
${R} .of-claw-prong { transform-box: view-box; }
${R} .of-claw-prong--left { transform-origin: 20px 12px; transform: rotate(calc((var(--co) - 0.35) * 30deg)); }
${R} .of-claw-prong--right { transform-origin: 28px 12px; transform: rotate(calc((var(--co) - 0.35) * -30deg)); }
${R} .of-claw-hub { fill: #fff3f8; stroke: #8d7896; stroke-width: 1.4; }
${R} .of-claw-light { fill: var(--of-li-accent); filter: drop-shadow(0 0 3px var(--of-li-accent)); }
${R} .of-claw-glass[data-steady] .of-claw-head { filter: drop-shadow(0 0 7px #ffe29a) drop-shadow(0 0 14px var(--of-li-accent)); }
${R} .of-claw-prize {
  position: absolute; left: calc(var(--px) * 100%); bottom: calc(var(--py) * 100cqh); width: 18cqw; aspect-ratio: 1;
  translate: -50% 0; rotate: var(--tilt); filter: drop-shadow(0 4px 3px rgb(43 34 54 / 0.22));
  transition: left 420ms var(--of-ease);
}
${R} .of-claw-prize .of-plush { width: 100%; height: 100%; }
${R} .of-claw-prize[data-anim] {
  z-index: 5 !important; left: calc(var(--ax) * 100%); bottom: calc(var(--ay) * 100cqh); rotate: var(--ar);
  opacity: var(--ao); transition: none;
}
${R} .of-claw-prize[data-leaving] { z-index: 5 !important; animation: of-claw-tumble 860ms cubic-bezier(0.5, 0, 0.7, 0.4) forwards; }
${R} .of-claw-guide {
  position: absolute; top: 20cqh; bottom: 3cqh; left: calc(var(--gx) * 100%); z-index: 4; width: 0;
  border-left: 2px dashed var(--of-li-accent); filter: drop-shadow(0 0 4px var(--of-li-accent));
}
${R} .of-claw-guide::after {
  content: ""; position: absolute; left: -9cqw; bottom: 0; width: 18cqw; height: 4cqh; border-radius: 50%;
  border: 2px solid var(--of-li-accent); background: color-mix(in srgb, var(--of-li-accent) 25%, transparent);
}
${R} .of-claw-glass[data-frost]::after {
  content: ""; position: absolute; inset: 0; z-index: 9; pointer-events: none;
  background: radial-gradient(circle at 50% 35%, transparent 40%, rgb(200 228 255 / 0.4));
  box-shadow: inset 0 0 26px rgb(205 232 255 / 0.9);
}
${R} .of-claw-shine {
  position: absolute; inset: 0; z-index: 10; pointer-events: none;
  background: linear-gradient(115deg, transparent 30%, rgb(255 255 255 / 0.22) 36%, transparent 42%),
    linear-gradient(115deg, transparent 52%, rgb(255 255 255 / 0.12) 55%, transparent 58%);
}
${R} :is(.of-claw-banner, .of-claw-pop, .of-claw-countdown) {
  position: absolute; left: 50%; translate: -50% -50%; z-index: 11; white-space: nowrap; pointer-events: none;
}
${R} .of-claw-banner {
  top: 40%; padding: 8px 20px; border-radius: 16px; color: ${PALETTE.ink};
  font-family: var(--of-font-display); font-weight: 700; font-size: 1.55rem; line-height: 1.1;
  background: linear-gradient(135deg, #f3dcaa 0%, ${PALETTE.champagne} 30%, ${PALETTE.rose} 100%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.65), 0 10px 26px rgb(43 34 54 / 0.3);
}
${R} .of-claw-banner[data-who="partner"] {
  background: linear-gradient(135deg, color-mix(in srgb, var(--of-li-accent) 45%, #fff), var(--of-li-accent));
}
${R} .of-claw-cheat {
  position: absolute; left: 6%; right: 6%; top: 22cqh; z-index: 11; display: flex; align-items: center; gap: 10px;
  padding: 10px 13px; border-radius: 16px; color: ${PALETTE.ink}; background: rgb(255 250 245 / 0.95);
  box-shadow: 0 10px 26px rgb(43 34 54 / 0.3), 0 0 0 2px var(--of-li-accent); pointer-events: none;
}
${R} .of-claw-cheat svg { flex: none; color: color-mix(in srgb, var(--of-li-accent) 70%, #2b2236); }
${R} .of-claw-cheat strong { display: block; font-family: var(--of-font-display); font-size: 1.12rem; line-height: 1.1; }
${R} .of-claw-cheat small { display: block; font-size: 0.78rem; color: rgb(43 34 54 / 0.78); }
${R} .of-claw-pop {
  top: 50%; display: inline-flex; align-items: center; gap: 6px; padding: 6px 15px; border-radius: 999px;
  font-weight: 800; font-size: 0.95rem; color: ${PALETTE.ink}; background: rgb(255 255 255 / 0.92);
  box-shadow: 0 8px 20px rgb(43 34 54 / 0.25);
}
${R} .of-claw-pop[data-caught="true"] { background: linear-gradient(135deg, #f6e2b0, ${PALETTE.champagne}); }
${R} .of-claw-countdown {
  top: 64%; padding: 4px 12px; border-radius: 999px; font-weight: 700; font-size: 0.85rem; color: #fff;
  background: rgb(43 34 54 / 0.72);
}
/* The cheer meter: eight hearts in his colour. */
${R} .of-claw-meter {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  font-size: 0.8rem; font-weight: 700; color: var(--of-text-soft);
}
${R} .of-claw-meter-label { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
${R} .of-claw-hearts { flex: none; display: flex; gap: 3px; color: var(--of-li-accent); }
${R}[data-look="pearl"] .of-claw-hearts { filter: brightness(0.8) saturate(1.35); }
${R} .of-claw-hearts svg[data-on="false"] { color: var(--of-border-strong); }
${R} .of-claw-meter[data-live] .of-claw-hearts { animation: of-claw-throb 0.9s ease-in-out infinite; }
${R} .of-claw-meter[data-full] .of-claw-hearts { filter: drop-shadow(0 0 6px var(--of-li-accent)); }
/* Big, pressable controls: hold the arrows, tap the middle. */
${R} .of-claw-controls { display: grid; grid-template-columns: 64px minmax(0, 1fr) 64px; gap: 10px; }
${R} :is(.of-claw-move, .of-claw-action) {
  min-height: 64px; border-radius: 22px; cursor: pointer; touch-action: none; user-select: none; -webkit-user-select: none;
  transition: transform 110ms ease-out, box-shadow 110ms ease-out, background-color 300ms var(--of-ease), opacity 300ms;
}
${R} .of-claw-move { display: grid; place-items: center; padding: 0; color: var(--of-text); }
${R} .of-claw-move:active:not([aria-disabled="true"]) { transform: translateY(2px) scale(0.95); background: var(--of-surface-strong); }
${R} :is(.of-claw-move, .of-claw-action)[aria-disabled="true"] { cursor: default; opacity: 0.5; }
${R} .of-claw-action {
  position: relative; display: flex; align-items: center; justify-content: center; gap: 8px; min-width: 0;
  padding: 0 46px 0 16px; border: 0; color: ${PALETTE.ink}; font-weight: 800; font-size: 1rem; letter-spacing: 0.02em;
  background: linear-gradient(135deg, #f3dcaa 0%, ${PALETTE.champagne} 28%, ${PALETTE.rose} 100%);
  box-shadow: inset 0 2px 0 rgb(255 255 255 / 0.6), 0 6px 0 #b9748c, 0 12px 24px var(--of-glow-soft);
}
${R} .of-claw-action:not([data-mode="drop"]) { padding-inline-end: 16px; }
${R} .of-claw-action:active:not([aria-disabled="true"]) {
  transform: translateY(4px); box-shadow: inset 0 2px 0 rgb(255 255 255 / 0.6), 0 2px 0 #b9748c, 0 6px 14px var(--of-glow-soft);
}
${R} .of-claw-action[data-mode="cheer"] {
  background: linear-gradient(135deg, color-mix(in srgb, var(--of-li-accent) 42%, #fff), var(--of-li-accent));
  box-shadow: inset 0 2px 0 rgb(255 255 255 / 0.6), 0 6px 0 color-mix(in srgb, var(--of-li-accent) 55%, #2b2236),
    0 12px 24px var(--of-glow-soft);
}
${R} .of-claw-action[data-mode="cheer"]:active { transform: translateY(4px) scale(0.98); }
${R} .of-claw-action-text { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
${R} .of-claw-timer {
  position: absolute; inset-inline-end: 9px; top: 50%; translate: 0 -50%; display: grid; place-items: center;
  width: 34px; height: 34px; border-radius: 50%; font-size: 0.84rem; font-weight: 800; font-variant-numeric: tabular-nums;
  background: conic-gradient(rgb(43 34 54 / 0.78) calc(var(--tl, 1) * 1turn), rgb(43 34 54 / 0.14) 0);
}
${R} .of-claw-timer::before { content: ""; position: absolute; inset: 3px; border-radius: 50%; background: #f7e4c6; }
${R} .of-claw-timer { isolation: isolate; }
${R} .of-claw-timer::before { z-index: -1; }
${R} .of-claw-keys { max-width: 36ch; text-align: center; font-size: 0.76rem; }
/* Touch screens have no keys: the intro's rules say how to play there (the hint still describes the buttons). */
@media (pointer: coarse) { ${R} .of-claw-keys { display: none; } }
/* Before and after a round. */
${R} .of-claw-intro, ${R} .of-claw-result { align-items: stretch; }
${R} .of-claw-result .of-section-title:focus-visible { outline-offset: 4px; border-radius: 6px; }
${R} .of-claw-style { display: flex; flex-direction: column; gap: 3px; }
${R} .of-claw-style-text { font-family: var(--of-font-display); font-style: italic; font-weight: 600; font-size: 1.12rem; line-height: 1.25; }
${R} .of-claw-first { display: flex; flex-wrap: wrap; gap: 8px; }
${R} .of-claw-first .of-button { flex: 1 1 140px; }
${R} .of-claw-rules { display: flex; flex-direction: column; gap: 4px; margin: 0; padding-inline-start: 18px; font-size: 0.86rem; color: var(--of-text-soft); }
${R} .of-claw-haul {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(86px, 1fr)); gap: 8px; margin: 0; padding: 0; list-style: none;
}
${R} .of-claw-haul-item {
  display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px 4px; border-radius: 16px;
  text-align: center; background: var(--of-surface-hover);
}
${R} .of-claw-haul-item .of-plush { width: 56px; height: 56px; filter: drop-shadow(0 4px 3px rgb(43 34 54 / 0.25)); }
${R} .of-claw-haul-name { font-size: 0.8rem; font-weight: 700; line-height: 1.2; }
${R} .of-claw-haul-by { font-size: 0.72rem; color: var(--of-text-soft); }
${R} .of-claw-quote {
  display: flex; align-items: flex-start; gap: 10px; margin: 0; padding: 10px 12px; border-radius: 16px;
  background: var(--of-tint); border-inline-start: 3px solid var(--of-li-accent);
}
${R} .of-claw-quote p { font-family: var(--of-font-display); font-style: italic; font-weight: 600; font-size: 1.1rem; line-height: 1.25; }
${R} .of-claw-pay { display: flex; flex-direction: column; gap: 4px; }
${R} .of-claw-pay-line { display: flex; align-items: center; gap: 6px; font-weight: 800; color: var(--of-champagne-text); }
${R} .of-claw-result .of-actions { justify-content: flex-start; }`;

const MOTION_RULES = `
@keyframes of-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes of-rise { from { opacity: 0; transform: translateY(12px) scale(0.98); } to { opacity: 1; transform: none; } }
@keyframes of-twinkle { from { opacity: calc(var(--of-star-opacity) * 0.55); } to { opacity: var(--of-star-opacity); } }
/* Home's stars twinkle within the sky's own opacity (none at dawn or by day). */
@keyframes of-home-twinkle { from { opacity: calc(var(--of-home-stars, 0) * 0.55); } to { opacity: var(--of-home-stars, 0); } }
@keyframes of-drift { from { transform: translate3d(0, 0, 0) scale(1); } to { transform: translate3d(14%, 8%, 0) scale(1.12); } }
@keyframes of-spin { to { transform: rotate(360deg); } }
@keyframes of-sheen { 0%, 62% { transform: translateX(-70%); } 100% { transform: translateX(70%); } }
@keyframes of-breathe { 0%, 100% { transform: scale(1); opacity: 0.75; } 50% { transform: scale(1.1); opacity: 1; } }
@keyframes of-motes { from { transform: translate3d(0, 3%, 0); } to { transform: translate3d(-3%, -5%, 0); } }
@keyframes of-place-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
@keyframes of-nudge { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(3px); } }
@keyframes of-write { 0%, 100% { transform: rotate(-8deg) translateX(-3px); } 50% { transform: rotate(6deg) translateX(3px); } }
@keyframes of-cg-pan {
  from { transform: scale(1.16) translate3d(0, 4%, 0); } to { transform: scale(1.04) translate3d(0, -2%, 0); }
}
@keyframes of-claw-shake {
  0%, 100% { transform: none; } 20% { transform: translateX(-6px) rotate(-1.2deg); }
  40% { transform: translateX(5px) rotate(1deg); } 60% { transform: translateX(-4px) rotate(-0.6deg); } 80% { transform: translateX(2px); }
}
@keyframes of-claw-bulbs { 50% { opacity: 0.4; } }
@keyframes of-claw-throb { 50% { transform: scale(1.07); } }
@keyframes of-claw-land { 0% { transform: translateY(-36px) scale(0.9); } 60% { transform: translateY(0) scale(1.1, 0.88); } 100% { transform: none; } }
@keyframes of-claw-tumble {
  30% { translate: -50% -14cqh; rotate: -30deg; } 100% { left: 11%; bottom: -30cqh; translate: -50% 0; rotate: 260deg; opacity: 0.4; }
}
@keyframes of-toast {
  0% { opacity: 0; transform: translateY(8px) scale(0.97); } 12% { opacity: 1; transform: none; }
  82% { opacity: 1; transform: none; } 100% { opacity: 0; transform: translateY(-6px); }
}
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
    COLLECTION_RULES,
    STORY_RULES,
    READER_RULES,
    PRESENTATION_RULES,
    HOME_RULES,
    PHONE_RULES,
    REMIND_RULES,
    DATES_RULES,
    DATE_NIGHT_RULES,
    READ_HIM_RULES,
    CLAW_RULES,
    DIALOG_RULES,
    MOTION_RULES,
  ].join("\n");
}
