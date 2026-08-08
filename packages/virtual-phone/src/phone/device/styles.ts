// The Engine compiles Tailwind from its own sources only, so a runtime-loaded
// capability cannot rely on Tailwind classes. The phone ships its own scoped CSS.
//
// Visual language: iOS-leaning hybrid (iOS structure and typography, Material
// press states and elevation). Depth comes from layered shadows, hairlines,
// and subtle surface gradients — no translucent "glass" materials.
export const phoneStylesheet = `
.vp-root { position: fixed; inset: 0; z-index: 10020; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", Roboto, system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
.vp-root *, .vp-root *::before, .vp-root *::after { box-sizing: border-box; }
.vp-root :where(button) { font: inherit; color: inherit; background: none; border: 0; padding: 0; margin: 0; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.vp-root button:focus-visible, .vp-root input:focus-visible, .vp-root select:focus-visible, .vp-root textarea:focus-visible { outline: 2px solid var(--vp-accent); outline-offset: 2px; }
.vp-root button:disabled { opacity: 0.35; cursor: default; }
.vp-scrim { position: absolute; inset: 0; background: rgb(0 0 0 / 0.45); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); }
.vp-stage { position: absolute; inset: 0; display: flex; align-items: center; justify-content: flex-end; padding: 0.75rem; }
@media (min-width: 640px) { .vp-stage { padding: 1.5rem; } }
.vp-stage-col { display: flex; flex-direction: column; align-items: stretch; gap: 0.5rem; }
.vp-slide-up { animation: vp-slide-up 280ms cubic-bezier(0.2, 0.9, 0.3, 1); }
.vp-slide-down { animation: vp-slide-down 280ms cubic-bezier(0.2, 0.9, 0.3, 1); }
@keyframes vp-slide-up { from { opacity: 0; transform: translateY(32px); } }
@keyframes vp-slide-down { from { opacity: 0; transform: translateY(-32px); } }

.vp-shell { position: relative; display: flex; flex-direction: column; width: min(calc(100vw - 1.5rem), calc((100dvh - 5rem) * 9 / 19.5), 396px); aspect-ratio: 9 / 19.5; padding: 5px; border-radius: 48px; background: linear-gradient(160deg, color-mix(in srgb, var(--vp-bezel) 82%, #7c8494) 0%, var(--vp-bezel) 22%, var(--vp-bezel) 78%, color-mix(in srgb, var(--vp-bezel) 88%, #7c8494) 100%); box-shadow: 0 32px 90px rgb(0 0 0 / 0.45), 0 8px 24px rgb(0 0 0 / 0.3), inset 0 0 0 1.5px rgb(255 255 255 / 0.16), inset 0 0 0 3px rgb(0 0 0 / 0.4); }
@media (min-width: 640px) { .vp-shell { width: min(calc(100vw - 3rem), calc(82dvh * 9 / 19.5), 396px); } }
.vp-key { pointer-events: none; position: absolute; width: 4px; background: linear-gradient(90deg, color-mix(in srgb, var(--vp-bezel) 70%, #8a93a5), var(--vp-bezel)); }
.vp-key--volume { left: -4px; top: 6rem; height: 3rem; border-radius: 4px 0 0 4px; box-shadow: 0 4.5rem 0 var(--vp-bezel); }
.vp-key--power { right: -4px; top: 8rem; height: 5rem; border-radius: 0 4px 4px 0; background: linear-gradient(270deg, color-mix(in srgb, var(--vp-bezel) 70%, #8a93a5), var(--vp-bezel)); }

.vp-dock { display: flex; gap: 0.5rem; padding: 0.375rem; border-radius: 999px; background: #101318; box-shadow: 0 12px 32px rgb(0 0 0 / 0.5), inset 0 0 0 1px rgb(255 255 255 / 0.1); }
.vp-dock-btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.375rem; flex: 1; min-width: 0; min-height: 2.375rem; padding: 0 0.625rem; border-radius: 999px; background: #23272e; color: #fff; font-size: 0.6875rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.1); transition: filter 140ms ease, transform 120ms ease; }
.vp-dock-btn--primary { background: var(--vp-accent); box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.25), 0 2px 8px rgb(0 0 0 / 0.3); }
.vp-dock-btn:hover:not(:disabled) { filter: brightness(1.15); }
.vp-dock-btn:active:not(:disabled) { transform: scale(0.97); }

.vp-screen { position: relative; display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; border-radius: 43px; background: var(--vp-bg); color: var(--vp-text); }
.vp-statusbar { position: relative; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 0.5rem; min-height: 2.25rem; flex-shrink: 0; padding: 0.375rem 1rem 0; font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.01em; font-variant-numeric: tabular-nums; }
.vp-statusbar-cluster { display: inline-flex; align-items: center; gap: 0.3125rem; min-width: 0; }
.vp-statusbar-clock { justify-self: start; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vp-statusbar-end { display: flex; align-items: center; justify-content: flex-end; gap: 0.375rem; min-width: 0; }
.vp-statusbar-notice { display: inline-flex; align-items: center; padding: 0; border: 0; background: none; cursor: pointer; }
.vp-inline-link { display: inline; padding: 0; border: 0; background: none; font: inherit; color: var(--vp-accent); text-decoration: underline; text-underline-offset: 2px; cursor: pointer; }
.vp-urlbar-btn { display: inline-flex; align-items: center; justify-content: center; min-width: 1.25rem; height: 1.25rem; padding: 0; border: 0; border-radius: 0.375rem; background: none; color: inherit; cursor: pointer; }
.vp-urlbar-btn:disabled { opacity: 0.35; cursor: default; }
.vp-switch-btn { justify-self: center; display: inline-flex; align-items: center; gap: 0.1875rem; min-height: 1.5rem; max-width: 6rem; padding: 0 0.5rem; border-radius: 999px; font-size: 0.625rem; background: color-mix(in srgb, var(--vp-text) 8%, var(--vp-bg)); transition: background 140ms ease; }
.vp-switch-btn:hover { background: color-mix(in srgb, var(--vp-text) 13%, var(--vp-bg)); }
.vp-switch-btn > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vp-switcher { position: absolute; left: 50%; translate: -50% 0; top: 2.5rem; z-index: 20; width: 12rem; max-width: calc(100% - 1.75rem); display: grid; gap: 0.125rem; padding: 0.3125rem; border-radius: 1rem; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 96%, #ffffff), var(--vp-surface)); color: var(--vp-text); box-shadow: 0 1px 2px rgb(0 0 0 / 0.1), 0 20px 48px rgb(0 0 0 / 0.3), inset 0 0 0 1px var(--vp-border); transform-origin: top center; animation: vp-pop 160ms cubic-bezier(0.2, 0.9, 0.3, 1.2); }
@keyframes vp-pop { from { opacity: 0; transform: scale(0.92) translateY(-4px); } }
.vp-switcher-option { display: flex; align-items: center; min-height: 2.5rem; padding: 0 0.75rem; border-radius: 0.75rem; font-size: 0.75rem; font-weight: 500; text-align: left; transition: background 120ms ease; }
.vp-switcher-option:hover { background: color-mix(in srgb, var(--vp-text) 7%, var(--vp-surface)); }
.vp-switcher-option[aria-selected="true"] { color: var(--vp-accent); }
.vp-switcher-option span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.vp-surface-area { position: relative; display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; }
.vp-home-indicator { position: absolute; bottom: 0.375rem; left: 50%; translate: -50% 0; z-index: 30; height: 4px; width: 6.5rem; border-radius: 999px; background: color-mix(in srgb, var(--vp-text) 30%, var(--vp-bg)); pointer-events: none; }
.vp-lock { display: flex; flex-direction: column; flex: 1; min-height: 0; align-items: center; gap: 1.125rem; padding: 2rem 0.875rem 1.5rem; text-align: center; }
.vp-lock > div:first-child { margin-bottom: 0.75rem; }
.vp-lock .vp-lock-card, .vp-lock .vp-lock-list { margin-top: 0.5rem; }
.vp-lock .vp-unlock-btn { margin-top: auto; }
.vp-lock-clock { font-size: 3.25rem; font-weight: 250; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; line-height: 1.05; margin: 0; text-shadow: 0 1px 12px rgb(0 0 0 / 0.08); }
.vp-lock-date { margin: 0.375rem 0 0; font-size: 0.8125rem; font-weight: 500; color: var(--vp-muted); }
.vp-lock-device { margin: 0.25rem 0 0; font-size: 0.625rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--vp-muted); }
.vp-lock-card { width: 100%; min-height: 4.5rem; display: flex; align-items: center; justify-content: center; padding: 0.875rem; border-radius: 1.25rem; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 97%, #ffffff), var(--vp-surface)); font-size: 0.75rem; font-weight: 500; color: var(--vp-muted); box-shadow: 0 1px 2px rgb(0 0 0 / 0.06), 0 8px 24px rgb(0 0 0 / 0.1), inset 0 0 0 1px var(--vp-border); }
.vp-lock-list { display: grid; gap: 0.5rem; width: 100%; }
.vp-lock-card--notification { display: grid; gap: 0.125rem; justify-items: start; min-height: 0; width: 100%; text-align: left; cursor: pointer; transition: transform 120ms ease; }
.vp-lock-card--notification:active { transform: scale(0.98); }
.vp-unlock-btn { min-height: 2.875rem; padding: 0 2.5rem; border-radius: 999px; background: var(--vp-surface); color: var(--vp-text); font-size: 0.8125rem; font-weight: 600; box-shadow: 0 2px 10px rgb(0 0 0 / 0.3), inset 0 0 0 1px var(--vp-border); transition: transform 120ms ease; }
.vp-unlock-btn:active { transform: scale(0.97); }

.vp-home { display: flex; flex-direction: column; flex: 1; min-height: 0; padding: 1rem 0.75rem 1.375rem; }
.vp-home-top { display: flex; align-items: center; gap: 0.5rem; }
.vp-home-top .vp-search-bar { margin-top: 0; }
.vp-dockrow { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.625rem; margin-top: 0.875rem; padding: 0.5rem 0.625rem; border-radius: 1.625rem; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 97%, #ffffff), var(--vp-surface)); box-shadow: inset 0 0 0 1px var(--vp-border), 0 6px 18px rgb(0 0 0 / 0.1); }
.vp-icon-btn { display: inline-flex; align-items: center; justify-content: center; height: 2.5rem; width: 2.5rem; flex-shrink: 0; border-radius: 999px; transition: background 140ms ease, transform 120ms ease; }
.vp-icon-btn:hover { background: color-mix(in srgb, var(--vp-text) 8%, var(--vp-bg)); }
.vp-icon-btn:active { transform: scale(0.94); }
.vp-icon-btn--surface { background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 97%, #ffffff), var(--vp-surface)); box-shadow: 0 1px 2px rgb(0 0 0 / 0.08), 0 4px 12px rgb(0 0 0 / 0.1), inset 0 0 0 1px var(--vp-border); }
.vp-icon-btn--surface:hover { background: var(--vp-surface); }
.vp-search-bar { display: block; width: 100%; min-height: 2.75rem; margin-top: 0; padding: 0 2.75rem 0 1rem; border: 0; border-radius: 999px; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 97%, #ffffff), var(--vp-surface)); color: var(--vp-text); font-size: 0.875rem; box-shadow: 0 1px 2px rgb(0 0 0 / 0.07), 0 5px 14px rgb(0 0 0 / 0.09), inset 0 0 0 1px var(--vp-border); }
.vp-search-bar::placeholder { color: var(--vp-muted); }
.vp-home-spacer { flex: 1; min-height: 6rem; }
.vp-app-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); column-gap: 0.625rem; row-gap: 0.875rem; padding: 0 0.25rem 0.5rem; }
.vp-home-clock { margin: 1.25rem 0 0; padding-left: 0.25rem; font-size: 2.5rem; font-weight: 250; letter-spacing: -0.02em; line-height: 1; font-variant-numeric: tabular-nums; text-shadow: 0 1px 10px rgb(0 0 0 / 0.12); }
.vp-home-date { margin: 0.375rem 0 0; padding-left: 0.25rem; font-size: 0.75rem; font-weight: 500; color: var(--vp-muted); text-shadow: 0 1px 6px rgb(0 0 0 / 0.1); }
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
.vp-app-icon--contacts { background: linear-gradient(180deg, #4dd6c6 0%, #0f9b8e 100%); }
.vp-app-icon--mail { background: linear-gradient(180deg, #6fb6ff 0%, #1d6fd6 100%); }
.vp-app-icon--gallery { background: linear-gradient(180deg, #f78fb3 0%, #8e44ad 100%); }
.vp-app-icon--tindler { background: linear-gradient(180deg, #ff655b 0%, #fd297b 100%); }
.vp-app-icon--noodler-r { background: linear-gradient(180deg, #ff5fa2 0%, #1c0a14 100%); }
.vp-app-icon--camera { background: linear-gradient(180deg, #6b7280 0%, #1f2937 100%); }
.vp-app-icon--banking { background: linear-gradient(180deg, #10b981 0%, #065f46 100%); }
.vp-app-icon--marketplace { background: linear-gradient(180deg, #f59e0b 0%, #b45309 100%); }
/* Marketplace is a tile grid. The image slot is sized as if the photo were there, because one day
   it will be (Step 11.3) — an empty slot that reserves its space reads as designed, not broken. */
.vp-market-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
.vp-market-tile { display: flex; flex-direction: column; overflow: hidden; border-radius: 1rem; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 97%, #ffffff), var(--vp-surface)); box-shadow: 0 1px 2px rgb(0 0 0 / 0.06), 0 8px 20px rgb(0 0 0 / 0.1), inset 0 0 0 1px var(--vp-border); text-align: left; transition: transform 120ms ease; }
.vp-market-tile:active { transform: scale(0.97); }
.vp-market-photo { display: flex; align-items: center; justify-content: center; aspect-ratio: 1 / 1; width: 100%; background: repeating-linear-gradient(135deg, color-mix(in srgb, var(--vp-text) 5%, var(--vp-surface)) 0 10px, color-mix(in srgb, var(--vp-text) 8%, var(--vp-surface)) 10px 20px); color: color-mix(in srgb, var(--vp-text) 28%, transparent); font-size: 1.75rem; }
.vp-market-photo--hero { aspect-ratio: 4 / 3; border-radius: 1rem; font-size: 3.5rem; }
.vp-market-body { display: grid; gap: 0.125rem; padding: 0.5rem 0.625rem 0.75rem; }
.vp-market-title { font-size: 0.75rem; font-weight: 650; line-height: 1.3; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.vp-market-price { font-size: 0.8125rem; font-weight: 700; color: var(--vp-accent); }
.vp-market-seller { font-size: 0.625rem; color: var(--vp-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Banking leads with the balance on a card face, and the log reads as a ledger. */
.vp-bank-card { position: relative; overflow: hidden; display: grid; gap: 0.25rem; padding: 1.125rem 1.25rem 1.25rem; border-radius: 1.25rem; color: #fff; background: linear-gradient(140deg, #065f46 0%, #047857 45%, #0f766e 100%); box-shadow: 0 2px 6px rgb(0 0 0 / 0.12), 0 16px 40px rgb(0 0 0 / 0.22); }
.vp-bank-card::after { content: ""; position: absolute; inset: -40% -20% auto auto; width: 14rem; height: 14rem; border-radius: 999px; background: rgb(255 255 255 / 0.08); pointer-events: none; }
.vp-bank-label { font-size: 0.625rem; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.75; }
.vp-bank-balance { font-size: 2.125rem; font-weight: 300; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; line-height: 1.1; }
.vp-bank-owner { font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.06em; opacity: 0.85; }
.vp-ledger-row { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 0.5rem; padding: 0.625rem 0.75rem; border-radius: 0.75rem; background: var(--vp-surface); box-shadow: inset 0 0 0 1px var(--vp-border); }
.vp-ledger-what { display: grid; gap: 0.125rem; min-width: 0; }
.vp-ledger-desc { font-size: 0.75rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vp-ledger-meta { font-size: 0.625rem; color: var(--vp-muted); }
.vp-ledger-amount { font-size: 0.8125rem; font-weight: 700; font-variant-numeric: tabular-nums; }
.vp-ledger-amount--in { color: #10b981; }
.vp-ledger-amount--out { color: var(--vp-text); }
.vp-review-card { display: grid; gap: 0.5rem; padding: 0.75rem 0.875rem; border-radius: 1rem; background: var(--vp-surface); box-shadow: inset 0 0 0 1px var(--vp-accent); }
.vp-review-head { display: flex; align-items: baseline; justify-content: space-between; gap: 0.5rem; }
.vp-review-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
.vp-viewfinder { display: flex; align-items: center; justify-content: center; min-height: 11rem; padding: 1rem; border-radius: 1rem; background: linear-gradient(160deg, #14161a, #05070b); color: #e8ecf2; box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.1), inset 0 0 3rem rgb(0 0 0 / 0.6); }
.vp-viewfinder-text { margin: 0; font-size: 0.8125rem; line-height: 1.5; text-align: center; font-style: italic; }
.vp-shutter-row { display: flex; justify-content: center; margin-top: 0.875rem; }
.vp-shutter { height: 3.5rem; width: 3.5rem; border-radius: 999px; background: #fff; box-shadow: 0 2px 8px rgb(0 0 0 / 0.3), inset 0 0 0 3px rgb(0 0 0 / 0.15); transition: transform 120ms ease; }
.vp-shutter:active:not(:disabled) { transform: scale(0.9); }
.vp-polaroid { display: grid; gap: 0.375rem; }
.vp-polaroid p { margin: 0; font-size: 0.75rem; line-height: 1.5; font-style: italic; }
.vp-polaroid figcaption { font-size: 0.5625rem; font-weight: 500; color: var(--vp-muted); }
.vp-noodlerr-subrow { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }
.vp-noodlerr-locked { display: flex; align-items: center; justify-content: center; gap: 0.5rem; min-height: 4rem; font-size: 0.75rem; font-weight: 600; color: var(--vp-muted); border-style: dashed; box-shadow: inset 0 0 0 1.5px var(--vp-border); }
.vp-app-icon--default { background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 92%, #ffffff), var(--vp-surface)); color: var(--vp-text); }
.vp-app-label { font-size: 0.6875rem; font-weight: 500; letter-spacing: 0.01em; text-shadow: 0 1px 4px rgb(0 0 0 / 0.1); }

.vp-appview { position: absolute; inset: 0; z-index: 10; overflow-y: auto; background: var(--vp-bg); padding: 1rem 0.75rem 1.625rem; animation: vp-app-in 200ms cubic-bezier(0.2, 0.9, 0.3, 1); }
@keyframes vp-app-in { from { opacity: 0; transform: scale(0.96) translateY(8px); } }
.vp-appview--loading { font-size: 0.75rem; }
.vp-appview--fixed { display: flex; flex-direction: column; overflow: hidden; }
.vp-appview--fixed .vp-app-header { position: static; flex-shrink: 0; }
.vp-app-header { position: sticky; top: -1rem; z-index: 5; display: grid; grid-template-columns: minmax(2.5rem, 1fr) minmax(0, auto) minmax(2.5rem, 1fr); align-items: center; gap: 0.5rem; min-height: 2.75rem; margin: -1rem -0.75rem 0.875rem; padding: 0.25rem 0.375rem; border-bottom: 1px solid var(--vp-border); background: var(--vp-bg); }
.vp-app-header > .vp-icon-btn:first-child { justify-self: start; }
.vp-app-header-mid { display: flex; align-items: center; justify-content: center; min-width: 0; }
.vp-app-header h2 { min-width: 0; margin: 0; text-align: center; font-size: 1rem; font-weight: 650; letter-spacing: -0.01em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vp-app-header-actions { justify-self: end; }
.vp-app-header-actions { display: flex; align-items: center; gap: 0.125rem; flex-shrink: 0; }
.vp-app-error { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; text-align: center; font-size: 0.8125rem; font-weight: 500; }
.vp-app-error .vp-surface-btn { width: auto; padding: 0 1.5rem; }
.vp-app-title-spacer { width: 2.75rem; flex-shrink: 0; }
.vp-stack { display: grid; gap: 0.625rem; font-size: 0.8125rem; }
.vp-section-label { margin: 0 0 -0.25rem; padding-left: 0.875rem; font-size: 0.625rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--vp-muted); }
.vp-section-label--spaced { padding-top: 0.875rem; }
.vp-field { display: grid; gap: 0.375rem; }
.vp-field > span { padding-left: 0.25rem; font-weight: 500; }
.vp-input, .vp-select { width: 100%; min-height: 2.75rem; padding: 0 0.75rem; border: 0; border-radius: 0.75rem; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 97%, #ffffff), var(--vp-surface)); color: var(--vp-text); font: inherit; box-shadow: 0 1px 2px rgb(0 0 0 / 0.05), inset 0 0 0 1px var(--vp-border); }
.vp-textarea { width: 100%; min-height: 12rem; padding: 0.75rem; border: 0; border-radius: 1rem; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 97%, #ffffff), var(--vp-surface)); color: var(--vp-text); font: inherit; font-size: 0.8125rem; line-height: 1.5; resize: vertical; box-shadow: 0 1px 2px rgb(0 0 0 / 0.05), inset 0 0 0 1px var(--vp-border); }
.vp-check { display: flex; align-items: center; gap: 0.75rem; min-height: 2.875rem; padding: 0 0.875rem; border-radius: 0.875rem; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 97%, #ffffff), var(--vp-surface)); font-weight: 500; box-shadow: 0 1px 2px rgb(0 0 0 / 0.05), inset 0 0 0 1px var(--vp-border); }
.vp-check input { height: 1.25rem; width: 1.25rem; accent-color: var(--vp-accent); }
.vp-textarea--fill { flex: 1; min-height: 0; resize: none; }
.vp-group { border-radius: 1rem; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 97%, #ffffff), var(--vp-surface)); box-shadow: 0 1px 2px rgb(0 0 0 / 0.05), 0 4px 12px rgb(0 0 0 / 0.05), inset 0 0 0 1px var(--vp-border); overflow: hidden; }
.vp-group > * + * { border-top: 1px solid var(--vp-border); }
.vp-row { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; width: 100%; min-height: 2.75rem; padding: 0.375rem 0.75rem; font-size: 0.75rem; font-weight: 500; text-align: left; }
.vp-row > span:first-child { flex-shrink: 0; }
.vp-row-control { flex: 1; min-width: 0; max-width: 55%; min-height: 2.125rem; padding: 0 0.625rem; border: 0; border-radius: 0.625rem; background: color-mix(in srgb, var(--vp-text) 6%, var(--vp-surface)); color: var(--vp-text); font: inherit; font-size: 0.75rem; }
.vp-switch { appearance: none; width: 2.75rem; height: 1.6875rem; flex-shrink: 0; margin: 0; border-radius: 999px; background: color-mix(in srgb, var(--vp-text) 18%, var(--vp-bg)); position: relative; cursor: pointer; transition: background 160ms ease; box-shadow: inset 0 1px 2px rgb(0 0 0 / 0.08); }
.vp-switch::before { content: ""; position: absolute; top: 2px; left: 2px; height: calc(1.6875rem - 4px); aspect-ratio: 1; border-radius: 999px; background: #fff; box-shadow: 0 1px 3px rgb(0 0 0 / 0.25); transition: translate 160ms ease; }
.vp-switch:checked { background: #34c759; }
.vp-switch:checked::before { translate: 1.0625rem 0; }
.vp-row--stacked { flex-wrap: wrap; }
.vp-row--stacked .vp-range { width: 100%; min-height: 2.125rem; }
.vp-row--danger { justify-content: center; gap: 0.5rem; color: #ff3b30; font-weight: 600; transition: background 120ms ease; }
.vp-row--danger:hover { background: color-mix(in srgb, #ff3b30 7%, var(--vp-surface)); }
.vp-range { width: 100%; min-height: 2.875rem; accent-color: var(--vp-accent); }
.vp-surface-btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; width: 100%; min-height: 2.75rem; padding: 0 1rem; border: 0; border-radius: 0.75rem; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 97%, #ffffff), var(--vp-surface)); color: var(--vp-accent); font-weight: 600; box-shadow: 0 1px 2px rgb(0 0 0 / 0.06), inset 0 0 0 1px var(--vp-border); transition: transform 120ms ease; }
.vp-surface-btn:active { transform: scale(0.98); }
.vp-accent-btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.375rem; min-height: 2.125rem; padding: 0 1rem; border-radius: 999px; background: color-mix(in srgb, var(--vp-accent) 14%, var(--vp-surface)); color: var(--vp-accent); font-size: 0.75rem; font-weight: 650; transition: transform 120ms ease, filter 140ms ease; }
.vp-accent-btn:hover { filter: brightness(0.97); }
.vp-accent-btn:active { transform: scale(0.96); }
.vp-card { border-radius: 1rem; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 97%, #ffffff), var(--vp-surface)); padding: 0.75rem; box-shadow: 0 1px 2px rgb(0 0 0 / 0.05), 0 6px 16px rgb(0 0 0 / 0.07), inset 0 0 0 1px var(--vp-border); }
.vp-card-row { display: flex; align-items: center; gap: 0.75rem; min-height: 4.5rem; }
.vp-card-icon { display: inline-flex; align-items: center; justify-content: center; height: 2.75rem; width: 2.75rem; flex-shrink: 0; border-radius: 32%; color: #fff; box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.3), inset 0 -1px 0 rgb(0 0 0 / 0.15), 0 3px 8px rgb(0 0 0 / 0.15); }
.vp-card-body { flex: 1; min-width: 0; }
.vp-card-body h3 { margin: 0; font-size: 0.8125rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vp-card-body p { margin: 0.25rem 0 0; font-size: 0.6875rem; color: var(--vp-muted); }
.vp-muted-note { font-size: 0.6875rem; font-weight: 500; color: var(--vp-muted); }
.vp-search-row { display: flex; gap: 0.5rem; }
.vp-search-row label { flex: 1; min-width: 0; }
.vp-chip-row { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.875rem; }
.vp-chip { display: inline-flex; align-items: center; max-width: 100%; min-height: 1.875rem; padding: 0 0.75rem; border-radius: 999px; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 97%, #ffffff), var(--vp-surface)); font-size: 0.6875rem; font-weight: 500; box-shadow: 0 1px 2px rgb(0 0 0 / 0.06), inset 0 0 0 1px var(--vp-border); transition: transform 120ms ease; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vp-chip:active { transform: scale(0.96); }
.vp-chip--active { background: var(--vp-accent); color: #fff; box-shadow: none; }
.vp-post-image { display: block; width: 100%; margin-top: 0.5rem; border-radius: 0.75rem; }
.vp-result-list { list-style: none; margin: 0.875rem 0 0; padding: 0; display: grid; gap: 0.375rem; }
.vp-result-card { display: grid; gap: 0.125rem; width: 100%; text-align: left; padding: 0.625rem 0.75rem; border-radius: 0.75rem; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 97%, #ffffff), var(--vp-surface)); box-shadow: 0 1px 2px rgb(0 0 0 / 0.05), inset 0 0 0 1px var(--vp-border); transition: transform 120ms ease; }
.vp-result-card:active { transform: scale(0.98); }
.vp-result-link { font-size: 0.8125rem; font-weight: 600; color: var(--vp-accent); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vp-result-url { font-size: 0.625rem; color: var(--vp-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vp-result-snippet { font-size: 0.6875rem; line-height: 1.4; }
.vp-result-title { margin: 1.25rem 0 0; font-size: 0.9375rem; font-weight: 650; letter-spacing: -0.01em; }
.vp-result-summary { margin: 0.5rem 0 0; font-size: 0.8125rem; color: var(--vp-muted); }
.vp-page-url { display: flex; align-items: center; gap: 0.375rem; min-height: 2rem; padding: 0 0.75rem; margin-bottom: 0.75rem; border-radius: 999px; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 97%, #ffffff), var(--vp-surface)); font-size: 0.6875rem; color: var(--vp-muted); box-shadow: 0 1px 2px rgb(0 0 0 / 0.05), inset 0 0 0 1px var(--vp-border); }
.vp-page-url span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vp-page-heading { margin: 0 0 0.625rem; font-size: 1rem; font-weight: 650; letter-spacing: -0.01em; }
.vp-page-body p { margin: 0 0 0.75rem; font-size: 0.8125rem; line-height: 1.55; overflow-wrap: anywhere; }

.vp-thread-row { display: flex; align-items: center; gap: 0.625rem; width: 100%; min-height: 3.5rem; padding: 0.5rem 0.75rem; border-radius: 1rem; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 97%, #ffffff), var(--vp-surface)); text-align: left; box-shadow: 0 1px 2px rgb(0 0 0 / 0.05), 0 4px 12px rgb(0 0 0 / 0.06), inset 0 0 0 1px var(--vp-border); transition: transform 120ms ease; }
.vp-thread-row:active { transform: scale(0.98); }
.vp-thread-avatar { display: inline-flex; align-items: center; justify-content: center; height: 2.5rem; width: 2.5rem; flex-shrink: 0; border-radius: 999px; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-accent) 85%, #ffffff), var(--vp-accent)); color: #fff; font-size: 0.75rem; font-weight: 650; box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.3), 0 2px 6px rgb(0 0 0 / 0.15); }
.vp-thread-avatar { overflow: hidden; }
.vp-thread-avatar img { height: 100%; width: 100%; object-fit: cover; }
.vp-thread-body { display: grid; gap: 0.125rem; flex: 1; min-width: 0; }
.vp-thread-name { font-size: 0.8125rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vp-thread-preview { font-size: 0.6875rem; color: var(--vp-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vp-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 1.125rem; height: 1.125rem; padding: 0 0.3125rem; flex-shrink: 0; border-radius: 999px; background: #ff3b30; color: #fff; font-size: 0.625rem; font-weight: 700; box-shadow: 0 1px 3px rgb(0 0 0 / 0.25); }
.vp-thread-view { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.vp-thread-view .vp-composer { flex-shrink: 0; }
.vp-bubbles { display: flex; flex-direction: column; gap: 0.375rem; flex: 1; overflow-y: auto; padding-bottom: 0.875rem; }
.vp-bubble { width: fit-content; max-width: 78%; padding: 0.5rem 0.75rem; border-radius: 1.125rem; font-size: 0.8125rem; line-height: 1.35; overflow-wrap: anywhere; }
.vp-bubble--self { align-self: flex-end; border-bottom-right-radius: 0.375rem; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-accent) 88%, #ffffff), var(--vp-accent)); color: #fff; box-shadow: 0 1px 2px rgb(0 0 0 / 0.12), inset 0 1px 0 rgb(255 255 255 / 0.2); }
.vp-bubble--other { align-self: flex-start; border-bottom-left-radius: 0.375rem; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 96%, #ffffff), var(--vp-surface)); box-shadow: 0 1px 2px rgb(0 0 0 / 0.07), inset 0 0 0 1px var(--vp-border); }
.vp-bubble-time { display: block; margin-top: 0.125rem; font-size: 0.5625rem; opacity: 0.7; }
.vp-composer { display: flex; align-items: center; gap: 0.5rem; }
.vp-gallery-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.25rem; }
.vp-gallery-cell { aspect-ratio: 1; overflow: hidden; border-radius: 0.5rem; background: var(--vp-surface); box-shadow: inset 0 0 0 1px var(--vp-border); transition: transform 120ms ease; }
.vp-gallery-cell:active { transform: scale(0.96); }
.vp-gallery-cell img { display: block; height: 100%; width: 100%; object-fit: cover; }
.vp-gallery-skeleton { aspect-ratio: 1; border-radius: 0.5rem; }
.vp-photo-view { margin: 0; }
.vp-photo-view img { display: block; width: 100%; border-radius: 1.125rem; box-shadow: 0 4px 16px rgb(0 0 0 / 0.25); }
.vp-tab-content { flex: 1; min-height: 0; overflow-y: auto; padding-bottom: 0.875rem; }
.vp-tabbar { display: flex; flex-shrink: 0; gap: 0.25rem; padding: 0.3125rem; border-radius: 1rem; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 97%, #ffffff), var(--vp-surface)); box-shadow: 0 1px 2px rgb(0 0 0 / 0.06), inset 0 0 0 1px var(--vp-border); }
.vp-tabbar-btn { display: inline-flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.125rem; flex: 1; min-height: 2.5rem; border-radius: 0.75rem; font-size: 0.625rem; font-weight: 600; color: var(--vp-muted); transition: background 120ms ease, color 120ms ease; }
.vp-tabbar-btn[aria-current="true"] { color: var(--vp-accent); background: color-mix(in srgb, var(--vp-accent) 12%, var(--vp-surface)); }
.vp-trend-rank { display: inline-flex; align-items: center; justify-content: center; height: 2rem; width: 2rem; flex-shrink: 0; border-radius: 999px; background: color-mix(in srgb, var(--vp-text) 7%, var(--vp-surface)); font-size: 0.75rem; font-weight: 700; color: var(--vp-muted); }
.vp-tinder-card { border-radius: 1.25rem; overflow: hidden; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 97%, #ffffff), var(--vp-surface)); box-shadow: 0 2px 6px rgb(0 0 0 / 0.08), 0 12px 32px rgb(0 0 0 / 0.14), inset 0 0 0 1px var(--vp-border); }
.vp-tinder-photo { display: flex; align-items: center; justify-content: center; aspect-ratio: 4 / 5; max-height: 42dvh; width: 100%; color: #fff; font-size: 3rem; font-weight: 700; letter-spacing: 0.02em; text-shadow: 0 2px 12px rgb(0 0 0 / 0.25); }
.vp-tinder-photo-skeleton { display: block; aspect-ratio: 4 / 5; max-height: 42dvh; width: 100%; border-radius: 0; }
.vp-tinder-info { display: grid; gap: 0.25rem; padding: 0.875rem 1rem 1rem; }
.vp-tinder-info h3 { margin: 0; font-size: 1rem; font-weight: 650; letter-spacing: -0.01em; }
.vp-tinder-tagline { margin: 0; font-size: 0.75rem; font-weight: 600; color: var(--vp-accent); }
.vp-tinder-bio { margin: 0; font-size: 0.75rem; line-height: 1.45; color: var(--vp-muted); }
/* Tindler is a deck, not a list: the stack fills the app and the buttons sit under it. */
.vp-deck { position: relative; flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; margin: 0.25rem 0; }
.vp-deck-card { position: absolute; inset: 0; display: flex; flex-direction: column; will-change: transform; }
.vp-deck-card--top { z-index: 2; cursor: grab; user-select: none; }
.vp-deck-card--top:active { cursor: grabbing; }
.vp-deck-card .vp-tinder-photo { flex: 1; min-height: 0; aspect-ratio: auto; max-height: none; }
.vp-deck-stamp { position: absolute; top: 1.25rem; left: 1.25rem; padding: 0.25rem 0.625rem; border-radius: 0.5rem; font-size: 0.9375rem; font-weight: 800; letter-spacing: 0.08em; transform: rotate(-12deg); }
.vp-deck-stamp--like { color: #22c55e; box-shadow: inset 0 0 0 3px #22c55e; }
.vp-deck-stamp--pass { left: auto; right: 1.25rem; color: #ef4444; box-shadow: inset 0 0 0 3px #ef4444; transform: rotate(12deg); }
.vp-deck-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.75rem; text-align: center; color: var(--vp-muted); font-size: 0.8125rem; }
.vp-tinder-actions { display: flex; justify-content: center; gap: 1.5rem; padding: 0.875rem 0 0.25rem; flex-shrink: 0; }
.vp-tinder-btn { display: inline-flex; align-items: center; justify-content: center; height: 3rem; width: 3rem; border-radius: 999px; background: var(--vp-surface); box-shadow: 0 2px 8px rgb(0 0 0 / 0.15), inset 0 0 0 1px var(--vp-border); transition: transform 120ms ease; }
.vp-tinder-btn:active { transform: scale(0.92); }
.vp-tinder-btn--pass { color: var(--vp-muted); }
.vp-tinder-btn--like { color: #fd297b; }
.vp-mail-dot { display: inline-block; height: 0.5rem; width: 0.5rem; margin-right: 0.375rem; border-radius: 999px; background: var(--vp-accent); }
.vp-mail-meta { margin: -0.375rem 0 0.75rem; font-size: 0.6875rem; font-weight: 500; color: var(--vp-muted); }
.vp-post { display: grid; gap: 0.375rem; }
.vp-post-header { display: flex; align-items: center; gap: 0.5rem; }
.vp-post-avatar { display: inline-flex; align-items: center; justify-content: center; height: 2rem; width: 2rem; flex-shrink: 0; border-radius: 999px; background: linear-gradient(180deg, #b48cff, #7a3ff2); color: #fff; font-size: 0.6875rem; font-weight: 700; box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.3); }
.vp-post-names { display: flex; align-items: baseline; gap: 0.375rem; min-width: 0; overflow: hidden; }
.vp-post-author { font-size: 0.75rem; font-weight: 650; white-space: nowrap; }
.vp-post-time { margin-left: auto; flex-shrink: 0; font-size: 0.5625rem; font-weight: 500; color: var(--vp-muted); }
.vp-post-handle { font-size: 0.6875rem; font-weight: 500; color: var(--vp-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vp-post-text { margin: 0; font-size: 0.8125rem; line-height: 1.4; overflow-wrap: anywhere; }
.vp-post-footer { display: flex; gap: 1.25rem; align-items: center; font-size: 0.625rem; font-weight: 600; color: var(--vp-muted); }
.vp-post-footer span { display: inline-flex; align-items: center; gap: 0.25rem; }

.vp-goodle-logo { display: flex; justify-content: center; gap: 1px; margin: 1.5rem 0 1rem; font-size: 2.125rem; font-weight: 700; letter-spacing: -0.02em; text-shadow: 0 1px 2px rgb(0 0 0 / 0.08); }
.vp-site-masthead { display: grid; gap: 0.1875rem; padding: 1rem 0.875rem; border-radius: 1rem 1rem 0 0; color: #fff; box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.15); }
.vp-site-name { font-size: 1.125rem; font-weight: 700; letter-spacing: -0.01em; }
.vp-site-tagline { font-size: 0.6875rem; font-weight: 500; opacity: 0.85; }
.vp-site-nav { display: flex; gap: 0.375rem; overflow-x: auto; padding: 0.375rem; margin-bottom: 0.875rem; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 97%, #ffffff), var(--vp-surface)); border-radius: 0 0 1rem 1rem; box-shadow: 0 1px 2px rgb(0 0 0 / 0.05), inset 0 0 0 1px var(--vp-border); }
.vp-site-nav-btn { flex-shrink: 0; min-height: 1.875rem; padding: 0 0.75rem; border-radius: 999px; font-size: 0.6875rem; font-weight: 600; background: color-mix(in srgb, var(--vp-text) 6%, var(--vp-surface)); transition: background 120ms ease; }
.vp-site-nav-btn:hover { background: color-mix(in srgb, var(--vp-text) 11%, var(--vp-surface)); }
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
@media (prefers-reduced-motion: reduce) { .vp-appview, .vp-switcher, .vp-skeleton, .vp-slide-up, .vp-slide-down { animation: none; } }
.vp-search-go { position: relative; flex: 1; min-width: 0; }
.vp-go-btn { position: absolute; right: 0.3125rem; top: 50%; translate: 0 -50%; display: inline-flex; align-items: center; justify-content: center; height: 2.125rem; width: 2.125rem; border-radius: 999px; background: var(--vp-accent); color: #fff; box-shadow: 0 1px 3px rgb(0 0 0 / 0.2); transition: transform 120ms ease; }
.vp-go-btn:active { transform: scale(0.94); }
.vp-color-row { display: inline-flex; align-items: center; gap: 0.5rem; }
.vp-color-input { height: 1.875rem; width: 2.75rem; padding: 0; border: 0; border-radius: 0.5rem; background: none; cursor: pointer; }
.vp-color-input::-webkit-color-swatch-wrapper { padding: 2px; }
.vp-color-input::-webkit-color-swatch { border: 1px solid var(--vp-border); border-radius: 0.375rem; }
.vp-urlbar { display: inline-flex; align-items: center; gap: 0.375rem; max-width: 100%; min-height: 1.875rem; padding: 0 0.75rem; border-radius: 999px; background: color-mix(in srgb, var(--vp-text) 6%, var(--vp-bg)); font-size: 0.6875rem; font-weight: 500; color: var(--vp-muted); }
.vp-urlbar span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vp-grid-pager { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; margin: 0 -0.75rem; padding: 0 0.75rem; scrollbar-width: none; }
.vp-grid-pager::-webkit-scrollbar { display: none; }
.vp-grid-page { flex: 0 0 100%; scroll-snap-align: start; scroll-snap-stop: always; }
.vp-page-dots { display: flex; justify-content: center; gap: 0.3125rem; margin-top: 0.375rem; }
.vp-page-dot { height: 0.3125rem; width: 0.3125rem; border-radius: 999px; background: color-mix(in srgb, var(--vp-text) 25%, var(--vp-bg)); transition: background 160ms ease; }
.vp-page-dot--active { background: var(--vp-text); }
.vp-store-actions { display: grid; gap: 0.25rem; justify-items: end; flex-shrink: 0; }
.vp-store-remove { font-size: 0.625rem; font-weight: 600; color: var(--vp-muted); padding: 0.125rem 0.375rem; border-radius: 0.375rem; }
.vp-store-remove:hover { color: #ff3b30; }
.vp-fx { position: absolute; inset: 0; z-index: 40; pointer-events: none; border-radius: 43px; }
.vp-fx--cracks { background: repeating-linear-gradient(17deg, transparent 0 42px, rgb(255 255 255 / 0.22) 42px 43px, transparent 43px 96px), repeating-linear-gradient(-63deg, transparent 0 57px, rgb(255 255 255 / 0.16) 57px 58px, transparent 58px 128px), radial-gradient(circle at 68% 18%, rgb(255 255 255 / 0.18) 0 2px, transparent 3%); }
.vp-fx--smudge { background: radial-gradient(ellipse 40% 25% at 70% 22%, rgb(255 255 255 / 0.1), transparent), radial-gradient(ellipse 35% 20% at 28% 62%, rgb(255 255 255 / 0.08), transparent), radial-gradient(ellipse 30% 15% at 55% 85%, rgb(255 255 255 / 0.07), transparent); }
.vp-fx--blood { background: radial-gradient(circle at 80% 10%, rgb(150 10 20 / 0.55) 0 6%, transparent 16%), radial-gradient(circle at 73% 20%, rgb(130 5 15 / 0.45) 0 3%, transparent 9%), radial-gradient(circle at 16% 76%, rgb(140 8 18 / 0.4) 0 8%, transparent 20%), radial-gradient(circle at 24% 88%, rgb(120 5 12 / 0.35) 0 4%, transparent 10%); }
.vp-fx--scanlines { background: repeating-linear-gradient(0deg, rgb(0 0 0 / 0.16) 0 1px, transparent 1px 3px); }
.vp-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
`;
