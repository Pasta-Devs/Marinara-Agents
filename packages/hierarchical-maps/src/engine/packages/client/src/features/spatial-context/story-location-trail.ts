// How the Story Location bar shows a deep breadcrumb (#1995). Presentation only: the saved map, the current location
// and everything sent to a model are untouched, and the full root-to-leaf path stays in the bar's title and label.
// The exact current location is always shown, and the trail keeps parent-to-child order with a leading ellipsis for
// the ancestors it leaves out.

export const STORY_LOCATION_DISPLAYS = ["adaptive", "current", "nearby", "full"] as const;
export type StoryLocationDisplay = (typeof STORY_LOCATION_DISPLAYS)[number];
export const STORY_LOCATION_DISPLAY_DEFAULT: StoryLocationDisplay = "adaptive";

/** Ancestors a "nearby" trail keeps before the current location. */
const NEARBY_ANCESTORS = 2;

export const STORY_LOCATION_SEPARATOR = " › ";
export const STORY_LOCATION_ELLIPSIS = "…";

const STORAGE_KEY = "marinara:world-maps:story-location-display";

export function storyLocationDisplay(value: unknown): StoryLocationDisplay {
  return STORY_LOCATION_DISPLAYS.includes(value as StoryLocationDisplay)
    ? (value as StoryLocationDisplay)
    : STORY_LOCATION_DISPLAY_DEFAULT;
}

/** This device's chosen display, or the default when none was saved or storage is unavailable. */
export function readStoryLocationDisplay(): StoryLocationDisplay {
  try {
    return storyLocationDisplay(localStorage.getItem(STORAGE_KEY));
  } catch {
    return STORY_LOCATION_DISPLAY_DEFAULT;
  }
}

export function saveStoryLocationDisplay(display: StoryLocationDisplay): void {
  try {
    localStorage.setItem(STORAGE_KEY, display);
  } catch {
    // A private window or full storage keeps the choice for this page only.
  }
}

/**
 * How many trailing crumbs fit in `available` pixels: the widths of the crumbs root to leaf, of one separator and of
 * the leading ellipsis that marks left-out ancestors. Always at least one, so the current location shows (it
 * truncates on its own when even it is too wide, and keeps the marker so it never reads as a top-level place).
 */
export function trailingCrumbsThatFit(
  widths: readonly number[],
  separator: number,
  ellipsis: number,
  available: number,
): number {
  let fits = Math.min(1, widths.length);
  let used = 0;
  for (let count = 1; count <= widths.length; count += 1) {
    used += widths[widths.length - count]! + (count > 1 ? separator : 0);
    const marker = count < widths.length ? ellipsis + separator : 0;
    // Keep going after a miss: the whole path drops the marker, so it can fit when a shorter trail does not.
    if (used + marker <= available + 0.5) fits = count;
  }
  return fits;
}

/**
 * The crumbs a display shows, root to leaf, and whether ancestors were left out. `fitting` is how many trailing
 * crumbs fit the bar (adaptive only); without a measurement yet, adaptive shows them all.
 */
export function storyLocationTrail(
  names: readonly string[],
  display: StoryLocationDisplay,
  fitting?: number,
): { shown: string[]; omitted: boolean } {
  const keep =
    display === "full"
      ? names.length
      : display === "current"
        ? 1
        : display === "nearby"
          ? NEARBY_ANCESTORS + 1
          : (fitting ?? names.length);
  const count = Math.max(Math.min(keep, names.length), Math.min(1, names.length));
  return { shown: names.slice(names.length - count), omitted: count < names.length };
}

export function formatStoryLocationTrail(trail: { shown: readonly string[]; omitted: boolean }): string {
  const path = trail.shown.join(STORY_LOCATION_SEPARATOR);
  return trail.omitted ? `${STORY_LOCATION_ELLIPSIS}${STORY_LOCATION_SEPARATOR}${path}` : path;
}
