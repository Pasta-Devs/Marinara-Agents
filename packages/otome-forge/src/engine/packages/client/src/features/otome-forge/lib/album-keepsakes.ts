// ──────────────────────────────────────────────
// Otome Forge: finished dates' keepsakes as Album pictures (#2276)
// ──────────────────────────────────────────────
// A keepsake used to live only on the date's end screen and, as a thumbnail, in Date Night's history. It joins the
// Album's Photos tab once its paint is ready: one picture per finished date, newest first, with its date's key so the
// viewer can offer "Read the evening again". A keepsake still painting, stopped or failed is not a picture yet.
import type { DateEntry } from "../shared/dates";
import type { AlbumImage } from "../shared/wardrobe";

export function albumKeepsakes(dates: readonly DateEntry[]): AlbumImage[] {
  return dates.flatMap((entry) => {
    const art = entry.keepsake;
    if (art?.state !== "ready" || !art.url) return [];
    return [
      {
        key: `keepsake:${entry.key}`,
        url: art.url,
        ref: entry.key,
        at: entry.completedAt ?? entry.plannedAt,
        li: entry.li,
        source: "keepsake" as const,
        title: entry.title,
      },
    ];
  });
}
