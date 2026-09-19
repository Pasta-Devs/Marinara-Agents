import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api } from "../../../lib/api-client.js";
import type { SlurpPageCursor } from "../../base/state/slp-page-cursor.js";
import { cursorQuery } from "../../base/state/slp-page-cursor.js";
import { slpKeys } from "../../base/state/slp-query-keys.js";
import type {
  SlpCreatorConnectionCounts,
  SlurpAudienceCharacterGroup,
  SlurpAudienceCharacterSummary,
  SlurpFollowerEntry,
  SlurpSubscriberEntry,
} from "./slp-audience-contract.js";

export function useCreatorConnectionCounts(enabled = true) {
  return useQuery({
    queryKey: slpKeys.noodlerConnectionCounts(),
    queryFn: () => api.get<SlpCreatorConnectionCounts>("/slurp2/noodler/account-connection-counts"),
    enabled,
    staleTime: 30_000,
  });
}
/**
 * The named followers of one Creator, plus the total.
 *
 * The list stops at the named cast; `total` is the platform reach. That is the point — these
 * people, and this many more.
 */
export function useCreatorFollowers(accountId: string | null) {
  return useQuery({
    queryKey: slpKeys.noodlerFollowers(accountId ?? "none"),
    queryFn: () =>
      api.get<{ items: SlurpFollowerEntry[]; total: number }>(
        `/slurp2/noodler/accounts/${encodeURIComponent(accountId!)}/followers`,
      ),
    enabled: Boolean(accountId),
    staleTime: 10_000,
  });
}
export function useSlurpAudienceCharacters() {
  return useInfiniteQuery({
    queryKey: ["slurp", "audience", "characters"],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      api.get<{
        characters: SlurpAudienceCharacterSummary[];
        limit: number;
        offset: number;
        hasMore: boolean;
      }>(`/slurp2/settings/audience-characters?limit=30&offset=${pageParam}`),
    getNextPageParam: (page) => (page.hasMore ? page.offset + page.characters.length : undefined),
    staleTime: 60_000,
  });
}
export function useSlurpAudienceCharacterGroups(enabled = true) {
  return useQuery({
    queryKey: ["slurp", "audience", "character-groups"],
    queryFn: () => api.get<{ groups: SlurpAudienceCharacterGroup[] }>("/slurp2/settings/audience-characters/groups"),
    enabled,
    staleTime: 5 * 60_000,
  });
}
export function useCreatorSubscribers(accountId: string | null) {
  return useInfiniteQuery({
    queryKey: slpKeys.noodlerSubscribers(accountId ?? "none"),
    initialPageParam: null as SlurpPageCursor | null,
    queryFn: ({ pageParam }) =>
      api.get<{
        items: SlurpSubscriberEntry[];
        total: number;
        nextCursor: SlurpPageCursor | null;
      }>(`/slurp2/noodler/accounts/${encodeURIComponent(accountId!)}/subscribers?limit=20${cursorQuery(pageParam)}`),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: Boolean(accountId),
    staleTime: 10_000,
  });
}
