import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api-client";
import type { SlpCreatorPage } from "../../../../../shared/src/slp/slp-creator-page.js";
import { slpKeys } from "../../base/state/slp-query-keys";
import type { SlurpManagedStageProfile } from "../../base/state/slp-state-types";

/** Put the saved Page into the cached Creator list at once, so the profile never shows the old one. */
function useApplyPage() {
  const queryClient = useQueryClient();
  return (accountId: string, page: SlpCreatorPage | null) => {
    queryClient.setQueryData<SlurpManagedStageProfile[]>(slpKeys.noodlerAccounts(), (profiles) =>
      profiles?.map((profile) => (profile.id === accountId ? { ...profile, page } : profile)),
    );
    void queryClient.invalidateQueries({ queryKey: slpKeys.noodlerAccounts() });
  };
}

/** The player's own edit. `null` removes the Page. */
export function useSaveSlurpCreatorPage() {
  const applyPage = useApplyPage();
  return useMutation({
    mutationFn: (input: { accountId: string; page: SlpCreatorPage | null }) =>
      api.put<{ page: SlpCreatorPage | null }>(`/slurp2/slurp/accounts/${encodeURIComponent(input.accountId)}/page`, {
        page: input.page,
      }),
    onSuccess: (result, input) => applyPage(input.accountId, result.page),
  });
}

/** "Let <Creator> design it": one model call on the AI budget's "Creator pages" row. */
export function useComposeSlurpCreatorPage() {
  const applyPage = useApplyPage();
  return useMutation({
    mutationFn: (accountId: string) =>
      api.post<{ page: SlpCreatorPage }>(`/slurp2/slurp/accounts/${encodeURIComponent(accountId)}/page/compose`),
    onSuccess: (result, accountId) => applyPage(accountId, result.page),
  });
}
