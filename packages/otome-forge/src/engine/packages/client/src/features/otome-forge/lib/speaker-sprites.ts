const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

// Stable exact names have no Unicode-normalization or internal-whitespace aliases.
export const speakerNameKey = (name: string) => name.trim().toLowerCase();

// Tight bust crops may have little background; transparent padding alone never counts as a cutout.
const MIN_SPEAKER_CUTOUT_SHARE = 0.05;
// ponytail: alpha alone cannot distinguish silhouette-shaped opaque masks; trusted cutout metadata or segmentation can replace this heuristic.

/** Require meaningful removed background inside the visible subject's bounds, for source and cleanup alike. */
export function speakerHasCutoutAlpha(pixels: Uint8ClampedArray, width: number, height: number): boolean {
  let maximumAlpha = 0;
  for (let index = 3; index < pixels.length; index += 4) maximumAlpha = Math.max(maximumAlpha, pixels[index]);
  if (!maximumAlpha) return false;
  // Relative opacity ignores faint padding noise while preserving intentionally translucent subjects.
  const minimumBoundAlpha = Math.ceil(maximumAlpha / 2);
  let left = width;
  let right = -1;
  let top = height;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (pixels[(y * width + x) * 4 + 3] >= minimumBoundAlpha) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  }
  if (right < left || bottom < top) return false;
  let removed = 0;
  for (let y = top; y <= bottom; y += 1)
    for (let x = left; x <= right; x += 1) if (pixels[(y * width + x) * 4 + 3] === 0) removed += 1;
  return removed / ((right - left + 1) * (bottom - top + 1)) >= MIN_SPEAKER_CUTOUT_SHARE;
}

/** Exact full names only; a duplicate is never a reason to choose one card over another. */
export function matchingSpeakerCards(value: unknown, name: string): Array<{ id: string; name: string }> {
  return (Array.isArray(value) ? value : []).flatMap((row) =>
    record(row) && typeof row.name === "string" && speakerNameKey(row.name) === speakerNameKey(name)
      ? [{ id: typeof row.id === "string" ? row.id : "", name: row.name }]
      : [],
  );
}

/** Metadata URLs never become fetch targets. Only a matching full-body raster filename names a local file. */
export function fullBodySpeakerSprite(cardId: string, value: unknown): string | null {
  if (!/^[a-z0-9_-]{1,200}$/iu.test(cardId) || !Array.isArray(value)) return null;
  const sprites = value
    .filter(
      (sprite): sprite is Record<string, string> =>
        record(sprite) &&
        typeof sprite.expression === "string" &&
        /^full_[a-z0-9_-]+$/iu.test(sprite.expression) &&
        typeof sprite.filename === "string" &&
        new RegExp(`^${sprite.expression}\\.(?:png|jpe?g|gif|webp|avif)$`, "iu").test(sprite.filename),
    )
    .sort(
      (a, b) =>
        Number(b.expression.toLowerCase() === "full_neutral") - Number(a.expression.toLowerCase() === "full_neutral") ||
        a.filename.localeCompare(b.filename),
    );
  const selected = sprites[0];
  if (!selected) return null;
  const version = typeof selected.url === "string" ? /[?&]v=(\d{1,20})(?:&|$)/u.exec(selected.url)?.[1] : undefined;
  return `/api/sprites/${encodeURIComponent(cardId)}/file/${encodeURIComponent(selected.filename)}${version ? `?v=${version}` : ""}`;
}

/**
 * Host search uses its server locale, so exact identity requires the unfiltered catalog.
 * ponytail: full scans stop at 2,000 rows; a future host normalized exact-name key can replace this bounded scan.
 */
export async function findSpeakerSprite(
  name: string,
  read: (path: string) => Promise<unknown>,
): Promise<string | null> {
  const matches = new Map<string, { id: string; name: string }>();
  let generation: unknown;
  for (let offset = 0; offset < 2000;) {
    const params = new URLSearchParams({ sort: "name-asc", limit: "200", offset: String(offset) });
    const page = await read(`/characters/catalog?${params}`);
    if (!Array.isArray(page) && (!record(page) || !Array.isArray(page.items))) return null;
    if (record(page) && page.hasMore !== undefined && typeof page.hasMore !== "boolean") return null;
    const nextGeneration = record(page) ? page.catalogGeneration : undefined;
    if (offset === 0) generation = nextGeneration;
    else if (nextGeneration !== generation) return null;
    const rows = Array.isArray(page) ? page : record(page) && Array.isArray(page.items) ? page.items : [];
    if (offset + rows.length > 2000) return null;
    for (const card of matchingSpeakerCards(rows, name)) matches.set(card.id, card);
    if (matches.size > 1) return null;
    if (!record(page) || page.hasMore !== true) break;
    if (!rows.length || offset + rows.length >= 2000) return null;
    offset += rows.length;
  }
  if (matches.size !== 1) return null;
  const [card] = matches.values();
  if (!/^[a-z0-9_-]{1,200}$/iu.test(card.id)) return null;
  const sprites = await read(`/sprites/${encodeURIComponent(card.id)}`);
  const url = fullBodySpeakerSprite(card.id, sprites);
  if (!url) return null;
  // A card can disappear or be renamed between its catalog row and sprite read; orphaned files do not identify it.
  const live = await read(`/characters/${encodeURIComponent(card.id)}`);
  if (!record(live) || live.id !== card.id) return null;
  let data: unknown;
  try {
    data = typeof live.data === "string" ? JSON.parse(live.data) : live.data;
  } catch {
    return null;
  }
  if (record(data) && (data.spec === "chara_card_v2" || data.spec === "chara_card_v3")) data = data.data;
  return record(data) && typeof data.name === "string" && speakerNameKey(data.name) === speakerNameKey(name)
    ? url
    : null;
}
