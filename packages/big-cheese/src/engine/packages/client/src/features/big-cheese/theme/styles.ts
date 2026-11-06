// ──────────────────────────────────────────────
// Big Cheese: the one stylesheet, scoped under `.bc-root`
// ──────────────────────────────────────────────
// Every colour comes from the Engine's theme tokens (`--background`, `--card`, ...), mixed toward walnut and cheese
// gold. The root is a size container, so layout follows the panel the Engine gives it, not the window.
const R = ".bc-root";
const REDUCED = 'html[data-marinara-reduced-effects="true"]';

export function bigCheeseStyles(): string {
  return `
${R} {
  --bc-bg: color-mix(in oklch, var(--background, #1b1511) 82%, #2b1d12);
  --bc-fg: var(--foreground, #f3e9d6);
  --bc-card: color-mix(in oklch, var(--card, #26201b) 85%, #3a2a1c);
  --bc-border: var(--border, #4a3d33);
  --bc-gold: color-mix(in oklch, var(--primary, #f2b53f) 25%, #f2b53f);
  --bc-on-gold: #1f1409;
  --bc-danger: var(--destructive, #e5675d);
  --bc-display: "Young Serif", Georgia, serif;
  /* system-ui sits late: on a Linux host without a UI font, Chromium resolves it to fontconfig's
     default, which can be a monospace font. Arial maps to Liberation Sans there. */
  --bc-body: "Schibsted Grotesk", -apple-system, "Segoe UI", Roboto, Arial, system-ui, sans-serif;
  container: bc-frame / size;
  display: flex; flex-direction: column; width: 100%; height: 100%; min-height: 0; overflow: hidden;
  background: var(--bc-bg); color: var(--bc-fg);
  font-family: var(--bc-body); font-size: 1rem; line-height: 1.45;
  padding-inline: max(1rem, env(safe-area-inset-left)) max(1rem, env(safe-area-inset-right));
}
${R} *:focus-visible { outline: 3px solid var(--bc-gold); outline-offset: 2px; }
${R} .bc-top { display: flex; min-height: calc(44px + env(safe-area-inset-top)); padding-top: env(safe-area-inset-top); align-items: center; }
${R} .bc-main {
  flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 1rem;
  width: 100%; max-width: 40rem; margin-inline: auto; padding-bottom: max(1rem, env(safe-area-inset-bottom));
}
${R} .bc-heading { font-family: var(--bc-display); font-weight: 400; font-size: 2rem; line-height: 1.2; margin: 0; }
${R} .bc-heading:focus { outline: none; }
${R} p { margin: 0; }
${R} .bc-cards { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: .75rem; }
${R} .bc-card {
  display: flex; align-items: center; gap: .5rem; padding: .5rem .5rem .5rem 1rem;
  background: var(--bc-card); border: 1px solid var(--bc-border); border-radius: .75rem;
}
${R} .bc-card-main {
  flex: 1; min-height: 56px; display: flex; flex-direction: column; justify-content: center; text-align: start;
  background: none; border: 0; color: inherit; font: inherit; cursor: pointer; padding: 0;
}
${R} .bc-card-name { font-family: var(--bc-display); font-size: 1.25rem; }
${R} .bc-btn {
  min-height: 44px; min-width: 44px; padding: .5rem 1rem; border-radius: .625rem; cursor: pointer;
  background: transparent; color: var(--bc-fg); border: 1px solid var(--bc-border); font: inherit;
}
${R} .bc-btn:disabled { opacity: .6; cursor: default; }
${R} .bc-btn-primary { background: var(--bc-gold); color: var(--bc-on-gold); border-color: var(--bc-gold); font-weight: 600; min-height: 56px; }
${R} .bc-btn-quiet { border-color: transparent; }
${R} .bc-btn[aria-pressed="true"], ${R} button.bc-row[aria-pressed="true"] { border-color: var(--bc-gold); }
${R} .bc-face img { width: 100%; height: 100%; border-radius: inherit; object-fit: cover; }
${R} .bc-btn-danger { border-color: var(--bc-danger); color: var(--bc-danger); }
${R} .bc-note { padding: .75rem 1rem; border: 1px solid var(--bc-border); border-radius: .75rem; display: flex; flex-direction: column; gap: .5rem; align-items: flex-start; }
${R} .bc-skeleton { height: 4rem; border-radius: .75rem; background: var(--bc-card); color: transparent; animation: bc-pulse 1.4s ease-in-out infinite; }
${R} .bc-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
${R} .bc-veil { position: absolute; inset: 0; display: grid; place-items: end center; background: rgb(0 0 0 / .55); padding: 1rem; }
${R} .bc-sheet {
  width: min(100%, 35rem); display: flex; flex-direction: column; gap: .75rem; padding: 1.25rem;
  padding-bottom: max(1.25rem, env(safe-area-inset-bottom));
  background: var(--bc-card); border: 1px solid var(--bc-border); border-radius: 1rem;
  animation: bc-rise 220ms ease-out;
}
${R} .bc-sheet-tall { max-height: 92cqh; overflow-y: auto; }
    ${R} .bc-form select { min-height: 44px; padding: .625rem .75rem; font: inherit; color: var(--bc-fg); background: var(--bc-card); border: 1px solid var(--bc-border); border-radius: .625rem; }
    ${R} .bc-sheet h2 { font-family: var(--bc-display); font-weight: 400; font-size: 1.375rem; margin: 0; }
${R} .bc-muted { color: var(--muted-foreground, currentColor); }
${R} .bc-top { gap: .5rem; }
${R} .bc-top-day { margin-inline-start: auto; font-weight: 600; white-space: nowrap; }
${R} .bc-pips { display: inline-flex; gap: 4px; }
${R} .bc-pip { width: 10px; height: 20px; border-radius: 3px; border: 2px solid var(--bc-gold); transition: background-color 200ms; }
${R} .bc-pip-full { background: var(--bc-gold); }
${R} .bc-modes { display: flex; gap: .5rem; flex-wrap: wrap; }
  ${R} .bc-modes .bc-btn[aria-pressed="true"] { border-color: var(--bc-gold); color: var(--bc-gold); }
  ${R} .bc-dock {
  display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; border-top: 1px solid var(--bc-border);
  margin-inline: calc(-1 * max(1rem, env(safe-area-inset-left))); padding-bottom: env(safe-area-inset-bottom);
}
${R} .bc-dock-tab {
  position: relative; min-height: 56px; background: none; border: 0; color: var(--muted-foreground, var(--bc-fg));
  font: inherit; font-size: .875rem; cursor: pointer;
}
${R} .bc-dock-tab[aria-current="page"] { color: var(--bc-gold); font-weight: 600; }
${R} .bc-badge {
  display: inline-grid; place-items: center; min-width: 1.5rem; height: 1.5rem; margin-inline-start: .25rem;
  border-radius: 999px; background: var(--bc-gold); color: var(--bc-on-gold); font-size: .875rem; font-weight: 700;
}
${R} .bc-meters { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: .5rem; }
${R} .bc-meter { display: flex; flex-direction: column; gap: .25rem; padding: .75rem 1rem; background: var(--bc-card); border: 1px solid var(--bc-border); border-radius: .75rem; }
${R} .bc-meter-low { border-color: var(--bc-danger); }
${R} .bc-meter-value { font-size: 1.5rem; font-weight: 600; font-variant-numeric: tabular-nums; display: flex; align-items: baseline; gap: .5rem; }
${R} .bc-meter-tag { font-size: .875rem; color: var(--bc-danger); }
${R} .bc-bar { height: 4px; border-radius: 2px; background: var(--bc-border); overflow: hidden; }
${R} .bc-bar > span { display: block; height: 100%; background: var(--bc-gold); }
${R} .bc-meter-low .bc-bar > span { background: var(--bc-danger); }
${R} .bc-note-warn { border-color: var(--bc-danger); }
${R} .bc-section { display: flex; flex-direction: column; gap: .5rem; }
${R} .bc-subhead { font-size: 1rem; font-weight: 600; margin: 0; color: var(--muted-foreground, var(--bc-fg)); }
${R} .bc-list, ${R} .bc-plain { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: .5rem; }
${R} .bc-row {
  display: flex; align-items: center; gap: .75rem; width: 100%; min-height: 56px; padding: .625rem .875rem; text-align: start;
  background: var(--bc-card); border: 1px solid var(--bc-border); border-radius: .75rem; color: inherit; font: inherit;
}
${R} button.bc-row { cursor: pointer; }
${R} .bc-row-flat { background: none; border: 0; padding: 0; }
${R} .bc-row-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: .125rem; overflow-wrap: anywhere; }
${R} .bc-row-title { font-weight: 600; font-size: 1rem; margin: 0; }
${R} .bc-row-meta { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; }
${R} .bc-clamp { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
${R} .bc-face {
  flex: none; display: inline-grid; place-items: center; border-radius: 999px; font-weight: 700; color: var(--bc-fg);
  background: color-mix(in oklch, var(--bc-hue) 40%, var(--card, #26201b)); border: 2px solid var(--bc-hue);
}
${R} .bc-face-s { width: 44px; height: 44px; font-size: .875rem; }
${R} .bc-face-m { width: 48px; height: 48px; font-size: 1rem; }
${R} .bc-face-l { width: 72px; height: 72px; font-size: 1.5rem; font-family: var(--bc-display); }
${R} .bc-chip { display: inline-flex; align-items: center; min-height: 28px; padding: .125rem .625rem; border-radius: 999px; border: 1px solid var(--bc-border); font-size: .875rem; }
${R} .bc-chip-warn { border-color: var(--bc-danger); }
${R} .bc-quote { margin: 0; font-family: var(--bc-display); font-size: 1.25rem; line-height: 1.35; }
${R} .bc-panel { display: flex; flex-direction: column; gap: .5rem; align-items: flex-start; padding: .75rem 1rem; background: var(--bc-card); border: 1px solid var(--bc-border); border-radius: .75rem; }
${R} .bc-empty { display: flex; flex-direction: column; gap: .75rem; align-items: flex-start; }
${R} .bc-stamp { padding: .75rem 1rem; border: 1px solid var(--bc-gold); border-radius: .75rem; animation: bc-stamp 220ms ease-out; }
${R} .bc-card-screen { display: flex; flex-direction: column; gap: 1rem; }
${R} .bc-heading-s { font-size: 1.5rem; }
${R} .bc-answer {
  display: grid; grid-template-columns: 1fr auto; align-items: center; gap: .375rem .75rem; width: 100%; min-height: 56px;
  padding: .625rem .875rem; text-align: start; cursor: pointer; color: inherit; font: inherit;
  background: var(--bc-card); border: 1px solid var(--bc-border); border-radius: .75rem;
}
${R} .bc-answer:disabled { opacity: .6; cursor: default; }
/* Answer rows stack the stance pill over the reply, so every reply starts at the same edge. */
${R} .bc-answer > .bc-pill { justify-self: start; }
${R} .bc-answer > :not(.bc-pill, .bc-key) { grid-column: 1; }
${R} .bc-answer > .bc-key { grid-column: 2; grid-row: 1 / span 2; }
${R} .bc-said { quotes: "\\201C" "\\201D"; }
${R} .bc-said::before { content: open-quote; }
${R} .bc-said::after { content: close-quote; }
${R} .bc-pill { padding: .125rem .625rem; border-radius: 999px; background: color-mix(in oklch, var(--bc-gold) 20%, transparent); font-size: .875rem; white-space: nowrap; }
${R} .bc-key { min-width: 1.75rem; text-align: center; border: 1px solid var(--bc-border); border-radius: .375rem; font: inherit; font-size: .875rem; }
@media (hover: none) { ${R} .bc-key { display: none; } }
${R} .bc-form { display: flex; flex-direction: column; gap: .5rem; align-items: stretch; }
${R} .bc-form label { font-weight: 600; }
${R} .bc-form textarea, ${R} .bc-form input {
  min-height: 44px; padding: .625rem .75rem; font: inherit; font-size: 1rem; color: var(--bc-fg);
  background: var(--bc-card); border: 1px solid var(--bc-border); border-radius: .625rem; resize: vertical;
}
${R} .bc-up { color: var(--primary, currentColor); font-weight: 700; }
${R} .bc-down { color: var(--bc-danger); font-weight: 700; }
${R}.bc-stage-root { padding-top: env(safe-area-inset-top); }
${R} .bc-receipt {
  display: flex; flex-direction: column; gap: .75rem; padding: 1.25rem; border-radius: .25rem;
  font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 1rem;
  background: color-mix(in oklch, var(--foreground, #f3e9d6) 92%, var(--background, #1b1511));
  color: var(--background, #1b1511); animation: bc-rise 220ms ease-out;
}
${R} .bc-receipt .bc-up, ${R} .bc-receipt .bc-down { color: inherit; }
${R} .bc-receipt-title { margin: 0; text-align: center; font-size: 1.25rem; letter-spacing: .08em; text-transform: uppercase; }
${R} .bc-receipt-title:focus { outline: none; }
${R} .bc-receipt-sub { text-align: center; }
${R} .bc-receipt-head { margin: 0; font-size: 1rem; border-top: 2px dashed currentColor; padding-top: .75rem; }
${R} .bc-receipt-rows { margin: 0; display: flex; flex-direction: column; gap: .25rem; border-block: 2px dashed currentColor; padding-block: .75rem; }
${R} .bc-receipt-rows > div { display: flex; justify-content: space-between; gap: 1rem; }
${R} .bc-receipt-rows dd { margin: 0; font-variant-numeric: tabular-nums; }
${R} .bc-receipt .bc-face { color: var(--foreground, #f3e9d6); }
${R} .bc-scene { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: .75rem; width: 100%; max-width: 45rem; margin-inline: auto; padding-bottom: max(1rem, env(safe-area-inset-bottom)); }
${R} .bc-scene-top { display: flex; align-items: center; justify-content: space-between; gap: .5rem; }
${R} .bc-scene-where { display: flex; align-items: center; gap: .5rem; }
${R} .bc-dots { display: inline-flex; gap: 4px; }
${R} .bc-dot { width: 8px; height: 8px; border-radius: 999px; background: var(--bc-border); }
${R} .bc-dot-done { background: var(--bc-gold); }
${R} .bc-dot-now { width: 20px; background: var(--bc-gold); }
${R} .bc-scene-title { margin: 0; font-family: var(--bc-display); font-weight: 400; font-size: 1.5rem; line-height: 1.2; }
${R} .bc-scene-title:focus { outline: none; }
${R} .bc-stage { list-style: none; margin: auto 0 0; padding: 1rem 0; display: flex; justify-content: center; gap: .75rem; flex-wrap: wrap; }
${R} .bc-on-stage { display: flex; flex-direction: column; align-items: center; gap: .25rem; opacity: .6; transition: opacity 200ms, transform 200ms; }
${R} .bc-speaking { opacity: 1; transform: translateY(-6px); }
${R} .bc-slot { display: flex; flex-direction: column; gap: .75rem; }
${R} .bc-line {
  display: flex; flex-direction: column; gap: .5rem; padding: 1rem 1rem 1rem 1.25rem; border-radius: 1rem;
  background: var(--bc-card); border: 1px solid var(--bc-border); border-inline-start: 4px solid var(--bc-hue, var(--bc-border));
}
${R} .bc-plate { font-weight: 600; }
${R} .bc-line-text { font-family: var(--bc-display); font-size: 1.25rem; line-height: 1.4; }
${R} .bc-btn-next { align-self: flex-end; }
${R} .bc-choice { display: flex; flex-direction: column; gap: .75rem; }
@container bc-frame (min-width: 900px) {
  ${R} .bc-dock, ${R} .bc-top { width: 100%; max-width: 40rem; margin-inline: auto; }
}
@container bc-frame (max-height: 520px) { ${R} .bc-face-l { width: 56px; height: 56px; font-size: 1.125rem; } }
@keyframes bc-stamp { from { transform: scale(1.15) rotate(-4deg); opacity: 0; } }
@container bc-frame (min-width: 560px) { ${R} .bc-veil { place-items: center; } }
@keyframes bc-pulse { 50% { opacity: .55; } }
@keyframes bc-rise { from { transform: translateY(1rem); opacity: 0; } }
${R} .bc-map { width: 100%; max-width: 30rem; margin-inline: auto; display: block; }
${R} .bc-map-line { stroke: var(--foreground); stroke-width: 2; opacity: .7; }
${R} .bc-map-secret { stroke-dasharray: 5 6; opacity: .4; }
${R} .bc-map-on { stroke: var(--primary); stroke-width: 4; opacity: 1; }
${R} .bc-map-hit { stroke: transparent; stroke-width: 28; cursor: pointer; }
${R} .bc-map-dot { fill: color-mix(in oklch, var(--bc-hue) 40%, var(--card, #26201b)); stroke: var(--bc-hue); stroke-width: 2; }
${R} .bc-map-text { fill: var(--foreground); font-size: 16px; font-weight: 600; }
${R} .bc-map-name { fill: var(--foreground); font-size: 16px; }
@media (prefers-reduced-motion: reduce) { ${R} * { animation: none !important; transition: none !important; } }
${REDUCED} ${R} * { animation: none !important; transition: none !important; }
`;
}
