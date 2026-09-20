import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api-client.js";
import { slpKeys } from "../../base/state/slp-query-keys.js";
import type {
  SlpCreatorViewerWallets,
  SlurpGoalProgress,
  SlurpStudioCreator,
  SlurpWallet,
} from "./slp-economy-contract.js";

/** Withdraw earnings into spending money. This is what connects the two seats you play. */
export function useSlurpPayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ creatorAccountId, ...body }: { creatorAccountId: string; personaId: string; amount: number }) =>
      api.post<{ allowance: number }>(`/slurp2/slurp/accounts/${encodeURIComponent(creatorAccountId)}/payout`, body),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: [...slpKeys.noodlerRoot(), "studio"] }),
        qc.invalidateQueries({ queryKey: [...slpKeys.noodlerRoot(), "wallet"] }),
        qc.invalidateQueries({ queryKey: slpKeys.slpCreatorViewers() }),
        qc.invalidateQueries({ queryKey: [...slpKeys.noodlerRoot(), "viewer-wallets"] }),
      ]),
  });
}
/** Open, replace, or clear a Creator's tip goal. Passing a null label clears it. */
export function useSetSlurpGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      creatorAccountId,
      ...body
    }: {
      creatorAccountId: string;
      personaId: string;
      label: string | null;
      target: number;
    }) =>
      api.put<{ goal: SlurpGoalProgress | null }>(
        `/slurp2/slurp/accounts/${encodeURIComponent(creatorAccountId)}/goal`,
        body,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...slpKeys.noodlerRoot(), "studio"] }),
  });
}
/** The Creator home. Reading it also re-marks the point future deltas are measured from. */
export function useSlurpStudio(personaId: string | null, enabled = true) {
  return useQuery({
    queryKey: [...slpKeys.noodlerRoot(), "studio", personaId ?? "none"],
    queryFn: () =>
      api.get<{ since: string | null; creators: SlurpStudioCreator[] }>(
        `/slurp2/slurp/studio?personaId=${encodeURIComponent(personaId!)}`,
      ),
    enabled: Boolean(personaId) && enabled,
    // The snapshot is rewritten on every read, so refetching would silently zero the deltas the
    // player is looking at. Read once per visit.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}
export function useSlurpWallet(personaId: string | null) {
  return useQuery({
    queryKey: [...slpKeys.noodlerRoot(), "wallet", personaId ?? "none"],
    queryFn: () => api.get<SlurpWallet>(`/slurp2/slurp/viewer/wallet?personaId=${encodeURIComponent(personaId!)}`),
    enabled: Boolean(personaId),
  });
}
export function useClaimSlurpDailyRefill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { personaId: string }) =>
      api.post<SlurpWallet>("/slurp2/slurp/viewer/wallet/daily-refill", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: slpKeys.noodlerRoot() }),
  });
}
export function useSetSlurpWalletCoinsForDevelopment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { personaId: string; coins: number }) =>
      api.post<SlurpWallet>("/slurp2/slurp/viewer/wallet/dev-set", input),
    onSuccess: (_wallet, input) =>
      queryClient.invalidateQueries({ queryKey: [...slpKeys.noodlerRoot(), "wallet", input.personaId] }),
  });
}
export function useTipSlurpCreator() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { accountId: string; personaId: string; amount: number; requestId?: string }) =>
      api.post<SlurpWallet>(`/slurp2/slurp/accounts/${encodeURIComponent(input.accountId)}/tip`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: slpKeys.noodlerRoot() }),
  });
}
/** Set a creator's own weekly price, or clear it back to the default with `null`. */
export function useSetSlurpCreatorPrice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { accountId: string; personaId: string; price: number | null }) =>
      api.put<{ price: number }>(`/slurp2/slurp/accounts/${encodeURIComponent(input.accountId)}/subscription-price`, {
        personaId: input.personaId,
        price: input.price,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: slpKeys.noodlerRoot() }),
  });
}
export function useCreatorViewerWallets(enabled = true) {
  return useQuery({
    queryKey: [...slpKeys.noodlerRoot(), "viewer-wallets"],
    queryFn: () => api.get<SlpCreatorViewerWallets>("/slurp2/slurp/viewer-wallets"),
    enabled,
    staleTime: 30_000,
  });
}
