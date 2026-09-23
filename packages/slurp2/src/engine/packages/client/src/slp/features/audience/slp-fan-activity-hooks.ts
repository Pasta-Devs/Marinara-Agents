import { useTranslation as useUiTranslation } from "react-i18next";
import { toast } from "sonner";
import type { SlpAccountSettingsPatchInput } from "../../../../../shared/src/slp/slp-social-generation.schema.js";
import type { SlpAccount, SlpCreatorFanActivitySettings } from "../../../../../shared/src/slp/slp-social.types.js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api-client.js";
import { useSlurpUIStore } from "../../base/state/slp-package-store.js";
import { slpKeys } from "../../base/state/slp-query-keys.js";

export function useUpdateCreatorFanActivity() {
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
    onSuccess: () => qc.invalidateQueries({ queryKey: slpKeys.noodlerAccounts() }),
  });
}
export function useRefreshCreatorFanActivityNow(options?: { notifications?: boolean }) {
  const qc = useQueryClient();
  const { t: localizeUi } = useUiTranslation();
  // Toasts live in the hook: the button called mutate() with no callbacks, so success and failure
  // were both silent.
  return useMutation({
    mutationKey: ["slurp", "audience-activity"],
    mutationFn: () =>
      api.post<{ status: string; created: number }>("/slurp2/slurp/fan-activity/refresh-now", {
        debugMode: useSlurpUIStore.getState().debugMode,
      }),
    onError: (error) =>
      options?.notifications !== false &&
      toast.error(
        error instanceof Error
          ? error.message
          : localizeUi("ui.slurp.settings.manual.audienceFailed", { defaultValue: "Audience activity failed." }),
      ),
    onSuccess: (result) => {
      options?.notifications !== false &&
        toast.success(
          result.created > 0
            ? localizeUi("ui.slurp.settings.audience.created", { count: result.created })
            : localizeUi("ui.slurp.settings.audience.createdNone"),
        );
      return Promise.all([
        qc.invalidateQueries({
          queryKey: [...slpKeys.noodlerRoot(), "posts"],
        }),
        qc.invalidateQueries({ queryKey: slpKeys.slpCreatorViewers() }),
        qc.invalidateQueries({ queryKey: slpKeys.noodlerFanStatus() }),
      ]);
    },
  });
}
export function useCreatorFanActivityStatus(enabled = true) {
  return useQuery({
    queryKey: slpKeys.noodlerFanStatus(),
    queryFn: () =>
      api.get<{
        localDate: string;
        usedRuns: number;
        runLimit: number;
        lastRun: { status: string; finishedAt: string | null } | null;
      }>("/slurp2/slurp/fan-activity/status"),
    enabled,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}

// ──────────────────────────────────────────────
// Direct messages
// ──────────────────────────────────────────────
