import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api-client.js";
import { slpKeys } from "../../base/state/slp-query-keys.js";
import type { SlpLiveView } from "../../../../../shared/src/slp/slp-live.js";

export type SlpLiveListEntry = {
  id: string;
  hostId: string;
  hostKind: string;
  startedAt: string;
  endsAt: string;
  viewers: number;
  heat: number;
};

const liveKey = (...parts: string[]) => [...slpKeys.all, "live", ...parts] as const;

/** Who is live now. Empty when Live is off. */
export function useSlpLiveNow() {
  return useQuery({
    queryKey: liveKey("now"),
    queryFn: () => api.get<{ shows: SlpLiveListEntry[] }>("/slurp2/slurp/live").then((data) => data.shows),
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    retry: false,
  });
}

/** One show on screen. Each poll also moves the show to now on the server. */
export function useSlpLiveShow(showId: string, personaId: string | null) {
  const query = personaId ? `?personaId=${encodeURIComponent(personaId)}` : "";
  return useQuery({
    queryKey: liveKey("show", showId, personaId ?? ""),
    queryFn: () => api.get<SlpLiveView>(`/slurp2/slurp/live/${encodeURIComponent(showId)}${query}`),
    refetchInterval: (state) => (state.state.data?.endedAt ? false : 4_000),
    refetchIntervalInBackground: false,
  });
}

export function useSlpLiveTip(showId: string, personaId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { amount: number; itemId?: string; requestId: string }) =>
      api.post<SlpLiveView>(`/slurp2/slurp/live/${encodeURIComponent(showId)}/tip`, { ...input, personaId }),
    onSuccess: (view) => qc.setQueryData(liveKey("show", showId, personaId ?? ""), view),
  });
}

/** The next beat of the show (model-written talk), or the player's chat message, which cuts in. */
export function useSlpLiveBeat(showId: string, personaId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { message?: string; joined?: boolean }) =>
      api.post<{ beat: string; show: SlpLiveView }>(`/slurp2/slurp/live/${encodeURIComponent(showId)}/beat`, {
        ...input,
        ...(personaId ? { personaId } : {}),
      }),
    onSuccess: ({ show }) => qc.setQueryData(liveKey("show", showId, personaId ?? ""), show),
  });
}

/** Buys a private block (or extends the player's own). */
export function useSlpLivePrivate(showId: string, personaId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { requestId: string }) =>
      api.post<SlpLiveView>(`/slurp2/slurp/live/${encodeURIComponent(showId)}/private`, { ...input, personaId }),
    onSuccess: (view) => qc.setQueryData(liveKey("show", showId, personaId ?? ""), view),
  });
}

/** The player goes live: as their persona's own Creator, or (from Stir) as `creatorId`. */
export function useSlpLiveHost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { personaId: string; creatorId?: string; minutes: number }) =>
      api.post<SlpLiveView>(`/slurp2/slurp/live/host`, input),
    onSuccess: (view, input) => {
      qc.setQueryData(liveKey("show", view.id, input.personaId), view);
      void qc.invalidateQueries({ queryKey: liveKey("now") });
    },
  });
}

/** The hosting player ends their show now. */
export function useSlpLiveEnd(showId: string, personaId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<SlpLiveView>(`/slurp2/slurp/live/${encodeURIComponent(showId)}/end`, { personaId }),
    onSuccess: (view) => {
      qc.setQueryData(liveKey("show", showId, personaId ?? ""), view);
      void qc.invalidateQueries({ queryKey: liveKey("now") });
    },
  });
}
