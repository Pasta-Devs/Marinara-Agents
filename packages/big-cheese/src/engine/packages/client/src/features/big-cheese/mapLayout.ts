// Big Cheese: the layout of the relationship map (ui.md section 10, M4 T19). Pure, so a test can run it.

export const MAP_SIZE = 360;

/** Puts the people on a circle, the first at the top, in a square of `size` px. */
export function circleLayout(ids: readonly string[], size = MAP_SIZE): Record<string, { x: number; y: number }> {
  const mid = size / 2;
  const radius = size * 0.34;
  return Object.fromEntries(
    ids.map((id, n) => {
      const angle = (2 * Math.PI * n) / ids.length - Math.PI / 2;
      return [id, { x: Math.round(mid + radius * Math.cos(angle)), y: Math.round(mid + radius * Math.sin(angle)) }];
    }),
  );
}
