import type { DB } from "../../db/connection.js";
import { createAppSettingsStorage } from "../storage/app-settings.storage.js";

export type SlurpPromotionKind = "creator" | "inline";

export type SlurpPromotion = {
  id: string;
  kind: SlurpPromotionKind;
  brand: string;
  product: string;
  copy: string;
  categories: string[];
  contextTags: string[];
  creatorAccountId?: string;
  creatorHandle?: string;
  imageUrl?: string | null;
  actionLabel?: string;
};

export type SlurpAdState = { hiddenPromotionIds: string[]; recentPromotionIds: string[] };

export type SlurpAdContext = {
  personaTags?: string[];
  currentCreatorId?: string | null;
  currentCreatorHandle?: string | null;
  contextTags?: string[];
};

const stateKey = (personaId: string) => `slurp.viewer.${personaId}.ads`;

export const SLURP_PROMOTIONS: readonly SlurpPromotion[] = [
  {
    id: "nightjar-midnight-blend",
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
    kind: "creator",
    brand: "Velvet Skin",
    product: "Midnight Gloss",
    copy: "A dark shine for late events and worse decisions.",
    categories: ["beauty", "fashion", "night"],
    contextTags: ["night", "date", "party"],
    actionLabel: "View product",
  },
];

function cleanTags(tags: readonly string[] | undefined): string[] {
  return [...new Set((tags ?? []).map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
}

function scorePromotion(promotion: SlurpPromotion, context: SlurpAdContext): number {
  const tags = new Set(cleanTags([...(context.personaTags ?? []), ...(context.contextTags ?? [])]));
  let score = 0;
  for (const tag of promotion.categories) if (tags.has(tag)) score += 3;
  for (const tag of promotion.contextTags) if (tags.has(tag)) score += 2;
  if (promotion.creatorAccountId && promotion.creatorAccountId === context.currentCreatorId) score += 6;
  if (promotion.creatorHandle && promotion.creatorHandle === context.currentCreatorHandle) score += 6;
  return score;
}

function readState(raw: string | null): SlurpAdState {
  try {
    const value = raw ? JSON.parse(raw) : null;
    return {
      hiddenPromotionIds: Array.isArray(value?.hiddenPromotionIds)
        ? value.hiddenPromotionIds.filter((id: unknown): id is string => typeof id === "string")
        : [],
      recentPromotionIds: Array.isArray(value?.recentPromotionIds)
        ? value.recentPromotionIds.filter((id: unknown): id is string => typeof id === "string")
        : [],
    };
  } catch {
    return { hiddenPromotionIds: [], recentPromotionIds: [] };
  }
}

export function createSlurpAds(db: DB) {
  const settings = createAppSettingsStorage(db);
  return {
    async listInlineAds(personaId: string, context: SlurpAdContext = {}) {
      const state = readState(await settings.get(stateKey(personaId)));
      const hidden = new Set(state.hiddenPromotionIds);
      const recent = new Set(state.recentPromotionIds);
      return SLURP_PROMOTIONS.filter((promotion) => promotion.kind === "inline" && !hidden.has(promotion.id))
        .map((promotion, index) => ({ promotion, score: scorePromotion(promotion, context), index }))
        .sort((left, right) => right.score - left.score || left.index - right.index)
        .filter(({ promotion }) => !recent.has(promotion.id))
        .slice(0, 2)
        .map(({ promotion }) => promotion);
    },
    async hide(personaId: string, promotionId: string) {
      const state = readState(await settings.get(stateKey(personaId)));
      const next = {
        ...state,
        hiddenPromotionIds: [...new Set([...state.hiddenPromotionIds, promotionId])].slice(-100),
      };
      await settings.set(stateKey(personaId), JSON.stringify(next));
      return next;
    },
    async markRecent(personaId: string, promotionIds: string[]) {
      const state = readState(await settings.get(stateKey(personaId)));
      const next = {
        ...state,
        recentPromotionIds: [...new Set([...promotionIds, ...state.recentPromotionIds])].slice(0, 12),
      };
      await settings.set(stateKey(personaId), JSON.stringify(next));
      return next;
    },
  };
}
