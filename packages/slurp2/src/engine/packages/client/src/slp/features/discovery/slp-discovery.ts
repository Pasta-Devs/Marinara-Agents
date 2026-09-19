import type { SlurpDiscoveryGender } from "../../base/state/slp-state-types.js";
export const SLURP_DISCOVERY_TAG_GROUPS = [
  {
    id: "themes",
    tags: ["art", "cosplay", "fashion", "fantasy", "fitness", "gaming", "music", "outdoors", "sci-fi"],
  },
  {
    id: "vibe",
    tags: ["dominant", "flirty", "mysterious", "playful", "romantic", "submissive", "wholesome"],
  },
  { id: "adult", tags: ["bdsm", "exhibitionism", "feet", "lingerie", "roleplay", "toys"] },
] as const;

export const SLURP_DISCOVERY_TAGS = SLURP_DISCOVERY_TAG_GROUPS.flatMap((group) => [...group.tags]);
export const SLURP_DISCOVERY_TAG_LIMIT = 8;
export const SLURP_DISCOVERY_MIN_TAGS = 3;

/** Groups the `discoveryTags` setting for display, keeping first-seen group order. Falls back to the seed. */
export function groupSlurpDiscoveryTags(
  entries: ReadonlyArray<{ tag: string; group: string }> | undefined,
): Array<{ id: string; tags: string[] }> {
  if (!entries) return SLURP_DISCOVERY_TAG_GROUPS.map((group) => ({ id: group.id, tags: [...group.tags] }));
  const groups = new Map<string, string[]>();
  for (const { tag, group } of entries) groups.set(group, [...(groups.get(group) ?? []), tag]);
  return [...groups].map(([id, tags]) => ({ id, tags }));
}

/** Existing Creators may predate the gender and tag requirement; they are flagged, never blocked. */
export function isSlurpDiscoveryProfileIncomplete(profile: { gender?: unknown; tags?: readonly string[] }): boolean {
  return !profile.gender || (profile.tags?.length ?? 0) < SLURP_DISCOVERY_MIN_TAGS;
}
export const SLURP_DISCOVERY_TAG_MAX_LENGTH = 24;

export type SlurpDiscoverSort = "recommended" | "newest" | "liked" | "subscribed";
// Defined in base/state so the reusable Creator card can read it without importing Discovery.
export type { SlurpDiscoverLayout } from "../../base/state/slp-state-types.js";

export function normalizeSlurpDiscoveryTag(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ");
}

export function normalizeSlurpDiscoveryTags(value: readonly string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const candidate of value) {
    const enteredTag = normalizeSlurpDiscoveryTag(candidate);
    const key = enteredTag.toLocaleLowerCase();
    const tag = SLURP_DISCOVERY_TAGS.find((curated) => curated === key) ?? enteredTag;
    if (!tag || tag.length > SLURP_DISCOVERY_TAG_MAX_LENGTH || seen.has(key)) continue;
    seen.add(key);
    result.push(tag);
    if (result.length === SLURP_DISCOVERY_TAG_LIMIT) break;
  }
  return result;
}

export type SlurpDiscoverCreator = {
  profile: {
    id: string;
    displayName: string;
    handle: string;
    bio?: string | null;
    createdAt?: string | null;
    gender?: SlurpDiscoveryGender | null;
    tags?: string[];
  };
  subscribed: boolean;
  subscriptionPrice?: number | null;
  posts: Array<{ likeCount?: number | null }>;
};

export type SlurpDiscoverFilters = {
  search: string;
  notSubscribed: boolean;
  genders: ReadonlySet<SlurpDiscoveryGender>;
  tags: ReadonlySet<string>;
  minimumPrice: number | null;
  maximumPrice: number | null;
  sort: SlurpDiscoverSort;
};

export function filterAndSortSlurpCreators<T extends SlurpDiscoverCreator>(
  creators: readonly T[],
  filters: SlurpDiscoverFilters,
  connectionCounts: Record<string, { fans: number }>,
): T[] {
  const search = filters.search.trim().toLocaleLowerCase();
  const originalOrder = new Map(creators.map((creator, index) => [creator.profile.id, index]));
  const matches = creators.filter((creator) => {
    const price = creator.subscriptionPrice ?? 0;
    const tags = creator.profile.tags ?? [];
    return (
      (!search ||
        creator.profile.displayName.toLocaleLowerCase().includes(search) ||
        creator.profile.handle.toLocaleLowerCase().includes(search) ||
        (creator.profile.bio ?? "").toLocaleLowerCase().includes(search) ||
        tags.some((tag) => tag.toLocaleLowerCase().includes(search))) &&
      (!filters.notSubscribed || !creator.subscribed) &&
      (filters.genders.size === 0 ||
        (creator.profile.gender !== null &&
          creator.profile.gender !== undefined &&
          filters.genders.has(creator.profile.gender))) &&
      (filters.tags.size === 0 || tags.some((tag) => filters.tags.has(tag))) &&
      (filters.minimumPrice === null || price >= filters.minimumPrice) &&
      (filters.maximumPrice === null || price <= filters.maximumPrice)
    );
  });
  const stable = (left: T, right: T) =>
    left.profile.displayName.localeCompare(right.profile.displayName) ||
    left.profile.id.localeCompare(right.profile.id);
  return matches.sort((left, right) => {
    if (filters.sort === "recommended") {
      return (originalOrder.get(left.profile.id) ?? 0) - (originalOrder.get(right.profile.id) ?? 0);
    }
    let difference = 0;
    if (filters.sort === "newest") {
      difference = Date.parse(right.profile.createdAt ?? "") - Date.parse(left.profile.createdAt ?? "");
      if (Number.isNaN(difference)) difference = 0;
    } else if (filters.sort === "liked") {
      difference =
        right.posts.reduce((total, post) => total + (post.likeCount ?? 0), 0) -
        left.posts.reduce((total, post) => total + (post.likeCount ?? 0), 0);
    } else {
      difference = (connectionCounts[right.profile.id]?.fans ?? 0) - (connectionCounts[left.profile.id]?.fans ?? 0);
    }
    return difference || stable(left, right);
  });
}
