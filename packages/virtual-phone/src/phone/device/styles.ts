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
.vp-root button:focus-visible, .vp-root input:focus-visible, .vp-root select:focus-visible, .vp-root textarea:focus-visible { outline: 2px solid var(--vp-accent); outline-offset: 2px; }
.vp-root button:disabled { opacity: 0.35; cursor: default; }
.vp-scrim { position: absolute; inset: 0; background: rgb(0 0 0 / 0.4); }
.vp-stage { position: absolute; inset: 0; display: flex; align-items: center; justify-content: flex-end; padding: 0.75rem; }
@media (min-width: 640px) { .vp-stage { padding: 1.5rem; } }
.vp-stage-col { display: flex; flex-direction: column; align-items: stretch; gap: 0.625rem; }

.vp-shell { position: relative; display: flex; flex-direction: column; width: min(calc(100vw - 1.5rem), calc((100dvh - 5rem) * 9 / 19.5), 396px); aspect-ratio: 9 / 19.5; padding: 5px; border-radius: 48px; background: linear-gradient(160deg, color-mix(in srgb, var(--vp-bezel) 82%, #7c8494) 0%, var(--vp-bezel) 22%, var(--vp-bezel) 78%, color-mix(in srgb, var(--vp-bezel) 88%, #7c8494) 100%); box-shadow: 0 32px 90px rgb(0 0 0 / 0.45), 0 8px 24px rgb(0 0 0 / 0.3), inset 0 0 0 1.5px rgb(255 255 255 / 0.16), inset 0 0 0 3px rgb(0 0 0 / 0.4); }
@media (min-width: 640px) { .vp-shell { width: min(calc(100vw - 3rem), calc(82dvh * 9 / 19.5), 396px); } }
.vp-key { pointer-events: none; position: absolute; width: 4px; background: linear-gradient(90deg, color-mix(in srgb, var(--vp-bezel) 70%, #8a93a5), var(--vp-bezel)); }
.vp-key--volume { left: -4px; top: 6rem; height: 3rem; border-radius: 4px 0 0 4px; box-shadow: 0 4.5rem 0 var(--vp-bezel); }
.vp-key--power { right: -4px; top: 8rem; height: 5rem; border-radius: 0 4px 4px 0; background: linear-gradient(270deg, color-mix(in srgb, var(--vp-bezel) 70%, #8a93a5), var(--vp-bezel)); }

.vp-dock { display: flex; gap: 0.5rem; }
.vp-dock-btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.375rem; flex: 1; min-width: 0; min-height: 2.5rem; padding: 0 0.625rem; border-radius: 999px; background: linear-gradient(180deg, #262a31, #16181d); color: #fff; font-size: 0.6875rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; box-shadow: 0 8px 20px rgb(0 0 0 / 0.35), inset 0 1px 0 rgb(255 255 255 / 0.12), inset 0 0 0 1px rgb(255 255 255 / 0.07); transition: filter 140ms ease, transform 120ms ease; }
.vp-dock-btn:hover:not(:disabled) { filter: brightness(1.2); }
.vp-dock-btn:active:not(:disabled) { transform: scale(0.97); }

.vp-screen { position: relative; display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; border-radius: 43px; background: var(--vp-bg); color: var(--vp-text); }
.vp-statusbar { position: relative; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 0.5rem; min-height: 2.5rem; flex-shrink: 0; padding: 0.375rem 1.125rem 0; font-size: 0.75rem; font-weight: 600; letter-spacing: 0.01em; font-variant-numeric: tabular-nums; }
.vp-statusbar-cluster { display: inline-flex; align-items: center; gap: 0.3125rem; min-width: 0; }
.vp-statusbar-clock { justify-self: start; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vp-statusbar-end { display: flex; align-items: center; justify-content: flex-end; gap: 0.375rem; min-width: 0; }
.vp-switch-btn { justify-self: center; display: inline-flex; align-items: center; gap: 0.25rem; min-height: 1.75rem; max-width: 9rem; padding: 0 0.625rem; border-radius: 999px; background: color-mix(in srgb, var(--vp-text) 7%, transparent); transition: background 140ms ease; }
.vp-switch-btn:hover { background: color-mix(in srgb, var(--vp-text) 12%, transparent); }
.vp-switch-btn > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vp-switcher { position: absolute; left: 50%; translate: -50% 0; top: 2.75rem; z-index: 20; width: 13rem; max-width: calc(100% - 1.75rem); display: grid; gap: 0.125rem; padding: 0.375rem; border-radius: 1.125rem; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 96%, #ffffff), var(--vp-surface)); color: var(--vp-text); box-shadow: 0 1px 2px rgb(0 0 0 / 0.1), 0 20px 48px rgb(0 0 0 / 0.3), inset 0 0 0 1px var(--vp-border); transform-origin: top center; animation: vp-pop 160ms cubic-bezier(0.2, 0.9, 0.3, 1.2); }
@keyframes vp-pop { from { opacity: 0; transform: scale(0.92) translateY(-4px); } }
.vp-switcher-option { display: flex; align-items: center; min-height: 2.75rem; padding: 0 0.875rem; border-radius: 0.875rem; font-size: 0.8125rem; font-weight: 500; text-align: left; transition: background 120ms ease; }
.vp-switcher-option:hover { background: color-mix(in srgb, var(--vp-text) 7%, transparent); }
.vp-switcher-option[aria-selected="true"] { color: var(--vp-accent); }
.vp-switcher-option span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.vp-surface-area { position: relative; display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; }
.vp-home-indicator { position: absolute; bottom: 0.375rem; left: 50%; translate: -50% 0; z-index: 30; height: 4px; width: 6.5rem; border-radius: 999px; background: color-mix(in srgb, var(--vp-text) 35%, transparent); opacity: 0.55; pointer-events: none; }
.vp-lock { display: flex; flex-direction: column; flex: 1; min-height: 0; align-items: center; justify-content: center; gap: 1.5rem; padding: 1.5rem; text-align: center; }
.vp-lock-clock { font-size: 3.5rem; font-weight: 250; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; line-height: 1.05; margin: 0; text-shadow: 0 1px 12px rgb(0 0 0 / 0.08); }
.vp-lock-date { margin: 0.375rem 0 0; font-size: 0.8125rem; font-weight: 500; color: var(--vp-muted); }
.vp-lock-card { width: 100%; min-height: 5rem; display: flex; align-items: center; justify-content: center; padding: 1rem; border-radius: 1.375rem; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 97%, #ffffff), var(--vp-surface)); font-size: 0.75rem; font-weight: 500; color: var(--vp-muted); box-shadow: 0 1px 2px rgb(0 0 0 / 0.06), 0 8px 24px rgb(0 0 0 / 0.1), inset 0 0 0 1px var(--vp-border); }
.vp-lock-list { display: grid; gap: 0.5rem; width: 100%; }
.vp-lock-card--notification { display: grid; gap: 0.125rem; justify-items: start; min-height: 0; width: 100%; text-align: left; cursor: pointer; transition: transform 120ms ease; }
.vp-lock-card--notification:active { transform: scale(0.98); }
.vp-unlock-btn { min-height: 2.875rem; padding: 0 1.75rem; border-radius: 999px; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-accent) 90%, #ffffff), var(--vp-accent)); color: #fff; font-size: 0.8125rem; font-weight: 600; box-shadow: 0 1px 2px rgb(0 0 0 / 0.15), 0 6px 16px color-mix(in srgb, var(--vp-accent) 40%, transparent), inset 0 1px 0 rgb(255 255 255 / 0.25); transition: transform 120ms ease, box-shadow 120ms ease; }
.vp-unlock-btn:active { transform: scale(0.97); }

.vp-home { display: flex; flex-direction: column; flex: 1; min-height: 0; padding: 1.25rem 1.25rem 1.5rem; }
.vp-home-top { display: flex; align-items: center; gap: 0.5rem; }
.vp-home-top .vp-search-bar { margin-top: 0; }
.vp-dockrow { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.75rem; margin-top: 1rem; padding: 0.625rem 0.75rem; border-radius: 1.875rem; background: color-mix(in srgb, var(--vp-surface) 55%, transparent); box-shadow: inset 0 0 0 1px var(--vp-border), 0 4px 14px rgb(0 0 0 / 0.08); }
.vp-icon-btn { display: inline-flex; align-items: center; justify-content: center; height: 2.75rem; width: 2.75rem; flex-shrink: 0; border-radius: 999px; transition: background 140ms ease, transform 120ms ease; }
.vp-icon-btn:hover { background: color-mix(in srgb, var(--vp-text) 7%, transparent); }
.vp-icon-btn:active { transform: scale(0.94); }
.vp-icon-btn--surface { background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 97%, #ffffff), var(--vp-surface)); box-shadow: 0 1px 2px rgb(0 0 0 / 0.08), 0 4px 12px rgb(0 0 0 / 0.1), inset 0 0 0 1px var(--vp-border); }
.vp-icon-btn--surface:hover { background: var(--vp-surface); }
.vp-search-bar { display: block; width: 100%; min-height: 2.875rem; margin-top: 0.5rem; padding: 0 1.125rem; border: 0; border-radius: 999px; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 97%, #ffffff), var(--vp-surface)); color: var(--vp-text); font-size: 0.9375rem; box-shadow: 0 1px 2px rgb(0 0 0 / 0.07), 0 5px 14px rgb(0 0 0 / 0.09), inset 0 0 0 1px var(--vp-border); }
.vp-search-bar::placeholder { color: var(--vp-muted); }
.vp-home-spacer { flex: 1; min-height: 6rem; }
.vp-app-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); column-gap: 0.75rem; row-gap: 1.125rem; padding: 0 0.25rem 0.75rem; }
.vp-app { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 0.4375rem; min-width: 0; border-radius: 0.75rem; color: var(--vp-text); }
.vp-app-badge { position: absolute; top: -0.375rem; right: 4%; z-index: 1; }
.vp-app-icon { display: flex; align-items: center; justify-content: center; aspect-ratio: 1; width: 100%; max-width: 4.25rem; border-radius: 32%; color: #fff; box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.3), inset 0 -1px 0 rgb(0 0 0 / 0.15), 0 5px 12px rgb(0 0 0 / 0.18); transition: transform 140ms cubic-bezier(0.2, 0.9, 0.3, 1.4), filter 140ms ease; }
.vp-app:hover .vp-app-icon { filter: brightness(1.06); }
.vp-app:active .vp-app-icon { transform: scale(0.92); }
.vp-app-icon--settings { background: linear-gradient(180deg, #8e97a6 0%, #5c6470 100%); }
.vp-app-icon--app-store { background: linear-gradient(180deg, #34aefc 0%, #0b6ded 100%); }
.vp-app-icon--goodle { background: linear-gradient(180deg, #ff7a59 0%, #e6343f 100%); }
.vp-app-icon--messages { background: linear-gradient(180deg, #5ce872 0%, #1eb944 100%); }
.vp-app-icon--notes { background: linear-gradient(180deg, #ffd75e 0%, #f5a623 100%); }
.vp-app-icon--noodler { background: linear-gradient(180deg, #b48cff 0%, #7a3ff2 100%); }
.vp-app-icon--default { background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 92%, #ffffff), var(--vp-surface)); color: var(--vp-text); }
.vp-app-label { font-size: 0.6875rem; font-weight: 500; letter-spacing: 0.01em; text-shadow: 0 1px 4px rgb(0 0 0 / 0.1); }
.vp-app-slot { aspect-ratio: 1; width: 100%; max-width: 4.25rem; border-radius: 32%; box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--vp-muted) 22%, transparent), inset 0 2px 6px rgb(0 0 0 / 0.05); }

.vp-appview { position: absolute; inset: 0; z-index: 10; overflow-y: auto; background: var(--vp-bg); padding: 1.125rem 1.125rem 1.75rem; animation: vp-app-in 200ms cubic-bezier(0.2, 0.9, 0.3, 1); }
@keyframes vp-app-in { from { opacity: 0; transform: scale(0.96) translateY(8px); } }
.vp-appview--loading { font-size: 0.75rem; }
.vp-app-header { position: sticky; top: -1.125rem; z-index: 5; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; min-height: 3rem; margin: -1.125rem -1.125rem 1rem; padding: 0.25rem 0.625rem; border-bottom: 1px solid var(--vp-border); background: var(--vp-bg); }
.vp-app-header h2 { flex: 1; min-width: 0; margin: 0; text-align: center; font-size: 1.0625rem; font-weight: 650; letter-spacing: -0.01em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vp-app-header-actions { display: flex; align-items: center; gap: 0.125rem; flex-shrink: 0; }
.vp-app-error { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; text-align: center; font-size: 0.8125rem; font-weight: 500; }
.vp-app-error .vp-surface-btn { width: auto; padding: 0 1.5rem; }
.vp-app-title-spacer { width: 2.75rem; flex-shrink: 0; }
.vp-stack { display: grid; gap: 0.875rem; font-size: 0.8125rem; }
.vp-section-label { margin: 0 0 -0.375rem; padding-left: 1rem; font-size: 0.6875rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--vp-muted); }
.vp-section-label--spaced { padding-top: 0.875rem; }
.vp-field { display: grid; gap: 0.375rem; }
.vp-field > span { padding-left: 0.25rem; font-weight: 500; }
.vp-input, .vp-select { width: 100%; min-height: 2.875rem; padding: 0 0.875rem; border: 0; border-radius: 0.875rem; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 97%, #ffffff), var(--vp-surface)); color: var(--vp-text); font: inherit; box-shadow: 0 1px 2px rgb(0 0 0 / 0.05), inset 0 0 0 1px var(--vp-border); }
.vp-textarea { width: 100%; min-height: 14rem; padding: 0.875rem; border: 0; border-radius: 1.125rem; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 97%, #ffffff), var(--vp-surface)); color: var(--vp-text); font: inherit; font-size: 0.8125rem; line-height: 1.5; resize: vertical; box-shadow: 0 1px 2px rgb(0 0 0 / 0.05), inset 0 0 0 1px var(--vp-border); }
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
.vp-chip-row { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.875rem; }
.vp-chip { display: inline-flex; align-items: center; max-width: 100%; min-height: 2.125rem; padding: 0 0.875rem; border-radius: 999px; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 97%, #ffffff), var(--vp-surface)); font-size: 0.75rem; font-weight: 500; box-shadow: 0 1px 2px rgb(0 0 0 / 0.06), inset 0 0 0 1px var(--vp-border); transition: transform 120ms ease; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vp-chip:active { transform: scale(0.96); }
.vp-result-list { list-style: none; margin: 1rem 0 0; padding: 0; display: grid; gap: 0.5rem; }
.vp-result-card { display: grid; gap: 0.1875rem; width: 100%; text-align: left; padding: 0.75rem 0.875rem; border-radius: 0.875rem; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 97%, #ffffff), var(--vp-surface)); box-shadow: 0 1px 2px rgb(0 0 0 / 0.05), inset 0 0 0 1px var(--vp-border); transition: transform 120ms ease; }
.vp-result-card:active { transform: scale(0.98); }
.vp-result-link { font-size: 0.8125rem; font-weight: 600; color: var(--vp-accent); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vp-result-url { font-size: 0.625rem; color: var(--vp-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vp-result-snippet { font-size: 0.6875rem; line-height: 1.4; }
.vp-result-title { margin: 1.25rem 0 0; font-size: 0.9375rem; font-weight: 650; letter-spacing: -0.01em; }
.vp-result-summary { margin: 0.5rem 0 0; font-size: 0.8125rem; color: var(--vp-muted); }
.vp-page-url { display: flex; align-items: center; gap: 0.5rem; min-height: 2.25rem; padding: 0 0.875rem; margin-bottom: 0.875rem; border-radius: 999px; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 97%, #ffffff), var(--vp-surface)); font-size: 0.6875rem; color: var(--vp-muted); box-shadow: 0 1px 2px rgb(0 0 0 / 0.05), inset 0 0 0 1px var(--vp-border); }
.vp-page-url span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vp-page-heading { margin: 0 0 0.625rem; font-size: 1rem; font-weight: 650; letter-spacing: -0.01em; }
.vp-page-body p { margin: 0 0 0.75rem; font-size: 0.8125rem; line-height: 1.55; overflow-wrap: anywhere; }

.vp-thread-row { display: flex; align-items: center; gap: 0.75rem; width: 100%; min-height: 3.75rem; padding: 0.625rem 0.875rem; border-radius: 1.125rem; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 97%, #ffffff), var(--vp-surface)); text-align: left; box-shadow: 0 1px 2px rgb(0 0 0 / 0.05), 0 4px 12px rgb(0 0 0 / 0.06), inset 0 0 0 1px var(--vp-border); transition: transform 120ms ease; }
.vp-thread-row:active { transform: scale(0.98); }
.vp-thread-avatar { display: inline-flex; align-items: center; justify-content: center; height: 2.5rem; width: 2.5rem; flex-shrink: 0; border-radius: 999px; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-accent) 85%, #ffffff), var(--vp-accent)); color: #fff; font-size: 0.75rem; font-weight: 650; box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.3), 0 2px 6px rgb(0 0 0 / 0.15); }
.vp-thread-body { display: grid; gap: 0.125rem; flex: 1; min-width: 0; }
.vp-thread-name { font-size: 0.8125rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vp-thread-preview { font-size: 0.6875rem; color: var(--vp-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vp-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 1.25rem; height: 1.25rem; padding: 0 0.375rem; flex-shrink: 0; border-radius: 999px; background: #ff3b30; color: #fff; font-size: 0.625rem; font-weight: 700; box-shadow: 0 1px 3px rgb(0 0 0 / 0.25); }
.vp-thread-view { display: flex; flex-direction: column; min-height: calc(100% - 3.75rem); }
.vp-bubbles { display: flex; flex-direction: column; gap: 0.375rem; flex: 1; overflow-y: auto; padding-bottom: 0.875rem; }
.vp-bubble { width: fit-content; max-width: 78%; padding: 0.5rem 0.75rem; border-radius: 1.125rem; font-size: 0.8125rem; line-height: 1.35; overflow-wrap: anywhere; }
.vp-bubble--self { align-self: flex-end; border-bottom-right-radius: 0.375rem; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-accent) 88%, #ffffff), var(--vp-accent)); color: #fff; box-shadow: 0 1px 2px rgb(0 0 0 / 0.12), inset 0 1px 0 rgb(255 255 255 / 0.2); }
.vp-bubble--other { align-self: flex-start; border-bottom-left-radius: 0.375rem; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 96%, #ffffff), var(--vp-surface)); box-shadow: 0 1px 2px rgb(0 0 0 / 0.07), inset 0 0 0 1px var(--vp-border); }
.vp-bubble-time { display: block; margin-top: 0.125rem; font-size: 0.5625rem; opacity: 0.7; }
.vp-composer { display: flex; align-items: center; gap: 0.5rem; }
.vp-post { display: grid; gap: 0.375rem; }
.vp-post-header { display: flex; align-items: center; gap: 0.5rem; }
.vp-post-avatar { display: inline-flex; align-items: center; justify-content: center; height: 2rem; width: 2rem; flex-shrink: 0; border-radius: 999px; background: linear-gradient(180deg, #b48cff, #7a3ff2); color: #fff; font-size: 0.6875rem; font-weight: 700; box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.3); }
.vp-post-names { display: flex; align-items: baseline; gap: 0.375rem; min-width: 0; overflow: hidden; }
.vp-post-author { font-size: 0.75rem; font-weight: 650; white-space: nowrap; }
.vp-post-handle { font-size: 0.6875rem; font-weight: 500; color: var(--vp-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vp-post-text { margin: 0; font-size: 0.8125rem; line-height: 1.4; overflow-wrap: anywhere; }
.vp-post-footer { display: flex; gap: 1.25rem; align-items: center; font-size: 0.625rem; font-weight: 600; color: var(--vp-muted); }
.vp-post-footer span { display: inline-flex; align-items: center; gap: 0.25rem; }

.vp-goodle-logo { display: flex; justify-content: center; gap: 1px; margin: 1.75rem 0 1.25rem; font-size: 2.375rem; font-weight: 700; letter-spacing: -0.02em; text-shadow: 0 1px 2px rgb(0 0 0 / 0.08); }
.vp-site-masthead { display: grid; gap: 0.25rem; padding: 1.25rem 1rem; border-radius: 1.125rem 1.125rem 0 0; color: #fff; box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.15); }
.vp-site-name { font-size: 1.125rem; font-weight: 700; letter-spacing: -0.01em; }
.vp-site-tagline { font-size: 0.6875rem; font-weight: 500; opacity: 0.85; }
.vp-site-nav { display: flex; gap: 0.375rem; overflow-x: auto; padding: 0.5rem; margin-bottom: 1rem; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 97%, #ffffff), var(--vp-surface)); border-radius: 0 0 1.125rem 1.125rem; box-shadow: 0 1px 2px rgb(0 0 0 / 0.05), inset 0 0 0 1px var(--vp-border); }
.vp-site-nav-btn { flex-shrink: 0; min-height: 1.875rem; padding: 0 0.75rem; border-radius: 999px; font-size: 0.6875rem; font-weight: 600; background: color-mix(in srgb, var(--vp-text) 6%, transparent); transition: background 120ms ease; }
.vp-site-nav-btn:hover { background: color-mix(in srgb, var(--vp-text) 11%, transparent); }
.vp-site-section { margin-bottom: 0.875rem; }
.vp-site-section h4 { margin: 0 0 0.25rem; font-size: 0.8125rem; font-weight: 650; }
.vp-site-section p { margin: 0; font-size: 0.75rem; line-height: 1.5; overflow-wrap: anywhere; }
.vp-site-section--post { padding: 0.75rem 0.875rem; border-radius: 0.875rem; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 97%, #ffffff), var(--vp-surface)); box-shadow: 0 1px 2px rgb(0 0 0 / 0.05), inset 0 0 0 1px var(--vp-border); }
.vp-site-section--post h4 { color: var(--vp-accent); }
.vp-site-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.5rem; }
.vp-site-card { display: grid; gap: 0.25rem; padding: 0.75rem; border-radius: 0.875rem; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 97%, #ffffff), var(--vp-surface)); box-shadow: 0 1px 2px rgb(0 0 0 / 0.05), inset 0 0 0 1px var(--vp-border); }
.vp-site-card h4 { margin: 0; font-size: 0.75rem; font-weight: 650; }
.vp-site-card p { margin: 0; font-size: 0.6875rem; line-height: 1.4; color: var(--vp-muted); overflow-wrap: anywhere; }

.vp-skeleton { display: block; border-radius: 999px; background: color-mix(in srgb, var(--vp-text) 10%, transparent); animation: vp-pulse 1.2s ease-in-out infinite; }
.vp-skeleton--line { height: 0.625rem; margin: 0.1875rem 0; }
.vp-skeleton--avatar { height: 2.5rem; width: 2.5rem; border-radius: 999px; flex-shrink: 0; }
.vp-skeleton--block { height: 4.25rem; border-radius: 1.125rem; }
@keyframes vp-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
@media (prefers-reduced-motion: reduce) { .vp-appview, .vp-switcher, .vp-skeleton { animation: none; } }
.vp-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
`;
