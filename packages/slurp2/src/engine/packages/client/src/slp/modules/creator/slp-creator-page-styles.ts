// ──────────────────────────────────────────────
// Creator Pages: the CSS for SlpCreatorPage.tsx. Injected once by slp-client-entry.tsx next to
// the sparkle styles, so it does not depend on the package Tailwind build or the Engine safelist.
//
// Each theme is one set of custom properties on `.slp-page[data-theme]`. A theme owns its own
// background and text colours, so its contrast holds in light and dark mode alike; only "slurp"
// follows the app's own tokens. No animation: a Page is read, not watched.
// ──────────────────────────────────────────────

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export const SLP_CREATOR_PAGE_STYLES = `
.slp-page {
  --pg-bg: color-mix(in srgb, var(--slurp-surface-raised, #211624) 70%, transparent);
  --pg-block: var(--slurp-surface, #18101b);
  --pg-text: var(--slurp-text, #f6e9f1);
  --pg-muted: var(--slurp-muted, #cdb9c7);
  --pg-line: var(--noodle-divider, rgb(127 127 127 / .25));
  --pg-accent: var(--noodle-accent, #ff7ec1);
  --pg-accent-text: var(--noodle-accent, #ff7ec1);
  --pg-on-accent: var(--slurp-on-accent, #1a0d15);
  --pg-display: "Slurp Display", var(--font-y2k, sans-serif);
  --pg-display-weight: 800;
  --pg-body: inherit;
  --pg-radius: 18px;
  --pg-tile-radius: 12px;
  --pg-shadow: var(--slurp-shadow-raised, 0 12px 30px -22px #000);
  --pg-border: 0;
  --pg-grain: 0;
  position: relative; isolation: isolate; overflow: hidden;
  margin: 20px 12px 0; padding: 14px 12px 12px; border-radius: 24px;
  background: var(--pg-bg); color: var(--pg-text); font-family: var(--pg-body);
}
.slp-page::before {
  content: ""; position: absolute; inset: 0; z-index: -1; pointer-events: none;
  opacity: var(--pg-grain); background-image: ${GRAIN}; mix-blend-mode: overlay;
}
.slp-page[data-theme="candle"] {
  --pg-bg: linear-gradient(180deg, #0c0910, #160e1f); --pg-block: #1a1322; --pg-text: #efe6f5; --pg-muted: #b3a2bf;
  --pg-line: #33283e; --pg-accent: #b58cff; --pg-accent-text: #c7a6ff; --pg-on-accent: #140a20;
  --pg-display: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif; --pg-display-weight: 600;
  --pg-radius: 8px; --pg-tile-radius: 4px; --pg-grain: .35; --pg-border: 1px solid #33283e;
  --pg-shadow: 0 0 0 1px color-mix(in srgb, #b58cff 30%, transparent), 0 0 24px -10px #b58cff;
}
.slp-page[data-theme="peach"] {
  --pg-bg: linear-gradient(180deg, #ffe3d3, #ffd0e2 60%, #fff1f7); --pg-block: rgb(255 255 255 / .74);
  --pg-text: #3a1d2c; --pg-muted: #7a4b60; --pg-line: #efc3d3; --pg-accent: #ff6a3d; --pg-accent-text: #b8401a;
  --pg-on-accent: #fff; --pg-display: ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif;
  --pg-display-weight: 900; --pg-radius: 22px; --pg-tile-radius: 16px; --pg-shadow: 0 10px 30px -18px #b0446f;
}
.slp-page[data-theme="sketch"] {
  --pg-bg: #f6f1e7; --pg-block: #fffdf8; --pg-text: #2b2622; --pg-muted: #6b6053; --pg-line: #e2d8c6;
  --pg-accent: #2f7d6d; --pg-accent-text: #276b5d; --pg-on-accent: #fff;
  --pg-display: "Bradley Hand", "Segoe Print", "Chalkboard SE", "Comic Sans MS", cursive; --pg-display-weight: 700;
  --pg-body: Georgia, "Iowan Old Style", serif; --pg-radius: 4px; --pg-tile-radius: 2px; --pg-grain: .5;
  --pg-shadow: 2px 3px 0 rgb(0 0 0 / .06); --pg-border: 1px solid #e2d8c6;
}
.slp-page[data-theme="mono"] {
  --pg-bg: #0a0a0a; --pg-block: #141414; --pg-text: #f5f5f5; --pg-muted: #a8a8a8; --pg-line: #2c2c2c;
  --pg-accent: #ffffff; --pg-accent-text: #ffffff; --pg-on-accent: #000;
  --pg-display: "Helvetica Neue", Arial, system-ui, sans-serif; --pg-display-weight: 900;
  --pg-radius: 0; --pg-tile-radius: 0; --pg-shadow: none; --pg-border: 1px solid #2c2c2c;
}
.slp-page[data-theme="ocean"] {
  --pg-bg: linear-gradient(160deg, #0b2540, #0e4a5a); --pg-block: rgb(255 255 255 / .07); --pg-text: #e6f6fb;
  --pg-muted: #a5cbd6; --pg-line: rgb(255 255 255 / .12); --pg-accent: #5fe0d0; --pg-accent-text: #7ee8db;
  --pg-on-accent: #04212a; --pg-radius: 16px; --pg-tile-radius: 12px; --pg-shadow: 0 12px 30px -20px #000;
}
.slp-page[data-theme="mono"] .slp-page-title, .slp-page[data-theme="mono"] .slp-page-quote { text-transform: uppercase; letter-spacing: .02em; }
.slp-page[data-theme="sketch"] .slp-page-block:not(.slp-page-bare)::after {
  content: ""; position: absolute; top: -8px; left: 50%; width: 64px; height: 16px; transform: translateX(-50%) rotate(-3deg);
  background: color-mix(in srgb, var(--pg-accent) 35%, #fff8); opacity: .8; pointer-events: none;
}
.slp-page-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 32px; padding: 0 4px 10px; }
.slp-page-label { font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--pg-muted); }
.slp-page-button {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 44px; min-width: 44px; padding: 0 14px;
  border: 0; border-radius: 999px; background: color-mix(in srgb, var(--pg-text) 10%, transparent); color: var(--pg-text);
  font: inherit; font-size: 13px; font-weight: 800; cursor: pointer;
}
.slp-page-button:hover { background: color-mix(in srgb, var(--pg-text) 16%, transparent); }
.slp-page-button[data-primary] { background: var(--pg-accent); color: var(--pg-on-accent); }
.slp-page-button:disabled { opacity: .55; cursor: default; }
.slp-page :focus-visible,
.slp-page.slp-page-swatch:focus-visible { outline: 2px solid var(--pg-accent); outline-offset: 2px; }
.slp-page-blocks { display: flex; flex-direction: column; gap: 12px; }
@container (min-width: 620px) {
  .slp-page { margin: 20px 0 0; padding: 18px; }
  .slp-page-blocks { display: block; columns: 2; column-gap: 12px; }
  .slp-page-blocks > * { break-inside: avoid; margin-bottom: 12px; }
}
.slp-page-block {
  position: relative; padding: 14px; border-radius: var(--pg-radius); background: var(--pg-block);
  box-shadow: var(--pg-shadow); border: var(--pg-border); min-width: 0; overflow-wrap: anywhere;
}
.slp-page-bare { background: transparent; box-shadow: none; border: 0; padding: 2px 4px; }
.slp-page-title { margin: 0 0 10px; font-family: var(--pg-display); font-weight: var(--pg-display-weight); font-size: 17px; line-height: 1.2; }
.slp-page-quote { margin: 0; font-family: var(--pg-display); font-weight: var(--pg-display-weight); font-size: 23px; line-height: 1.2; text-wrap: balance; }
.slp-page-quote::before { content: "\\201C"; color: var(--pg-accent-text); }
.slp-page-quote::after { content: "\\201D"; color: var(--pg-accent-text); }
.slp-page-now { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 15px; }
.slp-page-now-dot { flex: none; width: 10px; height: 10px; border-radius: 50%; background: var(--pg-accent); box-shadow: 0 0 12px var(--pg-accent); }
.slp-page-now small { display: block; margin-top: 2px; font-size: 12px; font-weight: 500; color: var(--pg-muted); }
.slp-page-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; font-size: 14px; line-height: 1.4; counter-reset: slp-page; }
.slp-page-list li { display: flex; gap: 10px; align-items: baseline; }
.slp-page-list[data-style="bullets"] li::before { content: ""; flex: none; width: 7px; height: 7px; background: var(--pg-accent); transform: translateY(-2px) rotate(45deg); }
.slp-page-list[data-style="numbered"] li::before { counter-increment: slp-page; content: counter(slp-page); flex: none; min-width: 16px; font-family: var(--pg-display); font-weight: 800; color: var(--pg-accent-text); }
.slp-page-tot { display: grid; grid-template-columns: 1fr auto 1fr; gap: 6px 8px; align-items: center; font-size: 14px; }
.slp-page-tot span:nth-child(3n+1) { text-align: end; }
.slp-page-tot [data-pick] { font-weight: 800; color: var(--pg-accent-text); }
.slp-page-tot-or { font-size: 11px; color: var(--pg-muted); }
.slp-page-qa { display: flex; flex-direction: column; gap: 12px; margin: 0; }
.slp-page-qa dt { font-size: 13px; color: var(--pg-muted); }
.slp-page-qa dt::before { content: "Q  "; font-weight: 800; color: var(--pg-accent-text); }
.slp-page-qa dd { margin: 2px 0 0; font-size: 14px; line-height: 1.4; }
.slp-page-facts { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 0; }
.slp-page-facts dt { font-size: 12px; color: var(--pg-muted); }
.slp-page-facts dd { margin: 0; font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; }
.slp-page-menu { display: flex; flex-direction: column; }
.slp-page-menu-row {
  display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 44px; padding: 6px 0;
  border: 0; border-bottom: 1px dashed var(--pg-line); background: none; color: inherit; font: inherit; font-size: 14px; text-align: start;
}
.slp-page-menu-row:last-child { border-bottom: 0; }
button.slp-page-menu-row { cursor: pointer; }
.slp-page-menu-row b { font-variant-numeric: tabular-nums; white-space: nowrap; }
button.slp-page-menu-row b { color: var(--pg-accent-text); }
.slp-page-people { display: flex; gap: 14px; overflow-x: auto; scrollbar-width: none; margin: 0 -4px; padding: 2px 4px; }
.slp-page-person { flex: none; width: 68px; border: 0; background: none; color: var(--pg-muted); font: inherit; font-size: 11px; text-align: center; cursor: pointer; padding: 0; }
.slp-page-person b { display: block; margin-top: 4px; color: var(--pg-text); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.slp-page-avatar { width: 56px !important; height: 56px !important; margin: 0 auto; }
.slp-page-person[data-relation="rival"] .slp-page-avatar { box-shadow: 0 0 0 2px #ff5a5a; border-radius: 999px; }
.slp-page-person[data-relation="partner"] .slp-page-avatar, .slp-page-person[data-relation="dating"] .slp-page-avatar { box-shadow: 0 0 0 2px var(--pg-accent); border-radius: 999px; }
.slp-page-poll-q { margin: 0 0 8px; font-weight: 700; font-size: 15px; }
.slp-page-poll-option {
  display: block; width: 100%; min-height: 44px; margin-top: 8px; padding: 10px 12px; border: 0; border-radius: 12px; text-align: start;
  background: color-mix(in srgb, var(--pg-text) 7%, transparent); color: var(--pg-text); font: inherit; font-weight: 700; font-size: 14px; cursor: pointer;
}
.slp-page-poll-option:hover { background: color-mix(in srgb, var(--pg-accent) 22%, transparent); }
.slp-page-tile {
  position: relative; display: block; overflow: hidden; padding: 0; border: 0; border-radius: var(--pg-tile-radius);
  background: color-mix(in srgb, var(--pg-text) 8%, transparent); cursor: pointer; aspect-ratio: 1;
}
.slp-page-tile img { width: 100%; height: 100%; object-fit: cover; display: block; }
.slp-page-tile[data-locked] img { filter: blur(10px) saturate(.7); transform: scale(1.1); }
.slp-page-tile-lock {
  position: absolute; inset: 0; display: grid; place-items: center; padding: 6px; text-align: center;
  background: rgb(0 0 0 / .35); color: #fff; font-size: 12px; font-weight: 800;
}
.slp-page-collage[data-layout="bento"] { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.slp-page-collage[data-layout="bento"] .slp-page-tile:first-child { grid-column: span 2; grid-row: span 2; }
.slp-page-collage[data-layout="mood"] { columns: 2; column-gap: 6px; }
.slp-page-collage[data-layout="mood"] .slp-page-tile { width: 100%; margin-bottom: 6px; break-inside: avoid; }
.slp-page-collage[data-layout="mood"] .slp-page-tile:nth-child(3n+1) { aspect-ratio: 3/4; }
.slp-page-collage[data-layout="mood"] .slp-page-tile:nth-child(3n) { aspect-ratio: 4/5; }
.slp-page-collage[data-layout="film"] {
  display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; margin: 0 -14px; padding: 10px 8px;
  background: #0b0b0b; border-block: 6px dotted #2a2a2a;
}
.slp-page-collage[data-layout="film"] .slp-page-tile { flex: 0 0 116px; aspect-ratio: 3/4; border-radius: 3px; }
.slp-page-collage[data-layout="polaroid"] { display: grid; grid-template-columns: 1fr 1fr; gap: 18px 14px; padding: 6px 8px 14px; }
.slp-page-collage[data-layout="polaroid"] .slp-page-tile {
  border-radius: 2px; padding: 7px 7px 26px; background: #fff; box-shadow: 0 12px 24px -12px rgb(0 0 0 / .45);
}
.slp-page-collage[data-layout="polaroid"] .slp-page-tile img { aspect-ratio: 1; height: auto; }
.slp-page-collage[data-layout="polaroid"] .slp-page-tile:nth-child(4n+1) { transform: rotate(-4deg); }
.slp-page-collage[data-layout="polaroid"] .slp-page-tile:nth-child(4n+2) { transform: rotate(3deg) translateY(8px); }
.slp-page-collage[data-layout="polaroid"] .slp-page-tile:nth-child(4n+3) { transform: rotate(2deg); }
.slp-page-collage[data-layout="polaroid"] .slp-page-tile:nth-child(4n) { transform: rotate(-2deg) translateY(6px); }
.slp-page-collage[data-layout="polaroid"] .slp-page-tile-lock { inset: 7px 7px 26px; }
.slp-page.slp-page-swatch {
  margin: 0; padding: 10px; min-height: 64px; border-radius: 14px; border: 0; cursor: pointer; text-align: start;
  display: flex; flex-direction: column; justify-content: space-between; gap: 6px; font-size: 12px; font-weight: 800;
}
.slp-page-swatch-name { font-family: var(--pg-display); font-weight: var(--pg-display-weight); font-size: 14px; }
.slp-page-swatch-dots { display: flex; gap: 4px; }
.slp-page-swatch-dots span { width: 12px; height: 12px; border-radius: 50%; background: var(--pg-accent); }
.slp-page-swatch-dots span + span { background: var(--pg-block); box-shadow: inset 0 0 0 1px var(--pg-line); }
.slp-page-swatch[aria-pressed="true"] { box-shadow: 0 0 0 2px var(--slurp-canvas, #000), 0 0 0 4px var(--noodle-accent, #ff7ec1); }
.slp-page-invite { display: flex; flex-direction: column; gap: 10px; padding: 16px; text-align: center; }
.slp-page-invite p { margin: 0; font-size: 14px; color: var(--pg-muted); }
.slp-page-invite strong { display: block; font-family: var(--pg-display); font-weight: var(--pg-display-weight); font-size: 19px; color: var(--pg-text); }
.slp-page-invite-actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
`;
