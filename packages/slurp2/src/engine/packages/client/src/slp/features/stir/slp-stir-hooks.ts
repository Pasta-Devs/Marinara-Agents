import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api-client";
import { slpKeys } from "../../base/state/slp-query-keys";
import { useSlurpUIStore } from "../../base/state/slp-package-store";
import type { SlpActionResult } from "../../../../../shared/src/slp/slp-action-results.js";
import type {
  SlpActionPreview,
  SlpStirOrigin,
  SlpStirPlan,
  SlpStirPlanRequest,
  SlpStirPlay,
  SlpStirStep,
  SlpStirView,
} from "../../../../../shared/src/slp/slp-stir.js";

const base = "/slurp2/slurp/stir";
/** The persona playing: another persona's pages, couples and plays are out of its reach (0.3.11). */
const playing = () => useSlurpUIStore.getState().viewerPersonaId ?? undefined;
const viewKey = (personaId: string) => [...slpKeys.noodlerRoot(), "stir", personaId] as const;

/** Everything the Stir tab shows: what is in play, suggestions, recent plays, and the ids the cards pick from. */
export function useSlurpStir(personaId: string | null) {
  return useQuery({
    queryKey: viewKey(personaId ?? "none"),
    enabled: Boolean(personaId),
    queryFn: () => api.get<SlpStirView>(`${base}?personaId=${encodeURIComponent(personaId!)}`),
  });
}

/** Preview steps: who, what, when, cost, fit notes. Free and writes nothing. */
export function useSlurpStirPreview() {
  return useMutation({
    mutationFn: (steps: SlpStirStep[]) =>
      api.post<{ cards: SlpActionPreview[]; cant: string[] }>(`${base}/preview`, { steps, personaId: playing() }),
  });
}

/** Plain words → a plan of preview cards (one AI call on the "Plans" row). */
export function useSlurpStirPlan() {
  return useMutation({
    mutationFn: (request: SlpStirPlanRequest) => api.post<SlpStirPlan>(`${base}/plan`, request),
  });
}

/**
 * Do it / Undo. A play can touch anything (ties, steering, events, storylines, posts), so every
 * Slurp read refreshes afterwards, and so do the reads outside it that a play moves: the event
 * calendar, the AI budget meter and Pulse.
 */
export function useSlurpStirPlay() {
  const qc = useQueryClient();
  const refresh = () => {
    for (const queryKey of [
      slpKeys.noodlerRoot(),
      ["slurp2", "story"],
      ["slurp", "model-budget", "usage"],
      ["slurp", "pulse", "tasks"],
    ])
      void qc.invalidateQueries({ queryKey });
  };
  return {
    play: useMutation({
      mutationFn: (input: { steps: SlpStirStep[]; origin: SlpStirOrigin; supportMessageId?: string }) =>
        api.post<{ play: SlpStirPlay; results: { ok: boolean; error: string | null }[] }>(`${base}/play`, {
          ...input,
          personaId: playing(),
        }),
      onSuccess: refresh,
    }),
    undo: useMutation({
      mutationFn: (id: string) =>
        api.post<{ play: SlpStirPlay; kept: number }>(`${base}/plays/${encodeURIComponent(id)}/undo`, {
          personaId: playing(),
        }),
      onSuccess: refresh,
    }),
  };
}

/** "Not now" on a suggestion: it stays away for a few days (the server keeps it). */
export function useSlurpStirDismiss() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<{ ok: true }>(`${base}/suggestions/${encodeURIComponent(id)}/dismiss`, {}),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...slpKeys.noodlerRoot(), "stir"] }),
  });
}

/** Brands and products for the brand deal card (R), each product marked with its fit for this Creator. */
export function useSlurpStirBrands(accountId: string | null) {
  return useQuery({
    queryKey: [...slpKeys.noodlerRoot(), "stir", "brands", accountId ?? "none"] as const,
    enabled: Boolean(accountId),
    queryFn: () =>
      api.post<SlpActionResult["list-brands"]>("/slurp2/slurp/actions/list-brands", { accountId: accountId! }),
  });
}
