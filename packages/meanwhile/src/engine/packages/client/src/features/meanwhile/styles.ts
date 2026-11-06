export const MEANWHILE_STYLES = `
.mw-shell { display: flex; flex-direction: column; gap: 0.75rem; padding: 0.75rem; max-width: 40rem; margin: 0 auto; color: var(--foreground); font: inherit; container-type: inline-size; }
.mw-head { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
.mw-title { font-size: 1.05rem; font-weight: 600; }
.mw-card { display: grid; gap: 0.6rem; padding: 0.85rem; border: 1px solid var(--border); border-radius: 0.75rem; background: var(--card); }
.mw-row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
.mw-grow { flex: 1; min-width: 0; }
.mw-name { font-weight: 600; overflow-wrap: anywhere; }
.mw-muted { color: var(--muted-foreground); font-size: 0.8125rem; }
.mw-warn { color: var(--destructive); font-size: 0.8125rem; }
.mw-btn { min-height: 2.75rem; min-width: 2.75rem; padding: 0.4rem 0.9rem; border-radius: 0.5rem; border: 1px solid var(--border); background: transparent; color: var(--foreground); font: inherit; cursor: pointer; }
.mw-btn:hover:not(:disabled) { background: var(--secondary); }
.mw-btn:focus-visible, .mw-input:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
.mw-btn:disabled { opacity: 0.5; cursor: default; }
.mw-widget { display: grid; gap: 0.5rem; }
.mw-hook { display: grid; gap: 0.1rem; width: 100%; text-align: left; overflow-wrap: anywhere; }
.mw-btn-primary { background: var(--primary); color: var(--primary-foreground); border-color: transparent; }
.mw-btn-primary:hover:not(:disabled) { background: var(--primary); opacity: 0.9; }
.mw-btn-on { background: var(--secondary); border-color: var(--ring); }
.mw-field { display: grid; gap: 0.3rem; }
.mw-label { font-size: 0.8125rem; font-weight: 500; }
.mw-input { min-height: 2.75rem; width: 100%; box-sizing: border-box; padding: 0.4rem 0.6rem; border-radius: 0.5rem; border: 1px solid var(--border); background: var(--background); color: var(--foreground); font: inherit; font-size: 1rem; }
.mw-list { display: grid; max-height: 11rem; overflow-y: auto; border: 1px solid var(--border); border-radius: 0.5rem; }
.mw-check { display: flex; align-items: center; gap: 0.6rem; min-height: 2.75rem; padding: 0 0.6rem; cursor: pointer; overflow-wrap: anywhere; }
.mw-check:hover { background: var(--secondary); }
.mw-seg { display: flex; flex-wrap: wrap; gap: 0.375rem; }
.mw-tag { padding: 0.1rem 0.5rem; border-radius: 999px; border: 1px solid var(--border); font-size: 0.75rem; color: var(--muted-foreground); }
.mw-empty { padding: 1.5rem 1rem; text-align: center; color: var(--muted-foreground); }
.mw-bubble { max-width: 85%; padding: 0.4rem 0.7rem; border-radius: 0.75rem; background: var(--secondary); overflow-wrap: anywhere; }
.mw-clip { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.mw-bubble-right { margin-inline-start: auto; background: var(--primary); color: var(--primary-foreground); }
@media (prefers-reduced-motion: no-preference) { .mw-btn { transition: background-color 0.15s ease; } }
`;
