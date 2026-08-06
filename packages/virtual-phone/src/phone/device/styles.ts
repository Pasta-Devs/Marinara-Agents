// The Engine compiles Tailwind from its own sources only, so a runtime-loaded
// capability cannot rely on Tailwind classes. The phone ships its own scoped CSS.
//
// Visual language: iOS-leaning hybrid (iOS structure and typography, Material
// press states and elevation). Depth comes from layered shadows, hairlines,
// and subtle surface gradients — no translucent "glass" materials.
export const phoneStylesheet = `
.vp-root { position: fixed; inset: 0; z-index: 10020; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", Roboto, system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
.vp-root *, .vp-root *::before, .vp-root *::after { box-sizing: border-box; }
.vp-root button { font: inherit; color: inherit; background: none; border: 0; padding: 0; margin: 0; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.vp-root button:focus-visible, .vp-root input:focus-visible, .vp-root select:focus-visible { outline: 2px solid var(--vp-accent); outline-offset: 2px; }
.vp-root button:disabled { opacity: 0.35; cursor: default; }
.vp-scrim { position: absolute; inset: 0; background: rgb(0 0 0 / 0.4); }
.vp-stage { position: absolute; inset: 0; display: flex; align-items: center; justify-content: flex-end; padding: 0.75rem; }
@media (min-width: 640px) { .vp-stage { padding: 1.5rem; } }

.vp-shell { position: relative; display: flex; flex-direction: column; width: min(calc(100vw - 1.5rem), calc((100dvh - 1.5rem) * 9 / 19.5), 396px); aspect-ratio: 9 / 19.5; padding: 5px; border-radius: 48px; background: linear-gradient(160deg, color-mix(in srgb, var(--vp-bezel) 82%, #7c8494) 0%, var(--vp-bezel) 22%, var(--vp-bezel) 78%, color-mix(in srgb, var(--vp-bezel) 88%, #7c8494) 100%); box-shadow: 0 32px 90px rgb(0 0 0 / 0.45), 0 8px 24px rgb(0 0 0 / 0.3), inset 0 0 0 1.5px rgb(255 255 255 / 0.16), inset 0 0 0 3px rgb(0 0 0 / 0.4); }
@media (min-width: 640px) { .vp-shell { width: min(calc(100vw - 3rem), calc(88dvh * 9 / 19.5), 396px); } }
.vp-notch { pointer-events: none; position: absolute; left: 50%; top: 12px; transform: translateX(-50%); z-index: 30; height: 1.375rem; width: 5.5rem; border-radius: 999px; background: #000; box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.06), 0 1px 3px rgb(0 0 0 / 0.5); }
.vp-notch::after { content: ""; position: absolute; right: 0.5rem; top: 50%; height: 0.5rem; width: 0.5rem; transform: translateY(-50%); border-radius: 999px; background: radial-gradient(circle at 35% 35%, #2e3a52 0%, #10141c 55%, #000 100%); }
.vp-key { pointer-events: none; position: absolute; width: 4px; background: linear-gradient(90deg, color-mix(in srgb, var(--vp-bezel) 70%, #8a93a5), var(--vp-bezel)); }
.vp-key--volume { left: -4px; top: 6rem; height: 3rem; border-radius: 4px 0 0 4px; box-shadow: 0 4.5rem 0 var(--vp-bezel); }
.vp-key--power { right: -4px; top: 8rem; height: 5rem; border-radius: 0 4px 4px 0; background: linear-gradient(270deg, color-mix(in srgb, var(--vp-bezel) 70%, #8a93a5), var(--vp-bezel)); }

.vp-screen { position: relative; display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; border-radius: 43px; background: var(--vp-bg); color: var(--vp-text); }
.vp-statusbar { position: relative; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 0.5rem; min-height: 3.25rem; flex-shrink: 0; padding: 0.625rem 1.375rem 0; font-size: 0.75rem; font-weight: 600; letter-spacing: 0.01em; font-variant-numeric: tabular-nums; }
.vp-statusbar-cluster { display: inline-flex; align-items: center; gap: 0.3125rem; min-width: 0; }
.vp-statusbar-clock { min-width: 0; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vp-statusbar-end { display: flex; align-items: center; justify-content: flex-end; gap: 0.375rem; min-width: 0; }
.vp-switch-btn { display: inline-flex; align-items: center; gap: 0.25rem; min-height: 2rem; max-width: 7rem; padding: 0 0.5rem; border-radius: 999px; background: color-mix(in srgb, var(--vp-text) 7%, transparent); transition: background 140ms ease; }
.vp-switch-btn:hover { background: color-mix(in srgb, var(--vp-text) 12%, transparent); }
.vp-switch-btn > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vp-switcher { position: absolute; right: 0.875rem; top: 3.25rem; z-index: 20; width: 13rem; max-width: calc(100% - 1.75rem); display: grid; gap: 0.125rem; padding: 0.375rem; border-radius: 1.125rem; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 96%, #ffffff), var(--vp-surface)); color: var(--vp-text); box-shadow: 0 1px 2px rgb(0 0 0 / 0.1), 0 20px 48px rgb(0 0 0 / 0.3), inset 0 0 0 1px var(--vp-border); transform-origin: top right; animation: vp-pop 160ms cubic-bezier(0.2, 0.9, 0.3, 1.2); }
@keyframes vp-pop { from { opacity: 0; transform: scale(0.92) translateY(-4px); } }
.vp-switcher-option { display: flex; align-items: center; min-height: 2.75rem; padding: 0 0.875rem; border-radius: 0.875rem; font-size: 0.8125rem; font-weight: 500; text-align: left; transition: background 120ms ease; }
.vp-switcher-option:hover { background: color-mix(in srgb, var(--vp-text) 7%, transparent); }
.vp-switcher-option[aria-selected="true"] { color: var(--vp-accent); }
.vp-switcher-option span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.vp-surface-area { position: relative; display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; }
.vp-lock { display: flex; flex-direction: column; flex: 1; min-height: 0; align-items: center; justify-content: center; gap: 1.5rem; padding: 1.5rem; text-align: center; }
.vp-lock-clock { font-size: 3.5rem; font-weight: 250; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; line-height: 1.05; margin: 0; text-shadow: 0 1px 12px rgb(0 0 0 / 0.08); }
.vp-lock-date { margin: 0.375rem 0 0; font-size: 0.8125rem; font-weight: 500; color: var(--vp-muted); }
.vp-lock-card { width: 100%; min-height: 5rem; display: flex; align-items: center; justify-content: center; padding: 1rem; border-radius: 1.375rem; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 97%, #ffffff), var(--vp-surface)); font-size: 0.75rem; font-weight: 500; color: var(--vp-muted); box-shadow: 0 1px 2px rgb(0 0 0 / 0.06), 0 8px 24px rgb(0 0 0 / 0.1), inset 0 0 0 1px var(--vp-border); }
.vp-unlock-btn { min-height: 2.875rem; padding: 0 1.75rem; border-radius: 999px; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-accent) 90%, #ffffff), var(--vp-accent)); color: #fff; font-size: 0.8125rem; font-weight: 600; box-shadow: 0 1px 2px rgb(0 0 0 / 0.15), 0 6px 16px color-mix(in srgb, var(--vp-accent) 40%, transparent), inset 0 1px 0 rgb(255 255 255 / 0.25); transition: transform 120ms ease, box-shadow 120ms ease; }
.vp-unlock-btn:active { transform: scale(0.97); }

.vp-home { display: flex; flex-direction: column; flex: 1; min-height: 0; padding: 1.25rem; }
.vp-home-top { display: flex; justify-content: flex-end; }
.vp-icon-btn { display: inline-flex; align-items: center; justify-content: center; height: 2.75rem; width: 2.75rem; flex-shrink: 0; border-radius: 999px; transition: background 140ms ease, transform 120ms ease; }
.vp-icon-btn:hover { background: color-mix(in srgb, var(--vp-text) 7%, transparent); }
.vp-icon-btn:active { transform: scale(0.94); }
.vp-icon-btn--surface { background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 97%, #ffffff), var(--vp-surface)); box-shadow: 0 1px 2px rgb(0 0 0 / 0.08), 0 4px 12px rgb(0 0 0 / 0.1), inset 0 0 0 1px var(--vp-border); }
.vp-icon-btn--surface:hover { background: var(--vp-surface); }
.vp-search-bar { display: block; width: 100%; min-height: 2.875rem; margin-top: 0.5rem; padding: 0 1.125rem; border: 0; border-radius: 999px; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 97%, #ffffff), var(--vp-surface)); color: var(--vp-text); font-size: 0.9375rem; box-shadow: 0 1px 2px rgb(0 0 0 / 0.07), 0 5px 14px rgb(0 0 0 / 0.09), inset 0 0 0 1px var(--vp-border); }
.vp-search-bar::placeholder { color: var(--vp-muted); }
.vp-home-spacer { flex: 1; min-height: 6rem; }
.vp-app-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); column-gap: 0.75rem; row-gap: 1.125rem; padding: 0 0.25rem 0.75rem; }
.vp-app { display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 0.4375rem; min-width: 0; border-radius: 0.75rem; color: var(--vp-text); }
.vp-app-icon { display: flex; align-items: center; justify-content: center; aspect-ratio: 1; width: 100%; max-width: 4.25rem; border-radius: 32%; color: #fff; box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.3), inset 0 -1px 0 rgb(0 0 0 / 0.15), 0 5px 12px rgb(0 0 0 / 0.18); transition: transform 140ms cubic-bezier(0.2, 0.9, 0.3, 1.4), filter 140ms ease; }
.vp-app:hover .vp-app-icon { filter: brightness(1.06); }
.vp-app:active .vp-app-icon { transform: scale(0.92); }
.vp-app-icon--settings { background: linear-gradient(180deg, #8e97a6 0%, #5c6470 100%); }
.vp-app-icon--app-store { background: linear-gradient(180deg, #34aefc 0%, #0b6ded 100%); }
.vp-app-icon--goodle { background: linear-gradient(180deg, #ff7a59 0%, #e6343f 100%); }
.vp-app-icon--default { background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 92%, #ffffff), var(--vp-surface)); color: var(--vp-text); }
.vp-app-label { font-size: 0.6875rem; font-weight: 500; letter-spacing: 0.01em; text-shadow: 0 1px 4px rgb(0 0 0 / 0.1); }
.vp-app-slot { aspect-ratio: 1; width: 100%; max-width: 4.25rem; border-radius: 32%; box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--vp-muted) 22%, transparent), inset 0 2px 6px rgb(0 0 0 / 0.05); }

.vp-footer { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; flex-shrink: 0; padding: 0.625rem 1.25rem max(0.625rem, env(safe-area-inset-bottom)); background: var(--vp-bg); box-shadow: 0 -1px 0 var(--vp-border); }
.vp-putdown-btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; width: 100%; min-height: 2.75rem; padding: 0 1rem; border-radius: 999px; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-accent) 90%, #ffffff), var(--vp-accent)); color: #fff; font-size: 0.8125rem; font-weight: 600; box-shadow: 0 1px 2px rgb(0 0 0 / 0.15), 0 5px 14px color-mix(in srgb, var(--vp-accent) 35%, transparent), inset 0 1px 0 rgb(255 255 255 / 0.25); transition: transform 120ms ease, filter 140ms ease; }
.vp-putdown-btn:hover { filter: brightness(1.05); }
.vp-putdown-btn:active { transform: scale(0.98); }
.vp-home-indicator { display: block; height: 5px; width: 7.5rem; border-radius: 999px; background: color-mix(in srgb, var(--vp-text) 30%, transparent); }

.vp-appview { position: absolute; inset: 0; z-index: 10; overflow-y: auto; background: var(--vp-bg); padding: 1.125rem 1.125rem 1.5rem; animation: vp-app-in 200ms cubic-bezier(0.2, 0.9, 0.3, 1); }
@keyframes vp-app-in { from { opacity: 0; transform: scale(0.96) translateY(8px); } }
@media (prefers-reduced-motion: reduce) { .vp-appview, .vp-switcher { animation: none; } }
.vp-appview--loading { font-size: 0.75rem; }
.vp-app-header { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; min-height: 2.75rem; margin-bottom: 1rem; }
.vp-app-header h2 { flex: 1; min-width: 0; margin: 0; text-align: center; font-size: 1.0625rem; font-weight: 650; letter-spacing: -0.01em; }
.vp-app-title-spacer { width: 2.75rem; flex-shrink: 0; }
.vp-stack { display: grid; gap: 0.875rem; font-size: 0.8125rem; }
.vp-section-label { margin: 0 0 -0.375rem; padding-left: 1rem; font-size: 0.6875rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--vp-muted); }
.vp-section-label--spaced { padding-top: 0.875rem; }
.vp-field { display: grid; gap: 0.375rem; }
.vp-field > span { padding-left: 0.25rem; font-weight: 500; }
.vp-input, .vp-select { width: 100%; min-height: 2.875rem; padding: 0 0.875rem; border: 0; border-radius: 0.875rem; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 97%, #ffffff), var(--vp-surface)); color: var(--vp-text); font: inherit; box-shadow: 0 1px 2px rgb(0 0 0 / 0.05), inset 0 0 0 1px var(--vp-border); }
.vp-check { display: flex; align-items: center; gap: 0.75rem; min-height: 2.875rem; padding: 0 0.875rem; border-radius: 0.875rem; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 97%, #ffffff), var(--vp-surface)); font-weight: 500; box-shadow: 0 1px 2px rgb(0 0 0 / 0.05), inset 0 0 0 1px var(--vp-border); }
.vp-check input { height: 1.25rem; width: 1.25rem; accent-color: var(--vp-accent); }
.vp-range { width: 100%; min-height: 2.875rem; accent-color: var(--vp-accent); }
.vp-surface-btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; width: 100%; min-height: 2.875rem; padding: 0 1rem; border: 0; border-radius: 0.875rem; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 97%, #ffffff), var(--vp-surface)); color: var(--vp-accent); font-weight: 600; box-shadow: 0 1px 2px rgb(0 0 0 / 0.06), inset 0 0 0 1px var(--vp-border); transition: transform 120ms ease; }
.vp-surface-btn:active { transform: scale(0.98); }
.vp-accent-btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.375rem; min-height: 2.125rem; padding: 0 1rem; border-radius: 999px; background: color-mix(in srgb, var(--vp-accent) 14%, var(--vp-surface)); color: var(--vp-accent); font-size: 0.75rem; font-weight: 650; transition: transform 120ms ease, filter 140ms ease; }
.vp-accent-btn:hover { filter: brightness(0.97); }
.vp-accent-btn:active { transform: scale(0.96); }
.vp-card { border-radius: 1.125rem; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 97%, #ffffff), var(--vp-surface)); padding: 0.875rem; box-shadow: 0 1px 2px rgb(0 0 0 / 0.05), 0 6px 16px rgb(0 0 0 / 0.07), inset 0 0 0 1px var(--vp-border); }
.vp-card-row { display: flex; align-items: center; gap: 0.75rem; min-height: 4.5rem; }
.vp-card-icon { display: inline-flex; align-items: center; justify-content: center; height: 2.75rem; width: 2.75rem; flex-shrink: 0; border-radius: 32%; color: #fff; box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.3), inset 0 -1px 0 rgb(0 0 0 / 0.15), 0 3px 8px rgb(0 0 0 / 0.15); }
.vp-card-body { flex: 1; min-width: 0; }
.vp-card-body h3 { margin: 0; font-size: 0.8125rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vp-card-body p { margin: 0.25rem 0 0; font-size: 0.6875rem; color: var(--vp-muted); }
.vp-muted-note { font-size: 0.6875rem; font-weight: 500; color: var(--vp-muted); }
.vp-search-row { display: flex; gap: 0.5rem; }
.vp-search-row label { flex: 1; min-width: 0; }
.vp-result-list { list-style: none; margin: 1rem 0 0; padding: 0; display: grid; gap: 0.5rem; }
.vp-result-list li { border-radius: 0.875rem; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 97%, #ffffff), var(--vp-surface)); padding: 0.875rem; font-size: 0.8125rem; box-shadow: 0 1px 2px rgb(0 0 0 / 0.05), inset 0 0 0 1px var(--vp-border); }
.vp-result-title { margin: 1.25rem 0 0; font-size: 0.9375rem; font-weight: 650; letter-spacing: -0.01em; }
.vp-result-summary { margin: 0.5rem 0 0; font-size: 0.8125rem; color: var(--vp-muted); }
.vp-app-header-actions { display: flex; align-items: center; gap: 0.125rem; flex-shrink: 0; }
.vp-app-error { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; text-align: center; font-size: 0.8125rem; font-weight: 500; }
.vp-app-error .vp-surface-btn { width: auto; padding: 0 1.5rem; }
.vp-chip-row { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.875rem; }
.vp-chip { display: inline-flex; align-items: center; max-width: 100%; min-height: 2.125rem; padding: 0 0.875rem; border-radius: 999px; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 97%, #ffffff), var(--vp-surface)); font-size: 0.75rem; font-weight: 500; box-shadow: 0 1px 2px rgb(0 0 0 / 0.06), inset 0 0 0 1px var(--vp-border); transition: transform 120ms ease; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vp-chip:active { transform: scale(0.96); }
.vp-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
`;
