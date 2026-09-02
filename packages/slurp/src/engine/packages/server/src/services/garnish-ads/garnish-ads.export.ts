import { z } from "zod";
import type { GarnishAdEvent, GarnishAdsStorage } from "./garnish-ads.storage.js";
import { GARNISH_CONTENT_RATINGS, type GarnishAd, type GarnishPlatform } from "./garnish-ads.types.js";

export const GARNISH_EXPORT_VERSION = 1;

const adSchema = z.object({
  id: z.string().trim().min(1).max(120),
  platform: z.enum(["slurp", "noodle"]),
  kind: z.enum(["creator", "inline"]),
  brand: z.string().trim().min(1).max(80),
  product: z.string().trim().min(1).max(120),
  copy: z.string().trim().min(1).max(600),
  categories: z.array(z.string().trim().min(1).max(32)).max(12).default([]),
  contextTags: z.array(z.string().trim().min(1).max(32)).max(12).default([]),
  creatorAccountId: z.string().trim().min(1).max(120).optional(),
  creatorHandle: z.string().trim().min(1).max(120).optional(),
  imageUrl: z.string().trim().max(2048).nullable().optional(),
  actionLabel: z.string().trim().min(1).max(40).optional(),
  contentRating: z.enum(["tame", "suggestive", "explicit"]),
  origin: z.enum(["builtin", "user", "generated"]),
  createdAt: z.string().trim().max(40).optional(),
  retiredAt: z.string().trim().max(40).nullable().optional(),
});

const eventSchema = z.object({
  adId: z.string().trim().min(1).max(120),
  subjectId: z.string().trim().min(1).max(120),
  type: z.enum(["impression", "hide", "action"]),
  at: z.string().trim().max(40),
});

export const garnishExportSchema = z.object({
  version: z.literal(GARNISH_EXPORT_VERSION),
  platform: z.enum(["slurp", "noodle"]).nullable().default(null),
  exportedAt: z.string().trim().max(40).optional(),
  ads: z.array(adSchema).max(5000),
  // Events are optional: a shared brand pack carries ads only, while a backup
  // carries the ratings too.
  events: z.array(eventSchema).max(20000).default([]),
});

export type GarnishExport = z.infer<typeof garnishExportSchema>;

export async function exportGarnishAds(pool: GarnishAdsStorage, platform?: GarnishPlatform): Promise<GarnishExport> {
  const ads = await pool.listAll(platform);
  const adIds = new Set(ads.map((ad) => ad.id));
  const events = (await pool.listEvents()).filter((event) => adIds.has(event.adId));
  return {
    version: GARNISH_EXPORT_VERSION,
    platform: platform ?? null,
    exportedAt: new Date().toISOString(),
    ads,
    events,
  };
}

export type GarnishImportMode = "merge" | "replace";

/**
 * Import a pack. `merge` adds and overwrites by id and keeps everything else;
 * `replace` swaps the whole pool for what the file holds. Events only come in
 * when the file carries them, so importing a brand pack never rewrites the
 * ratings you have already earned.
 */
export async function importGarnishAds(
  pool: GarnishAdsStorage,
  payload: unknown,
  mode: GarnishImportMode = "merge",
): Promise<{ imported: number; events: number }> {
  const parsed = garnishExportSchema.parse(payload);
  const incoming = parsed.ads as GarnishAd[];

  if (mode === "replace") {
    await pool.replaceAll(incoming);
    await pool.replaceEvents(parsed.events as GarnishAdEvent[]);
    return { imported: incoming.length, events: parsed.events.length };
  }

  const existing = await pool.listAll();
  const incomingIds = new Set(incoming.map((ad) => ad.id));
  await pool.replaceAll([...existing.filter((ad) => !incomingIds.has(ad.id)), ...incoming]);
  if (parsed.events.length) {
    const events = await pool.listEvents();
    await pool.replaceEvents([...events, ...(parsed.events as GarnishAdEvent[])]);
  }
  return { imported: incoming.length, events: parsed.events.length };
}

export const GARNISH_RATING_VALUES = GARNISH_CONTENT_RATINGS;
