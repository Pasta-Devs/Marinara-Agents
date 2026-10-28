import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../../lib/api-client.js";
import { invalidateSlurpMessages } from "../slp-message-keys.js";
import type { SlurpCommission } from "../slp-messages-contract.js";

// Settled, not success: a 409 or a timeout after the server already moved the commission must
// still refresh it, or the stale "Accept and pay" stays on screen.
export function useCreateSlurpCommission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { personaId: string; creatorAccountId: string; brief: string }) =>
      api.post<{ commission: SlurpCommission }>("/slurp2/messages/commissions", input),
    onSettled: () => invalidateSlurpMessages(queryClient),
  });
}
export function useQuoteSlurpCommission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { commissionId: string; personaId: string; price: number }) =>
      api.post<{ commission: SlurpCommission }>(
        `/slurp2/messages/commissions/${encodeURIComponent(input.commissionId)}/quote`,
        input,
      ),
    onSettled: () => invalidateSlurpMessages(queryClient),
  });
}
/** Offer the Creator a lower price than its quote. */
export function useCounterSlurpCommission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { commissionId: string; personaId: string; price: number }) =>
      api.post<{ commission: SlurpCommission }>(
        `/slurp2/messages/commissions/${encodeURIComponent(input.commissionId)}/counter`,
        input,
      ),
    onSettled: () => invalidateSlurpMessages(queryClient),
  });
}
export function useAcceptSlurpCommission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { commissionId: string; personaId: string }) =>
      api.post<{ commission: SlurpCommission }>(
        `/slurp2/messages/commissions/${encodeURIComponent(input.commissionId)}/accept`,
        input,
      ),
    onSettled: () => invalidateSlurpMessages(queryClient),
  });
}
/** Either side ends an unpaid commission: the Creator declines, the fan withdraws. */
export function useDeclineSlurpCommission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { commissionId: string; personaId: string }) =>
      api.post<{ commission: SlurpCommission }>(
        `/slurp2/messages/commissions/${encodeURIComponent(input.commissionId)}/decline`,
        input,
      ),
    onSettled: () => invalidateSlurpMessages(queryClient),
  });
}
export function useDeliverSlurpCommission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { commissionId: string; personaId: string; content: string; generateImage?: boolean }) =>
      api.post<{ commission: SlurpCommission }>(
        `/slurp2/messages/commissions/${encodeURIComponent(input.commissionId)}/deliver`,
        input,
      ),
    onSettled: () => invalidateSlurpMessages(queryClient),
  });
}
