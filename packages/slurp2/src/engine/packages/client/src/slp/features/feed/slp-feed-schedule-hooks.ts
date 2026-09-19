import type { SlpAccountSettingsPatchInput } from "../../../../../shared/src/slp/slp-social-generation.schema.js";
import type { SlpAccount, SlpCreatorManagedPost } from "../../../../../shared/src/slp/slp-social.types.js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api-client.js";
import { noodleKeys } from "../../base/state/slp-query-keys.js";
import type { SlurpReserveStatus } from "./slp-feed-contract.js";

export function useUpdateNoodlerAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, ...access }: { accountId: string; hiddenFromAccountIds: string[] }) =>
      api.patch<SlpAccount>(`/slurp2/accounts/${encodeURIComponent(accountId)}/settings`, {
        subtree: "privacy",
        patch: { access },
      } satisfies SlpAccountSettingsPatchInput),
    onSuccess: () => {
      return Promise.all([
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerAccounts() }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() }),
      ]);
    },
  });
}
export function useUpdateNoodlerAutoPosting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, ...autoPosting }: { accountId: string; enabled?: boolean; imagesEnabled?: boolean }) =>
      api.patch<SlpAccount>(`/slurp2/accounts/${encodeURIComponent(accountId)}/settings`, {
        subtree: "scheduler",
        patch: { autoPosting },
      } satisfies SlpAccountSettingsPatchInput),
    // Auto-post state lives only under noodlerAccounts(); the /slurp bootstrap has none of it.
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerAccounts() }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerReserveStatus() }),
      ]),
  });
}
export function useNoodlerReserveStatus(enabled = true) {
  return useQuery({
    queryKey: noodleKeys.noodlerReserveStatus(),
    queryFn: () => api.get<SlurpReserveStatus>("/slurp2/noodler/auto-post/status"),
    enabled,
    // The scheduler prepares posts on its own timer, so nothing here invalidates this key when
    // the counts change. Same 30s cadence the creator list already uses.
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}
export function useUpdateNoodlerScheduleSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slotId, publishAt }: { slotId: string; publishAt: string }) =>
      api.patch<SlurpReserveStatus>(`/slurp2/noodler/auto-post/schedule/${encodeURIComponent(slotId)}`, {
        publishAt,
      }),
    onSuccess: (status) => qc.setQueryData(noodleKeys.noodlerReserveStatus(), status),
  });
}
export function useRunNoodlerAutoPostNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) =>
      api.post<SlpCreatorManagedPost>(`/slurp2/noodler/accounts/${encodeURIComponent(accountId)}/auto-post/run-now`),
    onSuccess: (_post, accountId) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerPosts(accountId) }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() }),
      ]),
  });
}
