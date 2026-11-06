// Theme tokens only. The status dots and the newsprint of the paper are fixed colors by design.
export const MEANWHILE_STYLES = `
.mw-shell { display: flex; flex-direction: column; gap: 0.75rem; padding: 0.75rem; max-width: 72rem; margin: 0 auto; color: var(--foreground); font: inherit; container-type: inline-size; }
.mw-desk { display: grid; grid-template-columns: 340px minmax(0, 1fr); gap: 1.5rem; align-items: start; }
.mw-col { display: flex; flex-direction: column; gap: 0.75rem; min-width: 0; }
.mw-stack { display: flex; flex-direction: column; gap: 0.5rem; min-width: 0; }
.mw-top { display: flex; align-items: center; gap: 0.5rem; }
.mw-circles { display: flex; gap: 0.4rem; flex: 1; min-width: 0; overflow-x: auto; scrollbar-width: none; }
.mw-chips { display: flex; gap: 0.4rem; overflow-x: auto; scrollbar-width: none; }
.mw-chip { flex: 0 0 auto; min-height: 2.75rem; padding: 0 0.9rem; border-radius: 999px; border: 1px solid var(--border); background: transparent; color: var(--muted-foreground); font: inherit; font-size: 0.8125rem; display: inline-flex; align-items: center; gap: 0.4rem; cursor: pointer; }
.mw-chip-on { background: var(--secondary); color: var(--foreground); border-color: transparent; font-weight: 600; }
.mw-n { background: var(--primary); color: var(--primary-foreground); border-radius: 999px; font-size: 0.6875rem; padding: 0 0.4rem; font-weight: 700; }
.mw-icon { width: 2.75rem; height: 2.75rem; flex: 0 0 auto; border-radius: 0.75rem; border: 1px solid var(--border); background: transparent; color: var(--foreground); display: grid; place-items: center; cursor: pointer; font: inherit; }
.mw-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem; }
.mw-title { font-size: 1.375rem; font-weight: 600; letter-spacing: -0.01em; margin: 0; }
.mw-meta { color: var(--muted-foreground); font-size: 0.78rem; margin-top: 0.125rem; }
.mw-menu { position: relative; }
.mw-pop { position: absolute; inset-inline-end: 0; top: 3rem; z-index: 20; min-width: 11rem; display: grid; padding: 0.25rem; border: 1px solid var(--border); border-radius: 0.75rem; background: var(--card); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35); }
.mw-item { min-height: 2.75rem; padding: 0 0.75rem; border: 0; border-radius: 0.5rem; background: transparent; color: var(--foreground); font: inherit; text-align: start; cursor: pointer; }
.mw-item:hover, .mw-item:focus-visible { background: var(--secondary); outline: none; }
.mw-cast { display: flex; gap: 0.75rem; overflow-x: auto; padding: 0.5rem 0.125rem 0.375rem; scrollbar-width: none; }
.mw-person { flex: 0 0 4.75rem; text-align: center; }
.mw-person b { display: block; font-size: 0.78rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 0.3rem; }
.mw-person span { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; font-size: 0.6875rem; color: var(--muted-foreground); line-height: 1.25; }
.mw-av { position: relative; flex: 0 0 auto; display: inline-grid; place-items: center; border-radius: 50%; color: #fff; font-weight: 700; box-shadow: 0 0 0 2px var(--background); }
.mw-av img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
.mw-av-ring { box-shadow: 0 0 0 2px var(--background), 0 0 0 3.5px var(--primary); }
.mw-person .mw-av { margin: 0 auto; }
.mw-dot { position: absolute; inset-inline-end: 0; bottom: 1px; width: 0.8rem; height: 0.8rem; border-radius: 50%; border: 2.5px solid var(--background); }
.mw-dot-online { background: #6fbf7e; }
.mw-dot-busy { background: #e0b45a; }
.mw-dot-offline { background: #6b6468; }
.mw-cta { display: flex; gap: 0.5rem; }
.mw-cta .mw-btn-primary { flex: 1; }
.mw-tabs { display: flex; gap: 0.125rem; padding: 0.1875rem; background: var(--muted); border-radius: 0.75rem; overflow-x: auto; scrollbar-width: none; }
.mw-tab { flex: 1 0 auto; min-height: 2.75rem; padding: 0 0.75rem; border: 0; border-radius: 0.5625rem; background: transparent; color: var(--muted-foreground); font: inherit; font-size: 0.8125rem; cursor: pointer; }
.mw-tab-on { background: var(--card); color: var(--foreground); font-weight: 600; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3); }
.mw-card { display: grid; gap: 0.6rem; padding: 0.85rem; border: 1px solid var(--border); border-radius: 1rem; background: var(--card); text-align: start; color: inherit; font: inherit; }
.mw-row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
.mw-grow { flex: 1; min-width: 0; }
.mw-center { text-align: center; }
.mw-name { font-weight: 600; }
.mw-muted { color: var(--muted-foreground); font-size: 0.8125rem; overflow-wrap: anywhere; }
.mw-warn { color: var(--destructive); font-size: 0.8125rem; }
.mw-btn { min-height: 2.75rem; min-width: 2.75rem; padding: 0.4rem 1rem; border-radius: 0.75rem; border: 1px solid var(--border); background: transparent; color: var(--foreground); font: inherit; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; }
.mw-btn:hover:not(:disabled) { background: var(--secondary); }
.mw-btn:focus-visible, .mw-input:focus-visible, .mw-icon:focus-visible, .mw-chip:focus-visible, .mw-tab:focus-visible, .mw-more:focus-visible, summary:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
.mw-btn:disabled { opacity: 0.5; cursor: default; }
.mw-btn-sm { padding: 0.4rem 0.75rem; font-size: 0.8125rem; }
.mw-btn-primary { background: var(--primary); color: var(--primary-foreground); border-color: transparent; }
.mw-btn-primary:hover:not(:disabled) { background: var(--primary); opacity: 0.9; }
.mw-btn-on { background: var(--secondary); border-color: var(--ring); }
.mw-field { display: grid; gap: 0.3rem; }
.mw-label { font-size: 0.72rem; font-weight: 700; color: var(--muted-foreground); text-transform: uppercase; letter-spacing: 0.06em; }
.mw-labelrow { display: flex; justify-content: space-between; font-size: 0.72rem; font-weight: 700; color: var(--muted-foreground); text-transform: uppercase; letter-spacing: 0.06em; margin: 0.5rem 0 0.125rem; }
.mw-input { min-height: 2.75rem; width: 100%; box-sizing: border-box; padding: 0.4rem 0.6rem; border-radius: 0.5rem; border: 1px solid var(--border); background: var(--background); color: var(--foreground); font: inherit; font-size: 1rem; }
.mw-list { display: grid; max-height: 11rem; overflow-y: auto; border: 1px solid var(--border); border-radius: 0.5rem; }
.mw-check { display: flex; align-items: center; gap: 0.6rem; min-height: 2.75rem; padding: 0 0.6rem; cursor: pointer; overflow-wrap: anywhere; }
.mw-check:hover { background: var(--secondary); }
.mw-seg { display: flex; flex-wrap: wrap; gap: 0.375rem; }
.mw-tag { margin-inline-start: 0.375rem; padding: 0.1rem 0.5rem; border-radius: 999px; border: 1px solid var(--border); font-size: 0.6875rem; color: var(--muted-foreground); white-space: nowrap; }
.mw-empty { padding: 1.5rem 1rem; text-align: center; color: var(--muted-foreground); }
.mw-wait { border-color: color-mix(in srgb, #e0b45a 45%, var(--border)); background: color-mix(in srgb, #e0b45a 7%, var(--card)); }
.mw-waittag { font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.06em; color: var(--muted-foreground); }
.mw-hookcard { grid-template-columns: 2.5rem minmax(0, 1fr); gap: 0.75rem; }
.mw-who { font-weight: 600; font-size: 0.8125rem; }
.mw-who small { font-weight: 400; font-size: 0.6875rem; color: var(--muted-foreground); margin-inline-start: 0.375rem; }
.mw-hooktext { margin: 0.125rem 0 0.375rem; font-size: 0.875rem; }
.mw-teaser { display: flex; align-items: center; gap: 0.75rem; }
.mw-teaser b { display: block; font-size: 0.84rem; }
.mw-teaser small { display: block; font-size: 0.78rem; color: var(--muted-foreground); }
.mw-teaserbtn { width: 100%; cursor: pointer; }
.mw-ico { width: 2.5rem; height: 2.5rem; flex: 0 0 auto; border-radius: 0.625rem; background: var(--secondary); display: grid; place-items: center; }
.mw-diary { display: grid; }
.mw-entry { position: relative; margin-inline-start: 0.375rem; padding: 0 0 0.875rem 1.125rem; border-inline-start: 2px solid var(--border); }
.mw-entry::before { content: ""; position: absolute; inset-inline-start: -0.375rem; top: 0.25rem; width: 0.625rem; height: 0.625rem; border-radius: 50%; background: var(--primary); }
.mw-when { font-size: 0.75rem; color: var(--muted-foreground); }
.mw-line { font-family: Georgia, "Times New Roman", serif; font-style: italic; font-size: 0.9375rem; margin-top: 0.125rem; overflow-wrap: anywhere; }
.mw-threadhead { display: flex; align-items: center; gap: 0.6rem; }
.mw-pair { display: inline-flex; flex: 0 0 auto; }
.mw-pair .mw-av + .mw-av { margin-inline-start: -0.625rem; }
.mw-thread { display: flex; align-items: center; gap: 0.75rem; width: 100%; cursor: pointer; }
.mw-clip { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.mw-day { text-align: center; font-size: 0.72rem; color: var(--muted-foreground); margin: 0.5rem 0; }
.mw-bubble { max-width: 80%; padding: 0.5rem 0.7rem; border-radius: 1rem 1rem 1rem 0.3rem; background: var(--secondary); font-size: 0.875rem; overflow-wrap: anywhere; }
.mw-bubble small { display: block; font-size: 0.6875rem; font-weight: 600; color: var(--muted-foreground); margin-bottom: 1px; }
.mw-bubble time { display: block; font-size: 0.65rem; color: var(--muted-foreground); text-align: end; margin-top: 0.125rem; }
.mw-bubble-right { margin-inline-start: auto; border-radius: 1rem 1rem 0.3rem 1rem; background: color-mix(in srgb, var(--primary) 22%, var(--card)); }
.mw-paper { container-type: inline-size; background: #f4ede0; color: #241c14; border-radius: 0.375rem; padding: 1rem; font-family: Georgia, "Times New Roman", serif; max-width: 100%; box-sizing: border-box; }
.mw-mast { text-align: center; font-size: 1.625rem; font-weight: 700; letter-spacing: -0.01em; border-bottom: 3px double #241c14; padding-bottom: 0.375rem; }
.mw-ed { display: flex; justify-content: space-between; font-size: 0.6875rem; border-bottom: 1px solid #241c14; padding: 0.25rem 0; margin-bottom: 0.75rem; font-family: inherit; }
.mw-paper h4 { font-size: 1.1875rem; line-height: 1.15; margin: 0 0 0.375rem; }
.mw-paper p { font-size: 0.8125rem; margin: 0 0 0.75rem; line-height: 1.45; }
.mw-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; border-top: 1px solid #241c14; padding-top: 0.625rem; }
.mw-cols h5 { font-size: 0.84rem; margin: 0 0 0.25rem; line-height: 1.2; }
.mw-cols p { font-size: 0.72rem; margin: 0; }
@container (max-width: 280px) { .mw-cols { grid-template-columns: 1fr; } }
.mw-papercol { max-width: 620px; }
.mw-tlday { font-weight: 700; font-size: 0.8125rem; margin: 0.875rem 0 0.5rem; }
.mw-ev { display: grid; grid-template-columns: 4.5rem 1fr 2.75rem; gap: 0.5rem; align-items: start; padding: 0.5rem 0; border-top: 1px solid var(--border); }
.mw-ev time { font-size: 0.75rem; color: var(--muted-foreground); padding-top: 0.125rem; }
.mw-ev-routine { opacity: 0.6; }
.mw-more { width: 2.75rem; height: 2.75rem; margin: -0.5rem 0; border: 0; border-radius: 0.625rem; background: transparent; color: var(--muted-foreground); display: grid; place-items: center; cursor: pointer; }
.mw-evacts { grid-column: 1 / -1; }
.mw-details summary { list-style: none; cursor: pointer; }
.mw-details summary::-webkit-details-marker { display: none; }
.mw-details[open] summary { margin-bottom: 0.5rem; }
.mw-scrim { position: fixed; inset: 0; z-index: 50; display: flex; align-items: flex-end; justify-content: center; background: rgba(0, 0, 0, 0.55); }
.mw-sheet { width: 100%; max-width: 32rem; max-height: 85dvh; overflow-y: auto; display: grid; gap: 0.75rem; padding: 1rem; border: 1px solid var(--border); border-radius: 1.25rem 1.25rem 0 0; background: var(--card); color: var(--foreground); box-sizing: border-box; }
.mw-sheet:focus { outline: none; }
.mw-widget { display: grid; gap: 0.5rem; }
.mw-hook { display: flex; align-items: flex-start; gap: 0.6rem; width: 100%; text-align: start; overflow-wrap: anywhere; font-weight: 400; justify-content: flex-start; }
.mw-hook > span:last-child { display: grid; gap: 0.1rem; min-width: 0; }
@media (min-width: 900px) { .mw-scrim { align-items: center; } .mw-sheet { border-radius: 1.25rem; } }
@media (prefers-reduced-motion: no-preference) { .mw-btn, .mw-chip, .mw-tab { transition: background-color 0.15s ease; } }
`;
