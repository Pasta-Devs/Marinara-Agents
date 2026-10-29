const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

// Match the host catalog's literal search, which folds case without Unicode or internal-whitespace aliases.
export const speakerNameKey = (name: string) => name.trim().toLocaleLowerCase();

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

/** Search is paged and fails closed if it cannot establish uniqueness within the existing catalog ceiling. */
export async function findSpeakerSprite(
  name: string,
  read: (path: string) => Promise<unknown>,
): Promise<string | null> {
  const matches = new Map<string, { id: string; name: string }>();
  let generation: unknown;
  for (let offset = 0; offset < 2000;) {
    const params = new URLSearchParams({ search: name.trim(), sort: "name-asc", limit: "100", offset: String(offset) });
    const page = await read(`/characters/catalog?${params}`);
    if (!Array.isArray(page) && (!record(page) || !Array.isArray(page.items))) return null;
    if (record(page) && page.hasMore !== undefined && typeof page.hasMore !== "boolean") return null;
    const nextGeneration = record(page) ? page.catalogGeneration : undefined;
    if (offset === 0) generation = nextGeneration;
    else if (nextGeneration !== generation) return null;
    const rows = Array.isArray(page) ? page : record(page) && Array.isArray(page.items) ? page.items : [];
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
