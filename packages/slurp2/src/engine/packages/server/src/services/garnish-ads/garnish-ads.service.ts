import type { DB } from "../../db/connection.js";
import { createAppSettingsStorage } from "../storage/app-settings.storage.js";
import { qualityScores } from "./garnish-ads.rating.js";
import { createGarnishAdsStorage, type GarnishAdEvent } from "./garnish-ads.storage.js";
import {
  garnishRatingAllowed,
  type GarnishAd,
  type GarnishAdContext,
  type GarnishAdState,
  type GarnishPlatform,
} from "./garnish-ads.types.js";

/**
 * Storage key for a subject's ad state. The `slurp2.viewer.` prefix is a stored
 * data key, not an identifier, and it is deliberately unchanged: renaming it
 * would silently drop every existing hidden-ad list.
 */
const stateKey = (subjectId: string) => `slurp2.viewer.${subjectId}.ads`;

function cleanTags(tags: readonly string[] | undefined): string[] {
  return [...new Set((tags ?? []).map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
}

function scoreAd(ad: GarnishAd, context: GarnishAdContext, quality: number): number {
  if (context.steering === "random") return quality;
  const tags = new Set(cleanTags([...(context.subjectTags ?? []), ...(context.contextTags ?? [])]));
  let score = 0;
  for (const tag of ad.categories) if ((context.preferredTags ?? []).includes(tag)) score += 5;
  if (context.steering === "balanced") return score + quality;
  for (const tag of ad.categories) if (tags.has(tag)) score += 3;
  for (const tag of ad.contextTags) if (tags.has(tag)) score += 2;
  if (ad.creatorAccountId && ad.creatorAccountId === context.currentCreatorId) score += 6;
  if (ad.creatorHandle && ad.creatorHandle === context.currentCreatorHandle) score += 6;
  return score + quality;
}

function readState(raw: string | null): GarnishAdState {
  try {
    const value = raw ? JSON.parse(raw) : null;
    return {
      // `hiddenPromotionIds` / `recentPromotionIds` are the pre-rename stored
      // field names. Read both so existing state survives the rename.
      hiddenAdIds: readIds(value?.hiddenAdIds ?? value?.hiddenPromotionIds),
      recentAdIds: readIds(value?.recentAdIds ?? value?.recentPromotionIds),
      hiddenBrands: readIds(value?.hiddenBrands),
    };
  } catch {
    return { hiddenAdIds: [], recentAdIds: [], hiddenBrands: [] };
  }
}

function readIds(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id: unknown): id is string => typeof id === "string") : [];
}

export function createGarnishAds(db: DB) {
  const settings = createAppSettingsStorage(db);
  const pool = createGarnishAdsStorage(db);
  const load = async (subjectId: string) => readState(await settings.get(stateKey(subjectId)));
  const save = async (subjectId: string, next: GarnishAdState) => {
    await settings.set(stateKey(subjectId), JSON.stringify(next));
    return next;
  };

  return {
    pool,

    async listInline(subjectId: string, platform: GarnishPlatform, context: GarnishAdContext = {}) {
      const [state, ads, events] = await Promise.all([load(subjectId), pool.listActive(platform), pool.listEvents()]);
      const hidden = new Set(state.hiddenAdIds);
      const hiddenBrands = new Set(state.hiddenBrands.map((brand) => brand.toLowerCase()));
      const recent = new Set(state.recentAdIds);
      const quality = qualityScores(events);
      // A host that states no ceiling has not said what it is allowed to show, so it gets the
      // safest tier rather than everything. Defaulting the other way turned one dropped field
      // into an open gate instead of a visible breakage.
      const ceiling = context.contentCeiling ?? "tame";

      return ads
        .filter(
          (ad) =>
            ad.kind === "inline" &&
            !hidden.has(ad.id) &&
            !hiddenBrands.has(ad.brand.toLowerCase()) &&
            garnishRatingAllowed(ad.contentRating, ceiling),
        )
        .map((ad, index) => ({ ad, score: scoreAd(ad, context, quality.get(ad.id) ?? 0), index }))
        .sort((left, right) => right.score - left.score || left.index - right.index)
        .filter(({ ad }) => !recent.has(ad.id))
        .slice(0, 2)
        .map(({ ad }) => ad);
    },

    async hide(subjectId: string, adId: string) {
      const state = await load(subjectId);
      await pool.recordEvent({ adId, subjectId, type: "hide", at: new Date().toISOString() });
      return save(subjectId, { ...state, hiddenAdIds: [...new Set([...state.hiddenAdIds, adId])].slice(-100) });
    },

    async hideBrand(subjectId: string, brand: string) {
      const state = await load(subjectId);
      return save(subjectId, { ...state, hiddenBrands: [...new Set([...state.hiddenBrands, brand])].slice(-100) });
    },

    async unhideBrand(subjectId: string, brand: string) {
      const state = await load(subjectId);
      const target = brand.toLowerCase();
      return save(subjectId, {
        ...state,
        hiddenBrands: state.hiddenBrands.filter((value) => value.toLowerCase() !== target),
      });
    },

    async record(subjectId: string, adId: string, type: GarnishAdEvent["type"]) {
      await pool.recordEvent({ adId, subjectId, type, at: new Date().toISOString() });
    },

    async canAct(subjectId: string, platform: GarnishPlatform, adId: string): Promise<boolean> {
      const [state, active] = await Promise.all([load(subjectId), pool.listActive(platform)]);
      return state.recentAdIds.includes(adId) && active.some((ad) => ad.id === adId && ad.kind === "inline");
    },

    async reset(subjectId: string) {
      return save(subjectId, { hiddenAdIds: [], recentAdIds: [], hiddenBrands: [] });
    },

    async state(subjectId: string) {
      return load(subjectId);
    },

    async markRecent(subjectId: string, adIds: string[]) {
      const state = await load(subjectId);
      return save(subjectId, { ...state, recentAdIds: [...new Set([...adIds, ...state.recentAdIds])].slice(0, 12) });
    },
  };
}

export type GarnishAds = ReturnType<typeof createGarnishAds>;
