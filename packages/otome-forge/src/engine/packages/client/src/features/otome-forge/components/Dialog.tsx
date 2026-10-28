// ──────────────────────────────────────────────
// Otome Forge: a modal dialog over the stage. It traps focus, closes on Escape, makes the stage behind it inert, and
// gives focus back to whatever had it when it closes.
// ──────────────────────────────────────────────
import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useStageLayer } from "./Stage";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface DialogProps {
  title: ReactNode;
  children: ReactNode;
  /** Escape and the backdrop call it; omit it for a dialog that must be answered. */
  onClose?: () => void;
  /** The action row, under the body. */
  actions: ReactNode;
  /** Where focus starts; the first field or button otherwise. */
  initialFocus?: RefObject<HTMLElement | null>;
  wide?: boolean;
  /** The id of what a screen reader reads with the title as the dialog opens (its aria-describedby). */
  describedBy?: string;
}

export function Dialog({ title, children, onClose, actions, initialFocus, wide, describedBy }: DialogProps) {
  const stage = useStageLayer();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!stage) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    stage.body.inert = true;
    const panel = panelRef.current;
    const first = initialFocus?.current ?? panel?.querySelector<HTMLElement>(FOCUSABLE) ?? panel;
    first?.focus({ preventScroll: true });
    return () => {
      stage.body.inert = false;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
    // Once per open dialog: where focus starts is read when it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  if (!stage) return null;

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && onClose) {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab" || !panelRef.current) return;
    const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (item) => item.getClientRects().length > 0,
    );
    if (items.length === 0) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div
      className="of-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        ref={panelRef}
        className={wide ? "of-dialog of-dialog--wide of-glass of-glass--strong" : "of-dialog of-glass of-glass--strong"}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <h2 id={titleId} className="of-dialog-title">
          {title}
        </h2>
        <div className="of-dialog-body">{children}</div>
        <div className="of-dialog-actions">{actions}</div>
      </div>
    </div>,
    stage.layer,
  );
}
