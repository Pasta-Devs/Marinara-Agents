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
.vp-dock-audience select { max-width: 6.5rem; height: 100%; border: 1px solid rgb(255 255 255 / 0.14); border-radius: 999px; padding: 0 0.55rem; background: #1b2028; color: #fff; font: inherit; font-size: 0.65rem; }
.vp-dock-btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.375rem; flex: 1; min-width: 0; min-height: 2.375rem; padding: 0 0.625rem; border-radius: 999px; background: #23272e; color: #fff; font-size: 0.6875rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.1); transition: filter 140ms ease, transform 120ms ease; }
.vp-dock-btn--primary { background: var(--vp-accent); box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.25), 0 2px 8px rgb(0 0 0 / 0.3); }
.vp-dock-btn:hover:not(:disabled) { filter: brightness(1.15); }
.vp-dock-btn:active:not(:disabled) { transform: scale(0.97); }

.vp-screen { position: relative; display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; border-radius: 43px; background: var(--vp-bg); color: var(--vp-text); }
.vp-statusbar { position: relative; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 0.5rem; min-height: 2.25rem; flex-shrink: 0; padding: 0.375rem 1rem 0; font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.01em; font-variant-numeric: tabular-nums; }
.vp-statusbar-cluster { display: inline-flex; align-items: center; gap: 0.3125rem; min-width: 0; }
.vp-statusbar-clock { justify-self: start; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vp-statusbar--lock .vp-statusbar-clock { visibility: hidden; }
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
.vp-cropper { display: flex; flex-direction: column; align-items: center; gap: 0.6rem; margin-top: 0.6rem; padding: 0.75rem; border-radius: 0.85rem; background: color-mix(in srgb, var(--vp-text) 5%, var(--vp-bg)); box-shadow: inset 0 0 0 1px var(--vp-border); }
.vp-cropper-view { position: relative; overflow: hidden; border-radius: 1rem; background: #000; box-shadow: inset 0 0 0 1px var(--vp-border); cursor: grab; touch-action: none; }
.vp-cropper-view:active { cursor: grabbing; }
.vp-cropper-actions { display: flex; gap: 0.5rem; }
.vp-access-denied { display: flex; align-items: flex-start; gap: 0.5rem; margin: 0.375rem 0.75rem 0; padding: 0.5rem 0.625rem; border-radius: 0.75rem; background: color-mix(in srgb, #ff453a 18%, var(--vp-surface)); color: var(--vp-text); font-size: 0.6875rem; font-weight: 500; box-shadow: inset 0 0 0 1px color-mix(in srgb, #ff453a 45%, transparent); }
.vp-access-denied span { flex: 1; }
.vp-access-denied button { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; width: 1.25rem; height: 1.25rem; border-radius: 0.5rem; color: var(--vp-muted); }

.vp-surface-area { position: relative; display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; }
.vp-powered-off { display: grid; justify-items: center; align-content: center; gap: 0.5rem; flex: 1; min-height: 0; padding: 2rem; background: #050607; color: #8c929b; text-align: center; }
.vp-powered-off strong { color: #f4f5f7; font-size: 1rem; }
.vp-powered-off span { max-width: 15rem; font-size: 0.6875rem; line-height: 1.5; }
.vp-powered-off button { min-height: 2.5rem; margin-top: 0.5rem; padding: 0 1.25rem; border-radius: 999px; background: #f4f5f7; color: #111318; font-size: 0.75rem; font-weight: 700; }
.vp-home-indicator { position: absolute; bottom: 0.375rem; left: 50%; translate: -50% 0; z-index: 30; height: 4px; width: 6.5rem; border-radius: 999px; background: color-mix(in srgb, var(--vp-text) 30%, var(--vp-bg)); pointer-events: none; }
.vp-lock { display: flex; flex-direction: column; flex: 1; min-height: 0; align-items: center; gap: 1rem; padding: 2.1rem 0.8rem 1.15rem; text-align: center; background: linear-gradient(180deg, rgb(0 0 0 / 0.04), transparent 42%, color-mix(in srgb, var(--vp-bg) 58%, transparent) 100%); }
.vp-lock-hero { display: grid; justify-items: center; }
.vp-lock > .vp-unlock-btn { margin-top: auto; }
.vp-lock-clock { margin: 0; font-size: 4.75rem; font-weight: 190; font-variant-numeric: tabular-nums; letter-spacing: -0.065em; line-height: 0.92; text-shadow: 0 3px 22px rgb(0 0 0 / 0.24); }
.vp-lock-date { margin: 0.65rem 0 0; font-size: 0.875rem; font-weight: 650; color: color-mix(in srgb, var(--vp-text) 88%, transparent); text-shadow: 0 1px 10px rgb(0 0 0 / 0.28); }
.vp-lock-card { width: 100%; min-height: 3.65rem; display: flex; align-items: center; justify-content: center; padding: 0.68rem; border-radius: 1.05rem; background: color-mix(in srgb, var(--vp-surface) 64%, transparent); backdrop-filter: blur(24px) saturate(1.35); font-size: 0.75rem; font-weight: 500; color: var(--vp-muted); box-shadow: 0 7px 24px rgb(0 0 0 / 0.16), inset 0 0 0 1px color-mix(in srgb, var(--vp-border) 60%, transparent); }
.vp-lock-list { display: grid; gap: 0.45rem; width: 100%; min-height: 0; margin-top: 0.5rem; overflow-y: auto; }
.vp-lock-card--notification { display: flex; gap: 0.625rem; justify-content: flex-start; min-height: 0; width: 100%; text-align: left; cursor: pointer; transition: transform 120ms ease; }
.vp-lock-app-icon { display: inline-flex; align-items: center; justify-content: center; width: 2rem; height: 2rem; flex-shrink: 0; padding: 0.45rem; border-radius: 0.65rem; color: #fff; }
.vp-lock-notification-time { align-self: flex-start; flex-shrink: 0; color: var(--vp-muted); font-size: 0.5625rem; }
.vp-lock-card--notification:active { transform: scale(0.98); }
.vp-notification-center { position: absolute; inset: 0; z-index: 24; display: flex; flex-direction: column; min-height: 0; padding: 0.875rem 0.75rem 1.5rem; background: var(--vp-bg); animation: vp-app-in 180ms cubic-bezier(0.2, 0.9, 0.3, 1); }
.vp-notification-head { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; min-height: 3rem; margin-bottom: 0.625rem; }
.vp-notification-head h2 { margin: 0; font-size: 1.375rem; line-height: 1.1; letter-spacing: -0.025em; }
.vp-notification-head-actions { display: flex; align-items: center; gap: 0.2rem; }
.vp-notification-clear { min-height: 2rem; padding: 0 0.55rem; border-radius: 0.65rem; color: var(--vp-accent); font-size: 0.6875rem; font-weight: 700; }
.vp-notification-clear:hover { background: color-mix(in srgb, var(--vp-accent) 9%, transparent); }
.vp-notification-list { display: grid; gap: 0.5rem; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding-bottom: 0.5rem; }
.vp-notification-row { display: flex; align-items: stretch; overflow: hidden; border-radius: 1rem; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 97%, #ffffff), var(--vp-surface)); box-shadow: 0 1px 2px rgb(0 0 0 / 0.06), 0 5px 16px rgb(0 0 0 / 0.08), inset 0 0 0 1px var(--vp-border); }
.vp-notification-open { display: flex; align-items: center; gap: 0.625rem; flex: 1; min-width: 0; min-height: 4rem; padding: 0.625rem 0.5rem 0.625rem 0.625rem; text-align: left; }
.vp-notification-icon { display: inline-flex; align-items: center; justify-content: center; height: 2.25rem; width: 2.25rem; flex-shrink: 0; border-radius: 0.7rem; color: #fff; box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.25), 0 2px 6px rgb(0 0 0 / 0.15); }
.vp-notification-body { display: -webkit-box; overflow: hidden; color: var(--vp-muted); font-size: 0.6875rem; line-height: 1.35; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow-wrap: anywhere; }
.vp-notification-dismiss { display: inline-flex; align-items: center; justify-content: center; width: 2.625rem; flex-shrink: 0; color: var(--vp-muted); box-shadow: inset 1px 0 0 var(--vp-border); }
.vp-notification-dismiss:hover { color: #e34843; background: color-mix(in srgb, #ff3b30 8%, transparent); }
.vp-notification-empty { display: grid; justify-items: center; align-content: center; gap: 0.35rem; flex: 1; min-height: 0; color: var(--vp-muted); text-align: center; }
.vp-notification-empty strong { color: var(--vp-text); font-size: 0.875rem; }
.vp-notification-empty span { font-size: 0.6875rem; }
.vp-unlock-btn { display: inline-flex; align-items: center; gap: 0.3rem; min-height: 2.5rem; padding: 0 0.8rem 0 1rem; border-radius: 999px; background: transparent; color: color-mix(in srgb, var(--vp-text) 88%, transparent); font-size: 0.6875rem; font-weight: 750; letter-spacing: 0.02em; text-shadow: 0 1px 8px rgb(0 0 0 / 0.3); transition: transform 120ms ease, background 120ms ease; }
.vp-unlock-btn:hover { background: color-mix(in srgb, var(--vp-surface) 35%, transparent); }
.vp-unlock-btn:active { transform: scale(0.97); }

.vp-home { display: flex; flex-direction: column; flex: 1; min-height: 0; gap: 0.65rem; padding: 1.15rem 0.65rem 0.85rem; background: linear-gradient(180deg, transparent 0%, color-mix(in srgb, var(--vp-bg) 6%, transparent) 55%, color-mix(in srgb, var(--vp-bg) 34%, transparent) 100%); }
.vp-icon-btn--glass { color: var(--vp-text); background: color-mix(in srgb, var(--vp-surface) 64%, transparent); backdrop-filter: blur(14px); box-shadow: 0 5px 18px rgb(0 0 0 / 0.14), inset 0 0 0 1px color-mix(in srgb, var(--vp-border) 72%, transparent); }
.vp-icon-btn { display: inline-flex; align-items: center; justify-content: center; height: 2.5rem; width: 2.5rem; flex-shrink: 0; border-radius: 999px; transition: background 140ms ease, transform 120ms ease; }
.vp-icon-btn:hover { background: color-mix(in srgb, var(--vp-text) 8%, var(--vp-bg)); }
.vp-icon-btn:active { transform: scale(0.94); }
.vp-icon-btn--surface { background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 97%, #ffffff), var(--vp-surface)); box-shadow: 0 1px 2px rgb(0 0 0 / 0.08), 0 4px 12px rgb(0 0 0 / 0.1), inset 0 0 0 1px var(--vp-border); }
.vp-icon-btn--surface:hover { background: var(--vp-surface); }
.vp-search-bar { display: block; width: 100%; min-height: 2.6rem; margin-top: 0; padding: 0 2.75rem 0 2.25rem; border: 0; border-radius: 999px; background: color-mix(in srgb, var(--vp-surface) 76%, transparent); backdrop-filter: blur(18px) saturate(1.15); color: var(--vp-text); font-size: 0.8125rem; box-shadow: 0 5px 18px rgb(0 0 0 / 0.12), inset 0 0 0 1px color-mix(in srgb, var(--vp-border) 72%, transparent); }
.vp-search-bar::placeholder { color: var(--vp-muted); }
.vp-inline-search { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; min-height: 2.45rem; margin-bottom: 0.65rem; padding: 0 0.75rem; border-radius: 0.8rem; background: color-mix(in srgb, var(--vp-text) 6%, var(--vp-bg)); color: var(--vp-muted); box-shadow: inset 0 0 0 1px var(--vp-border); }
.vp-inline-search input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; color: var(--vp-text); font: inherit; font-size: 0.75rem; }
.vp-inline-search input::placeholder { color: var(--vp-muted); }
.vp-filter-tabs { display: flex; gap: 0.35rem; margin: -0.15rem 0 0.7rem; }
.vp-filter-tabs button { min-height: 1.85rem; padding: 0 0.7rem; border-radius: 999px; background: color-mix(in srgb, var(--vp-text) 6%, transparent); color: var(--vp-muted); font-size: 0.625rem; font-weight: 700; }
.vp-filter-tabs button[aria-selected="true"] { background: var(--vp-accent); color: #fff; box-shadow: 0 3px 10px color-mix(in srgb, var(--vp-accent) 25%, transparent); }
.vp-home-apps { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 0.15rem 0.15rem 0.75rem; scrollbar-width: thin; }
.vp-home-section-label { display: block; margin: 0 0.3rem 0.6rem; font-size: 0.5625rem; font-weight: 750; letter-spacing: 0.09em; text-transform: uppercase; color: color-mix(in srgb, var(--vp-text) 66%, transparent); text-shadow: 0 1px 7px rgb(0 0 0 / 0.16); }
.vp-app-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); align-content: start; column-gap: 0.3rem; row-gap: 0.95rem; padding: 0 0.05rem 0.35rem; }
.vp-home-no-results { display: grid; justify-items: center; align-content: center; gap: 0.3rem; min-height: 7rem; padding: 1rem; text-align: center; color: var(--vp-muted); }
.vp-home-no-results strong { color: var(--vp-text); font-size: 0.75rem; }
.vp-home-no-results span { max-width: 13rem; font-size: 0.625rem; line-height: 1.4; }
.vp-home-dock { display: flex; align-items: center; justify-content: space-around; flex-shrink: 0; min-height: 4.2rem; padding: 0.42rem 0.45rem; border-radius: 1.45rem; background: color-mix(in srgb, var(--vp-surface) 58%, transparent); backdrop-filter: blur(26px) saturate(1.35); box-shadow: 0 10px 30px rgb(0 0 0 / 0.18), inset 0 0 0 1px color-mix(in srgb, var(--vp-border) 55%, transparent); }
.vp-goodle-save { display: inline-flex; align-items: center; gap: 0.35rem; margin: 0 0 0.55rem auto; border: 0; background: transparent; color: var(--vp-accent); font-size: 0.65rem; font-weight: 750; }
.vp-goodle-savebar { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.55rem; padding: 0.5rem 0.65rem; border-radius: 0.75rem; background: color-mix(in srgb, var(--vp-accent) 12%, var(--vp-surface)); font-size: 0.65rem; }
.vp-goodle-savebar span, .vp-goodle-savebar button { display: inline-flex; align-items: center; gap: 0.3rem; }
.vp-goodle-savebar button { border: 0; background: transparent; color: var(--vp-accent); font: inherit; font-weight: 750; }
.vp-settings-overview { justify-items: center; padding: 1rem 0.85rem 0.8rem; border-radius: 1.2rem; background: radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--vp-accent) 24%, transparent), transparent 65%), var(--vp-surface); text-align: center; box-shadow: inset 0 0 0 1px var(--vp-border), 0 8px 24px rgb(0 0 0 / 0.08); }
.vp-settings-device-icon { display: grid; place-items: center; width: 2.8rem; height: 2.8rem; border-radius: 0.9rem; background: var(--vp-accent); color: #fff; box-shadow: 0 5px 14px color-mix(in srgb, var(--vp-accent) 35%, transparent), inset 0 1px 0 rgb(255 255 255 / 0.28); }
.vp-settings-overview h2 { margin: 0.1rem 0 0; font-size: 1.05rem; }
.vp-settings-overview > p { margin: 0; color: var(--vp-muted); font-size: 0.625rem; }
.vp-settings-status-strip { display: flex; justify-content: center; gap: 0.35rem; margin-top: 0.35rem; }
.vp-settings-status-strip span { display: inline-flex; align-items: center; gap: 0.2rem; padding: 0.25rem 0.45rem; border-radius: 999px; background: color-mix(in srgb, var(--vp-text) 6%, transparent); color: var(--vp-muted); font-size: 0.56rem; font-weight: 700; text-transform: capitalize; }
.vp-settings-status-strip .is-online { color: #16834a; background: color-mix(in srgb, #32c875 12%, transparent); }
.vp-settings-status-strip .is-offline { color: #c33c34; background: color-mix(in srgb, #ef5149 12%, transparent); }
.vp-settings-menu { overflow: hidden; border-radius: 1rem; background: var(--vp-surface); box-shadow: inset 0 0 0 1px var(--vp-border); }
.vp-settings-menu > button { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 0.65rem; width: 100%; min-height: 3.6rem; padding: 0.55rem 0.7rem; color: var(--vp-text); text-align: left; }
.vp-settings-menu > button + button { border-top: 1px solid var(--vp-border); }
.vp-settings-menu > button > span:nth-child(2) { display: grid; gap: 0.08rem; min-width: 0; }
.vp-settings-menu strong { font-size: 0.72rem; }
.vp-settings-menu small { overflow: hidden; color: var(--vp-muted); font-size: 0.56rem; text-overflow: ellipsis; white-space: nowrap; }
.vp-settings-menu-icon { display: grid; place-items: center; width: 2rem; height: 2rem; border-radius: 0.62rem; color: #fff; }
.vp-settings-menu-icon.is-blue { background: #3484e3; }.vp-settings-menu-icon.is-teal { background: #189b8f; }.vp-settings-menu-icon.is-orange { background: #d8792e; }.vp-settings-menu-icon.is-purple { background: #8664d8; }.vp-settings-menu-icon.is-gray { background: #697180; }
.vp-dock-app { position: relative; display: inline-flex; align-items: center; justify-content: center; min-width: 3.6rem; }
.vp-dock-app .vp-app-icon { width: 3rem; height: 3rem; border-radius: 0.95rem; }
.vp-app { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 0.375rem; min-width: 0; min-height: 4.625rem; border-radius: 0.75rem; color: var(--vp-text); }
.vp-app-badge { position: absolute; top: -0.375rem; right: 4%; z-index: 1; }
.vp-app-icon { display: flex; align-items: center; justify-content: center; height: 3.25rem; width: 3.25rem; flex-shrink: 0; border-radius: 1rem; color: #fff; box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.3), inset 0 -1px 0 rgb(0 0 0 / 0.15), 0 5px 12px rgb(0 0 0 / 0.18); transition: transform 140ms cubic-bezier(0.2, 0.9, 0.3, 1.4), filter 140ms ease; }
.vp-app:hover .vp-app-icon { filter: brightness(1.06); }
.vp-app:active .vp-app-icon { transform: scale(0.92); }
.vp-app-icon--settings { background: linear-gradient(180deg, #8e97a6 0%, #5c6470 100%); }
.vp-app-icon--app-store { background: linear-gradient(180deg, #34aefc 0%, #0b6ded 100%); }
.vp-app-icon--calls { background: linear-gradient(180deg, #55e97a 0%, #16a443 100%); }
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
.vp-app-icon--bazaar { background: linear-gradient(180deg, #d99a4e 0%, #74431d 100%); }
.vp-app-icon--game { background: linear-gradient(180deg, #ef6461 0%, #b3272d 100%); }
.vp-app-icon--shop { background: linear-gradient(180deg, #438bd1 0%, #19477f 100%); }
.vp-app-icon--maps { background: linear-gradient(180deg, #5dbb78 0%, #0f7a4a 100%); }
.vp-app-icon--find { background: linear-gradient(180deg, #5c9ded 0%, #1d4ed8 100%); }
/* The stand-in for a picture: a grey hatched box with an emoji saying what the picture would be.
   The emoji used to be greyscaled to 72% opacity along with the box, which made the one part that
   carries the meaning the hardest part to read. */
.vp-emoji-thumb { display: flex; align-items: center; justify-content: center; flex: 0 0 auto; border-radius: 0.6rem; background: repeating-linear-gradient(135deg, color-mix(in srgb, var(--vp-text) 5%, var(--vp-surface)) 0 10px, color-mix(in srgb, var(--vp-text) 8%, var(--vp-surface)) 10px 20px); box-shadow: inset 0 0 0 1px var(--vp-border); }
.vp-emoji-thumb--sm { height: 2.5rem; width: 2.5rem; font-size: 1.25rem; border-radius: 999px; }
.vp-emoji-thumb--md { aspect-ratio: 1; width: 100%; font-size: 2rem; }
.vp-emoji-thumb--lg { aspect-ratio: 4 / 3; width: 100%; font-size: 3.5rem; border-radius: 1rem; }
/* The map had no ground: the background shorthand set a green gradient, then background-image on
   the same rule replaced it outright, leaving grid lines floating on nothing (and three
   background-size values for two layers). Rebuilt as an actual map — land, a park, water, minor
   streets and two through-roads. Every colour is mixed into the theme's own surface rather than
   being a fixed green, and the roads are white at low alpha, so the same rule reads as a paper map
   in light mode and a night map in dark mode instead of a bright green slab. */
.vp-map-canvas { --vp-map-land: color-mix(in srgb, #7ba883 22%, var(--vp-surface)); --vp-map-road: rgb(255 255 255 / 0.5); --vp-map-street: rgb(255 255 255 / 0.16); --vp-map-water: color-mix(in srgb, #4f88ad 34%, var(--vp-surface)); --vp-map-park: color-mix(in srgb, #5f9c61 26%, var(--vp-surface)); position: relative; display: flex; align-items: center; justify-content: center; min-height: 12rem; border-radius: 1.1rem; overflow: hidden; background-color: var(--vp-map-land); background-image:
    linear-gradient(66deg, transparent calc(50% - 0.26rem), var(--vp-map-road) calc(50% - 0.26rem) calc(50% + 0.26rem), transparent calc(50% + 0.26rem)),
    linear-gradient(-24deg, transparent calc(38% - 0.17rem), var(--vp-map-road) calc(38% - 0.17rem) calc(38% + 0.17rem), transparent calc(38% + 0.17rem)),
    linear-gradient(90deg, var(--vp-map-street) 0 1px, transparent 1px),
    linear-gradient(0deg, var(--vp-map-street) 0 1px, transparent 1px),
    radial-gradient(ellipse 44% 27% at 89% 93%, var(--vp-map-water) 0 62%, transparent 64%),
    radial-gradient(ellipse 23% 19% at 13% 21%, var(--vp-map-park) 0 70%, transparent 72%),
    linear-gradient(180deg, rgb(255 255 255 / 0.06), rgb(0 0 0 / 0.07));
  background-size: 100% 100%, 100% 100%, 3.5rem 3.5rem, 3.5rem 3.5rem, 100% 100%, 100% 100%, 100% 100%; background-position: 0 0, 0 0, -0.8rem 0, 0 -0.55rem, 0 0, 0 0, 0 0; box-shadow: inset 0 0 0 1px var(--vp-border), inset 0 0 3.5rem rgb(0 0 0 / 0.1); }
.vp-map-canvas--detail { min-height: 9rem; }
/* The map is the app: it fills everything under the search field, and the results ride over its
   bottom edge on a sheet. Positioned rather than flexed — .vp-appview is already absolute with
   inset 0, so it is both the full-height box and the containing block these two position against.
   Giving .vp-maps its own position: relative took that inset away and collapsed the view to its content. */
.vp-maps { padding-bottom: 0; overflow: hidden; }
/* Flex, not absolute: an absolute map covered the search field it was supposed to sit under. */
.vp-map-canvas--full { flex: 1; min-height: 6rem; margin-top: 0.625rem; border-radius: 1.1rem 1.1rem 0 0; }
.vp-map-sheet { position: absolute; left: 0; right: 0; bottom: 0; max-height: 60%; overflow-y: auto; padding: 0.5rem 0.75rem 1rem; border-radius: 1.25rem 1.25rem 0 0; background: color-mix(in srgb, var(--vp-text) 5%, var(--vp-bg)); box-shadow: 0 -10px 28px rgb(0 0 0 / 0.45), inset 0 1px 0 color-mix(in srgb, var(--vp-text) 14%, transparent); }
.vp-sheet-grip { display: block; height: 4px; width: 2.25rem; margin: 0 auto 0.625rem; border-radius: 999px; background: color-mix(in srgb, var(--vp-text) 25%, transparent); }
/* A bare emoji dropped on a map reads as clip art. Seat it in a circular marker with a tail and a
   shadow on the ground beneath, which is what makes a pin look placed rather than pasted. The tail
   is a pseudo-element rather than a rotated button, so the emoji inside stays upright. */
.vp-map-pin { position: absolute; transform: translate(-50%, -100%); display: inline-flex; align-items: center; justify-content: center; height: 2.125rem; width: 2.125rem; border: 0; padding: 0; border-radius: 999px; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 94%, #ffffff), var(--vp-surface)); box-shadow: 0 2px 5px rgb(0 0 0 / 0.25), inset 0 0 0 1.5px color-mix(in srgb, var(--vp-accent) 50%, var(--vp-border)); font-size: 1.0625rem; line-height: 1; cursor: pointer; transition: transform 140ms ease, filter 140ms ease; }
.vp-map-pin::after { content: ""; position: absolute; top: calc(100% - 3px); left: 50%; translate: -50% 0; border: 0.3125rem solid transparent; border-top-color: var(--vp-surface); filter: drop-shadow(0 1px 0 color-mix(in srgb, var(--vp-accent) 50%, var(--vp-border))); }
.vp-map-pin::before { content: ""; position: absolute; top: calc(100% + 0.25rem); left: 50%; translate: -50% 0; height: 0.25rem; width: 1rem; border-radius: 999px; background: rgb(0 0 0 / 0.18); filter: blur(1.5px); }
.vp-map-pin:hover { transform: translate(-50%, -108%); filter: brightness(1.04); }
.vp-map-pin.is-open { position: static; transform: none; height: 4.25rem; width: 4.25rem; font-size: 2.25rem; }
.vp-map-pin.is-open::after, .vp-map-pin.is-open::before { display: none; }
.vp-map-search { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 0.45rem; min-height: 2.65rem; padding: 0 0.65rem; border-radius: 0.85rem; color: var(--vp-muted); background: color-mix(in srgb, var(--vp-surface) 96%, #fff); box-shadow: 0 2px 10px rgb(0 0 0 / 0.08), inset 0 0 0 1px var(--vp-border); }
.vp-map-search label { min-width: 0; }
.vp-map-search input { width: 100%; border: 0; outline: 0; padding: 0; background: transparent; color: var(--vp-text); font: inherit; font-size: 0.75rem; }
.vp-map-search button { display: grid; place-items: center; padding: 0.25rem; color: var(--vp-muted); }
.vp-map-notice { position: absolute; z-index: 4; top: 5.65rem; left: 1.25rem; right: 1.25rem; margin: 0; padding: 0.45rem 0.65rem; border-radius: 0.65rem; background: var(--vp-surface); box-shadow: 0 3px 12px rgb(0 0 0 / 0.16); }
.vp-map-loading { padding: 0.45rem 0.7rem; border-radius: 999px; background: color-mix(in srgb, var(--vp-surface) 94%, transparent); color: var(--vp-text); box-shadow: 0 2px 8px rgb(0 0 0 / 0.14); font-size: 0.65rem; font-weight: 650; }
.vp-map-pin.is-selected { z-index: 2; transform: translate(-50%, -112%) scale(1.12); box-shadow: 0 5px 12px rgb(0 0 0 / 0.28), inset 0 0 0 2px var(--vp-accent); }
.vp-map-start { display: grid; gap: 0.8rem; }
.vp-map-chips { display: flex; gap: 0.4rem; overflow-x: auto; padding-bottom: 0.15rem; scrollbar-width: none; }
.vp-map-chips button { flex: 0 0 auto; min-height: 1.85rem; padding: 0 0.65rem; border-radius: 999px; background: color-mix(in srgb, var(--vp-accent) 10%, var(--vp-surface)); color: var(--vp-text); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--vp-accent) 24%, var(--vp-border)); font-size: 0.625rem; font-weight: 650; }
.vp-map-start section { overflow: hidden; border-radius: 0.8rem; background: var(--vp-surface); box-shadow: inset 0 0 0 1px var(--vp-border); }
.vp-map-start h3 { display: flex; align-items: center; gap: 0.35rem; margin: 0; padding: 0.55rem 0.65rem 0.35rem; color: var(--vp-muted); font-size: 0.6rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.045em; }
.vp-map-history-row { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; width: 100%; min-height: 2.2rem; padding: 0.35rem 0.65rem; color: var(--vp-text); font-size: 0.7rem; text-align: left; }
.vp-map-history-row + .vp-map-history-row { border-top: 1px solid var(--vp-border); }
.vp-map-history-row small { color: var(--vp-muted); font-size: 0.6rem; text-transform: capitalize; }
.vp-map-place-card { display: grid; gap: 0.6rem; }
.vp-map-place-head { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 0.6rem; }
.vp-map-place-head > span:nth-child(2) { display: grid; gap: 0.1rem; min-width: 0; }
.vp-map-place-head strong { overflow: hidden; font-size: 0.82rem; text-overflow: ellipsis; white-space: nowrap; }
.vp-map-place-head small { color: var(--vp-muted); font-size: 0.625rem; text-transform: capitalize; }
.vp-map-place-card p { margin: 0; color: var(--vp-muted); font-size: 0.68rem; line-height: 1.4; }
.vp-map-place-card .vp-accent-btn { margin: 0; }
.vp-map-privacy { color: var(--vp-muted); font-size: 0.56rem; line-height: 1.35; text-align: center; }
.vp-map-route { display: flex; flex: 1; min-height: 0; flex-direction: column; }
.vp-map-route-banner { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 0.65rem; margin-bottom: 0.55rem; padding: 0.6rem 0.7rem; border-radius: 0.85rem; background: var(--vp-accent); color: #fff; box-shadow: 0 4px 12px rgb(0 0 0 / 0.16); }
.vp-map-route-banner > span:last-child { display: grid; gap: 0.12rem; min-width: 0; }
.vp-map-route-banner strong { overflow: hidden; font-size: 0.75rem; text-overflow: ellipsis; white-space: nowrap; }
.vp-map-route-banner small { font-size: 0.56rem; opacity: 0.82; }
.vp-map-turn { display: grid; place-items: center; width: 2rem; height: 2rem; border-radius: 0.6rem; background: rgb(255 255 255 / 0.17); }
.vp-map-canvas--route { flex: 1; min-height: 12rem; border-radius: 1rem; }
.vp-map-route-line { position: absolute; left: 33%; top: 61%; width: 46%; height: 0.35rem; border-radius: 999px; background: var(--vp-accent); transform: rotate(-52deg); box-shadow: 0 0 0 2px color-mix(in srgb, var(--vp-surface) 80%, transparent); }
.vp-map-origin { position: absolute; left: 29%; top: 72%; display: grid; place-items: center; width: 1.8rem; height: 1.8rem; border: 3px solid var(--vp-surface); border-radius: 999px; background: #3478e5; color: #fff; box-shadow: 0 2px 5px rgb(0 0 0 / 0.22); }
.vp-map-pin.is-destination { left: 71%; top: 26%; }
.vp-map-trip-card { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 0.65rem; margin-top: 0.55rem; padding: 0.65rem 0.7rem; border-radius: 0.85rem; background: var(--vp-surface); box-shadow: inset 0 0 0 1px var(--vp-border); }
.vp-map-trip-card > span { display: grid; gap: 0.12rem; min-width: 0; }
.vp-map-trip-card strong { overflow: hidden; font-size: 0.78rem; text-overflow: ellipsis; white-space: nowrap; }
.vp-map-trip-card small { overflow: hidden; color: var(--vp-muted); font-size: 0.59rem; text-overflow: ellipsis; white-space: nowrap; }
.vp-map-end { min-height: 2rem; padding: 0 0.75rem; border-radius: 999px; background: color-mix(in srgb, #ef4444 12%, var(--vp-surface)); color: #d93737; font-size: 0.65rem; font-weight: 700; }
/* Contact actions: the row of things you can do with a person, which is what a contact card is for. */
.vp-contact-actions { display: grid; grid-auto-flow: column; gap: 0.5rem; width: 100%; margin-top: 0.5rem; }
.vp-contact-action { display: inline-flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.25rem; min-height: 3.25rem; border-radius: 0.875rem; background: color-mix(in srgb, var(--vp-accent) 12%, var(--vp-surface)); color: var(--vp-accent); font-size: 0.625rem; font-weight: 650; transition: transform 120ms ease, filter 140ms ease; }
.vp-contact-action:hover:not(:disabled) { filter: brightness(0.97); }
.vp-contact-action:active:not(:disabled) { transform: scale(0.97); }
.vp-contact-detail { display: grid; gap: 1rem; }
.vp-contact-hero { display: grid; justify-items: center; gap: 0.3rem; padding: 0.75rem 0 0.25rem; text-align: center; }
.vp-contact-hero .vp-thread-avatar { height: 4.5rem !important; width: 4.5rem !important; font-size: 1.25rem; }
.vp-contact-hero h3 { margin: 0.25rem 0 0; font-size: 1.25rem; font-weight: 680; letter-spacing: -0.02em; }
.vp-contact-hero p { margin: 0; max-width: 15rem; color: var(--vp-muted); font-size: 0.75rem; line-height: 1.35; }
.vp-contact-copy { margin: 0; color: var(--vp-text); font-size: 0.75rem; line-height: 1.5; }
.vp-contact-value { min-width: 0; color: var(--vp-muted); font-size: 0.6875rem; font-weight: 500; text-align: right; overflow-wrap: anywhere; }
.vp-contact-star { display: inline; margin-left: 0.3rem; color: var(--vp-accent); vertical-align: -0.04rem; }
.vp-find-list { display: grid; gap: 0.65rem; }
.vp-find-summary { display: flex; align-items: end; justify-content: space-between; gap: 0.75rem; padding: 0.2rem 0.15rem 0; }
.vp-find-summary > span:first-child { display: grid; line-height: 1; }
.vp-find-summary strong { font-size: 1.65rem; font-weight: 720; letter-spacing: -0.05em; }
.vp-find-summary small { margin-top: 0.18rem; color: var(--vp-muted); font-size: 0.6rem; }
.vp-find-summary > span:last-child, .vp-find-checked { display: inline-flex; align-items: center; gap: 0.25rem; margin: 0; color: var(--vp-muted); font-size: 0.58rem; }
.vp-find-list .vp-filter-tabs { margin: 0; }
.vp-find-row { display: flex; align-items: center; gap: 0.625rem; padding: 0.6rem 0.7rem; text-align: left; }
.vp-find-avatar { position: relative; flex: 0 0 auto; }
.vp-find-avatar > span:last-child { position: absolute; right: -0.12rem; bottom: -0.08rem; display: grid; place-items: center; width: 1rem; height: 1rem; border: 2px solid var(--vp-surface); border-radius: 999px; background: #28a765; color: #fff; }
.vp-find-detail { display: grid; gap: 0.75rem; }
.vp-find-person { display: grid; justify-items: center; gap: 0.3rem; padding: 0.7rem 0 0.25rem; text-align: center; }
.vp-find-person .vp-thread-avatar { width: 4.4rem !important; height: 4.4rem !important; font-size: 1.2rem; }
.vp-find-person h3 { margin: 0.2rem 0 0; font-size: 1.2rem; letter-spacing: -0.025em; }
.vp-find-availability { display: inline-flex; align-items: center; gap: 0.25rem; color: var(--vp-muted); font-size: 0.62rem; font-weight: 650; }
.vp-find-availability.is-shared { color: #28a765; }
.vp-find-place { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 0.65rem; align-items: start; padding: 0.8rem; }
.vp-find-place-icon { display: grid; place-items: center; width: 2.25rem; height: 2.25rem; border-radius: 0.7rem; background: color-mix(in srgb, var(--vp-accent) 13%, var(--vp-surface)); color: var(--vp-accent); }
.vp-find-place > span:last-child { display: grid; min-width: 0; gap: 0.1rem; }
.vp-find-place small { color: var(--vp-muted); font-size: 0.56rem; font-weight: 650; text-transform: uppercase; letter-spacing: 0.04em; }
.vp-find-place strong { font-size: 0.82rem; }
.vp-find-place p, .vp-find-private p { margin: 0.15rem 0 0; color: var(--vp-muted); font-size: 0.66rem; line-height: 1.4; }
.vp-find-private { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 0.65rem; padding: 0.85rem; color: var(--vp-muted); }
.vp-find-private strong { color: var(--vp-text); font-size: 0.75rem; }
.vp-find-detail .vp-accent-btn { margin: 0; }
.vp-find-checked { justify-self: center; }
.vp-find-privacy { display: flex; align-items: flex-start; justify-content: center; gap: 0.3rem; margin: 0.15rem 0 0; color: var(--vp-muted); font-size: 0.56rem; line-height: 1.4; text-align: center; }
.vp-find-privacy svg { flex: 0 0 auto; margin-top: 0.05rem; }
.vp-find-summary .is-spinning { animation: vp-spin 900ms linear infinite; }
@keyframes vp-spin { to { transform: rotate(360deg); } }
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
.vp-market-headline { display: flex; align-items: baseline; gap: 0.5rem; }
.vp-market-price--hero { font-size: 1.5rem; font-weight: 700; }
.vp-market-was { font-size: 0.8125rem; color: var(--vp-muted); text-decoration: line-through; }
.vp-bazaar-intro { display: flex; align-items: baseline; gap: 0.4rem; margin: 0.1rem 0 0.55rem; }
.vp-bazaar-intro strong { font-size: 0.875rem; letter-spacing: -0.01em; }
.vp-bazaar-intro span { color: var(--vp-muted); font-size: 0.5875rem; }
.vp-market-list { display: grid; overflow: hidden; border-radius: 1rem; background: var(--vp-surface); box-shadow: inset 0 0 0 1px var(--vp-border); }
.vp-market-row { display: grid; grid-template-columns: 3.75rem minmax(0, 1fr); align-items: center; min-height: 3.75rem; color: var(--vp-text); text-align: left; }
.vp-market-row + .vp-market-row { border-top: 1px solid var(--vp-border); }
.vp-market-row .vp-market-photo { height: 100%; min-height: 3.75rem; aspect-ratio: auto; font-size: 1.25rem; }
.vp-market-row .vp-market-body { min-width: 0; padding: 0.5rem 0.65rem; }
.vp-market-deal-state { display: inline-flex; align-items: center; min-height: 2rem; padding: 0 0.7rem; border-radius: 999px; background: color-mix(in srgb, #2f9e55 12%, var(--vp-surface)); color: #258346; font-size: 0.6875rem; font-weight: 700; }
.vp-shop-hero { display: flex; align-items: center; gap: 0.7rem; margin-bottom: 0.65rem; padding: 0.8rem; border-radius: 1rem; background: linear-gradient(135deg, #172c52, #2464a8); color: #eef7ff; box-shadow: 0 7px 20px rgb(10 47 92 / 0.22); }
.vp-shop-mark { display: inline-flex; align-items: center; justify-content: center; width: 2.5rem; height: 2.5rem; flex-shrink: 0; border-radius: 0.8rem; background: #ffb34a; color: #172c52; box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.45); }
.vp-shop-hero strong { display: block; font-size: 0.8rem; }
.vp-shop-hero p { margin: 0.15rem 0 0; font-size: 0.625rem; opacity: 0.78; }
.vp-shop-notice { margin: -0.3rem 0 0.65rem; padding: 0.5rem 0.65rem; border-radius: 0.7rem; background: color-mix(in srgb, var(--vp-accent) 9%, var(--vp-surface)); }
.vp-shop-departments { display: flex; gap: 0.35rem; overflow-x: auto; margin: 0.65rem -0.75rem; padding: 0 0.75rem 0.2rem; scrollbar-width: none; }
.vp-shop-departments button { flex: 0 0 auto; min-height: 1.8rem; padding: 0 0.7rem; border-radius: 999px; background: var(--vp-surface); color: var(--vp-muted); box-shadow: inset 0 0 0 1px var(--vp-border); font-size: 0.625rem; font-weight: 650; }
.vp-shop-departments button[aria-pressed="true"] { background: var(--vp-accent); color: #fff; box-shadow: none; }
.vp-shop-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.55rem; }
.vp-shop-product { display: grid; min-width: 0; overflow: hidden; padding: 0 0 0.65rem; color: var(--vp-text); text-align: left; }
.vp-shop-product-thumb { display: flex; align-items: center; justify-content: center; aspect-ratio: 1.45 / 1; margin-bottom: 0.5rem; background: linear-gradient(145deg, color-mix(in srgb, var(--vp-accent) 9%, var(--vp-surface)), color-mix(in srgb, var(--vp-text) 3%, var(--vp-surface))); font-size: 2rem; }
.vp-shop-product > small, .vp-shop-product > strong, .vp-shop-product > span:not(.vp-shop-product-thumb), .vp-shop-product > em { margin-inline: 0.6rem; overflow: hidden; text-overflow: ellipsis; }
.vp-shop-product > small { color: var(--vp-muted); font-size: 0.55rem; white-space: nowrap; }
.vp-shop-product > strong { min-height: 2.1em; margin-top: 0.12rem; font-size: 0.7rem; line-height: 1.25; }
.vp-shop-product > span:not(.vp-shop-product-thumb) { margin-top: 0.35rem; color: var(--vp-accent); font-size: 0.75rem; font-weight: 750; }
.vp-shop-product > em { margin-top: 0.15rem; color: var(--vp-muted); font-size: 0.52rem; font-style: normal; white-space: nowrap; }
.vp-shop-product-detail { display: grid; gap: 0.55rem; }
.vp-shop-product-photo { display: flex; align-items: center; justify-content: center; min-height: 10rem; margin: -0.25rem -0.75rem 0.4rem; background: radial-gradient(circle, color-mix(in srgb, var(--vp-accent) 16%, var(--vp-surface)), var(--vp-surface)); font-size: 4.5rem; }
.vp-shop-product-detail h3, .vp-shop-product-detail p { margin: 0; }
.vp-shop-detail-price { color: var(--vp-accent); font-size: 1.2rem; }
.vp-shop-delivery { display: flex; align-items: center; gap: 0.65rem; margin-top: 0.35rem; padding: 0.7rem; border-radius: 0.8rem; background: var(--vp-surface); box-shadow: inset 0 0 0 1px var(--vp-border); }
.vp-shop-delivery svg { color: var(--vp-accent); }
.vp-shop-delivery div { display: grid; gap: 0.1rem; }
.vp-shop-delivery strong { font-size: 0.7rem; }
.vp-shop-delivery span { color: var(--vp-muted); font-size: 0.575rem; }
.vp-shop-product-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
.vp-shop-cart-summary { display: flex; justify-content: space-between; padding: 0.65rem 0.75rem; border-radius: 0.8rem; background: color-mix(in srgb, var(--vp-accent) 9%, var(--vp-surface)); font-size: 0.7rem; }
.vp-shop-cart-row { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 0.65rem; padding: 0.7rem; }
.vp-shop-cart-row > div { display: grid; gap: 0.15rem; min-width: 0; }
.vp-shop-cart-row small, .vp-shop-cart-row span { color: var(--vp-muted); font-size: 0.575rem; }
.vp-shop-cart-row > div > div { display: flex; align-items: center; justify-content: flex-end; gap: 0.45rem; margin-top: 0.35rem; }
.vp-shop-cart-row > div > div button:not(.vp-accent-btn) { color: var(--vp-muted); font-size: 0.6rem; }
.vp-shop-cart-row .vp-accent-btn { width: auto; min-height: 1.8rem; margin: 0; padding: 0 0.7rem; }
.vp-shop-order { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 0.65rem; width: 100%; padding: 0.65rem; color: var(--vp-text); text-align: left; }
.vp-shop-order > span { display: grid; min-width: 0; }
.vp-shop-order small { color: var(--vp-accent); font-size: 0.55rem; font-weight: 700; text-transform: uppercase; }
.vp-shop-order em { overflow: hidden; color: var(--vp-muted); font-size: 0.575rem; font-style: normal; text-overflow: ellipsis; white-space: nowrap; }
.vp-shop-order > svg { color: var(--vp-muted); }
.vp-shop-timeline { display: grid; gap: 0; margin: 0; padding: 0; border-radius: 1rem; background: var(--vp-surface); box-shadow: inset 0 0 0 1px var(--vp-border); list-style: none; }
.vp-shop-timeline li { position: relative; display: grid; grid-template-columns: 1.6rem 1fr; gap: 0.6rem; min-height: 4rem; padding: 0.75rem; }
.vp-shop-timeline li + li { border-top: 1px solid var(--vp-border); }
.vp-shop-timeline li > svg { width: 1.35rem; height: 1.35rem; padding: 0.25rem; border-radius: 999px; background: var(--vp-border); color: var(--vp-muted); }
.vp-shop-timeline li.is-complete > svg { background: var(--vp-accent); color: #fff; }
.vp-shop-timeline li > div { display: grid; gap: 0.18rem; }
.vp-shop-timeline li span { color: var(--vp-muted); font-size: 0.6rem; }
.vp-shop-timeline button { width: fit-content; margin: 0.4rem 0 0; }
.vp-shop-checkout { position: absolute; inset: auto 0.75rem 0.75rem; z-index: 8; box-shadow: 0 1rem 3rem rgb(0 0 0 / 0.45); }
.vp-pasta-tile.is-hinted { animation: vp-hint-pulse 0.9s ease-in-out infinite alternate; box-shadow: 0 0 0 0.18rem color-mix(in srgb, #ffd54a 75%, white), 0 0 1rem rgb(255 213 74 / 0.7); }
@keyframes vp-hint-pulse { to { transform: translateY(-0.12rem) scale(1.04); } }

/* Banking leads with the balance on a card face, and the log reads as a ledger. */
.vp-bank-card { position: relative; overflow: hidden; display: grid; gap: 0.25rem; padding: 1.125rem 1.25rem 1.25rem; border-radius: 1.25rem; color: #fff; background: linear-gradient(140deg, #065f46 0%, #047857 45%, #0f766e 100%); box-shadow: 0 2px 6px rgb(0 0 0 / 0.12), 0 16px 40px rgb(0 0 0 / 0.22); }
.vp-bank-card::after { content: ""; position: absolute; inset: -40% -20% auto auto; width: 14rem; height: 14rem; border-radius: 999px; background: rgb(255 255 255 / 0.08); pointer-events: none; }
.vp-bank-label { font-size: 0.625rem; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.75; }
.vp-bank-balance { font-size: 2.125rem; font-weight: 300; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; line-height: 1.1; }
.vp-bank-owner { font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.06em; opacity: 0.85; }
.vp-bank-summary { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
.vp-bank-summary button { display: grid; gap: 0.15rem; min-height: 3.5rem; padding: 0.65rem 0.75rem; border-radius: 0.9rem; background: var(--vp-surface); text-align: left; box-shadow: inset 0 0 0 1px var(--vp-border); }
.vp-bank-summary span { color: var(--vp-muted); font-size: 0.5625rem; font-weight: 650; text-transform: uppercase; letter-spacing: 0.05em; }
.vp-bank-summary strong { font-size: 0.8rem; font-variant-numeric: tabular-nums; }
.vp-bank-section-head { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
.vp-bank-section-head .vp-section-label { margin: 0; }
.vp-bank-section-head button { color: var(--vp-accent); font-size: 0.625rem; font-weight: 700; }
.vp-bank-recent { display: grid; gap: 0.45rem; }
.vp-bank-recent .vp-ledger-row { width: 100%; color: var(--vp-text); text-align: left; }
.vp-bank-history .vp-filter-tabs { margin-bottom: 0.15rem; }
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
/* A camera is a viewfinder with the controls under your thumb, not a page with a button in the
   middle of it. The viewfinder takes everything above the bar; framing marks, a rule-of-thirds
   grid and a focus frame sit on top of it and get out of the way while a shot is being reviewed. */
.vp-camera { padding-bottom: 0.875rem; }
.vp-viewfinder { position: relative; flex: 1; min-height: 6rem; display: flex; align-items: center; justify-content: center; overflow: hidden; padding: 1rem; border-radius: 1rem; background: radial-gradient(120% 90% at 50% 40%, #171a1f, #08090b); box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.08); }
.vp-viewfinder::before { content: ""; position: absolute; inset: 0; pointer-events: none; background-image: linear-gradient(90deg, transparent calc(33.33% - 0.5px), rgb(255 255 255 / 0.1) calc(33.33% - 0.5px) calc(33.33% + 0.5px), transparent calc(33.33% + 0.5px)), linear-gradient(90deg, transparent calc(66.66% - 0.5px), rgb(255 255 255 / 0.1) calc(66.66% - 0.5px) calc(66.66% + 0.5px), transparent calc(66.66% + 0.5px)), linear-gradient(0deg, transparent calc(33.33% - 0.5px), rgb(255 255 255 / 0.1) calc(33.33% - 0.5px) calc(33.33% + 0.5px), transparent calc(33.33% + 0.5px)), linear-gradient(0deg, transparent calc(66.66% - 0.5px), rgb(255 255 255 / 0.1) calc(66.66% - 0.5px) calc(66.66% + 0.5px), transparent calc(66.66% + 0.5px)); }
.vp-viewfinder::after { content: ""; position: absolute; inset: 0.75rem; pointer-events: none; background:
  linear-gradient(var(--vp-accent), var(--vp-accent)) 0 0 / 1rem 2px no-repeat,
  linear-gradient(var(--vp-accent), var(--vp-accent)) 0 0 / 2px 1rem no-repeat,
  linear-gradient(var(--vp-accent), var(--vp-accent)) 100% 0 / 1rem 2px no-repeat,
  linear-gradient(var(--vp-accent), var(--vp-accent)) 100% 0 / 2px 1rem no-repeat,
  linear-gradient(var(--vp-accent), var(--vp-accent)) 0 100% / 1rem 2px no-repeat,
  linear-gradient(var(--vp-accent), var(--vp-accent)) 0 100% / 2px 1rem no-repeat,
  linear-gradient(var(--vp-accent), var(--vp-accent)) 100% 100% / 1rem 2px no-repeat,
  linear-gradient(var(--vp-accent), var(--vp-accent)) 100% 100% / 2px 1rem no-repeat;
  opacity: 0.8; }
.vp-viewfinder--review::before, .vp-viewfinder--review::after { display: none; }
.vp-viewfinder-text { max-width: 15rem; text-align: center; font-style: italic; }
.vp-viewfinder-edit { width: 100%; height: 100%; padding: 0; border: 0; background: none; resize: none; color: #f2f4f8; font: inherit; font-size: 0.8125rem; line-height: 1.5; }
.vp-camera-aim-row { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.625rem; }
.vp-camera-subject { display: block; flex: 1; min-width: 0; }
.vp-camera-aim-row .vp-icon-btn { flex-shrink: 0; color: var(--vp-text); }
.vp-camera-bar { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-shrink: 0; margin-top: 0.75rem; padding: 0 0.25rem; }
/* Discard / Keep share the bar evenly instead of one of them wrapping onto two lines. */
.vp-camera-bar > .vp-surface-btn, .vp-camera-bar > .vp-accent-btn { flex: 1; min-height: 2.5rem; white-space: nowrap; }
/* The last shot, as a thumbnail you can press to open the roll. */
.vp-camera-thumb { display: flex; align-items: flex-end; height: 2.75rem; width: 2.75rem; padding: 0.25rem; overflow: hidden; border-radius: 0.5rem; background: linear-gradient(180deg, #fffdf2, #efe6c8); color: #4a4433; font-size: 0.4375rem; line-height: 1.15; text-align: left; box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.25), 0 2px 6px rgb(0 0 0 / 0.35); }
.vp-camera-thumb:disabled { background: color-mix(in srgb, var(--vp-text) 8%, var(--vp-bg)); box-shadow: inset 0 0 0 1px var(--vp-border); opacity: 1; }
.vp-camera-count { min-width: 2.75rem; text-align: right; font-size: 0.625rem; font-weight: 600; color: var(--vp-muted); font-variant-numeric: tabular-nums; }
.vp-roll-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 2px; margin: 0 -0.75rem; overflow-y: auto; }
.vp-camera-roll-cell { position: relative; display: flex; align-items: flex-end; aspect-ratio: 1; overflow: hidden; padding: 0.45rem; background: linear-gradient(155deg, #343942, #111318 72%); color: #f5f7fa; text-align: left; box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.06); }
.vp-camera-roll-cell:nth-child(3n + 2) { background: linear-gradient(155deg, #3d352f, #151311 72%); }
.vp-camera-roll-cell:nth-child(3n) { background: linear-gradient(155deg, #303a38, #101514 72%); }
.vp-camera-roll-cell > span { display: -webkit-box; overflow: hidden; font-size: 0.5625rem; line-height: 1.25; text-shadow: 0 1px 3px #000; -webkit-line-clamp: 4; -webkit-box-orient: vertical; }
.vp-camera-roll-cell > svg { position: absolute; top: 0.4rem; right: 0.4rem; color: #ffd65a; filter: drop-shadow(0 1px 2px #000); }
.vp-camera-photo { display: flex; flex: 1; min-height: 0; flex-direction: column; gap: 0.75rem; }
.vp-camera-photo-frame { position: relative; display: flex; flex: 1; min-height: 10rem; align-items: center; justify-content: center; padding: 1.25rem; border-radius: 1rem; background: radial-gradient(100% 80% at 50% 38%, #343942, #0b0c0f); box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.08); }
.vp-camera-photo-frame p { max-width: 16rem; margin: 0; color: #f5f7fa; font-size: 0.875rem; font-style: italic; line-height: 1.55; text-align: center; }
.vp-camera-photo-frame > svg { position: absolute; top: 0.75rem; right: 0.75rem; color: #ffd65a; }
.vp-camera-photo-meta { display: flex; justify-content: space-between; gap: 0.75rem; color: var(--vp-muted); font-size: 0.5625rem; }
.vp-camera-pager { display: flex; align-items: center; justify-content: center; gap: 0.75rem; color: var(--vp-muted); font-size: 0.625rem; }
.vp-camera-photo-actions { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.375rem; }
.vp-camera-photo-actions .vp-surface-btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.25rem; min-width: 0; padding-inline: 0.35rem; font-size: 0.5625rem; }
.vp-camera-photo-actions .vp-camera-delete { color: #ff8a86; }
.vp-shutter-row { display: flex; justify-content: center; margin-top: 0.875rem; }
.vp-shutter { position: relative; height: 3.75rem; width: 3.75rem; flex-shrink: 0; border-radius: 999px; background: #fff; box-shadow: 0 0 0 3px rgb(255 255 255 / 0.35), 0 2px 10px rgb(0 0 0 / 0.4); transition: transform 120ms ease, background 120ms ease; }
.vp-shutter:active:not(:disabled) { background: #d9d9d9; }
.vp-shutter:active:not(:disabled) { transform: scale(0.9); }
.vp-polaroid { display: grid; gap: 0.375rem; }
.vp-polaroid p { margin: 0; font-size: 0.75rem; line-height: 1.5; font-style: italic; }
.vp-polaroid figcaption { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; font-size: 0.5625rem; font-weight: 500; color: var(--vp-muted); }
/* The delete control is a footnote on a photo, not a page-wide button. */
.vp-polaroid figcaption .vp-surface-btn { width: auto; min-height: 1.5rem; padding: 0 0.5rem; margin: 0; font-size: 0.5625rem; }
.vp-noodlerr-subrow { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }
.vp-noodlerr-locked { display: flex; align-items: center; justify-content: center; gap: 0.5rem; min-height: 4rem; font-size: 0.75rem; font-weight: 600; color: var(--vp-muted); border-style: dashed; box-shadow: inset 0 0 0 1.5px var(--vp-border); }
.vp-noodlerr-alert { margin: 0 0 0.625rem; padding: 0.625rem 0.75rem; border-radius: 0.75rem; background: color-mix(in srgb, #e34843 12%, var(--vp-surface)); color: var(--vp-text); font-size: 0.6875rem; line-height: 1.4; box-shadow: inset 0 0 0 1px color-mix(in srgb, #e34843 28%, transparent); }
.vp-noodlerr-intro { display: flex; align-items: center; gap: 0.625rem; margin-bottom: 0.75rem; padding: 0.75rem; border-radius: 1rem; background: linear-gradient(135deg, color-mix(in srgb, var(--vp-accent) 18%, var(--vp-surface)), var(--vp-surface)); box-shadow: inset 0 0 0 1px var(--vp-border); }
.vp-noodlerr-intro > svg { flex-shrink: 0; color: var(--vp-accent); }
.vp-noodlerr-intro div { display: grid; gap: 0.125rem; }
.vp-noodlerr-intro strong { font-size: 0.75rem; }
.vp-noodlerr-intro span { color: var(--vp-muted); font-size: 0.625rem; }
.vp-noodlerr-creator { display: flex; align-items: center; gap: 0.625rem; width: 100%; min-height: 4rem; padding: 0.625rem; border-radius: 1rem; background: var(--vp-surface); text-align: left; box-shadow: inset 0 0 0 1px var(--vp-border), 0 4px 12px rgb(0 0 0 / 0.06); }
.vp-noodlerr-creator > span:nth-child(2) { display: grid; gap: 0.15rem; flex: 1; min-width: 0; }
.vp-noodlerr-creator strong, .vp-noodlerr-creator small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vp-noodlerr-creator strong { font-size: 0.75rem; }
.vp-noodlerr-creator small { color: var(--vp-muted); font-size: 0.625rem; }
.vp-noodlerr-creator > span:last-child { color: var(--vp-muted); font-size: 1.25rem; }
.vp-noodlerr-page { gap: 0.75rem; }
.vp-noodlerr-hero { display: grid; align-content: end; min-height: 8.5rem; padding: 1rem; border-radius: 1.25rem; color: #fff; box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.14), 0 8px 24px rgb(0 0 0 / 0.18); }
.vp-noodlerr-hero h3 { margin: 0.2rem 0; font-size: 1.35rem; letter-spacing: -0.025em; }
.vp-noodlerr-hero p { max-width: 15rem; margin: 0; color: rgb(255 255 255 / 0.82); font-size: 0.6875rem; line-height: 1.4; }
.vp-noodlerr-kicker { font-size: 0.5rem; font-weight: 800; letter-spacing: 0.13em; opacity: 0.75; }
.vp-noodlerr-membership { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 0.75rem; border-radius: 1rem; background: var(--vp-surface); box-shadow: inset 0 0 0 1px var(--vp-border); }
.vp-noodlerr-membership > span { display: grid; gap: 0.1rem; }
.vp-noodlerr-membership strong { font-size: 0.8125rem; }
.vp-noodlerr-membership small { color: var(--vp-muted); font-size: 0.5625rem; }
.vp-noodlerr-membership button { min-height: 2rem; padding: 0 0.75rem; font-size: 0.625rem; }
.vp-noodlerr-post { padding: 0.875rem; border-radius: 1rem; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 98%, #fff), var(--vp-surface)); box-shadow: inset 0 0 0 1px var(--vp-border), 0 5px 14px rgb(0 0 0 / 0.07); }
.vp-noodlerr-post p { margin: 0.625rem 0 0; font-size: 0.75rem; line-height: 1.55; white-space: pre-wrap; }
.vp-noodlerr-postmeta { display: flex; align-items: center; justify-content: space-between; color: var(--vp-accent); font-size: 0.5rem; font-weight: 800; letter-spacing: 0.08em; }
.vp-noodlerr-postmeta button { display: inline-flex; padding: 0.2rem; color: var(--vp-accent); }
.vp-noodlerr-post--locked { display: grid; justify-items: center; gap: 0.3rem; min-height: 6.5rem; align-content: center; color: var(--vp-muted); text-align: center; background: repeating-linear-gradient(135deg, color-mix(in srgb, var(--vp-accent) 5%, var(--vp-surface)) 0 8px, var(--vp-surface) 8px 16px); }
.vp-noodlerr-post--locked strong { color: var(--vp-text); font-size: 0.75rem; }
.vp-noodlerr-post--locked span { max-width: 13rem; font-size: 0.625rem; line-height: 1.4; }
.vp-app-icon--default { background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 92%, #ffffff), var(--vp-surface)); color: var(--vp-text); }
.vp-app-label { max-width: 100%; font-size: 0.625rem; font-weight: 550; line-height: 1.15; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 0 1px 4px rgb(0 0 0 / 0.1); }

.vp-appview { position: absolute; inset: 0; z-index: 10; overflow-y: auto; background: var(--vp-bg); padding: 1rem 0.75rem 1.625rem; animation: vp-app-in 200ms cubic-bezier(0.2, 0.9, 0.3, 1); }
.vp-appview[data-phone-app] { --vp-app-wash: transparent; background: linear-gradient(180deg, var(--vp-app-wash), transparent 8rem), var(--vp-bg); }
.vp-appview[data-phone-app="app-store"] { --vp-accent: #1687f8; --vp-app-wash: color-mix(in srgb, #1687f8 9%, transparent); }
.vp-appview[data-phone-app="calls"] { --vp-accent: #20ad58; --vp-app-wash: color-mix(in srgb, #20ad58 7%, transparent); }
.vp-appview[data-phone-app="messages"] { --vp-accent: #25b957; --vp-app-wash: color-mix(in srgb, #25b957 6%, transparent); }
.vp-appview[data-phone-app="contacts"] { --vp-accent: #159f98; --vp-app-wash: color-mix(in srgb, #159f98 7%, transparent); }
.vp-appview[data-phone-app="mail"] { --vp-accent: #277bd8; --vp-app-wash: color-mix(in srgb, #277bd8 7%, transparent); }
.vp-appview[data-phone-app="goodle"] { --vp-accent: #e74c42; --vp-app-wash: color-mix(in srgb, #e74c42 6%, transparent); }
.vp-appview[data-phone-app="maps"] { --vp-accent: #18875a; }
.vp-appview[data-phone-app="find"] { --vp-accent: #347ed5; --vp-app-wash: color-mix(in srgb, #347ed5 7%, transparent); }
.vp-appview[data-phone-app="camera"] { --vp-accent: #e5e9ef; --vp-bg: #090a0d; --vp-surface: #17191e; --vp-text: #f5f7fa; --vp-muted: #a4aab5; --vp-border: #2a2e36; }
.vp-appview[data-phone-app="gallery"] { --vp-accent: #c75ccb; --vp-app-wash: color-mix(in srgb, #c75ccb 7%, transparent); }
.vp-appview[data-phone-app="notes"] { --vp-accent: #c98a08; --vp-app-wash: color-mix(in srgb, #f4be32 10%, transparent); }
.vp-appview[data-phone-app="noodler"] { --vp-accent: #7c54e8; --vp-app-wash: color-mix(in srgb, #7c54e8 7%, transparent); }
.vp-appview[data-phone-app="noodler-r"] { --vp-accent: #e34591; --vp-app-wash: color-mix(in srgb, #e34591 8%, transparent); }
.vp-appview[data-phone-app="tindler"] { --vp-accent: #f13c70; --vp-app-wash: color-mix(in srgb, #f13c70 8%, transparent); }
.vp-appview[data-phone-app="banking"] { --vp-accent: #078365; --vp-app-wash: color-mix(in srgb, #078365 8%, transparent); }
.vp-appview[data-phone-app="bazaar"] { --vp-accent: #a96824; --vp-app-wash: color-mix(in srgb, #a96824 8%, transparent); }
.vp-appview.vp-shop { --vp-accent: #266cb0; background: linear-gradient(180deg, color-mix(in srgb, #266cb0 8%, transparent), transparent 8rem), var(--vp-bg); }
.vp-appview[data-phone-app="game"] { --vp-accent: #dc4749; --vp-app-wash: color-mix(in srgb, #dc4749 8%, transparent); }
.vp-appview[data-phone-app="settings"] { --vp-accent: #677387; --vp-app-wash: color-mix(in srgb, #677387 7%, transparent); }
@keyframes vp-app-in { from { opacity: 0; transform: scale(0.96) translateY(8px); } }
.vp-appview--loading { font-size: 0.75rem; }
.vp-appview--fixed { display: flex; flex-direction: column; overflow: hidden; }
.vp-appview--fixed .vp-app-header { position: static; flex-shrink: 0; }
.vp-app-header { position: sticky; top: -1rem; z-index: 5; display: grid; grid-template-columns: minmax(2.5rem, 1fr) minmax(0, auto) minmax(2.5rem, 1fr); align-items: center; gap: 0.5rem; min-height: 2.75rem; margin: -1rem -0.75rem 0.875rem; padding: 0.25rem 0.375rem; border-bottom: 1px solid var(--vp-border); background: var(--vp-bg); }
.vp-app-header > .vp-icon-btn:first-child { justify-self: start; }
.vp-app-header-mid { display: flex; align-items: center; justify-content: center; min-width: 0; }
.vp-app-header h2 { min-width: 0; margin: 0; text-align: center; font-size: 1rem; font-weight: 650; letter-spacing: -0.01em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vp-app-header-actions { justify-self: end; }
/* Header icons need a gap you can see and aim between; 2px read as one wide button. */
.vp-app-header-actions { display: flex; align-items: center; gap: 0.375rem; flex-shrink: 0; }
.vp-app-error { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; text-align: center; font-size: 0.8125rem; font-weight: 500; }
.vp-app-error .vp-surface-btn { width: auto; padding: 0 1.5rem; }
.vp-app-title-spacer { width: 2.75rem; flex-shrink: 0; }
.vp-stack { display: grid; gap: 0.625rem; font-size: 0.8125rem; }
.vp-section-label { margin: 0 0 0.375rem; padding-left: 0.875rem; font-size: 0.625rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--vp-muted); }
.vp-section-label--spaced { margin-top: 0.875rem; }
.vp-settings-sections .vp-section-label { margin-bottom: 0; }
.vp-field { display: grid; gap: 0.375rem; }
.vp-field > span { padding-left: 0.25rem; font-weight: 500; }
.vp-input, .vp-select { width: 100%; min-height: 2.75rem; padding: 0 0.75rem; border: 0; border-radius: 0.75rem; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 97%, #ffffff), var(--vp-surface)); color: var(--vp-text); font: inherit; box-shadow: 0 1px 2px rgb(0 0 0 / 0.05), inset 0 0 0 1px var(--vp-border); }
.vp-textarea { width: 100%; min-height: 12rem; padding: 0.75rem; border: 0; border-radius: 1rem; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 97%, #ffffff), var(--vp-surface)); color: var(--vp-text); font: inherit; font-size: 0.8125rem; line-height: 1.5; resize: vertical; box-shadow: 0 1px 2px rgb(0 0 0 / 0.05), inset 0 0 0 1px var(--vp-border); }
.vp-check { display: flex; align-items: center; gap: 0.75rem; min-height: 2.875rem; padding: 0 0.875rem; border-radius: 0.875rem; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 97%, #ffffff), var(--vp-surface)); font-weight: 500; box-shadow: 0 1px 2px rgb(0 0 0 / 0.05), inset 0 0 0 1px var(--vp-border); }
.vp-check input { height: 1.25rem; width: 1.25rem; accent-color: var(--vp-accent); }
.vp-textarea--fill { flex: 1; min-height: 0; resize: none; }
.vp-group { border-radius: 1rem; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 97%, #ffffff), var(--vp-surface)); box-shadow: 0 1px 2px rgb(0 0 0 / 0.05), 0 4px 12px rgb(0 0 0 / 0.05), inset 0 0 0 1px var(--vp-border); overflow: hidden; }
.vp-group > * + * { border-top: 1px solid var(--vp-border); }
/* Copy dropped into a group is not a row and had no padding, so it touched the rounded edge. */
.vp-group > .vp-muted-note, .vp-group > p { margin: 0; padding: 0.5rem 0.75rem; line-height: 1.4; }
.vp-row { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; width: 100%; min-height: 2.75rem; padding: 0.375rem 0.75rem; font-size: 0.75rem; font-weight: 500; text-align: left; }
.vp-row > span:first-child { flex-shrink: 0; }
.vp-row-control { flex: 1; min-width: 0; max-width: 55%; min-height: 2.125rem; padding: 0 0.625rem; border: 0; border-radius: 0.625rem; background: color-mix(in srgb, var(--vp-text) 6%, var(--vp-surface)); color: var(--vp-text); font: inherit; font-size: 0.75rem; }
.vp-switch { appearance: none; width: 2.75rem; height: 1.6875rem; flex-shrink: 0; margin: 0; border-radius: 999px; background: color-mix(in srgb, var(--vp-text) 18%, var(--vp-bg)); position: relative; cursor: pointer; transition: background 160ms ease; box-shadow: inset 0 1px 2px rgb(0 0 0 / 0.08); }
.vp-switch::before { content: ""; position: absolute; top: 2px; left: 2px; height: calc(1.6875rem - 4px); aspect-ratio: 1; border-radius: 999px; background: #fff; box-shadow: 0 1px 3px rgb(0 0 0 / 0.25); transition: translate 160ms ease; }
.vp-switch:checked { background: #34c759; }
.vp-switch:checked::before { translate: 1.0625rem 0; }
.vp-setting-toggle { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; min-height: 3.5rem; padding: 0.5rem 0.75rem; }
.vp-setting-copy { display: grid; gap: 0.125rem; min-width: 0; }
.vp-setting-copy > span { font-size: 0.75rem; font-weight: 600; }
.vp-setting-copy small { color: var(--vp-muted); font-size: 0.625rem; font-weight: 500; line-height: 1.3; }
.vp-settings-alert { margin: 0 0 0.625rem; padding: 0.5rem 0.75rem; border-radius: 0.625rem; background: color-mix(in srgb, #ff3b30 10%, var(--vp-surface)); color: #d92d20; font-size: 0.6875rem; }
.vp-settings-scroll { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding-bottom: 0.75rem; }
.vp-settings-sections { display: grid; gap: 1.125rem; }
.vp-settings-sections section { display: grid; gap: 0.5rem; }
.vp-settings-footnote { margin: 0; padding: 0 0.65rem; color: var(--vp-muted); font-size: 0.6rem; line-height: 1.4; }
.vp-settings-heading { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; padding-inline-end: 0.75rem; }
.vp-settings-heading > span { color: var(--vp-muted); font-size: 0.625rem; font-weight: 650; }
.vp-lore-picker { display: grid; gap: 0.5rem; padding: 0.5rem; overflow: visible; }
.vp-lore-picker > * + * { border-top: 0; }
.vp-segmented { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.25rem; padding: 0.1875rem; border-radius: 0.625rem; background: color-mix(in srgb, var(--vp-text) 7%, var(--vp-surface)); }
.vp-segmented button { min-height: 2rem; border-radius: 0.5rem; color: var(--vp-muted); font-size: 0.6875rem; font-weight: 650; }
.vp-segmented button[aria-pressed="true"] { background: var(--vp-accent); color: #fff; }
.vp-lore-search { display: flex; align-items: center; gap: 0.5rem; min-height: 2.375rem; padding: 0 0.625rem; border-radius: 0.625rem; background: color-mix(in srgb, var(--vp-text) 5%, var(--vp-surface)); color: var(--vp-muted); }
.vp-lore-search input { min-width: 0; width: 100%; border: 0; outline: 0; background: none; color: var(--vp-text); font: inherit; font-size: 0.75rem; }
.vp-lore-list { max-height: 12rem; overflow-y: auto; overscroll-behavior: contain; border-radius: 0.625rem; box-shadow: inset 0 0 0 1px var(--vp-border); }
.vp-lore-option { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; min-height: 2.5rem; padding: 0.375rem 0.625rem; font-size: 0.6875rem; font-weight: 550; }
.vp-lore-option + .vp-lore-option { border-top: 1px solid var(--vp-border); }
/* The row says why a book is in this chat, so choosing what grounds a phone is not guesswork. */
.vp-lore-option span { display: grid; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vp-lore-option small { font-size: 0.5625rem; font-weight: 600; letter-spacing: 0.02em; text-transform: uppercase; color: var(--vp-muted); }
/* What is actually grounding this phone, named. "This chat" is otherwise a promise you cannot check. */
.vp-lore-inplay { display: grid; gap: 0.25rem; margin: 0.5rem 0 0; padding: 0; list-style: none; }
.vp-lore-inplay li { display: flex; align-items: baseline; justify-content: space-between; gap: 0.5rem; font-size: 0.6875rem; font-weight: 550; }
.vp-lore-inplay small { flex-shrink: 0; font-size: 0.5625rem; font-weight: 600; letter-spacing: 0.02em; text-transform: uppercase; color: var(--vp-muted); }
.vp-lore-more { width: 100%; min-height: 2.25rem; padding: 0 0.625rem; border-top: 1px solid var(--vp-border); font-size: 0.625rem; font-weight: 650; color: var(--vp-accent); text-align: left; }
.vp-lore-option input { height: 1.125rem; width: 1.125rem; flex-shrink: 0; accent-color: var(--vp-accent); }
.vp-lore-summary { margin: 0; padding: 0.375rem 0.5rem 0.25rem; color: var(--vp-muted); font-size: 0.6875rem; line-height: 1.4; }
.vp-row--stacked { flex-wrap: wrap; }
.vp-row--stacked .vp-range { width: 100%; min-height: 2.125rem; }
.vp-row--danger { justify-content: center; gap: 0.5rem; color: #ff3b30; font-weight: 600; transition: background 120ms ease; }
/* Centred like a danger row, but for a reset that destroys nothing. */
.vp-row--action { justify-content: center; gap: 0.5rem; color: var(--vp-accent); font-weight: 600; transition: background 120ms ease; }
.vp-row--action:hover:not(:disabled) { background: color-mix(in srgb, var(--vp-accent) 8%, var(--vp-surface)); }
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
.vp-appview > .vp-muted-note[role="alert"], .vp-appview > .vp-muted-note[role="status"] { display: block; margin-bottom: 0.625rem; }
.vp-search-row { display: flex; gap: 0.5rem; }
.vp-search-row label { flex: 1; min-width: 0; }
/* A row of pills is a control for what is under it, so it needs air on both sides — with only a
   top margin the Mail folder tabs sat flush on the first row of the list. */
.vp-chip-row { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0.25rem 0 0.875rem; }
.vp-chip-row:last-child { margin-bottom: 0.25rem; }
.vp-chip { display: inline-flex; align-items: center; max-width: 100%; min-height: 1.875rem; padding: 0 0.75rem; border-radius: 999px; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 97%, #ffffff), var(--vp-surface)); font-size: 0.6875rem; font-weight: 500; box-shadow: 0 1px 2px rgb(0 0 0 / 0.06), inset 0 0 0 1px var(--vp-border); transition: transform 120ms ease; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vp-chip:active { transform: scale(0.96); }
.vp-chip--active { background: var(--vp-accent); color: #fff; box-shadow: none; }
.vp-post-image { display: block; width: 100%; margin-top: 0.5rem; border-radius: 0.75rem; }
.vp-game { position: relative; }
.vp-game-loading { display: grid; min-height: 20rem; place-items: center; color: var(--vp-muted); font-size: 0.75rem; }
.vp-game-head { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 0.5rem; padding: 0.625rem 0.25rem 0.875rem; text-align: center; }
.vp-game-head span { display: flex; flex-direction: column; gap: 0.125rem; min-width: 0; color: var(--vp-muted); }
.vp-game-head span:last-child { align-items: flex-end; text-align: right; }
.vp-game-head span:first-child { align-items: flex-start; text-align: left; }
.vp-game-head strong { display: inline-flex; align-items: center; gap: 0.25rem; color: var(--vp-text); font-size: 1rem; font-variant-numeric: tabular-nums; }
.vp-game-head small { font-size: 0.5625rem; font-weight: 650; text-transform: uppercase; letter-spacing: 0.09em; }
.vp-game-head .vp-game-moves { min-width: 4.25rem; padding: 0.35rem 0.8rem; border-radius: 999px; background: color-mix(in srgb, var(--vp-accent) 11%, var(--vp-surface)); color: var(--vp-accent); }
.vp-game-head .vp-game-moves strong { align-self: center; color: var(--vp-accent); font-size: 1.15rem; }
.vp-pasta-stage { position: relative; }
.vp-pasta-board { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 0.3rem; padding: 0.55rem; border-radius: 1.125rem; background: linear-gradient(145deg, #202d42, #172234); box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.12), 0 10px 22px rgb(10 18 30 / 0.18); touch-action: none; user-select: none; }
.vp-pasta-tile { display: flex; align-items: center; justify-content: center; aspect-ratio: 1; min-width: 0; border: 0; border-radius: 0.625rem; cursor: pointer; font-size: clamp(1rem, 5.7vw, 1.4rem); line-height: 1; box-shadow: inset 0 -0.16rem 0 rgb(0 0 0 / 0.17), inset 0 1px 0 rgb(255 255 255 / 0.28), 0 0.12rem 0.18rem rgb(0 0 0 / 0.2); transition: transform 120ms ease, box-shadow 120ms ease, filter 120ms ease; -webkit-tap-highlight-color: transparent; }
.vp-pasta-tile:hover { filter: brightness(1.06); }
.vp-pasta-tile:active { transform: scale(0.92); }
.vp-pasta-tile.is-selected { transform: scale(1.08); box-shadow: 0 0 0 0.16rem #fff, 0 0.2rem 0.35rem rgb(0 0 0 / 0.3); }
.vp-pasta-tile.is-hinted { animation: vp-game-hint 900ms ease-in-out infinite alternate; }
@keyframes vp-game-hint { to { transform: scale(1.08); box-shadow: 0 0 0 0.14rem rgb(255 255 255 / 0.9), 0 0 0.8rem rgb(255 255 255 / 0.55); } }
.vp-pasta-tile--red { background: #ef6461; } .vp-pasta-tile--yellow { background: #f2c14e; } .vp-pasta-tile--green { background: #5dbb78; } .vp-pasta-tile--blue { background: #5c9ded; } .vp-pasta-tile--pink { background: #db78b7; }
.vp-pasta-tile:disabled { cursor: default; filter: saturate(0.7); }
.vp-pasta-over { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem; border-radius: 1.125rem; background: rgb(15 22 34 / 0.88); color: #fff; backdrop-filter: blur(5px); }
.vp-pasta-over small { color: #cdd6e4; font-size: 0.625rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; }
.vp-pasta-over strong { font-size: 1.25rem; } .vp-pasta-over span { color: #cdd6e4; font-size: 0.72rem; font-variant-numeric: tabular-nums; }
.vp-pasta-flash { display: grid; min-height: 2.65rem; margin: 0; place-items: center; padding: 0.45rem; text-align: center; font-size: 0.72rem; font-weight: 600; line-height: 1.35; color: var(--vp-accent); }
.vp-game-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
.vp-game-actions .vp-surface-btn { min-height: 2.5rem; padding: 0 0.5rem; font-size: 0.7rem; }
.vp-game-rules { margin-top: 0.625rem; padding: 0.75rem; border-radius: 0.875rem; background: var(--vp-surface); box-shadow: inset 0 0 0 1px var(--vp-border); }
.vp-game-rules strong { font-size: 0.75rem; }
.vp-game-rules p { margin: 0.3rem 0; color: var(--vp-muted); font-size: 0.6875rem; line-height: 1.45; }
.vp-game-rules small, .vp-game-history { color: var(--vp-muted); font-size: 0.625rem; }
.vp-game-history { margin: 0.75rem 0 0; text-align: center; }
.vp-game-dialog-backdrop { position: absolute; z-index: 6; inset: 0; display: grid; align-items: end; padding: 0.75rem; background: rgb(0 0 0 / 0.35); backdrop-filter: blur(2px); }
.vp-game-dialog { display: grid; gap: 0.75rem; padding: 1rem; border-radius: 1.125rem; background: var(--vp-surface); box-shadow: 0 18px 50px rgb(0 0 0 / 0.3); }
.vp-game-dialog > strong { font-size: 1rem; }
.vp-game-dialog > p { margin: 0; color: var(--vp-muted); font-size: 0.72rem; line-height: 1.45; }
.vp-game-dialog > div { display: grid; grid-template-columns: 1fr auto; gap: 0.5rem; }
.vp-game-dialog .vp-accent-btn { border-radius: 0.75rem; }
@media (prefers-reduced-motion: reduce) { .vp-pasta-tile.is-hinted { animation: none; box-shadow: 0 0 0 0.16rem #fff; } }
.vp-az-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.625rem; }
.vp-az-product { display: flex; flex-direction: column; gap: 0.35rem; padding: 0.7rem; }
.vp-az-product .vp-section-label { font-size: 0.6rem; }
.vp-az-product h3 { margin: 0; font-size: 0.85rem; line-height: 1.25; }
.vp-az-product p { margin: 0; color: var(--vp-muted); font-size: 0.72rem; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.vp-az-buy { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; margin-top: auto; padding-top: 0.35rem; }
.vp-az-buy strong { color: var(--vp-accent); font-size: 0.95rem; }
/* Notes uses a dense library, not a gallery of decorative sticky notes. The title, preview and
   timestamp carry distinct information and remain scannable on the phone's narrow viewport. */
.vp-notes-controls { display: grid; gap: 0.625rem; margin-bottom: 0.875rem; }
.vp-notes-library { display: grid; gap: 1rem; padding-bottom: 4rem; }
.vp-notes-section { display: grid; gap: 0.375rem; }
.vp-notes-section > .vp-section-label { margin: 0 0 0 0.75rem; }
.vp-notes-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.625rem; }
.vp-note-card { position: relative; display: grid; align-content: start; min-height: 7.25rem; padding: 0.75rem 0.7rem 1.2rem 1.1rem; overflow: hidden; border-radius: 0.35rem 0.9rem 0.9rem 0.35rem; color: #3a3320; background: linear-gradient(165deg, #fffef7 0%, #fff7d9 68%, #f6e9b9 100%); text-align: left; box-shadow: 0 1px 2px rgb(0 0 0 / 0.16), 0 7px 15px rgb(0 0 0 / 0.18); transition: transform 120ms ease, box-shadow 140ms ease; }
.vp-note-card::before, .vp-note-sheet::before { content: ""; position: absolute; inset: 0 auto 0 0; width: 0.35rem; background: repeating-linear-gradient(180deg, #e5d49c 0 3px, #f4e8bb 3px 7px); box-shadow: inset -1px 0 rgb(0 0 0 / 0.08); }
.vp-note-card:hover { transform: translateY(-1px) rotate(-0.25deg); box-shadow: 0 2px 4px rgb(0 0 0 / 0.18), 0 11px 21px rgb(0 0 0 / 0.22); }
.vp-note-card:nth-child(even):hover { transform: translateY(-1px) rotate(0.25deg); }
.vp-note-card:active { transform: scale(0.97); }
.vp-note-card-copy { display: grid; gap: 0.3rem; min-width: 0; }
.vp-note-card-copy strong { padding-right: 0.9rem; overflow: hidden; font-size: 0.82rem; font-weight: 700; line-height: 1.25; text-overflow: ellipsis; white-space: nowrap; }
.vp-note-card-copy > span { display: -webkit-box; overflow: hidden; color: #6b6244; font-size: 0.7rem; line-height: 1.4; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }
.vp-note-card-copy small { position: absolute; right: 0.65rem; bottom: 0.48rem; left: 1.1rem; overflow: hidden; color: #94865d; font-size: 0.55rem; text-overflow: ellipsis; white-space: nowrap; }
.vp-note-pin { position: absolute; top: 0.65rem; right: 0.6rem; color: #a68021; }
.vp-note-editor { display: flex; flex: 1; min-height: 0; flex-direction: column; }
.vp-note-sheet { position: relative; display: flex; flex: 1; min-height: 0; flex-direction: column; overflow: hidden; border-radius: 0.35rem 0.9rem 0.9rem 0.35rem; color: #3a3320; background-color: #fffdf2; background-image: linear-gradient(90deg, transparent 2.15rem, rgb(205 91 91 / 0.22) 2.15rem 2.2rem, transparent 2.2rem); box-shadow: 0 1px 2px rgb(0 0 0 / 0.16), 0 8px 18px rgb(0 0 0 / 0.2); }
.vp-note-title-input { width: 100%; border: 0; padding: 1rem 0.9rem 0.7rem 2.55rem; color: #3a3320; background: transparent; font: inherit; font-size: 1.25rem; font-weight: 750; letter-spacing: -0.025em; }
.vp-note-title-input::placeholder { color: #a89c72; }
.vp-note-title-input:focus, .vp-note-paper:focus { outline: 0; }
.vp-note-paper { flex: 1; min-height: 0; width: 100%; padding: 0.2rem 0.9rem 0.75rem 2.55rem; border: 0; resize: none; color: #3a3320; background: repeating-linear-gradient(180deg, transparent 0 calc(1.5rem - 1px), rgb(58 51 32 / 0.12) calc(1.5rem - 1px) 1.5rem); background-position: 0 0.1rem; font: inherit; font-size: 0.8125rem; line-height: 1.5rem; }
.vp-note-paper::placeholder { color: #a89c72; }
.vp-note-sheet:focus-within { outline: 2px solid var(--vp-accent); outline-offset: 2px; }
.vp-note-tools { display: flex; gap: 0.25rem; padding: 0.5rem 0; border-top: 1px solid var(--vp-border); }
.vp-note-tools button { display: inline-flex; align-items: center; gap: 0.25rem; min-height: 2rem; padding: 0 0.6rem; border-radius: 999px; color: var(--vp-muted); font-size: 0.6875rem; font-weight: 600; }
.vp-note-tools button:active { background: color-mix(in srgb, var(--vp-text) 7%, transparent); }
.vp-note-tools .vp-note-delete { margin-left: auto; color: #d23b3b; }
.vp-note-saved { min-height: 1rem; margin: 0; padding-bottom: 0.25rem; text-align: center; color: var(--vp-muted); font-size: 0.6rem; }
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

/* Grouped inset list — one container, hairline separators, iOS structure. Rows inside keep their
   own markup: wrapping an existing list in .vp-list is all an app has to change. Individually
   floating cards per row read as a stack of unrelated things; a list reads as one list. */
.vp-list { display: flex; flex-direction: column; border-radius: 1rem; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 97%, #ffffff), var(--vp-surface)); box-shadow: 0 1px 2px rgb(0 0 0 / 0.05), 0 4px 12px rgb(0 0 0 / 0.06), inset 0 0 0 1px var(--vp-border); overflow: hidden; }
.vp-list > * { border-radius: 0; background: none; box-shadow: none; }
/* The separator is inset past the leading avatar, as both platforms draw it. */
.vp-list > * + * { box-shadow: inset 0 1px 0 var(--vp-border); }
.vp-list--inset-rules > * + * { box-shadow: inset 3.75rem 1px 0 -3.6875rem var(--vp-border); }
.vp-list > *:active { transform: none; background: color-mix(in srgb, var(--vp-text) 7%, transparent); }
.vp-list-group { display: grid; gap: 1rem; }
/* Disclosure chevron for rows that push a detail view. */
.vp-row-chevron { flex-shrink: 0; margin-left: auto; color: color-mix(in srgb, var(--vp-muted) 70%, transparent); }
.vp-row-stamp { flex-shrink: 0; align-self: flex-start; margin-left: auto; padding-top: 0.125rem; font-size: 0.625rem; font-weight: 500; color: var(--vp-muted); font-variant-numeric: tabular-nums; }
.vp-index-head { position: sticky; top: 0; z-index: 1; padding: 0.25rem 0.875rem; font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.02em; color: var(--vp-muted); background: var(--vp-bg); }

/* Empty state: a real one, not a muted sentence. Icon, what this screen is, what to do about it. */
.vp-empty { display: grid; justify-items: center; align-content: center; gap: 0.4rem; padding: 2.5rem 1.25rem; text-align: center; }
.vp-empty-icon { display: inline-flex; align-items: center; justify-content: center; height: 3.25rem; width: 3.25rem; margin-bottom: 0.25rem; border-radius: 999px; background: color-mix(in srgb, var(--vp-text) 7%, var(--vp-bg)); color: var(--vp-muted); }
.vp-empty h3 { margin: 0; font-size: 0.9375rem; font-weight: 650; letter-spacing: -0.01em; }
.vp-empty p { margin: 0; max-width: 15rem; font-size: 0.75rem; line-height: 1.45; color: var(--vp-muted); }
.vp-empty .vp-accent-btn { margin-top: 0.5rem; }

/* Floating compose button. The header + is a 40px target in the corner most thumbs cannot reach.
   A zero-height sticky layer pins it to the bottom of the scroll viewport without a fixed
   position — .vp-appview is itself the scroll container, so an absolutely placed button would
   simply scroll away with the content. */
.vp-fab-layer { position: sticky; bottom: 1rem; z-index: 8; display: flex; justify-content: flex-end; height: 0; pointer-events: none; }
.vp-fab-layer > .vp-fab { position: relative; top: -3.25rem; pointer-events: auto; }
.vp-appview:has(.vp-fab-layer) { display: flex; flex-direction: column; padding-bottom: 5rem; }
.vp-fab-layer { margin-top: auto; }
.vp-fab { display: inline-flex; align-items: center; justify-content: center; height: 3.25rem; width: 3.25rem; border-radius: 999px; background: var(--vp-accent); color: #fff; box-shadow: 0 6px 16px rgb(0 0 0 / 0.28), 0 2px 4px rgb(0 0 0 / 0.18), inset 0 1px 0 rgb(255 255 255 / 0.25); transition: transform 120ms ease, filter 140ms ease; }
.vp-fab:hover:not(:disabled) { filter: brightness(1.08); }
.vp-fab:active:not(:disabled) { transform: scale(0.94); }
.vp-thread-avatar { display: inline-flex; align-items: center; justify-content: center; height: 2.5rem; width: 2.5rem; flex-shrink: 0; border-radius: 999px; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-accent) 85%, #ffffff), var(--vp-accent)); color: #fff; font-size: 0.75rem; font-weight: 650; box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.3), 0 2px 6px rgb(0 0 0 / 0.15); }
.vp-thread-avatar { overflow: hidden; }
.vp-thread-avatar img { height: 100%; width: 100%; object-fit: cover; }
.vp-thread-body { display: grid; gap: 0.125rem; flex: 1; min-width: 0; }
.vp-thread-name { font-size: 0.8125rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vp-thread-kind { display: inline-flex; margin-left: 0.35rem; padding: 0.05rem 0.3rem; border-radius: 999px; background: color-mix(in srgb, var(--vp-accent) 13%, transparent); color: var(--vp-accent); font-size: 0.5rem; font-weight: 750; letter-spacing: 0.035em; text-transform: uppercase; vertical-align: 0.08rem; }
.vp-thread-preview { font-size: 0.6875rem; color: var(--vp-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vp-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 1.125rem; height: 1.125rem; padding: 0 0.3125rem; flex-shrink: 0; border-radius: 999px; background: #ff3b30; color: #fff; font-size: 0.625rem; font-weight: 700; box-shadow: 0 1px 3px rgb(0 0 0 / 0.25); }
/* A conversation that spans a night should read like one, so days are marked. */
.vp-day-break { align-self: center; margin: 0.375rem 0 0.125rem; padding: 0.125rem 0.625rem; border-radius: 999px; background: color-mix(in srgb, var(--vp-text) 8%, var(--vp-bg)); font-size: 0.5625rem; font-weight: 650; letter-spacing: 0.03em; text-transform: uppercase; color: var(--vp-muted); }
.vp-receipt { align-self: flex-end; margin-top: -0.125rem; font-size: 0.5625rem; font-weight: 600; color: var(--vp-muted); }
.vp-thread-intro { margin: auto; max-width: 14rem; text-align: center; font-size: 0.6875rem; line-height: 1.45; color: var(--vp-muted); }
/* Three dots that actually move, rather than the words "is typing". */
.vp-bubble--typing { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.625rem 0.75rem; }
.vp-bubble--typing span { height: 0.375rem; width: 0.375rem; border-radius: 999px; background: var(--vp-muted); animation: vp-typing 1.1s infinite ease-in-out; }
.vp-bubble--typing span:nth-child(2) { animation-delay: 0.15s; }
.vp-bubble--typing span:nth-child(3) { animation-delay: 0.3s; }
@keyframes vp-typing { 0%, 60%, 100% { opacity: 0.3; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-2px); } }
.vp-thread-view { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.vp-conversation-person { display: flex; align-items: center; justify-content: center; gap: 0.4rem; min-width: 0; }
.vp-conversation-person .vp-thread-avatar { height: 2rem; width: 2rem; }
.vp-conversation-person > span { display: grid; line-height: 1.15; }
.vp-conversation-person strong { max-width: 12rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.75rem; }
.vp-conversation-person small { margin-top: 0.15rem; color: var(--vp-muted); font-size: 0.5625rem; }
.vp-story-thread-note { margin: 0 0 0.65rem; padding: 0.45rem 0.65rem; border-radius: 0.65rem; background: color-mix(in srgb, var(--vp-accent) 9%, var(--vp-bg)); color: var(--vp-muted); font-size: 0.625rem; line-height: 1.35; text-align: center; }
.vp-reply-failed { align-self: flex-start; margin: 0.1rem 0; padding: 0.35rem 0.55rem; border-radius: 0.55rem; background: color-mix(in srgb, #d3423e 10%, var(--vp-bg)); color: #c63b37; font-size: 0.625rem; }
.vp-message-compose .vp-thread-preview { display: -webkit-box; white-space: normal; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.3; }
.vp-thread-view .vp-composer { flex-shrink: 0; }
.vp-bubbles { display: flex; flex-direction: column; gap: 0.375rem; flex: 1; overflow-y: auto; padding-bottom: 0.875rem; }
.vp-bubble { width: fit-content; max-width: 78%; padding: 0.5rem 0.75rem; border-radius: 1.125rem; font-size: 0.8125rem; line-height: 1.35; overflow-wrap: anywhere; }
.vp-bubble--self { align-self: flex-end; border-bottom-right-radius: 0.375rem; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-accent) 88%, #ffffff), var(--vp-accent)); color: #fff; box-shadow: 0 1px 2px rgb(0 0 0 / 0.12), inset 0 1px 0 rgb(255 255 255 / 0.2); }
.vp-bubble--other { align-self: flex-start; border-bottom-left-radius: 0.375rem; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 96%, #ffffff), var(--vp-surface)); box-shadow: 0 1px 2px rgb(0 0 0 / 0.07), inset 0 0 0 1px var(--vp-border); }
.vp-bubble-time { display: block; margin-top: 0.125rem; font-size: 0.5625rem; opacity: 0.7; }
.vp-composer { display: flex; align-items: center; gap: 0.5rem; }
/* Photos sit shoulder to shoulder and run to the edges, the way every camera roll does. */
.vp-gallery-library { display: grid; gap: 0.65rem; }
.vp-gallery-tabs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.25rem; padding: 0.2rem; border-radius: 0.75rem; background: color-mix(in srgb, var(--vp-text) 6%, transparent); }
.vp-gallery-tabs button { display: flex; align-items: center; justify-content: center; gap: 0.3rem; min-width: 0; padding: 0.45rem 0.2rem; border-radius: 0.58rem; color: var(--vp-muted); font-size: 0.67rem; font-weight: 700; }
.vp-gallery-tabs button[aria-current="page"] { background: var(--vp-card); color: var(--vp-text); box-shadow: 0 1px 4px rgb(0 0 0 / 0.1); }
.vp-gallery-tabs small { color: inherit; font-size: 0.58rem; opacity: 0.7; }
.vp-gallery-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 2px; margin: 0 -0.75rem; }
.vp-gallery-hidden-thumb { width: 3rem; height: 3rem; flex-shrink: 0; border-radius: 0.65rem; object-fit: cover; filter: saturate(0.55); }
.vp-subsection-head { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; margin-bottom: 0.25rem; }
.vp-subsection-head .vp-section-label { margin: 0; padding: 0; }
.vp-subsection-head strong { display: block; margin-top: 0.1rem; font-size: 0.9rem; }
.vp-gallery-cell { position: relative; aspect-ratio: 1; overflow: hidden; border-radius: 0; background: color-mix(in srgb, var(--vp-text) 6%, var(--vp-bg)); transition: opacity 120ms ease; }
.vp-gallery-cell:active { opacity: 0.7; }
.vp-gallery-cell img { display: block; height: 100%; width: 100%; object-fit: cover; }
.vp-gallery-heart { position: absolute; right: 0.35rem; bottom: 0.35rem; color: #fff; filter: drop-shadow(0 1px 3px rgb(0 0 0 / 0.65)); }
.vp-gallery-skeleton { aspect-ratio: 1; border-radius: 0.5rem; }
.vp-photo-view { margin: 0; }
.vp-photo-stage { position: relative; }
.vp-photo-stage img { display: block; width: 100%; max-height: 21rem; border-radius: 1.125rem; object-fit: contain; background: #111; box-shadow: 0 4px 16px rgb(0 0 0 / 0.25); }
.vp-photo-favorite { position: absolute; right: 0.65rem; bottom: 0.65rem; display: grid; place-items: center; width: 1.6rem; height: 1.6rem; border-radius: 999px; color: #ff375f; background: rgb(15 15 18 / 0.72); backdrop-filter: blur(8px); }
.vp-tab-content { flex: 1; min-height: 0; overflow-y: auto; padding-bottom: 0.875rem; margin-bottom: 0.5rem; }
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
.vp-tindler-private-note { margin: 0; text-align: center; color: var(--vp-muted); font-size: 0.58rem; line-height: 1.35; }
.vp-tindler-preferences { display: grid; gap: 0.9rem; overflow-y: auto; padding-bottom: 0.5rem; }
.vp-tindler-assurance { display: flex; align-items: flex-start; gap: 0.55rem; padding: 0.7rem; border-radius: 0.85rem; background: color-mix(in srgb, var(--vp-accent) 9%, var(--vp-surface)); color: var(--vp-accent); }
.vp-tindler-assurance p { display: grid; gap: 0.12rem; margin: 0; }
.vp-tindler-assurance strong { color: var(--vp-text); font-size: 0.7rem; }
.vp-tindler-assurance span { color: var(--vp-muted); font-size: 0.61rem; line-height: 1.4; }
.vp-tindler-intents { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0; padding: 0; border: 0; }
.vp-tindler-intents legend, .vp-field-label { display: block; width: 100%; margin-bottom: 0.4rem; color: var(--vp-text); font-size: 0.68rem; font-weight: 700; }
.vp-tindler-intents button { padding: 0.45rem 0.65rem; border-radius: 999px; background: var(--vp-surface); box-shadow: inset 0 0 0 1px var(--vp-border); color: var(--vp-muted); font-size: 0.63rem; font-weight: 650; }
.vp-tindler-intents button[aria-pressed="true"] { background: color-mix(in srgb, var(--vp-accent) 13%, var(--vp-surface)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--vp-accent) 45%, transparent); color: var(--vp-accent); }
.vp-tindler-match { display: flex; align-items: center; gap: 0.55rem; min-width: 0; padding: 0.6rem; border-radius: 0.9rem; background: var(--vp-surface); box-shadow: inset 0 0 0 1px var(--vp-border); }
.vp-tindler-message { display: grid; place-items: center; height: 2rem; width: 2rem; flex-shrink: 0; border-radius: 999px; background: color-mix(in srgb, var(--vp-accent) 12%, var(--vp-surface)); color: var(--vp-accent); }
.vp-tindler-unmatch { display: grid; place-items: center; height: 2rem; width: 2rem; flex-shrink: 0; padding: 0; }
.vp-tindler-toast { position: absolute; left: 50%; bottom: 4.8rem; z-index: 6; display: flex; align-items: center; gap: 0.35rem; padding: 0.45rem 0.7rem; border-radius: 999px; background: rgb(20 20 23 / 0.88); color: #fff; font-size: 0.64rem; font-weight: 700; transform: translateX(-50%); backdrop-filter: blur(10px); }
.vp-tindler-match-sheet { position: absolute; inset: 0; z-index: 12; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.55rem; padding: 1.5rem; background: color-mix(in srgb, var(--vp-bg) 92%, transparent); text-align: center; backdrop-filter: blur(18px); }
.vp-tindler-match-sheet h3 { margin: 0; font-size: 1.15rem; }
.vp-tindler-match-sheet p { margin: 0 0 0.35rem; color: var(--vp-muted); font-size: 0.72rem; line-height: 1.45; }
.vp-tindler-match-burst { display: grid; place-items: center; height: 5rem; width: 5rem; margin-bottom: 0.4rem; border: 3px solid #fff; border-radius: 999px; color: #fff; font-size: 1.25rem; font-weight: 750; box-shadow: 0 0 0 0.35rem color-mix(in srgb, var(--vp-accent) 25%, transparent), 0 0.75rem 2rem rgb(0 0 0 / 0.2); }
.vp-mail-dot { display: inline-block; height: 0.5rem; width: 0.5rem; margin-right: 0.375rem; border-radius: 999px; background: var(--vp-accent); }
.vp-mail-meta { margin: -0.375rem 0 0.75rem; font-size: 0.6875rem; font-weight: 500; color: var(--vp-muted); }
.vp-mail-folders { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.35rem; margin-bottom: 0.625rem; }
.vp-mail-folder { position: relative; display: grid; place-items: center; gap: 0.2rem; min-width: 0; min-height: 3rem; padding: 0.4rem 0.15rem; border-radius: 0.75rem; color: var(--vp-muted); background: color-mix(in srgb, var(--vp-text) 4%, var(--vp-surface)); font-size: 0.58rem; font-weight: 650; }
.vp-mail-folder--active { color: var(--vp-accent); background: color-mix(in srgb, var(--vp-accent) 12%, var(--vp-surface)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--vp-accent) 20%, transparent); }
.vp-mail-folder strong { position: absolute; top: 0.25rem; right: 0.35rem; display: grid; place-items: center; min-width: 1rem; height: 1rem; padding: 0 0.2rem; border-radius: 999px; background: var(--vp-accent); color: #fff; font-size: 0.5rem; }
.vp-mail-thread { display: grid; gap: 0.5rem; }
.vp-mail-message { padding: 0.75rem; border-radius: 0.9rem; background: color-mix(in srgb, var(--vp-text) 3%, var(--vp-surface)); box-shadow: inset 0 0 0 1px var(--vp-border); }
.vp-mail-message--selected { background: var(--vp-surface); box-shadow: 0 2px 10px rgb(0 0 0 / 0.07), inset 0 0 0 1px var(--vp-border); }
.vp-mail-message-head { display: flex; align-items: center; gap: 0.5rem; }
.vp-mail-message-head > span { display: grid; min-width: 0; font-size: 0.7rem; }
.vp-mail-message-head strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vp-mail-message-head small, .vp-mail-message-head time { color: var(--vp-muted); font-size: 0.58rem; }
.vp-mail-message-head time { margin-left: auto; flex-shrink: 0; }
.vp-mail-message > p { margin: 0.7rem 0 0; white-space: pre-wrap; font-size: 0.78rem; line-height: 1.5; overflow-wrap: anywhere; }
.vp-post { display: grid; gap: 0.375rem; padding: 0.75rem 0; border-bottom: 1px solid var(--vp-border); }
.vp-post--reply { margin-left: 1rem; padding-left: 0.625rem; border-left: 2px solid color-mix(in srgb, var(--vp-accent) 35%, var(--vp-border)); }
.vp-post-header { display: flex; align-items: center; gap: 0.5rem; }
.vp-post-avatar { display: inline-flex; align-items: center; justify-content: center; height: 2rem; width: 2rem; flex-shrink: 0; border-radius: 999px; background: linear-gradient(180deg, #b48cff, #7a3ff2); color: #fff; font-size: 0.6875rem; font-weight: 700; box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.3); }
.vp-post-names { display: flex; align-items: baseline; gap: 0.375rem; min-width: 0; overflow: hidden; }
.vp-post-author { font-size: 0.75rem; font-weight: 650; white-space: nowrap; }
.vp-post-time { margin-left: auto; flex-shrink: 0; font-size: 0.5625rem; font-weight: 500; color: var(--vp-muted); }
.vp-post-handle { font-size: 0.6875rem; font-weight: 500; color: var(--vp-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vp-post-text { margin: 0; font-size: 0.8125rem; line-height: 1.4; overflow-wrap: anywhere; }
/* Like, boost and reply are the most-pressed controls in the feed and were eleven pixels tall.
   The row keeps its look; the targets around the numbers are now big enough to hit. */
.vp-post-footer { display: flex; gap: 0.75rem; align-items: center; margin-top: 0.25rem; font-size: 0.625rem; font-weight: 600; color: var(--vp-muted); }
.vp-post-footer > button { display: inline-flex; align-items: center; gap: 0.25rem; min-height: 1.75rem; padding: 0 0.5rem; border-radius: 999px; transition: background 120ms ease; }
.vp-post-footer > button:hover { background: color-mix(in srgb, var(--vp-text) 8%, transparent); }
.vp-post-footer .vp-post-save { margin-left: auto; }
.vp-post-footer span { display: inline-flex; align-items: center; gap: 0.25rem; }
.vp-post-names { text-align: left; }
.vp-noodle-reply { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; }
.vp-noodle-reply label { flex: 1; min-width: 0; }
.vp-noodle-send { flex-shrink: 0; background: var(--vp-accent); color: #fff; }
.vp-noodle-profile { display: flex; align-items: center; gap: 0.625rem; margin-bottom: 0.5rem; padding: 0.75rem 0; border-bottom: 1px solid var(--vp-border); }
.vp-noodle-profile > div { display: grid; gap: 0.125rem; }
.vp-noodle-profile strong { font-size: 0.8125rem; }
.vp-noodle-profile span { color: var(--vp-muted); font-size: 0.625rem; }
.vp-noodle-compose { position: absolute; inset: 0; z-index: 12; display: flex; flex-direction: column; padding: 0.75rem; background: var(--vp-bg); }
.vp-noodle-compose-head { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; min-height: 2.5rem; }
.vp-noodle-compose-head strong { font-size: 0.875rem; }
.vp-noodle-compose-head button { color: var(--vp-accent); font-size: 0.75rem; font-weight: 650; }
.vp-noodle-compose-head button:last-child { justify-self: end; padding: 0.45rem 0.8rem; border-radius: 999px; background: var(--vp-accent); color: #fff; }
.vp-noodle-compose-head button:disabled { opacity: 0.45; }
.vp-noodle-compose textarea { min-height: 9rem; resize: none; border: 0; outline: 0; background: transparent; color: var(--vp-text); font: inherit; font-size: 1rem; line-height: 1.5; }
.vp-noodle-compose-meta { display: flex; justify-content: space-between; gap: 0.75rem; padding: 0.625rem 0; border-block: 1px solid var(--vp-border); color: var(--vp-accent); font-size: 0.625rem; font-weight: 650; }
.vp-noodle-compose-meta span { display: inline-flex; align-items: center; gap: 0.25rem; }
.vp-noodle-compose > p { margin: 0.625rem 0; color: var(--vp-muted); font-size: 0.625rem; }

.vp-goodle-logo { display: flex; justify-content: center; gap: 1px; margin: 1.5rem 0 1rem; font-size: 2.125rem; font-weight: 700; letter-spacing: -0.02em; text-shadow: 0 1px 2px rgb(0 0 0 / 0.08); }
.vp-goodle-library { display: grid; gap: 1rem; margin-top: 1rem; }
.vp-goodle-library h3, .vp-goodle-section-head { display: flex; align-items: center; gap: 0.35rem; margin: 0 0 0.5rem; }
.vp-goodle-library h3 { color: var(--vp-muted); font-size: 0.6875rem; font-weight: 750; letter-spacing: 0.025em; }
.vp-goodle-saved-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.45rem; }
.vp-goodle-saved { display: flex; align-items: center; gap: 0.5rem; min-width: 0; min-height: 3.25rem; padding: 0.55rem; border-radius: 0.8rem; background: var(--vp-surface); text-align: left; box-shadow: inset 0 0 0 1px var(--vp-border); }
.vp-goodle-saved > span:last-child, .vp-goodle-history button > span:first-child { display: grid; min-width: 0; gap: 0.1rem; }
.vp-goodle-saved strong, .vp-goodle-history strong { overflow: hidden; color: var(--vp-text); font-size: 0.6875rem; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.vp-goodle-saved small, .vp-goodle-history small { overflow: hidden; color: var(--vp-muted); font-size: 0.5625rem; text-overflow: ellipsis; white-space: nowrap; }
.vp-goodle-favicon { display: inline-flex; flex: 0 0 auto; align-items: center; justify-content: center; width: 1.8rem; height: 1.8rem; border-radius: 0.5rem; color: #fff; font-size: 0.7rem; font-weight: 800; }
.vp-goodle-section-head { justify-content: space-between; }
.vp-goodle-section-head h3 { margin: 0; }
.vp-goodle-section-head > button { display: inline-flex; align-items: center; gap: 0.25rem; min-height: 1.75rem; padding: 0 0.45rem; border-radius: 999px; color: var(--vp-muted); font-size: 0.5875rem; font-weight: 650; }
.vp-goodle-history { overflow: hidden; border-radius: 0.85rem; background: var(--vp-surface); box-shadow: inset 0 0 0 1px var(--vp-border); }
.vp-goodle-history button { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; width: 100%; min-height: 3rem; padding: 0.5rem 0.7rem; text-align: left; }
.vp-goodle-history button + button { border-top: 1px solid var(--vp-border); }
.vp-goodle-history button > span:last-child { color: var(--vp-muted); font-size: 1rem; }
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

/* Site templates. One layout per kind of place on the in-story web — a newspaper, a shop, a forum
   thread and a council notice used to be the same stack of headed paragraphs. */
.vp-byline { margin: -0.25rem 0 0.625rem; font-size: 0.6875rem; font-weight: 500; color: var(--vp-muted); }
.vp-lede { margin: 0 0 0.75rem; font-size: 0.8125rem; font-weight: 550; line-height: 1.55; }
.vp-site-article .vp-site-section { margin-bottom: 0.75rem; }
/* Pictures are not generated yet, so a labelled grey box stands in and says so. */
.vp-media { display: grid; gap: 0.3125rem; margin: 0 0 0.75rem; }
.vp-media figcaption { font-size: 0.625rem; line-height: 1.35; color: var(--vp-muted); }
/* A lead image is 16:9, not the 4:3 the shared thumb uses — at full column width that filled the
   screen and pushed the article itself below the fold. */
.vp-media--wide .vp-emoji-thumb, .vp-media--lg .vp-emoji-thumb { aspect-ratio: 16 / 9; width: 100%; height: auto; font-size: 2.5rem; border-radius: 0.75rem; }
.vp-media--md .vp-emoji-thumb { aspect-ratio: 4 / 3; width: 100%; height: auto; font-size: 2rem; }
.vp-media--sm { margin: 0 0 0.5rem; }
/* A small picture inside a section floats beside its text the way a newspaper sets one. */
.vp-media--inline { float: right; width: 6.25rem; margin: 0 0 0.5rem 0.625rem; }
.vp-media--inline .vp-emoji-thumb { aspect-ratio: 4 / 3; width: 100%; height: auto; font-size: 1.75rem; border-radius: 0.5rem; }
.vp-site-section, .vp-blog-post, .vp-thread-post { overflow: hidden; }
.vp-official-head { display: flex; align-items: center; gap: 0.625rem; }
.vp-official-head .vp-page-heading { margin: 0; flex: 1; }
.vp-official-head .vp-media { width: 3rem; flex: 0 0 auto; margin: 0; }
.vp-official-head .vp-emoji-thumb { aspect-ratio: 1; width: 100%; height: auto; font-size: 1.5rem; }
.vp-official-head figcaption { display: none; }
/* A place is not a person: listing thumbs are rounded squares, not the circular avatar shape. */
.vp-listing-thumb { height: 2.75rem; width: 2.75rem; font-size: 1.25rem; border-radius: 0.625rem; }
.vp-media--sm figcaption { font-size: 0.5625rem; }
.vp-media-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.5rem; margin-bottom: 0.75rem; }
.vp-media-row .vp-emoji-thumb { aspect-ratio: 1; width: 100%; height: auto; font-size: 1.5rem; border-radius: 0.625rem; }
.vp-product { display: grid; gap: 0.3125rem; align-content: start; }
.vp-product h4 { margin: 0; font-size: 0.75rem; font-weight: 650; line-height: 1.25; }
.vp-product p { margin: 0; font-size: 0.6875rem; line-height: 1.4; color: var(--vp-muted); }
.vp-price { font-size: 0.8125rem; font-weight: 700; color: var(--vp-accent); }
.vp-thread-post { display: flex; gap: 0.5rem; margin-bottom: 0.5rem; padding: 0.625rem 0.75rem; border-radius: 0.875rem; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 97%, #ffffff), var(--vp-surface)); box-shadow: 0 1px 2px rgb(0 0 0 / 0.05), inset 0 0 0 1px var(--vp-border); }
.vp-thread-post > div { min-width: 0; flex: 1; }
.vp-thread-post p { margin: 0.125rem 0 0; font-size: 0.75rem; line-height: 1.5; overflow-wrap: anywhere; }
.vp-thread-post--op { box-shadow: 0 1px 2px rgb(0 0 0 / 0.05), inset 0 0 0 1px color-mix(in srgb, var(--vp-accent) 40%, var(--vp-border)); }
.vp-call-row { display: flex; align-items: flex-start; gap: 0.625rem; min-height: 4rem; padding: 0.65rem 0.75rem; }
.vp-call-row--missed .vp-thread-name, .vp-call-row--missed .vp-call-meta { color: #e34843; }
.vp-call-meta { display: flex; align-items: center; gap: 0.25rem; text-transform: capitalize; }
.vp-call-end { display: flex; align-items: center; align-self: stretch; gap: 0.25rem; flex-shrink: 0; }
.vp-call-end button { display: inline-flex; align-items: center; justify-content: center; height: 1.875rem; width: 1.875rem; border-radius: 999px; background: color-mix(in srgb, #ff3b30 13%, var(--vp-surface)); color: #e23b34; }
.vp-call-end button[aria-pressed] { background: color-mix(in srgb, var(--vp-accent) 12%, var(--vp-surface)); color: var(--vp-accent); }
.vp-call-end .vp-row-stamp { align-self: flex-start; margin-right: 0.1rem; white-space: nowrap; }
.vp-call-summary { display: -webkit-box; margin-top: 0.2rem; color: var(--vp-text); font-size: 0.675rem; line-height: 1.4; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.vp-call-dial { padding-bottom: 0.5rem; }
.vp-call-mode { display: grid; grid-template-columns: 1fr 1fr; gap: 0.25rem; padding: 0.25rem; border-radius: 0.875rem; background: color-mix(in srgb, var(--vp-text) 7%, transparent); }
.vp-call-mode button { display: inline-flex; align-items: center; justify-content: center; gap: 0.375rem; min-height: 2.25rem; border-radius: 0.6875rem; color: var(--vp-muted); font-size: 0.75rem; font-weight: 650; }
.vp-call-mode button[aria-pressed="true"] { background: var(--vp-surface); color: var(--vp-text); box-shadow: 0 1px 4px rgb(0 0 0 / 0.12); }
.vp-call-check { height: 1.125rem; width: 1.125rem; border: 1px solid var(--vp-border); border-radius: 999px; }
.vp-call-check--selected { border: 0.3rem solid var(--vp-accent); background: var(--vp-surface); }
.vp-call-button { display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; min-height: 2.75rem; border-radius: 999px; background: linear-gradient(180deg, #55e97a, #16a443); color: #fff; font-size: 0.8125rem; font-weight: 700; box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.3), 0 4px 12px rgb(18 155 61 / 0.25); }
.vp-call-button:disabled { filter: grayscale(0.7); opacity: 0.5; box-shadow: none; }
.vp-call-live { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 0.7rem; margin-bottom: 0.9rem; padding: 0.8rem; border-radius: 1.15rem; color: #fff; background: linear-gradient(145deg, #177a3c, #20ad58); box-shadow: 0 10px 28px rgb(20 116 56 / 0.3); }
.vp-call-live--ringing { background: linear-gradient(145deg, #1267b0, #2189df); box-shadow: 0 10px 28px rgb(24 103 171 / 0.28); }
.vp-call-live > span { display: grid; min-width: 0; }
.vp-call-live small { font-size: 0.5625rem; font-weight: 750; text-transform: uppercase; letter-spacing: 0.07em; opacity: 0.75; }
.vp-call-live strong { font-size: 0.875rem; }
.vp-call-live span span { font-size: 0.625rem; opacity: 0.8; }
.vp-call-live > button { display: inline-flex; align-items: center; justify-content: center; width: 2.4rem; height: 2.4rem; border-radius: 999px; background: #ed4038; box-shadow: 0 3px 10px rgb(91 13 10 / 0.28); }
.vp-call-contacts { padding-bottom: 0.5rem; }
.vp-call-contact { display: flex; align-items: center; gap: 0.625rem; min-height: 4rem; padding: 0.55rem 0.75rem; }
.vp-call-contact--launched { background: color-mix(in srgb, var(--vp-accent) 7%, transparent); }
.vp-call-contact-actions { display: flex; gap: 0.35rem; flex-shrink: 0; }
.vp-call-contact-actions button { display: inline-flex; align-items: center; justify-content: center; width: 2rem; height: 2rem; border-radius: 999px; background: color-mix(in srgb, var(--vp-accent) 12%, var(--vp-surface)); color: var(--vp-accent); }
.vp-call-contact-actions button:last-child { background: color-mix(in srgb, #1574d1 12%, var(--vp-surface)); color: #1574d1; }
.vp-call-tabbar { position: sticky; bottom: 0; z-index: 2; margin-top: auto; backdrop-filter: blur(16px); }
.vp-infobox { float: right; width: 42%; display: grid; gap: 0.3125rem; margin: 0 0 0.5rem 0.625rem; padding: 0.5rem; border-radius: 0.75rem; background: color-mix(in srgb, var(--vp-text) 4%, var(--vp-surface)); box-shadow: inset 0 0 0 1px var(--vp-border); }
.vp-infobox-caption { font-size: 0.5625rem; line-height: 1.35; color: var(--vp-muted); }
.vp-wiki-title { font-family: Georgia, "Times New Roman", serif; font-weight: 500; padding-bottom: 0.375rem; border-bottom: 1px solid var(--vp-border); }
.vp-wiki-section h4 { font-family: Georgia, "Times New Roman", serif; font-weight: 600; }
.vp-toc { display: grid; gap: 0.25rem; margin-bottom: 0.75rem; padding: 0.5rem 0.625rem; border-radius: 0.75rem; background: color-mix(in srgb, var(--vp-text) 4%, var(--vp-surface)); box-shadow: inset 0 0 0 1px var(--vp-border); }
.vp-toc ol { margin: 0; padding-left: 1.125rem; font-size: 0.6875rem; line-height: 1.6; color: var(--vp-accent); }
.vp-profile-head { display: flex; align-items: center; gap: 0.625rem; margin-bottom: 0.875rem; }
.vp-profile-head h3 { margin: 0; font-size: 0.9375rem; font-weight: 650; }
.vp-profile-head .vp-byline { margin: 0; }
.vp-blog-post { margin-bottom: 0.875rem; padding-bottom: 0.875rem; border-bottom: 1px solid var(--vp-border); }
.vp-blog-post:last-child { border-bottom: 0; }
.vp-blog-post h4 { margin: 0 0 0.125rem; font-size: 0.8125rem; font-weight: 650; color: var(--vp-accent); }
.vp-blog-post p { margin: 0.25rem 0 0; font-size: 0.75rem; line-height: 1.5; }
.vp-listing-meta { font-size: 0.625rem; font-weight: 600; color: var(--vp-accent); }
.vp-notice { margin: 0 0 0.75rem; padding: 0.5rem 0.625rem; border-radius: 0.5rem; border-left: 3px solid var(--vp-accent); background: color-mix(in srgb, var(--vp-accent) 8%, var(--vp-surface)); font-size: 0.6875rem; line-height: 1.4; }
.vp-official-row { padding: 0.625rem 0.75rem; }
.vp-official-row h4 { margin: 0 0 0.1875rem; font-size: 0.75rem; font-weight: 650; }
.vp-official-row p { margin: 0; font-size: 0.6875rem; line-height: 1.5; color: var(--vp-muted); }
.vp-video-row { display: flex; gap: 0.5rem; margin-bottom: 0.625rem; }
.vp-video-thumb { position: relative; flex: 0 0 auto; height: 3.25rem; width: 5.5rem; font-size: 1.5rem; border-radius: 0.5rem; }
.vp-video-duration { position: absolute; right: 0.1875rem; bottom: 0.1875rem; padding: 0 0.25rem; border-radius: 0.25rem; background: rgb(0 0 0 / 0.75); color: #fff; font-size: 0.5rem; font-weight: 600; font-variant-numeric: tabular-nums; }
.vp-video-body { display: grid; gap: 0.125rem; min-width: 0; }

/* Goodle's own tabs, and the picture grid behind the Images one. */
.vp-goodle-tabs { display: flex; gap: 1rem; margin: 0.875rem 0 0; padding: 0 0.25rem; border-bottom: 1px solid var(--vp-border); }
/* A tab is a target, not just a word: "All" was 21px wide to aim at. */
.vp-goodle-tabs button { display: inline-flex; align-items: center; justify-content: center; gap: 0.3125rem; min-width: 3.25rem; min-height: 2rem; padding: 0 0.5rem 0.5rem; font-size: 0.75rem; font-weight: 600; color: var(--vp-muted); border-bottom: 2px solid transparent; margin-bottom: -1px; }
.vp-goodle-tabs button[aria-pressed="true"] { color: var(--vp-accent); border-bottom-color: var(--vp-accent); }
.vp-image-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.5rem; margin-top: 0.875rem; }
.vp-image-cell { display: grid; gap: 0.1875rem; text-align: left; }
.vp-image-cell .vp-media { margin: 0; }
.vp-image-cell .vp-emoji-thumb { aspect-ratio: 1; width: 100%; height: auto; font-size: 1.625rem; border-radius: 0.625rem; transition: transform 120ms ease; }
.vp-image-cell:active .vp-emoji-thumb { transform: scale(0.96); }
.vp-image-caption { font-size: 0.5625rem; line-height: 1.3; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.vp-image-source { font-size: 0.5rem; color: var(--vp-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
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
.vp-go-btn { min-height: 1.875rem; min-width: 1.875rem; position: absolute; right: 0.3125rem; top: 50%; translate: 0 -50%; display: inline-flex; align-items: center; justify-content: center; height: 2.125rem; width: 2.125rem; border-radius: 999px; background: var(--vp-accent); color: #fff; box-shadow: 0 1px 3px rgb(0 0 0 / 0.2); transition: transform 120ms ease; }
.vp-go-btn:active { transform: scale(0.94); }
.vp-color-row { display: inline-flex; align-items: center; gap: 0.5rem; }
.vp-color-input { height: 1.875rem; width: 2.75rem; padding: 0; border: 0; border-radius: 0.5rem; background: none; cursor: pointer; }
.vp-color-input::-webkit-color-swatch-wrapper { padding: 2px; }
.vp-color-input::-webkit-color-swatch { border: 1px solid var(--vp-border); border-radius: 0.375rem; }
.vp-urlbar { display: inline-flex; align-items: center; gap: 0.375rem; max-width: 100%; min-height: 1.875rem; padding: 0 0.75rem; border-radius: 999px; background: color-mix(in srgb, var(--vp-text) 6%, var(--vp-bg)); font-size: 0.6875rem; font-weight: 500; color: var(--vp-muted); }
.vp-urlbar span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* The pill every app store uses: short, wide enough to read, and the same width installed or not. */
.vp-store-get { min-width: 4.25rem; min-height: 1.75rem; padding: 0 0.75rem; border-radius: 999px; background: color-mix(in srgb, var(--vp-text) 10%, var(--vp-bg)); color: var(--vp-accent); font-size: 0.6875rem; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; transition: transform 120ms ease, filter 140ms ease; }
.vp-store-get:hover { filter: brightness(1.1); }
.vp-store-get:active { transform: scale(0.94); }
.vp-store-actions { display: grid; gap: 0.25rem; justify-items: end; flex-shrink: 0; }
.vp-store-remove { min-height: 1.5rem; padding: 0 0.5rem; font-size: 0.625rem; font-weight: 600; color: var(--vp-muted); border-radius: 0.375rem; }
.vp-store-remove:hover { color: #ff3b30; }
.vp-store-facts { display: grid; gap: 0; margin: 0; overflow: hidden; border-radius: 1rem; background: var(--vp-surface); box-shadow: inset 0 0 0 1px var(--vp-border); }
.vp-store-facts > div { display: grid; grid-template-columns: 4.5rem minmax(0, 1fr); gap: 0.6rem; align-items: center; min-height: 2.8rem; padding: 0.5rem 0.7rem; }
.vp-store-facts > div + div { border-top: 1px solid var(--vp-border); }
.vp-store-facts dt { color: var(--vp-muted); font-size: 0.625rem; font-weight: 650; }
.vp-store-facts dd { margin: 0; font-size: 0.6875rem; font-weight: 600; line-height: 1.35; }
.vp-store-search { display: flex; align-items: center; gap: 0.5rem; min-height: 2.5rem; margin-bottom: 0.625rem; padding: 0 0.75rem; border-radius: 0.75rem; background: color-mix(in srgb, var(--vp-text) 6%, var(--vp-surface)); color: var(--vp-muted); }
.vp-store-search input { min-width: 0; width: 100%; border: 0; outline: 0; background: transparent; color: var(--vp-text); font: inherit; font-size: 0.75rem; }
.vp-store-intro { display: flex; gap: 0.625rem; margin: 0.875rem 0 1rem; padding: 0.75rem; border-radius: 0.875rem; background: color-mix(in srgb, var(--vp-accent) 10%, var(--vp-surface)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--vp-accent) 24%, var(--vp-border)); }
.vp-store-intro > svg { flex: 0 0 auto; margin-top: 0.125rem; color: var(--vp-accent); }
.vp-store-intro div { display: grid; gap: 0.1875rem; }
.vp-store-intro strong { font-size: 0.75rem; }
.vp-store-intro span { color: var(--vp-muted); font-size: 0.625rem; line-height: 1.4; }
.vp-store-category { margin-top: 1rem; }
.vp-store-list { overflow: hidden; border-radius: 1rem; background: var(--vp-surface); box-shadow: 0 1px 2px rgb(0 0 0 / 0.05), inset 0 0 0 1px var(--vp-border); }
.vp-store-row { display: flex; align-items: center; min-height: 4.75rem; }
.vp-store-row + .vp-store-row { border-top: 1px solid var(--vp-border); }
.vp-store-row-main { display: flex; flex: 1; min-width: 0; align-items: center; gap: 0.625rem; padding: 0.625rem 0.25rem 0.625rem 0.625rem; color: inherit; text-align: left; }
.vp-store-row-main > svg { flex: 0 0 auto; color: var(--vp-muted); }
.vp-store-row-copy { display: grid; flex: 1; min-width: 0; gap: 0.125rem; }
.vp-store-row-copy strong { font-size: 0.75rem; }
.vp-store-row-copy small { display: -webkit-box; overflow: hidden; color: var(--vp-muted); font-size: 0.5625rem; font-weight: 500; line-height: 1.3; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.vp-store-row-copy > span { color: var(--vp-accent); font-size: 0.5rem; font-weight: 650; }
.vp-store-row > .vp-store-actions { padding-right: 0.625rem; }
.vp-store-detail { display: grid; gap: 1rem; }
.vp-store-detail-hero { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 0.75rem; padding: 0.25rem 0; }
.vp-store-detail-hero h3, .vp-store-detail-hero p { margin: 0; }
.vp-store-detail-hero h3 { font-size: 1rem; }
.vp-store-detail-hero p { margin-top: 0.125rem; color: var(--vp-muted); font-size: 0.625rem; }
.vp-store-icon--large { width: 3.75rem; height: 3.75rem; border-radius: 1rem; }
.vp-store-description { margin: -0.25rem 0 0; font-size: 0.75rem; line-height: 1.5; }
.vp-store-detail section { display: grid; gap: 0.375rem; }
.vp-store-detail .vp-section-label { margin: 0; }
.vp-store-disclosures { overflow: hidden; border-radius: 1rem; background: var(--vp-surface); box-shadow: inset 0 0 0 1px var(--vp-border); }
.vp-store-disclosures > div { display: grid; grid-template-columns: 1.5rem minmax(0, 1fr); gap: 0.375rem; min-height: 3rem; align-items: center; padding: 0.5rem 0.75rem; }
.vp-store-disclosures > div + div { border-top: 1px solid var(--vp-border); }
.vp-store-disclosures svg { color: var(--vp-accent); }
.vp-store-disclosures span { display: grid; gap: 0.125rem; }
.vp-store-disclosures strong { font-size: 0.6875rem; }
.vp-store-disclosures small { color: var(--vp-muted); font-size: 0.625rem; font-weight: 500; line-height: 1.35; }
.vp-store-access-row { font-size: 0.6875rem; }
.vp-store-remove-wide { justify-self: center; padding: 0.5rem 1rem; color: #d92d20; font-size: 0.6875rem; font-weight: 650; }
.vp-store-system-note { margin: 0; text-align: center; }
.vp-director-note { display: grid; gap: 0.2rem; margin: 0.25rem 0 0.5rem -1.25rem; padding: 0.6rem 0.7rem; border-radius: 0.75rem; background: color-mix(in srgb, var(--vp-accent) 10%, var(--vp-surface)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--vp-accent) 32%, var(--vp-border)); }
.vp-director-note strong { color: var(--vp-accent); font-size: 0.625rem; text-transform: uppercase; letter-spacing: 0.06em; }
.vp-director-note span { color: var(--vp-muted); font-size: 0.625rem; line-height: 1.4; }
.vp-fx { position: absolute; inset: 0; z-index: 40; pointer-events: none; border-radius: 43px; }
/* A real impact crack: eleven cracks radiating from one strike point, each kinked and of a
   different length, joined by four irregular rings into shards, with short branches off the long
   runs. This was two sets of evenly spaced parallel diagonals across the whole screen, which is
   the one thing broken glass never looks like. Drawn twice — a dark pass offset by half a pixel
   under a fine bright pass — so the shards read as depth rather than as lines drawn on top. The
   viewBox matches the screen's 9:19.5 aspect, so nothing stretches. */
.vp-fx--cracks { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 433' preserveAspectRatio='none'%3E%3Cg fill='none' stroke='%23000' stroke-width='1' stroke-opacity='0.28' stroke-linecap='round' transform='translate(0.5,0.5)'%3E%3Cpath d='M132 104 L174 121 L193 128 M132 104 L179 228 L226 331 M132 104 L129 152 L126 184 M132 104 L7 244 L-47 309 M132 104 L20 133 L-95 163 M132 104 L95 89 L57 75 M132 104 L108 78 L91 61 M132 104 L92 -44 L70 -121 M132 104 L172 -9 L191 -64 M132 104 L157 81 L173 68 M147 141 L130 139 M104 113 L101 90 M77 117 L79 83 M120 99 L125 95 M118 89 L128 88 M114 82 L124 77 M125 71 L143 74 M155 81 L164 116 M145 91 L151 111'/%3E%3C/g%3E%3C/svg%3E"), url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 433' preserveAspectRatio='none'%3E%3Cg fill='none' stroke='%23fff' stroke-width='0.55' stroke-opacity='0.42' stroke-linecap='round' transform='translate(0,0)'%3E%3Cpath d='M132 104 L174 121 L193 128 M132 104 L179 228 L226 331 M132 104 L129 152 L126 184 M132 104 L7 244 L-47 309 M132 104 L20 133 L-95 163 M132 104 L95 89 L57 75 M132 104 L108 78 L91 61 M132 104 L92 -44 L70 -121 M132 104 L172 -9 L191 -64 M132 104 L157 81 L173 68 M147 141 L130 139 M104 113 L101 90 M77 117 L79 83 M120 99 L125 95 M118 89 L128 88 M114 82 L124 77 M125 71 L143 74 M155 81 L164 116 M145 91 L151 111'/%3E%3C/g%3E%3C/svg%3E"), radial-gradient(circle at 66% 24%, rgb(255 255 255 / 0.5) 0 1px, rgb(255 255 255 / 0.1) 2.5px, transparent 4%); background-size: 100% 100%; background-repeat: no-repeat; }
.vp-fx--smudge { background: radial-gradient(ellipse 40% 25% at 70% 22%, rgb(255 255 255 / 0.1), transparent), radial-gradient(ellipse 35% 20% at 28% 62%, rgb(255 255 255 / 0.08), transparent), radial-gradient(ellipse 30% 15% at 55% 85%, rgb(255 255 255 / 0.07), transparent); }
.vp-fx--blood { background-image: radial-gradient(ellipse 9% 6% at 79% 11%, rgb(122 6 14 / 0.62) 0 60%, rgb(122 6 14 / 0.25) 78%, transparent 100%), radial-gradient(ellipse 2.5% 7% at 80% 17%, rgb(110 5 12 / 0.5) 0 55%, transparent 100%), radial-gradient(ellipse 3% 2.2% at 71% 21%, rgb(130 8 16 / 0.5) 0 60%, transparent 100%), radial-gradient(ellipse 1.6% 1.2% at 66% 27%, rgb(130 8 16 / 0.45) 0 60%, transparent 100%), radial-gradient(ellipse 1% 0.8% at 88% 25%, rgb(130 8 16 / 0.4) 0 60%, transparent 100%), radial-gradient(ellipse 11% 7% at 17% 77%, rgb(116 5 12 / 0.5) 0 58%, rgb(116 5 12 / 0.2) 80%, transparent 100%), radial-gradient(ellipse 2% 9% at 14% 84%, rgb(104 4 10 / 0.42) 0 55%, transparent 100%), radial-gradient(ellipse 2.4% 1.8% at 27% 88%, rgb(126 7 15 / 0.42) 0 60%, transparent 100%), radial-gradient(ellipse 1.2% 1% at 34% 71%, rgb(126 7 15 / 0.35) 0 60%, transparent 100%); }
.vp-fx--scanlines { background-image: repeating-linear-gradient(0deg, rgb(0 0 0 / 0.18) 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, rgb(255 0 0 / 0.03) 0 1px, rgb(0 255 0 / 0.03) 1px 2px, rgb(0 0 255 / 0.03) 2px 3px), linear-gradient(180deg, rgb(255 255 255 / 0.05), transparent 12%, transparent 88%, rgb(0 0 0 / 0.12)); }
.vp-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
`;
