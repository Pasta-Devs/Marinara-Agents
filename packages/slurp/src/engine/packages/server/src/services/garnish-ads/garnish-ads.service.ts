import type { DB } from "../../db/connection.js";
import { createAppSettingsStorage } from "../storage/app-settings.storage.js";
import type {
  GarnishAd,
  GarnishAdContext,
  GarnishAdState,
  GarnishCreatorProfile,
  GarnishPlatform,
} from "./garnish-ads.types.js";

/**
 * Storage key for a subject's ad state. The `slurp.viewer.` prefix is a stored
 * data key, not an identifier, and it is deliberately unchanged: renaming it
 * would silently drop every existing hidden-ad list. Migrate it only alongside
 * a real backfill.
 */
const stateKey = (subjectId: string) => `slurp.viewer.${subjectId}.ads`;

/** Shipped base pool. Each host falls back to this when nothing else exists. */
export const GARNISH_BASE_ADS: readonly GarnishAd[] = [
  {
    id: "nightjar-midnight-blend",
    platform: "slurp",
    kind: "inline",
    brand: "Nightjar Coffee",
    product: "Midnight Blend",
    copy: "A bitter little ritual for people who refuse to sleep on schedule.",
    categories: ["coffee", "late-night", "work"],
    contextTags: ["night", "rain", "working"],
    actionLabel: "View blend",
  },
  {
    id: "moonmilk-afterglow",
    platform: "slurp",
    kind: "inline",
    brand: "Moonmilk Beauty",
    product: "Afterglow Night Set",
    copy: "Soft floral light for routines that happen long after midnight.",
    categories: ["beauty", "luxury", "night"],
    contextTags: ["night", "home", "date"],
    actionLabel: "View set",
  },
  {
    id: "black-halo-private-rooms",
    platform: "slurp",
    kind: "inline",
    brand: "Black Halo Rooms",
    product: "After-hours private rooms",
    copy: "The city is loud. Your reservation does not have to be.",
    categories: ["nightlife", "private", "luxury"],
    contextTags: ["night", "club", "city"],
    actionLabel: "See rooms",
  },
  {
    id: "velvet-skin-midnight-gloss",
    platform: "slurp",
    kind: "creator",
    brand: "Velvet Skin",
    product: "Midnight Gloss",
    copy: "A dark shine for late events and worse decisions.",
    categories: ["beauty", "fashion", "night"],
    contextTags: ["night", "date", "party"],
    actionLabel: "View product",
  },
];

/** Pick a creator-read ad whose categories match the creator's own words. */
export function creatorAdForProfile(profile: GarnishCreatorProfile, platform: GarnishPlatform = "slurp") {
  const text = `${profile.handle} ${profile.bio ?? ""}`.toLowerCase();
  return (
    GARNISH_BASE_ADS.find(
      (ad) =>
        ad.platform === platform && ad.kind === "creator" && ad.categories.some((category) => text.includes(category)),
    ) ?? null
  );
}

function cleanTags(tags: readonly string[] | undefined): string[] {
  return [...new Set((tags ?? []).map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
}

function scoreAd(ad: GarnishAd, context: GarnishAdContext): number {
  if (context.steering === "random") return 0;
  const tags = new Set(cleanTags([...(context.subjectTags ?? []), ...(context.contextTags ?? [])]));
  let score = 0;
  for (const tag of ad.categories) if ((context.preferredTags ?? []).includes(tag)) score += 5;
  if (context.steering === "balanced") return score;
  for (const tag of ad.categories) if (tags.has(tag)) score += 3;
  for (const tag of ad.contextTags) if (tags.has(tag)) score += 2;
  if (ad.creatorAccountId && ad.creatorAccountId === context.currentCreatorId) score += 6;
  if (ad.creatorHandle && ad.creatorHandle === context.currentCreatorHandle) score += 6;
  return score;
}

function readState(raw: string | null): GarnishAdState {
  try {
    const value = raw ? JSON.parse(raw) : null;
    return {
      // `hiddenPromotionIds` / `recentPromotionIds` are the pre-rename stored
      // field names. Read both so existing state survives the rename.
      hiddenAdIds: readIds(value?.hiddenAdIds ?? value?.hiddenPromotionIds),
      recentAdIds: readIds(value?.recentAdIds ?? value?.recentPromotionIds),
    };
  } catch {
    return { hiddenAdIds: [], recentAdIds: [] };
  }
}

function readIds(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id: unknown): id is string => typeof id === "string") : [];
}

export function createGarnishAds(db: DB) {
  const settings = createAppSettingsStorage(db);
  const load = async (subjectId: string) => readState(await settings.get(stateKey(subjectId)));
  const save = async (subjectId: string, next: GarnishAdState) => {
    await settings.set(stateKey(subjectId), JSON.stringify(next));
    return next;
  };
  return {
    async listInline(subjectId: string, platform: GarnishPlatform, context: GarnishAdContext = {}) {
      const state = await load(subjectId);
      const hidden = new Set(state.hiddenAdIds);
      const recent = new Set(state.recentAdIds);
      return GARNISH_BASE_ADS.filter((ad) => ad.platform === platform && ad.kind === "inline" && !hidden.has(ad.id))
        .map((ad, index) => ({ ad, score: scoreAd(ad, context), index }))
        .sort((left, right) => right.score - left.score || left.index - right.index)
        .filter(({ ad }) => !recent.has(ad.id))
        .slice(0, 2)
        .map(({ ad }) => ad);
    },
    async hide(subjectId: string, adId: string) {
      const state = await load(subjectId);
      return save(subjectId, { ...state, hiddenAdIds: [...new Set([...state.hiddenAdIds, adId])].slice(-100) });
    },
    async reset(subjectId: string) {
      return save(subjectId, { hiddenAdIds: [], recentAdIds: [] });
    },
    async markRecent(subjectId: string, adIds: string[]) {
      const state = await load(subjectId);
      return save(subjectId, { ...state, recentAdIds: [...new Set([...adIds, ...state.recentAdIds])].slice(0, 12) });
    },
  };
}
