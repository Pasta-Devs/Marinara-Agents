import { useTranslation as useUiTranslation } from "react-i18next";
import type { SlpCreatorRefreshNowOutcome } from "../../../../../shared/src/slp/slp-social.types.js";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "../../../lib/api-client.js";
import { slpKeys } from "../../base/state/slp-query-keys.js";
import { countSlurpRefreshOutcomes, refreshSlurpCreatorBatch, slurpRefreshOutcomeNames } from "./slp-refresh-batch.js";

export function useRefreshCreatorConversationSchedule() {
  const qc = useQueryClient();
  const { t: localizeUi } = useUiTranslation();
  // Toasts live here, not in mutate() callbacks: those are dropped if the caller unmounts first.
  return useMutation({
    mutationKey: ["slurp", "conversation-schedule"],
    // `quiet` lets a batch show one summary instead of one toast per Creator.
    mutationFn: (input: string | { accountId: string; quiet: true }) =>
      api.post<{ state: "active"; blocks: number }>(
        `/slurp2/slurp/accounts/${encodeURIComponent(typeof input === "string" ? input : input.accountId)}/conversation-schedule/refresh`,
      ),
    onSuccess: (_result, input) => {
      if (typeof input === "string") toast.success(localizeUi("ui.slurp.settings.creators.scheduleRefreshed"));
      return qc.invalidateQueries({ queryKey: slpKeys.noodlerAccounts() });
    },
    onError: (error, input) => {
      if (typeof input !== "string") return;
      toast.error(
        error instanceof Error ? error.message : localizeUi("ui.slurp.settings.creators.scheduleRefreshFailed"),
      );
    },
  });
}
export function useRefreshTargetedCreatorsNow(onRemaining?: (remaining: number) => void) {
  const qc = useQueryClient();
  const { t } = useUiTranslation();
  return useMutation({
    mutationKey: ["slurp", "generate-posts"],
    mutationFn: (input: { accountIds: string[]; executionId?: string; access?: "public" | "locked" }) =>
      refreshSlurpCreatorBatch(
        input.accountIds,
        (accountId) =>
          api.post<{ outcomes: SlpCreatorRefreshNowOutcome[] }>("/slurp2/slurp/auto-post/refresh-targeted", {
            ...input,
            accountIds: [accountId],
          }),
        onRemaining,
      ),
    onSuccess: (result) => {
      const { made, skipped, failed } = countSlurpRefreshOutcomes(result.outcomes);
      if (skipped + failed > 0) {
        const accounts = qc.getQueryData<Array<{ id: string; displayName: string }>>(slpKeys.noodlerAccounts());
        const byId = new Map((accounts ?? []).map((account) => [account.id, account.displayName]));
        const nameFor = (accountId: string) => byId.get(accountId) ?? t("ui.slurp.ties.someone");
        // Name the Creators that did not post, so a short batch is never a mystery (R1-068).
        const list = (outcomeClass: "skipped" | "failed", key: string, moreKey: string) => {
          const { names, extra } = slurpRefreshOutcomeNames(result.outcomes, outcomeClass, nameFor);
          if (names.length === 0) return null;
          const joined = names.join(", ");
          return extra > 0 ? t(moreKey, { names: joined, count: extra }) : t(key, { names: joined });
        };
        const description = [
          list("skipped", "ui.slurp.creators.generateSkippedList", "ui.slurp.creators.generateSkippedListMore"),
          list("failed", "ui.slurp.creators.generateFailedList", "ui.slurp.creators.generateFailedListMore"),
        ]
          .filter((line): line is string => line !== null)
          .join("\n");
        const outcome = t("ui.slurp.creators.generateOutcome", {
          made,
          skipped,
          failed,
          defaultValue: "{{made}} new, {{skipped}} skipped, {{failed}} could not post.",
        });
        (made > 0 ? toast.info : toast.error)(outcome, { description, duration: 10_000 });
      }
      return Promise.all([
        qc.invalidateQueries({ queryKey: slpKeys.noodlerAccounts() }),
        qc.invalidateQueries({ queryKey: slpKeys.noodlerReserveStatus() }),
        qc.invalidateQueries({
          queryKey: [...slpKeys.noodlerRoot(), "posts"],
        }),
        qc.invalidateQueries({ queryKey: slpKeys.slpCreatorViewers() }),
      ]);
    },
  });
}
