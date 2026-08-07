import React from "react";

export interface ShareAction {
  id: string;
  label: string;
  run: () => void | Promise<void>;
}

/**
 * One share sheet for the whole phone. Apps never talked to each other; this is the connective
 * tissue, and it exists as a shared component so the same three actions are not written three times
 * (see docs/app-plans/03-sharing-seam.md).
 */
export function ShareSheet({ title, actions, onClose }: { title: string; actions: ShareAction[]; onClose: () => void }) {
  const [busy, setBusy] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const run = async (action: ShareAction) => {
    setBusy(action.id);
    setError(null);
    try {
      await action.run();
      setDone(action.id);
      window.setTimeout(onClose, 700);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That did not work.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div role="dialog" aria-label={title} className="vp-card vp-stack" style={{ gap: "0.5rem" }}>
      <span className="vp-section-label">{title}</span>
      {error ? <p role="alert" className="vp-muted-note">{error}</p> : null}
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          className="vp-surface-btn"
          disabled={busy !== null}
          onClick={() => void run(action)}
        >
          {done === action.id ? `${action.label} \u2713` : busy === action.id ? "Working…" : action.label}
        </button>
      ))}
      <button type="button" className="vp-surface-btn" onClick={onClose}>Cancel</button>
    </div>
  );
}
