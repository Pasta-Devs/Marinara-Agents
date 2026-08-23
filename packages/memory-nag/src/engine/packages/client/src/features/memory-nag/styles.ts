export const MEMORY_NAG_STYLES = `
.mn-shell {
  --mn-chroma: var(--marinara-chat-chrome-accent, var(--primary));
  color: var(--foreground);
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

.mn-prompt-textarea {
  min-height: 8.5rem;
  font-size: 0.72rem;
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
  padding: 1rem;
  background: color-mix(in srgb, var(--background) 70%, transparent);
  backdrop-filter: blur(5px);
}

.mn-modal {
  display: flex;
  width: min(58rem, 100%);
  max-height: min(88vh, 52rem);
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  background: var(--background);
  box-shadow: 0 24px 80px rgb(0 0 0 / 40%);
}

.mn-progress-modal {
  width: min(30rem, 100%);
}

.mn-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border-bottom: 1px solid var(--border);
  padding: 0.75rem 1rem;
}

.mn-modal-body {
  min-height: 0;
  overflow: auto;
  padding: 1rem;
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
  position: relative;
  display: inline-flex;
}

.mn-toolbar-button {
  width: auto;
  min-width: 2rem;
  height: 2rem;
  padding: 0.375rem 0.5rem;
  gap: 0.375rem;
  color: var(--mn-chroma);
}

.mn-toolbar-button--compact {
  width: 2rem;
  padding: 0.25rem;
}

.mn-toolbar-button--compact .mn-toolbar-word {
  display: none;
}

.mn-toolbar-word {
  max-width: 7rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mn-popover {
  position: absolute;
  top: calc(100% + 0.4rem);
  left: 0;
  z-index: 80;
  width: min(22rem, calc(100vw - 2rem));
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background: var(--popover, var(--background));
  padding: 0.65rem;
  color: var(--foreground);
  box-shadow: 0 12px 35px rgb(0 0 0 / 35%);
}

.mn-popover ul {
  margin: 0.35rem 0 0;
  padding-left: 1.15rem;
}

.mn-popover li {
  margin: 0.25rem 0;
  font-size: 0.7rem;
  line-height: 1.4;
}

.mn-tracker {
  position: relative;
  z-index: 10;
  overflow: hidden;
  border-bottom: 1px solid var(--border);
  background: var(--tracker-panel-section-background, color-mix(in srgb, var(--card) 10%, transparent));
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--foreground) 5%, transparent);
}

.mn-tracker-header {
  display: flex;
  min-height: 1.75rem;
  align-items: center;
  gap: 0.25rem;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 42%, transparent);
  padding: 0.125rem 0.25rem;
}

.mn-tracker-icon {
  display: flex;
  width: 0.875rem;
  height: 0.875rem;
  flex: none;
  align-items: center;
  justify-content: center;
  color: var(--tracker-profile-icon, var(--mn-chroma));
  opacity: 0.75;
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

.mn-icon {
  width: 0.9rem;
  height: 0.9rem;
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

  .mn-toolbar-word {
    display: none;
  }
}
`;
