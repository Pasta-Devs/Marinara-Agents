import { useLayoutEffect, useState, type RefObject } from "react";

/** A horizontal shift that keeps the open panel inside the viewport (8 px margin) on narrow screens. */
export function useKeepInViewport(open: boolean, panelRef: RefObject<HTMLElement | null>) {
  const [shift, setShift] = useState(0);
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!open || !panel) {
      setShift(0);
      return;
    }
    const rect = panel.getBoundingClientRect();
    const margin = 8;
    // Undo the shift already applied so a re-measure starts from the natural position.
    const left = rect.left - shift;
    const right = rect.right - shift;
    setShift(
      left < margin ? margin - left : right > window.innerWidth - margin ? window.innerWidth - margin - right : 0,
    );
  }, [open, panelRef]);
  return shift;
}
