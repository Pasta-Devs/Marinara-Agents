import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api-client.js";
import { noodleKeys } from "../../base/state/slp-query-keys.js";
import type {
  NoodlerViewerWallets,
  SlurpGoalProgress,
  SlurpStudioCreator,
  SlurpWallet,
} from "./slp-economy-contract.js";

/** Withdraw earnings into spending money. This is what connects the two seats you play. */
export function useSlurpPayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ creatorAccountId, ...body }: { creatorAccountId: string; personaId: string; amount: number }) =>
      api.post<{ allowance: number }>(`/slurp2/noodler/accounts/${encodeURIComponent(creatorAccountId)}/payout`, body),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: [...noodleKeys.noodlerRoot(), "studio"] }),
        qc.invalidateQueries({ queryKey: [...noodleKeys.noodlerRoot(), "wallet"] }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() }),
        qc.invalidateQueries({ queryKey: [...noodleKeys.noodlerRoot(), "viewer-wallets"] }),
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
        `/slurp2/noodler/accounts/${encodeURIComponent(creatorAccountId)}/goal`,
        body,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...noodleKeys.noodlerRoot(), "studio"] }),
  });
}
/** The Creator home. Reading it also re-marks the point future deltas are measured from. */
export function useSlurpStudio(personaId: string | null, enabled = true) {
  return useQuery({
    queryKey: [...noodleKeys.noodlerRoot(), "studio", personaId ?? "none"],
    queryFn: () =>
      api.get<{ since: string | null; creators: SlurpStudioCreator[] }>(
        `/slurp2/noodler/studio?personaId=${encodeURIComponent(personaId!)}`,
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
    queryKey: [...noodleKeys.noodlerRoot(), "wallet", personaId ?? "none"],
    queryFn: () => api.get<SlurpWallet>(`/slurp2/noodler/viewer/wallet?personaId=${encodeURIComponent(personaId!)}`),
    enabled: Boolean(personaId),
  });
}
export function useClaimSlurpDailyRefill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { personaId: string }) =>
      api.post<SlurpWallet>("/slurp2/noodler/viewer/wallet/daily-refill", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: noodleKeys.noodlerRoot() }),
  });
}
export function useSetSlurpWalletCoinsForDevelopment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { personaId: string; coins: number }) =>
      api.post<SlurpWallet>("/slurp2/noodler/viewer/wallet/dev-set", input),
    onSuccess: (_wallet, input) =>
      queryClient.invalidateQueries({ queryKey: [...noodleKeys.noodlerRoot(), "wallet", input.personaId] }),
  });
}
export function useTipSlurpCreator() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { accountId: string; personaId: string; amount: number; requestId?: string }) =>
      api.post<SlurpWallet>(`/slurp2/noodler/accounts/${encodeURIComponent(input.accountId)}/tip`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: noodleKeys.noodlerRoot() }),
  });
}
/** Set a creator's own weekly price, or clear it back to the default with `null`. */
export function useSetSlurpCreatorPrice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { accountId: string; personaId: string; price: number | null }) =>
      api.put<{ price: number }>(`/slurp2/noodler/accounts/${encodeURIComponent(input.accountId)}/subscription-price`, {
        personaId: input.personaId,
        price: input.price,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: noodleKeys.noodlerRoot() }),
  });
}
export function useNoodlerViewerWallets(enabled = true) {
  return useQuery({
    queryKey: [...noodleKeys.noodlerRoot(), "viewer-wallets"],
    queryFn: () => api.get<NoodlerViewerWallets>("/slurp2/noodler/viewer-wallets"),
    enabled,
    staleTime: 30_000,
  });
}
