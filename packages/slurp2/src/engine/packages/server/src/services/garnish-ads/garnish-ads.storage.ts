import type { DB } from "../../db/connection.js";
import { createAppSettingsStorage } from "../storage/app-settings.storage.js";
import { GARNISH_BASE_ADS, GARNISH_BASE_BRANDS } from "./garnish-ads.base.js";
import {
  garnishAdBrandId,
  type GarnishAd,
  type GarnishAdOrigin,
  type GarnishBrand,
  type GarnishPlatform,
} from "./garnish-ads.types.js";

/**
 * ponytail: the pool lives in one app-settings JSON blob, and every write
 * rewrites it. That is fine to a few hundred ads, which is well past what a
 * hand-authored pool reaches. Move to a `garnish_ads` table when generation
 * starts producing ads faster than a person can read them.
 */
const POOL_KEY = "garnish.ads.pool";
const EVENTS_KEY = "garnish.ads.events";
const BRANDS_KEY = "garnish.brands";

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
  const readBrands = async () => parseArray<GarnishBrand>(await settings.get(BRANDS_KEY));
  const writeBrands = async (brands: GarnishBrand[]) => settings.set(BRANDS_KEY, JSON.stringify(brands));
  /** Stored brands win on id over the shipped ones, like ads. */
  const knownBrands = async () => {
    const stored = await readBrands();
    const ids = new Set(stored.map((brand) => brand.id));
    return [...GARNISH_BASE_BRANDS.filter((brand) => !ids.has(brand.id)), ...stored];
  };

  return {
    /** Base ads plus stored ones. Stored entries win on id, so a base ad can be overridden. */
    async listAll(platform?: GarnishPlatform): Promise<GarnishAd[]> {
      const stored = await readStored();
      const storedIds = new Set(stored.map((ad) => ad.id));
      const all = [...GARNISH_BASE_ADS.filter((ad) => !storedIds.has(ad.id)), ...stored];
      return platform ? all.filter((ad) => ad.platform === platform) : all;
    },

    /** Live ads only: retired ones, and every product of a switched-off brand, stay stored so ids are never reused. */
    async listActive(platform: GarnishPlatform): Promise<GarnishAd[]> {
      const off = new Set((await knownBrands()).filter((brand) => brand.disabledAt).map((brand) => brand.id));
      return (await this.listAll(platform)).filter((ad) => !ad.retiredAt && !off.has(garnishAdBrandId(ad)));
    },

    /**
     * Every brand: the stored and shipped ones, plus one for each brand name an ad carries that no
     * brand has yet (ads from before brands existed, imported or generated ones). Those read as a
     * brand with the ad's own first category, so old ads show up under a brand with nothing rewritten.
     */
    async listBrands(platform?: GarnishPlatform): Promise<GarnishBrand[]> {
      const brands = (await knownBrands()).filter((brand) => !platform || brand.platform === platform);
      const ids = new Set(brands.map((brand) => brand.id));
      const derived: GarnishBrand[] = [];
      for (const ad of await this.listAll(platform)) {
        const id = garnishAdBrandId(ad);
        if (ids.has(id)) continue;
        ids.add(id);
        derived.push({
          id,
          platform: ad.platform,
          name: ad.brand,
          category: ad.categories[0] ?? "",
          tone: "",
          logoPrompt: "",
          origin: ad.origin,
          createdAt: ad.createdAt,
        });
      }
      return [...brands, ...derived];
    },

    /**
     * Add or change a brand. A new name is written onto its products (and they get its id), so every
     * ad keeps reading on its own and an old ad does not lose its brand when the name changes.
     */
    async saveBrand(brand: GarnishBrand): Promise<GarnishBrand> {
      const previous = (await this.listBrands()).find((entry) => entry.id === brand.id);
      await writeBrands([...(await readBrands()).filter((entry) => entry.id !== brand.id), brand]);
      if (previous && previous.name !== brand.name) {
        const all = await this.listAll();
        const renamed = all.filter((ad) => garnishAdBrandId(ad) === brand.id);
        for (const ad of renamed) await this.add({ ...ad, brand: brand.name, brandId: brand.id });
      }
      return brand;
    },

    /**
     * A shipped brand is switched off, never deleted. Any other brand goes with its own products
     * (shipped products of it are only retired). Returns the removed products for their files.
     */
    async removeBrand(brandId: string): Promise<GarnishAd[]> {
      const brand = (await this.listBrands()).find((entry) => entry.id === brandId);
      if (!brand) return [];
      if (brand.origin === "builtin") {
        await this.saveBrand({ ...brand, disabledAt: brand.disabledAt ?? new Date().toISOString() });
        return [];
      }
      await writeBrands((await readBrands()).filter((entry) => entry.id !== brandId));
      const products = (await this.listAll()).filter((ad) => garnishAdBrandId(ad) === brandId);
      for (const ad of products) await this.remove(ad.id);
      return products.filter((ad) => ad.origin !== "builtin");
    },

    async add(ad: GarnishAd): Promise<GarnishAd> {
      const stored = await readStored();
      await writeStored([...stored.filter((existing) => existing.id !== ad.id), ad]);
      return ad;
    },

    /** Builtin ads cannot be deleted, so removing one hides it instead. */
    async remove(adId: string): Promise<void> {
      if (GARNISH_BASE_ADS.some((ad) => ad.id === adId)) return this.retire(adId);
      const stored = await readStored();
      await writeStored(stored.filter((ad) => ad.id !== adId));
    },

    async retire(adId: string, at = new Date().toISOString()): Promise<void> {
      const all = await this.listAll();
      const target = all.find((ad) => ad.id === adId);
      if (!target) return;
      await this.add({ ...target, retiredAt: at });
    },

    /** Editing or restoring a builtin stores an override copy under the same id. */
    async update(
      adId: string,
      patch: Partial<Omit<GarnishAd, "id" | "platform" | "origin">>,
    ): Promise<GarnishAd | null> {
      const target = (await this.listAll()).find((ad) => ad.id === adId);
      return target ? this.add({ ...target, ...patch }) : null;
    },

    /**
     * Drop generated artwork from an ad and report the file that is now unreferenced.
     *
     * An edited builtin is stored with origin "builtin", so origin alone cannot tell a shipped
     * image from one we generated — comparing against the base ad can. The builtin's own image is
     * put back, so a retired builtin still renders if it is restored later.
     */
    async releaseGeneratedImage(adId: string): Promise<string | null> {
      const current = (await this.listAll()).find((ad) => ad.id === adId);
      const base = GARNISH_BASE_ADS.find((ad) => ad.id === adId);
      if (!current?.imageUrl || current.imageUrl === base?.imageUrl) return null;
      if (base) await this.update(adId, { imageUrl: base.imageUrl ?? null });
      return current.imageUrl;
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
