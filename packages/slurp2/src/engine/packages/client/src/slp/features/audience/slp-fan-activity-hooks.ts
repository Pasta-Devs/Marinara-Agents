import type { SlpAccountSettingsPatchInput } from "../../../../../shared/src/slp/slp-social-generation.schema.js";
import type { SlpAccount, SlpCreatorFanActivitySettings } from "../../../../../shared/src/slp/slp-social.types.js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api-client.js";
import { useSlurpUIStore } from "../../base/state/slp-package-store.js";
import { noodleKeys } from "../../base/state/slp-query-keys.js";

export function useUpdateNoodlerFanActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      accountId,
      fanActivity,
    }: {
      accountId: string;
      fanActivity: SlpCreatorFanActivitySettings | null;
    }) =>
      api.patch<SlpAccount>(`/slurp2/accounts/${encodeURIComponent(accountId)}/settings`, {
        subtree: "scheduler",
        patch: { fanActivity },
      } satisfies SlpAccountSettingsPatchInput),
    onSuccess: () => qc.invalidateQueries({ queryKey: noodleKeys.noodlerAccounts() }),
  });
}
export function useRefreshNoodlerFanActivityNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<{ status: string; created: number }>("/slurp2/noodler/fan-activity/refresh-now", {
        debugMode: useSlurpUIStore.getState().debugMode,
      }),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({
          queryKey: [...noodleKeys.noodlerRoot(), "posts"],
        }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerFanStatus() }),
      ]),
  });
}
export function useNoodlerFanActivityStatus(enabled = true) {
  return useQuery({
    queryKey: noodleKeys.noodlerFanStatus(),
    queryFn: () =>
      api.get<{
        localDate: string;
        usedRuns: number;
        runLimit: number;
        lastRun: { status: string; finishedAt: string | null } | null;
      }>("/slurp2/noodler/fan-activity/status"),
    enabled,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}

// ──────────────────────────────────────────────
// Direct messages
// ──────────────────────────────────────────────
