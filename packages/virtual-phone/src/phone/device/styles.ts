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
.vp-cropper { display: flex; flex-direction: column; align-items: center; gap: 0.6rem; margin-top: 0.6rem; padding: 0.75rem; border-radius: 0.85rem; background: color-mix(in srgb, var(--vp-text) 5%, var(--vp-bg)); box-shadow: inset 0 0 0 1px var(--vp-border); }
.vp-cropper-view { position: relative; overflow: hidden; border-radius: 1rem; background: #000; box-shadow: inset 0 0 0 1px var(--vp-border); cursor: grab; touch-action: none; }
.vp-cropper-view:active { cursor: grabbing; }
.vp-cropper-actions { display: flex; gap: 0.5rem; }
.vp-access-denied { display: flex; align-items: flex-start; gap: 0.5rem; margin: 0.375rem 0.75rem 0; padding: 0.5rem 0.625rem; border-radius: 0.75rem; background: color-mix(in srgb, #ff453a 18%, var(--vp-surface)); color: var(--vp-text); font-size: 0.6875rem; font-weight: 500; box-shadow: inset 0 0 0 1px color-mix(in srgb, #ff453a 45%, transparent); }
.vp-access-denied span { flex: 1; }
.vp-access-denied button { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; width: 1.25rem; height: 1.25rem; border-radius: 0.5rem; color: var(--vp-muted); }

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
.vp-icon-btn { display: inline-flex; align-items: center; justify-content: center; height: 2.5rem; width: 2.5rem; flex-shrink: 0; border-radius: 999px; transition: background 140ms ease, transform 120ms ease; }
.vp-icon-btn:hover { background: color-mix(in srgb, var(--vp-text) 8%, var(--vp-bg)); }
.vp-icon-btn:active { transform: scale(0.94); }
.vp-icon-btn--surface { background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 97%, #ffffff), var(--vp-surface)); box-shadow: 0 1px 2px rgb(0 0 0 / 0.08), 0 4px 12px rgb(0 0 0 / 0.1), inset 0 0 0 1px var(--vp-border); }
.vp-icon-btn--surface:hover { background: var(--vp-surface); }
.vp-search-bar { display: block; width: 100%; min-height: 2.75rem; margin-top: 0; padding: 0 2.75rem 0 1rem; border: 0; border-radius: 999px; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 97%, #ffffff), var(--vp-surface)); color: var(--vp-text); font-size: 0.875rem; box-shadow: 0 1px 2px rgb(0 0 0 / 0.07), 0 5px 14px rgb(0 0 0 / 0.09), inset 0 0 0 1px var(--vp-border); }
.vp-search-bar::placeholder { color: var(--vp-muted); }
.vp-home-spacer { flex: 1; min-height: 2rem; }
.vp-home-apps { min-height: 0; max-height: 54%; overflow-y: auto; overscroll-behavior: contain; padding: 0.375rem 0.125rem 0.75rem; scrollbar-width: thin; }
.vp-app-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); column-gap: 0.625rem; row-gap: 1rem; padding: 0 0.25rem 0.5rem; }
.vp-home-clock { margin: 1.25rem 0 0; padding-left: 0.25rem; font-size: 2.5rem; font-weight: 250; letter-spacing: -0.02em; line-height: 1; font-variant-numeric: tabular-nums; text-shadow: 0 1px 10px rgb(0 0 0 / 0.12); }
.vp-home-date { margin: 0.375rem 0 0; padding-left: 0.25rem; font-size: 0.75rem; font-weight: 500; color: var(--vp-muted); text-shadow: 0 1px 6px rgb(0 0 0 / 0.1); }
.vp-app { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 0.375rem; min-width: 0; min-height: 4.625rem; border-radius: 0.75rem; color: var(--vp-text); }
.vp-app-badge { position: absolute; top: -0.375rem; right: 4%; z-index: 1; }
.vp-app-icon { display: flex; align-items: center; justify-content: center; height: 3.25rem; width: 3.25rem; flex-shrink: 0; border-radius: 1rem; color: #fff; box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.3), inset 0 -1px 0 rgb(0 0 0 / 0.15), 0 5px 12px rgb(0 0 0 / 0.18); transition: transform 140ms cubic-bezier(0.2, 0.9, 0.3, 1.4), filter 140ms ease; }
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
.vp-app-icon--pastasafari { background: linear-gradient(180deg, #ef6461 0%, #b3272d 100%); }
.vp-app-icon--azmoron { background: linear-gradient(180deg, #ffb84d 0%, #d97706 100%); }
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
.vp-map-canvas--full { position: absolute; inset: 4.25rem 0.75rem 0; min-height: 0; border-radius: 1.1rem 1.1rem 0 0; }
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
/* Contact actions: the row of things you can do with a person, which is what a contact card is for. */
.vp-contact-actions { display: grid; grid-auto-flow: column; gap: 0.5rem; width: 100%; margin-top: 0.5rem; }
.vp-contact-action { display: inline-flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.25rem; min-height: 3.25rem; border-radius: 0.875rem; background: color-mix(in srgb, var(--vp-accent) 12%, var(--vp-surface)); color: var(--vp-accent); font-size: 0.625rem; font-weight: 650; transition: transform 120ms ease, filter 140ms ease; }
.vp-contact-action:hover:not(:disabled) { filter: brightness(0.97); }
.vp-contact-action:active:not(:disabled) { transform: scale(0.97); }
.vp-find-row { display: flex; align-items: center; gap: 0.625rem; padding: 0.6rem 0.7rem; }
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
.vp-camera-subject { display: block; margin-top: 0.625rem; }
.vp-camera-bar { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-shrink: 0; margin-top: 0.75rem; padding: 0 0.25rem; }
/* Discard / Keep share the bar evenly instead of one of them wrapping onto two lines. */
.vp-camera-bar > .vp-surface-btn, .vp-camera-bar > .vp-accent-btn { flex: 1; min-height: 2.5rem; white-space: nowrap; }
/* The last shot, as a thumbnail you can press to open the roll. */
.vp-camera-thumb { display: flex; align-items: flex-end; height: 2.75rem; width: 2.75rem; padding: 0.25rem; overflow: hidden; border-radius: 0.5rem; background: linear-gradient(180deg, #fffdf2, #efe6c8); color: #4a4433; font-size: 0.4375rem; line-height: 1.15; text-align: left; box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.25), 0 2px 6px rgb(0 0 0 / 0.35); }
.vp-camera-thumb:disabled { background: color-mix(in srgb, var(--vp-text) 8%, var(--vp-bg)); box-shadow: inset 0 0 0 1px var(--vp-border); opacity: 1; }
.vp-camera-count { min-width: 2.75rem; text-align: right; font-size: 0.625rem; font-weight: 600; color: var(--vp-muted); font-variant-numeric: tabular-nums; }
.vp-roll-grid { display: grid; gap: 0.625rem; overflow-y: auto; }
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
.vp-app-icon--default { background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 92%, #ffffff), var(--vp-surface)); color: var(--vp-text); }
.vp-app-label { max-width: 100%; font-size: 0.625rem; font-weight: 550; line-height: 1.15; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 0 1px 4px rgb(0 0 0 / 0.1); }

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
.vp-settings-tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.25rem; flex-shrink: 0; margin-bottom: 0.75rem; padding: 0.25rem; border-radius: 0.75rem; background: color-mix(in srgb, var(--vp-text) 7%, var(--vp-bg)); }
.vp-settings-tabs button { min-height: 2.125rem; border-radius: 0.5625rem; color: var(--vp-muted); font-size: 0.6875rem; font-weight: 650; transition: background 120ms ease, color 120ms ease; }
.vp-settings-tabs button[aria-pressed="true"] { background: var(--vp-surface); color: var(--vp-text); box-shadow: 0 1px 3px rgb(0 0 0 / 0.12); }
.vp-settings-alert { margin: 0 0 0.625rem; padding: 0.5rem 0.75rem; border-radius: 0.625rem; background: color-mix(in srgb, #ff3b30 10%, var(--vp-surface)); color: #d92d20; font-size: 0.6875rem; }
.vp-settings-scroll { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding-bottom: 0.75rem; }
.vp-settings-sections { display: grid; gap: 1.125rem; }
.vp-settings-sections section { display: grid; gap: 0.5rem; }
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
.vp-game-head { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 0.25rem 1rem; text-align: center; }
.vp-game-head span { display: grid; gap: 0.125rem; min-width: 4rem; color: var(--vp-muted); }
.vp-game-head strong { color: var(--vp-text); font-size: 1.15rem; }
.vp-game-head small { font-size: 0.625rem; text-transform: uppercase; letter-spacing: 0.08em; }
.vp-pasta-board { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 0.35rem; padding: 0.65rem; border-radius: 1rem; background: #24334a; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.12); }
.vp-pasta-tile { aspect-ratio: 1; border: 0; border-radius: 0.55rem; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1.35rem; line-height: 1; box-shadow: inset 0 -0.18rem 0 rgba(0,0,0,0.18), 0 0.15rem 0.2rem rgba(0,0,0,0.18); transition: transform 120ms ease, box-shadow 120ms ease; }
.vp-pasta-tile:hover, .vp-pasta-tile.is-selected { transform: scale(1.08); box-shadow: 0 0 0 0.18rem #fff, 0 0.2rem 0.35rem rgba(0,0,0,0.28); }
.vp-pasta-tile--red { background: #ef6461; } .vp-pasta-tile--yellow { background: #f2c14e; } .vp-pasta-tile--green { background: #5dbb78; } .vp-pasta-tile--blue { background: #5c9ded; } .vp-pasta-tile--pink { background: #db78b7; }
.vp-pasta-tile:disabled { cursor: default; }
.vp-pasta-stage { position: relative; }
.vp-pasta-over { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.6rem; border-radius: 1rem; background: rgba(15, 22, 34, 0.82); color: #fff; backdrop-filter: blur(2px); }
.vp-pasta-over strong { font-size: 1.1rem; } .vp-pasta-over span { color: #cdd6e4; font-variant-numeric: tabular-nums; }
.vp-pasta-flash { min-height: 1.2rem; margin: 0.6rem 0; text-align: center; font-size: 0.8rem; font-weight: 600; color: var(--vp-accent); }
.vp-az-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.625rem; }
.vp-az-product { display: flex; flex-direction: column; gap: 0.35rem; padding: 0.7rem; }
.vp-az-product .vp-section-label { font-size: 0.6rem; }
.vp-az-product h3 { margin: 0; font-size: 0.85rem; line-height: 1.25; }
.vp-az-product p { margin: 0; color: var(--vp-muted); font-size: 0.72rem; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.vp-az-buy { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; margin-top: auto; padding-top: 0.35rem; }
.vp-az-buy strong { color: var(--vp-accent); font-size: 0.95rem; }
/* Notes look like notes. An earlier pass replaced the paper cards with a plain grouped list —
   correct as structure, and it threw away the one app on the phone with any character. Paper is
   fixed cream in both themes on purpose: a sticky note is not a surface that goes dark. */
.vp-notes-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.625rem; }
.vp-note-card { position: relative; display: grid; align-content: start; gap: 0.3rem; min-height: 6.75rem; padding: 0.7rem 0.7rem 1.1rem; border-radius: 0.35rem 0.9rem 0.9rem 0.35rem; text-align: left; background: linear-gradient(180deg, #fffdf2, #fdf3cf); color: #3a3320; box-shadow: 0 1px 2px rgb(0 0 0 / 0.18), 0 8px 16px rgb(0 0 0 / 0.22); transition: transform 120ms ease, box-shadow 140ms ease; overflow: hidden; }
/* The binding edge, so a card reads as torn from a pad rather than as a coloured rectangle. */
.vp-note-card::before { content: ""; position: absolute; inset: 0 auto 0 0; width: 0.3125rem; background: repeating-linear-gradient(180deg, #e8d9a4 0 3px, #f3e7bd 3px 7px); box-shadow: inset -1px 0 0 rgb(0 0 0 / 0.08); }
.vp-note-card:hover { transform: translateY(-1px); box-shadow: 0 2px 4px rgb(0 0 0 / 0.2), 0 12px 22px rgb(0 0 0 / 0.26); }
.vp-note-card:active { transform: scale(0.97); }
.vp-note-card h3 { margin: 0 0 0 0.4rem; font-size: 0.82rem; font-weight: 650; line-height: 1.25; }
.vp-note-card p { margin: 0 0 0 0.4rem; font-size: 0.72rem; line-height: 1.35; color: #6b6244; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.vp-note-card time { position: absolute; left: 1.1rem; bottom: 0.5rem; font-size: 0.6rem; color: #9a8f68; }
/* The editor is the same sheet of paper, ruled. */
.vp-note-paper { flex: 1; min-height: 0; width: 100%; padding: 0.75rem 0.9rem 0.75rem 1.15rem; border: 0; border-radius: 0.35rem 0.9rem 0.9rem 0.35rem; resize: none; font: inherit; font-size: 0.8125rem; line-height: 1.5rem; color: #3a3320; background-color: #fffdf2; background-image: repeating-linear-gradient(180deg, transparent 0 calc(1.5rem - 1px), rgb(58 51 32 / 0.12) calc(1.5rem - 1px) 1.5rem), linear-gradient(90deg, #e8d9a4 0 0.3125rem, transparent 0.3125rem); background-position: 0 0.6rem, 0 0; box-shadow: 0 1px 2px rgb(0 0 0 / 0.18), 0 8px 16px rgb(0 0 0 / 0.22); }
.vp-note-paper::placeholder { color: #a89c72; }
.vp-note-paper:focus-visible { outline: 2px solid var(--vp-accent); outline-offset: 2px; }
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
.vp-thread-view .vp-composer { flex-shrink: 0; }
.vp-bubbles { display: flex; flex-direction: column; gap: 0.375rem; flex: 1; overflow-y: auto; padding-bottom: 0.875rem; }
.vp-bubble { width: fit-content; max-width: 78%; padding: 0.5rem 0.75rem; border-radius: 1.125rem; font-size: 0.8125rem; line-height: 1.35; overflow-wrap: anywhere; }
.vp-bubble--self { align-self: flex-end; border-bottom-right-radius: 0.375rem; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-accent) 88%, #ffffff), var(--vp-accent)); color: #fff; box-shadow: 0 1px 2px rgb(0 0 0 / 0.12), inset 0 1px 0 rgb(255 255 255 / 0.2); }
.vp-bubble--other { align-self: flex-start; border-bottom-left-radius: 0.375rem; background: linear-gradient(180deg, color-mix(in srgb, var(--vp-surface) 96%, #ffffff), var(--vp-surface)); box-shadow: 0 1px 2px rgb(0 0 0 / 0.07), inset 0 0 0 1px var(--vp-border); }
.vp-bubble-time { display: block; margin-top: 0.125rem; font-size: 0.5625rem; opacity: 0.7; }
.vp-composer { display: flex; align-items: center; gap: 0.5rem; }
/* Photos sit shoulder to shoulder and run to the edges, the way every camera roll does. */
.vp-gallery-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 2px; margin: 0 -0.75rem; }
.vp-gallery-cell { aspect-ratio: 1; overflow: hidden; border-radius: 0; background: color-mix(in srgb, var(--vp-text) 6%, var(--vp-bg)); transition: opacity 120ms ease; }
.vp-gallery-cell:active { opacity: 0.7; }
.vp-gallery-cell img { display: block; height: 100%; width: 100%; object-fit: cover; }
.vp-gallery-skeleton { aspect-ratio: 1; border-radius: 0.5rem; }
.vp-photo-view { margin: 0; }
.vp-photo-view img { display: block; width: 100%; border-radius: 1.125rem; box-shadow: 0 4px 16px rgb(0 0 0 / 0.25); }
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
.vp-goodle-tabs button { display: inline-flex; align-items: center; gap: 0.3125rem; padding: 0 0.125rem 0.5rem; font-size: 0.75rem; font-weight: 600; color: var(--vp-muted); border-bottom: 2px solid transparent; margin-bottom: -1px; }
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
.vp-go-btn { position: absolute; right: 0.3125rem; top: 50%; translate: 0 -50%; display: inline-flex; align-items: center; justify-content: center; height: 2.125rem; width: 2.125rem; border-radius: 999px; background: var(--vp-accent); color: #fff; box-shadow: 0 1px 3px rgb(0 0 0 / 0.2); transition: transform 120ms ease; }
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
.vp-store-remove { font-size: 0.625rem; font-weight: 600; color: var(--vp-muted); padding: 0.125rem 0.375rem; border-radius: 0.375rem; }
.vp-store-remove:hover { color: #ff3b30; }
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
