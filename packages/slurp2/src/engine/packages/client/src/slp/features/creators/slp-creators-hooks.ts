import type { SlpAccountSettingsPatchInput } from "../../../../../shared/src/slp/slp-social-generation.schema.js";
import type { SlpAccount } from "../../../../../shared/src/slp/slp-social.types.js";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api-client.js";
import { slpKeys } from "../../base/state/slp-query-keys.js";
import type { SlurpManagedStageProfile } from "../../base/state/slp-state-types.js";
import type { SlurpCreatorBulkPatch, SlurpCreatorMetrics, SlurpScheduleStatus } from "./slp-creators-contract.js";

/** One edit applied to many Creators at once; a single Creator's quick edit uses it too. */
export function useBulkUpdateSlurpCreators() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { ids: string[]; patch: SlurpCreatorBulkPatch }) =>
      api.post<{ updated: number; skipped: number; tagLimitReached: number }>(
        "/slurp2/slurp/accounts/bulk-update",
        input,
      ),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: slpKeys.noodlerAccounts() }),
        queryClient.invalidateQueries({ queryKey: slpKeys.noodlerReserveStatus() }),
        queryClient.invalidateQueries({ queryKey: [...slpKeys.settings(), "discovery-tag-usage"] }),
        queryClient.invalidateQueries({ queryKey: slpKeys.noodlerRoot() }),
      ]),
  });
}
export function useCreatorAccounts(enabled = true) {
  return useQuery({
    queryKey: slpKeys.noodlerAccounts(),
    // The server sends `scheduleStatus` alongside the shared type, which has no such field — the
    // same arrangement `subscriptionPrice` and the tip goal already use.
    queryFn: () =>
      api.get<Array<SlurpManagedStageProfile & { scheduleStatus?: SlurpScheduleStatus }>>("/slurp2/slurp/accounts"),
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
    queryKey: [...slpKeys.noodlerRoot(), "creator-metrics"],
    queryFn: () => api.get<{ creators: SlurpCreatorMetrics[] }>("/slurp2/slurp/creator-metrics"),
    enabled,
    staleTime: 30_000,
  });
}
export function useCreatorEligibleAccounts(
  search: string,
  kind: "all" | "character" | "persona",
  enabled = true,
  includeAccountId?: string | null,
) {
  const normalizedSearch = search.trim();
  return useInfiniteQuery({
    queryKey: [...slpKeys.noodlerEligibleAccounts(normalizedSearch, kind), includeAccountId ?? "none"],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      api.get<{
        items: SlpAccount[];
        limit: number;
        offset: number;
        hasMore: boolean;
      }>(
        `/slurp2/slurp/eligible-accounts?limit=100&offset=${pageParam}&search=${encodeURIComponent(normalizedSearch)}${kind === "all" ? "" : `&kind=${kind}`}${includeAccountId ? `&includeAccountId=${encodeURIComponent(includeAccountId)}` : ""}`,
      ),
    getNextPageParam: (page) => (page.hasMore ? page.offset + page.items.length : undefined),
    enabled,
    staleTime: 10_000,
  });
}

/**
 * Save part of a Creator's strategy. `null` returns a value to its derived default; absent keys are
 * left alone, so one control never resets another.
 */
export function useUpdateCreatorStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      accountId,
      ...strategy
    }: {
      accountId: string;
      style?: "homemade" | "polished" | "documentary" | "theatrical" | null;
      skipRate?: number | null;
      textOnlyRate?: number | null;
      strategyText?: string | null;
    }) =>
      api.patch<SlpAccount>(`/slurp2/accounts/${encodeURIComponent(accountId)}/settings`, {
        subtree: "strategy",
        patch: strategy,
      } satisfies SlpAccountSettingsPatchInput),
    onSuccess: () => qc.invalidateQueries({ queryKey: slpKeys.noodlerAccounts() }),
  });
}
