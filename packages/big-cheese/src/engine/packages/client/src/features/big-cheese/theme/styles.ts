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
  --bc-body: "Schibsted Grotesk", system-ui, sans-serif;
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
${R} .bc-sheet h2 { font-family: var(--bc-display); font-weight: 400; font-size: 1.375rem; margin: 0; }
@container bc-frame (min-width: 560px) { ${R} .bc-veil { place-items: center; } }
@keyframes bc-pulse { 50% { opacity: .55; } }
@keyframes bc-rise { from { transform: translateY(1rem); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { ${R} * { animation: none !important; transition: none !important; } }
${REDUCED} ${R} * { animation: none !important; transition: none !important; }
`;
}
