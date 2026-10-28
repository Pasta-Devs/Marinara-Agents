// The pure half of the ambient canvas (SlpCanvasAmbient.tsx): which photo colours the room.

type SlpPhoto = Pick<HTMLImageElement, "complete" | "naturalWidth" | "currentSrc" | "src" | "getBoundingClientRect"> & {
  closest(selector: string): unknown;
};

/** Smallest visible photo area (px²) that may colour the room; avatars and icons stay out. */
const MIN_AREA = 160 * 160;

/** The source of the photo with the largest visible area inside `root`, or null. */
export function slpLeadingPhotoSrc(
  root: { querySelectorAll(selector: "img"): Iterable<SlpPhoto> },
  viewport = { width: innerWidth, height: innerHeight },
) {
  let best: string | null = null;
  let bestArea = MIN_AREA;
  for (const img of root.querySelectorAll("img")) {
    if (!img.complete || img.naturalWidth < 64 || img.closest("[data-slp-ambient-skip]")) continue;
    const rect = img.getBoundingClientRect();
    const width = Math.min(rect.right, viewport.width) - Math.max(rect.left, 0);
    const height = Math.min(rect.bottom, viewport.height) - Math.max(rect.top, 0);
    const area = width > 0 && height > 0 ? width * height : 0;
    if (area > bestArea) {
      bestArea = area;
      best = img.currentSrc || img.src;
    }
  }
  return best;
}

/**
 * How long the room waits after the last scroll before it looks for a new leading photo. Swapping the
 * colour layer mounts a new animated layer under the scroller; on iOS that rebuilds the layer tree and
 * stops a momentum fling dead, so the room only changes once the reader has stopped.
 */
export const SLP_AMBIENT_SCROLL_QUIET_MS = 800;

/** Whether the room may look again: never while (or just after) anything inside it scrolls. */
export const slpAmbientMayLook = (now: number, lastScrollAt: number) =>
  now - lastScrollAt >= SLP_AMBIENT_SCROLL_QUIET_MS;
