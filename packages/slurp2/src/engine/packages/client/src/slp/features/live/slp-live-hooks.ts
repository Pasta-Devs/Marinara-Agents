import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api-client.js";
import type { SlpLiveShow, SlpLiveShowResponse } from "./slp-live-contract.js";

const key = (id: string | null, personaId?: string | null) =>
  ["slurp2", "live", id ?? "none", ...(personaId ? [personaId] : [])] as const;
export function useSlpLiveShow(id: string | null, personaId: string | null) {
  return useQuery({
    queryKey: key(id, personaId),
    queryFn: () =>
      api.get<SlpLiveShowResponse>(
        `/slurp2/live/${encodeURIComponent(id!)}${personaId ? `?personaId=${encodeURIComponent(personaId)}` : ""}`,
      ),
    enabled: Boolean(id),
    refetchInterval: (query) => (id && !query.state.data?.endedAt ? 3_000 : false),
    refetchIntervalInBackground: false,
  });
}
export function useSlpCurrentLiveShow(enabled = true) {
  return useQuery({
    queryKey: ["slurp2", "live", "current"],
    queryFn: () =>
      api
        .get<{ shows: SlpLiveShow[] }>("/slurp2/live")
        .then(({ shows }) => shows.find((show) => !show.endedAt) ?? null),
    enabled,
    staleTime: 30_000,
    refetchInterval: enabled ? 60_000 : false,
    refetchIntervalInBackground: false,
  });
}
export function useSlpLiveActions(showId: string) {
  const qc = useQueryClient();
  const invalidate = () =>
    Promise.all([
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
  const menu = useMutation({
    mutationFn: (input: { personaId: string; itemId: string; requestId: string }) =>
      api.post<{ show: SlpLiveShow; wallet: unknown }>(`/slurp2/live/${encodeURIComponent(showId)}/menu`, input),
    onSettled: invalidate,
  });
  const narrate = useMutation({
    mutationFn: (input: { personaId: string; text: string }) =>
      api.post<{ show: SlpLiveShow }>(`/slurp2/live/${encodeURIComponent(showId)}/narrate`, input),
    onSettled: invalidate,
  });
  const end = useMutation({
    mutationFn: (input: { personaId: string }) =>
      api.post<{ show: SlpLiveShow }>(`/slurp2/live/${encodeURIComponent(showId)}/end`, input),
    onSettled: invalidate,
  });
  return { tip, chat, menu, narrate, end };
}

export function useStartSlpPlayerLive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { personaId: string; duration: 20 | 30 | 40 }) =>
      api.post<{ show: SlpLiveShow }>("/slurp2/live/start", input),
    onSettled: () => qc.invalidateQueries({ queryKey: ["slurp2", "live"] }),
  });
}
