import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * A small "?" that shows a note on hover or focus and keeps it open on a tap, like the Engine's help tooltips, for
 * a hint that would crowd its row. The Engine's own HelpTooltip would bring its whole translation catalogue into
 * this bundle, so this one is drawn here. The note is placed on the page itself (so no card clips it) and kept
 * inside the window; Escape or a tap elsewhere closes it. The control it explains comes as `children`, and the "?"
 * stays beside it when the row wraps. With `trigger`, those words are the control instead of the "?", as a meter's
 * name is.
 */
export function HelpTip({
  text,
  label,
  trigger,
  children,
}: {
  text: string;
  label?: string;
  trigger?: string;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState<"shown" | "pinned" | null>(null);
  const [place, setPlace] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const id = useId();

  // Placed before it paints, above the "?" when there is room and below it otherwise.
  useLayoutEffect(() => {
    const button = buttonRef.current?.getBoundingClientRect();
    const tip = tipRef.current?.getBoundingClientRect();
    if (!open || !button || !tip) {
      setPlace(null);
      return;
    }
    const pad = 8;
    const above = button.top - 6 - tip.height;
    setPlace({
      top: above >= pad ? above : button.bottom + 6,
      left: Math.max(
        pad,
        Math.min(button.left + button.width / 2 - tip.width / 2, window.innerWidth - pad - tip.width),
      ),
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!buttonRef.current?.contains(target) && !tipRef.current?.contains(target)) setOpen(null);
    };
    const escape = (event: KeyboardEvent) => event.key === "Escape" && setOpen(null);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const show = () => setOpen((now) => now ?? "shown");
  const hide = () => setOpen((now) => (now === "shown" ? null : now));
  return (
    <span className="sl-with-help">
      {children}
      <button
        ref={buttonRef}
        type="button"
        className={trigger ? "sl-help sl-help--text" : "sl-help"}
        aria-label={label}
        aria-expanded={open !== null}
        aria-describedby={open ? id : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onKeyDown={(event) => {
          // The open note takes Escape first, so the panel around it stays open.
          if (event.key !== "Escape" || !open) return;
          event.preventDefault();
          event.stopPropagation();
          setOpen(null);
        }}
        onClick={() => setOpen((now) => (now === "pinned" ? null : "pinned"))}
      >
        {trigger ?? (
          // Lucide's circle-help, as the Engine's help tooltips draw it.
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <path d="M12 17h.01" />
          </svg>
        )}
      </button>
      {open
        ? createPortal(
            <div
              ref={tipRef}
              id={id}
              role="tooltip"
              className="sl-help-tip"
              style={place ? { top: place.top, left: place.left } : { top: 0, left: 0, visibility: "hidden" }}
            >
              {text}
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}
