import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../../lib/api-client.js";
import { invalidateSlurpMessages } from "../slp-message-keys.js";
import type { SlurpCommission } from "../slp-messages-contract.js";

export function useCreateSlurpCommission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { personaId: string; creatorAccountId: string; brief: string }) =>
      api.post<{ commission: SlurpCommission }>("/slurp2/messages/commissions", input),
    onSuccess: () => invalidateSlurpMessages(queryClient),
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
    onSuccess: () => invalidateSlurpMessages(queryClient),
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
    onSuccess: () => invalidateSlurpMessages(queryClient),
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
    onSuccess: () => invalidateSlurpMessages(queryClient),
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
    onSuccess: () => invalidateSlurpMessages(queryClient),
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
    onSuccess: () => invalidateSlurpMessages(queryClient),
  });
}
