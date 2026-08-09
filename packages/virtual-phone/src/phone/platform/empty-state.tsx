import type { LucideIcon } from "lucide-react";

/**
 * Every app had its own one-line "nothing here yet" in muted grey. An empty screen is the first
 * thing most of these apps show, so it is worth being a real screen: what this is, and the way out.
 */
export function PhoneEmptyState({ icon: Icon, title, body, action }: {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: { label: string; onClick: () => void; disabled?: boolean };
}) {
  return (
    <div className="vp-empty">
      <span className="vp-empty-icon" aria-hidden="true"><Icon size="1.5rem" /></span>
      <h3>{title}</h3>
      {body ? <p>{body}</p> : null}
      {action ? (
        <button type="button" className="vp-accent-btn" disabled={action.disabled} onClick={action.onClick}>
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
