// ──────────────────────────────────────────────
// Pasta Phone — package-owned stylesheet
//
// Deliberately plain CSS rather than Tailwind utilities. The Engine only emits
// utility classes listed in its capability-package-safelist.html, which lives in
// the Engine repo and is generated from the maps/calls/game views. Anything this
// package invented would silently render unstyled. Hierarchical Maps works around
// the same limit by injecting <style> blocks; doing it wholesale keeps the phone
// self-contained and means no Engine-side change is needed to restyle it.
//
// Every colour resolves through --marinara-chat-chrome-* tokens, so both installed
// themes (Y2K Marinara, SillyTavern classic) and light/dark mode follow for free.
// ──────────────────────────────────────────────
export const PASTA_PHONE_STYLES = `
[data-pasta-phone-overlay] {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0;
}

[data-pasta-phone-backdrop] {
  position: absolute;
  inset: 0;
  background: rgb(0 0 0 / 55%);
  backdrop-filter: blur(2px);
}

[data-pasta-phone-sheet] {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 24rem;
  height: min(38rem, 88dvh);
  overflow: hidden;
  border: 1px solid var(--marinara-chat-chrome-panel-border);
  border-bottom: 0;
  border-radius: 1.5rem 1.5rem 0 0;
  padding-bottom: env(safe-area-inset-bottom);
  background: var(--marinara-chat-chrome-panel-bg);
  color: var(--marinara-chat-chrome-panel-text);
  box-shadow: 0 -1.5rem 3rem rgb(0 0 0 / 45%);
}

@media (min-width: 40rem) {
  [data-pasta-phone-overlay] { padding: 1rem; }
  [data-pasta-phone-sheet] {
    border-bottom: 1px solid var(--marinara-chat-chrome-panel-border);
    border-radius: 1.75rem;
  }
}

[data-pasta-phone-status] {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid var(--marinara-chat-chrome-panel-divider);
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--marinara-chat-chrome-panel-title);
}

[data-pasta-phone-status-icons] {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  color: var(--marinara-chat-chrome-panel-muted);
}

[data-pasta-phone-screen] {
  flex: 1 1 0%;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--marinara-chat-chrome-panel-scrollbar) transparent;
}

/* ── Launcher ── */
[data-pasta-phone-launcher] { padding: 1.75rem 1.5rem; }

[data-pasta-phone-launcher] h2 {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--marinara-chat-chrome-panel-title);
}

[data-pasta-phone-launcher] p {
  margin: 0.25rem 0 0;
  font-size: 0.6875rem;
  line-height: 1.4;
  color: var(--marinara-chat-chrome-panel-muted);
}

[data-pasta-phone-grid] {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.5rem 1rem;
  justify-items: center;
  margin-top: 1.75rem;
}

[data-pasta-phone-app] {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border: 0;
  border-radius: 1rem;
  background: transparent;
  cursor: pointer;
  font: inherit;
  color: var(--marinara-chat-chrome-panel-text);
  transition: transform 120ms ease-out;
}

[data-pasta-phone-app]:hover { transform: scale(1.05); }
[data-pasta-phone-app]:focus-visible {
  outline: 2px solid var(--marinara-chat-chrome-focus-ring);
  outline-offset: 2px;
}

[data-pasta-phone-app-tile] {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 1rem;
  color: #fff;
  box-shadow: 0 0.25rem 0.75rem rgb(0 0 0 / 25%);
}

[data-pasta-phone-app-label] {
  font-size: 0.6875rem;
  font-weight: 500;
}

/* ── App screens ── */
[data-pasta-phone-app-screen] {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

[data-pasta-phone-app-header] {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border-bottom: 1px solid var(--marinara-chat-chrome-panel-divider);
  background: var(--marinara-chat-chrome-panel-bg);
}

[data-pasta-phone-back] {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 2.75rem;
  min-height: 2.75rem;
  border: 0;
  border-radius: 0.5rem;
  background: transparent;
  cursor: pointer;
  color: var(--marinara-chat-chrome-panel-muted);
  transition: background-color 120ms ease-out, color 120ms ease-out;
}

[data-pasta-phone-back]:hover {
  background: var(--marinara-chat-chrome-highlight-bg-hover);
  color: var(--marinara-chat-chrome-highlight-text);
}

[data-pasta-phone-back]:focus-visible {
  outline: 2px solid var(--marinara-chat-chrome-focus-ring);
  outline-offset: -2px;
}

[data-pasta-phone-app-title] {
  flex: 1 1 0%;
  min-width: 0;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--marinara-chat-chrome-panel-title);
}

[data-pasta-phone-preview-badge] {
  flex-shrink: 0;
  padding: 0.125rem 0.5rem;
  border-radius: 999px;
  font-size: 0.5625rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #fff;
}

[data-pasta-phone-app-body] { padding: 1rem; }

[data-pasta-phone-note] {
  margin: 1rem 0 0;
  padding: 0.5rem 0.75rem;
  border: 1px dashed var(--marinara-chat-chrome-panel-border);
  border-radius: 0.5rem;
  font-size: 0.625rem;
  line-height: 1.4;
  color: var(--marinara-chat-chrome-panel-muted);
}

[data-pasta-phone-card] {
  padding: 0.75rem;
  border: 1px solid var(--marinara-chat-chrome-panel-border);
  border-radius: 0.75rem;
  background: var(--marinara-chat-chrome-highlight-bg);
}

[data-pasta-phone-stack] { display: grid; gap: 0.75rem; }

[data-pasta-phone-avatar] {
  flex-shrink: 0;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--marinara-chat-chrome-panel-muted) 30%, transparent);
}

[data-pasta-phone-avatar="lg"] { width: 2rem; height: 2rem; }

[data-pasta-phone-row] { display: flex; align-items: center; gap: 0.5rem; }

[data-pasta-phone-byline] {
  flex: 1 1 0%;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--marinara-chat-chrome-panel-title);
}

[data-pasta-phone-muted] {
  font-weight: 400;
  color: var(--marinara-chat-chrome-panel-muted);
}

[data-pasta-phone-body-text] {
  margin: 0.5rem 0 0;
  font-size: 0.6875rem;
  line-height: 1.6;
  color: var(--marinara-chat-chrome-panel-text);
}

[data-pasta-phone-stats] {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 0.625rem;
  font-size: 0.625rem;
  color: var(--marinara-chat-chrome-panel-muted);
}

[data-pasta-phone-stats] span {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

/* ── NoodleR thread ── */
[data-pasta-phone-reply] {
  border-left: 2px solid var(--marinara-chat-chrome-panel-border);
  padding-left: 0.625rem;
}

[data-pasta-phone-reply] p { margin: 0; }

[data-pasta-phone-reply-author] {
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--marinara-chat-chrome-panel-title);
}

/* ── Chats ── */
[data-pasta-phone-chat-list] {
  margin: 0;
  padding: 0;
  list-style: none;
}

[data-pasta-phone-chat-list] li {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.625rem 0;
}

[data-pasta-phone-chat-list] li + li {
  border-top: 1px solid var(--marinara-chat-chrome-panel-divider);
}

[data-pasta-phone-chat-lines] { flex: 1 1 0%; min-width: 0; }

[data-pasta-phone-chat-lines] span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

[data-pasta-phone-chat-name] {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--marinara-chat-chrome-panel-title);
}

[data-pasta-phone-chat-preview] {
  font-size: 0.625rem;
  color: var(--marinara-chat-chrome-panel-muted);
}

[data-pasta-phone-chat-meta] {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
  font-size: 0.5625rem;
  color: var(--marinara-chat-chrome-panel-muted);
}

[data-pasta-phone-unread] {
  padding: 0 0.375rem;
  border-radius: 999px;
  background: #1f9d68;
  font-weight: 600;
  color: #fff;
}

/* ── App Store ── */
[data-pasta-phone-store-heading] {
  margin: 0;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--marinara-chat-chrome-panel-title);
}

[data-pasta-phone-store-grid] {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.625rem;
  margin-top: 0.75rem;
}

[data-pasta-phone-store-tile] {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem;
  border: 1px solid var(--marinara-chat-chrome-panel-border);
  border-radius: 0.75rem;
  background: var(--marinara-chat-chrome-highlight-bg);
}

[data-pasta-phone-store-icon] {
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  border-radius: 0.5rem;
}

[data-pasta-phone-store-lines] { min-width: 0; flex: 1 1 0%; }

[data-pasta-phone-store-lines] span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

[data-pasta-phone-store-name] {
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--marinara-chat-chrome-panel-title);
}

[data-pasta-phone-store-tag] {
  font-size: 0.5625rem;
  color: var(--marinara-chat-chrome-panel-muted);
}
`;
