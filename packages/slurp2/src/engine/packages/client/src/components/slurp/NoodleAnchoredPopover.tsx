import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/utils";
import { getNoodleAccentStyle, NOODLE_ICON_SCOPE_CLASS, useNoodleAccent } from "./SlurpShell";

export function NoodleAnchoredPopover({
  anchorRef,
  children,
  wide,
  modalOwned = false,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
  wide?: boolean;
  modalOwned?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const accent = useNoodleAccent();

  useLayoutEffect(() => {
    const updatePosition = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const anchorRect = anchor.getBoundingClientRect();
      const panelWidth = panelRef.current?.offsetWidth ?? (wide ? 384 : 304);
      const panelHeight = panelRef.current?.offsetHeight ?? 0;
      const padding = 16;
      const maxLeft = Math.max(padding, window.innerWidth - panelWidth - padding);
      const centeredLeft = anchorRect.left + anchorRect.width / 2 - panelWidth / 2;
      const belowTop = anchorRect.bottom + 12;
      const aboveTop = anchorRect.top - panelHeight - 12;
      setPosition({
        left: Math.min(Math.max(centeredLeft, padding), maxLeft),
        top:
          panelHeight > 0 && belowTop + panelHeight + padding > window.innerHeight
            ? Math.max(padding, aboveTop)
            : belowTop,
      });
    };

    updatePosition();
    const frame = window.requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchorRef, wide]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={panelRef}
      data-noodle-compose-focus-portal={modalOwned ? "true" : undefined}
      className={cn(
        "fixed max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto",
        modalOwned ? "z-[10001]" : "z-[80]",
        NOODLE_ICON_SCOPE_CLASS,
        wide ? "w-[18rem] sm:w-[24rem]" : "w-[19rem]",
      )}
      style={getNoodleAccentStyle(accent, {
        left: position?.left ?? -9999,
        top: position?.top ?? -9999,
        opacity: position ? 1 : 0,
      })}
    >
      {children}
    </div>,
    document.body,
  );
}
