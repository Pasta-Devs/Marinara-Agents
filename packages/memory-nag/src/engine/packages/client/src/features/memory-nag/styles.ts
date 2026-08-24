export const MEMORY_NAG_STYLES = `
.mn-shell {
  --mn-chroma: var(--marinara-chat-chrome-accent, var(--foreground));
  --accent: var(--marinara-chat-chrome-highlight-bg);
  --accent-foreground: var(--marinara-chat-chrome-highlight-text);
  --background: var(--marinara-chat-chrome-panel-bg);
  --border: var(--marinara-chat-chrome-panel-border);
  --card: var(--marinara-chat-chrome-panel-bg);
  --foreground: var(--marinara-chat-chrome-panel-text);
  --input: var(--marinara-chat-chrome-input-border);
  --muted: var(--marinara-chat-chrome-highlight-bg);
  --muted-foreground: var(--marinara-chat-chrome-panel-muted);
  --popover: var(--marinara-chat-chrome-panel-bg);
  --popover-foreground: var(--marinara-chat-chrome-panel-text);
  --primary: var(--marinara-chat-chrome-highlight-text);
  --primary-foreground: var(--marinara-chat-chrome-panel-bg);
  --ring: var(--marinara-chat-chrome-focus-ring);
  --secondary: var(--marinara-chat-chrome-highlight-bg);
  color: var(--marinara-chat-chrome-panel-text);
  font: inherit;
}

.mn-panel {
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background: var(--card);
  padding: 0.75rem;
}

.mn-stack {
  display: grid;
  gap: 0.65rem;
}

.mn-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.mn-between {
  justify-content: space-between;
}

.mn-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
}

.mn-number-grid {
  display: grid;
  gap: 0.5rem;
}

.mn-number-field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.25rem;
  color: var(--muted-foreground);
}

.mn-number-copy {
  display: grid;
  min-width: 0;
  gap: 0.125rem;
}

.mn-number-copy strong {
  color: var(--foreground);
  font-size: 0.625rem;
  font-weight: 500;
}

.mn-number-copy small {
  color: var(--muted-foreground);
  font-size: 0.59375rem;
  line-height: 1.35;
}

.mn-label {
  display: grid;
  gap: 0.25rem;
  color: var(--muted-foreground);
  font-size: 0.625rem;
}

.mn-label > span:first-child,
.mn-label-title {
  color: var(--foreground);
  font-weight: 500;
}

.mn-label small {
  font-size: 0.59375rem;
  line-height: 1.35;
}

.mn-field {
  box-sizing: border-box;
  width: 100%;
  padding: 0.5rem 0.625rem;
  font: inherit;
  font-size: 0.75rem;
}

.mn-number-input {
  height: 2.25rem;
  min-height: 2.25rem;
  font-variant-numeric: tabular-nums;
}

.mn-textarea {
  min-height: 7rem;
  resize: vertical;
  line-height: 1.45;
}

.mn-vault-textarea {
  padding-right: 2rem;
}

.mn-prompt-textarea {
  min-height: 3.25rem;
  border-radius: 0.375rem;
  padding: 0.5rem 2rem 0.5rem 0.625rem;
  font-size: 0.75rem;
  line-height: 1.625;
}

.mn-prompt-field {
  position: relative;
}

.mn-prompt-tools {
  position: absolute;
  top: 0.375rem;
  right: 0.375rem;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.mn-prompt-tool {
  display: flex;
  height: 1.25rem;
  width: 1.25rem;
  min-height: 1.25rem;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 0.25rem;
  background: transparent;
  padding: 0.25rem;
  color: var(--muted-foreground);
  cursor: pointer;
  transition: color 150ms ease, background 150ms ease;
}

.mn-prompt-tool:not(:disabled):hover {
  background: var(--accent);
  color: var(--foreground);
}

.mn-prompt-tool:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 1px;
}

.mn-prompt-tool:disabled {
  cursor: default;
  opacity: 0.4;
}

.mn-prompt-tool .mn-icon {
  width: 0.75rem;
  height: 0.75rem;
}

.mn-vault-macro-menu {
  position: absolute;
  z-index: 1;
  top: 1.75rem;
  right: 0.375rem;
  display: flex;
  gap: 0.25rem;
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  background: var(--popover);
  padding: 0.25rem;
  box-shadow: 0 0.5rem 1.25rem rgb(0 0 0 / 0.2);
}

.mn-prompt-modal {
  width: min(64rem, calc(100vw - 2rem));
}

.mn-expanded-prompt {
  min-height: min(70vh, 42rem);
  resize: vertical;
  padding: 0.85rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.75rem;
  line-height: 1.55;
}

.mn-macro-modal {
  width: min(30rem, calc(100vw - 2rem));
}

.mn-macro-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
  gap: 0.4rem;
}

.mn-macro-list code {
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  background: var(--muted);
  padding: 0.45rem 0.55rem;
  color: var(--foreground);
  font-size: 0.7rem;
}

.mn-icon-button {
  height: 1.75rem;
  width: 1.75rem;
  padding: 0;
}

.mn-muted {
  color: var(--muted-foreground);
  font-size: 0.68rem;
  line-height: 1.4;
}

.mn-status {
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background: var(--muted);
  padding: 0.5rem 0.6rem;
  font-size: 0.7rem;
}

.mn-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.mn-actions-end {
  justify-content: flex-end;
}

.mn-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: max(1rem, env(safe-area-inset-top)) 1rem max(1rem, env(safe-area-inset-bottom));
}

.mn-overlay::before {
  position: absolute;
  inset: 0;
  background: rgb(0 0 0 / 55%);
  backdrop-filter: blur(2px);
  content: "";
}

.mn-modal {
  position: relative;
  display: flex;
  width: min(48rem, 100%);
  max-height: min(85dvh, 52rem);
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--marinara-chat-chrome-panel-border);
  border-radius: 0.75rem;
  background: var(--marinara-chat-chrome-panel-bg);
  color: var(--marinara-chat-chrome-panel-text);
  box-shadow: 0 25px 50px -12px rgb(0 0 0 / 40%);
  backdrop-filter: blur(12px);
}

.mn-progress-modal {
  width: min(30rem, 100%);
}

.mn-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border-bottom: 1px solid var(--marinara-chat-chrome-panel-divider);
  padding: 0.625rem 0.75rem;
  color: var(--marinara-chat-chrome-panel-title);
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1rem;
}

.mn-modal-title {
  min-width: 0;
  color: var(--marinara-chat-chrome-panel-title);
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1rem;
}

.mn-modal-body {
  min-height: 0;
  overflow: auto;
  padding: 1rem 1.25rem;
  scrollbar-color: var(--marinara-chat-chrome-panel-scrollbar) transparent;
  scrollbar-width: thin;
}

.mn-modal-close {
  width: 1.75rem;
  min-width: 1.75rem;
  height: 1.75rem;
  min-height: 1.75rem;
  border: 0;
  border-radius: 0.5rem;
  background: transparent;
  padding: 0.375rem;
  color: var(--marinara-chat-chrome-panel-muted);
}

.mn-modal-close .mn-icon {
  width: 1rem;
  height: 1rem;
}

.mn-modal-close:hover {
  background: var(--marinara-chat-chrome-highlight-bg-hover);
  color: var(--marinara-chat-chrome-highlight-text);
}

.mn-progress {
  width: 100%;
  height: 0.55rem;
  overflow: hidden;
  border: 0;
  border-radius: 999px;
  background: var(--muted);
  accent-color: var(--mn-chroma);
}

.mn-progress::-webkit-progress-bar {
  background: var(--muted);
}

.mn-progress::-webkit-progress-value {
  background: var(--mn-chroma);
}

.mn-progress::-moz-progress-bar {
  background: var(--mn-chroma);
}

.mn-tabs {
  display: flex;
  gap: 0.35rem;
}

.mn-tab[aria-selected="true"] {
  border-color: var(--marinara-chat-chrome-button-border-active);
  background: var(--marinara-chat-chrome-button-bg-active);
  color: var(--marinara-chat-chrome-button-text-active);
}

.mn-memory {
  display: grid;
  gap: 0.45rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background: var(--card);
  padding: 0.65rem;
}

.mn-memory-text {
  font-size: 0.78rem;
  line-height: 1.5;
  white-space: pre-wrap;
}

.mn-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.mn-tag {
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0.16rem 0.42rem;
  color: var(--muted-foreground);
  font-size: 0.62rem;
}

.mn-checks {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.mn-check {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 0.3rem 0.45rem;
  font-size: 0.68rem;
}

.mn-toolbar {
  display: inline-flex;
  flex: none;
}

.mn-toolbar-button {
  box-sizing: border-box;
  flex: none;
  overflow: hidden;
}

.mn-toolbar-button--fallback {
  width: 2rem;
  min-width: 2rem;
  height: 2rem;
  padding: 0.25rem;
}

.mn-toolbar-word {
  display: block;
  width: 100%;
  min-width: 0;
  overflow: hidden;
  color: inherit;
  font-size: 0.375rem;
  font-weight: 600;
  line-height: 0.5rem;
  letter-spacing: -0.02em;
  text-align: center;
  text-overflow: clip;
  white-space: nowrap;
}

.mn-toolbar-initial-icon {
  width: 0.75rem;
  height: 0.75rem;
  flex: none;
  color: var(--marinara-chat-chrome-button-text-active, var(--mn-chroma));
}

.mn-popover {
  z-index: 9999;
  box-sizing: border-box;
  width: 18rem;
  min-width: 15rem;
  min-height: 6rem;
  max-width: calc(100vw - 1rem);
  max-height: min(24rem, calc(100vh - 1rem));
  overflow: auto;
  resize: both;
  border: 1px solid var(--marinara-chat-chrome-panel-border, var(--border));
  border-radius: 0.75rem;
  background: var(--marinara-chat-chrome-panel-bg, var(--popover, var(--background)));
  color: var(--marinara-chat-chrome-panel-text, var(--foreground));
  box-shadow: 0 25px 50px -12px rgb(0 0 0 / 40%);
  backdrop-filter: blur(12px);
}

.mn-popover-header {
  display: flex;
  min-height: 2rem;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  border-bottom: 1px solid var(--marinara-chat-chrome-panel-divider, var(--border));
  padding: 0.625rem 0.75rem;
}

.mn-popover-title {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.375rem;
  color: var(--marinara-chat-chrome-panel-title, var(--foreground));
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1rem;
}

.mn-popover-title-icon {
  width: 0.625rem;
  height: 0.625rem;
  flex: none;
  color: var(--marinara-chat-chrome-button-text-active, var(--mn-chroma));
}

.mn-popover-actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 0.25rem;
}

.mn-popover-action {
  display: inline-flex;
  width: 1.5rem;
  min-width: 1.5rem;
  height: 1.5rem;
  min-height: 1.5rem;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: 0.25rem;
  background: transparent;
  padding: 0;
  color: var(--marinara-chat-chrome-panel-muted, var(--muted-foreground));
  cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
}

.mn-popover-action:hover,
.mn-popover-action--active {
  border-color: var(--marinara-chat-chrome-button-border, var(--border));
  background: var(--marinara-chat-chrome-highlight-bg, var(--accent));
  color: var(--marinara-chat-chrome-button-text-active, var(--foreground));
}

.mn-popover-action:focus-visible {
  outline: 1px solid var(--marinara-chat-chrome-focus-ring, var(--ring));
  outline-offset: 1px;
}

.mn-popover-action:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.mn-popover-action-icon {
  width: 0.6875rem;
  height: 0.6875rem;
}

.mn-popover-body {
  padding: 0.5rem;
}

.mn-popover-list {
  display: grid;
  margin: 0;
  padding: 0;
  gap: 0.375rem;
  list-style: none;
}

.mn-popover-list li {
  border: 1px solid color-mix(in srgb, var(--marinara-chat-chrome-panel-border, var(--border)) 55%, transparent);
  border-radius: 0.5rem;
  background: color-mix(in srgb, var(--marinara-chat-chrome-highlight-bg, var(--muted)) 32%, transparent);
  padding: 0.5rem;
  font-size: 0.7rem;
  line-height: 1.4;
}

.mn-popover-empty {
  margin: 0;
  padding: 0.5rem;
  color: color-mix(in srgb, var(--marinara-chat-chrome-panel-muted, var(--muted-foreground)) 60%, transparent);
  font-size: 0.625rem;
  line-height: 1rem;
  text-align: center;
}

.mn-tracker {
  position: relative;
  z-index: 10;
  overflow: hidden;
  border-bottom: 1px solid var(--border);
  background: var(--tracker-panel-section-background, color-mix(in srgb, var(--card) 5%, transparent));
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--foreground) 5%, transparent);
}

.mn-tracker-veil {
  position: absolute;
  z-index: 0;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--background) var(--tracker-profile-contrast-strong-top, 40%), transparent) 0%,
    color-mix(in srgb, var(--card) var(--tracker-profile-contrast-strong-mid, 30%), transparent) 52%,
    color-mix(in srgb, var(--background) var(--tracker-profile-contrast-strong-bottom, 42%), transparent) 100%
  );
}

.mn-tracker-content {
  position: relative;
  z-index: 10;
}

.mn-tracker-header {
  display: flex;
  min-height: 1.75rem;
  align-items: center;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 42%, transparent);
  padding: 0.125rem 0.25rem;
}

.mn-tracker-toggle {
  box-sizing: border-box;
  display: flex;
  min-width: 0;
  width: 100%;
  flex: 1;
  align-self: stretch;
  align-items: center;
  gap: 0.25rem;
  border: 0;
  border-radius: 0.125rem;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.mn-tracker-toggle:hover {
  background: color-mix(in srgb, var(--accent) 18%, transparent);
}

.mn-tracker-toggle:focus-visible {
  outline: 1px solid var(--border);
  outline-offset: -1px;
}

.mn-tracker-chevron-frame {
  display: flex;
  width: 0.875rem;
  height: 0.875rem;
  flex: none;
  align-items: center;
  justify-content: center;
}

.mn-tracker-chevron {
  width: 0.6875rem;
  height: 0.6875rem;
  flex: none;
  color: var(--tracker-profile-icon, var(--muted-foreground));
  opacity: 0.6;
  transition: transform 150ms ease;
}

.mn-tracker-chevron--collapsed {
  transform: rotate(-90deg);
}

.mn-tracker-icon {
  display: flex;
  width: 0.875rem;
  height: 0.875rem;
  flex: none;
  align-items: center;
  justify-content: center;
  color: var(--tracker-profile-icon, var(--muted-foreground));
  opacity: 0.75;
}

.mn-tracker-panel-icon {
  width: 0.6875rem;
  height: 0.6875rem;
}

.mn-tracker-title {
  min-width: 0;
  overflow: hidden;
  color: color-mix(in srgb, var(--foreground) 62%, transparent);
  font-size: 0.625rem;
  font-weight: 600;
  line-height: 0.75rem;
  letter-spacing: 0.08em;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.mn-tracker-value {
  min-height: 2.25rem;
  padding: 0.5rem;
  color: color-mix(in srgb, var(--foreground) 78%, transparent);
  font-size: 0.6875rem;
  line-height: 1.4;
}

.mn-tracker-value--empty {
  min-height: 0;
  padding: 0.25rem;
  color: color-mix(in srgb, var(--foreground) 35%, transparent);
  font-size: 0.6875rem;
  line-height: 0.875rem;
}

.mn-tracker--mobile-compact {
  border-bottom: 0;
  background: transparent;
  box-shadow: none;
}

.mn-tracker--mobile-compact .mn-tracker-header {
  min-height: 0;
  border-bottom: 0;
  padding: 0.5rem 0.75rem 0.25rem;
}

.mn-tracker--mobile-compact .mn-tracker-toggle--static {
  align-self: auto;
  cursor: default;
}

.mn-tracker--mobile-compact .mn-tracker-toggle--static:hover {
  background: transparent;
}

.mn-tracker--mobile-compact .mn-tracker-icon {
  color: var(--marinara-chat-chrome-button-text-active, var(--mn-chroma));
  opacity: 1;
}

.mn-tracker--mobile-compact .mn-tracker-value {
  min-height: 0;
  padding: 0.25rem 0.75rem 0.5rem;
}

.mn-icon {
  width: 0.75rem;
  height: 0.75rem;
  flex: none;
}

.mn-spin {
  animation: mn-spin 0.8s linear infinite;
}

.mn-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}

@keyframes mn-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (min-width: 640px) {
  .mn-number-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .mn-grid {
    grid-template-columns: 1fr;
  }

  .mn-overlay {
    align-items: stretch;
    padding: 0;
  }

  .mn-modal {
    width: 100%;
    height: 100%;
    max-height: none;
    border: 0;
    border-radius: 0;
  }

  .mn-modal-body {
    padding: 0.75rem;
  }

  .mn-popover {
    resize: none;
  }
}
`;
