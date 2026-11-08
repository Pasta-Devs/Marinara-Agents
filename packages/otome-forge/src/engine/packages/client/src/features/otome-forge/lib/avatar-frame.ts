// ──────────────────────────────────────────────
// Otome Hearth: which portrait a circle zooms to the face (#2178, components/Avatar.tsx). A painted look is full body,
// its head at the very top (832×1216); a card's or a persona's avatar is square or a bust, and is never zoomed.
// ──────────────────────────────────────────────

/**
 * A full-body look: an image at least this much taller than wide. A painted look is 1.46 (832×1216); a 3:4 bust, at
 * 1.33, stays unzoomed.
 */
export const FULL_BODY_RATIO = 1.4;

export const isFullBody = (width: number, height: number) => width > 0 && height >= width * FULL_BODY_RATIO;
