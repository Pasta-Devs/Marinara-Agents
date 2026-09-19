import { useTranslation as useUiTranslation } from "react-i18next";
import type { SlpCreatorRefreshNowOutcome } from "../../../../../shared/src/slp/slp-social.types.js";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "../../../lib/api-client.js";
import { slpKeys } from "../../base/state/slp-query-keys.js";
import { refreshSlurpCreatorBatch } from "./slp-refresh-batch.js";

export function useRefreshCreatorConversationSchedule() {
  const qc = useQueryClient();
  const { t: localizeUi } = useUiTranslation();
  // Toasts live here, not in mutate() callbacks: those are dropped if the caller unmounts first.
  return useMutation({
    mutationFn: (accountId: string) =>
      api.post<{ state: "active"; blocks: number }>(
        `/slurp2/noodler/accounts/${encodeURIComponent(accountId)}/conversation-schedule/refresh`,
      ),
    onSuccess: () => {
      toast.success(localizeUi("ui.slurp.settings.creators.scheduleRefreshed"));
      return qc.invalidateQueries({ queryKey: slpKeys.noodlerAccounts() });
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : localizeUi("ui.slurp.settings.creators.scheduleRefreshFailed"),
      ),
  });
}
export function useRefreshTargetedCreatorsNow(onRemaining?: (remaining: number) => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { accountIds: string[]; executionId?: string; access?: "public" | "locked" }) =>
      refreshSlurpCreatorBatch(
        input.accountIds,
        (accountId) =>
          api.post<{ outcomes: SlpCreatorRefreshNowOutcome[] }>("/slurp2/noodler/auto-post/refresh-targeted", {
            ...input,
            accountIds: [accountId],
          }),
        onRemaining,
      ),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: slpKeys.noodlerAccounts() }),
        qc.invalidateQueries({ queryKey: slpKeys.noodlerReserveStatus() }),
        qc.invalidateQueries({
          queryKey: [...slpKeys.noodlerRoot(), "posts"],
        }),
        qc.invalidateQueries({ queryKey: slpKeys.slpCreatorViewers() }),
      ]),
  });
}
