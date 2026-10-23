import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api-client.js";
import type { SlpLiveShow, SlpLiveShowResponse } from "./slp-live-contract.js";

const key = (id: string | null) => ["slurp2", "live", id ?? "none"] as const;
export function useSlpLiveShow(id: string | null) {
  return useQuery({
    queryKey: key(id),
    queryFn: () => api.get<SlpLiveShowResponse>(`/slurp2/live/${encodeURIComponent(id!)}`),
    enabled: Boolean(id),
    refetchInterval: (query) => (id && !query.state.data?.endedAt ? 3_000 : false),
    refetchIntervalInBackground: false,
  });
}
export function useSlpCurrentLiveShow(enabled = true) {
  return useQuery({
    queryKey: ["slurp2", "live", "current"],
    queryFn: () => api.get<{ shows: SlpLiveShow[] }>("/slurp2/live").then(({ shows }) => shows[0] ?? null),
    enabled,
    staleTime: 30_000,
    refetchInterval: enabled ? 60_000 : false,
    refetchIntervalInBackground: false,
  });
}
export function useSlpLiveActions(showId: string) {
  const qc = useQueryClient();
  const invalidate = () => Promise.all([
    qc.invalidateQueries({ queryKey: key(showId) }),
    qc.invalidateQueries({ queryKey: ["slurp2", "live", "current"] }),
  ]);
  const tip = useMutation({
    mutationFn: (input: { personaId: string; amount: number; requestId: string }) =>
      api.post<{ show: SlpLiveShow; wallet: unknown }>(`/slurp2/live/${encodeURIComponent(showId)}/tip`, input),
    onSettled: invalidate,
  });
  const chat = useMutation({
    mutationFn: (input: { personaId: string; text: string }) =>
      api.post<{ show: SlpLiveShow; replyQueued: boolean }>(`/slurp2/live/${encodeURIComponent(showId)}/chat`, input),
    onSettled: invalidate,
  });
  return { tip, chat };
}
