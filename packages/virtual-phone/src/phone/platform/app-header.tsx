import React from "react";
import { ArrowLeft, Heart, MoreHorizontal, Plus, RotateCcw, Search, Trash2, X } from "lucide-react";
import { normalizeTopBarActions, type TopBarAction } from "./top-bar";

const actionIcons: Record<string, typeof ArrowLeft> = {
  add: Plus,
  heart: Heart,
  menu: MoreHorizontal,
  refresh: RotateCcw,
  search: Search,
  trash: Trash2,
};

export function PhoneAppHeader({ title, titleId, closeLabel, onBack, onClose, actions = [], onAction, center }: {
  title: string;
  titleId: string;
  closeLabel: string;
  onBack: () => void;
  onClose: () => void;
  actions?: TopBarAction[];
  onAction?: (actionId: string) => void;
  center?: React.ReactNode;
}) {
  const trailing = normalizeTopBarActions(actions);
  return (
    <header className="vp-app-header">
      <button type="button" aria-label="Back" onClick={onBack} className="vp-icon-btn"><ArrowLeft size="1rem" aria-hidden="true" /></button>
      <div className="vp-app-header-mid">
        {center ?? <h2 id={titleId}>{title}</h2>}
        {center ? <h2 id={titleId} className="vp-sr-only">{title}</h2> : null}
      </div>
      <div className="vp-app-header-actions">
        {trailing.map((action) => {
          const Icon = actionIcons[action.icon] ?? MoreHorizontal;
          return (
            <button
              key={action.id}
              type="button"
              aria-label={action.label}
              title={action.disabled && action.reason ? action.reason : action.label}
              disabled={action.disabled}
              onClick={() => onAction?.(action.id)}
              className="vp-icon-btn"
            >
              <Icon size="1rem" aria-hidden="true" />
            </button>
          );
        })}
        <button type="button" aria-label={closeLabel} onClick={onClose} className="vp-icon-btn"><X size="1rem" aria-hidden="true" /></button>
      </div>
    </header>
  );
}
