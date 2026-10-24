import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api-client.js";
import type { SlpLiveShow, SlpLiveShowResponse } from "./slp-live-contract.js";

const key = (id: string | null, personaId?: string | null) =>
  ["slurp2", "live", id ?? "none", ...(personaId ? [personaId] : [])] as const;
/** The player wrote or tipped in the last 20 s and she has not answered yet. */
export function slpLiveReplyPending(show: SlpLiveShow | null | undefined): boolean {
  if (!show || show.endedAt) return false;
  const last = show.events.findLast((event) => event.fromPlayer);
  if (!last || show.events.some((event) => event.host && event.at >= last.at)) return false;
  return Date.now() - Date.parse(show.startedAt) - last.at < 20_000;
}

export function useSlpLiveShow(id: string | null, personaId: string | null) {
  return useQuery({
    queryKey: key(id, personaId),
    queryFn: () =>
      api.get<SlpLiveShowResponse>(
        `/slurp2/live/${encodeURIComponent(id!)}${personaId ? `?personaId=${encodeURIComponent(personaId)}` : ""}`,
      ),
    enabled: Boolean(id),
    refetchInterval: (query) =>
      id && !query.state.data?.endedAt ? (slpLiveReplyPending(query.state.data) ? 1_000 : 3_000) : false,
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
      qc.invalidateQueries({ queryKey: ["slurp2", "live", showId] }),
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
  const done = useMutation({
    mutationFn: (input: { personaId: string; requestId: string }) =>
      api.post<{ show: SlpLiveShow }>(
        `/slurp2/live/${encodeURIComponent(showId)}/menu/${encodeURIComponent(input.requestId)}/done`,
        { personaId: input.personaId },
      ),
    onSettled: invalidate,
  });
  const privateShow = useMutation({
    mutationFn: (input: { personaId: string; requestId: string }) =>
      api.post<{ show: SlpLiveShow }>(`/slurp2/live/${encodeURIComponent(showId)}/private`, input),
    onSettled: invalidate,
  });
  const mode = useMutation({
    mutationFn: (input: { personaId: string; mode: "text" | "pictures" }) =>
      api.post<{ show: SlpLiveShow }>(`/slurp2/live/${encodeURIComponent(showId)}/mode`, input),
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
  return { tip, chat, menu, done, privateShow, mode, narrate, end };
}

export function useStartSlpPlayerLive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      personaId: string;
      duration: 20 | 30 | 40;
      goal?: number;
      menu?: { id: string; enabled: boolean; price: number }[];
    }) => api.post<{ show: SlpLiveShow }>("/slurp2/live/start", input),
    onSettled: () => qc.invalidateQueries({ queryKey: ["slurp2", "live"] }),
  });
}
