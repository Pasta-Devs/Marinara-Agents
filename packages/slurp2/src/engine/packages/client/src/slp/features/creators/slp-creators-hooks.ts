import type { NoodleAccount } from "@marinara-engine/shared";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api-client.js";
import { noodleKeys } from "../../base/state/slp-query-keys.js";
import type { SlurpManagedStageProfile } from "../../base/state/slp-state-types.js";
import type { SlurpCreatorBulkPatch, SlurpCreatorMetrics, SlurpScheduleStatus } from "./slp-creators-contract.js";

/** One edit applied to many Creators at once; a single Creator's quick edit uses it too. */
export function useBulkUpdateSlurpCreators() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { ids: string[]; patch: SlurpCreatorBulkPatch }) =>
      api.post<{ updated: number; skipped: number; tagLimitReached: number }>(
        "/slurp2/noodler/accounts/bulk-update",
        input,
      ),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: noodleKeys.noodlerAccounts() }),
        queryClient.invalidateQueries({ queryKey: noodleKeys.noodlerReserveStatus() }),
        queryClient.invalidateQueries({ queryKey: [...noodleKeys.settings(), "discovery-tag-usage"] }),
        queryClient.invalidateQueries({ queryKey: noodleKeys.noodlerRoot() }),
      ]),
  });
}
export function useNoodlerAccounts(enabled = true) {
  return useQuery({
    queryKey: noodleKeys.noodlerAccounts(),
    // The server sends `scheduleStatus` alongside the shared type, which has no such field — the
    // same arrangement `subscriptionPrice` and the tip goal already use.
    queryFn: () =>
      api.get<Array<SlurpManagedStageProfile & { scheduleStatus?: SlurpScheduleStatus }>>("/slurp2/noodler/accounts"),
    enabled,
    staleTime: 10_000,
    // Autonomous reserve work changes operator state without a client mutation.
    refetchInterval: enabled ? 30_000 : false,
    refetchIntervalInBackground: false,
  });
}
/** Read-only metrics for every Creator. Unlike the studio, reading this changes nothing. */
export function useSlurpCreatorMetrics(enabled = true) {
  return useQuery({
    queryKey: [...noodleKeys.noodlerRoot(), "creator-metrics"],
    queryFn: () => api.get<{ creators: SlurpCreatorMetrics[] }>("/slurp2/noodler/creator-metrics"),
    enabled,
    staleTime: 30_000,
  });
}
export function useNoodlerEligibleAccounts(
  search: string,
  kind: "all" | "character" | "persona",
  enabled = true,
  includeAccountId?: string | null,
) {
  const normalizedSearch = search.trim();
  return useInfiniteQuery({
    queryKey: [...noodleKeys.noodlerEligibleAccounts(normalizedSearch, kind), includeAccountId ?? "none"],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      api.get<{
        items: NoodleAccount[];
        limit: number;
        offset: number;
        hasMore: boolean;
      }>(
        `/slurp2/noodler/eligible-accounts?limit=100&offset=${pageParam}&search=${encodeURIComponent(normalizedSearch)}${kind === "all" ? "" : `&kind=${kind}`}${includeAccountId ? `&includeAccountId=${encodeURIComponent(includeAccountId)}` : ""}`,
      ),
    getNextPageParam: (page) => (page.hasMore ? page.offset + page.items.length : undefined),
    enabled,
    staleTime: 10_000,
  });
}
