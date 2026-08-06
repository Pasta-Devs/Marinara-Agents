// The Engine compiles Tailwind from its own sources only, so a runtime-loaded
// capability cannot rely on Tailwind classes. The phone ships its own scoped CSS.
export const phoneStylesheet = `
.vp-root { position: fixed; inset: 0; z-index: 10020; font-family: inherit; }
.vp-root *, .vp-root *::before, .vp-root *::after { box-sizing: border-box; }
.vp-root button { font: inherit; color: inherit; background: none; border: 0; padding: 0; margin: 0; cursor: pointer; }
.vp-root button:focus-visible, .vp-root input:focus-visible, .vp-root select:focus-visible { outline: 2px solid var(--vp-accent); outline-offset: 2px; }
.vp-scrim { position: absolute; inset: 0; background: rgb(0 0 0 / 0.35); backdrop-filter: blur(2px); }
.vp-stage { position: absolute; inset: 0; display: flex; align-items: center; justify-content: flex-end; padding: 0.75rem; }
@media (min-width: 640px) { .vp-stage { padding: 1.5rem; } }

.vp-shell { position: relative; display: flex; flex-direction: column; width: min(calc(100vw - 1.5rem), calc((100dvh - 1.5rem) * 9 / 19.5), 396px); aspect-ratio: 9 / 19.5; padding: 4px; border-radius: 46px; background: var(--vp-bezel); box-shadow: 0 24px 80px rgb(0 0 0 / 0.4), 0 2px 8px rgb(0 0 0 / 0.35), inset 0 0 0 1px rgb(255 255 255 / 0.18); }
@media (min-width: 640px) { .vp-shell { width: min(calc(100vw - 3rem), calc(88dvh * 9 / 19.5), 396px); } }
.vp-notch { pointer-events: none; position: absolute; left: 50%; top: 4px; transform: translateX(-50%); z-index: 30; height: 1.5rem; width: 7rem; border-radius: 0 0 1rem 1rem; background: var(--vp-bezel); }
.vp-notch::after { content: ""; position: absolute; left: 50%; top: 0.5rem; height: 4px; width: 2.5rem; transform: translateX(-50%); border-radius: 999px; background: rgb(255 255 255 / 0.2); }
.vp-key { pointer-events: none; position: absolute; width: 4px; background: var(--vp-bezel); }
.vp-key--volume { left: -4px; top: 6rem; height: 3rem; border-radius: 4px 0 0 4px; box-shadow: 0 4.5rem 0 var(--vp-bezel); }
.vp-key--power { right: -4px; top: 8rem; height: 5rem; border-radius: 0 4px 4px 0; }

.vp-screen { position: relative; display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; border-radius: 42px; background: var(--vp-bg); color: var(--vp-text); }
.vp-statusbar { position: relative; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 0.5rem; min-height: 3rem; flex-shrink: 0; padding: 0.5rem 1.25rem 0; font-size: 0.6875rem; font-weight: 600; }
.vp-statusbar-cluster { display: inline-flex; align-items: center; gap: 0.25rem; min-width: 0; }
.vp-statusbar-clock { min-width: 0; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vp-statusbar-end { display: flex; align-items: center; justify-content: flex-end; gap: 0.375rem; min-width: 0; }
.vp-switch-btn { display: inline-flex; align-items: center; gap: 0.25rem; min-height: 2rem; max-width: 7rem; padding: 0 0.375rem; border-radius: 0.375rem; }
.vp-switch-btn > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vp-switcher { position: absolute; right: 0.75rem; top: 3rem; z-index: 20; width: 12rem; max-width: calc(100% - 1.5rem); display: grid; gap: 0.25rem; padding: 0.5rem; border-radius: 0.75rem; border: 1px solid var(--vp-border); background: var(--vp-surface); color: var(--vp-text); box-shadow: 0 16px 40px rgb(0 0 0 / 0.25); }
.vp-switcher-option { display: flex; align-items: center; min-height: 2.75rem; padding: 0 0.75rem; border-radius: 0.375rem; font-size: 0.75rem; text-align: left; }
.vp-switcher-option:hover { background: var(--vp-bg); }
.vp-switcher-option span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.vp-surface-area { position: relative; display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; }
.vp-lock { display: flex; flex-direction: column; flex: 1; min-height: 0; align-items: center; justify-content: center; gap: 1.25rem; padding: 1.5rem; text-align: center; }
.vp-lock-clock { font-size: 3rem; font-weight: 300; font-variant-numeric: tabular-nums; line-height: 1.1; margin: 0; }
.vp-lock-date { margin: 0.375rem 0 0; font-size: 0.75rem; color: var(--vp-muted); }
.vp-lock-card { width: 100%; min-height: 5rem; padding: 1rem; border-radius: var(--vp-radius); background: color-mix(in srgb, var(--vp-surface) 55%, transparent); font-size: 0.75rem; color: var(--vp-muted); }
.vp-unlock-btn { min-height: 2.75rem; padding: 0 1.5rem; border-radius: 999px; background: var(--vp-surface); font-size: 0.75rem; font-weight: 600; box-shadow: 0 1px 3px rgb(0 0 0 / 0.12); }

.vp-home { display: flex; flex-direction: column; flex: 1; min-height: 0; padding: 1.25rem; }
.vp-home-top { display: flex; justify-content: flex-end; }
.vp-icon-btn { display: inline-flex; align-items: center; justify-content: center; height: 2.75rem; width: 2.75rem; flex-shrink: 0; border-radius: 0.75rem; }
.vp-icon-btn--surface { background: color-mix(in srgb, var(--vp-surface) 75%, transparent); box-shadow: 0 1px 3px rgb(0 0 0 / 0.12); }
.vp-search-bar { display: block; width: 100%; min-height: 2.75rem; margin-top: 0.5rem; padding: 0 1rem; border: 0; border-radius: 999px; background: color-mix(in srgb, var(--vp-surface) 80%, transparent); color: var(--vp-text); font-size: 0.875rem; box-shadow: 0 1px 3px rgb(0 0 0 / 0.1); }
.vp-search-bar::placeholder { color: var(--vp-muted); }
.vp-home-spacer { flex: 1; min-height: 6rem; }
.vp-app-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); column-gap: 0.75rem; row-gap: 1.25rem; padding: 0 0.25rem 0.5rem; }
.vp-app { display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 0.375rem; min-width: 0; border-radius: 0.75rem; color: var(--vp-text); }
.vp-app-icon { display: flex; align-items: center; justify-content: center; aspect-ratio: 1; width: 100%; max-width: 4.25rem; border-radius: 18px; box-shadow: inset 0 1px rgb(255 255 255 / 0.35), 0 4px 10px rgb(0 0 0 / 0.12); transition: transform 120ms ease; }
.vp-app:active .vp-app-icon { transform: scale(0.96); }
.vp-app-icon--settings { background: color-mix(in srgb, #f59e0b 24%, var(--vp-surface)); color: color-mix(in srgb, #b45309 70%, var(--vp-text)); }
.vp-app-icon--app-store { background: color-mix(in srgb, #0ea5e9 24%, var(--vp-surface)); color: color-mix(in srgb, #0369a1 70%, var(--vp-text)); }
.vp-app-icon--goodle { background: color-mix(in srgb, #f43f5e 24%, var(--vp-surface)); color: color-mix(in srgb, #be123c 70%, var(--vp-text)); }
.vp-app-icon--default { background: var(--vp-surface); color: var(--vp-text); }
.vp-app-label { font-size: 0.625rem; }
.vp-app-slot { aspect-ratio: 1; width: 100%; max-width: 4.25rem; border-radius: 18px; border: 1px dashed color-mix(in srgb, var(--vp-muted) 25%, transparent); }

.vp-footer { flex-shrink: 0; padding: 0.75rem 1rem max(0.75rem, env(safe-area-inset-bottom)); border-top: 1px solid var(--vp-border); background: var(--vp-bg); }
.vp-putdown-btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; width: 100%; min-height: 2.75rem; padding: 0 1rem; border-radius: 999px; background: var(--vp-accent); color: #fff; font-size: 0.75rem; font-weight: 600; transition: opacity 120ms ease; }
.vp-putdown-btn:hover { opacity: 0.9; }

.vp-appview { position: absolute; inset: 0; z-index: 10; overflow-y: auto; background: var(--vp-bg); padding: 1.25rem; }
.vp-appview--loading { font-size: 0.75rem; }
.vp-app-header { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; min-height: 2.75rem; margin-bottom: 1.25rem; }
.vp-app-header h2 { flex: 1; min-width: 0; margin: 0; text-align: center; font-size: 0.875rem; font-weight: 600; }
.vp-app-title-spacer { width: 2.75rem; flex-shrink: 0; }
.vp-stack { display: grid; gap: 1rem; font-size: 0.75rem; }
.vp-section-label { margin: 0; font-size: 0.6875rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--vp-muted); }
.vp-section-label--spaced { padding-top: 0.75rem; }
.vp-field { display: grid; gap: 0.375rem; }
.vp-field > span { font-weight: 500; }
.vp-input, .vp-select { width: 100%; min-height: 2.75rem; padding: 0 0.75rem; border: 1px solid var(--vp-border); border-radius: 0.5rem; background: var(--vp-surface); color: var(--vp-text); font: inherit; }
.vp-check { display: flex; align-items: center; gap: 0.75rem; min-height: 2.75rem; font-weight: 500; }
.vp-check input { height: 1.25rem; width: 1.25rem; accent-color: var(--vp-accent); }
.vp-range { width: 100%; min-height: 2.75rem; accent-color: var(--vp-accent); }
.vp-surface-btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; width: 100%; min-height: 2.75rem; padding: 0 1rem; border: 1px solid var(--vp-border); border-radius: 0.5rem; background: var(--vp-surface); font-weight: 600; }
.vp-accent-btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.375rem; min-height: 2.25rem; padding: 0 0.75rem; border-radius: 0.5rem; background: var(--vp-accent); color: #fff; font-size: 0.6875rem; font-weight: 600; }
.vp-card { border: 1px solid var(--vp-border); border-radius: 0.75rem; background: var(--vp-surface); padding: 0.75rem; }
.vp-card-row { display: flex; align-items: center; gap: 0.75rem; min-height: 5rem; }
.vp-card-icon { display: inline-flex; align-items: center; justify-content: center; height: 2.5rem; width: 2.5rem; flex-shrink: 0; border-radius: 0.5rem; }
.vp-card-body { flex: 1; min-width: 0; }
.vp-card-body h3 { margin: 0; font-size: 0.75rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vp-card-body p { margin: 0.25rem 0 0; font-size: 0.6875rem; color: var(--vp-muted); }
.vp-muted-note { font-size: 0.6875rem; font-weight: 500; color: var(--vp-muted); }
.vp-search-row { display: flex; gap: 0.5rem; }
.vp-search-row label { flex: 1; min-width: 0; }
.vp-result-list { list-style: none; margin: 1rem 0 0; padding: 0; display: grid; gap: 0.5rem; }
.vp-result-list li { border-radius: 0.5rem; background: var(--vp-surface); padding: 0.75rem; font-size: 0.75rem; }
.vp-result-title { margin: 1.25rem 0 0; font-size: 0.875rem; font-weight: 600; }
.vp-result-summary { margin: 0.5rem 0 0; font-size: 0.75rem; color: var(--vp-muted); }
.vp-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
`;
