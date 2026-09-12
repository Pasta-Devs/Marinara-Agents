import type { DB } from "../../db/connection.js";
import { createAppSettingsStorage } from "../storage/app-settings.storage.js";
import { GARNISH_BASE_ADS } from "./garnish-ads.base.js";
import type { GarnishAd, GarnishAdOrigin, GarnishPlatform } from "./garnish-ads.types.js";

/**
 * ponytail: the pool lives in one app-settings JSON blob, and every write
 * rewrites it. That is fine to a few hundred ads, which is well past what a
 * hand-authored pool reaches. Move to a `garnish_ads` table when generation
 * starts producing ads faster than a person can read them.
 */
const POOL_KEY = "garnish.ads.pool";
const EVENTS_KEY = "garnish.ads.events";

export type GarnishAdEvent = {
  adId: string;
  subjectId: string;
  type: "impression" | "hide" | "action";
  at: string;
};

function parseArray<T>(raw: string | null): T[] {
  try {
    const value = raw ? JSON.parse(raw) : null;
    return Array.isArray(value) ? (value as T[]) : [];
  } catch {
    return [];
  }
}

export function createGarnishAdsStorage(db: DB) {
  const settings = createAppSettingsStorage(db);

  const readStored = async () => parseArray<GarnishAd>(await settings.get(POOL_KEY));
  const writeStored = async (ads: GarnishAd[]) => settings.set(POOL_KEY, JSON.stringify(ads));

  return {
    /** Base ads plus stored ones. Stored entries win on id, so a base ad can be overridden. */
    async listAll(platform?: GarnishPlatform): Promise<GarnishAd[]> {
      const stored = await readStored();
      const storedIds = new Set(stored.map((ad) => ad.id));
      const all = [...GARNISH_BASE_ADS.filter((ad) => !storedIds.has(ad.id)), ...stored];
      return platform ? all.filter((ad) => ad.platform === platform) : all;
    },

    /** Live ads only: retired ones stay stored so their id is never reused. */
    async listActive(platform: GarnishPlatform): Promise<GarnishAd[]> {
      return (await this.listAll(platform)).filter((ad) => !ad.retiredAt);
    },

    async add(ad: GarnishAd): Promise<GarnishAd> {
      const stored = await readStored();
      await writeStored([...stored.filter((existing) => existing.id !== ad.id), ad]);
      return ad;
    },

    async remove(adId: string): Promise<void> {
      const stored = await readStored();
      await writeStored(stored.filter((ad) => ad.id !== adId));
    },

    async retire(adId: string, at = new Date().toISOString()): Promise<void> {
      const all = await this.listAll();
      const target = all.find((ad) => ad.id === adId);
      if (!target) return;
      await this.add({ ...target, retiredAt: at });
    },

    async replaceAll(ads: GarnishAd[]): Promise<void> {
      await writeStored(ads);
    },

    async listEvents(): Promise<GarnishAdEvent[]> {
      return parseArray<GarnishAdEvent>(await settings.get(EVENTS_KEY));
    },

    /**
     * ponytail: events are capped at 2000 and the oldest fall off. Ratings only
     * need recent behaviour, and an uncapped log in a blob would grow forever.
     */
    async recordEvent(event: GarnishAdEvent): Promise<void> {
      const events = await this.listEvents();
      await settings.set(EVENTS_KEY, JSON.stringify([...events, event].slice(-2000)));
    },

    async replaceEvents(events: GarnishAdEvent[]): Promise<void> {
      await settings.set(EVENTS_KEY, JSON.stringify(events.slice(-2000)));
    },

    async clearEvents(): Promise<void> {
      await settings.set(EVENTS_KEY, "[]");
    },
  };
}

export type GarnishAdsStorage = ReturnType<typeof createGarnishAdsStorage>;
export type { GarnishAdOrigin };
