import { useEffect, useState } from "react";
import { flushSync } from "react-dom";

const DRAW_ALL_EVENT = "slp-draw-all-cards";

/**
 * Draw every card of every progressive list at once, synchronously: a jump to a post that is not
 * drawn yet ("Show post" from a Story, a Pulse row) asks for this before it looks for the card.
 */
export function slpDrawAllCards(): void {
  window.dispatchEvent(new Event(DRAW_ALL_EVENT));
}

/**
 * How many cards of a long list are drawn so far. A screen draws its first cards at once and the rest
 * between frames, twice as many each time, with a shimmer card below until they are all in: drawing
 * every card in one go blocked a phone for over a second on each switch back to the Hub or into a
 * profile (0.3.6). `resetKey` starts over when the list itself changes (a tab, a search, a persona).
 */
export function useSlpDrawnCount(total: number, resetKey?: string): number {
  const [state, setState] = useState({ key: resetKey, drawn: 3 });
  const drawn = state.key === resetKey ? state.drawn : 3;
  if (state.key !== resetKey) setState({ key: resetKey, drawn: 3 });
  useEffect(() => {
    const all = () => flushSync(() => setState({ key: resetKey, drawn: Number.MAX_SAFE_INTEGER }));
    window.addEventListener(DRAW_ALL_EVENT, all);
    return () => window.removeEventListener(DRAW_ALL_EVENT, all);
  }, [resetKey]);
  useEffect(() => {
    if (drawn >= total) return;
    const more = () => setState((now) => ({ ...now, drawn: now.drawn * 2 }));
    // Safari has no requestIdleCallback; a short timeout still lets a frame paint in between.
    if (typeof window.requestIdleCallback === "function") {
      const handle = window.requestIdleCallback(more, { timeout: 200 });
      return () => window.cancelIdleCallback(handle);
    }
    const handle = window.setTimeout(more, 32);
    return () => window.clearTimeout(handle);
  }, [drawn, total]);
  return drawn;
}
